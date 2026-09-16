-- Disb Gestao v1.2.2 - Nota Fiscal e historico de paletes avariados
-- Execute uma unica vez no SQL Editor do Supabase depois do 15_v1_2_0.

begin;

alter table public.nri_damage_items
  add column if not exists invoice_number text;

comment on column public.nri_damage_items.invoice_number is
  'Numero da Nota Fiscal informado quando houver palete avariado. Nao e impresso na etiqueta NRI.';

create or replace function public.create_nri_request(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.profiles%rowtype;
  v_req uuid;
  v_item jsonb;
  v_count integer;
  v_i integer;
  v_rows jsonb;
  v_type text;
  v_driver text;
  v_plate text;
  v_factory text;
  v_unit text;
  v_receipt_date date;
  v_receipt_time time;
  v_validity date;
  v_pull_trip uuid;
  v_pull public.pull_trips%rowtype;
  v_market_id uuid;
  v_market public.marketplace_receipts%rowtype;
  v_damage_id uuid;
  v_damaged boolean;
  v_damaged_pallets integer;
  v_reason text;
  v_invoice_number text;
  v_photos jsonb;
  v_photo jsonb;
  v_photo_order integer;
begin
  if not public.has_role(array['ADMIN','COLABORADOR_ARMAZEM','CONFERENTE']::text[]) then raise exception 'FORBIDDEN'; end if;
  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  if v_profile.id is null then raise exception 'UNAUTHORIZED'; end if;

  v_type:=upper(coalesce(nullif(btrim(p_payload->>'request_type'),''),'AMBEV'));
  if v_type not in ('AMBEV','MARKETPLACE') then raise exception 'TIPO_NRI_INVALIDO'; end if;

  if coalesce(btrim(p_payload->>'pull_trip_id'),'')<>'' then
    v_pull_trip:=(p_payload->>'pull_trip_id')::uuid;
    select * into v_pull from public.pull_trips where id=v_pull_trip for update;
    if v_pull.id is null or v_pull.cycle_type<>'PULL' or v_pull.status<>'ARRIVED' or v_pull.nri_status<>'PENDING' then raise exception 'PUXADA_NAO_DISPONIVEL_PARA_NRI'; end if;
  end if;

  if coalesce(btrim(p_payload->>'marketplace_receipt_id'),'')<>'' then
    v_market_id:=(p_payload->>'marketplace_receipt_id')::uuid;
    select * into v_market from public.marketplace_receipts where id=v_market_id for update;
    if v_market.id is null or v_market.status<>'PENDING_NRI' or v_market.nri_status<>'PENDING' then raise exception 'MARKETPLACE_NAO_DISPONIVEL_PARA_NRI'; end if;
  end if;

  if v_pull_trip is not null and v_market_id is not null then raise exception 'FONTE_NRI_INVALIDA'; end if;

  if v_type='MARKETPLACE' then
    v_driver:='--';
    v_plate:='--';
    if v_market_id is not null then
      v_factory:=v_market.supplier_name;
      v_unit:=v_market.unit;
      v_receipt_date:=(v_market.ended_at at time zone 'America/Fortaleza')::date;
      v_receipt_time:=(v_market.ended_at at time zone 'America/Fortaleza')::time;
    else
      v_factory:=btrim(p_payload->>'factory');
      v_unit:=btrim(p_payload->>'unit');
      v_receipt_date:=(p_payload->>'receipt_date')::date;
      v_receipt_time:=(p_payload->>'receipt_time')::time;
      if coalesce(v_factory,'')='' then raise exception 'FORNECEDOR_MARKETPLACE_OBRIGATORIO'; end if;
    end if;
  else
    v_driver:=btrim(p_payload->>'driver');
    v_plate:=upper(btrim(p_payload->>'plate'));
    v_factory:=btrim(p_payload->>'factory');
    v_unit:=btrim(p_payload->>'unit');
    v_receipt_date:=(p_payload->>'receipt_date')::date;
    v_receipt_time:=(p_payload->>'receipt_time')::time;
    if coalesce(v_driver,'')='' or coalesce(v_plate,'')='' or coalesce(v_factory,'')='' then raise exception 'DADOS_TRANSPORTE_OBRIGATORIOS'; end if;
  end if;

  if coalesce(v_unit,'')='' or not exists(select 1 from public.units where name=v_unit and active=true) then raise exception 'UNIDADE_INVALIDA'; end if;

  insert into public.nri_requests(
    unit,request_type,receipt_date,checker_id,checker_name,receipt_time,driver,plate,factory,created_by,pull_trip_id,marketplace_receipt_id
  ) values(
    v_unit,v_type,v_receipt_date,auth.uid(),v_profile.name,v_receipt_time,
    v_driver,v_plate,v_factory,auth.uid(),v_pull_trip,v_market_id
  ) returning id into v_req;

  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'items','[]'::jsonb)) loop
    v_count:=greatest(1,coalesce((v_item->>'pallets')::integer,1));
    v_validity:=nullif(btrim(coalesce(v_item->>'validity_date','')),'')::date;
    v_damaged:=lower(coalesce(v_item->>'pallet_damaged','false')) in ('true','1','yes','sim');
    v_damaged_pallets:=coalesce(nullif(v_item->>'damaged_pallets','')::integer,0);
    v_reason:=btrim(coalesce(v_item->>'damage_reason',''));
    v_invoice_number:=btrim(coalesce(v_item->>'invoice_number',''));
    v_photos:=case when jsonb_typeof(v_item->'damage_photos')='array' then v_item->'damage_photos' else '[]'::jsonb end;

    if v_damaged then
      if v_damaged_pallets<1 or v_damaged_pallets>v_count then raise exception 'QTD_PALETE_AVARIADO_INVALIDA'; end if;
      if v_reason='' then raise exception 'MOTIVO_PALETE_AVARIADO_OBRIGATORIO'; end if;
      if v_invoice_number='' then raise exception 'NOTA_FISCAL_PALETE_AVARIADO_OBRIGATORIA'; end if;
      if jsonb_array_length(v_photos)<1 then raise exception 'FOTO_PALETE_AVARIADO_OBRIGATORIA'; end if;
      if jsonb_array_length(v_photos)>5 then raise exception 'MAXIMO_5_FOTOS_PALETE_AVARIADO'; end if;
    end if;

    for v_i in 1..v_count loop
      insert into public.nris(
        nri,request_id,product_code,product_name,unit,request_type,validity_date,lot,receipt_date,block_date,
        checker_name,receipt_time,driver,plate,factory,quantity,status,created_by,created_by_username,created_by_name
      ) values(
        null,v_req,btrim(v_item->>'product_code'),btrim(v_item->>'product_name'),v_unit,v_type,
        v_validity,upper(btrim(v_item->>'lot')),v_receipt_date,
        case when v_validity is null then null else (v_validity-30) end,
        v_profile.name,v_receipt_time,v_driver,v_plate,v_factory,
        greatest(0,(v_item->>'quantity')::integer),'PENDENTE',auth.uid(),v_profile.username,v_profile.name
      );
    end loop;

    if v_damaged then
      insert into public.nri_damage_items(
        request_id,product_code,product_name,lot,total_pallets,damaged_pallets,reason,invoice_number,created_by
      ) values(
        v_req,btrim(v_item->>'product_code'),btrim(v_item->>'product_name'),upper(btrim(v_item->>'lot')),
        v_count,v_damaged_pallets,v_reason,v_invoice_number,auth.uid()
      ) returning id into v_damage_id;

      v_photo_order:=0;
      for v_photo in select value from jsonb_array_elements(v_photos) loop
        v_photo_order:=v_photo_order+1;
        insert into public.nri_damage_photos(damage_item_id,photo_order,photo_path)
        values(v_damage_id,v_photo_order,btrim(v_photo->>'photo_path'));
      end loop;
    end if;
  end loop;

  if v_pull_trip is not null then
    update public.pull_trips set nri_status='COMPLETED' where id=v_pull_trip;
  end if;
  if v_market_id is not null then
    update public.marketplace_receipts set status='COMPLETED',nri_status='COMPLETED' where id=v_market_id;
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at,x.nri),'[]'::jsonb) into v_rows
  from public.nris x where x.request_id=v_req;

  return jsonb_build_object('request_id',v_req,'pull_trip_id',v_pull_trip,'marketplace_receipt_id',v_market_id,'nris',v_rows);
end;
$$;


grant execute on function public.create_nri_request(jsonb) to authenticated;

commit;

select column_name,is_nullable,data_type
from information_schema.columns
where table_schema='public' and table_name='nri_damage_items' and column_name='invoice_number';
