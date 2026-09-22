-- Disb Gestao v1.6.0
-- Controle de acesso por unidade.
-- Execute depois do SQL 25_v1_6_0_offline_sync_ativo_giro_auditoria.sql.
--
-- Regras:
--   * Cada usuario ativo deve possuir uma ou mais unidades em user_units.
--   * Admin tambem respeita as unidades associadas.
--   * A interface trabalha com uma unidade atual por vez.
--   * As politicas RLS impedem leitura cruzada entre unidades nos modulos operacionais.
--   * Alteracoes de unidade do usuario sao auditadas.

begin;

-- ---------------------------------------------------------------------------
-- VINCULO USUARIO x UNIDADE
-- ---------------------------------------------------------------------------
create table if not exists public.user_units (
  user_id uuid not null references public.profiles(id) on delete cascade,
  unit_name text not null references public.units(name) on update cascade on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  primary key(user_id,unit_name)
);

create index if not exists idx_user_units_unit on public.user_units(unit_name,user_id);

create table if not exists public.user_unit_access_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  old_units text[] not null default '{}',
  new_units text[] not null default '{}',
  changed_by uuid references auth.users(id),
  changed_by_name text not null default '',
  changed_at timestamptz not null default now()
);
create index if not exists idx_user_unit_access_audit_user on public.user_unit_access_audit(user_id,changed_at desc);

alter table public.user_units enable row level security;
alter table public.user_unit_access_audit enable row level security;

drop policy if exists user_units_read on public.user_units;
create policy user_units_read on public.user_units for select to authenticated
using (user_id=auth.uid() or public.has_permission('ADMIN_USERS'));

drop policy if exists user_units_admin on public.user_units;
create policy user_units_admin on public.user_units for all to authenticated
using (public.has_permission('ADMIN_USERS'))
with check (public.has_permission('ADMIN_USERS'));

drop policy if exists user_unit_access_audit_read on public.user_unit_access_audit;
create policy user_unit_access_audit_read on public.user_unit_access_audit for select to authenticated
using (public.has_permission('ADMIN_USERS'));

-- Para nao bloquear o primeiro acesso administrativo depois da migracao,
-- todos os ADMINs atuais recebem inicialmente todas as unidades ativas.
insert into public.user_units(user_id,unit_name,created_by)
select p.id,u.name,p.id
from public.profiles p
cross join public.units u
where p.active=true and p.role='ADMIN' and u.active=true
on conflict(user_id,unit_name) do nothing;

-- ---------------------------------------------------------------------------
-- HELPERS
-- ---------------------------------------------------------------------------
create or replace function public.get_my_units()
returns table(unit_name text)
language sql
stable
security definer
set search_path=public
as $$
  select uu.unit_name
  from public.user_units uu
  join public.units u on u.name=uu.unit_name and u.active=true
  where uu.user_id=auth.uid()
  order by uu.unit_name;
$$;

