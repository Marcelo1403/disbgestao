-- Disb Gestao v1.5.0 - Modulo Ativo de Giro
-- Execute uma unica vez no SQL Editor do Supabase depois do SQL 19 da v1.4.1.

begin;

-- ---------------------------------------------------------------------------
-- PERMISSOES
-- ---------------------------------------------------------------------------
insert into public.permissions(code,module,name,description,sort_order) values
  ('ROTATING_ASSET_CREATE','Ativo de Giro','Nova contagem','Iniciar, alimentar, corrigir e finalizar contagens de Ativo de Giro.',10),
  ('ROTATING_ASSET_HISTORY','Ativo de Giro','Historico','Consultar contagens finalizadas e seus totais consolidados.',20)
on conflict(code) do update set
  module=excluded.module,
  name=excluded.name,
  description=excluded.description,
  sort_order=excluded.sort_order,
  active=true;

insert into public.role_permissions(role,permission_code) values
  ('COLABORADOR_ARMAZEM','ROTATING_ASSET_CREATE'),
  ('COLABORADOR_ARMAZEM','ROTATING_ASSET_HISTORY'),
  ('CONFERENTE','ROTATING_ASSET_CREATE'),
  ('CONFERENTE','ROTATING_ASSET_HISTORY')
on conflict do nothing;

