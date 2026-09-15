-- Disb Gestao v1.1.0 - Modulo Puxada
-- Execute uma unica vez no SQL Editor do Supabase antes de publicar o frontend v1.1.0.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- PERFIS
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('ADMIN','COLABORADOR_ARMAZEM','COLABORADOR_ENTREGA','CONFERENTE','MOTORISTA_PUXADOR'));

-- Motoristas puxadores precisam enxergar os outros puxadores ativos para escolher o Motorista 2.
drop policy if exists "profile_self_or_admin_select" on public.profiles;
create policy "profile_self_or_admin_select" on public.profiles for select to authenticated
using (
  id=auth.uid() or public.is_admin()
  or (public.current_role()='MOTORISTA_PUXADOR' and role='MOTORISTA_PUXADOR' and active=true)
);

-- ---------------------------------------------------------------------------
-- FABRICAS / GEOFENCE
-- ---------------------------------------------------------------------------
alter table public.factories add column if not exists latitude double precision;
alter table public.factories add column if not exists longitude double precision;
alter table public.factories add column if not exists radius_meters integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='factories_radius_meters_check' and conrelid='public.factories'::regclass
  ) then
    alter table public.factories add constraint factories_radius_meters_check
      check (radius_meters is null or radius_meters > 0);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- CONFIGURACAO GERAL DA PUXADA
