-- Gestao Operacional Disbecol - Supabase/PostgreSQL
-- NRI + Avarias + Conferencia de Vasilhames
-- Execute este arquivo no SQL Editor de um projeto Supabase novo.

create extension if not exists pgcrypto;

-- PERFIS / AUTENTICACAO -------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  name text not null,
  role text not null default 'CONFERENTE' check (role in ('ADMIN','COLABORADOR_ARMAZEM','COLABORADOR_ENTREGA','CONFERENTE')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_name text;
begin
  v_username := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(coalesce(new.email,''),'@',1)), E'\\s+', '.', 'g'));
  v_name := coalesce(nullif(new.raw_user_meta_data->>'name',''), initcap(replace(v_username,'.',' ')));
  insert into public.profiles(id,username,name,role,active)
  values(new.id,v_username,v_name,'CONFERENTE',true)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.active = true limit 1;
$$;

create or replace function public.has_role(allowed text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() = any(allowed), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.has_role(array['ADMIN']::text[]); $$;

-- BASES DE APOIO -------------------------------------------------------------
create table if not exists public.products (
  code text primary key,
  name text not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create table if not exists public.units (
  name text primary key,
  active boolean not null default true
);
create table if not exists public.shifts (
  name text primary key,
  active boolean not null default true
);
create table if not exists public.drivers (
  name text primary key,
  active boolean not null default true
);
create table if not exists public.factories (
  name text primary key,
  active boolean not null default true
);
create table if not exists public.customers (
  code text primary key,
  name text not null,
  city text not null default '',
  branch text not null default '',
  updated_at timestamptz not null default now()
);

-- NRI ------------------------------------------------------------------------
create sequence if not exists public.nri_number_seq start 1;

create table if not exists public.nri_requests (
  id uuid primary key default gen_random_uuid(),
  unit text not null,
  receipt_date date not null,
  checker_id uuid references auth.users(id),
  checker_name text not null,
  shift text not null,
  receipt_time time not null,
  driver text not null,
  plate text not null,
  factory text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.nris (
  id uuid primary key default gen_random_uuid(),
  nri text not null unique,
  request_id uuid references public.nri_requests(id) on delete set null,
  product_code text not null,
  product_name text not null,
  unit text not null,
  validity_date date not null,
  lot text not null,
  receipt_date date not null,
  block_date date not null,
  checker_name text not null,
  shift text not null,
  receipt_time time not null,
  driver text not null,
  plate text not null,
  factory text not null,
  quantity integer not null check (quantity >= 0),
  status text not null default 'PENDENTE' check (status in ('PENDENTE','IMPRESSO','REMOVIDO')),
  created_by uuid references auth.users(id),
  created_by_username text not null default '',
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  printed_at timestamptz,
  removed_at timestamptz
);

create or replace function public.assign_nri_number()
returns trigger language plpgsql as $$
begin
  if new.nri is null or btrim(new.nri) = '' then
    new.nri := 'NRI-' || lpad(nextval('public.nri_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_nri_number on public.nris;
create trigger trg_assign_nri_number before insert on public.nris
for each row execute function public.assign_nri_number();

create index if not exists idx_nris_status on public.nris(status);
create index if not exists idx_nris_lot on public.nris(upper(lot));
create index if not exists idx_nris_product on public.nris(product_code);
create index if not exists idx_nris_created_at on public.nris(created_at desc);

create table if not exists public.print_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null default 'IMPRESSAO',
  nri_ids uuid[] not null default '{}',
  nri_codes text[] not null default '{}',
  result text not null,
  copies integer,
  user_id uuid references auth.users(id),
  username text not null default '',
  user_name text not null default '',
  observation text not null default ''
);

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
begin
  if not public.has_role(array['ADMIN','COLABORADOR_ARMAZEM']::text[]) then
    raise exception 'FORBIDDEN';
  end if;
  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  if v_profile.id is null then raise exception 'UNAUTHORIZED'; end if;

  insert into public.nri_requests(unit,receipt_date,checker_id,checker_name,shift,receipt_time,driver,plate,factory,created_by)
  values(
    btrim(p_payload->>'unit'),
    (p_payload->>'receipt_date')::date,
    auth.uid(), v_profile.name,
    btrim(p_payload->>'shift'),
    (p_payload->>'receipt_time')::time,
    btrim(p_payload->>'driver'), upper(btrim(p_payload->>'plate')), btrim(p_payload->>'factory'), auth.uid()
  ) returning id into v_req;

  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'items','[]'::jsonb)) loop
    v_count := greatest(1, coalesce((v_item->>'pallets')::integer,1));
    for v_i in 1..v_count loop
      insert into public.nris(
        nri,request_id,product_code,product_name,unit,validity_date,lot,receipt_date,block_date,
        checker_name,shift,receipt_time,driver,plate,factory,quantity,status,created_by,created_by_username,created_by_name
      ) values(
        null,v_req,btrim(v_item->>'product_code'),btrim(v_item->>'product_name'),btrim(p_payload->>'unit'),
        (v_item->>'validity_date')::date,upper(btrim(v_item->>'lot')),(p_payload->>'receipt_date')::date,
        ((v_item->>'validity_date')::date - 30),v_profile.name,btrim(p_payload->>'shift'),(p_payload->>'receipt_time')::time,
        btrim(p_payload->>'driver'),upper(btrim(p_payload->>'plate')),btrim(p_payload->>'factory'),
        greatest(0,(v_item->>'quantity')::integer),'PENDENTE',auth.uid(),v_profile.username,v_profile.name
      );
    end loop;
  end loop;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at,x.nri),'[]'::jsonb)
    into v_rows
  from public.nris x where x.request_id=v_req;

  return jsonb_build_object('request_id',v_req,'nris',v_rows);
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
  if not public.has_role(array['ADMIN','COLABORADOR_ARMAZEM']::text[]) then raise exception 'FORBIDDEN'; end if;
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
  if not public.has_role(array['ADMIN','COLABORADOR_ARMAZEM']::text[]) then raise exception 'FORBIDDEN'; end if;
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
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select coalesce(max(nullif(regexp_replace(nri,E'\\D','','g'),'')::bigint),0) into v_max from public.nris;
  if v_max > 0 then
    perform setval('public.nri_number_seq', v_max, true);
  else
    perform setval('public.nri_number_seq', 1, false);
  end if;
  return v_max;
