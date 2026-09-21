-- Disb Gestao v1.5.1 - FEFO sem lote na tela de contagem
-- Mantem a coluna lot para preservar historico, mas deixa de exigir lote em novos registros/edicoes FEFO.

begin;

create or replace function public.save_fefo_item(
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
  v_lot text:=upper(btrim(coalesce(p_lot,'')));
begin
  if not public.has_permission('FEFO_CREATE') then raise exception 'FORBIDDEN'; end if;

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
      count_id,product_code,product_name,validity_date,lot,street,pallet,layer,box,loose_unit,
      created_by,created_by_name
    ) values(
      v_count.id,v_product.code,v_product.name,p_validity_date,v_lot,btrim(coalesce(p_street,'')),
      greatest(0,coalesce(p_pallet,0)),greatest(0,coalesce(p_layer,0)),
      greatest(0,coalesce(p_box,0)),greatest(0,coalesce(p_loose_unit,0)),
      auth.uid(),v_profile.name
    ) returning * into v_row;
  else
    update public.fefo_count_items
       set product_code=v_product.code,
           product_name=v_product.name,
           validity_date=p_validity_date,
           lot=v_lot,
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

grant execute on function public.save_fefo_item(uuid,text,date,text,text,integer,integer,integer,integer,uuid) to authenticated;

commit;

notify pgrst, 'reload schema';
