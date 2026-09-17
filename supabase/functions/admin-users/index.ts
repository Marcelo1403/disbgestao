import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function normalizeUsername(v: unknown) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '');
}

function firstNamedKey(jsonEnvName: string): string {
  const raw = Deno.env.get(jsonEnvName) || '';
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return String(parsed.default || Object.values(parsed)[0] || '');
  } catch {
    return '';
  }
}

function getPublishableKey(): string {
  return (
    Deno.env.get('SUPABASE_ANON_KEY') ||
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ||
    firstNamedKey('SUPABASE_PUBLISHABLE_KEYS') ||
    ''
  );
}

function getSecretKey(): string {
  return (
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
    Deno.env.get('SUPABASE_SECRET_KEY') ||
    firstNamedKey('SUPABASE_SECRET_KEYS') ||
    ''
  );
}



async function savePermissionOverrides(admin: any, userId: string, role: string, permissions: unknown, updatedBy: string) {
  if (!Array.isArray(permissions)) return;

  const normalized: string[] = [...new Set<string>(permissions.map((x: unknown) => String(x || '').trim().toUpperCase()).filter(Boolean))];

  const [{ data: allPermissions, error: permissionsError }, { data: roleRows, error: roleError }] = await Promise.all([
    admin.from('permissions').select('code').eq('active', true),
    admin.from('role_permissions').select('permission_code').eq('role', role),
  ]);
  if (permissionsError) throw permissionsError;
  if (roleError) throw roleError;

  const valid = new Set<string>((allPermissions || []).map((x: any) => String(x.code)));
  const defaults = new Set<string>((roleRows || []).map((x: any) => String(x.permission_code)));
  const enabled = new Set<string>(normalized.filter((code) => valid.has(code)));

  const { error: deleteError } = await admin.from('user_permissions').delete().eq('user_id', userId);
  if (deleteError) throw deleteError;

  if (role === 'ADMIN') return;

  const overrides = [...valid]
    .filter((code) => enabled.has(code) !== defaults.has(code))
    .map((code) => ({ user_id: userId, permission_code: code, allowed: enabled.has(code), updated_by: updatedBy }));

  if (overrides.length) {
    const { error: insertError } = await admin.from('user_permissions').insert(overrides);
    if (insertError) throw insertError;
  }
}

