-- Disb Gestao v1.3.0 - Modulo Contagem FEFO
-- Base funcional adaptada do DisbStock V1.6 para a arquitetura Supabase do Disb Gestao.
-- Execute uma unica vez no SQL Editor do Supabase depois do script 16_v1_2_2.

begin;

-- ---------------------------------------------------------------------------
-- CONTAGENS FEFO
-- ---------------------------------------------------------------------------
create sequence if not exists public.fefo_count_number_seq start 1;

create table if not exists public.fefo_counts (
  id uuid primary key default gen_random_uuid(),
  count_code text unique,
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

create table if not exists public.fefo_count_items (
  id uuid primary key default gen_random_uuid(),
  count_id uuid not null references public.fefo_counts(id) on delete cascade,
  product_code text not null,
  product_name text not null,
  validity_date date not null,
  street text not null default '',
  pallet integer not null default 0 check (pallet >= 0),
  layer integer not null default 0 check (layer >= 0),
  box integer not null default 0 check (box >= 0),
  loose_unit integer not null default 0 check (loose_unit >= 0),
  created_by uuid not null references auth.users(id),
  created_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_fefo_counts_status on public.fefo_counts(status, started_at desc);
create index if not exists idx_fefo_counts_counter on public.fefo_counts(counter_id, started_at desc);
create index if not exists idx_fefo_counts_unit on public.fefo_counts(unit, started_at desc);
create index if not exists idx_fefo_items_count on public.fefo_count_items(count_id, validity_date, product_code);
create index if not exists idx_fefo_items_product on public.fefo_count_items(product_code, validity_date);

create or replace function public.assign_fefo_count_code()
returns trigger language plpgsql as $$
begin
  if new.count_code is null or btrim(new.count_code)='' then
    new.count_code := 'FEFO-' || lpad(nextval('public.fefo_count_number_seq')::text,6,'0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_fefo_count_code on public.fefo_counts;
create trigger trg_assign_fefo_count_code
before insert on public.fefo_counts
for each row execute function public.assign_fefo_count_code();

drop trigger if exists trg_fefo_counts_updated on public.fefo_counts;
create trigger trg_fefo_counts_updated
before update on public.fefo_counts
for each row execute function public.touch_updated_at();

drop trigger if exists trg_fefo_items_updated on public.fefo_count_items;
create trigger trg_fefo_items_updated
before update on public.fefo_count_items
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RPC - INICIAR CONTAGEM
-- Mantem o comportamento de uma contagem ativa por usuario.
-- ---------------------------------------------------------------------------
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
  if not public.has_role(array['ADMIN','COLABORADOR_ARMAZEM','CONFERENTE']::text[]) then
    raise exception 'FORBIDDEN';
  end if;

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

-- ---------------------------------------------------------------------------
-- RPC - SALVAR / ATUALIZAR ITEM
-- Campos equivalentes ao DisbStock V1.6:
-- codigo, nome, validade, rua, palete, lastro, caixa e unidade.
-- ---------------------------------------------------------------------------
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
  if not public.has_role(array['ADMIN','COLABORADOR_ARMAZEM','CONFERENTE']::text[]) then
    raise exception 'FORBIDDEN';
  end if;

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
  if not public.has_role(array['ADMIN','COLABORADOR_ARMAZEM','CONFERENTE']::text[]) then raise exception 'FORBIDDEN'; end if;

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
  if not public.has_role(array['ADMIN','COLABORADOR_ARMAZEM','CONFERENTE']::text[]) then raise exception 'FORBIDDEN'; end if;

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
  if not public.has_role(array['ADMIN','COLABORADOR_ARMAZEM','CONFERENTE']::text[]) then raise exception 'FORBIDDEN'; end if;

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
-- RLS
-- ---------------------------------------------------------------------------
alter table public.fefo_counts enable row level security;
alter table public.fefo_count_items enable row level security;

drop policy if exists fefo_counts_read on public.fefo_counts;
drop policy if exists fefo_items_read on public.fefo_count_items;

create policy fefo_counts_read on public.fefo_counts
for select to authenticated
using (
  public.has_role(array['ADMIN','COLABORADOR_ARMAZEM','CONFERENTE']::text[])
  and (public.is_admin() or counter_id=auth.uid())
);

create policy fefo_items_read on public.fefo_count_items
for select to authenticated
using (
  public.has_role(array['ADMIN','COLABORADOR_ARMAZEM','CONFERENTE']::text[])
  and exists(
    select 1 from public.fefo_counts c
    where c.id=count_id and (public.is_admin() or c.counter_id=auth.uid())
  )
);

-- Escrita operacional somente pelas RPCs security definer.
grant select on public.fefo_counts,public.fefo_count_items to authenticated;
grant usage,select on sequence public.fefo_count_number_seq to authenticated;
grant execute on function public.start_fefo_count(text) to authenticated;
grant execute on function public.save_fefo_item(uuid,text,date,text,integer,integer,integer,integer,uuid) to authenticated;
grant execute on function public.delete_fefo_item(uuid) to authenticated;
grant execute on function public.finish_fefo_count(uuid) to authenticated;
grant execute on function public.cancel_fefo_count(uuid) to authenticated;

-- Realtime para atualizar listas de contagens em andamento e relatorios.
do $$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='fefo_counts'
  ) then
    execute 'alter publication supabase_realtime add table public.fefo_counts';
  end if;

  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='fefo_count_items'
  ) then
    execute 'alter publication supabase_realtime add table public.fefo_count_items';
  end if;
end $$;

commit;

-- Conferencia rapida apos executar:
select table_name
from information_schema.tables
where table_schema='public' and table_name in ('fefo_counts','fefo_count_items')
order by table_name;