create or replace function public.user_has_unit(p_unit text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(exists(
    select 1
    from public.user_units uu
    join public.units u on u.name=uu.unit_name and u.active=true
    where uu.user_id=auth.uid()
      and uu.unit_name=btrim(coalesce(p_unit,''))
  ),false);
$$;

create or replace function public.assert_user_unit(p_unit text)
returns void
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then return; end if;
  if not public.user_has_unit(p_unit) then
    raise exception 'UNIDADE_SEM_ACESSO:%',coalesce(p_unit,'');
  end if;
end;
$$;

-- Trigger generico: TG_ARGV[0] indica a coluna contendo a unidade.
create or replace function public.enforce_row_unit_access()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_unit text;
begin
  -- Operacoes administrativas via service role nao possuem auth.uid().
  if auth.uid() is null then return new; end if;
  v_unit := btrim(coalesce(to_jsonb(new)->>TG_ARGV[0],''));
  perform public.assert_user_unit(v_unit);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- UNIDADE EM AVARIAS
-- ---------------------------------------------------------------------------
alter table public.damage_requests add column if not exists unit text references public.units(name) on update cascade;
alter table public.sales_damage_requests add column if not exists unit text references public.units(name) on update cascade;
create index if not exists idx_damage_requests_unit on public.damage_requests(unit,created_at desc);
create index if not exists idx_sales_damage_requests_unit on public.sales_damage_requests(unit,created_at desc);

-- Migra automaticamente apenas quando o criador possui UMA unica unidade.
update public.damage_requests r
set unit=x.unit_name
from (
  select user_id,min(unit_name) unit_name
  from public.user_units
  group by user_id
  having count(*)=1
) x
where r.unit is null and r.created_by=x.user_id;

update public.sales_damage_requests r
set unit=x.unit_name
from (
  select user_id,min(unit_name) unit_name
  from public.user_units
  group by user_id
  having count(*)=1
) x
where r.unit is null and r.created_by=x.user_id;

-- ---------------------------------------------------------------------------
-- VALIDACAO DE ESCRITA POR UNIDADE
-- ---------------------------------------------------------------------------
drop trigger if exists trg_unit_access_nri_requests on public.nri_requests;
create trigger trg_unit_access_nri_requests before insert or update of unit on public.nri_requests
for each row execute function public.enforce_row_unit_access('unit');

drop trigger if exists trg_unit_access_nris on public.nris;
create trigger trg_unit_access_nris before insert or update of unit on public.nris
for each row execute function public.enforce_row_unit_access('unit');

drop trigger if exists trg_unit_access_marketplace on public.marketplace_receipts;
create trigger trg_unit_access_marketplace before insert or update of unit on public.marketplace_receipts
for each row execute function public.enforce_row_unit_access('unit');

drop trigger if exists trg_unit_access_fefo on public.fefo_counts;
create trigger trg_unit_access_fefo before insert or update of unit on public.fefo_counts
for each row execute function public.enforce_row_unit_access('unit');

drop trigger if exists trg_unit_access_rotating_asset on public.rotating_asset_counts;
create trigger trg_unit_access_rotating_asset before insert or update of unit on public.rotating_asset_counts
for each row execute function public.enforce_row_unit_access('unit');

drop trigger if exists trg_unit_access_pull on public.pull_trips;
create trigger trg_unit_access_pull before insert or update of origin_unit on public.pull_trips
for each row execute function public.enforce_row_unit_access('origin_unit');

drop trigger if exists trg_unit_access_damage on public.damage_requests;
create trigger trg_unit_access_damage before insert or update of unit on public.damage_requests
for each row execute function public.enforce_row_unit_access('unit');

drop trigger if exists trg_unit_access_sales_damage on public.sales_damage_requests;
create trigger trg_unit_access_sales_damage before insert or update of unit on public.sales_damage_requests
for each row execute function public.enforce_row_unit_access('unit');

-- ---------------------------------------------------------------------------
-- AVARIA DE ENTREGA: grava unidade atual enviada pelo aplicativo.
-- ---------------------------------------------------------------------------
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
  v_unit text:=btrim(coalesce(p_payload->>'unit',''));
begin
  if not public.has_permission('DELIVERY_DAMAGE_CREATE') then raise exception 'FORBIDDEN'; end if;
  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  if v_profile.id is null then raise exception 'UNAUTHORIZED'; end if;
  perform public.assert_user_unit(v_unit);

  insert into public.damage_requests(
    occurrence_date,unit,delivery_user_id,delivery_username,delivery_name,customer_code,customer_name,city,map_number,
    signature_path,status,created_by
  ) values(
    (p_payload->>'date')::date,v_unit,auth.uid(),v_profile.username,v_profile.name,btrim(p_payload->>'customer_code'),
    btrim(p_payload->>'customer_name'),btrim(p_payload->>'city'),btrim(p_payload->>'map_number'),
    btrim(p_payload->>'signature_path'),'PENDENTE',auth.uid()
  ) returning id into v_req;

  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'items','[]'::jsonb)) loop
    v_order := v_order + 1;
    v_photos := case when jsonb_typeof(v_item->'photos')='array' then v_item->'photos' else '[]'::jsonb end;
    if jsonb_array_length(v_photos)=0 and coalesce(v_item->>'photo_path','')<>'' then
      v_photos := jsonb_build_array(jsonb_build_object(
        'photo_path',v_item->>'photo_path','latitude',v_item->>'latitude','longitude',v_item->>'longitude',
        'accuracy',v_item->>'accuracy','gps_at',v_item->>'gps_at'
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

-- ---------------------------------------------------------------------------
-- AVARIA DE VENDAS: grava unidade atual enviada pelo aplicativo.
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
  v_unit text:=btrim(coalesce(p_payload->>'unit',''));
begin
  if not public.has_permission('SALES_DAMAGE_CREATE') then raise exception 'FORBIDDEN'; end if;
  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  if v_profile.id is null then raise exception 'UNAUTHORIZED'; end if;
  perform public.assert_user_unit(v_unit);

  select * into v_customer from public.customers
  where id=nullif(btrim(coalesce(p_payload->>'customer_id','')),'')::uuid;
  if v_customer.id is null then raise exception 'PDV_INVALIDO'; end if;
  if jsonb_typeof(coalesce(p_payload->'items','[]'::jsonb))<>'array'
     or jsonb_array_length(coalesce(p_payload->'items','[]'::jsonb))=0 then raise exception 'PRODUTO_OBRIGATORIO'; end if;

  insert into public.sales_damage_requests(
    request_code,occurrence_date,unit,seller_id,seller_username,seller_name,
    customer_id,customer_code,customer_name,city,branch,status,created_by
  ) values(
    null,(timezone('America/Fortaleza',now()))::date,v_unit,auth.uid(),v_profile.username,v_profile.name,
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
    if (v_reason='VALIDADE' and v_photo_count>2) or (v_reason<>'VALIDADE' and v_photo_count>1) then raise exception 'FOTOS_EXCEDIDAS'; end if;
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
      exception when others then raise exception 'GPS_FOTO_OBRIGATORIO'; end;
      if v_lat is null or v_lon is null or v_gps_at is null
         or v_lat not between -90 and 90 or v_lon not between -180 and 180 then raise exception 'GPS_FOTO_OBRIGATORIO'; end if;
      insert into public.sales_damage_item_photos(item_id,photo_order,photo_path,latitude,longitude,accuracy,gps_at)
      values(v_item_row.id,v_photo_order,v_path,v_lat,v_lon,v_accuracy,v_gps_at);
    end loop;
  end loop;
  return v_req;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS POR UNIDADE - NRI
-- ---------------------------------------------------------------------------
drop policy if exists "nri_requests_read" on public.nri_requests;
create policy "nri_requests_read" on public.nri_requests for select to authenticated
using (
  public.user_has_unit(unit) and (
    public.has_permission('NRI_PENDING_VIEW') or public.has_permission('NRI_CREATE')
    or public.has_permission('NRI_PRINT') or public.has_permission('NRI_HISTORY')
    or public.has_permission('NRI_DAMAGE_HISTORY')
  )
);

drop policy if exists "nris_read" on public.nris;
create policy "nris_read" on public.nris for select to authenticated
using (
  public.user_has_unit(unit) and (
    public.has_permission('NRI_PENDING_VIEW') or public.has_permission('NRI_CREATE')
    or public.has_permission('NRI_PRINT') or public.has_permission('NRI_HISTORY')
    or public.has_permission('NRI_DAMAGE_HISTORY')
  )
);

drop policy if exists "nris_nri_roles_update" on public.nris;
create policy "nris_nri_roles_update" on public.nris for update to authenticated
using (public.user_has_unit(unit) and (public.has_permission('NRI_PRINT') or public.has_permission('ADMIN_BASES')))
with check (public.user_has_unit(unit) and (public.has_permission('NRI_PRINT') or public.has_permission('ADMIN_BASES')));

-- Evidencias de NRI seguem a unidade da requisicao.
drop policy if exists nri_damage_items_read on public.nri_damage_items;
create policy nri_damage_items_read on public.nri_damage_items for select to authenticated
using (exists(
  select 1 from public.nri_requests r where r.id=request_id and public.user_has_unit(r.unit) and (
    public.has_permission('NRI_CREATE') or public.has_permission('NRI_PENDING_VIEW') or public.has_permission('NRI_PRINT')
    or public.has_permission('NRI_HISTORY') or public.has_permission('NRI_DAMAGE_HISTORY')
  )
));

drop policy if exists nri_damage_photos_read on public.nri_damage_photos;
create policy nri_damage_photos_read on public.nri_damage_photos for select to authenticated
using (exists(
  select 1 from public.nri_damage_items di join public.nri_requests r on r.id=di.request_id
  where di.id=damage_item_id and public.user_has_unit(r.unit) and (
    public.has_permission('NRI_CREATE') or public.has_permission('NRI_PENDING_VIEW') or public.has_permission('NRI_PRINT')
    or public.has_permission('NRI_HISTORY') or public.has_permission('NRI_DAMAGE_HISTORY')
  )
));

-- ---------------------------------------------------------------------------
-- RLS POR UNIDADE - MARKETPLACE
-- ---------------------------------------------------------------------------
drop policy if exists marketplace_receipts_read on public.marketplace_receipts;
create policy marketplace_receipts_read on public.marketplace_receipts for select to authenticated
using (
  public.user_has_unit(unit) and (
    public.has_permission('MARKETPLACE_RECEIVE') or public.has_permission('NRI_PENDING_VIEW')
    or public.has_permission('NRI_CREATE') or public.has_permission('PULL_DASHBOARD')
  )
);
drop policy if exists marketplace_receipts_admin on public.marketplace_receipts;

-- ---------------------------------------------------------------------------
-- RLS POR UNIDADE - FEFO
-- ---------------------------------------------------------------------------
drop policy if exists fefo_counts_read on public.fefo_counts;
create policy fefo_counts_read on public.fefo_counts for select to authenticated
using (
  public.user_has_unit(unit) and (
    (public.has_permission('FEFO_CREATE') and counter_id=auth.uid())
    or public.has_permission('FEFO_ACTIVE') or public.has_permission('FEFO_REPORT')
  )
);

drop policy if exists fefo_items_read on public.fefo_count_items;
create policy fefo_items_read on public.fefo_count_items for select to authenticated
using (exists(
  select 1 from public.fefo_counts c where c.id=count_id and public.user_has_unit(c.unit) and (
    (public.has_permission('FEFO_CREATE') and c.counter_id=auth.uid())
    or public.has_permission('FEFO_ACTIVE') or public.has_permission('FEFO_REPORT')
  )
));

-- ---------------------------------------------------------------------------
-- RLS POR UNIDADE - ATIVO DE GIRO
-- ---------------------------------------------------------------------------
drop policy if exists rotating_asset_counts_read on public.rotating_asset_counts;
create policy rotating_asset_counts_read on public.rotating_asset_counts for select to authenticated
using (
  public.user_has_unit(unit) and (
    public.has_permission('ROTATING_ASSET_HISTORY')
    or (public.has_permission('ROTATING_ASSET_CREATE') and counter_id=auth.uid())
  )
);

drop policy if exists rotating_asset_entries_read on public.rotating_asset_entries;
create policy rotating_asset_entries_read on public.rotating_asset_entries for select to authenticated
using (exists(
  select 1 from public.rotating_asset_counts c where c.id=count_id and public.user_has_unit(c.unit) and (
    public.has_permission('ROTATING_ASSET_HISTORY')
    or (public.has_permission('ROTATING_ASSET_CREATE') and c.counter_id=auth.uid())
  )
));

drop policy if exists rotating_asset_entry_audit_admin_read on public.rotating_asset_entry_audit;
create policy rotating_asset_entry_audit_admin_read on public.rotating_asset_entry_audit for select to authenticated
using (public.is_admin() and exists(
  select 1 from public.rotating_asset_counts c where c.id=count_id and public.user_has_unit(c.unit)
));

-- ---------------------------------------------------------------------------
-- RLS POR UNIDADE - AVARIA DE ENTREGA
-- ---------------------------------------------------------------------------
drop policy if exists "damage_requests_read" on public.damage_requests;
create policy "damage_requests_read" on public.damage_requests for select to authenticated
using (
  public.user_has_unit(unit) and (
    (public.has_permission('DELIVERY_DAMAGE_CREATE') and created_by=auth.uid())
    or public.has_permission('DELIVERY_DAMAGE_VIEW_ALL') or public.has_permission('DELIVERY_DAMAGE_REVIEW')
    or public.has_permission('DELIVERY_DAMAGE_POST')
  )
);

drop policy if exists "damage_items_read" on public.damage_items;
create policy "damage_items_read" on public.damage_items for select to authenticated
using (exists(
  select 1 from public.damage_requests r where r.id=request_id and public.user_has_unit(r.unit) and (
    (public.has_permission('DELIVERY_DAMAGE_CREATE') and r.created_by=auth.uid())
    or public.has_permission('DELIVERY_DAMAGE_VIEW_ALL') or public.has_permission('DELIVERY_DAMAGE_REVIEW')
    or public.has_permission('DELIVERY_DAMAGE_POST')
  )
));

drop policy if exists "damage_item_photos_read" on public.damage_item_photos;
create policy "damage_item_photos_read" on public.damage_item_photos for select to authenticated
using (exists(
  select 1 from public.damage_items i join public.damage_requests r on r.id=i.request_id
  where i.id=item_id and public.user_has_unit(r.unit) and (
    (public.has_permission('DELIVERY_DAMAGE_CREATE') and r.created_by=auth.uid())
    or public.has_permission('DELIVERY_DAMAGE_VIEW_ALL') or public.has_permission('DELIVERY_DAMAGE_REVIEW')
    or public.has_permission('DELIVERY_DAMAGE_POST')
  )
));

-- ---------------------------------------------------------------------------
-- RLS POR UNIDADE - AVARIA DE VENDAS
-- ---------------------------------------------------------------------------
drop policy if exists sales_damage_requests_read on public.sales_damage_requests;
create policy sales_damage_requests_read on public.sales_damage_requests for select to authenticated
using (
  public.user_has_unit(unit) and (
    (public.has_permission('SALES_DAMAGE_VIEW_OWN') and seller_id=auth.uid())
    or public.has_permission('SALES_DAMAGE_VIEW_ALL') or public.has_permission('SALES_DAMAGE_REVIEW')
    or public.has_permission('SALES_DAMAGE_OVERRIDE') or public.has_permission('SALES_DAMAGE_POST')
  )
);

drop policy if exists sales_damage_items_read on public.sales_damage_items;
create policy sales_damage_items_read on public.sales_damage_items for select to authenticated
using (exists(
  select 1 from public.sales_damage_requests r where r.id=request_id and public.user_has_unit(r.unit) and (
    (public.has_permission('SALES_DAMAGE_VIEW_OWN') and r.seller_id=auth.uid())
    or public.has_permission('SALES_DAMAGE_VIEW_ALL') or public.has_permission('SALES_DAMAGE_REVIEW')
    or public.has_permission('SALES_DAMAGE_OVERRIDE') or public.has_permission('SALES_DAMAGE_POST')
  )
));

drop policy if exists sales_damage_item_photos_read on public.sales_damage_item_photos;
create policy sales_damage_item_photos_read on public.sales_damage_item_photos for select to authenticated
using (exists(
  select 1 from public.sales_damage_items i join public.sales_damage_requests r on r.id=i.request_id
  where i.id=item_id and public.user_has_unit(r.unit) and (
    (public.has_permission('SALES_DAMAGE_VIEW_OWN') and r.seller_id=auth.uid())
    or public.has_permission('SALES_DAMAGE_VIEW_ALL') or public.has_permission('SALES_DAMAGE_REVIEW')
    or public.has_permission('SALES_DAMAGE_OVERRIDE') or public.has_permission('SALES_DAMAGE_POST')
  )
));

-- ---------------------------------------------------------------------------
-- RLS POR UNIDADE - PUXADA / TRANSFERENCIA
-- ---------------------------------------------------------------------------
drop policy if exists pull_trips_admin on public.pull_trips;
drop policy if exists pull_events_admin on public.pull_events;
drop policy if exists pull_occurrences_admin on public.pull_occurrences;
drop policy if exists pull_track_admin on public.pull_track_points;

drop policy if exists pull_trips_read on public.pull_trips;
create policy pull_trips_read on public.pull_trips for select to authenticated using (
  public.user_has_unit(origin_unit) and (
    public.has_permission('PULL_FAROL') or public.has_permission('PULL_HISTORY') or public.has_permission('PULL_DASHBOARD')
    or public.has_permission('PULL_TMA_ADJUST')
    or (public.has_permission('PULL_TRIP') and (driver1_id=auth.uid() or driver2_id=auth.uid()))
    or ((public.has_permission('NRI_PENDING_VIEW') or public.has_permission('NRI_CREATE')) and cycle_type='PULL' and status='ARRIVED')
  )
);

drop policy if exists pull_events_read on public.pull_events;
create policy pull_events_read on public.pull_events for select to authenticated using (exists(
  select 1 from public.pull_trips t where t.id=trip_id and public.user_has_unit(t.origin_unit) and (
    public.has_permission('PULL_FAROL') or public.has_permission('PULL_HISTORY') or public.has_permission('PULL_DASHBOARD')
    or public.has_permission('PULL_TMA_ADJUST')
    or (public.has_permission('PULL_TRIP') and (t.driver1_id=auth.uid() or t.driver2_id=auth.uid()))
  )
));

drop policy if exists pull_occurrences_read on public.pull_occurrences;
create policy pull_occurrences_read on public.pull_occurrences for select to authenticated using (exists(
  select 1 from public.pull_trips t where t.id=trip_id and public.user_has_unit(t.origin_unit) and (
    public.has_permission('PULL_FAROL') or public.has_permission('PULL_HISTORY') or public.has_permission('PULL_DASHBOARD')
    or public.has_permission('PULL_TMA_ADJUST')
    or (public.has_permission('PULL_TRIP') and (t.driver1_id=auth.uid() or t.driver2_id=auth.uid()))
  )
));

drop policy if exists pull_track_read on public.pull_track_points;
create policy pull_track_read on public.pull_track_points for select to authenticated using (exists(
  select 1 from public.pull_trips t where t.id=trip_id and public.user_has_unit(t.origin_unit) and (
    public.has_permission('PULL_FAROL') or public.has_permission('PULL_HISTORY') or public.has_permission('PULL_DASHBOARD')
    or public.has_permission('PULL_TMA_ADJUST')
    or (public.has_permission('PULL_TRIP') and (t.driver1_id=auth.uid() or t.driver2_id=auth.uid()))
  )
));

drop policy if exists pull_tma_audit_admin on public.pull_tma_adjust_audit;
create policy pull_tma_audit_admin on public.pull_tma_adjust_audit for select to authenticated
using (exists(
  select 1 from public.pull_trips t where t.id=trip_id and public.user_has_unit(t.origin_unit)
) and (public.has_permission('PULL_HISTORY') or public.has_permission('PULL_DASHBOARD') or public.has_permission('PULL_TMA_ADJUST')));

-- ---------------------------------------------------------------------------
-- GRANTS
-- ---------------------------------------------------------------------------
grant select on public.user_units,public.user_unit_access_audit to authenticated;
grant execute on function public.get_my_units() to authenticated;
grant execute on function public.user_has_unit(text) to authenticated;
grant execute on function public.assert_user_unit(text) to authenticated;
grant execute on function public.create_damage_request(jsonb) to authenticated;
grant execute on function public.create_sales_damage_request(jsonb) to authenticated;

commit;
notify pgrst, 'reload schema';