-- ---------------------------------------------------------------------------
create table if not exists public.pull_settings (
  singleton boolean primary key default true check (singleton),
  default_unit text references public.units(name) on update cascade,
  gps_max_accuracy_m integer not null default 100 check (gps_max_accuracy_m between 5 and 5000),
  track_interval_seconds integer not null default 60 check (track_interval_seconds between 30 and 3600),
  track_min_distance_m integer not null default 50 check (track_min_distance_m between 0 and 10000),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into public.pull_settings(singleton) values(true) on conflict(singleton) do nothing;

create table if not exists public.pull_vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text not null unique,
  carrier text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_pull_vehicles_updated on public.pull_vehicles;
create trigger trg_pull_vehicles_updated before update on public.pull_vehicles
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- ETAPAS E OCORRENCIAS CONFIGURAVEIS
-- ---------------------------------------------------------------------------
create table if not exists public.pull_steps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  step_type text not null check (step_type in ('MAIN','OCCURRENCE')),
  sort_order integer not null default 100,
  action_code text not null unique,
  active boolean not null default true,
  required boolean not null default true,
  duration_mode text not null default 'POINT' check (duration_mode in ('POINT','INTERVAL')),
  requires_factory_geofence boolean not null default false,
  suggest_tma_discount boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_pull_steps_updated on public.pull_steps;
create trigger trg_pull_steps_updated before update on public.pull_steps
for each row execute function public.touch_updated_at();

insert into public.pull_steps(name,step_type,sort_order,action_code,active,required,duration_mode,requires_factory_geofence,suggest_tma_discount)
values
  ('Saída da revenda (início de jornada)','MAIN',10,'START_TRIP',true,true,'POINT',false,false),
  ('Chegada ao ponto de apoio','MAIN',20,'ARRIVE_SUPPORT_OUT',true,true,'POINT',false,false),
  ('Troca de motorista - ida','MAIN',30,'DRIVER_SWAP_OUT',true,true,'POINT',false,false),
  ('Chegada à fábrica','MAIN',40,'ARRIVE_FACTORY',true,true,'POINT',true,false),
  ('Carregamento','MAIN',50,'LOADING',true,true,'POINT',false,false),
  ('Conferência','MAIN',60,'CONFERENCE',true,true,'POINT',false,false),
  ('Saída da fábrica','MAIN',70,'LEAVE_FACTORY',true,true,'POINT',false,false),
  ('Chegada ao ponto de apoio - retorno','MAIN',80,'ARRIVE_SUPPORT_RETURN',true,true,'POINT',false,false),
  ('Troca de motorista - retorno','MAIN',90,'DRIVER_SWAP_RETURN',true,true,'POINT',false,false),
  ('Chegada à revenda (fim da viagem)','MAIN',100,'ARRIVE_UNIT',true,true,'POINT',false,false),
  ('Descanso','OCCURRENCE',10,'OCC_REST',true,false,'INTERVAL',false,true),
  ('Abastecimento','OCCURRENCE',20,'OCC_FUEL',true,false,'INTERVAL',false,false),
  ('Parada operacional','OCCURRENCE',30,'OCC_OPERATIONAL_STOP',true,false,'INTERVAL',false,false),
  ('Manutenção','OCCURRENCE',40,'OCC_MAINTENANCE',true,false,'INTERVAL',false,false),
  ('Espera','OCCURRENCE',50,'OCC_WAIT',true,false,'INTERVAL',false,false)
on conflict(action_code) do nothing;

-- ---------------------------------------------------------------------------
-- METAS GLOBAIS POR ANO
-- ---------------------------------------------------------------------------
create table if not exists public.pull_goals (
  year integer primary key check (year between 2020 and 2100),
  tmv_out_target_minutes integer not null default 0 check (tmv_out_target_minutes >= 0),
  factory_target_minutes integer not null default 0 check (factory_target_minutes >= 0),
  tmv_return_target_minutes integer not null default 0 check (tmv_return_target_minutes >= 0),
  unit_target_minutes integer not null default 0 check (unit_target_minutes >= 0),
  cycle_target_minutes integer not null default 0 check (cycle_target_minutes >= 0),
  tmv_out_adherence numeric(5,2) not null default 85 check (tmv_out_adherence between 0 and 100),
  factory_adherence numeric(5,2) not null default 85 check (factory_adherence between 0 and 100),
  tmv_return_adherence numeric(5,2) not null default 85 check (tmv_return_adherence between 0 and 100),
  unit_adherence numeric(5,2) not null default 85 check (unit_adherence between 0 and 100),
  cycle_adherence numeric(5,2) not null default 85 check (cycle_adherence between 0 and 100),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- VIAGENS / CICLOS
-- ---------------------------------------------------------------------------
create sequence if not exists public.pull_trip_number_seq start 1;

create table if not exists public.pull_trips (
  id uuid primary key default gen_random_uuid(),
  trip_code text unique,
  origin_unit text not null,
  plate text not null,
  carrier text not null default '',
  factory text not null,
  driver1_id uuid not null references auth.users(id),
  driver1_name text not null,
  driver2_id uuid not null references auth.users(id),
  driver2_name text not null,
  active_driver_id uuid references auth.users(id),
  active_driver_name text not null default '',
  started_at timestamptz not null default now(),
  start_latitude double precision not null,
  start_longitude double precision not null,
  start_accuracy double precision,
  arrived_factory_at timestamptz,
  left_factory_at timestamptz,
  ended_at timestamptz,
  ended_by_id uuid references auth.users(id),
  ended_by_name text,
  end_latitude double precision,
  end_longitude double precision,
  end_accuracy double precision,
  next_started_at timestamptz,
  status text not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS','ARRIVED','CANCELLED')),
  kpi_status text not null default 'IN_PROGRESS' check (kpi_status in ('IN_PROGRESS','WAITING_NEXT_START','CLOSED','CANCELLED')),
  nri_status text not null default 'NOT_READY' check (nri_status in ('NOT_READY','PENDING','COMPLETED')),
  tma_adjust_minutes integer not null default 0 check (tma_adjust_minutes >= 0),
  tma_adjust_reason text not null default '',
  tma_adjusted_by uuid references auth.users(id),
  tma_adjusted_by_name text,
  tma_adjusted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pull_trips_status on public.pull_trips(status, started_at desc);
create index if not exists idx_pull_trips_plate on public.pull_trips(plate, started_at desc);
create index if not exists idx_pull_trips_driver1 on public.pull_trips(driver1_id, started_at desc);
create index if not exists idx_pull_trips_driver2 on public.pull_trips(driver2_id, started_at desc);

drop trigger if exists trg_pull_trips_updated on public.pull_trips;
create trigger trg_pull_trips_updated before update on public.pull_trips
for each row execute function public.touch_updated_at();

create or replace function public.assign_pull_trip_code()
returns trigger language plpgsql as $$
begin
  if new.trip_code is null or btrim(new.trip_code)='' then
    new.trip_code := 'PUX-' || lpad(nextval('public.pull_trip_number_seq')::text, 7, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_pull_trip_code on public.pull_trips;
create trigger trg_assign_pull_trip_code before insert on public.pull_trips
for each row execute function public.assign_pull_trip_code();

create table if not exists public.pull_events (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.pull_trips(id) on delete cascade,
  step_id uuid references public.pull_steps(id),
  step_name text not null,
  action_code text not null,
  step_order integer not null,
  user_id uuid not null references auth.users(id),
  user_name text not null,
  recorded_at timestamptz not null default now(),
  device_at timestamptz,
  latitude double precision not null,
  longitude double precision not null,
  gps_accuracy double precision,
  geofence_status text not null default 'NOT_APPLICABLE' check (geofence_status in ('NOT_APPLICABLE','INSIDE','OUTSIDE','NOT_CONFIGURED')),
  distance_factory_m double precision,
  factory_latitude double precision,
  factory_longitude double precision,
  factory_radius_m integer,
  exception_reason text not null default '',
  unique(trip_id,step_id)
);
create index if not exists idx_pull_events_trip on public.pull_events(trip_id,step_order,recorded_at);

create table if not exists public.pull_occurrences (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.pull_trips(id) on delete cascade,
  step_id uuid references public.pull_steps(id),
  occurrence_name text not null,
  action_code text not null,
  duration_mode text not null check (duration_mode in ('POINT','INTERVAL')),
  suggest_tma_discount boolean not null default false,
  started_by uuid not null references auth.users(id),
  started_by_name text not null,
  started_at timestamptz not null default now(),
  start_latitude double precision not null,
  start_longitude double precision not null,
  start_accuracy double precision,
  ended_by uuid references auth.users(id),
  ended_by_name text,
  ended_at timestamptz,
  end_latitude double precision,
  end_longitude double precision,
  end_accuracy double precision,
  status text not null default 'OPEN' check (status in ('OPEN','CLOSED')),
  note text not null default ''
);
create index if not exists idx_pull_occurrences_trip on public.pull_occurrences(trip_id,started_at);

create table if not exists public.pull_track_points (
  id bigint generated by default as identity primary key,
  trip_id uuid not null references public.pull_trips(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  recorded_at timestamptz not null default now(),
  device_at timestamptz,
  latitude double precision not null,
  longitude double precision not null,
  gps_accuracy double precision
);
create index if not exists idx_pull_track_trip_time on public.pull_track_points(trip_id,recorded_at);

create table if not exists public.pull_tma_adjust_audit (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.pull_trips(id) on delete cascade,
  old_minutes integer not null,
  new_minutes integer not null,
  old_reason text not null default '',
  new_reason text not null default '',
  changed_by uuid not null references auth.users(id),
  changed_by_name text not null,
  changed_at timestamptz not null default now()
);

-- Vinculo com NRI
alter table public.nri_requests add column if not exists pull_trip_id uuid references public.pull_trips(id) on delete set null;
create index if not exists idx_nri_requests_pull_trip on public.nri_requests(pull_trip_id);

-- ---------------------------------------------------------------------------
-- HELPERS / RPCs
-- ---------------------------------------------------------------------------
create or replace function public.pull_distance_m(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
returns double precision
language sql
immutable
as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2-lat1)/2),2) +
    cos(radians(lat1))*cos(radians(lat2))*power(sin(radians(lon2-lon1)/2),2)
  ));
$$;

create or replace function public.start_pull_trip(
  p_plate text,
  p_factory text,
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
  v_unit text;
  v_plate text;
  v_carrier text;
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
  select default_unit into v_unit from public.pull_settings where singleton=true;
  if coalesce(btrim(v_unit),'')='' then raise exception 'UNIDADE_PADRAO_PUXADA_NAO_CONFIGURADA'; end if;

  v_plate := upper(regexp_replace(coalesce(p_plate,''),'[^A-Za-z0-9]','','g'));
  if v_plate='' then raise exception 'PLACA_OBRIGATORIA'; end if;
  if exists(select 1 from public.pull_trips where plate=v_plate and status='IN_PROGRESS') then raise exception 'PLACA_COM_CICLO_EM_ANDAMENTO'; end if;
  select carrier into v_carrier from public.pull_vehicles where plate=v_plate and active=true limit 1;

  -- A nova saida fecha o TMA Revenda do ciclo anterior da mesma placa.
  update public.pull_trips
     set next_started_at=v_now, kpi_status='CLOSED'
   where id=(select id from public.pull_trips where plate=v_plate and status='ARRIVED' and next_started_at is null order by ended_at desc limit 1);

  insert into public.pull_trips(
    origin_unit,plate,carrier,factory,driver1_id,driver1_name,driver2_id,driver2_name,
    active_driver_id,active_driver_name,started_at,start_latitude,start_longitude,start_accuracy
  ) values(
    v_unit,v_plate,coalesce(v_carrier,''),p_factory,v_profile.id,v_profile.name,v_driver2.id,v_driver2.name,
    v_profile.id,v_profile.name,v_now,p_latitude,p_longitude,p_accuracy
  ) returning * into v_trip;

  select * into v_start_step from public.pull_steps where action_code='START_TRIP' and step_type='MAIN' and active=true limit 1;
  if v_start_step.id is null then raise exception 'ETAPA_INICIO_NAO_CONFIGURADA'; end if;

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
  v_factory public.factories%rowtype;
  v_event public.pull_events%rowtype;
  v_max_order integer;
  v_distance double precision;
  v_geofence text := 'NOT_APPLICABLE';
  v_max_accuracy integer := 100;
  v_other_id uuid;
  v_other_name text;
  v_now timestamptz := now();
begin
  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  if v_profile.id is null then raise exception 'UNAUTHORIZED'; end if;

  select * into v_trip from public.pull_trips where id=p_trip_id for update;
  if v_trip.id is null then raise exception 'CICLO_NAO_ENCONTRADO'; end if;
  if not public.is_admin() and auth.uid() not in (v_trip.driver1_id,v_trip.driver2_id) then raise exception 'FORBIDDEN'; end if;
  if not public.is_admin() and v_trip.active_driver_id<>auth.uid() then raise exception 'MOTORISTA_NAO_ESTA_ATIVO'; end if;
  if v_trip.status<>'IN_PROGRESS' then raise exception 'CICLO_NAO_ESTA_EM_ANDAMENTO'; end if;

  select coalesce(max(step_order),-2147483648) into v_max_order from public.pull_events where trip_id=v_trip.id;
  select * into v_next from public.pull_steps
   where step_type='MAIN' and active=true and sort_order>v_max_order
   order by sort_order limit 1;
  if v_next.id is null then raise exception 'SEM_PROXIMA_ETAPA'; end if;
  if v_next.id<>p_step_id then raise exception 'ETAPA_FORA_DE_SEQUENCIA'; end if;
  v_step := v_next;

  select gps_max_accuracy_m into v_max_accuracy from public.pull_settings where singleton=true;
  if p_accuracy is not null and p_accuracy>coalesce(v_max_accuracy,100) and btrim(coalesce(p_exception_reason,''))='' then
    raise exception 'GPS_BAIXA_PRECISAO';
  end if;

  if v_step.requires_factory_geofence then
    select * into v_factory from public.factories where name=v_trip.factory;
    if v_factory.latitude is null or v_factory.longitude is null or v_factory.radius_meters is null then
      v_geofence := 'NOT_CONFIGURED';
    else
      v_distance := public.pull_distance_m(p_latitude,p_longitude,v_factory.latitude,v_factory.longitude);
      if v_distance<=v_factory.radius_meters then v_geofence:='INSIDE'; else v_geofence:='OUTSIDE'; end if;
      if v_geofence='OUTSIDE' and btrim(coalesce(p_exception_reason,''))='' then
        raise exception 'FORA_RAIO_FABRICA';
      end if;
    end if;
  end if;

  insert into public.pull_events(
    trip_id,step_id,step_name,action_code,step_order,user_id,user_name,recorded_at,device_at,
    latitude,longitude,gps_accuracy,geofence_status,distance_factory_m,factory_latitude,factory_longitude,factory_radius_m,exception_reason
  ) values(
    v_trip.id,v_step.id,v_step.name,v_step.action_code,v_step.sort_order,v_profile.id,v_profile.name,v_now,p_device_at,
    p_latitude,p_longitude,p_accuracy,v_geofence,v_distance,v_factory.latitude,v_factory.longitude,v_factory.radius_meters,btrim(coalesce(p_exception_reason,''))
  ) returning * into v_event;

  if v_step.action_code='ARRIVE_FACTORY' then
    update public.pull_trips set arrived_factory_at=v_now where id=v_trip.id;
  elsif v_step.action_code='LEAVE_FACTORY' then
    update public.pull_trips set left_factory_at=v_now where id=v_trip.id;
  elsif v_step.action_code in ('DRIVER_SWAP_OUT','DRIVER_SWAP_RETURN') then
    if v_trip.active_driver_id=v_trip.driver1_id then
      v_other_id:=v_trip.driver2_id; v_other_name:=v_trip.driver2_name;
    else
      v_other_id:=v_trip.driver1_id; v_other_name:=v_trip.driver1_name;
    end if;
    update public.pull_trips set active_driver_id=v_other_id,active_driver_name=v_other_name where id=v_trip.id;
  elsif v_step.action_code='ARRIVE_UNIT' then
    update public.pull_trips
       set ended_at=v_now,ended_by_id=v_profile.id,ended_by_name=v_profile.name,
           end_latitude=p_latitude,end_longitude=p_longitude,end_accuracy=p_accuracy,
           status='ARRIVED',kpi_status='WAITING_NEXT_START',nri_status='PENDING',
           active_driver_id=v_profile.id,active_driver_name=v_profile.name
     where id=v_trip.id;
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
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_trip public.pull_trips%rowtype;
  v_step public.pull_steps%rowtype;
  v_row public.pull_occurrences%rowtype;
  v_now timestamptz:=now();
begin
  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  select * into v_trip from public.pull_trips where id=p_trip_id;
  if v_profile.id is null or v_trip.id is null then raise exception 'CICLO_NAO_ENCONTRADO'; end if;
  if auth.uid() not in (v_trip.driver1_id,v_trip.driver2_id) and not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if not public.is_admin() and v_trip.active_driver_id<>auth.uid() then raise exception 'MOTORISTA_NAO_ESTA_ATIVO'; end if;
  if v_trip.status<>'IN_PROGRESS' then raise exception 'CICLO_NAO_ESTA_EM_ANDAMENTO'; end if;
  select * into v_step from public.pull_steps where id=p_step_id and step_type='OCCURRENCE' and active=true;
  if v_step.id is null then raise exception 'OCORRENCIA_INVALIDA'; end if;
  if v_step.duration_mode='INTERVAL' and exists(select 1 from public.pull_occurrences where trip_id=v_trip.id and status='OPEN') then
    raise exception 'JA_EXISTE_OCORRENCIA_ABERTA';
  end if;

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
begin
  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  select * into v_row from public.pull_occurrences where id=p_occurrence_id for update;
  if v_row.id is null or v_row.status<>'OPEN' then raise exception 'OCORRENCIA_NAO_ESTA_ABERTA'; end if;
  select * into v_trip from public.pull_trips where id=v_row.trip_id;
  if auth.uid() not in (v_trip.driver1_id,v_trip.driver2_id) and not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if not public.is_admin() and v_trip.active_driver_id<>auth.uid() then raise exception 'MOTORISTA_NAO_ESTA_ATIVO'; end if;
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
  v_id bigint;
begin
  select * into v_trip from public.pull_trips where id=p_trip_id;
  if v_trip.id is null or v_trip.status<>'IN_PROGRESS' then raise exception 'CICLO_NAO_ESTA_EM_ANDAMENTO'; end if;
  if auth.uid() not in (v_trip.driver1_id,v_trip.driver2_id) and not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if not public.is_admin() and v_trip.active_driver_id<>auth.uid() then raise exception 'MOTORISTA_NAO_ESTA_ATIVO'; end if;
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
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
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

-- Atualiza a funcao de NRI para aceitar o vinculo com uma Puxada.
create or replace function public.create_nri_request(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
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
  v_validity date;
  v_pull_trip uuid;
  v_pull public.pull_trips%rowtype;
begin
  if not public.has_role(array['ADMIN','COLABORADOR_ARMAZEM','CONFERENTE']::text[]) then raise exception 'FORBIDDEN'; end if;
  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  if v_profile.id is null then raise exception 'UNAUTHORIZED'; end if;

  v_type := upper(coalesce(nullif(btrim(p_payload->>'request_type'),''),'AMBEV'));
  if v_type not in ('AMBEV','MARKETPLACE') then raise exception 'TIPO_NRI_INVALIDO'; end if;

  if coalesce(btrim(p_payload->>'pull_trip_id'),'')<>'' then
    v_pull_trip := (p_payload->>'pull_trip_id')::uuid;
    select * into v_pull from public.pull_trips where id=v_pull_trip for update;
    if v_pull.id is null or v_pull.status<>'ARRIVED' or v_pull.nri_status<>'PENDING' then raise exception 'PUXADA_NAO_DISPONIVEL_PARA_NRI'; end if;
  end if;

  if v_type = 'MARKETPLACE' then
    v_driver := '--'; v_plate := '--'; v_factory := '--';
  else
    v_driver := btrim(p_payload->>'driver');
    v_plate := upper(btrim(p_payload->>'plate'));
    v_factory := btrim(p_payload->>'factory');
    if coalesce(v_driver,'')='' or coalesce(v_plate,'')='' or coalesce(v_factory,'')='' then raise exception 'DADOS_TRANSPORTE_OBRIGATORIOS'; end if;
  end if;

  insert into public.nri_requests(
    unit,request_type,receipt_date,checker_id,checker_name,receipt_time,driver,plate,factory,created_by,pull_trip_id
  ) values(
    btrim(p_payload->>'unit'),v_type,(p_payload->>'receipt_date')::date,
    auth.uid(),v_profile.name,(p_payload->>'receipt_time')::time,
    v_driver,v_plate,v_factory,auth.uid(),v_pull_trip
  ) returning id into v_req;

  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'items','[]'::jsonb)) loop
    v_count := greatest(1, coalesce((v_item->>'pallets')::integer,1));
    v_validity := nullif(btrim(coalesce(v_item->>'validity_date','')),'')::date;
    for v_i in 1..v_count loop
      insert into public.nris(
        nri,request_id,product_code,product_name,unit,request_type,validity_date,lot,receipt_date,block_date,
        checker_name,receipt_time,driver,plate,factory,quantity,status,created_by,created_by_username,created_by_name
      ) values(
        null,v_req,btrim(v_item->>'product_code'),btrim(v_item->>'product_name'),btrim(p_payload->>'unit'),v_type,
        v_validity,upper(btrim(v_item->>'lot')),(p_payload->>'receipt_date')::date,
        case when v_validity is null then null else (v_validity - 30) end,
        v_profile.name,(p_payload->>'receipt_time')::time,v_driver,v_plate,v_factory,
        greatest(0,(v_item->>'quantity')::integer),'PENDENTE',auth.uid(),v_profile.username,v_profile.name
      );
    end loop;
  end loop;

  if v_pull_trip is not null then
    update public.pull_trips set nri_status='COMPLETED' where id=v_pull_trip;
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at,x.nri),'[]'::jsonb) into v_rows
  from public.nris x where x.request_id=v_req;
  return jsonb_build_object('request_id',v_req,'pull_trip_id',v_pull_trip,'nris',v_rows);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.pull_settings enable row level security;
