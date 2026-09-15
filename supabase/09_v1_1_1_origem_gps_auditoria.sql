-- Disb Gestao v1.1.1 - Origem por viagem + parceiro + GPS de alta precisao + raio somente para auditoria
-- Execute no SQL Editor do Supabase APOS o 08_v1_1_0_modulo_puxada.sql.

-- A origem deixa de ser uma configuracao fixa.
drop function if exists public.start_pull_trip(text,text,uuid,double precision,double precision,double precision,timestamptz);
alter table public.pull_settings drop column if exists default_unit;

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
  v_origin text;
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
  v_origin := btrim(coalesce(p_origin_unit,''));
  if v_origin='' or not exists(select 1 from public.units where name=v_origin and active=true) then raise exception 'ORIGEM_INVALIDA'; end if;
  v_carrier := btrim(coalesce(p_carrier,''));
  if v_carrier='' then raise exception 'PARCEIRO_OBRIGATORIO'; end if;

  v_plate := upper(regexp_replace(coalesce(p_plate,''),'[^A-Za-z0-9]','','g'));
  if v_plate='' then raise exception 'PLACA_OBRIGATORIA'; end if;
  if exists(select 1 from public.pull_trips where plate=v_plate and status='IN_PROGRESS') then raise exception 'PLACA_COM_CICLO_EM_ANDAMENTO'; end if;

  -- A nova saída fecha o TMA Revenda do ciclo anterior da mesma placa.
  update public.pull_trips
     set next_started_at=v_now, kpi_status='CLOSED'
   where id=(select id from public.pull_trips where plate=v_plate and status='ARRIVED' and next_started_at is null order by ended_at desc limit 1);

  insert into public.pull_trips(
    origin_unit,plate,carrier,factory,driver1_id,driver1_name,driver2_id,driver2_name,
    active_driver_id,active_driver_name,started_at,start_latitude,start_longitude,start_accuracy
  ) values(
    v_origin,v_plate,v_carrier,p_factory,v_profile.id,v_profile.name,v_driver2.id,v_driver2.name,
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
  v_reason text := btrim(coalesce(p_exception_reason,''));
  v_accuracy_note text := '';
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

  -- A precisão é auditada, mas não bloqueia o apontamento.
  select gps_max_accuracy_m into v_max_accuracy from public.pull_settings where singleton=true;
  if p_accuracy is not null and p_accuracy>coalesce(v_max_accuracy,100) then
    v_accuracy_note := format('Precisão GPS ±%s m acima da referência de %s m',round(p_accuracy)::integer,coalesce(v_max_accuracy,100));
  end if;

  -- O raio da fábrica é evidência de auditoria. Estar fora do raio nunca bloqueia o registro.
  if v_step.requires_factory_geofence then
    select * into v_factory from public.factories where name=v_trip.factory;
    if v_factory.latitude is null or v_factory.longitude is null or v_factory.radius_meters is null then
      v_geofence := 'NOT_CONFIGURED';
    else
      v_distance := public.pull_distance_m(p_latitude,p_longitude,v_factory.latitude,v_factory.longitude);
      if v_distance<=v_factory.radius_meters then v_geofence:='INSIDE'; else v_geofence:='OUTSIDE'; end if;
    end if;
  end if;

  v_reason := concat_ws(' | ',nullif(v_reason,''),nullif(v_accuracy_note,''));

  insert into public.pull_events(
    trip_id,step_id,step_name,action_code,step_order,user_id,user_name,recorded_at,device_at,
    latitude,longitude,gps_accuracy,geofence_status,distance_factory_m,factory_latitude,factory_longitude,factory_radius_m,exception_reason
  ) values(
    v_trip.id,v_step.id,v_step.name,v_step.action_code,v_step.sort_order,v_profile.id,v_profile.name,v_now,p_device_at,
    p_latitude,p_longitude,p_accuracy,v_geofence,v_distance,v_factory.latitude,v_factory.longitude,v_factory.radius_meters,v_reason
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

-- Mantemos a flag existente, mas agora ela significa AUDITAR o raio, nunca bloquear.
update public.pull_steps set requires_factory_geofence=true where action_code='ARRIVE_FACTORY';

grant execute on function public.start_pull_trip(text,text,text,text,uuid,double precision,double precision,double precision,timestamptz) to authenticated;
grant execute on function public.record_pull_step(uuid,uuid,double precision,double precision,double precision,text,timestamptz) to authenticated;

comment on column public.pull_events.geofence_status is 'Resultado de auditoria do raio da fabrica; OUTSIDE nao bloqueia o registro.';
comment on column public.pull_events.gps_accuracy is 'Precisao informada pelo dispositivo em metros; registrada para auditoria.';
