-- PASSO 1: no Supabase Dashboard, abra Authentication > Users > Add user.
-- E-mail: marcelo@disbecol.app
-- Senha: Marcelo123
-- Marque o e-mail como confirmado.
--
-- PASSO 2: depois execute somente este SQL para promover o perfil criado a ADMIN.

update public.profiles
set username='marcelo', name='Marcelo', role='ADMIN', active=true
where id=(select id from auth.users where lower(email)='marcelo@disbecol.app' limit 1);

select id,username,name,role,active from public.profiles where username='marcelo';