alter table public.pull_vehicles enable row level security;
alter table public.pull_steps enable row level security;
alter table public.pull_goals enable row level security;
alter table public.pull_trips enable row level security;
alter table public.pull_events enable row level security;
alter table public.pull_occurrences enable row level security;
alter table public.pull_track_points enable row level security;
alter table public.pull_tma_adjust_audit enable row level security;

drop policy if exists pull_settings_read on public.pull_settings;
drop policy if exists pull_settings_admin on public.pull_settings;
drop policy if exists pull_vehicles_read on public.pull_vehicles;
drop policy if exists pull_vehicles_admin on public.pull_vehicles;
drop policy if exists pull_steps_read on public.pull_steps;
drop policy if exists pull_steps_admin on public.pull_steps;
drop policy if exists pull_goals_read on public.pull_goals;
drop policy if exists pull_goals_admin on public.pull_goals;
drop policy if exists pull_trips_read on public.pull_trips;
drop policy if exists pull_trips_admin on public.pull_trips;
drop policy if exists pull_events_read on public.pull_events;
drop policy if exists pull_events_admin on public.pull_events;
drop policy if exists pull_occurrences_read on public.pull_occurrences;
drop policy if exists pull_occurrences_admin on public.pull_occurrences;
drop policy if exists pull_track_read on public.pull_track_points;
drop policy if exists pull_track_admin on public.pull_track_points;
drop policy if exists pull_tma_audit_admin on public.pull_tma_adjust_audit;

