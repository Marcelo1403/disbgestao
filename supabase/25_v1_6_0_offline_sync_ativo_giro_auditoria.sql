-- Disb Gestao v1.6.0
-- Offline-first: FEFO, Avarias de Entrega e etapas de Puxada/Transferencia
-- Ativo de Giro: correcao de lancamento + edicao administrativa auditada
-- Requer os SQLs anteriores, inclusive 22, 23 e 24.

begin;

-- ---------------------------------------------------------------------------
-- RECIBOS DE SINCRONIZACAO OFFLINE
-- Um operation_id e processado no maximo uma vez por usuario.
-- ---------------------------------------------------------------------------
create table if not exists public.offline_sync_receipts (
  operation_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_type text not null,
  result jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now()
);

create index if not exists idx_offline_sync_receipts_user
  on public.offline_sync_receipts(user_id, processed_at desc);

alter table public.offline_sync_receipts enable row level security;
drop policy if exists offline_sync_receipts_read on public.offline_sync_receipts;
create policy offline_sync_receipts_read
on public.offline_sync_receipts
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- FEFO OFFLINE
-- ---------------------------------------------------------------------------
create or replace function public.offline_sync_fefo_start(
  p_operation_id uuid,
  p_unit text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_result jsonb;
begin
  if p_operation_id is null then raise exception 'OFFLINE_OPERATION_ID_OBRIGATORIO'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,0));

  select result into v_result
  from public.offline_sync_receipts
  where operation_id=p_operation_id and user_id=auth.uid();
  if found then return v_result; end if;

  -- Se o usuario ja tinha uma contagem aberta antes de ficar offline, reutiliza-a.
  select to_jsonb(c) into v_result
  from public.fefo_counts c
  where c.counter_id=auth.uid() and c.status='IN_PROGRESS'
  order by c.started_at desc
  limit 1;

  if v_result is null then
    select to_jsonb(x) into v_result from public.start_fefo_count(p_unit) x;
  end if;

  insert into public.offline_sync_receipts(operation_id,user_id,operation_type,result)
  values(p_operation_id,auth.uid(),'FEFO_START',v_result)
  on conflict(operation_id) do nothing;
  return v_result;
end;
$$;

create or replace function public.offline_sync_fefo_item(
  p_operation_id uuid,
  p_count_id uuid,
  p_product_code text,
  p_validity_date date,
  p_lot text,
  p_street text,
  p_pallet integer,
  p_layer integer,
  p_box integer,
  p_loose_unit integer,
  p_item_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_result jsonb;
begin
  if p_operation_id is null then raise exception 'OFFLINE_OPERATION_ID_OBRIGATORIO'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,0));

  select result into v_result
  from public.offline_sync_receipts
  where operation_id=p_operation_id and user_id=auth.uid();
  if found then return v_result; end if;

  select to_jsonb(x) into v_result
  from public.save_fefo_item(
    p_count_id,p_product_code,p_validity_date,p_lot,p_street,
    p_pallet,p_layer,p_box,p_loose_unit,p_item_id
  ) x;

  insert into public.offline_sync_receipts(operation_id,user_id,operation_type,result)
  values(p_operation_id,auth.uid(),'FEFO_ITEM',v_result)
  on conflict(operation_id) do nothing;
  return v_result;
end;
$$;

create or replace function public.offline_sync_fefo_delete(
  p_operation_id uuid,
  p_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_result jsonb := jsonb_build_object('ok',true,'item_id',p_item_id);
begin
  if p_operation_id is null then raise exception 'OFFLINE_OPERATION_ID_OBRIGATORIO'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,0));

  if exists(
    select 1 from public.offline_sync_receipts
    where operation_id=p_operation_id and user_id=auth.uid()
  ) then
    select result into v_result from public.offline_sync_receipts
    where operation_id=p_operation_id and user_id=auth.uid();
    return v_result;
  end if;

  perform public.delete_fefo_item(p_item_id);
  insert into public.offline_sync_receipts(operation_id,user_id,operation_type,result)
  values(p_operation_id,auth.uid(),'FEFO_DELETE',v_result)
  on conflict(operation_id) do nothing;
  return v_result;
