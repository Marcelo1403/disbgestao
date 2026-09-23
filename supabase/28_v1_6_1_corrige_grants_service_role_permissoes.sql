-- Disb Gestao v1.6.1
-- Hotfix SQL 28: privilegios da Edge Function admin-users nas tabelas de permissoes.
--
-- Motivo:
-- A Edge Function usa a chave administrativa (service_role) para ler o catalogo
-- de permissoes e gravar overrides de usuario. As tabelas criadas no SQL 18
-- receberam GRANT SELECT para authenticated, mas o service_role nao ficou com
-- os privilegios de tabela necessarios neste ambiente.
--
-- Execute no SQL Editor do Supabase. Nao e necessario repetir os SQLs 25, 26 ou 27.

begin;

grant usage on schema public to service_role;

grant select
on table public.permissions,
         public.role_permissions
to service_role;

grant select, insert, update, delete
on table public.user_permissions
to service_role;

commit;

-- Conferencia: deve listar os privilegios abaixo para service_role.
select
  grantee,
  table_schema,
  table_name,
  privilege_type
from information_schema.role_table_grants
where grantee = 'service_role'
  and table_schema = 'public'
  and table_name in ('permissions', 'role_permissions', 'user_permissions')
order by table_name, privilege_type;
