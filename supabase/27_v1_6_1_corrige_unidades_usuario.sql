-- Disb Gestao v1.6.1
-- Hotfix: salvamento/atribuicao de unidades no cadastro de usuarios.
-- Execute depois do SQL 26_v1_6_0_unidades_por_usuario.sql.
--
-- Objetivos:
--   * Salvar todas as unidades de um usuario em uma unica transacao no banco.
--   * Validar unidades ativas antes de substituir os vinculos.
--   * Registrar auditoria da alteracao.
--   * Evitar atualizacoes parciais de user_units em caso de erro.

begin;

create or replace function public.admin_set_user_units(
  p_user_id uuid,
  p_units text[],
  p_active boolean default true
)
returns text[]
language plpgsql
security definer
set search_path=public
as $$
declare
  v_requested text[] := '{}'::text[];
  v_old text[] := '{}'::text[];
  v_invalid text[] := '{}'::text[];
  v_changed_by_name text := '';
begin
  if auth.uid() is null then
    raise exception 'AUTH_SEM_USUARIO';
  end if;

  if not public.has_permission('ADMIN_USERS') then
    raise exception 'FORBIDDEN';
  end if;

  if not exists(select 1 from public.profiles where id=p_user_id) then
    raise exception 'USUARIO_NAO_ENCONTRADO';
  end if;

  select coalesce(array_agg(x.unit_name order by x.unit_name),'{}'::text[])
    into v_requested
  from (
    select distinct btrim(v) as unit_name
    from unnest(coalesce(p_units,'{}'::text[])) as t(v)
    where btrim(coalesce(v,''))<>''
  ) x;

  if coalesce(p_active,true) and cardinality(v_requested)=0 then
    raise exception 'UNIDADE_OBRIGATORIA';
  end if;

  select coalesce(array_agg(v order by v),'{}'::text[])
    into v_invalid
  from unnest(v_requested) as q(v)
  where not exists(
    select 1
    from public.units u
    where u.name=q.v
      and u.active=true
  );

  if cardinality(v_invalid)>0 then
    raise exception 'UNIDADE_INVALIDA:%',array_to_string(v_invalid,',');
  end if;

  select coalesce(array_agg(uu.unit_name order by uu.unit_name),'{}'::text[])
    into v_old
  from public.user_units uu
  where uu.user_id=p_user_id;

  delete from public.user_units
  where user_id=p_user_id;

  if cardinality(v_requested)>0 then
    insert into public.user_units(user_id,unit_name,created_by)
    select p_user_id,v,auth.uid()
    from unnest(v_requested) as q(v);
  end if;

  if v_old is distinct from v_requested then
    select coalesce(p.name,p.username,'')
      into v_changed_by_name
    from public.profiles p
    where p.id=auth.uid();

    insert into public.user_unit_access_audit(
      user_id,old_units,new_units,changed_by,changed_by_name
    ) values(
      p_user_id,v_old,v_requested,auth.uid(),coalesce(v_changed_by_name,'')
    );
  end if;

  return v_requested;
end;
$$;

grant execute on function public.admin_set_user_units(uuid,text[],boolean) to authenticated;

commit;