end;
$$;

create or replace function public.offline_sync_fefo_finish(
  p_operation_id uuid,
  p_count_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_result jsonb;
begin
  if p_operation_id is null then raise exception 'OFFLINE_OPERATION_ID_OBRIGATORIO'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,0));

  select result into v_result
  from public.offline_sync_receipts
  where operation_id=p_operation_id and user_id=auth.uid();
  if found then return v_result; end if;

  select to_jsonb(x) into v_result from public.finish_fefo_count(p_count_id) x;

  insert into public.offline_sync_receipts(operation_id,user_id,operation_type,result)
  values(p_operation_id,auth.uid(),'FEFO_FINISH',v_result)
  on conflict(operation_id) do nothing;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- AVARIA DE ENTREGA OFFLINE
-- As fotos/assinatura sao enviadas pelo app quando a internet volta; o RPC
-- abaixo torna a criacao da requisicao idempotente.
-- ---------------------------------------------------------------------------
create or replace function public.offline_sync_damage_request(
  p_operation_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_result jsonb;
  v_request_id uuid;
begin
  if p_operation_id is null then raise exception 'OFFLINE_OPERATION_ID_OBRIGATORIO'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,0));

  select result into v_result
  from public.offline_sync_receipts
  where operation_id=p_operation_id and user_id=auth.uid();
  if found then return v_result; end if;

  v_request_id := public.create_damage_request(p_payload);
  v_result := jsonb_build_object('request_id',v_request_id);

  insert into public.offline_sync_receipts(operation_id,user_id,operation_type,result)
  values(p_operation_id,auth.uid(),'DAMAGE_CREATE',v_result)
  on conflict(operation_id) do nothing;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- ETAPA DE PUXADA / TRANSFERENCIA OFFLINE
-- ---------------------------------------------------------------------------
create or replace function public.offline_sync_pull_step(
  p_operation_id uuid,
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
set search_path=public
as $$
declare
  v_result jsonb;
begin
  if p_operation_id is null then raise exception 'OFFLINE_OPERATION_ID_OBRIGATORIO'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,0));

  select result into v_result
  from public.offline_sync_receipts
  where operation_id=p_operation_id and user_id=auth.uid();
  if found then return v_result; end if;

  v_result := public.record_pull_step(
    p_trip_id,p_step_id,p_latitude,p_longitude,p_accuracy,
    coalesce(p_exception_reason,''),p_device_at
  );

  insert into public.offline_sync_receipts(operation_id,user_id,operation_type,result)
  values(p_operation_id,auth.uid(),'PULL_STEP',v_result)
  on conflict(operation_id) do nothing;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- ATIVO DE GIRO - GARANTIA DA COLUNA LOCAL E RPC DE ADICAO
-- ---------------------------------------------------------------------------
alter table public.rotating_asset_entries add column if not exists location text;
update public.rotating_asset_entries set location='PATIO' where location is null or btrim(location)='';
alter table public.rotating_asset_entries alter column location set default 'PATIO';
alter table public.rotating_asset_entries alter column location set not null;
alter table public.rotating_asset_entries drop constraint if exists rotating_asset_entries_location_check;
alter table public.rotating_asset_entries add constraint rotating_asset_entries_location_check check(location in ('PATIO','REFUGO'));

create index if not exists idx_rotating_asset_entries_count_location
on public.rotating_asset_entries(count_id,location,product_id,created_at);

