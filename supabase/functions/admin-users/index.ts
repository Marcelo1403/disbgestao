import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeUsername(v: unknown) {
  return String(v ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const domain = Deno.env.get('USER_EMAIL_DOMAIN') || 'disbecol.app';
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader) throw new Error('UNAUTHORIZED');

    const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) throw new Error('UNAUTHORIZED');

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: callerProfile, error: profileError } = await admin
      .from('profiles').select('id,role,active').eq('id', userData.user.id).single();
    if (profileError || !callerProfile?.active || callerProfile.role !== 'ADMIN') throw new Error('FORBIDDEN');

    const body = await req.json();
    const action = String(body.action || '').toLowerCase();
    const username = normalizeUsername(body.username);
    const name = String(body.name || '').trim();
    const role = String(body.role || '').trim().toUpperCase();
    const active = body.active !== false;
    const password = String(body.password || '');
    const allowedRoles = ['ADMIN', 'COLABORADOR_ARMAZEM', 'COLABORADOR_ENTREGA', 'CONFERENTE'];
    if (!allowedRoles.includes(role)) throw new Error('PERFIL_INVALIDO');
    if (!username || !name) throw new Error('DADOS_OBRIGATORIOS');
    const email = `${username}@${domain}`;

    if (action === 'create') {
      if (password.length < 6) throw new Error('SENHA_MIN_6');
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { username, name }
      });
      if (createError) throw createError;
      await admin.from('profiles').upsert({ id: created.user.id, username, name, role, active }, { onConflict: 'id' });
      return new Response(JSON.stringify({ ok: true, id: created.user.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'update') {
      const original = normalizeUsername(body.originalUsername || username);
      const { data: profile, error: findError } = await admin.from('profiles').select('id,username').eq('username', original).single();
      if (findError || !profile) throw new Error('USUARIO_NAO_ENCONTRADO');
      const attrs: Record<string, unknown> = { email, email_confirm: true, user_metadata: { username, name } };
      if (password) {
        if (password.length < 6) throw new Error('SENHA_MIN_6');
        attrs.password = password;
      }
      const { error: authUpdateError } = await admin.auth.admin.updateUserById(profile.id, attrs);
      if (authUpdateError) throw authUpdateError;
      const { error: profileUpdateError } = await admin.from('profiles').update({ username, name, role, active }).eq('id', profile.id);
      if (profileUpdateError) throw profileUpdateError;
      return new Response(JSON.stringify({ ok: true, id: profile.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    throw new Error('ACAO_INVALIDA');
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message === 'UNAUTHORIZED' ? 401 : message === 'FORBIDDEN' ? 403 : 400;
    return new Response(JSON.stringify({ ok: false, error: message }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