async function findAuthUserByEmail(admin: any, email: string) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const users = data?.users || [];
    const found = users.find((u: any) => String(u.email || '').toLowerCase() === target);
    if (found) return found;
    if (users.length < 100) break;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'METODO_NAO_PERMITIDO' });

  try {
    const url = Deno.env.get('SUPABASE_URL') || '';
    const publishableKey = getPublishableKey();
    const secretKey = getSecretKey();

    if (!url) return json({ ok: false, error: 'CONFIGURACAO_EDGE: SUPABASE_URL ausente.' });
    if (!publishableKey) return json({ ok: false, error: 'CONFIGURACAO_EDGE: chave publica ausente.' });
    if (!secretKey) return json({ ok: false, error: 'CONFIGURACAO_EDGE: chave administrativa ausente.' });

    const authHeader = req.headers.get('Authorization') || '';
    const accessToken = authHeader.match(/^Bearer\s+(.+)$/i)?.[1] || '';
    if (!accessToken) return json({ ok: false, error: 'AUTH_SEM_TOKEN' });

    // Cliente do proprio usuario. Esta consulta usa o JWT real do aplicativo.
    const caller = createClient(url, publishableKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    // Passamos o JWT explicitamente para nao depender de uma sessao interna do cliente.
    const { data: userData, error: userError } = await caller.auth.getUser(accessToken);
    if (userError || !userData.user) {
      console.error('admin-users auth', userError);
      return json({ ok: false, error: `AUTH_INVALIDA: ${userError?.message || 'usuario nao identificado'}` });
    }

    // IMPORTANTE: a autorizacao ADMIN_USERS e verificada com o cliente do proprio usuario,
    // nao com a chave administrativa. A policy profiles permite ao usuario consultar
    // o proprio perfil (id = auth.uid()).
    const { data: callerProfile, error: profileError } = await caller
      .from('profiles')
      .select('id,username,name,role,active')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (profileError) {
      console.error('admin-users caller profile error', profileError);
      return json({
        ok: false,
        error: `ERRO_PERFIL_ADMIN: ${profileError.message}`,
        diagnostic: { user_id: userData.user.id, email: userData.user.email || null },
      });
    }

    if (!callerProfile) {
      return json({
        ok: false,
        error: 'PERFIL_ADMIN_NAO_ENCONTRADO',
        diagnostic: { user_id: userData.user.id, email: userData.user.email || null },
      });
    }

    if (callerProfile.active !== true) {
      return json({
        ok: false,
        error: `FORBIDDEN: usuario=${callerProfile.username}, role=${callerProfile.role}, active=${callerProfile.active}`,
        diagnostic: { user_id: userData.user.id, email: userData.user.email || null, profile: callerProfile },
      });
    }

    const { data: canManageUsers, error: permissionError } = await caller.rpc('has_permission', { p_code: 'ADMIN_USERS' });
    if (permissionError) {
      console.error('admin-users permission error', permissionError);
      return json({ ok: false, error: `ERRO_PERMISSAO_ADMIN_USERS: ${permissionError.message}` });
    }
    if (canManageUsers !== true) {
      return json({
        ok: false,
        error: `FORBIDDEN: usuario=${callerProfile.username}, role=${callerProfile.role}, permissao=ADMIN_USERS`,
        diagnostic: { user_id: userData.user.id, email: userData.user.email || null, profile: callerProfile },
      });
    }

    // Cliente privilegiado SOMENTE depois de confirmar a permissao ADMIN_USERS.
    const admin = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    // Teste simples da chave administrativa para devolver erro claro se houver problema.
    const { error: adminProbeError } = await admin.from('profiles').select('id').limit(1);
    if (adminProbeError) {
      console.error('admin-users admin probe', adminProbeError);
      return json({ ok: false, error: `CHAVE_ADMIN_INVALIDA: ${adminProbeError.message}` });
    }

    const body = await req.json();
    const action = String(body.action || '').toLowerCase();
    const username = normalizeUsername(body.username);
    const name = String(body.name || '').trim();
    const role = String(body.role || '').trim().toUpperCase();
    const active = body.active !== false;
    const password = String(body.password || '');
    const domain = Deno.env.get('USER_EMAIL_DOMAIN') || 'disbecol.app';
    const allowedRoles = ['ADMIN', 'COLABORADOR_ARMAZEM', 'COLABORADOR_ENTREGA', 'CONFERENTE', 'MOTORISTA_PUXADOR', 'VENDEDOR', 'GERENTE_VENDAS'];

    if (!allowedRoles.includes(role)) return json({ ok: false, error: 'PERFIL_INVALIDO' });
    if (!username || !name) return json({ ok: false, error: 'DADOS_OBRIGATORIOS' });

    const email = `${username}@${domain}`;

    if (action === 'create') {
      if (password.length < 6) return json({ ok: false, error: 'SENHA_MIN_6' });

      // Recupera cadastros incompletos de tentativas anteriores.
      const { data: existingProfile, error: existingProfileError } = await admin
        .from('profiles')
        .select('id,username,name,role,active')
        .eq('username', username)
        .maybeSingle();
      if (existingProfileError) throw existingProfileError;

      let userId = existingProfile?.id || null;
      if (!userId) {
        const authUser = await findAuthUserByEmail(admin, email);
        if (authUser?.id) userId = authUser.id;
      }

      if (userId) {
        const { error: authRepairError } = await admin.auth.admin.updateUserById(userId, {
          email,
          password,
          email_confirm: true,
          user_metadata: { username, name },
        });
        if (authRepairError) throw authRepairError;

        const { error: profileRepairError } = await admin
          .from('profiles')
          .upsert({ id: userId, username, name, role, active }, { onConflict: 'id' });
        if (profileRepairError) throw profileRepairError;

        await savePermissionOverrides(admin, userId, role, body.permissions, userData.user.id);
        return json({ ok: true, id: userId, repaired: true });
      }

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username, name },
      });
      if (createError) throw createError;
      if (!created.user) throw new Error('FALHA_AO_CRIAR_USUARIO');

      const { error: profileUpsertError } = await admin
        .from('profiles')
        .upsert({ id: created.user.id, username, name, role, active }, { onConflict: 'id' });
      if (profileUpsertError) throw profileUpsertError;

      await savePermissionOverrides(admin, created.user.id, role, body.permissions, userData.user.id);
      return json({ ok: true, id: created.user.id, repaired: false });
    }

    if (action === 'update') {
      const original = normalizeUsername(body.originalUsername || username);
      const { data: profile, error: findError } = await admin
        .from('profiles')
        .select('id,username')
        .eq('username', original)
        .maybeSingle();
      if (findError) throw findError;
      if (!profile) return json({ ok: false, error: 'USUARIO_NAO_ENCONTRADO' });

      const attrs: Record<string, unknown> = {
        email,
        email_confirm: true,
        user_metadata: { username, name },
      };
      if (password) {
        if (password.length < 6) return json({ ok: false, error: 'SENHA_MIN_6' });
        attrs.password = password;
      }

      const { error: authUpdateError } = await admin.auth.admin.updateUserById(profile.id, attrs);
      if (authUpdateError) throw authUpdateError;

      const { error: profileUpdateError } = await admin
        .from('profiles')
        .update({ username, name, role, active })
        .eq('id', profile.id);
      if (profileUpdateError) throw profileUpdateError;

      await savePermissionOverrides(admin, profile.id, role, body.permissions, userData.user.id);
      return json({ ok: true, id: profile.id });
    }

    return json({ ok: false, error: 'ACAO_INVALIDA' });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('admin-users unexpected', message, e);
    return json({ ok: false, error: message || 'ERRO_INTERNO_ADMIN_USERS' });
  }
});