create or replace function public.add_rotating_asset_entry(
  p_count_id uuid,
  p_product_id uuid,
  p_pallet_gfa integer default 0,
  p_layer_gfa integer default 0,
  p_box_gfa integer default 0,
  p_loose integer default 0,
  p_units integer default 0,
  p_location text default 'PATIO'
)
returns public.rotating_asset_entries
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.profiles%rowtype;
  v_count public.rotating_asset_counts%rowtype;
  v_product public.rotating_asset_products%rowtype;
  v_row public.rotating_asset_entries%rowtype;
  v_pallet integer:=greatest(0,coalesce(p_pallet_gfa,0));
  v_layer integer:=greatest(0,coalesce(p_layer_gfa,0));
  v_box integer:=greatest(0,coalesce(p_box_gfa,0));
  v_loose integer:=greatest(0,coalesce(p_loose,0));
  v_units integer:=greatest(0,coalesce(p_units,0));
  v_location text:=upper(btrim(coalesce(p_location,'PATIO')));
begin
  if not public.has_permission('ROTATING_ASSET_CREATE') then raise exception 'FORBIDDEN'; end if;
  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  if v_profile.id is null then raise exception 'UNAUTHORIZED'; end if;
  if v_location not in ('PATIO','REFUGO') then raise exception 'ATIVO_GIRO_LOCAL_INVALIDO'; end if;

  select * into v_count from public.rotating_asset_counts where id=p_count_id for update;
  if v_count.id is null then raise exception 'ATIVO_GIRO_CONTAGEM_NAO_ENCONTRADA'; end if;
  if v_count.status<>'IN_PROGRESS' then raise exception 'ATIVO_GIRO_CONTAGEM_FINALIZADA'; end if;
  if not public.is_admin() and v_count.counter_id<>auth.uid() then raise exception 'FORBIDDEN'; end if;

  select * into v_product from public.rotating_asset_products where id=p_product_id and active=true;
  if v_product.id is null then raise exception 'ATIVO_GIRO_PRODUTO_INVALIDO'; end if;
  if v_pallet+v_layer+v_box+v_loose+v_units<=0 then raise exception 'ATIVO_GIRO_QUANTIDADE_OBRIGATORIA'; end if;

  insert into public.rotating_asset_entries(
    count_id,product_id,sap_code,asset_code,product_description,location,
    pallet_gfa,layer_gfa,box_gfa,loose,units,created_by,created_by_name
  ) values(
    v_count.id,v_product.id,v_product.sap_code,v_product.asset_code,v_product.description,v_location,
    v_pallet,v_layer,v_box,v_loose,v_units,auth.uid(),v_profile.name
  ) returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- ATIVO DE GIRO - EDICAO ADMINISTRATIVA COM AUDITORIA
