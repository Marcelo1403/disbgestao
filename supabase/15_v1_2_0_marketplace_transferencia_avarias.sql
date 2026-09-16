-- Disb Gestao v1.2.0
-- Marketplace com cronometro e fila NRI, palete avariado no NRI,
-- fluxo de Transferencia e separacao Puxada/Transferencia nos dados.
-- Execute depois dos scripts 12, 13 e 14.

begin;

-- ---------------------------------------------------------------------------
-- MARKETPLACE - FORNECEDORES E RECEBIMENTOS
-- ---------------------------------------------------------------------------
create table if not exists public.marketplace_suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_marketplace_suppliers_updated on public.marketplace_suppliers;
create trigger trg_marketplace_suppliers_updated
before update on public.marketplace_suppliers
for each row execute function public.touch_updated_at();

create sequence if not exists public.marketplace_receipt_number_seq start 1;

create table if not exists public.marketplace_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_code text unique,
  unit text not null references public.units(name) on update cascade,
  supplier_id uuid references public.marketplace_suppliers(id),
  supplier_name text not null,
  checker_id uuid not null references auth.users(id),
  checker_name text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer,
  status text not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS','PENDING_NRI','COMPLETED','CANCELLED')),
  nri_status text not null default 'NOT_READY' check (nri_status in ('NOT_READY','PENDING','COMPLETED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_marketplace_receipts_status on public.marketplace_receipts(status,started_at desc);
create index if not exists idx_marketplace_receipts_checker on public.marketplace_receipts(checker_id,started_at desc);
create index if not exists idx_marketplace_receipts_unit on public.marketplace_receipts(unit,started_at desc);

create or replace function public.assign_marketplace_receipt_code()
returns trigger language plpgsql as $$
begin
  if new.receipt_code is null or btrim(new.receipt_code)='' then
    new.receipt_code := 'MKT-' || lpad(nextval('public.marketplace_receipt_number_seq')::text,6,'0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_marketplace_receipt_code on public.marketplace_receipts;
create trigger trg_assign_marketplace_receipt_code
before insert on public.marketplace_receipts
for each row execute function public.assign_marketplace_receipt_code();

drop trigger if exists trg_marketplace_receipts_updated on public.marketplace_receipts;
create trigger trg_marketplace_receipts_updated
before update on public.marketplace_receipts
for each row execute function public.touch_updated_at();

-- Vinculo da requisicao NRI com o recebimento Marketplace.
alter table public.nri_requests
  add column if not exists marketplace_receipt_id uuid references public.marketplace_receipts(id) on delete set null;
create index if not exists idx_nri_requests_marketplace_receipt on public.nri_requests(marketplace_receipt_id);

-- ---------------------------------------------------------------------------
-- NRI - PALETE AVARIADO / FOTOS
-- ---------------------------------------------------------------------------
create table if not exists public.nri_damage_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.nri_requests(id) on delete cascade,
  product_code text not null,
  product_name text not null,
  lot text not null,
  total_pallets integer not null check (total_pallets > 0),
  damaged_pallets integer not null check (damaged_pallets > 0),
  reason text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (damaged_pallets <= total_pallets)
);

create index if not exists idx_nri_damage_items_request on public.nri_damage_items(request_id);

create table if not exists public.nri_damage_photos (
  id uuid primary key default gen_random_uuid(),
  damage_item_id uuid not null references public.nri_damage_items(id) on delete cascade,
  photo_order integer not null check (photo_order between 1 and 5),
  photo_path text not null,
  created_at timestamptz not null default now(),
  unique(damage_item_id,photo_order)
);

create index if not exists idx_nri_damage_photos_item on public.nri_damage_photos(damage_item_id);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('nri-avarias','nri-avarias',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "nri_avarias_upload_own_folder" on storage.objects;
drop policy if exists "nri_avarias_read_nri_roles" on storage.objects;
drop policy if exists "nri_avarias_delete_own_or_admin" on storage.objects;

create policy "nri_avarias_upload_own_folder" on storage.objects for insert to authenticated
with check (
  bucket_id='nri-avarias'
  and (storage.foldername(name))[1]=auth.uid()::text
  and public.has_role(array['ADMIN','COLABORADOR_ARMAZEM','CONFERENTE']::text[])
);

create policy "nri_avarias_read_nri_roles" on storage.objects for select to authenticated
using (
  bucket_id='nri-avarias'
  and public.has_role(array['ADMIN','COLABORADOR_ARMAZEM','CONFERENTE']::text[])
);

create policy "nri_avarias_delete_own_or_admin" on storage.objects for delete to authenticated
using (
  bucket_id='nri-avarias'
  and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin())
);

-- ---------------------------------------------------------------------------
-- PUXADA / TRANSFERENCIA - TIPO DE CICLO E FLUXO DAS ETAPAS
-- ---------------------------------------------------------------------------
alter table public.pull_trips add column if not exists cycle_type text not null default 'PULL';
alter table public.pull_trips drop constraint if exists pull_trips_cycle_type_check;
alter table public.pull_trips add constraint pull_trips_cycle_type_check check (cycle_type in ('PULL','TRANSFER'));
create index if not exists idx_pull_trips_cycle_type on public.pull_trips(cycle_type,started_at desc);

alter table public.pull_steps add column if not exists flow_type text not null default 'PULL';
alter table public.pull_steps drop constraint if exists pull_steps_flow_type_check;
alter table public.pull_steps add constraint pull_steps_flow_type_check check (flow_type in ('PULL','TRANSFER','BOTH'));

update public.pull_steps set flow_type='PULL' where step_type='MAIN' and coalesce(flow_type,'PULL')<>'TRANSFER';
update public.pull_steps set flow_type='BOTH' where step_type='OCCURRENCE';

insert into public.pull_steps(
  name,step_type,sort_order,action_code,active,required,duration_mode,
  requires_factory_geofence,suggest_tma_discount,executor_driver,flow_type
) values
  ('Saída da revenda Matriz','MAIN',10,'TRANSFER_START',true,true,'POINT',false,false,1,'TRANSFER'),
  ('Chegada na Filial','MAIN',20,'TRANSFER_ARRIVE_BRANCH',true,true,'POINT',false,false,1,'TRANSFER'),
  ('Saída da Filial','MAIN',30,'TRANSFER_LEAVE_BRANCH',true,true,'POINT',false,false,1,'TRANSFER'),
  ('Chegada na Matriz','MAIN',40,'TRANSFER_ARRIVE_MATRIX',true,true,'POINT',false,false,1,'TRANSFER')
on conflict(action_code) do update set
  name=excluded.name,
  step_type='MAIN',
  sort_order=excluded.sort_order,
  active=true,
  required=true,
  duration_mode='POINT',
  requires_factory_geofence=false,
  suggest_tma_discount=false,
  executor_driver=1,
  flow_type='TRANSFER';

-- ---------------------------------------------------------------------------
-- RPC MARKETPLACE
-- ---------------------------------------------------------------------------
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
  if not public.has_role(array['ADMIN','COLABORADOR_ARMAZEM','CONFERENTE']::text[]) then raise exception 'FORBIDDEN'; end if;
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
  if not public.has_role(array['ADMIN','COLABORADOR_ARMAZEM','CONFERENTE']::text[]) then raise exception 'FORBIDDEN'; end if;
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

-- ---------------------------------------------------------------------------
-- RPC INICIO PUXADA - preserva fluxo existente e marca cycle_type=PULL
-- ---------------------------------------------------------------------------
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
  if not public.has_role(array['MOTORISTA_PUXADOR','ADMIN']::text[]) then raise exception 'FORBIDDEN'; end if;
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

-- ---------------------------------------------------------------------------
-- RPC INICIO TRANSFERENCIA - um unico motorista, Matriz -> Filial -> Matriz
-- ---------------------------------------------------------------------------
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
  if not public.has_role(array['MOTORISTA_PUXADOR','ADMIN']::text[]) then raise exception 'FORBIDDEN'; end if;
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

-- ---------------------------------------------------------------------------
-- ETAPAS DOS DOIS FLUXOS + TRAVA DE OCORRENCIA
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- NRI - FONTE PUXADA / MARKETPLACE + AVARIA DE PALETE
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
  v_photos jsonb;
  v_photo jsonb;
  v_photo_order integer;
begin
  if not public.has_role(array['ADMIN','COLABORADOR_ARMAZEM','CONFERENTE']::text[]) then raise exception 'FORBIDDEN'; end if;
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
    v_photos:=case when jsonb_typeof(v_item->'damage_photos')='array' then v_item->'damage_photos' else '[]'::jsonb end;

    if v_damaged then
      if v_damaged_pallets<1 or v_damaged_pallets>v_count then raise exception 'QTD_PALETE_AVARIADO_INVALIDA'; end if;
      if v_reason='' then raise exception 'MOTIVO_PALETE_AVARIADO_OBRIGATORIO'; end if;
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
        request_id,product_code,product_name,lot,total_pallets,damaged_pallets,reason,created_by
      ) values(
        v_req,btrim(v_item->>'product_code'),btrim(v_item->>'product_name'),upper(btrim(v_item->>'lot')),
        v_count,v_damaged_pallets,v_reason,auth.uid()
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

-- ---------------------------------------------------------------------------
-- RLS / GRANTS
-- ---------------------------------------------------------------------------
alter table public.marketplace_suppliers enable row level security;
alter table public.marketplace_receipts enable row level security;
alter table public.nri_damage_items enable row level security;
alter table public.nri_damage_photos enable row level security;

drop policy if exists marketplace_suppliers_read on public.marketplace_suppliers;
drop policy if exists marketplace_suppliers_admin on public.marketplace_suppliers;
drop policy if exists marketplace_receipts_read on public.marketplace_receipts;
drop policy if exists marketplace_receipts_admin on public.marketplace_receipts;
drop policy if exists nri_damage_items_read on public.nri_damage_items;
drop policy if exists nri_damage_photos_read on public.nri_damage_photos;

create policy marketplace_suppliers_read on public.marketplace_suppliers for select to authenticated using (active=true or public.is_admin());
create policy marketplace_suppliers_admin on public.marketplace_suppliers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy marketplace_receipts_read on public.marketplace_receipts for select to authenticated
using (public.has_role(array['ADMIN','COLABORADOR_ARMAZEM','CONFERENTE']::text[]));
create policy marketplace_receipts_admin on public.marketplace_receipts for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy nri_damage_items_read on public.nri_damage_items for select to authenticated
using (public.has_role(array['ADMIN','COLABORADOR_ARMAZEM','CONFERENTE']::text[]));
create policy nri_damage_photos_read on public.nri_damage_photos for select to authenticated
using (public.has_role(array['ADMIN','COLABORADOR_ARMAZEM','CONFERENTE']::text[]));

grant select on public.marketplace_suppliers,public.marketplace_receipts,public.nri_damage_items,public.nri_damage_photos to authenticated;
grant insert,update,delete on public.marketplace_suppliers to authenticated;
grant usage,select on sequence public.marketplace_receipt_number_seq to authenticated;
grant execute on function public.start_marketplace_receipt(text,uuid) to authenticated;
grant execute on function public.finish_marketplace_receipt(uuid) to authenticated;
grant execute on function public.start_transfer_trip(text,double precision,double precision,double precision,timestamptz) to authenticated;
grant execute on function public.start_pull_trip(text,text,text,text,uuid,double precision,double precision,double precision,timestamptz) to authenticated;
grant execute on function public.record_pull_step(uuid,uuid,double precision,double precision,double precision,text,timestamptz) to authenticated;
grant execute on function public.start_pull_occurrence(uuid,uuid,double precision,double precision,double precision,text) to authenticated;
grant execute on function public.create_nri_request(jsonb) to authenticated;

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='marketplace_receipts') then
    execute 'alter publication supabase_realtime add table public.marketplace_receipts';
  end if;
end $$;

commit;

select 'v1.2.0 pronta - Marketplace + palete avariado + Transferencia + tipos de ciclo' as status;
