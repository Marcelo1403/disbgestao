-- Disb Gestao v1.7.0
-- Cadastro de dispositivos para Push Notifications (PWA/Windows + APK Android).
-- Execute uma vez no SQL Editor do Supabase antes de publicar a v1.7.0.

begin;

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_key text not null,
  channel text not null check (channel in ('WEB','FCM')),
  unit text not null references public.units(name) on update cascade,
  subscription jsonb,
  fcm_token text,
  platform text not null default '',
  device_name text not null default '',
  user_agent text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(user_id, device_key, channel),
  check (
    (channel='WEB' and subscription is not null and coalesce(subscription->>'endpoint','')<>'')
    or (channel='FCM' and btrim(coalesce(fcm_token,''))<>'')
  )
);

create index if not exists idx_push_devices_active_unit
  on public.push_devices(unit, active, user_id);

create index if not exists idx_push_devices_user
  on public.push_devices(user_id, active, last_seen_at desc);

create index if not exists idx_push_devices_fcm
  on public.push_devices(fcm_token)
  where channel='FCM' and active=true;

create or replace function public.touch_push_devices_updated_at()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_push_devices_updated on public.push_devices;
create trigger trg_push_devices_updated
before update on public.push_devices
for each row execute function public.touch_push_devices_updated_at();

alter table public.push_devices enable row level security;

drop policy if exists push_devices_select_own on public.push_devices;
drop policy if exists push_devices_insert_own on public.push_devices;
drop policy if exists push_devices_update_own on public.push_devices;
drop policy if exists push_devices_delete_own on public.push_devices;

create policy push_devices_select_own
on public.push_devices for select to authenticated
using (user_id=auth.uid());

create policy push_devices_insert_own
on public.push_devices for insert to authenticated
with check (user_id=auth.uid());

create policy push_devices_update_own
on public.push_devices for update to authenticated
using (user_id=auth.uid())
with check (user_id=auth.uid());

create policy push_devices_delete_own
on public.push_devices for delete to authenticated
using (user_id=auth.uid());

grant select,insert,update,delete on public.push_devices to authenticated;

commit;

select table_name,column_name,data_type
from information_schema.columns
where table_schema='public'
  and table_name='push_devices'
order by ordinal_position;
