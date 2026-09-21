-- Disb Gestao v1.5.1
-- Ativo de Giro: separacao por local (PATIO / REFUGO)
-- Mantem todos os lancamentos antigos como PATIO.

begin;

alter table public.rotating_asset_entries
  add column if not exists location text;

update public.rotating_asset_entries
set location = 'PATIO'
where location is null or btrim(location) = '';

alter table public.rotating_asset_entries
  alter column location set default 'PATIO';

alter table public.rotating_asset_entries
  alter column location set not null;

alter table public.rotating_asset_entries
  drop constraint if exists rotating_asset_entries_location_check;

alter table public.rotating_asset_entries
  add constraint rotating_asset_entries_location_check
  check (location in ('PATIO','REFUGO'));

create index if not exists idx_rotating_asset_entries_count_location
  on public.rotating_asset_entries(count_id, location, product_id, created_at);

-- Remove a assinatura antiga e qualquer tentativa anterior desta atualizacao.
drop function if exists public.add_rotating_asset_entry(uuid,uuid,integer,integer,integer,integer,integer);
drop function if exists public.add_rotating_asset_entry(uuid,uuid,integer,integer,integer,integer,integer,text);

create function public.add_rotating_asset_entry(
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

  select * into v_profile
  from public.profiles
  where id=auth.uid() and active=true;

  if v_profile.id is null then raise exception 'UNAUTHORIZED'; end if;

  if v_location not in ('PATIO','REFUGO') then
    raise exception 'ATIVO_GIRO_LOCAL_INVALIDO';
  end if;

  select * into v_count
  from public.rotating_asset_counts
  where id=p_count_id
  for update;

  if v_count.id is null then raise exception 'ATIVO_GIRO_CONTAGEM_NAO_ENCONTRADA'; end if;
  if v_count.status<>'IN_PROGRESS' then raise exception 'ATIVO_GIRO_CONTAGEM_FINALIZADA'; end if;
  if not public.is_admin() and v_count.counter_id<>auth.uid() then raise exception 'FORBIDDEN'; end if;

  select * into v_product
  from public.rotating_asset_products
  where id=p_product_id and active=true;

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

grant execute on function public.add_rotating_asset_entry(uuid,uuid,integer,integer,integer,integer,integer,text) to authenticated;

commit;

notify pgrst, 'reload schema';