create policy pull_settings_read on public.pull_settings for select to authenticated using (true);
create policy pull_settings_admin on public.pull_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy pull_vehicles_read on public.pull_vehicles for select to authenticated using (true);
create policy pull_vehicles_admin on public.pull_vehicles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy pull_steps_read on public.pull_steps for select to authenticated using (true);
create policy pull_steps_admin on public.pull_steps for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy pull_goals_read on public.pull_goals for select to authenticated using (true);
create policy pull_goals_admin on public.pull_goals for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy pull_trips_read on public.pull_trips for select to authenticated using (
  public.is_admin() or driver1_id=auth.uid() or driver2_id=auth.uid()
  or (public.has_role(array['COLABORADOR_ARMAZEM','CONFERENTE']::text[]) and status='ARRIVED')
);
create policy pull_trips_admin on public.pull_trips for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy pull_events_read on public.pull_events for select to authenticated using (
  public.is_admin() or exists(select 1 from public.pull_trips t where t.id=trip_id and (t.driver1_id=auth.uid() or t.driver2_id=auth.uid()))
);
create policy pull_events_admin on public.pull_events for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy pull_occurrences_read on public.pull_occurrences for select to authenticated using (
  public.is_admin() or exists(select 1 from public.pull_trips t where t.id=trip_id and (t.driver1_id=auth.uid() or t.driver2_id=auth.uid()))
);
create policy pull_occurrences_admin on public.pull_occurrences for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy pull_track_read on public.pull_track_points for select to authenticated using (
  public.is_admin() or exists(select 1 from public.pull_trips t where t.id=trip_id and (t.driver1_id=auth.uid() or t.driver2_id=auth.uid()))
);
create policy pull_track_admin on public.pull_track_points for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy pull_tma_audit_admin on public.pull_tma_adjust_audit for select to authenticated using (public.is_admin());

