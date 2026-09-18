-- Disb Gestao v1.5.1 - Avarias de Vendas: camera/GPS, 2 fotos por validade,
-- decisao em duas etapas e confirmacao de avaria lancada.
-- Execute uma unica vez DEPOIS do SQL 18_v1_4_0_permissoes_avarias_vendas.sql.
-- O script e idempotente e pode ser executado novamente em caso de duvida.

begin;

-- ---------------------------------------------------------------------------
-- PERMISSOES
-- Mantemos o codigo SALES_DAMAGE_OVERRIDE para os usuarios que ja tinham a
-- permissao de "reverter decisoes". A partir desta atualizacao ela passa a ser
-- a permissao da DECISAO FINAL.
-- ---------------------------------------------------------------------------
insert into public.permissions(code,module,name,description,sort_order) values
  ('SALES_DAMAGE_REVIEW','Avarias de Vendas','Decisao do Gerente de Vendas','Primeira decisao: aprovar para analise final ou reprovar produtos pendentes.',40),
  ('SALES_DAMAGE_OVERRIDE','Avarias de Vendas','Decisao final','Decisao final dos produtos que foram aprovados pelo Gerente de Vendas e estao em analise.',50),
  ('SALES_DAMAGE_POST','Avarias de Vendas','Marcar avaria lancada','Confirmar que uma avaria aprovada ja foi lancada no sistema.',60)
on conflict(code) do update set
  module=excluded.module,
  name=excluded.name,
  description=excluded.description,
  sort_order=excluded.sort_order,
  active=true;

insert into public.role_permissions(role,permission_code)
select 'ADMIN',code from public.permissions
where code in ('SALES_DAMAGE_REVIEW','SALES_DAMAGE_OVERRIDE','SALES_DAMAGE_POST')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- NOVOS CAMPOS DE AUDITORIA DA DECISAO FINAL E DO LANCAMENTO
-- ---------------------------------------------------------------------------
alter table public.sales_damage_items add column if not exists final_reviewer_id uuid references auth.users(id);
alter table public.sales_damage_items add column if not exists final_reviewer_name text;
alter table public.sales_damage_items add column if not exists final_reviewer_role text;
alter table public.sales_damage_items add column if not exists final_reviewed_at timestamptz;
alter table public.sales_damage_items add column if not exists final_justification text not null default '';
alter table public.sales_damage_items add column if not exists launched_by uuid references auth.users(id);
alter table public.sales_damage_items add column if not exists launched_by_name text;
alter table public.sales_damage_items add column if not exists launched_at timestamptz;

-- Preserva a antiga reversao administrativa como decisao final historica.
update public.sales_damage_items
   set final_reviewer_id=coalesce(final_reviewer_id,admin_override_by),
       final_reviewer_name=coalesce(final_reviewer_name,admin_override_name),
       final_reviewer_role=coalesce(final_reviewer_role,'ADMIN'),
       final_reviewed_at=coalesce(final_reviewed_at,admin_override_at),
       final_justification=case when btrim(coalesce(final_justification,''))='' then coalesce(admin_override_justification,'') else final_justification end
 where admin_override_at is not null;

-- ---------------------------------------------------------------------------
-- STATUS NOVOS
-- Produto: PENDENTE -> EM_ANALISE -> APROVADO -> LANCADO
--                           \-> REPROVADO
-- Gerente pode reprovar direto a partir de PENDENTE.
-- ---------------------------------------------------------------------------
alter table public.sales_damage_items drop constraint if exists sales_damage_items_status_check;
alter table public.sales_damage_requests drop constraint if exists sales_damage_requests_status_check;

-- Aprovacoes registradas antes desta atualizacao permanecem APROVADAS.
-- O novo fluxo em duas etapas vale para as novas decisoes do Gerente de Vendas,
-- evitando reabrir historicos ja concluidos no processo anterior.

-- A antiga classificacao REPROVADO_ADMIN vira o status final REPROVADO.
update public.sales_damage_items set status='REPROVADO' where status='REPROVADO_ADMIN';

alter table public.sales_damage_items
  add constraint sales_damage_items_status_check
  check(status in ('PENDENTE','EM_ANALISE','APROVADO','REPROVADO','LANCADO'));

alter table public.sales_damage_requests
  add constraint sales_damage_requests_status_check
  check(status in ('PENDENTE','EM_ANALISE','PARCIAL','APROVADO','REPROVADO','LANCADO'));

create index if not exists idx_sales_damage_items_status_v151 on public.sales_damage_items(status,request_id);