end;
$$;

-- AVARIAS --------------------------------------------------------------------
create table if not exists public.damage_requests (
  id uuid primary key default gen_random_uuid(),
  occurrence_date date not null,
  delivery_user_id uuid references auth.users(id),
  delivery_username text not null,
  delivery_name text not null,
  customer_code text not null,
  customer_name text not null,
  city text not null,
  map_number text not null,
  signature_path text not null,
  status text not null default 'PENDENTE' check (status in ('PENDENTE','PARCIAL','APROVADO','REPROVADO')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  last_review_at timestamptz
);

create table if not exists public.damage_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.damage_requests(id) on delete cascade,
  item_order integer not null,
  product_text text not null,
  lot text not null,
  quantity numeric not null check (quantity >= 0),
  quantity_unit text not null check (quantity_unit in ('UNIDADE','CAIXA')),
  reason text not null,
  photo_path text not null,
  latitude double precision not null,
  longitude double precision not null,
  gps_accuracy double precision,
  gps_captured_at timestamptz,
  status text not null default 'PENDENTE' check (status in ('PENDENTE','APROVADO','REPROVADO')),
  reviewer_id uuid references auth.users(id),
  reviewer_name text,
  reviewed_at timestamptz,
  review_note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_damage_items_lot on public.damage_items(upper(lot));
create index if not exists idx_damage_requests_status on public.damage_requests(status);

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
  v_order integer := 0;
begin
  if not public.has_role(array['ADMIN','COLABORADOR_ENTREGA']::text[]) then raise exception 'FORBIDDEN'; end if;
  select * into v_profile from public.profiles where id=auth.uid() and active=true;

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
    insert into public.damage_items(
      request_id,item_order,product_text,lot,quantity,quantity_unit,reason,photo_path,latitude,longitude,gps_accuracy,gps_captured_at
    ) values(
      v_req,v_order,btrim(v_item->>'product'),upper(btrim(v_item->>'lot')),(v_item->>'quantity')::numeric,
      upper(v_item->>'unit'),btrim(v_item->>'reason'),btrim(v_item->>'photo_path'),
      (v_item->>'latitude')::double precision,(v_item->>'longitude')::double precision,
      nullif(v_item->>'accuracy','')::double precision,nullif(v_item->>'gps_at','')::timestamptz
    );
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
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
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

-- CONFERENCIA DE VASILHAMES --------------------------------------------------
create table if not exists public.container_conferences (
  id uuid primary key default gen_random_uuid(),
  conference_date date not null,
  conference_time time not null,
  checker_id uuid references auth.users(id),
  checker_username text not null,
  checker_name text not null,
  map_number text not null,
  g300 integer not null default 0,
  g600_green integer not null default 0,
  g600_brown integer not null default 0,
  g_litrao integer not null default 0,
  keg30 integer not null default 0,
  keg50 integer not null default 0,
  created_at timestamptz not null default now(),
  unique(map_number,conference_date)
);

create table if not exists public.maps (
  id uuid primary key default gen_random_uuid(),
  map_number text not null,
  map_date date not null,
  city text not null default '',
  driver text not null default '',
  helper1 text not null default '',
  helper2 text not null default '',
  g300 integer not null default 0,
  g600_green integer not null default 0,
  g600_brown integer not null default 0,
  g_litrao integer not null default 0,
  keg30 integer not null default 0,
  keg50 integer not null default 0,
  updated_at timestamptz not null default now(),
  unique(map_number,map_date)
);
create index if not exists idx_maps_date on public.maps(map_date desc);
create index if not exists idx_conferences_date on public.container_conferences(conference_date desc);

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
  if not public.has_role(array['ADMIN','CONFERENTE']::text[]) then raise exception 'FORBIDDEN'; end if;
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

-- ROW LEVEL SECURITY ----------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.units enable row level security;
alter table public.shifts enable row level security;
alter table public.drivers enable row level security;
alter table public.factories enable row level security;
alter table public.customers enable row level security;
alter table public.nri_requests enable row level security;
alter table public.nris enable row level security;
alter table public.print_events enable row level security;
alter table public.damage_requests enable row level security;
alter table public.damage_items enable row level security;
alter table public.container_conferences enable row level security;
alter table public.maps enable row level security;

-- Permite executar novamente o script sem conflito de nomes de políticas.
drop policy if exists "profile_self_or_admin_select" on public.profiles;
drop policy if exists "profile_admin_update" on public.profiles;
drop policy if exists "products_read" on public.products;
drop policy if exists "products_admin_all" on public.products;
drop policy if exists "units_read" on public.units;
drop policy if exists "units_admin_all" on public.units;
drop policy if exists "shifts_read" on public.shifts;
drop policy if exists "shifts_admin_all" on public.shifts;
drop policy if exists "drivers_read" on public.drivers;
drop policy if exists "drivers_admin_all" on public.drivers;
drop policy if exists "factories_read" on public.factories;
drop policy if exists "factories_admin_all" on public.factories;
drop policy if exists "customers_read" on public.customers;
drop policy if exists "customers_admin_all" on public.customers;
drop policy if exists "nri_requests_read" on public.nri_requests;
drop policy if exists "nris_read" on public.nris;
drop policy if exists "nris_admin_insert_migration" on public.nris;
drop policy if exists "nris_nri_roles_update" on public.nris;
drop policy if exists "print_events_admin_read" on public.print_events;
drop policy if exists "damage_requests_read" on public.damage_requests;
drop policy if exists "damage_items_read" on public.damage_items;
drop policy if exists "conference_read" on public.container_conferences;
drop policy if exists "conference_admin_insert_migration" on public.container_conferences;
drop policy if exists "maps_admin_read" on public.maps;
drop policy if exists "maps_admin_all" on public.maps;

-- Perfis
create policy "profile_self_or_admin_select" on public.profiles for select to authenticated
using (id=auth.uid() or public.is_admin());
create policy "profile_admin_update" on public.profiles for update to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Bases: todos autenticados consultam; apenas Admin altera
create policy "products_read" on public.products for select to authenticated using (true);
create policy "products_admin_all" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "units_read" on public.units for select to authenticated using (true);
create policy "units_admin_all" on public.units for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "shifts_read" on public.shifts for select to authenticated using (true);
create policy "shifts_admin_all" on public.shifts for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "drivers_read" on public.drivers for select to authenticated using (true);
create policy "drivers_admin_all" on public.drivers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "factories_read" on public.factories for select to authenticated using (true);
create policy "factories_admin_all" on public.factories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "customers_read" on public.customers for select to authenticated using (true);
create policy "customers_admin_all" on public.customers for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- NRI
create policy "nri_requests_read" on public.nri_requests for select to authenticated
using (public.has_role(array['ADMIN','COLABORADOR_ARMAZEM']::text[]));
create policy "nris_read" on public.nris for select to authenticated
using (public.has_role(array['ADMIN','COLABORADOR_ARMAZEM']::text[]));
create policy "nris_admin_insert_migration" on public.nris for insert to authenticated
with check (public.is_admin());
create policy "nris_nri_roles_update" on public.nris for update to authenticated
using (public.has_role(array['ADMIN','COLABORADOR_ARMAZEM']::text[]))
with check (public.has_role(array['ADMIN','COLABORADOR_ARMAZEM']::text[]));
create policy "print_events_admin_read" on public.print_events for select to authenticated using (public.is_admin());

-- Avarias
create policy "damage_requests_read" on public.damage_requests for select to authenticated
using (public.is_admin() or created_by=auth.uid());
create policy "damage_items_read" on public.damage_items for select to authenticated
using (public.is_admin() or exists(select 1 from public.damage_requests r where r.id=request_id and r.created_by=auth.uid()));

-- Conferencias
create policy "conference_read" on public.container_conferences for select to authenticated
using (public.is_admin() or checker_id=auth.uid());
create policy "conference_admin_insert_migration" on public.container_conferences for insert to authenticated
with check (public.is_admin());
create policy "maps_admin_read" on public.maps for select to authenticated using (public.is_admin());
create policy "maps_admin_all" on public.maps for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Grants. RLS continua controlando as linhas.
grant usage on schema public to authenticated;
grant select,insert,update,delete on public.profiles,public.products,public.units,public.shifts,public.drivers,public.factories,public.customers,
  public.nri_requests,public.nris,public.print_events,public.damage_requests,public.damage_items,public.container_conferences,public.maps to authenticated;
grant execute on function public.current_role() to authenticated;
grant execute on function public.has_role(text[]) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.create_nri_request(jsonb) to authenticated;
grant execute on function public.confirm_nri_print(uuid[],boolean,text) to authenticated;
grant execute on function public.remove_nris(uuid[]) to authenticated;
grant execute on function public.sync_nri_sequence() to authenticated;
grant execute on function public.create_damage_request(jsonb) to authenticated;
grant execute on function public.review_damage_items(uuid[],text,text) to authenticated;
grant execute on function public.create_container_conference(text,integer,integer,integer,integer,integer,integer) to authenticated;

-- STORAGE DE AVARIAS ---------------------------------------------------------
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('avarias','avarias',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=10485760;

drop policy if exists "avarias_upload_own_folder" on storage.objects;
drop policy if exists "avarias_read_own_or_admin" on storage.objects;
drop policy if exists "avarias_update_own_or_admin" on storage.objects;
drop policy if exists "avarias_delete_own_or_admin" on storage.objects;

create policy "avarias_upload_own_folder" on storage.objects for insert to authenticated
with check (bucket_id='avarias' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "avarias_read_own_or_admin" on storage.objects for select to authenticated
using (bucket_id='avarias' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));
create policy "avarias_update_own_or_admin" on storage.objects for update to authenticated
using (bucket_id='avarias' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));
create policy "avarias_delete_own_or_admin" on storage.objects for delete to authenticated
using (bucket_id='avarias' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));

-- REALTIME -------------------------------------------------------------------
do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='nris') then
    execute 'alter publication supabase_realtime add table public.nris';
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='damage_requests') then
    execute 'alter publication supabase_realtime add table public.damage_requests';
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='damage_items') then
    execute 'alter publication supabase_realtime add table public.damage_items';
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='container_conferences') then
    execute 'alter publication supabase_realtime add table public.container_conferences';
  end if;
end $$;

-- IMPORTACAO: depois de importar NRIs antigos, execute SELECT public.sync_nri_sequence();
