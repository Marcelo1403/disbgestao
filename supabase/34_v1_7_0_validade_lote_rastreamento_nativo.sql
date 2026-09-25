-- Disb Gestao v1.7.0
-- SQL 34 - Validade/Lote em Avarias de Vendas + rastreamento nativo da Puxada/Transferencia
--
-- IMPORTANTE:
-- Migracao ADITIVA.
-- Nao encerra, cancela, recria ou exclui ciclos de Puxada/Transferencia em andamento.

begin;

create extension if not exists pgcrypto;

-- ===========================================================================
-- 1. AVARIAS DE VENDAS - CODIGO/NOME DO PRODUTO E LOTE
-- ===========================================================================

alter table public.sales_damage_items
  add column if not exists product_code text;

alter table public.sales_damage_items
  add column if not exists product_name text;

alter table public.sales_damage_items
  add column if not exists lot text;

create index if not exists idx_sales_damage_items_product_lot
  on public.sales_damage_items(product_code, lot)
  where lot is not null;


-- Wrapper da RPC atual.
-- A funcao antiga continua executando todo o fluxo existente de criacao,
-- fotos, GPS, status e auditoria. Esta versao valida/persiste os novos campos.
create or replace function public.create_sales_damage_request_v2(p_payload jsonb)
returns public.sales_damage_requests
language plpgsql
security definer
set search_path=public
as $$
declare
  v_req public.sales_damage_requests%rowtype;
  v_item jsonb;
  v_order integer := 0;
  v_reason text;
  v_lot text;