-- ---------------------------------------------------------------------------
-- FOTOS DAS AVARIAS DE VENDAS
-- Uma foto para motivos normais; ate duas quando o motivo for VALIDADE.
-- Cada foto nova guarda o GPS capturado no momento da evidencia.
-- ---------------------------------------------------------------------------
create table if not exists public.sales_damage_item_photos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.sales_damage_items(id) on delete cascade,
  photo_order integer not null check(photo_order between 1 and 2),
  photo_path text not null,
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  gps_at timestamptz,
  created_at timestamptz not null default now(),
  unique(item_id,photo_order)
);

create index if not exists idx_sales_damage_item_photos_item on public.sales_damage_item_photos(item_id,photo_order);

-- Evidencias existentes continuam acessiveis. Como foram registradas antes
-- desta versao, nao possuem coordenadas GPS retroativas.
insert into public.sales_damage_item_photos(item_id,photo_order,photo_path)
select i.id,1,i.photo_path
from public.sales_damage_items i
where btrim(coalesce(i.photo_path,''))<>''
  and not exists(select 1 from public.sales_damage_item_photos p where p.item_id=i.id and p.photo_order=1)
on conflict(item_id,photo_order) do nothing;

-- ---------------------------------------------------------------------------
-- STATUS CONSOLIDADO DA SOLICITACAO
-- ---------------------------------------------------------------------------
create or replace function public.refresh_sales_damage_request_status(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_total integer;
  v_pending integer;
  v_analysis integer;
  v_approved integer;
  v_rejected integer;
  v_launched integer;
  v_status text;
begin
  select count(*),
         count(*) filter(where status='PENDENTE'),
         count(*) filter(where status='EM_ANALISE'),
         count(*) filter(where status='APROVADO'),
         count(*) filter(where status='REPROVADO'),
         count(*) filter(where status='LANCADO')
    into v_total,v_pending,v_analysis,v_approved,v_rejected,v_launched
  from public.sales_damage_items
  where request_id=p_request_id;

  v_status := case
    when v_total=0 or v_pending=v_total then 'PENDENTE'
    when v_analysis=v_total then 'EM_ANALISE'
    when v_approved=v_total then 'APROVADO'
    when v_rejected=v_total then 'REPROVADO'
    when v_launched=v_total then 'LANCADO'
    else 'PARCIAL'
  end;

  update public.sales_damage_requests
     set status=v_status,
         last_review_at=case when v_pending=v_total then last_review_at else now() end
   where id=p_request_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- CRIACAO DA SOLICITACAO
-- O backend valida quantidade de fotos e exige GPS para impedir que um cliente
-- antigo burle a regra apenas enviando um arquivo sem localizacao.
-- ---------------------------------------------------------------------------
create or replace function public.create_sales_damage_request(p_payload jsonb)
returns public.sales_damage_requests
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.profiles%rowtype;
  v_customer public.customers%rowtype;
  v_req public.sales_damage_requests%rowtype;
  v_item_row public.sales_damage_items%rowtype;
  v_item jsonb;
  v_ph jsonb;
  v_photos jsonb;
  v_order integer:=0;
  v_photo_order integer;
  v_photo_count integer;
  v_reason text;
  v_validity date;
  v_first_path text;
  v_path text;
  v_lat double precision;
  v_lon double precision;
  v_accuracy double precision;
  v_gps_at timestamptz;
begin
  if not public.has_permission('SALES_DAMAGE_CREATE') then raise exception 'FORBIDDEN'; end if;

  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  if v_profile.id is null then raise exception 'UNAUTHORIZED'; end if;

  select * into v_customer from public.customers
  where id=nullif(btrim(coalesce(p_payload->>'customer_id','')),'')::uuid;
  if v_customer.id is null then raise exception 'PDV_INVALIDO'; end if;

  if jsonb_typeof(coalesce(p_payload->'items','[]'::jsonb))<>'array'
     or jsonb_array_length(coalesce(p_payload->'items','[]'::jsonb))=0 then
    raise exception 'PRODUTO_OBRIGATORIO';
  end if;

  insert into public.sales_damage_requests(
    request_code,occurrence_date,seller_id,seller_username,seller_name,
    customer_id,customer_code,customer_name,city,branch,status,created_by
  ) values(
    null,(timezone('America/Fortaleza',now()))::date,auth.uid(),v_profile.username,v_profile.name,
    v_customer.id,v_customer.code,v_customer.name,v_customer.city,v_customer.branch,'PENDENTE',auth.uid()
  ) returning * into v_req;

  for v_item in select value from jsonb_array_elements(p_payload->'items') loop
    v_order:=v_order+1;
    v_reason:=upper(btrim(coalesce(v_item->>'reason','')));
    v_validity:=nullif(btrim(coalesce(v_item->>'validity_date','')),'')::date;
    v_photos:=coalesce(v_item->'photos','[]'::jsonb);

    if btrim(coalesce(v_item->>'product',''))='' then raise exception 'PRODUTO_OBRIGATORIO'; end if;
    if coalesce((v_item->>'quantity')::numeric,0)<=0 then raise exception 'QUANTIDADE_INVALIDA'; end if;
    if upper(btrim(coalesce(v_item->>'unit',''))) not in ('CAIXA','UNIDADE') then raise exception 'UNIDADE_INVALIDA'; end if;
    if v_reason='' then raise exception 'MOTIVO_OBRIGATORIO'; end if;
    if v_reason='VALIDADE' and v_validity is null then raise exception 'VALIDADE_OBRIGATORIA'; end if;
    if jsonb_typeof(v_photos)<>'array' then raise exception 'FOTO_OBRIGATORIA'; end if;

    v_photo_count:=jsonb_array_length(v_photos);
    if v_photo_count<1 then raise exception 'FOTO_OBRIGATORIA'; end if;
    if (v_reason='VALIDADE' and v_photo_count>2) or (v_reason<>'VALIDADE' and v_photo_count>1) then
      raise exception 'FOTOS_EXCEDIDAS';
    end if;

    v_first_path:=btrim(coalesce((v_photos->0)->>'photo_path',''));
    if v_first_path='' then raise exception 'FOTO_OBRIGATORIA'; end if;

    insert into public.sales_damage_items(
      request_id,item_order,product_text,quantity,quantity_unit,reason,validity_date,photo_path,status
    ) values(
      v_req.id,v_order,btrim(v_item->>'product'),(v_item->>'quantity')::numeric,
      upper(btrim(v_item->>'unit')),v_reason,v_validity,v_first_path,'PENDENTE'
    ) returning * into v_item_row;

    v_photo_order:=0;
    for v_ph in select value from jsonb_array_elements(v_photos) loop
      v_photo_order:=v_photo_order+1;
      v_path:=btrim(coalesce(v_ph->>'photo_path',''));
      if v_path='' then raise exception 'FOTO_OBRIGATORIA'; end if;

      begin
        v_lat:=nullif(btrim(coalesce(v_ph->>'latitude','')),'')::double precision;
        v_lon:=nullif(btrim(coalesce(v_ph->>'longitude','')),'')::double precision;
        v_accuracy:=nullif(btrim(coalesce(v_ph->>'accuracy','')),'')::double precision;
        v_gps_at:=nullif(btrim(coalesce(v_ph->>'gps_at','')),'')::timestamptz;
      exception when others then
        raise exception 'GPS_FOTO_OBRIGATORIO';
      end;

      if v_lat is null or v_lon is null or v_gps_at is null
         or v_lat not between -90 and 90 or v_lon not between -180 and 180 then
        raise exception 'GPS_FOTO_OBRIGATORIO';
      end if;

      insert into public.sales_damage_item_photos(
        item_id,photo_order,photo_path,latitude,longitude,accuracy,gps_at
      ) values(
        v_item_row.id,v_photo_order,v_path,v_lat,v_lon,v_accuracy,v_gps_at
      );
    end loop;
  end loop;

  return v_req;
end;
$$;

-- ---------------------------------------------------------------------------
-- ETAPA 1 - GERENTE DE VENDAS
-- APROVAR nao conclui mais o produto: envia para EM_ANALISE.
-- ---------------------------------------------------------------------------
create or replace function public.review_sales_damage_items(
  p_item_ids uuid[],
  p_status text,
  p_justification text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.profiles%rowtype;
  v_status text:=upper(btrim(coalesce(p_status,'')));
  v_next_status text;
  v_note text:=btrim(coalesce(p_justification,''));
  v_req uuid;
  v_count integer;
begin
  if not public.has_permission('SALES_DAMAGE_REVIEW') then raise exception 'FORBIDDEN'; end if;
  if v_status not in ('APROVADO','REPROVADO') then raise exception 'STATUS_INVALIDO'; end if;
  if v_note='' then raise exception 'JUSTIFICATIVA_OBRIGATORIA'; end if;
  if p_item_ids is null or cardinality(p_item_ids)=0 then raise exception 'ITEM_OBRIGATORIO'; end if;

  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  if v_profile.id is null then raise exception 'UNAUTHORIZED'; end if;

  v_next_status:=case when v_status='APROVADO' then 'EM_ANALISE' else 'REPROVADO' end;

  update public.sales_damage_items
     set status=v_next_status,
         reviewer_id=auth.uid(),
         reviewer_name=v_profile.name,
         reviewer_role=v_profile.role,
         reviewed_at=now(),
         review_justification=v_note,
         final_reviewer_id=null,
         final_reviewer_name=null,
         final_reviewer_role=null,
         final_reviewed_at=null,
         final_justification='',
         launched_by=null,
         launched_by_name=null,
         launched_at=null
   where id=any(p_item_ids)
     and status='PENDENTE';

  get diagnostics v_count=row_count;
  if v_count=0 then raise exception 'NENHUM_ITEM_PENDENTE'; end if;

  for v_req in select distinct request_id from public.sales_damage_items where id=any(p_item_ids) loop
    perform public.refresh_sales_damage_request_status(v_req);
  end loop;

  return jsonb_build_object('updated',v_count,'status',v_next_status);
end;
$$;

-- ---------------------------------------------------------------------------
-- ETAPA 2 - DECISAO FINAL
-- Usa a antiga permissao SALES_DAMAGE_OVERRIDE para manter os usuarios que ja
-- estavam habilitados para reverter decisoes.
-- ---------------------------------------------------------------------------
create or replace function public.finalize_sales_damage_items(
  p_item_ids uuid[],
  p_status text,
  p_justification text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.profiles%rowtype;
  v_status text:=upper(btrim(coalesce(p_status,'')));
  v_note text:=btrim(coalesce(p_justification,''));
  v_req uuid;
  v_count integer;
begin
  if not public.has_permission('SALES_DAMAGE_OVERRIDE') then raise exception 'FORBIDDEN'; end if;
  if v_status not in ('APROVADO','REPROVADO') then raise exception 'STATUS_INVALIDO'; end if;
  if v_note='' then raise exception 'JUSTIFICATIVA_OBRIGATORIA'; end if;
  if p_item_ids is null or cardinality(p_item_ids)=0 then raise exception 'ITEM_OBRIGATORIO'; end if;

  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  if v_profile.id is null then raise exception 'UNAUTHORIZED'; end if;

  update public.sales_damage_items
     set status=v_status,
         final_reviewer_id=auth.uid(),
         final_reviewer_name=v_profile.name,
         final_reviewer_role=v_profile.role,
         final_reviewed_at=now(),
         final_justification=v_note,
         launched_by=null,
         launched_by_name=null,
         launched_at=null
   where id=any(p_item_ids)
     and status='EM_ANALISE';

  get diagnostics v_count=row_count;
  if v_count=0 then raise exception 'NENHUM_ITEM_EM_ANALISE'; end if;

  for v_req in select distinct request_id from public.sales_damage_items where id=any(p_item_ids) loop
    perform public.refresh_sales_damage_request_status(v_req);
  end loop;

  return jsonb_build_object('updated',v_count,'status',v_status);
end;
$$;

-- Compatibilidade com clientes antigos: a antiga RPC de reversao passa a
-- significar reprovacao na decisao final de itens EM_ANALISE.
create or replace function public.override_sales_damage_approval(
  p_item_ids uuid[],
  p_justification text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  return public.finalize_sales_damage_items(p_item_ids,'REPROVADO',p_justification);
end;
$$;

-- ---------------------------------------------------------------------------
-- ETAPA 3 - AVARIA LANCADA NO SISTEMA
-- ---------------------------------------------------------------------------
create or replace function public.mark_sales_damage_item_launched(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.profiles%rowtype;
  v_req uuid;
  v_count integer;
begin
  if not public.has_permission('SALES_DAMAGE_POST') then raise exception 'FORBIDDEN'; end if;

  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  if v_profile.id is null then raise exception 'UNAUTHORIZED'; end if;

  select request_id into v_req from public.sales_damage_items where id=p_item_id;
  if v_req is null then raise exception 'ITEM_NAO_ENCONTRADO'; end if;

  update public.sales_damage_items
     set status='LANCADO',
         launched_by=auth.uid(),
         launched_by_name=v_profile.name,
         launched_at=now()
   where id=p_item_id
     and status='APROVADO';

  get diagnostics v_count=row_count;
  if v_count=0 then raise exception 'ITEM_NAO_APROVADO'; end if;

  perform public.refresh_sales_damage_request_status(v_req);
  return jsonb_build_object('updated',1,'status','LANCADO');
end;
$$;

-- Atualiza o status consolidado de solicitacoes existentes.
do $$
declare v_req uuid;
begin
  for v_req in select id from public.sales_damage_requests loop
    perform public.refresh_sales_damage_request_status(v_req);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS / LEITURA
-- Usuarios habilitados somente para lancamento tambem precisam abrir a tela de
-- gestao e visualizar as evidencias do produto aprovado.
-- ---------------------------------------------------------------------------
alter table public.sales_damage_item_photos enable row level security;

drop policy if exists sales_damage_requests_read on public.sales_damage_requests;
create policy sales_damage_requests_read on public.sales_damage_requests for select to authenticated
using (
  (public.has_permission('SALES_DAMAGE_VIEW_OWN') and seller_id=auth.uid())
  or public.has_permission('SALES_DAMAGE_VIEW_ALL')
  or public.has_permission('SALES_DAMAGE_REVIEW')
  or public.has_permission('SALES_DAMAGE_OVERRIDE')
  or public.has_permission('SALES_DAMAGE_POST')
);

drop policy if exists sales_damage_items_read on public.sales_damage_items;
create policy sales_damage_items_read on public.sales_damage_items for select to authenticated
using (
  exists(
    select 1 from public.sales_damage_requests r
    where r.id=request_id and (
      (public.has_permission('SALES_DAMAGE_VIEW_OWN') and r.seller_id=auth.uid())
      or public.has_permission('SALES_DAMAGE_VIEW_ALL')
      or public.has_permission('SALES_DAMAGE_REVIEW')
      or public.has_permission('SALES_DAMAGE_OVERRIDE')
      or public.has_permission('SALES_DAMAGE_POST')
    )
  )
);

drop policy if exists sales_damage_item_photos_read on public.sales_damage_item_photos;
create policy sales_damage_item_photos_read on public.sales_damage_item_photos for select to authenticated
using (
  exists(
    select 1
    from public.sales_damage_items i
    join public.sales_damage_requests r on r.id=i.request_id
    where i.id=item_id and (
      (public.has_permission('SALES_DAMAGE_VIEW_OWN') and r.seller_id=auth.uid())
      or public.has_permission('SALES_DAMAGE_VIEW_ALL')
      or public.has_permission('SALES_DAMAGE_REVIEW')
      or public.has_permission('SALES_DAMAGE_OVERRIDE')
      or public.has_permission('SALES_DAMAGE_POST')
    )
  )
);

-- Storage: inclui o usuario habilitado a marcar lancamento.
drop policy if exists sales_damage_read on storage.objects;
create policy sales_damage_read on storage.objects for select to authenticated
using (
  bucket_id='avarias-vendas' and (
    (storage.foldername(name))[1]=auth.uid()::text
    or public.has_permission('SALES_DAMAGE_VIEW_ALL')
    or public.has_permission('SALES_DAMAGE_REVIEW')
    or public.has_permission('SALES_DAMAGE_OVERRIDE')
    or public.has_permission('SALES_DAMAGE_POST')
  )
);

-- ---------------------------------------------------------------------------
-- GRANTS / REALTIME
-- ---------------------------------------------------------------------------
grant select on public.sales_damage_item_photos to authenticated;
grant execute on function public.create_sales_damage_request(jsonb) to authenticated;
grant execute on function public.review_sales_damage_items(uuid[],text,text) to authenticated;
grant execute on function public.finalize_sales_damage_items(uuid[],text,text) to authenticated;
grant execute on function public.override_sales_damage_approval(uuid[],text) to authenticated;
grant execute on function public.mark_sales_damage_item_launched(uuid) to authenticated;

do $$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='sales_damage_item_photos'
  ) then
    execute 'alter publication supabase_realtime add table public.sales_damage_item_photos';
  end if;
exception when undefined_object then
  null;
end $$;

commit;

-- Verificacao rapida.
select code,module,name,active from public.permissions
where code in ('SALES_DAMAGE_REVIEW','SALES_DAMAGE_OVERRIDE','SALES_DAMAGE_POST')
order by sort_order;

select table_name,column_name,data_type
from information_schema.columns
where table_schema='public'
  and table_name in ('sales_damage_items','sales_damage_item_photos')
  and column_name in ('status','final_reviewed_at','launched_at','photo_path','latitude','longitude','gps_at')
order by table_name,ordinal_position;
