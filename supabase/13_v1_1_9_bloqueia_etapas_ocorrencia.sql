-- Disb Gestao v1.1.9 - bloqueio de etapas obrigatorias durante ocorrencia aberta
-- Execute depois do 12_v1_1_8_corrige_limite_gps_rpc.sql.
-- Regra: enquanto existir uma ocorrencia OPEN na viagem, nenhuma etapa MAIN obrigatoria pode ser registrada.
-- A trava existe no banco para impedir contorno pelo frontend/API.

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
   where step_type='MAIN' and active=true and sort_order>v_max_order
   order by sort_order limit 1;
  if v_next.id is null then raise exception 'SEM_PROXIMA_ETAPA'; end if;
  if v_next.id<>p_step_id then raise exception 'ETAPA_FORA_DE_SEQUENCIA'; end if;
  v_step := v_next;

  -- V1.1.9: uma ocorrencia aberta pausa o avanco das etapas obrigatorias.
  if coalesce(v_step.required,true) then
    select * into v_open_occ
      from public.pull_occurrences
     where trip_id=v_trip.id and status='OPEN'
     order by started_at desc
     limit 1;
    if v_open_occ.id is not null then
      raise exception 'OCORRENCIA_EM_ANDAMENTO:%',v_open_occ.occurrence_name;
    end if;
  end if;

  if not public.is_admin() then
    if v_step.executor_driver=1 and auth.uid()<>v_trip.driver1_id then raise exception 'ETAPA_MOTORISTA_1'; end if;
    if v_step.executor_driver=2 and auth.uid()<>v_trip.driver2_id then raise exception 'ETAPA_MOTORISTA_2'; end if;
    if v_step.executor_driver is null and v_trip.active_driver_id<>auth.uid() then raise exception 'MOTORISTA_NAO_ESTA_ATIVO'; end if;
  end if;

  select coalesce(gps_max_accuracy_m,200) into v_max_accuracy from public.pull_settings where singleton=true;
  v_max_accuracy := least(500,greatest(5,coalesce(v_max_accuracy,200)));
  if p_accuracy is null or p_accuracy>v_max_accuracy then
    raise exception 'GPS_PRECISAO_INSUFICIENTE:%:%',coalesce(round(p_accuracy)::text,'SEM_SINAL'),v_max_accuracy;
  end if;

  if v_step.requires_factory_geofence then
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

  if v_step.action_code='ARRIVE_FACTORY' then
    update public.pull_trips set arrived_factory_at=v_now where id=v_trip.id;
  elsif v_step.action_code='LEAVE_FACTORY' then
    update public.pull_trips set left_factory_at=v_now where id=v_trip.id;
  elsif v_step.action_code='ARRIVE_UNIT' then
    update public.pull_trips
       set ended_at=v_now,ended_by_id=v_profile.id,ended_by_name=v_profile.name,
           end_latitude=p_latitude,end_longitude=p_longitude,end_accuracy=p_accuracy,
           status='ARRIVED',kpi_status='WAITING_NEXT_START',nri_status='PENDING',
           active_driver_id=v_profile.id,active_driver_name=v_profile.name
     where id=v_trip.id;
  end if;

  if v_step.action_code<>'ARRIVE_UNIT' then
    select * into v_after from public.pull_steps
     where step_type='MAIN' and active=true and sort_order>v_step.sort_order
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

grant execute on function public.record_pull_step(uuid,uuid,double precision,double precision,double precision,text,timestamptz) to authenticated;

-- Tambem impede iniciar uma segunda ocorrencia enquanto outra estiver aberta.
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
  v_max_accuracy integer:=200;
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

  if exists(select 1 from public.pull_occurrences where trip_id=v_trip.id and status='OPEN') then
    raise exception 'JA_EXISTE_OCORRENCIA_ABERTA';
  end if;

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

grant execute on function public.start_pull_occurrence(uuid,uuid,double precision,double precision,double precision,text) to authenticated;

-- Diagnostico: deve retornar zero viagens com etapa obrigatoria registrada durante uma ocorrencia ainda aberta
-- para apontamentos realizados depois desta migracao.
select 'v1.1.9 pronta - etapas obrigatorias bloqueadas durante ocorrencia aberta' as status;
