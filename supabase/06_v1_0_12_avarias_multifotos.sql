-- Disb Gestao v1.0.12
-- Avarias com ate 5 fotos por produto, cada foto com seu proprio GPS.
-- Mantem compatibilidade com avarias antigas (foto unica em damage_items).
-- Execute uma vez no SQL Editor do Supabase ANTES de publicar a v1.0.12.

begin;

create table if not exists public.damage_item_photos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.damage_items(id) on delete cascade,
  photo_order integer not null check (photo_order between 1 and 5),
  photo_path text not null,
  latitude double precision not null,
  longitude double precision not null,
  gps_accuracy double precision,
  gps_captured_at timestamptz,
  created_at timestamptz not null default now(),
  unique(item_id, photo_order)
);

create index if not exists idx_damage_item_photos_item on public.damage_item_photos(item_id);

-- Copia a foto historica de cada item para a nova tabela, sem duplicar.
insert into public.damage_item_photos(
  item_id,photo_order,photo_path,latitude,longitude,gps_accuracy,gps_captured_at,created_at
)
select
  i.id,1,i.photo_path,i.latitude,i.longitude,i.gps_accuracy,i.gps_captured_at,i.created_at
from public.damage_items i
where coalesce(i.photo_path,'')<>''
on conflict (item_id,photo_order) do nothing;

alter table public.damage_item_photos enable row level security;

drop policy if exists "damage_item_photos_read" on public.damage_item_photos;
create policy "damage_item_photos_read" on public.damage_item_photos for select to authenticated
using (
  public.is_admin()
  or exists(
    select 1
    from public.damage_items i
    join public.damage_requests r on r.id=i.request_id
    where i.id=item_id and r.created_by=auth.uid()
  )
);

grant select,insert,update,delete on public.damage_item_photos to authenticated;

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
  v_item_id uuid;
  v_order integer := 0;
  v_photos jsonb;
  v_photo jsonb;
  v_first_photo jsonb;
  v_photo_order integer;
begin
  if not public.has_role(array['ADMIN','COLABORADOR_ENTREGA']::text[]) then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_profile from public.profiles where id=auth.uid() and active=true;
  if v_profile.id is null then raise exception 'UNAUTHORIZED'; end if;

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
    v_photos := case when jsonb_typeof(v_item->'photos')='array' then v_item->'photos' else '[]'::jsonb end;

    -- Compatibilidade: se o cliente antigo mandar somente photo_path/GPS no item,
    -- converte para um array de uma foto.
    if jsonb_array_length(v_photos)=0 and coalesce(v_item->>'photo_path','')<>'' then
      v_photos := jsonb_build_array(jsonb_build_object(
        'photo_path',v_item->>'photo_path',
        'latitude',v_item->>'latitude',
        'longitude',v_item->>'longitude',
        'accuracy',v_item->>'accuracy',
        'gps_at',v_item->>'gps_at'
      ));
    end if;

    if jsonb_array_length(v_photos)=0 then raise exception 'FOTO_OBRIGATORIA'; end if;
    if jsonb_array_length(v_photos)>5 then raise exception 'MAXIMO_5_FOTOS'; end if;

    v_first_photo := v_photos->0;

    insert into public.damage_items(
      request_id,item_order,product_text,lot,quantity,quantity_unit,reason,
      photo_path,latitude,longitude,gps_accuracy,gps_captured_at
    ) values(
      v_req,v_order,btrim(v_item->>'product'),upper(btrim(v_item->>'lot')),(v_item->>'quantity')::numeric,
      upper(v_item->>'unit'),btrim(v_item->>'reason'),btrim(v_first_photo->>'photo_path'),
      (v_first_photo->>'latitude')::double precision,(v_first_photo->>'longitude')::double precision,
      nullif(v_first_photo->>'accuracy','')::double precision,nullif(v_first_photo->>'gps_at','')::timestamptz
    ) returning id into v_item_id;

    v_photo_order := 0;
    for v_photo in select value from jsonb_array_elements(v_photos) loop
      v_photo_order := v_photo_order + 1;
      insert into public.damage_item_photos(
        item_id,photo_order,photo_path,latitude,longitude,gps_accuracy,gps_captured_at
      ) values(
        v_item_id,v_photo_order,btrim(v_photo->>'photo_path'),
        (v_photo->>'latitude')::double precision,(v_photo->>'longitude')::double precision,
        nullif(v_photo->>'accuracy','')::double precision,nullif(v_photo->>'gps_at','')::timestamptz
      );
    end loop;
  end loop;

  return v_req;
end;
$$;

grant execute on function public.create_damage_request(jsonb) to authenticated;

-- Realtime e opcional para fotos, mas incluir a tabela facilita evolucoes futuras.
do $$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='damage_item_photos'
  ) then
    execute 'alter publication supabase_realtime add table public.damage_item_photos';
  end if;
end $$;

commit;
