-- Disb Gestao v1.4.0 - Permissoes por funcionalidade + Avarias de Vendas
-- Execute uma unica vez no SQL Editor do Supabase depois do script 17_v1_3_0.

begin;

-- ---------------------------------------------------------------------------
-- PERFIS / NOVOS CARGOS
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in (
    'ADMIN','COLABORADOR_ARMAZEM','COLABORADOR_ENTREGA','CONFERENTE','MOTORISTA_PUXADOR',
    'VENDEDOR','GERENTE_VENDAS'
  ));

-- ---------------------------------------------------------------------------
-- PERMISSOES POR FUNCIONALIDADE
-- ---------------------------------------------------------------------------
create table if not exists public.permissions (
  code text primary key,
  module text not null,
  name text not null,
  description text not null default '',
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_permissions_updated on public.permissions;
create trigger trg_permissions_updated before update on public.permissions
for each row execute function public.touch_updated_at();

create table if not exists public.role_permissions (
  role text not null,
  permission_code text not null references public.permissions(code) on update cascade on delete cascade,
  created_at timestamptz not null default now(),
  primary key(role,permission_code)
);

create table if not exists public.user_permissions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_code text not null references public.permissions(code) on update cascade on delete cascade,
  allowed boolean not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key(user_id,permission_code)
);

drop trigger if exists trg_user_permissions_updated on public.user_permissions;
create trigger trg_user_permissions_updated before update on public.user_permissions
for each row execute function public.touch_updated_at();

insert into public.permissions(code,module,name,description,sort_order) values
  ('NRI_PENDING_VIEW','NRI','Recebimentos e impressões pendentes','Visualizar filas de recebimento e impressão de NRI.',10),
  ('MARKETPLACE_RECEIVE','NRI','Recebimento Marketplace','Iniciar/finalizar recebimentos Marketplace.',20),
  ('NRI_CREATE','NRI','Cadastrar NRI','Criar requisições e NRIs.',30),
  ('NRI_PRINT','NRI','Imprimir NRI','Imprimir, reimprimir e confirmar impressão.',40),
  ('NRI_HISTORY','NRI','Histórico NRI','Consultar o histórico completo de NRI.',50),
  ('NRI_DAMAGE_HISTORY','NRI','Paletes avariados','Consultar histórico e evidências de paletes avariados.',60),

  ('DELIVERY_DAMAGE_CREATE','Avarias de Entrega','Registrar avaria','Cadastrar avarias de entrega com foto, GPS e assinatura.',10),
  ('DELIVERY_DAMAGE_VIEW_ALL','Avarias de Entrega','Visualizar todas','Consultar todas as avarias de entrega.',20),
  ('DELIVERY_DAMAGE_REVIEW','Avarias de Entrega','Aprovar / reprovar','Aprovar ou reprovar itens de avarias de entrega.',30),

  ('SALES_DAMAGE_CREATE','Avarias de Vendas','Cadastrar solicitação','Cadastrar solicitação de avaria de vendas.',10),
  ('SALES_DAMAGE_VIEW_OWN','Avarias de Vendas','Visualizar próprias','Consultar as próprias solicitações.',20),
  ('SALES_DAMAGE_VIEW_ALL','Avarias de Vendas','Visualizar todas','Consultar todas as solicitações de avarias de vendas.',30),
  ('SALES_DAMAGE_REVIEW','Avarias de Vendas','Aprovar / reprovar','Gerente de Vendas pode decidir um ou mais produtos com justificativa.',40),
  ('SALES_DAMAGE_OVERRIDE','Avarias de Vendas','Reverter aprovação','Admin pode reprovar aprovação do Gerente de Vendas com justificativa.',50),

  ('CONF_CREATE','Conferência','Realizar conferência','Registrar conferência de vasilhames.',10),
  ('CONF_OWN_HISTORY','Conferência','Minhas conferências','Consultar conferências próprias.',20),
  ('CONF_HISTORY','Conferência','Histórico completo','Consultar histórico completo de conferências.',30),
  ('CONF_DASHBOARD','Conferência','Dashboard','Consultar dashboard de conferência.',40),

  ('FEFO_CREATE','Contagem FEFO','Nova contagem','Iniciar, editar e finalizar uma contagem FEFO.',10),
  ('FEFO_ACTIVE','Contagem FEFO','Contagens em andamento','Consultar e retomar contagens em andamento.',20),
  ('FEFO_REPORT','Contagem FEFO','Relatórios','Consultar relatórios e baixar CSV FEFO.',30),

  ('PULL_TRIP','Puxada','Viagem','Iniciar ciclo e registrar etapas/ocorrências da Puxada.',10),
  ('PULL_FAROL','Puxada','Farol de andamento','Consultar viagens em andamento e mapa.',20),
  ('PULL_HISTORY','Puxada','Histórico','Consultar histórico de ciclos.',30),
  ('PULL_DASHBOARD','Puxada','Dashboards','Consultar dashboards da Puxada/Transferência.',40),
  ('PULL_GOALS','Puxada','Metas','Consultar e manter metas.',50),
  ('PULL_CONFIG','Puxada','Configurações','Configurar GPS, fábricas, veículos e etapas.',60),
  ('PULL_TMA_ADJUST','Puxada','Ajustar TMA','Ajustar TMA Revenda com justificativa e auditoria.',70),

  ('ADMIN_USERS','Administração','Usuários e permissões','Criar/editar usuários e permissões.',10),
  ('ADMIN_BASES','Administração','Bases / importação','Importar e manter bases auxiliares.',20)
on conflict(code) do update set
  module=excluded.module,
  name=excluded.name,
  description=excluded.description,
  sort_order=excluded.sort_order,
  active=true;

-- Recria os padrões para evitar permissões antigas conflitantes.
delete from public.role_permissions;

-- ADMIN recebe tudo pelo helper, mas mantemos as linhas para a tela administrativa.
insert into public.role_permissions(role,permission_code)
select 'ADMIN',code from public.permissions where active=true;

-- Armazém / Conferente: mesmo conjunto operacional histórico.
insert into public.role_permissions(role,permission_code) values
  ('COLABORADOR_ARMAZEM','NRI_PENDING_VIEW'),('COLABORADOR_ARMAZEM','MARKETPLACE_RECEIVE'),
  ('COLABORADOR_ARMAZEM','NRI_CREATE'),('COLABORADOR_ARMAZEM','NRI_PRINT'),
  ('COLABORADOR_ARMAZEM','CONF_CREATE'),('COLABORADOR_ARMAZEM','CONF_OWN_HISTORY'),
  ('COLABORADOR_ARMAZEM','FEFO_CREATE'),('COLABORADOR_ARMAZEM','FEFO_ACTIVE'),('COLABORADOR_ARMAZEM','FEFO_REPORT'),
  ('CONFERENTE','NRI_PENDING_VIEW'),('CONFERENTE','MARKETPLACE_RECEIVE'),
  ('CONFERENTE','NRI_CREATE'),('CONFERENTE','NRI_PRINT'),
  ('CONFERENTE','CONF_CREATE'),('CONFERENTE','CONF_OWN_HISTORY'),
  ('CONFERENTE','FEFO_CREATE'),('CONFERENTE','FEFO_ACTIVE'),('CONFERENTE','FEFO_REPORT'),
  ('COLABORADOR_ENTREGA','DELIVERY_DAMAGE_CREATE'),
  ('MOTORISTA_PUXADOR','PULL_TRIP'),
  ('VENDEDOR','SALES_DAMAGE_CREATE'),('VENDEDOR','SALES_DAMAGE_VIEW_OWN'),
  ('GERENTE_VENDAS','SALES_DAMAGE_CREATE'),('GERENTE_VENDAS','SALES_DAMAGE_VIEW_OWN'),
  ('GERENTE_VENDAS','SALES_DAMAGE_VIEW_ALL'),('GERENTE_VENDAS','SALES_DAMAGE_REVIEW')
on conflict do nothing;

