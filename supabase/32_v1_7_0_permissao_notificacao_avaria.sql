-- Disb Gestao v1.7.0
-- Permissao individual de notificacao de avarias.

begin;

insert into public.permissions(
  code,
  module,
  name,
  description,
  sort_order,
  active
)
values(
  'DAMAGE_NOTIFICATION',
  'Notificações',
  'Notificação avaria',
  'Receber notificações de novas avarias de entrega e vendas nos dispositivos autorizados.',
  10,
  true
)
on conflict(code) do update set
  module=excluded.module,
  name=excluded.name,
  description=excluded.description,
  sort_order=excluded.sort_order,
  active=true;

delete from public.role_permissions
where permission_code='DAMAGE_NOTIFICATION';

grant usage
on schema public
to service_role;

grant select
on table
  public.permissions,
  public.role_permissions,
  public.user_permissions
to service_role;

grant select,insert,update,delete
on table public.user_permissions
to service_role;

commit;