-- ---------------------------------------------------------------------------
create table if not exists public.rotating_asset_entry_audit (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null,
  count_id uuid not null,
  product_id uuid not null,
  sap_code text,
  asset_code text,
  product_description text not null,
  old_location text not null,
  new_location text not null,
  old_pallet_gfa integer not null,
  new_pallet_gfa integer not null,
  old_layer_gfa integer not null,
  new_layer_gfa integer not null,
  old_box_gfa integer not null,
  new_box_gfa integer not null,
  old_loose integer not null,
  new_loose integer not null,
  old_units integer not null,
  new_units integer not null,
  reason text not null,
  changed_by uuid not null references auth.users(id),
  changed_by_name text not null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_rotating_asset_entry_audit_count
on public.rotating_asset_entry_audit(count_id,changed_at desc);
create index if not exists idx_rotating_asset_entry_audit_entry
on public.rotating_asset_entry_audit(entry_id,changed_at desc);

alter table public.rotating_asset_entry_audit enable row level security;
drop policy if exists rotating_asset_entry_audit_admin_read on public.rotating_asset_entry_audit;
create policy rotating_asset_entry_audit_admin_read
on public.rotating_asset_entry_audit
for select to authenticated
using (public.is_admin());

create or replace function public.admin_update_rotating_asset_entry(
  p_entry_id uuid,
  p_pallet_gfa integer,
  p_layer_gfa integer,
  p_box_gfa integer,
  p_loose integer,
  p_units integer,
  p_location text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.profiles%rowtype;
  v_old public.rotating_asset_entries%rowtype;
  v_new public.rotating_asset_entries%rowtype;
  v_location text:=upper(btrim(coalesce(p_location,'PATIO')));
  v_reason text:=btrim(coalesce(p_reason,''));
  v_pallet integer:=greatest(0,coalesce(p_pallet_gfa,0));
  v_layer integer:=greatest(0,coalesce(p_layer_gfa,0));
  v_box integer:=greatest(0,coalesce(p_box_gfa,0));
  v_loose integer:=greatest(0,coalesce(p_loose,0));
  v_units integer:=greatest(0,coalesce(p_units,0));
begin
  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  if v_profile.id is null then raise exception 'UNAUTHORIZED'; end if;
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if v_reason='' then raise exception 'ATIVO_GIRO_MOTIVO_AJUSTE_OBRIGATORIO'; end if;
  if v_location not in ('PATIO','REFUGO') then raise exception 'ATIVO_GIRO_LOCAL_INVALIDO'; end if;
  if v_pallet+v_layer+v_box+v_loose+v_units<=0 then raise exception 'ATIVO_GIRO_QUANTIDADE_OBRIGATORIA'; end if;

  select * into v_old from public.rotating_asset_entries where id=p_entry_id for update;
  if v_old.id is null then raise exception 'ATIVO_GIRO_LANCAMENTO_NAO_ENCONTRADO'; end if;

  update public.rotating_asset_entries
  set location=v_location,
      pallet_gfa=v_pallet,
      layer_gfa=v_layer,
      box_gfa=v_box,
      loose=v_loose,
      units=v_units
  where id=v_old.id
  returning * into v_new;

  insert into public.rotating_asset_entry_audit(
    entry_id,count_id,product_id,sap_code,asset_code,product_description,
    old_location,new_location,
    old_pallet_gfa,new_pallet_gfa,
    old_layer_gfa,new_layer_gfa,
    old_box_gfa,new_box_gfa,
    old_loose,new_loose,
    old_units,new_units,
    reason,changed_by,changed_by_name
  ) values(
    v_old.id,v_old.count_id,v_old.product_id,v_old.sap_code,v_old.asset_code,v_old.product_description,
    v_old.location,v_new.location,
    v_old.pallet_gfa,v_new.pallet_gfa,
    v_old.layer_gfa,v_new.layer_gfa,
    v_old.box_gfa,v_new.box_gfa,
    v_old.loose,v_new.loose,
    v_old.units,v_new.units,
    v_reason,auth.uid(),v_profile.name
  );

  return to_jsonb(v_new);
end;
$$;

grant execute on function public.offline_sync_fefo_start(uuid,text) to authenticated;
grant execute on function public.offline_sync_fefo_item(uuid,uuid,text,date,text,text,integer,integer,integer,integer,uuid) to authenticated;
grant execute on function public.offline_sync_fefo_delete(uuid,uuid) to authenticated;
grant execute on function public.offline_sync_fefo_finish(uuid,uuid) to authenticated;
grant execute on function public.offline_sync_damage_request(uuid,jsonb) to authenticated;
grant execute on function public.offline_sync_pull_step(uuid,uuid,uuid,double precision,double precision,double precision,text,timestamptz) to authenticated;
grant execute on function public.add_rotating_asset_entry(uuid,uuid,integer,integer,integer,integer,integer,text) to authenticated;
grant execute on function public.admin_update_rotating_asset_entry(uuid,integer,integer,integer,integer,integer,text,text) to authenticated;

grant select on public.offline_sync_receipts to authenticated;
grant select on public.rotating_asset_entry_audit to authenticated;

commit;

notify pgrst, 'reload schema';