-- Grants: as escritas operacionais de motorista passam pelas RPCs acima.
grant select,insert,update,delete on public.pull_settings,public.pull_vehicles,public.pull_steps,public.pull_goals,
  public.pull_trips,public.pull_events,public.pull_occurrences,public.pull_track_points,public.pull_tma_adjust_audit to authenticated;
grant usage,select on sequence public.pull_trip_number_seq to authenticated;
grant usage,select on sequence public.pull_track_points_id_seq to authenticated;
grant execute on function public.pull_distance_m(double precision,double precision,double precision,double precision) to authenticated;
grant execute on function public.start_pull_trip(text,text,uuid,double precision,double precision,double precision,timestamptz) to authenticated;
grant execute on function public.record_pull_step(uuid,uuid,double precision,double precision,double precision,text,timestamptz) to authenticated;
grant execute on function public.start_pull_occurrence(uuid,uuid,double precision,double precision,double precision,text) to authenticated;
grant execute on function public.end_pull_occurrence(uuid,double precision,double precision,double precision) to authenticated;
grant execute on function public.record_pull_track_point(uuid,double precision,double precision,double precision,timestamptz) to authenticated;
grant execute on function public.adjust_pull_tma(uuid,integer,text) to authenticated;
grant execute on function public.create_nri_request(jsonb) to authenticated;

-- Realtime
DO $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='pull_trips') then
    execute 'alter publication supabase_realtime add table public.pull_trips';
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='pull_events') then
    execute 'alter publication supabase_realtime add table public.pull_events';
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='pull_occurrences') then
    execute 'alter publication supabase_realtime add table public.pull_occurrences';
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='pull_track_points') then
    execute 'alter publication supabase_realtime add table public.pull_track_points';
  end if;
end $$;