begin
  if jsonb_typeof(coalesce(p_payload->'items','[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_payload->'items','[]'::jsonb)) = 0 then
    raise exception 'PRODUTO_OBRIGATORIO';
  end if;

  -- Valida tudo antes de criar a solicitacao.
  for v_item in
    select value
    from jsonb_array_elements(p_payload->'items')
  loop
    v_reason := upper(btrim(coalesce(v_item->>'reason','')));
    v_lot := upper(regexp_replace(coalesce(v_item->>'lot',''),'[^A-Za-z0-9]','','g'));

    if v_reason='VALIDADE' and btrim(coalesce(v_item->>'validity_date',''))='' then
      raise exception 'VALIDADE_OBRIGATORIA';
    end if;

    if v_reason='VALIDADE' and v_lot='' then
      raise exception 'LOTE_OBRIGATORIO';
    end if;
  end loop;

  select *
    into v_req
  from public.create_sales_damage_request(p_payload);

  for v_item in
    select value
    from jsonb_array_elements(p_payload->'items')
  loop
    v_order := v_order + 1;
    v_reason := upper(btrim(coalesce(v_item->>'reason','')));
    v_lot := upper(regexp_replace(coalesce(v_item->>'lot',''),'[^A-Za-z0-9]','','g'));

    update public.sales_damage_items
       set product_code = nullif(btrim(coalesce(v_item->>'product_code','')),''),
           product_name = nullif(btrim(coalesce(v_item->>'product_name','')),''),
           lot = case
                   when v_reason='VALIDADE' then nullif(v_lot,'')
                   else null
                 end
     where request_id=v_req.id
       and item_order=v_order;
  end loop;

  return v_req;
end;
$$;

grant execute on function public.create_sales_damage_request_v2(jsonb)
to authenticated;


-- Compatibilidade de lote com NRI.
-- O lote e comparado pelo mesmo produto e mesma unidade da solicitacao.
create or replace function public.get_sales_damage_lot_matches(p_request_id uuid)
returns table(
  item_id uuid,
  nri text,
  validity_date date,
  product_code text,
  product_name text,
  lot text
)
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_req public.sales_damage_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED';
  end if;

  select *
    into v_req
  from public.sales_damage_requests
  where id=p_request_id;

  if v_req.id is null then
    raise exception 'SOLICITACAO_NAO_ENCONTRADA';
  end if;

  if not (
    v_req.seller_id=auth.uid()
    or public.has_permission('SALES_DAMAGE_VIEW_ALL')
    or public.has_permission('SALES_DAMAGE_REVIEW')
    or public.has_permission('SALES_DAMAGE_OVERRIDE')
    or public.has_permission('SALES_DAMAGE_POST')
  ) then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select
    i.id,
    n.nri,
    n.validity_date,
    n.product_code,
    n.product_name,
    upper(regexp_replace(lot_piece.value,'[^A-Za-z0-9]','','g')) as lot
  from public.sales_damage_items i
  join public.nris n
    on n.unit=v_req.unit
   and btrim(coalesce(n.product_code,''))=btrim(coalesce(i.product_code,''))
  cross join lateral regexp_split_to_table(
    coalesce(n.lot,''),
    E'[[:space:]]+[-–—][[:space:]]+|[,;|\\n]+'
  ) as lot_piece(value)
  where i.request_id=p_request_id
    and upper(btrim(coalesce(i.reason,'')))='VALIDADE'
    and btrim(coalesce(i.product_code,''))<>''
    and btrim(coalesce(i.lot,''))<>''
    and upper(regexp_replace(lot_piece.value,'[^A-Za-z0-9]','','g'))
        = upper(regexp_replace(i.lot,'[^A-Za-z0-9]','','g'))
  order by i.item_order,n.created_at desc,n.nri;
end;
$$;

grant execute on function public.get_sales_damage_lot_matches(uuid)
to authenticated;


-- ===========================================================================
-- 2. RASTREAMENTO PUXADA / TRANSFERENCIA
-- ===========================================================================

-- Permite rastreamento a cada 5 segundos.
-- Nao altera a regra de precisao das ETAPAS; apenas o rastreamento do trajeto.
alter table public.pull_settings
  drop constraint if exists pull_settings_track_interval_seconds_check;

alter table public.pull_settings
  add constraint pull_settings_track_interval_seconds_check
  check (track_interval_seconds between 5 and 3600);

update public.pull_settings
   set track_interval_seconds=least(track_interval_seconds,5),
       track_min_distance_m=least(track_min_distance_m,10),
       updated_at=now()
 where singleton=true;


-- Metadados dos pontos nativos.
alter table public.pull_track_points
  add column if not exists ingest_key text;

alter table public.pull_track_points
  add column if not exists source text not null default 'WEB';

alter table public.pull_track_points
  add column if not exists speed_mps double precision;

alter table public.pull_track_points
  add column if not exists bearing double precision;

create unique index if not exists idx_pull_track_points_ingest_key
  on public.pull_track_points(ingest_key)
  where ingest_key is not null;


-- Token estreito por viagem + motorista.
-- O servico nativo usa este token, nao a chave service_role e nao a senha do usuario.
create table if not exists public.pull_tracking_tokens (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.pull_trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_issued_at timestamptz not null default now(),
  unique(trip_id,user_id)
);

create index if not exists idx_pull_tracking_tokens_token
  on public.pull_tracking_tokens(token);

alter table public.pull_tracking_tokens enable row level security;
revoke all on public.pull_tracking_tokens from anon, authenticated;


create or replace function public.get_pull_tracking_token(p_trip_id uuid)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_trip public.pull_trips%rowtype;
  v_token uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED';
  end if;

  select *
    into v_trip
  from public.pull_trips
  where id=p_trip_id;

  if v_trip.id is null then
    raise exception 'CICLO_NAO_ENCONTRADO';
  end if;

  if v_trip.status<>'IN_PROGRESS' then
    raise exception 'CICLO_NAO_ESTA_EM_ANDAMENTO';
  end if;

  if not public.is_admin()
     and auth.uid() not in (v_trip.driver1_id,v_trip.driver2_id) then
    raise exception 'FORBIDDEN';
  end if;

  if not public.is_admin()
     and v_trip.active_driver_id<>auth.uid() then
    raise exception 'MOTORISTA_NAO_ESTA_ATIVO';
  end if;

  insert into public.pull_tracking_tokens(
    trip_id,user_id,active,last_issued_at
  )
  values(
    v_trip.id,auth.uid(),true,now()
  )
  on conflict(trip_id,user_id)
  do update set
    active=true,
    last_issued_at=now()
  returning token into v_token;

  return v_token::text;
end;
$$;

grant execute on function public.get_pull_tracking_token(uuid)
to authenticated;


-- Sincronizacao dos pontos que ficaram na fila local do APK durante falta de internet.
create or replace function public.record_pull_track_point_v2(
  p_trip_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision default null,
  p_device_at timestamptz default null,
  p_ingest_key text default null,
  p_speed_mps double precision default null,
  p_bearing double precision default null,
  p_source text default 'APK_OFFLINE'
)
returns bigint
language plpgsql
security definer
set search_path=public
as $$
declare
  v_trip public.pull_trips%rowtype;
  v_id bigint;
  v_when timestamptz := coalesce(p_device_at,now());
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED';
  end if;

  select *
    into v_trip
  from public.pull_trips
  where id=p_trip_id;

  if v_trip.id is null then
    raise exception 'CICLO_NAO_ENCONTRADO';
  end if;

  if not public.is_admin()
     and auth.uid() not in (v_trip.driver1_id,v_trip.driver2_id) then
    raise exception 'FORBIDDEN';
  end if;

  -- Aceita sincronizacao atrasada de ponto produzido durante a viagem.
  if v_when < v_trip.started_at - interval '10 minutes'
     or (
       v_trip.ended_at is not null
       and v_when > v_trip.ended_at + interval '20 minutes'
     ) then
    raise exception 'PONTO_FORA_DO_PERIODO_DA_VIAGEM';
  end if;

  if p_ingest_key is not null and btrim(p_ingest_key)<>'' then
    insert into public.pull_track_points(
      trip_id,user_id,device_at,latitude,longitude,gps_accuracy,
      ingest_key,source,speed_mps,bearing
    )
    values(
      v_trip.id,auth.uid(),v_when,p_latitude,p_longitude,p_accuracy,
      p_ingest_key,coalesce(nullif(btrim(p_source),''),'APK_OFFLINE'),
      p_speed_mps,p_bearing
    )
    on conflict(ingest_key) where ingest_key is not null
    do update set ingest_key=excluded.ingest_key
    returning id into v_id;
  else
    insert into public.pull_track_points(
      trip_id,user_id,device_at,latitude,longitude,gps_accuracy,
      source,speed_mps,bearing
    )
    values(
      v_trip.id,auth.uid(),v_when,p_latitude,p_longitude,p_accuracy,
      coalesce(nullif(btrim(p_source),''),'APK_OFFLINE'),
      p_speed_mps,p_bearing
    )
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

grant execute on function public.record_pull_track_point_v2(
  uuid,double precision,double precision,double precision,timestamptz,
  text,double precision,double precision,text
) to authenticated;


-- Edge Function pull-track-ingest.
grant usage on schema public to service_role;
grant select,insert,update on public.pull_tracking_tokens to service_role;
grant select on public.pull_trips to service_role;
grant select on public.pull_settings to service_role;
grant select,insert on public.pull_track_points to service_role;

commit;


-- ===========================================================================
-- 3. CONFERENCIAS
-- ===========================================================================

select
  column_name,
  data_type
from information_schema.columns
where table_schema='public'
  and table_name='sales_damage_items'
  and column_name in ('product_code','product_name','lot')
order by ordinal_position;

select
  gps_max_accuracy_m,
  track_interval_seconds,
  track_min_distance_m
from public.pull_settings
where singleton=true;

select
  column_name,
  data_type
from information_schema.columns
where table_schema='public'
  and table_name='pull_track_points'
  and column_name in ('ingest_key','source','speed_mps','bearing')
order by ordinal_position;

select
  table_name
from information_schema.tables
where table_schema='public'
  and table_name='pull_tracking_tokens';

-- Apenas consulta; nenhuma linha abaixo e alterada.
select
  id,
  trip_code,
  cycle_type,
  plate,
  status,
  active_driver_name,
  started_at
from public.pull_trips
where status='IN_PROGRESS'
order by started_at;