create or replace function public.has_permission(p_code text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce((
    select case
      when pr.role='ADMIN' then true
      when up.allowed is not null then up.allowed
      else exists(
        select 1 from public.role_permissions rp
        where rp.role=pr.role and rp.permission_code=p.code
      )
    end
    from public.profiles pr
    join public.permissions p on p.code=p_code and p.active=true
    left join public.user_permissions up on up.user_id=pr.id and up.permission_code=p.code
    where pr.id=auth.uid() and pr.active=true
    limit 1
  ),false);
$$;

create or replace function public.get_my_permissions()
returns text[]
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(array_agg(p.code order by p.module,p.sort_order,p.code),array[]::text[])
  from public.permissions p
  where p.active=true and public.has_permission(p.code);
$$;

-- ---------------------------------------------------------------------------
-- AVARIAS DE VENDAS
-- ---------------------------------------------------------------------------
create sequence if not exists public.sales_damage_request_number_seq start 1;

create table if not exists public.sales_damage_requests (
  id uuid primary key default gen_random_uuid(),
  request_code text not null unique,
  occurrence_date date not null,
  seller_id uuid not null references auth.users(id),
  seller_username text not null,
  seller_name text not null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_code text not null,
  customer_name text not null,
  city text not null default '',
  branch text not null default '',
  status text not null default 'PENDENTE' check (status in ('PENDENTE','PARCIAL','APROVADO','REPROVADO')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  last_review_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_damage_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.sales_damage_requests(id) on delete cascade,
  item_order integer not null,
  product_text text not null,
  quantity numeric not null check(quantity>0),
  quantity_unit text not null check(quantity_unit in ('CAIXA','UNIDADE')),
  reason text not null,
  validity_date date,
  photo_path text not null,
  status text not null default 'PENDENTE' check(status in ('PENDENTE','APROVADO','REPROVADO','REPROVADO_ADMIN')),
  reviewer_id uuid references auth.users(id),
  reviewer_name text,
  reviewer_role text,
  reviewed_at timestamptz,
  review_justification text not null default '',
  admin_override_by uuid references auth.users(id),
  admin_override_name text,
  admin_override_at timestamptz,
  admin_override_justification text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sales_damage_requests_seller on public.sales_damage_requests(seller_id,created_at desc);
create index if not exists idx_sales_damage_requests_status on public.sales_damage_requests(status,created_at desc);
create index if not exists idx_sales_damage_items_request on public.sales_damage_items(request_id,item_order);
create index if not exists idx_sales_damage_items_status on public.sales_damage_items(status);

drop trigger if exists trg_sales_damage_requests_updated on public.sales_damage_requests;
create trigger trg_sales_damage_requests_updated before update on public.sales_damage_requests
for each row execute function public.touch_updated_at();

drop trigger if exists trg_sales_damage_items_updated on public.sales_damage_items;
create trigger trg_sales_damage_items_updated before update on public.sales_damage_items
for each row execute function public.touch_updated_at();

create or replace function public.assign_sales_damage_request_code()
returns trigger
language plpgsql
as $$
begin
  if new.request_code is null or btrim(new.request_code)='' then
    new.request_code := 'AVV-' || lpad(nextval('public.sales_damage_request_number_seq')::text,6,'0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_sales_damage_request_code on public.sales_damage_requests;
create trigger trg_assign_sales_damage_request_code before insert on public.sales_damage_requests
for each row execute function public.assign_sales_damage_request_code();

create or replace function public.refresh_sales_damage_request_status(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_total integer;
  v_pending integer;
  v_approved integer;
  v_rejected integer;
  v_status text;
begin
  select count(*),
         count(*) filter(where status='PENDENTE'),
         count(*) filter(where status='APROVADO'),
         count(*) filter(where status in ('REPROVADO','REPROVADO_ADMIN'))
    into v_total,v_pending,v_approved,v_rejected
  from public.sales_damage_items where request_id=p_request_id;

  v_status := case
    when v_total=0 or v_pending=v_total then 'PENDENTE'
    when v_approved=v_total then 'APROVADO'
    when v_rejected=v_total then 'REPROVADO'
    else 'PARCIAL'
  end;

  update public.sales_damage_requests
     set status=v_status,
         last_review_at=case when v_pending=v_total then last_review_at else now() end
   where id=p_request_id;
end;
$$;

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
  v_item jsonb;
  v_order integer:=0;
  v_reason text;
  v_validity date;
  v_count integer:=0;
begin
  if not public.has_permission('SALES_DAMAGE_CREATE') then raise exception 'FORBIDDEN'; end if;

  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  if v_profile.id is null then raise exception 'UNAUTHORIZED'; end if;

  select * into v_customer from public.customers
  where id=nullif(btrim(coalesce(p_payload->>'customer_id','')),'')::uuid;
  if v_customer.id is null then raise exception 'PDV_INVALIDO'; end if;

  if jsonb_typeof(coalesce(p_payload->'items','[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_payload->'items','[]'::jsonb))=0 then
    raise exception 'PRODUTO_OBRIGATORIO';
  end if;

  insert into public.sales_damage_requests(
    request_code,occurrence_date,seller_id,seller_username,seller_name,customer_id,customer_code,customer_name,city,branch,status,created_by
  ) values(
    null,(timezone('America/Fortaleza',now()))::date,auth.uid(),v_profile.username,v_profile.name,
    v_customer.id,v_customer.code,v_customer.name,v_customer.city,v_customer.branch,'PENDENTE',auth.uid()
  ) returning * into v_req;

  for v_item in select value from jsonb_array_elements(p_payload->'items') loop
    v_order:=v_order+1;
    v_count:=v_count+1;
    v_reason:=btrim(coalesce(v_item->>'reason',''));
    v_validity:=nullif(btrim(coalesce(v_item->>'validity_date','')),'')::date;

    if btrim(coalesce(v_item->>'product',''))='' then raise exception 'PRODUTO_OBRIGATORIO'; end if;
    if coalesce((v_item->>'quantity')::numeric,0)<=0 then raise exception 'QUANTIDADE_INVALIDA'; end if;
    if upper(btrim(coalesce(v_item->>'unit',''))) not in ('CAIXA','UNIDADE') then raise exception 'UNIDADE_INVALIDA'; end if;
    if v_reason='' then raise exception 'MOTIVO_OBRIGATORIO'; end if;
    if upper(v_reason)='VALIDADE' and v_validity is null then raise exception 'VALIDADE_OBRIGATORIA'; end if;
    if btrim(coalesce(v_item->>'photo_path',''))='' then raise exception 'FOTO_OBRIGATORIA'; end if;

    insert into public.sales_damage_items(
      request_id,item_order,product_text,quantity,quantity_unit,reason,validity_date,photo_path,status
    ) values(
      v_req.id,v_order,btrim(v_item->>'product'),(v_item->>'quantity')::numeric,
      upper(btrim(v_item->>'unit')),v_reason,v_validity,btrim(v_item->>'photo_path'),'PENDENTE'
    );
  end loop;

  return v_req;
end;
$$;

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

  update public.sales_damage_items
     set status=v_status,
         reviewer_id=auth.uid(),
         reviewer_name=v_profile.name,
         reviewer_role=v_profile.role,
         reviewed_at=now(),
         review_justification=v_note,
         admin_override_by=null,
         admin_override_name=null,
         admin_override_at=null,
         admin_override_justification=''
   where id=any(p_item_ids) and status='PENDENTE';
  get diagnostics v_count=row_count;
  if v_count=0 then raise exception 'NENHUM_ITEM_PENDENTE'; end if;

  for v_req in select distinct request_id from public.sales_damage_items where id=any(p_item_ids) loop
    perform public.refresh_sales_damage_request_status(v_req);
  end loop;

  return jsonb_build_object('updated',v_count,'status',v_status);
end;
$$;

create or replace function public.override_sales_damage_approval(
  p_item_ids uuid[],
  p_justification text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.profiles%rowtype;
  v_note text:=btrim(coalesce(p_justification,''));
  v_req uuid;
  v_count integer;
begin
  if not public.has_permission('SALES_DAMAGE_OVERRIDE') then raise exception 'FORBIDDEN'; end if;
  if v_note='' then raise exception 'JUSTIFICATIVA_OBRIGATORIA'; end if;
  if p_item_ids is null or cardinality(p_item_ids)=0 then raise exception 'ITEM_OBRIGATORIO'; end if;

  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  if v_profile.id is null then raise exception 'UNAUTHORIZED'; end if;

  update public.sales_damage_items
     set status='REPROVADO_ADMIN',
         admin_override_by=auth.uid(),
         admin_override_name=v_profile.name,
         admin_override_at=now(),
         admin_override_justification=v_note
   where id=any(p_item_ids)
     and status='APROVADO'
     and reviewer_role='GERENTE_VENDAS';
  get diagnostics v_count=row_count;
  if v_count=0 then raise exception 'NENHUMA_APROVACAO_GERENTE_SELECIONADA'; end if;

  for v_req in select distinct request_id from public.sales_damage_items where id=any(p_item_ids) loop
    perform public.refresh_sales_damage_request_status(v_req);
  end loop;

  return jsonb_build_object('updated',v_count,'status','REPROVADO_ADMIN');
end;
$$;


-- ---------------------------------------------------------------------------
-- CAMADA DE PERMISSOES NOS MODULOS EXISTENTES
-- A tela de permissoes nao apenas oculta menus: as RPCs abaixo tambem validam
-- a funcionalidade no PostgreSQL. Permissoes individuais podem ampliar ou
-- restringir o padrao do cargo sem depender de alteracoes no frontend.
-- ---------------------------------------------------------------------------
create or replace function public.create_nri_request(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.profiles%rowtype;
  v_req uuid;
  v_item jsonb;
  v_count integer;
  v_i integer;
  v_rows jsonb;
  v_type text;
  v_driver text;
  v_plate text;
  v_factory text;
  v_unit text;
  v_receipt_date date;
  v_receipt_time time;
  v_validity date;
  v_pull_trip uuid;
  v_pull public.pull_trips%rowtype;
  v_market_id uuid;
  v_market public.marketplace_receipts%rowtype;
  v_damage_id uuid;
  v_damaged boolean;
  v_damaged_pallets integer;
  v_reason text;
  v_invoice_number text;
  v_photos jsonb;
  v_photo jsonb;
  v_photo_order integer;
begin
  if not public.has_permission('NRI_CREATE') then raise exception 'FORBIDDEN'; end if;
  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  if v_profile.id is null then raise exception 'UNAUTHORIZED'; end if;

  v_type:=upper(coalesce(nullif(btrim(p_payload->>'request_type'),''),'AMBEV'));
  if v_type not in ('AMBEV','MARKETPLACE') then raise exception 'TIPO_NRI_INVALIDO'; end if;

  if coalesce(btrim(p_payload->>'pull_trip_id'),'')<>'' then
    v_pull_trip:=(p_payload->>'pull_trip_id')::uuid;
    select * into v_pull from public.pull_trips where id=v_pull_trip for update;
    if v_pull.id is null or v_pull.cycle_type<>'PULL' or v_pull.status<>'ARRIVED' or v_pull.nri_status<>'PENDING' then raise exception 'PUXADA_NAO_DISPONIVEL_PARA_NRI'; end if;
  end if;

  if coalesce(btrim(p_payload->>'marketplace_receipt_id'),'')<>'' then
    v_market_id:=(p_payload->>'marketplace_receipt_id')::uuid;
    select * into v_market from public.marketplace_receipts where id=v_market_id for update;
    if v_market.id is null or v_market.status<>'PENDING_NRI' or v_market.nri_status<>'PENDING' then raise exception 'MARKETPLACE_NAO_DISPONIVEL_PARA_NRI'; end if;
  end if;

  if v_pull_trip is not null and v_market_id is not null then raise exception 'FONTE_NRI_INVALIDA'; end if;

  if v_type='MARKETPLACE' then
    v_driver:='--';
    v_plate:='--';
    if v_market_id is not null then
      v_factory:=v_market.supplier_name;
      v_unit:=v_market.unit;
      v_receipt_date:=(v_market.ended_at at time zone 'America/Fortaleza')::date;
      v_receipt_time:=(v_market.ended_at at time zone 'America/Fortaleza')::time;
    else
      v_factory:=btrim(p_payload->>'factory');
      v_unit:=btrim(p_payload->>'unit');
      v_receipt_date:=(p_payload->>'receipt_date')::date;
      v_receipt_time:=(p_payload->>'receipt_time')::time;
      if coalesce(v_factory,'')='' then raise exception 'FORNECEDOR_MARKETPLACE_OBRIGATORIO'; end if;
    end if;
  else
    v_driver:=btrim(p_payload->>'driver');
    v_plate:=upper(btrim(p_payload->>'plate'));
    v_factory:=btrim(p_payload->>'factory');
    v_unit:=btrim(p_payload->>'unit');
    v_receipt_date:=(p_payload->>'receipt_date')::date;
    v_receipt_time:=(p_payload->>'receipt_time')::time;
    if coalesce(v_driver,'')='' or coalesce(v_plate,'')='' or coalesce(v_factory,'')='' then raise exception 'DADOS_TRANSPORTE_OBRIGATORIOS'; end if;
  end if;

  if coalesce(v_unit,'')='' or not exists(select 1 from public.units where name=v_unit and active=true) then raise exception 'UNIDADE_INVALIDA'; end if;

  insert into public.nri_requests(
    unit,request_type,receipt_date,checker_id,checker_name,receipt_time,driver,plate,factory,created_by,pull_trip_id,marketplace_receipt_id
  ) values(
    v_unit,v_type,v_receipt_date,auth.uid(),v_profile.name,v_receipt_time,
    v_driver,v_plate,v_factory,auth.uid(),v_pull_trip,v_market_id
  ) returning id into v_req;

  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'items','[]'::jsonb)) loop
    v_count:=greatest(1,coalesce((v_item->>'pallets')::integer,1));
    v_validity:=nullif(btrim(coalesce(v_item->>'validity_date','')),'')::date;
    v_damaged:=lower(coalesce(v_item->>'pallet_damaged','false')) in ('true','1','yes','sim');
    v_damaged_pallets:=coalesce(nullif(v_item->>'damaged_pallets','')::integer,0);
    v_reason:=btrim(coalesce(v_item->>'damage_reason',''));
    v_invoice_number:=btrim(coalesce(v_item->>'invoice_number',''));
    v_photos:=case when jsonb_typeof(v_item->'damage_photos')='array' then v_item->'damage_photos' else '[]'::jsonb end;

    if v_damaged then
      if v_damaged_pallets<1 or v_damaged_pallets>v_count then raise exception 'QTD_PALETE_AVARIADO_INVALIDA'; end if;
      if v_reason='' then raise exception 'MOTIVO_PALETE_AVARIADO_OBRIGATORIO'; end if;
      if v_invoice_number='' then raise exception 'NOTA_FISCAL_PALETE_AVARIADO_OBRIGATORIA'; end if;
      if jsonb_array_length(v_photos)<1 then raise exception 'FOTO_PALETE_AVARIADO_OBRIGATORIA'; end if;
      if jsonb_array_length(v_photos)>5 then raise exception 'MAXIMO_5_FOTOS_PALETE_AVARIADO'; end if;
    end if;

    for v_i in 1..v_count loop
      insert into public.nris(
        nri,request_id,product_code,product_name,unit,request_type,validity_date,lot,receipt_date,block_date,
        checker_name,receipt_time,driver,plate,factory,quantity,status,created_by,created_by_username,created_by_name
      ) values(
        null,v_req,btrim(v_item->>'product_code'),btrim(v_item->>'product_name'),v_unit,v_type,
        v_validity,upper(btrim(v_item->>'lot')),v_receipt_date,
        case when v_validity is null then null else (v_validity-30) end,
        v_profile.name,v_receipt_time,v_driver,v_plate,v_factory,
        greatest(0,(v_item->>'quantity')::integer),'PENDENTE',auth.uid(),v_profile.username,v_profile.name
      );
    end loop;

    if v_damaged then
      insert into public.nri_damage_items(
        request_id,product_code,product_name,lot,total_pallets,damaged_pallets,reason,invoice_number,created_by
      ) values(
        v_req,btrim(v_item->>'product_code'),btrim(v_item->>'product_name'),upper(btrim(v_item->>'lot')),
        v_count,v_damaged_pallets,v_reason,v_invoice_number,auth.uid()
      ) returning id into v_damage_id;

      v_photo_order:=0;
      for v_photo in select value from jsonb_array_elements(v_photos) loop
        v_photo_order:=v_photo_order+1;
        insert into public.nri_damage_photos(damage_item_id,photo_order,photo_path)
        values(v_damage_id,v_photo_order,btrim(v_photo->>'photo_path'));
      end loop;
    end if;
  end loop;

  if v_pull_trip is not null then
    update public.pull_trips set nri_status='COMPLETED' where id=v_pull_trip;
  end if;
  if v_market_id is not null then
    update public.marketplace_receipts set status='COMPLETED',nri_status='COMPLETED' where id=v_market_id;
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at,x.nri),'[]'::jsonb) into v_rows
  from public.nris x where x.request_id=v_req;

  return jsonb_build_object('request_id',v_req,'pull_trip_id',v_pull_trip,'marketplace_receipt_id',v_market_id,'nris',v_rows);
end;
$$;

create or replace function public.confirm_nri_print(p_ids uuid[], p_reprint boolean default false, p_result text default 'IMPRESSO')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_codes text[];
begin
  if not public.has_permission('NRI_PRINT') then raise exception 'FORBIDDEN'; end if;
  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  select coalesce(array_agg(nri order by nri),'{}') into v_codes from public.nris where id=any(p_ids);

  if upper(p_result)='IMPRESSO' and not p_reprint then
    update public.nris set status='IMPRESSO', printed_at=now() where id=any(p_ids) and status='PENDENTE';
  end if;

  insert into public.print_events(event_type,nri_ids,nri_codes,result,copies,user_id,username,user_name,observation)
  values(case when p_reprint then 'REIMPRESSAO' else 'IMPRESSAO' end,p_ids,v_codes,upper(p_result),
         case when upper(p_result)='IMPRESSO' then 3 else null end,auth.uid(),v_profile.username,v_profile.name,'');
  return jsonb_build_object('ok',true,'count',cardinality(p_ids));
end;
$$;

create or replace function public.remove_nris(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  if not public.has_permission('NRI_PRINT') then raise exception 'FORBIDDEN'; end if;
  update public.nris set status='REMOVIDO',removed_at=now() where id=any(p_ids) and status='PENDENTE';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.sync_nri_sequence()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v_max bigint;
begin
  if not public.has_permission('ADMIN_BASES') then raise exception 'FORBIDDEN'; end if;
  select coalesce(max(nullif(regexp_replace(nri,E'\\D','','g'),'')::bigint),0) into v_max from public.nris;
  if v_max > 0 then
    perform setval('public.nri_number_seq', v_max, true);
  else
    perform setval('public.nri_number_seq', 1, false);
  end if;
  return v_max;
end;
$$;

create or replace function public.create_damage_request(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_req uuid;
  v_item jsonb;
  v_item_id uuid;
  v_order integer := 0;
  v_photos jsonb;
  v_photo jsonb;
  v_first_photo jsonb;
  v_photo_order integer;
begin
  if not public.has_permission('DELIVERY_DAMAGE_CREATE') then raise exception 'FORBIDDEN'; end if;

  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  if v_profile.id is null then raise exception 'UNAUTHORIZED'; end if;

  insert into public.damage_requests(
    occurrence_date,delivery_user_id,delivery_username,delivery_name,customer_code,customer_name,city,map_number,
    signature_path,status,created_by
  ) values(
    (p_payload->>'date')::date,auth.uid(),v_profile.username,v_profile.name,btrim(p_payload->>'customer_code'),
    btrim(p_payload->>'customer_name'),btrim(p_payload->>'city'),btrim(p_payload->>'map_number'),
    btrim(p_payload->>'signature_path'),'PENDENTE',auth.uid()
  ) returning id into v_req;

  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'items','[]'::jsonb)) loop
    v_order := v_order + 1;
    v_photos := case when jsonb_typeof(v_item->'photos')='array' then v_item->'photos' else '[]'::jsonb end;

    -- Compatibilidade: se o cliente antigo mandar somente photo_path/GPS no item,
    -- converte para um array de uma foto.
    if jsonb_array_length(v_photos)=0 and coalesce(v_item->>'photo_path','')<>'' then
      v_photos := jsonb_build_array(jsonb_build_object(
        'photo_path',v_item->>'photo_path',
        'latitude',v_item->>'latitude',
        'longitude',v_item->>'longitude',
        'accuracy',v_item->>'accuracy',
        'gps_at',v_item->>'gps_at'
      ));
    end if;

    if jsonb_array_length(v_photos)=0 then raise exception 'FOTO_OBRIGATORIA'; end if;
    if jsonb_array_length(v_photos)>5 then raise exception 'MAXIMO_5_FOTOS'; end if;

    v_first_photo := v_photos->0;

    insert into public.damage_items(
      request_id,item_order,product_text,lot,quantity,quantity_unit,reason,
      photo_path,latitude,longitude,gps_accuracy,gps_captured_at
    ) values(
      v_req,v_order,btrim(v_item->>'product'),upper(btrim(v_item->>'lot')),(v_item->>'quantity')::numeric,
      upper(v_item->>'unit'),btrim(v_item->>'reason'),btrim(v_first_photo->>'photo_path'),
      (v_first_photo->>'latitude')::double precision,(v_first_photo->>'longitude')::double precision,
      nullif(v_first_photo->>'accuracy','')::double precision,nullif(v_first_photo->>'gps_at','')::timestamptz
    ) returning id into v_item_id;

    v_photo_order := 0;
    for v_photo in select value from jsonb_array_elements(v_photos) loop
      v_photo_order := v_photo_order + 1;
      insert into public.damage_item_photos(
        item_id,photo_order,photo_path,latitude,longitude,gps_accuracy,gps_captured_at
      ) values(
        v_item_id,v_photo_order,btrim(v_photo->>'photo_path'),
        (v_photo->>'latitude')::double precision,(v_photo->>'longitude')::double precision,
        nullif(v_photo->>'accuracy','')::double precision,nullif(v_photo->>'gps_at','')::timestamptz
      );
    end loop;
  end loop;

  return v_req;
end;
$$;

create or replace function public.review_damage_items(p_item_ids uuid[], p_status text, p_note text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_req uuid;
  v_status text;
  v_pending integer;
  v_appr integer;
  v_rej integer;
begin
  if not public.has_permission('DELIVERY_DAMAGE_REVIEW') then raise exception 'FORBIDDEN'; end if;
  v_status := upper(p_status);
  if v_status not in ('APROVADO','REPROVADO') then raise exception 'STATUS_INVALIDO'; end if;
  select * into v_profile from public.profiles where id=auth.uid() and active=true;

  update public.damage_items
  set status=v_status, reviewer_id=auth.uid(), reviewer_name=v_profile.name, reviewed_at=now(), review_note=coalesce(p_note,'')
  where id=any(p_item_ids);

  for v_req in select distinct request_id from public.damage_items where id=any(p_item_ids) loop
    select count(*) filter(where status='PENDENTE'),count(*) filter(where status='APROVADO'),count(*) filter(where status='REPROVADO')
      into v_pending,v_appr,v_rej from public.damage_items where request_id=v_req;
    update public.damage_requests
      set status=case when v_pending>0 then 'PARCIAL' when v_appr>0 and v_rej=0 then 'APROVADO' when v_rej>0 and v_appr=0 then 'REPROVADO' else 'PARCIAL' end,
          last_review_at=now()
      where id=v_req;
  end loop;
  return jsonb_build_object('ok',true,'count',cardinality(p_item_ids));
end;
$$;

create or replace function public.create_container_conference(
  p_map_number text,p_g300 integer,p_g600_green integer,p_g600_brown integer,p_g_litrao integer,p_keg30 integer,p_keg50 integer
)
returns public.container_conferences
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_now timestamp;
  v_row public.container_conferences%rowtype;
begin
  if not public.has_permission('CONF_CREATE') then raise exception 'FORBIDDEN'; end if;
  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  v_now := timezone('America/Fortaleza', now());
  insert into public.container_conferences(
    conference_date,conference_time,checker_id,checker_username,checker_name,map_number,g300,g600_green,g600_brown,g_litrao,keg30,keg50
  ) values(
    v_now::date,v_now::time,auth.uid(),v_profile.username,v_profile.name,regexp_replace(coalesce(p_map_number,''),E'\\D','','g'),
    greatest(0,p_g300),greatest(0,p_g600_green),greatest(0,p_g600_brown),greatest(0,p_g_litrao),greatest(0,p_keg30),greatest(0,p_keg50)
  ) returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.start_marketplace_receipt(p_unit text,p_supplier_id uuid)
returns public.marketplace_receipts
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.profiles%rowtype;
  v_supplier public.marketplace_suppliers%rowtype;
  v_row public.marketplace_receipts%rowtype;
  v_unit text:=btrim(coalesce(p_unit,''));
begin
  if not public.has_permission('MARKETPLACE_RECEIVE') then raise exception 'FORBIDDEN'; end if;
  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  if v_profile.id is null then raise exception 'UNAUTHORIZED'; end if;
  if v_unit='' or not exists(select 1 from public.units where name=v_unit and active=true) then raise exception 'UNIDADE_INVALIDA'; end if;
  select * into v_supplier from public.marketplace_suppliers where id=p_supplier_id and active=true;
  if v_supplier.id is null then raise exception 'FORNECEDOR_MARKETPLACE_INVALIDO'; end if;
  if exists(select 1 from public.marketplace_receipts where checker_id=auth.uid() and status='IN_PROGRESS') then raise exception 'RECEBIMENTO_MARKETPLACE_EM_ANDAMENTO'; end if;

  insert into public.marketplace_receipts(unit,supplier_id,supplier_name,checker_id,checker_name,status,nri_status)
  values(v_unit,v_supplier.id,v_supplier.name,auth.uid(),v_profile.name,'IN_PROGRESS','NOT_READY')
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.finish_marketplace_receipt(p_receipt_id uuid)
returns public.marketplace_receipts
language plpgsql
security definer
set search_path=public
as $$
declare
  v_row public.marketplace_receipts%rowtype;
  v_now timestamptz:=now();
begin
  if not public.has_permission('MARKETPLACE_RECEIVE') then raise exception 'FORBIDDEN'; end if;
  select * into v_row from public.marketplace_receipts where id=p_receipt_id for update;
  if v_row.id is null then raise exception 'RECEBIMENTO_MARKETPLACE_NAO_ENCONTRADO'; end if;
  if not public.is_admin() and v_row.checker_id<>auth.uid() then raise exception 'FORBIDDEN'; end if;
  if v_row.status<>'IN_PROGRESS' then raise exception 'RECEBIMENTO_MARKETPLACE_NAO_ESTA_EM_ANDAMENTO'; end if;

  update public.marketplace_receipts
     set ended_at=v_now,
         duration_seconds=greatest(0,floor(extract(epoch from (v_now-started_at)))::integer),
         status='PENDING_NRI',
         nri_status='PENDING'
   where id=v_row.id
   returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.start_pull_trip(
  p_origin_unit text,
  p_plate text,
  p_factory text,
  p_carrier text,
  p_driver2 uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision default null,
  p_device_at timestamptz default null
)
returns public.pull_trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_driver2 public.profiles%rowtype;
  v_trip public.pull_trips%rowtype;
  v_start_step public.pull_steps%rowtype;
  v_next_step public.pull_steps%rowtype;
  v_origin text;
  v_plate text;
  v_carrier text;
  v_max_accuracy integer := 200;
  v_now timestamptz := now();
begin
  if not public.has_permission('PULL_TRIP') then raise exception 'FORBIDDEN'; end if;
  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  if v_profile.id is null then raise exception 'UNAUTHORIZED'; end if;

  select * into v_driver2 from public.profiles where id=p_driver2 and role='MOTORISTA_PUXADOR' and active=true;
  if v_driver2.id is null then raise exception 'MOTORISTA_2_INVALIDO'; end if;
  if v_driver2.id=v_profile.id then raise exception 'MOTORISTA_2_DEVE_SER_OUTRO_USUARIO'; end if;

  if exists(select 1 from public.pull_trips t where t.status='IN_PROGRESS' and (t.driver1_id in (v_profile.id,v_driver2.id) or t.driver2_id in (v_profile.id,v_driver2.id))) then
    raise exception 'MOTORISTA_COM_CICLO_EM_ANDAMENTO';
  end if;

  if not exists(select 1 from public.factories where name=p_factory and active=true) then raise exception 'FABRICA_INVALIDA'; end if;
  v_origin := btrim(coalesce(p_origin_unit,''));
  if v_origin='' or not exists(select 1 from public.units where name=v_origin and active=true) then raise exception 'ORIGEM_INVALIDA'; end if;
  v_carrier := btrim(coalesce(p_carrier,''));
  if v_carrier='' then raise exception 'PARCEIRO_OBRIGATORIO'; end if;

  select coalesce(gps_max_accuracy_m,200) into v_max_accuracy from public.pull_settings where singleton=true;
  v_max_accuracy := least(500,greatest(5,coalesce(v_max_accuracy,200)));
  if p_accuracy is null or p_accuracy>v_max_accuracy then
    raise exception 'GPS_PRECISAO_INSUFICIENTE:%:%',coalesce(round(p_accuracy)::text,'SEM_SINAL'),v_max_accuracy;
  end if;

  v_plate := upper(regexp_replace(coalesce(p_plate,''),'[^A-Za-z0-9]','','g'));
  if v_plate='' then raise exception 'PLACA_OBRIGATORIA'; end if;
  if exists(select 1 from public.pull_trips where plate=v_plate and status='IN_PROGRESS') then raise exception 'PLACA_COM_CICLO_EM_ANDAMENTO'; end if;

  update public.pull_trips
     set next_started_at=v_now, kpi_status='CLOSED'
   where id=(select id from public.pull_trips where plate=v_plate and cycle_type='PULL' and status='ARRIVED' and next_started_at is null order by ended_at desc limit 1);

  insert into public.pull_trips(
    cycle_type,origin_unit,plate,carrier,factory,driver1_id,driver1_name,driver2_id,driver2_name,
    active_driver_id,active_driver_name,started_at,start_latitude,start_longitude,start_accuracy
  ) values(
    'PULL',v_origin,v_plate,v_carrier,p_factory,v_profile.id,v_profile.name,v_driver2.id,v_driver2.name,
    v_profile.id,v_profile.name,v_now,p_latitude,p_longitude,p_accuracy
  ) returning * into v_trip;

  select * into v_start_step from public.pull_steps where action_code='START_TRIP' and step_type='MAIN' and flow_type='PULL' and active=true limit 1;
  if v_start_step.id is null then raise exception 'ETAPA_INICIO_NAO_CONFIGURADA'; end if;

  insert into public.pull_events(
    trip_id,step_id,step_name,action_code,step_order,user_id,user_name,recorded_at,device_at,latitude,longitude,gps_accuracy
  ) values(
    v_trip.id,v_start_step.id,v_start_step.name,v_start_step.action_code,v_start_step.sort_order,
    v_profile.id,v_profile.name,v_now,p_device_at,p_latitude,p_longitude,p_accuracy
  );

  select * into v_next_step from public.pull_steps
   where step_type='MAIN' and flow_type='PULL' and active=true and sort_order>v_start_step.sort_order
   order by sort_order limit 1;

  if v_next_step.id is not null then
    if v_next_step.executor_driver=2 then
      update public.pull_trips set active_driver_id=v_driver2.id,active_driver_name=v_driver2.name where id=v_trip.id returning * into v_trip;
    else
      update public.pull_trips set active_driver_id=v_profile.id,active_driver_name=v_profile.name where id=v_trip.id returning * into v_trip;
    end if;
  end if;

  return v_trip;
end;
$$;

create or replace function public.start_transfer_trip(
  p_plate text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision default null,
  p_device_at timestamptz default null
)
returns public.pull_trips
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.profiles%rowtype;
  v_trip public.pull_trips%rowtype;
  v_start_step public.pull_steps%rowtype;
  v_plate text;
  v_max_accuracy integer:=200;
  v_now timestamptz:=now();
begin
  if not public.has_permission('PULL_TRIP') then raise exception 'FORBIDDEN'; end if;
  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  if v_profile.id is null then raise exception 'UNAUTHORIZED'; end if;

  if exists(select 1 from public.pull_trips t where t.status='IN_PROGRESS' and (t.driver1_id=v_profile.id or t.driver2_id=v_profile.id)) then
    raise exception 'MOTORISTA_COM_CICLO_EM_ANDAMENTO';
  end if;
  if not exists(select 1 from public.units where name='Matriz Caicó' and active=true) then raise exception 'MATRIZ_CAICO_NAO_CONFIGURADA'; end if;
  if not exists(select 1 from public.units where name='Filial Pau dos Ferros' and active=true) then raise exception 'FILIAL_PAU_DOS_FERROS_NAO_CONFIGURADA'; end if;

  select coalesce(gps_max_accuracy_m,200) into v_max_accuracy from public.pull_settings where singleton=true;
  v_max_accuracy:=least(500,greatest(5,coalesce(v_max_accuracy,200)));
  if p_accuracy is null or p_accuracy>v_max_accuracy then
    raise exception 'GPS_PRECISAO_INSUFICIENTE:%:%',coalesce(round(p_accuracy)::text,'SEM_SINAL'),v_max_accuracy;
  end if;

  v_plate:=upper(regexp_replace(coalesce(p_plate,''),'[^A-Za-z0-9]','','g'));
  if v_plate='' then raise exception 'PLACA_OBRIGATORIA'; end if;
  if exists(select 1 from public.pull_trips where plate=v_plate and status='IN_PROGRESS') then raise exception 'PLACA_COM_CICLO_EM_ANDAMENTO'; end if;

  -- Se a mesma placa terminou uma Puxada e agora inicia uma Transferencia,
  -- este inicio fecha o TMA Revenda e o ciclo KPI da Puxada anterior.
  update public.pull_trips
     set next_started_at=v_now, kpi_status='CLOSED'
   where id=(select id from public.pull_trips where plate=v_plate and cycle_type='PULL' and status='ARRIVED' and next_started_at is null order by ended_at desc limit 1);

  insert into public.pull_trips(
    cycle_type,origin_unit,plate,carrier,factory,driver1_id,driver1_name,driver2_id,driver2_name,
    active_driver_id,active_driver_name,started_at,start_latitude,start_longitude,start_accuracy,
    kpi_status,nri_status
  ) values(
    'TRANSFER','Matriz Caicó',v_plate,'TRANSFERENCIA','Filial Pau dos Ferros',
    v_profile.id,v_profile.name,v_profile.id,v_profile.name,v_profile.id,v_profile.name,
    v_now,p_latitude,p_longitude,p_accuracy,'IN_PROGRESS','NOT_READY'
  ) returning * into v_trip;

  select * into v_start_step from public.pull_steps where action_code='TRANSFER_START' and step_type='MAIN' and flow_type='TRANSFER' and active=true limit 1;
  if v_start_step.id is null then raise exception 'ETAPA_INICIO_TRANSFERENCIA_NAO_CONFIGURADA'; end if;

  insert into public.pull_events(
    trip_id,step_id,step_name,action_code,step_order,user_id,user_name,recorded_at,device_at,latitude,longitude,gps_accuracy
  ) values(
    v_trip.id,v_start_step.id,v_start_step.name,v_start_step.action_code,v_start_step.sort_order,
    v_profile.id,v_profile.name,v_now,p_device_at,p_latitude,p_longitude,p_accuracy
  );
  return v_trip;
end;
$$;

create or replace function public.record_pull_step(
  p_trip_id uuid,
  p_step_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision default null,
  p_exception_reason text default '',
  p_device_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_trip public.pull_trips%rowtype;
  v_step public.pull_steps%rowtype;
  v_next public.pull_steps%rowtype;
  v_after public.pull_steps%rowtype;
  v_factory public.factories%rowtype;
  v_event public.pull_events%rowtype;
  v_open_occ public.pull_occurrences%rowtype;
  v_max_order integer;
  v_distance double precision;
  v_geofence text := 'NOT_APPLICABLE';
  v_max_accuracy integer := 200;
  v_reason text := btrim(coalesce(p_exception_reason,''));
  v_now timestamptz := now();
begin
  if not public.has_permission('PULL_TRIP') then raise exception 'FORBIDDEN'; end if;
  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  if v_profile.id is null then raise exception 'UNAUTHORIZED'; end if;

  select * into v_trip from public.pull_trips where id=p_trip_id for update;
  if v_trip.id is null then raise exception 'CICLO_NAO_ENCONTRADO'; end if;
  if not public.is_admin() and auth.uid() not in (v_trip.driver1_id,v_trip.driver2_id) then raise exception 'FORBIDDEN'; end if;
  if v_trip.status<>'IN_PROGRESS' then raise exception 'CICLO_NAO_ESTA_EM_ANDAMENTO'; end if;

  select coalesce(max(step_order),-2147483648) into v_max_order from public.pull_events where trip_id=v_trip.id;
  select * into v_next from public.pull_steps
   where step_type='MAIN' and flow_type=v_trip.cycle_type and active=true and sort_order>v_max_order
   order by sort_order limit 1;
  if v_next.id is null then raise exception 'SEM_PROXIMA_ETAPA'; end if;
  if v_next.id<>p_step_id then raise exception 'ETAPA_FORA_DE_SEQUENCIA'; end if;
  v_step := v_next;

  if coalesce(v_step.required,true) then
    select * into v_open_occ from public.pull_occurrences
     where trip_id=v_trip.id and status='OPEN' order by started_at desc limit 1;
    if v_open_occ.id is not null then raise exception 'OCORRENCIA_EM_ANDAMENTO:%',v_open_occ.occurrence_name; end if;
  end if;

  if not public.is_admin() then
    if v_step.executor_driver=1 and auth.uid()<>v_trip.driver1_id then raise exception 'ETAPA_MOTORISTA_1'; end if;
    if v_step.executor_driver=2 and auth.uid()<>v_trip.driver2_id then raise exception 'ETAPA_MOTORISTA_2'; end if;
    if v_step.executor_driver is null and v_trip.active_driver_id<>auth.uid() then raise exception 'MOTORISTA_NAO_ESTA_ATIVO'; end if;
  end if;

  select coalesce(gps_max_accuracy_m,200) into v_max_accuracy from public.pull_settings where singleton=true;
  v_max_accuracy:=least(500,greatest(5,coalesce(v_max_accuracy,200)));
  if p_accuracy is null or p_accuracy>v_max_accuracy then
    raise exception 'GPS_PRECISAO_INSUFICIENTE:%:%',coalesce(round(p_accuracy)::text,'SEM_SINAL'),v_max_accuracy;
  end if;

  if v_trip.cycle_type='PULL' and v_step.requires_factory_geofence then
    select * into v_factory from public.factories where name=v_trip.factory;
    if v_factory.latitude is null or v_factory.longitude is null or v_factory.radius_meters is null then
      v_geofence := 'NOT_CONFIGURED';
    else
      v_distance := public.pull_distance_m(p_latitude,p_longitude,v_factory.latitude,v_factory.longitude);
      if v_distance<=v_factory.radius_meters then v_geofence:='INSIDE'; else v_geofence:='OUTSIDE'; end if;
    end if;
  end if;

  insert into public.pull_events(
    trip_id,step_id,step_name,action_code,step_order,user_id,user_name,recorded_at,device_at,
    latitude,longitude,gps_accuracy,geofence_status,distance_factory_m,factory_latitude,factory_longitude,factory_radius_m,exception_reason
  ) values(
    v_trip.id,v_step.id,v_step.name,v_step.action_code,v_step.sort_order,v_profile.id,v_profile.name,v_now,p_device_at,
    p_latitude,p_longitude,p_accuracy,v_geofence,v_distance,v_factory.latitude,v_factory.longitude,v_factory.radius_meters,v_reason
  ) returning * into v_event;

  if v_trip.cycle_type='PULL' and v_step.action_code='ARRIVE_FACTORY' then
    update public.pull_trips set arrived_factory_at=v_now where id=v_trip.id;
  elsif v_trip.cycle_type='PULL' and v_step.action_code='LEAVE_FACTORY' then
    update public.pull_trips set left_factory_at=v_now where id=v_trip.id;
  elsif v_trip.cycle_type='PULL' and v_step.action_code='ARRIVE_UNIT' then
    update public.pull_trips
       set ended_at=v_now,ended_by_id=v_profile.id,ended_by_name=v_profile.name,
           end_latitude=p_latitude,end_longitude=p_longitude,end_accuracy=p_accuracy,
           status='ARRIVED',kpi_status='WAITING_NEXT_START',nri_status='PENDING',
           active_driver_id=v_profile.id,active_driver_name=v_profile.name
     where id=v_trip.id;
  elsif v_trip.cycle_type='TRANSFER' and v_step.action_code='TRANSFER_ARRIVE_MATRIX' then
    update public.pull_trips
       set ended_at=v_now,next_started_at=v_now,ended_by_id=v_profile.id,ended_by_name=v_profile.name,
           end_latitude=p_latitude,end_longitude=p_longitude,end_accuracy=p_accuracy,
           status='ARRIVED',kpi_status='CLOSED',nri_status='NOT_READY',
           active_driver_id=v_profile.id,active_driver_name=v_profile.name
     where id=v_trip.id;
  end if;

  if not (
    (v_trip.cycle_type='PULL' and v_step.action_code='ARRIVE_UNIT')
    or (v_trip.cycle_type='TRANSFER' and v_step.action_code='TRANSFER_ARRIVE_MATRIX')
  ) then
    select * into v_after from public.pull_steps
     where step_type='MAIN' and flow_type=v_trip.cycle_type and active=true and sort_order>v_step.sort_order
     order by sort_order limit 1;
    if v_after.id is not null then
      if v_after.executor_driver=1 then
        update public.pull_trips set active_driver_id=v_trip.driver1_id,active_driver_name=v_trip.driver1_name where id=v_trip.id;
      elsif v_after.executor_driver=2 then
        update public.pull_trips set active_driver_id=v_trip.driver2_id,active_driver_name=v_trip.driver2_name where id=v_trip.id;
      end if;
    end if;
  end if;

  select * into v_trip from public.pull_trips where id=p_trip_id;
  return jsonb_build_object('event',to_jsonb(v_event),'trip',to_jsonb(v_trip));
end;
$$;

create or replace function public.start_pull_occurrence(
  p_trip_id uuid,
  p_step_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision default null,
  p_note text default ''
)
returns public.pull_occurrences
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.profiles%rowtype;
  v_trip public.pull_trips%rowtype;
  v_step public.pull_steps%rowtype;
  v_row public.pull_occurrences%rowtype;
  v_max_accuracy integer:=200;
  v_now timestamptz:=now();
begin
  if not public.has_permission('PULL_TRIP') then raise exception 'FORBIDDEN'; end if;
  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  select * into v_trip from public.pull_trips where id=p_trip_id;
  if v_profile.id is null or v_trip.id is null then raise exception 'CICLO_NAO_ENCONTRADO'; end if;
  if auth.uid() not in (v_trip.driver1_id,v_trip.driver2_id) and not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if not public.is_admin() and v_trip.active_driver_id<>auth.uid() then raise exception 'MOTORISTA_NAO_ESTA_ATIVO'; end if;
  if v_trip.status<>'IN_PROGRESS' then raise exception 'CICLO_NAO_ESTA_EM_ANDAMENTO'; end if;

  select * into v_step from public.pull_steps
   where id=p_step_id and step_type='OCCURRENCE' and active=true and flow_type in ('BOTH',v_trip.cycle_type);
  if v_step.id is null then raise exception 'OCORRENCIA_INVALIDA'; end if;
  if exists(select 1 from public.pull_occurrences where trip_id=v_trip.id and status='OPEN') then raise exception 'JA_EXISTE_OCORRENCIA_ABERTA'; end if;

  select coalesce(gps_max_accuracy_m,200) into v_max_accuracy from public.pull_settings where singleton=true;
  v_max_accuracy:=least(500,greatest(5,coalesce(v_max_accuracy,200)));
  if p_accuracy is null or p_accuracy>v_max_accuracy then raise exception 'GPS_PRECISAO_INSUFICIENTE:%:%',coalesce(round(p_accuracy)::text,'SEM_SINAL'),v_max_accuracy; end if;

  insert into public.pull_occurrences(
    trip_id,step_id,occurrence_name,action_code,duration_mode,suggest_tma_discount,
    started_by,started_by_name,started_at,start_latitude,start_longitude,start_accuracy,
    ended_by,ended_by_name,ended_at,end_latitude,end_longitude,end_accuracy,status,note
  ) values(
    v_trip.id,v_step.id,v_step.name,v_step.action_code,v_step.duration_mode,v_step.suggest_tma_discount,
    v_profile.id,v_profile.name,v_now,p_latitude,p_longitude,p_accuracy,
    case when v_step.duration_mode='POINT' then v_profile.id else null end,
    case when v_step.duration_mode='POINT' then v_profile.name else null end,
    case when v_step.duration_mode='POINT' then v_now else null end,
    case when v_step.duration_mode='POINT' then p_latitude else null end,
    case when v_step.duration_mode='POINT' then p_longitude else null end,
    case when v_step.duration_mode='POINT' then p_accuracy else null end,
    case when v_step.duration_mode='POINT' then 'CLOSED' else 'OPEN' end,
    btrim(coalesce(p_note,''))
  ) returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.end_pull_occurrence(
  p_occurrence_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision default null
)
returns public.pull_occurrences
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_row public.pull_occurrences%rowtype;
  v_trip public.pull_trips%rowtype;
  v_max_accuracy integer:=200;
begin
  if not public.has_permission('PULL_TRIP') then raise exception 'FORBIDDEN'; end if;
  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  select * into v_row from public.pull_occurrences where id=p_occurrence_id for update;
  if v_row.id is null or v_row.status<>'OPEN' then raise exception 'OCORRENCIA_NAO_ESTA_ABERTA'; end if;
  select * into v_trip from public.pull_trips where id=v_row.trip_id;
  if auth.uid() not in (v_trip.driver1_id,v_trip.driver2_id) and not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if not public.is_admin() and v_trip.active_driver_id<>auth.uid() then raise exception 'MOTORISTA_NAO_ESTA_ATIVO'; end if;
  select coalesce(gps_max_accuracy_m,200) into v_max_accuracy from public.pull_settings where singleton=true;
  v_max_accuracy:=least(500,greatest(5,coalesce(v_max_accuracy,200)));
  if p_accuracy is null or p_accuracy>v_max_accuracy then raise exception 'GPS_PRECISAO_INSUFICIENTE:%:%',coalesce(round(p_accuracy)::text,'SEM_SINAL'),v_max_accuracy; end if;
  update public.pull_occurrences set ended_by=v_profile.id,ended_by_name=v_profile.name,ended_at=now(),
    end_latitude=p_latitude,end_longitude=p_longitude,end_accuracy=p_accuracy,status='CLOSED'
  where id=v_row.id returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.record_pull_track_point(
  p_trip_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision default null,
  p_device_at timestamptz default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip public.pull_trips%rowtype;
  v_next public.pull_steps%rowtype;
  v_max_order integer;
  v_id bigint;
begin
  if not public.has_permission('PULL_TRIP') then raise exception 'FORBIDDEN'; end if;
  select * into v_trip from public.pull_trips where id=p_trip_id;
  if v_trip.id is null or v_trip.status<>'IN_PROGRESS' then raise exception 'CICLO_NAO_ESTA_EM_ANDAMENTO'; end if;
  if auth.uid() not in (v_trip.driver1_id,v_trip.driver2_id) and not public.is_admin() then raise exception 'FORBIDDEN'; end if;

  select coalesce(max(step_order),-2147483648) into v_max_order from public.pull_events where trip_id=v_trip.id;
  select * into v_next from public.pull_steps
   where step_type='MAIN' and active=true and sort_order>v_max_order
   order by sort_order limit 1;

  if not public.is_admin() and v_next.id is not null then
    if v_next.executor_driver=1 and auth.uid()<>v_trip.driver1_id then raise exception 'ETAPA_MOTORISTA_1'; end if;
    if v_next.executor_driver=2 and auth.uid()<>v_trip.driver2_id then raise exception 'ETAPA_MOTORISTA_2'; end if;
    if v_next.executor_driver is null and v_trip.active_driver_id<>auth.uid() then raise exception 'MOTORISTA_NAO_ESTA_ATIVO'; end if;
  end if;

  insert into public.pull_track_points(trip_id,user_id,device_at,latitude,longitude,gps_accuracy)
  values(v_trip.id,auth.uid(),p_device_at,p_latitude,p_longitude,p_accuracy) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.adjust_pull_tma(p_trip_id uuid,p_minutes integer,p_reason text)
returns public.pull_trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_trip public.pull_trips%rowtype;
  v_raw integer;
begin
  if not public.has_permission('PULL_TMA_ADJUST') then raise exception 'FORBIDDEN'; end if;
  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  select * into v_trip from public.pull_trips where id=p_trip_id for update;
  if v_trip.id is null then raise exception 'CICLO_NAO_ENCONTRADO'; end if;
  if coalesce(p_minutes,0)<0 then raise exception 'AJUSTE_INVALIDO'; end if;
  if p_minutes>0 and btrim(coalesce(p_reason,''))='' then raise exception 'MOTIVO_AJUSTE_OBRIGATORIO'; end if;
  if v_trip.ended_at is not null and v_trip.next_started_at is not null then
    v_raw:=greatest(0,floor(extract(epoch from (v_trip.next_started_at-v_trip.ended_at))/60)::integer);
    if p_minutes>v_raw then raise exception 'AJUSTE_MAIOR_QUE_TMA_BRUTO'; end if;
  end if;
  insert into public.pull_tma_adjust_audit(trip_id,old_minutes,new_minutes,old_reason,new_reason,changed_by,changed_by_name)
  values(v_trip.id,v_trip.tma_adjust_minutes,p_minutes,v_trip.tma_adjust_reason,btrim(coalesce(p_reason,'')),v_profile.id,v_profile.name);
  update public.pull_trips set tma_adjust_minutes=p_minutes,tma_adjust_reason=btrim(coalesce(p_reason,'')),
    tma_adjusted_by=v_profile.id,tma_adjusted_by_name=v_profile.name,tma_adjusted_at=now()
  where id=v_trip.id returning * into v_trip;
  return v_trip;
end;
$$;

create or replace function public.start_fefo_count(p_unit text)
returns public.fefo_counts
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.profiles%rowtype;
  v_row public.fefo_counts%rowtype;
  v_unit text:=btrim(coalesce(p_unit,''));
begin
  if not public.has_permission('FEFO_CREATE') then raise exception 'FORBIDDEN'; end if;

  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  if v_profile.id is null then raise exception 'UNAUTHORIZED'; end if;

  if v_unit='' or not exists(select 1 from public.units where name=v_unit and active=true) then
    raise exception 'UNIDADE_INVALIDA';
  end if;

  select * into v_row
  from public.fefo_counts
  where counter_id=auth.uid() and status='IN_PROGRESS'
  order by started_at desc
  limit 1;

  if v_row.id is not null then
    raise exception 'FEFO_CONTAGEM_EM_ANDAMENTO:%',v_row.count_code;
  end if;

  insert into public.fefo_counts(unit,counter_id,counter_username,counter_name,status)
  values(v_unit,auth.uid(),v_profile.username,v_profile.name,'IN_PROGRESS')
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.save_fefo_item(
  p_count_id uuid,
  p_product_code text,
  p_validity_date date,
  p_street text,
  p_pallet integer,
  p_layer integer,
  p_box integer,
  p_loose_unit integer,
  p_item_id uuid default null
)
returns public.fefo_count_items
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.profiles%rowtype;
  v_count public.fefo_counts%rowtype;
  v_product public.products%rowtype;
  v_row public.fefo_count_items%rowtype;
  v_code text:=btrim(coalesce(p_product_code,''));
begin
  if not public.has_permission('FEFO_CREATE') then raise exception 'FORBIDDEN'; end if;

  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  if v_profile.id is null then raise exception 'UNAUTHORIZED'; end if;

  select * into v_count from public.fefo_counts where id=p_count_id for update;
  if v_count.id is null then raise exception 'FEFO_CONTAGEM_NAO_ENCONTRADA'; end if;
  if v_count.status<>'IN_PROGRESS' then raise exception 'FEFO_CONTAGEM_FINALIZADA'; end if;
  if not public.is_admin() and v_count.counter_id<>auth.uid() then raise exception 'FORBIDDEN'; end if;

  select * into v_product from public.products
  where active=true and (code=v_code or ltrim(code,'0')=ltrim(v_code,'0'))
  order by case when code=v_code then 0 else 1 end
  limit 1;
  if v_product.code is null then raise exception 'FEFO_PRODUTO_NAO_CADASTRADO'; end if;
  if p_validity_date is null then raise exception 'FEFO_VALIDADE_OBRIGATORIA'; end if;

  if p_item_id is null then
    insert into public.fefo_count_items(
      count_id,product_code,product_name,validity_date,street,pallet,layer,box,loose_unit,
      created_by,created_by_name
    ) values(
      v_count.id,v_product.code,v_product.name,p_validity_date,btrim(coalesce(p_street,'')),
      greatest(0,coalesce(p_pallet,0)),greatest(0,coalesce(p_layer,0)),
      greatest(0,coalesce(p_box,0)),greatest(0,coalesce(p_loose_unit,0)),
      auth.uid(),v_profile.name
    ) returning * into v_row;
  else
    update public.fefo_count_items
       set product_code=v_product.code,
           product_name=v_product.name,
           validity_date=p_validity_date,
           street=btrim(coalesce(p_street,'')),
           pallet=greatest(0,coalesce(p_pallet,0)),
           layer=greatest(0,coalesce(p_layer,0)),
           box=greatest(0,coalesce(p_box,0)),
           loose_unit=greatest(0,coalesce(p_loose_unit,0))
     where id=p_item_id and count_id=v_count.id
     returning * into v_row;

    if v_row.id is null then raise exception 'FEFO_ITEM_NAO_ENCONTRADO'; end if;
  end if;

  return v_row;
end;
$$;

create or replace function public.delete_fefo_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_item public.fefo_count_items%rowtype;
  v_count public.fefo_counts%rowtype;
begin
  if not public.has_permission('FEFO_CREATE') then raise exception 'FORBIDDEN'; end if;

  select * into v_item from public.fefo_count_items where id=p_item_id;
  if v_item.id is null then raise exception 'FEFO_ITEM_NAO_ENCONTRADO'; end if;

  select * into v_count from public.fefo_counts where id=v_item.count_id for update;
  if v_count.status<>'IN_PROGRESS' then raise exception 'FEFO_CONTAGEM_FINALIZADA'; end if;
  if not public.is_admin() and v_count.counter_id<>auth.uid() then raise exception 'FORBIDDEN'; end if;

  delete from public.fefo_count_items where id=v_item.id;
end;
$$;

create or replace function public.finish_fefo_count(p_count_id uuid)
returns public.fefo_counts
language plpgsql
security definer
set search_path=public
as $$
declare
  v_row public.fefo_counts%rowtype;
begin
  if not public.has_permission('FEFO_CREATE') then raise exception 'FORBIDDEN'; end if;

  select * into v_row from public.fefo_counts where id=p_count_id for update;
  if v_row.id is null then raise exception 'FEFO_CONTAGEM_NAO_ENCONTRADA'; end if;
  if v_row.status<>'IN_PROGRESS' then raise exception 'FEFO_CONTAGEM_FINALIZADA'; end if;
  if not public.is_admin() and v_row.counter_id<>auth.uid() then raise exception 'FORBIDDEN'; end if;

  if not exists(select 1 from public.fefo_count_items where count_id=v_row.id) then
    raise exception 'FEFO_CONTAGEM_SEM_ITENS';
  end if;

  update public.fefo_counts
     set status='COMPLETED',completed_at=now()
   where id=v_row.id
   returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.cancel_fefo_count(p_count_id uuid)
returns public.fefo_counts
language plpgsql
security definer
set search_path=public
as $$
declare
  v_row public.fefo_counts%rowtype;
begin
  if not public.has_permission('FEFO_CREATE') then raise exception 'FORBIDDEN'; end if;

  select * into v_row from public.fefo_counts where id=p_count_id for update;
  if v_row.id is null then raise exception 'FEFO_CONTAGEM_NAO_ENCONTRADA'; end if;
  if v_row.status<>'IN_PROGRESS' then raise exception 'FEFO_CONTAGEM_FINALIZADA'; end if;
  if not public.is_admin() and v_row.counter_id<>auth.uid() then raise exception 'FORBIDDEN'; end if;

  update public.fefo_counts
     set status='CANCELLED',cancelled_at=now()
   where id=v_row.id
   returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS DAS PERMISSOES
-- ---------------------------------------------------------------------------
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_permissions enable row level security;
alter table public.sales_damage_requests enable row level security;
alter table public.sales_damage_items enable row level security;

drop policy if exists permissions_read on public.permissions;
drop policy if exists role_permissions_read on public.role_permissions;
drop policy if exists user_permissions_read on public.user_permissions;
drop policy if exists user_permissions_admin on public.user_permissions;
drop policy if exists sales_damage_requests_read on public.sales_damage_requests;
drop policy if exists sales_damage_items_read on public.sales_damage_items;

create policy permissions_read on public.permissions for select to authenticated using (true);
create policy role_permissions_read on public.role_permissions for select to authenticated using (true);
create policy user_permissions_read on public.user_permissions for select to authenticated
using (user_id=auth.uid() or public.has_permission('ADMIN_USERS'));
create policy user_permissions_admin on public.user_permissions for all to authenticated
using (public.has_permission('ADMIN_USERS')) with check (public.has_permission('ADMIN_USERS'));

create policy sales_damage_requests_read on public.sales_damage_requests for select to authenticated
using (
  (public.has_permission('SALES_DAMAGE_VIEW_OWN') and seller_id=auth.uid())
  or public.has_permission('SALES_DAMAGE_VIEW_ALL')
  or public.has_permission('SALES_DAMAGE_REVIEW')
  or public.has_permission('SALES_DAMAGE_OVERRIDE')
);

create policy sales_damage_items_read on public.sales_damage_items for select to authenticated
using (
  exists(
    select 1 from public.sales_damage_requests r
    where r.id=request_id and (
      (public.has_permission('SALES_DAMAGE_VIEW_OWN') and r.seller_id=auth.uid())
      or public.has_permission('SALES_DAMAGE_VIEW_ALL')
      or public.has_permission('SALES_DAMAGE_REVIEW')
      or public.has_permission('SALES_DAMAGE_OVERRIDE')
    )
  )
);

-- Atualiza algumas políticas de leitura dos módulos legados para respeitar permissões.
drop policy if exists "profile_self_or_admin_select" on public.profiles;
create policy "profile_self_or_admin_select" on public.profiles for select to authenticated
using (
  id=auth.uid()
  or public.has_permission('ADMIN_USERS')
  or (public.has_permission('PULL_TRIP') and role='MOTORISTA_PUXADOR' and active=true)
);

drop policy if exists "nri_requests_read" on public.nri_requests;
create policy "nri_requests_read" on public.nri_requests for select to authenticated
using (
  public.has_permission('NRI_PENDING_VIEW') or public.has_permission('NRI_CREATE')
  or public.has_permission('NRI_PRINT') or public.has_permission('NRI_HISTORY')
  or public.has_permission('NRI_DAMAGE_HISTORY')
);

drop policy if exists "nris_read" on public.nris;
create policy "nris_read" on public.nris for select to authenticated
using (
  public.has_permission('NRI_PENDING_VIEW') or public.has_permission('NRI_CREATE')
  or public.has_permission('NRI_PRINT') or public.has_permission('NRI_HISTORY')
  or public.has_permission('NRI_DAMAGE_HISTORY')
);

drop policy if exists "damage_requests_read" on public.damage_requests;
create policy "damage_requests_read" on public.damage_requests for select to authenticated
using (
  (public.has_permission('DELIVERY_DAMAGE_CREATE') and created_by=auth.uid())
  or public.has_permission('DELIVERY_DAMAGE_VIEW_ALL')
  or public.has_permission('DELIVERY_DAMAGE_REVIEW')
);

drop policy if exists "damage_items_read" on public.damage_items;
create policy "damage_items_read" on public.damage_items for select to authenticated
using (
  exists(select 1 from public.damage_requests r where r.id=request_id and (
    (public.has_permission('DELIVERY_DAMAGE_CREATE') and r.created_by=auth.uid())
    or public.has_permission('DELIVERY_DAMAGE_VIEW_ALL')
    or public.has_permission('DELIVERY_DAMAGE_REVIEW')
  ))
);

drop policy if exists "damage_item_photos_read" on public.damage_item_photos;
create policy "damage_item_photos_read" on public.damage_item_photos for select to authenticated
using (
  exists(select 1 from public.damage_items i join public.damage_requests r on r.id=i.request_id
    where i.id=item_id and (
      (public.has_permission('DELIVERY_DAMAGE_CREATE') and r.created_by=auth.uid())
      or public.has_permission('DELIVERY_DAMAGE_VIEW_ALL')
      or public.has_permission('DELIVERY_DAMAGE_REVIEW')
    ))
);

drop policy if exists "conference_read" on public.container_conferences;
create policy "conference_read" on public.container_conferences for select to authenticated
using (
  (public.has_permission('CONF_OWN_HISTORY') and checker_id=auth.uid())
  or public.has_permission('CONF_HISTORY') or public.has_permission('CONF_DASHBOARD')
);

drop policy if exists "maps_admin_read" on public.maps;
create policy "maps_admin_read" on public.maps for select to authenticated
using (public.has_permission('CONF_HISTORY') or public.has_permission('CONF_DASHBOARD') or public.has_permission('ADMIN_BASES'));

-- FEFO: leitura por permissões; escrita continua pelas RPCs existentes.
drop policy if exists fefo_counts_read on public.fefo_counts;
create policy fefo_counts_read on public.fefo_counts for select to authenticated
using (
  (public.has_permission('FEFO_CREATE') and counter_id=auth.uid())
  or public.has_permission('FEFO_ACTIVE') or public.has_permission('FEFO_REPORT')
);

drop policy if exists fefo_items_read on public.fefo_count_items;
create policy fefo_items_read on public.fefo_count_items for select to authenticated
using (
  exists(select 1 from public.fefo_counts c where c.id=count_id and (
    (public.has_permission('FEFO_CREATE') and c.counter_id=auth.uid())
    or public.has_permission('FEFO_ACTIVE') or public.has_permission('FEFO_REPORT')
  ))
);


-- ---------------------------------------------------------------------------
-- RLS LEGADO ORIENTADO A PERMISSOES
-- ---------------------------------------------------------------------------
-- Perfis / administracao de usuarios
drop policy if exists "profile_admin_update" on public.profiles;
create policy "profile_admin_update" on public.profiles for update to authenticated
using (public.has_permission('ADMIN_USERS')) with check (public.has_permission('ADMIN_USERS'));

-- Bases auxiliares: leitura geral permanece; escrita passa a ADMIN_BASES.
drop policy if exists "products_admin_all" on public.products;
create policy "products_admin_all" on public.products for all to authenticated
using (public.has_permission('ADMIN_BASES')) with check (public.has_permission('ADMIN_BASES'));
drop policy if exists "units_admin_all" on public.units;
create policy "units_admin_all" on public.units for all to authenticated
using (public.has_permission('ADMIN_BASES')) with check (public.has_permission('ADMIN_BASES'));
drop policy if exists "shifts_admin_all" on public.shifts;
create policy "shifts_admin_all" on public.shifts for all to authenticated
using (public.has_permission('ADMIN_BASES')) with check (public.has_permission('ADMIN_BASES'));
drop policy if exists "drivers_admin_all" on public.drivers;
create policy "drivers_admin_all" on public.drivers for all to authenticated
using (public.has_permission('ADMIN_BASES')) with check (public.has_permission('ADMIN_BASES'));
drop policy if exists "factories_admin_all" on public.factories;
create policy "factories_admin_all" on public.factories for all to authenticated
using (public.has_permission('ADMIN_BASES') or public.has_permission('PULL_CONFIG'))
with check (public.has_permission('ADMIN_BASES') or public.has_permission('PULL_CONFIG'));
drop policy if exists "customers_admin_all" on public.customers;
create policy "customers_admin_all" on public.customers for all to authenticated
using (public.has_permission('ADMIN_BASES')) with check (public.has_permission('ADMIN_BASES'));
drop policy if exists "maps_admin_all" on public.maps;
create policy "maps_admin_all" on public.maps for all to authenticated
using (public.has_permission('ADMIN_BASES')) with check (public.has_permission('ADMIN_BASES'));

-- Importacoes e historicos NRI / Conferencia.
drop policy if exists "nris_admin_insert_migration" on public.nris;
create policy "nris_admin_insert_migration" on public.nris for insert to authenticated
with check (public.has_permission('ADMIN_BASES'));
drop policy if exists "nris_nri_roles_update" on public.nris;
create policy "nris_nri_roles_update" on public.nris for update to authenticated
using (public.has_permission('NRI_PRINT') or public.has_permission('ADMIN_BASES'))
with check (public.has_permission('NRI_PRINT') or public.has_permission('ADMIN_BASES'));
drop policy if exists "print_events_admin_read" on public.print_events;
create policy "print_events_admin_read" on public.print_events for select to authenticated
using (public.has_permission('NRI_HISTORY') or public.has_permission('NRI_PRINT'));
drop policy if exists "conference_admin_insert_migration" on public.container_conferences;
create policy "conference_admin_insert_migration" on public.container_conferences for insert to authenticated
with check (public.has_permission('ADMIN_BASES'));

-- Configuracoes da Puxada.
drop policy if exists pull_settings_admin on public.pull_settings;
create policy pull_settings_admin on public.pull_settings for all to authenticated
using (public.has_permission('PULL_CONFIG')) with check (public.has_permission('PULL_CONFIG'));
drop policy if exists pull_vehicles_admin on public.pull_vehicles;
create policy pull_vehicles_admin on public.pull_vehicles for all to authenticated
using (public.has_permission('PULL_CONFIG')) with check (public.has_permission('PULL_CONFIG'));
drop policy if exists pull_steps_admin on public.pull_steps;
create policy pull_steps_admin on public.pull_steps for all to authenticated
using (public.has_permission('PULL_CONFIG')) with check (public.has_permission('PULL_CONFIG'));
drop policy if exists pull_goals_admin on public.pull_goals;
create policy pull_goals_admin on public.pull_goals for all to authenticated
using (public.has_permission('PULL_GOALS')) with check (public.has_permission('PULL_GOALS'));

-- Leitura operacional da Puxada / Transferencia.
drop policy if exists pull_trips_read on public.pull_trips;
create policy pull_trips_read on public.pull_trips for select to authenticated using (
  public.has_permission('PULL_FAROL')
  or public.has_permission('PULL_HISTORY')
  or public.has_permission('PULL_DASHBOARD')
  or public.has_permission('PULL_TMA_ADJUST')
  or (public.has_permission('PULL_TRIP') and (driver1_id=auth.uid() or driver2_id=auth.uid()))
  or ((public.has_permission('NRI_PENDING_VIEW') or public.has_permission('NRI_CREATE')) and cycle_type='PULL' and status='ARRIVED')
);
drop policy if exists pull_events_read on public.pull_events;
create policy pull_events_read on public.pull_events for select to authenticated using (
  public.has_permission('PULL_FAROL') or public.has_permission('PULL_HISTORY') or public.has_permission('PULL_DASHBOARD') or public.has_permission('PULL_TMA_ADJUST')
  or (public.has_permission('PULL_TRIP') and exists(select 1 from public.pull_trips t where t.id=trip_id and (t.driver1_id=auth.uid() or t.driver2_id=auth.uid())))
);
drop policy if exists pull_occurrences_read on public.pull_occurrences;
create policy pull_occurrences_read on public.pull_occurrences for select to authenticated using (
  public.has_permission('PULL_FAROL') or public.has_permission('PULL_HISTORY') or public.has_permission('PULL_DASHBOARD') or public.has_permission('PULL_TMA_ADJUST')
  or (public.has_permission('PULL_TRIP') and exists(select 1 from public.pull_trips t where t.id=trip_id and (t.driver1_id=auth.uid() or t.driver2_id=auth.uid())))
);
drop policy if exists pull_track_read on public.pull_track_points;
create policy pull_track_read on public.pull_track_points for select to authenticated using (
  public.has_permission('PULL_FAROL') or public.has_permission('PULL_HISTORY') or public.has_permission('PULL_DASHBOARD') or public.has_permission('PULL_TMA_ADJUST')
  or (public.has_permission('PULL_TRIP') and exists(select 1 from public.pull_trips t where t.id=trip_id and (t.driver1_id=auth.uid() or t.driver2_id=auth.uid())))
);
drop policy if exists pull_tma_audit_admin on public.pull_tma_adjust_audit;
create policy pull_tma_audit_admin on public.pull_tma_adjust_audit for select to authenticated
using (public.has_permission('PULL_HISTORY') or public.has_permission('PULL_DASHBOARD') or public.has_permission('PULL_TMA_ADJUST'));

-- Marketplace.
drop policy if exists marketplace_suppliers_read on public.marketplace_suppliers;
create policy marketplace_suppliers_read on public.marketplace_suppliers for select to authenticated
using (active=true or public.has_permission('PULL_CONFIG'));
drop policy if exists marketplace_suppliers_admin on public.marketplace_suppliers;
create policy marketplace_suppliers_admin on public.marketplace_suppliers for all to authenticated
using (public.has_permission('PULL_CONFIG')) with check (public.has_permission('PULL_CONFIG'));
drop policy if exists marketplace_receipts_read on public.marketplace_receipts;
create policy marketplace_receipts_read on public.marketplace_receipts for select to authenticated
using (
  public.has_permission('MARKETPLACE_RECEIVE') or public.has_permission('NRI_PENDING_VIEW')
  or public.has_permission('NRI_CREATE') or public.has_permission('PULL_DASHBOARD')
);

-- Evidencias de paletes avariados no NRI.
drop policy if exists nri_damage_items_read on public.nri_damage_items;
create policy nri_damage_items_read on public.nri_damage_items for select to authenticated
using (
  public.has_permission('NRI_CREATE') or public.has_permission('NRI_PENDING_VIEW')
  or public.has_permission('NRI_PRINT') or public.has_permission('NRI_HISTORY')
  or public.has_permission('NRI_DAMAGE_HISTORY')
);
drop policy if exists nri_damage_photos_read on public.nri_damage_photos;
create policy nri_damage_photos_read on public.nri_damage_photos for select to authenticated
using (
  public.has_permission('NRI_CREATE') or public.has_permission('NRI_PENDING_VIEW')
  or public.has_permission('NRI_PRINT') or public.has_permission('NRI_HISTORY')
  or public.has_permission('NRI_DAMAGE_HISTORY')
);

-- Storage de Avarias de Entrega.
drop policy if exists "avarias_upload_own_folder" on storage.objects;
drop policy if exists "avarias_read_own_or_admin" on storage.objects;
drop policy if exists "avarias_update_own_or_admin" on storage.objects;
drop policy if exists "avarias_delete_own_or_admin" on storage.objects;
create policy "avarias_upload_own_folder" on storage.objects for insert to authenticated
with check (bucket_id='avarias' and public.has_permission('DELIVERY_DAMAGE_CREATE') and (storage.foldername(name))[1]=auth.uid()::text);
create policy "avarias_read_own_or_admin" on storage.objects for select to authenticated
using (bucket_id='avarias' and (
  (public.has_permission('DELIVERY_DAMAGE_CREATE') and (storage.foldername(name))[1]=auth.uid()::text)
  or public.has_permission('DELIVERY_DAMAGE_VIEW_ALL') or public.has_permission('DELIVERY_DAMAGE_REVIEW')
));
create policy "avarias_update_own_or_admin" on storage.objects for update to authenticated
using (bucket_id='avarias' and (
  (public.has_permission('DELIVERY_DAMAGE_CREATE') and (storage.foldername(name))[1]=auth.uid()::text)
  or public.has_permission('DELIVERY_DAMAGE_REVIEW')
));
create policy "avarias_delete_own_or_admin" on storage.objects for delete to authenticated
using (bucket_id='avarias' and (
  (public.has_permission('DELIVERY_DAMAGE_CREATE') and (storage.foldername(name))[1]=auth.uid()::text)
  or public.has_permission('DELIVERY_DAMAGE_REVIEW')
));

-- Storage de avarias do NRI.
drop policy if exists "nri_avarias_upload_own_folder" on storage.objects;
drop policy if exists "nri_avarias_read_nri_roles" on storage.objects;
drop policy if exists "nri_avarias_delete_own_or_admin" on storage.objects;
create policy "nri_avarias_upload_own_folder" on storage.objects for insert to authenticated
with check (bucket_id='nri-avarias' and public.has_permission('NRI_CREATE') and (storage.foldername(name))[1]=auth.uid()::text);
create policy "nri_avarias_read_nri_roles" on storage.objects for select to authenticated
using (bucket_id='nri-avarias' and (
  public.has_permission('NRI_CREATE') or public.has_permission('NRI_PENDING_VIEW')
  or public.has_permission('NRI_PRINT') or public.has_permission('NRI_HISTORY') or public.has_permission('NRI_DAMAGE_HISTORY')
));
create policy "nri_avarias_delete_own_or_admin" on storage.objects for delete to authenticated
using (bucket_id='nri-avarias' and public.has_permission('NRI_CREATE') and (storage.foldername(name))[1]=auth.uid()::text);

-- ---------------------------------------------------------------------------
-- STORAGE - UMA FOTO POR PRODUTO DE AVARIA DE VENDAS
-- ---------------------------------------------------------------------------
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('avarias-vendas','avarias-vendas',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists sales_damage_upload_own on storage.objects;
drop policy if exists sales_damage_read on storage.objects;
drop policy if exists sales_damage_delete_own on storage.objects;

create policy sales_damage_upload_own on storage.objects for insert to authenticated
with check (
  bucket_id='avarias-vendas'
  and public.has_permission('SALES_DAMAGE_CREATE')
  and (storage.foldername(name))[1]=auth.uid()::text
);

create policy sales_damage_read on storage.objects for select to authenticated
using (
  bucket_id='avarias-vendas' and (
    (storage.foldername(name))[1]=auth.uid()::text
    or public.has_permission('SALES_DAMAGE_VIEW_ALL')
    or public.has_permission('SALES_DAMAGE_REVIEW')
    or public.has_permission('SALES_DAMAGE_OVERRIDE')
  )
);

create policy sales_damage_delete_own on storage.objects for delete to authenticated
using (
  bucket_id='avarias-vendas'
  and public.has_permission('SALES_DAMAGE_CREATE')
  and (storage.foldername(name))[1]=auth.uid()::text
);

-- ---------------------------------------------------------------------------
-- GRANTS / REALTIME
-- ---------------------------------------------------------------------------
grant select on public.permissions,public.role_permissions,public.user_permissions to authenticated;
grant select on public.sales_damage_requests,public.sales_damage_items to authenticated;
grant usage,select on sequence public.sales_damage_request_number_seq to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.get_my_permissions() to authenticated;
grant execute on function public.create_sales_damage_request(jsonb) to authenticated;
grant execute on function public.review_sales_damage_items(uuid[],text,text) to authenticated;
grant execute on function public.override_sales_damage_approval(uuid[],text) to authenticated;

grant execute on function public.confirm_nri_print(uuid[],boolean,text) to authenticated;
grant execute on function public.remove_nris(uuid[]) to authenticated;
grant execute on function public.sync_nri_sequence() to authenticated;
grant execute on function public.create_damage_request(jsonb) to authenticated;
grant execute on function public.review_damage_items(uuid[],text,text) to authenticated;
grant execute on function public.create_container_conference(text,integer,integer,integer,integer,integer,integer) to authenticated;
grant execute on function public.start_marketplace_receipt(text,uuid) to authenticated;
grant execute on function public.finish_marketplace_receipt(uuid) to authenticated;
grant execute on function public.start_pull_trip(text,text,text,text,uuid,double precision,double precision,double precision,timestamptz) to authenticated;
grant execute on function public.start_transfer_trip(text,double precision,double precision,double precision,timestamptz) to authenticated;
grant execute on function public.record_pull_step(uuid,uuid,double precision,double precision,double precision,text,timestamptz) to authenticated;
grant execute on function public.start_pull_occurrence(uuid,uuid,double precision,double precision,double precision,text) to authenticated;
grant execute on function public.end_pull_occurrence(uuid,double precision,double precision,double precision) to authenticated;
grant execute on function public.record_pull_track_point(uuid,double precision,double precision,double precision,timestamptz) to authenticated;
grant execute on function public.adjust_pull_tma(uuid,integer,text) to authenticated;
grant execute on function public.start_fefo_count(text) to authenticated;
grant execute on function public.save_fefo_item(uuid,text,date,text,integer,integer,integer,integer,uuid) to authenticated;
grant execute on function public.delete_fefo_item(uuid) to authenticated;
grant execute on function public.finish_fefo_count(uuid) to authenticated;
grant execute on function public.cancel_fefo_count(uuid) to authenticated;

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='sales_damage_requests') then
    execute 'alter publication supabase_realtime add table public.sales_damage_requests';
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='sales_damage_items') then
    execute 'alter publication supabase_realtime add table public.sales_damage_items';
  end if;
end $$;

commit;

-- Conferência rápida após executar:
select code,module,name from public.permissions order by module,sort_order,code;
select role,count(*) as permissoes_padrao from public.role_permissions group by role order by role;
select table_name from information_schema.tables
where table_schema='public' and table_name in ('permissions','role_permissions','user_permissions','sales_damage_requests','sales_damage_items')
order by table_name;