insert into public.role_permissions(role,permission_code)
select 'ADMIN',code from public.permissions where code in ('ROTATING_ASSET_CREATE','ROTATING_ASSET_HISTORY')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- CADASTRO FIXO DE ATIVOS
-- ---------------------------------------------------------------------------
create table if not exists public.rotating_asset_products (
  id uuid primary key default gen_random_uuid(),
  sap_code text,
  asset_code text,
  description text not null unique,
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_rotating_asset_products_updated on public.rotating_asset_products;
create trigger trg_rotating_asset_products_updated before update on public.rotating_asset_products
for each row execute function public.touch_updated_at();

insert into public.rotating_asset_products(sap_code,asset_code,description,sort_order,active) values
  ('27983','30491','CERVEJA 600ML',10,true),
  ('786238','30491','GFA VERDE 600ML',20,true),
  ('28741','296156','CERVEJA 300ML',30,true),
  ('188006','188005','CERVEJA 1 LITRO',40,true),
  ('235894','188005','GUARANA 1 LITRO',50,true),
  ('29043','188005','PEPSI 1 LITRO',60,true),
  ('103322','103332','GUARANA 290ML',70,true),
  ('103326','103332','SODA 290ML',80,true),
  (null,'37108','CHAPATEX (UND)',90,true),
  (null,'42069','PBR2 (UND)',100,true),
  (null,'104195','PBR1 (UND)',110,true),
  (null,null,'BARRIL 30L (UND)',120,true),
  (null,null,'BARRIL 50L (UND)',130,true)
on conflict(description) do update set
  sap_code=excluded.sap_code,
  asset_code=excluded.asset_code,
  sort_order=excluded.sort_order,
  active=true;

-- ---------------------------------------------------------------------------
-- CONTAGENS E LANCAMENTOS
-- Cada clique em "Adicionar a contagem" gera um lancamento proprio.
-- Os totais sao calculados pela soma de todos os lancamentos do mesmo produto.
-- ---------------------------------------------------------------------------
create sequence if not exists public.rotating_asset_count_number_seq start 1;

create table if not exists public.rotating_asset_counts (
  id uuid primary key default gen_random_uuid(),
  count_code text unique,
  count_date date not null,
  unit text not null references public.units(name) on update cascade,
  counter_id uuid not null references auth.users(id),
  counter_username text not null default '',
  counter_name text not null,
  status text not null default 'IN_PROGRESS'
    check (status in ('IN_PROGRESS','COMPLETED','CANCELLED')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rotating_asset_entries (
  id uuid primary key default gen_random_uuid(),
  count_id uuid not null references public.rotating_asset_counts(id) on delete cascade,
  product_id uuid not null references public.rotating_asset_products(id),
  sap_code text,
  asset_code text,
  product_description text not null,
  pallet_gfa integer not null default 0 check (pallet_gfa >= 0),
  layer_gfa integer not null default 0 check (layer_gfa >= 0),
  box_gfa integer not null default 0 check (box_gfa >= 0),
  loose integer not null default 0 check (loose >= 0),
  units integer not null default 0 check (units >= 0),
  created_by uuid not null references auth.users(id),
  created_by_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rotating_asset_counts_status
  on public.rotating_asset_counts(status, count_date desc, started_at desc);
create index if not exists idx_rotating_asset_counts_unit
  on public.rotating_asset_counts(unit, count_date desc);
create index if not exists idx_rotating_asset_entries_count
  on public.rotating_asset_entries(count_id, product_id, created_at);
create index if not exists idx_rotating_asset_entries_product
  on public.rotating_asset_entries(product_id, created_at desc);
create unique index if not exists idx_rotating_asset_one_active_per_counter
  on public.rotating_asset_counts(counter_id) where status='IN_PROGRESS';

drop trigger if exists trg_rotating_asset_counts_updated on public.rotating_asset_counts;
create trigger trg_rotating_asset_counts_updated before update on public.rotating_asset_counts
for each row execute function public.touch_updated_at();

create or replace function public.assign_rotating_asset_count_code()
returns trigger language plpgsql as $$
begin
  if new.count_code is null or btrim(new.count_code)='' then
    new.count_code := 'AG-' || lpad(nextval('public.rotating_asset_count_number_seq')::text,6,'0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_rotating_asset_count_code on public.rotating_asset_counts;
create trigger trg_assign_rotating_asset_count_code
before insert on public.rotating_asset_counts
for each row execute function public.assign_rotating_asset_count_code();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create or replace function public.start_rotating_asset_count(p_unit text,p_count_date date default null)
returns public.rotating_asset_counts
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.profiles%rowtype;
  v_row public.rotating_asset_counts%rowtype;
  v_unit text:=btrim(coalesce(p_unit,''));
  v_date date:=coalesce(p_count_date,(now() at time zone 'America/Fortaleza')::date);
begin
  if not public.has_permission('ROTATING_ASSET_CREATE') then raise exception 'FORBIDDEN'; end if;
  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  if v_profile.id is null then raise exception 'UNAUTHORIZED'; end if;
  if v_unit='' or not exists(select 1 from public.units where name=v_unit and active=true) then raise exception 'UNIDADE_INVALIDA'; end if;

  select * into v_row from public.rotating_asset_counts
  where counter_id=auth.uid() and status='IN_PROGRESS'
  order by started_at desc limit 1;
  if v_row.id is not null then return v_row; end if;

  insert into public.rotating_asset_counts(count_date,unit,counter_id,counter_username,counter_name,status)
  values(v_date,v_unit,auth.uid(),v_profile.username,v_profile.name,'IN_PROGRESS')
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.add_rotating_asset_entry(
  p_count_id uuid,
  p_product_id uuid,
  p_pallet_gfa integer default 0,
  p_layer_gfa integer default 0,
  p_box_gfa integer default 0,
  p_loose integer default 0,
  p_units integer default 0
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
begin
  if not public.has_permission('ROTATING_ASSET_CREATE') then raise exception 'FORBIDDEN'; end if;
  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  if v_profile.id is null then raise exception 'UNAUTHORIZED'; end if;

  select * into v_count from public.rotating_asset_counts where id=p_count_id for update;
  if v_count.id is null then raise exception 'ATIVO_GIRO_CONTAGEM_NAO_ENCONTRADA'; end if;
  if v_count.status<>'IN_PROGRESS' then raise exception 'ATIVO_GIRO_CONTAGEM_FINALIZADA'; end if;
  if not public.is_admin() and v_count.counter_id<>auth.uid() then raise exception 'FORBIDDEN'; end if;

  select * into v_product from public.rotating_asset_products where id=p_product_id and active=true;
  if v_product.id is null then raise exception 'ATIVO_GIRO_PRODUTO_INVALIDO'; end if;
  if v_pallet+v_layer+v_box+v_loose+v_units<=0 then raise exception 'ATIVO_GIRO_QUANTIDADE_OBRIGATORIA'; end if;

  insert into public.rotating_asset_entries(
    count_id,product_id,sap_code,asset_code,product_description,
    pallet_gfa,layer_gfa,box_gfa,loose,units,created_by,created_by_name
  ) values(
    v_count.id,v_product.id,v_product.sap_code,v_product.asset_code,v_product.description,
    v_pallet,v_layer,v_box,v_loose,v_units,auth.uid(),v_profile.name
  ) returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.delete_rotating_asset_entry(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_entry public.rotating_asset_entries%rowtype;
  v_count public.rotating_asset_counts%rowtype;
begin
  if not public.has_permission('ROTATING_ASSET_CREATE') then raise exception 'FORBIDDEN'; end if;
  select * into v_entry from public.rotating_asset_entries where id=p_entry_id;
  if v_entry.id is null then raise exception 'ATIVO_GIRO_LANCAMENTO_NAO_ENCONTRADO'; end if;
  select * into v_count from public.rotating_asset_counts where id=v_entry.count_id for update;
  if v_count.status<>'IN_PROGRESS' then raise exception 'ATIVO_GIRO_CONTAGEM_FINALIZADA'; end if;
  if not public.is_admin() and v_count.counter_id<>auth.uid() then raise exception 'FORBIDDEN'; end if;
  delete from public.rotating_asset_entries where id=v_entry.id;
end;
$$;

create or replace function public.finish_rotating_asset_count(p_count_id uuid)
returns public.rotating_asset_counts
language plpgsql
security definer
set search_path=public
as $$
declare v_row public.rotating_asset_counts%rowtype;
begin
  if not public.has_permission('ROTATING_ASSET_CREATE') then raise exception 'FORBIDDEN'; end if;
  select * into v_row from public.rotating_asset_counts where id=p_count_id for update;
  if v_row.id is null then raise exception 'ATIVO_GIRO_CONTAGEM_NAO_ENCONTRADA'; end if;
  if v_row.status<>'IN_PROGRESS' then raise exception 'ATIVO_GIRO_CONTAGEM_FINALIZADA'; end if;
  if not public.is_admin() and v_row.counter_id<>auth.uid() then raise exception 'FORBIDDEN'; end if;
  if not exists(select 1 from public.rotating_asset_entries where count_id=v_row.id) then raise exception 'ATIVO_GIRO_CONTAGEM_SEM_LANCAMENTOS'; end if;
  update public.rotating_asset_counts set status='COMPLETED',completed_at=now() where id=v_row.id returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.cancel_rotating_asset_count(p_count_id uuid)
returns public.rotating_asset_counts
language plpgsql
security definer
set search_path=public
as $$
declare v_row public.rotating_asset_counts%rowtype;
begin
  if not public.has_permission('ROTATING_ASSET_CREATE') then raise exception 'FORBIDDEN'; end if;
  select * into v_row from public.rotating_asset_counts where id=p_count_id for update;
  if v_row.id is null then raise exception 'ATIVO_GIRO_CONTAGEM_NAO_ENCONTRADA'; end if;
  if v_row.status<>'IN_PROGRESS' then raise exception 'ATIVO_GIRO_CONTAGEM_FINALIZADA'; end if;
  if not public.is_admin() and v_row.counter_id<>auth.uid() then raise exception 'FORBIDDEN'; end if;
  update public.rotating_asset_counts set status='CANCELLED',cancelled_at=now() where id=v_row.id returning * into v_row;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS - leitura autorizada; gravacao somente pelas RPCs acima.
-- ---------------------------------------------------------------------------
alter table public.rotating_asset_products enable row level security;
alter table public.rotating_asset_counts enable row level security;
alter table public.rotating_asset_entries enable row level security;

drop policy if exists rotating_asset_products_read on public.rotating_asset_products;
create policy rotating_asset_products_read on public.rotating_asset_products for select to authenticated
using (public.has_permission('ROTATING_ASSET_CREATE') or public.has_permission('ROTATING_ASSET_HISTORY'));

drop policy if exists rotating_asset_counts_read on public.rotating_asset_counts;
create policy rotating_asset_counts_read on public.rotating_asset_counts for select to authenticated
using (
  public.has_permission('ROTATING_ASSET_HISTORY')
  or (public.has_permission('ROTATING_ASSET_CREATE') and counter_id=auth.uid())
);

drop policy if exists rotating_asset_entries_read on public.rotating_asset_entries;
create policy rotating_asset_entries_read on public.rotating_asset_entries for select to authenticated
using (
  public.has_permission('ROTATING_ASSET_HISTORY')
  or (
    public.has_permission('ROTATING_ASSET_CREATE') and exists(
      select 1 from public.rotating_asset_counts c
      where c.id=count_id and c.counter_id=auth.uid()
    )
  )
);

grant select on public.rotating_asset_products,public.rotating_asset_counts,public.rotating_asset_entries to authenticated;
grant execute on function public.start_rotating_asset_count(text,date) to authenticated;
grant execute on function public.add_rotating_asset_entry(uuid,uuid,integer,integer,integer,integer,integer) to authenticated;
grant execute on function public.delete_rotating_asset_entry(uuid) to authenticated;
grant execute on function public.finish_rotating_asset_count(uuid) to authenticated;
grant execute on function public.cancel_rotating_asset_count(uuid) to authenticated;

commit;
