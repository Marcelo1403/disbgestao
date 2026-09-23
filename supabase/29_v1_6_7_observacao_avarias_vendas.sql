-- Disb Gestao v1.6.7
-- Observacao opcional EXCLUSIVAMENTE em Avarias de Vendas.
-- Executar manualmente no SQL Editor do Supabase.

begin;

alter table public.sales_damage_requests
  add column if not exists observation text not null default '';

alter table public.sales_damage_requests
  drop constraint if exists sales_damage_requests_observation_length_check;

alter table public.sales_damage_requests
  add constraint sales_damage_requests_observation_length_check
  check (char_length(observation) <= 500);

create or replace function public.create_sales_damage_request(p_payload jsonb)
returns public.sales_damage_requests
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.profiles%rowtype;
  v_customer public.customers%rowtype;
  v_req public.sales_damage_requests%rowtype;
  v_item_row public.sales_damage_items%rowtype;
  v_item jsonb;
  v_ph jsonb;
  v_photos jsonb;
  v_order integer:=0;
  v_photo_order integer;
  v_photo_count integer;
  v_reason text;
  v_validity date;
  v_first_path text;
  v_path text;
  v_lat double precision;
  v_lon double precision;
  v_accuracy double precision;
  v_gps_at timestamptz;
  v_unit text:=btrim(coalesce(p_payload->>'unit',''));
  v_observation text:=btrim(coalesce(p_payload->>'observation',''));
begin
  if not public.has_permission('SALES_DAMAGE_CREATE') then raise exception 'FORBIDDEN'; end if;

  select * into v_profile
  from public.profiles
  where id=auth.uid() and active=true;

  if v_profile.id is null then raise exception 'UNAUTHORIZED'; end if;

  perform public.assert_user_unit(v_unit);

  if char_length(v_observation) > 500 then
    raise exception 'OBSERVACAO_EXCEDIDA';
  end if;

  select * into v_customer
  from public.customers
  where id=nullif(btrim(coalesce(p_payload->>'customer_id','')),'')::uuid;

  if v_customer.id is null then raise exception 'PDV_INVALIDO'; end if;

  if jsonb_typeof(coalesce(p_payload->'items','[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_payload->'items','[]'::jsonb)) = 0 then
    raise exception 'PRODUTO_OBRIGATORIO';
  end if;

  insert into public.sales_damage_requests(
    request_code, occurrence_date, unit,
    seller_id, seller_username, seller_name,
    customer_id, customer_code, customer_name, city, branch,
    observation, status, created_by
  ) values(
    null, (timezone('America/Fortaleza',now()))::date, v_unit,
    auth.uid(), v_profile.username, v_profile.name,
    v_customer.id, v_customer.code, v_customer.name, v_customer.city, v_customer.branch,
    v_observation, 'PENDENTE', auth.uid()
  ) returning * into v_req;

  for v_item in select value from jsonb_array_elements(p_payload->'items') loop
    v_order:=v_order+1;
    v_reason:=upper(btrim(coalesce(v_item->>'reason','')));
    v_validity:=nullif(btrim(coalesce(v_item->>'validity_date','')),'')::date;
    v_photos:=coalesce(v_item->'photos','[]'::jsonb);

    if btrim(coalesce(v_item->>'product',''))='' then raise exception 'PRODUTO_OBRIGATORIO'; end if;
    if coalesce((v_item->>'quantity')::numeric,0)<=0 then raise exception 'QUANTIDADE_INVALIDA'; end if;
    if upper(btrim(coalesce(v_item->>'unit',''))) not in ('CAIXA','UNIDADE') then raise exception 'UNIDADE_INVALIDA'; end if;
    if v_reason='' then raise exception 'MOTIVO_OBRIGATORIO'; end if;
    if v_reason='VALIDADE' and v_validity is null then raise exception 'VALIDADE_OBRIGATORIA'; end if;
    if jsonb_typeof(v_photos)<>'array' then raise exception 'FOTO_OBRIGATORIA'; end if;

    v_photo_count:=jsonb_array_length(v_photos);
    if v_photo_count<1 then raise exception 'FOTO_OBRIGATORIA'; end if;
    if (v_reason='VALIDADE' and v_photo_count>2) or (v_reason<>'VALIDADE' and v_photo_count>1) then
      raise exception 'FOTOS_EXCEDIDAS';
    end if;

    v_first_path:=btrim(coalesce((v_photos->0)->>'photo_path',''));
    if v_first_path='' then raise exception 'FOTO_OBRIGATORIA'; end if;

    insert into public.sales_damage_items(
      request_id,item_order,product_text,quantity,quantity_unit,reason,validity_date,photo_path,status
    ) values(
      v_req.id,v_order,btrim(v_item->>'product'),(v_item->>'quantity')::numeric,
      upper(btrim(v_item->>'unit')),v_reason,v_validity,v_first_path,'PENDENTE'
    ) returning * into v_item_row;

    v_photo_order:=0;
    for v_ph in select value from jsonb_array_elements(v_photos) loop
      v_photo_order:=v_photo_order+1;
      v_path:=btrim(coalesce(v_ph->>'photo_path',''));
      if v_path='' then raise exception 'FOTO_OBRIGATORIA'; end if;

      begin
        v_lat:=nullif(btrim(coalesce(v_ph->>'latitude','')),'')::double precision;
        v_lon:=nullif(btrim(coalesce(v_ph->>'longitude','')),'')::double precision;
        v_accuracy:=nullif(btrim(coalesce(v_ph->>'accuracy','')),'')::double precision;
        v_gps_at:=nullif(btrim(coalesce(v_ph->>'gps_at','')),'')::timestamptz;
      exception when others then
        raise exception 'GPS_FOTO_OBRIGATORIO';
      end;

      if v_lat is null or v_lon is null or v_gps_at is null
         or v_lat not between -90 and 90 or v_lon not between -180 and 180 then
        raise exception 'GPS_FOTO_OBRIGATORIO';
      end if;

      insert into public.sales_damage_item_photos(
        item_id,photo_order,photo_path,latitude,longitude,accuracy,gps_at
      ) values(
        v_item_row.id,v_photo_order,v_path,v_lat,v_lon,v_accuracy,v_gps_at
      );
    end loop;
  end loop;

  return v_req;
end;
$$;

grant execute on function public.create_sales_damage_request(jsonb) to authenticated;

commit;

-- Conferencia rapida
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public'
  and table_name='sales_damage_requests'
  and column_name='observation';
