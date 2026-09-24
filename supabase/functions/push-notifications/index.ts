import { createClient } from '@supabase/supabase-js';
import { GoogleAuth } from 'google-auth-library';
import webpush from 'web-push';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@disbecol.app';
const FIREBASE_SERVICE_ACCOUNT_B64 = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_B64') || '';
const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID') || '';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

type DamageKind = 'delivery' | 'sales';
type PushDevice = {
  id: string;
  user_id: string;
  channel: 'WEB' | 'FCM';
  unit: string;
  subscription: Record<string, unknown> | null;
  fcm_token: string | null;
};

type Profile = { id: string; role: string; active: boolean };

type PermissionDecision = {
  allowed: boolean;
  view: string;
};

function decodeServiceAccount() {
  if (!FIREBASE_SERVICE_ACCOUNT_B64) return null;
  try {
    const raw = Uint8Array.from(atob(FIREBASE_SERVICE_ACCOUNT_B64), c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(raw));
  } catch (error) {
    console.error('FIREBASE_SERVICE_ACCOUNT_B64 invalido', error);
    return null;
  }
}

async function authenticatedUser(req: Request) {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

function codesFor(kind: DamageKind) {
  return kind === 'delivery'
    ? ['DELIVERY_DAMAGE_VIEW_ALL', 'DELIVERY_DAMAGE_REVIEW', 'DELIVERY_DAMAGE_POST']
    : ['SALES_DAMAGE_VIEW_ALL', 'SALES_DAMAGE_REVIEW', 'SALES_DAMAGE_OVERRIDE', 'SALES_DAMAGE_POST'];
}

function recipientDecision(
  kind: DamageKind,
  profile: Profile,
  creatorId: string,
  rolePermissions: Set<string>,
  explicitPermissions: Map<string, boolean>,
): PermissionDecision {
  const managerView = kind === 'delivery' ? 'avaria-admin' : 'sales-avaria-gestao';
  const ownView = kind === 'delivery' ? 'avaria-cadastro' : 'sales-avaria-minhas';

  if (profile.role === 'ADMIN') return { allowed: true, view: managerView };

  for (const code of codesFor(kind)) {
    const explicitKey = `${profile.id}|${code}`;
    const allowed = explicitPermissions.has(explicitKey)
      ? explicitPermissions.get(explicitKey) === true
      : rolePermissions.has(`${profile.role}|${code}`);
    if (allowed) return { allowed: true, view: managerView };
  }

  if (profile.id === creatorId) return { allowed: true, view: ownView };
  return { allowed: false, view: '' };
}

async function loadRecipients(admin: ReturnType<typeof createClient>, kind: DamageKind, unit: string, creatorId: string) {
  const { data: deviceRows, error: deviceError } = await admin
    .from('push_devices')
    .select('id,user_id,channel,unit,subscription,fcm_token')
    .eq('active', true)
    .eq('unit', unit);

  if (deviceError) throw deviceError;
  const devices = (deviceRows || []) as PushDevice[];
  if (!devices.length) return [] as Array<PushDevice & { view: string }>;

  const userIds = [...new Set(devices.map(d => d.user_id))];
  const { data: profileRows, error: profileError } = await admin
    .from('profiles')
    .select('id,role,active')
    .in('id', userIds)
    .eq('active', true);
  if (profileError) throw profileError;

  const profiles = (profileRows || []) as Profile[];
  const roles = [...new Set(profiles.map(p => p.role).filter(Boolean))];
  const permissionCodes = codesFor(kind);

  const [roleResult, userResult] = await Promise.all([
    roles.length
      ? admin.from('role_permissions').select('role,permission_code').in('role', roles).in('permission_code', permissionCodes)
      : Promise.resolve({ data: [], error: null }),
    admin.from('user_permissions').select('user_id,permission_code,allowed').in('user_id', userIds).in('permission_code', permissionCodes),
  ]);

  if (roleResult.error) throw roleResult.error;
  if (userResult.error) throw userResult.error;

  const rolePermissions = new Set((roleResult.data || []).map((r: any) => `${r.role}|${r.permission_code}`));
  const explicitPermissions = new Map<string, boolean>();
  for (const row of userResult.data || []) explicitPermissions.set(`${row.user_id}|${row.permission_code}`, row.allowed === true);

  const profileById = new Map(profiles.map(p => [p.id, p]));
  const recipients: Array<PushDevice & { view: string }> = [];
  for (const device of devices) {
    const profile = profileById.get(device.user_id);
    if (!profile) continue;
    const decision = recipientDecision(kind, profile, creatorId, rolePermissions, explicitPermissions);
    if (decision.allowed) recipients.push({ ...device, view: decision.view });
  }
  return recipients;
}

async function getFcmAccessToken() {
  const credentials = decodeServiceAccount();
  if (!credentials) return null;
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
  });
  const client = await auth.getClient();
  const access = await client.getAccessToken();
  return typeof access === 'string' ? access : access?.token || null;
}

async function sendFcm(token: string, title: string, body: string, data: Record<string, string>) {
  const credentials = decodeServiceAccount();
  const projectId = FIREBASE_PROJECT_ID || credentials?.project_id || '';
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID_AUSENTE');
  const accessToken = await getFcmAccessToken();
  if (!accessToken) throw new Error('FIREBASE_CREDENCIAL_AUSENTE');

  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data,
        android: {
          priority: 'high',
          notification: {
            channel_id: 'disb_avarias',
            sound: 'default',
          },
        },
      },
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`FCM_${response.status}:${text}`);
    (error as any).status = response.status;
    (error as any).responseText = text;
    throw error;
  }
  return text;
}

async function sendWeb(subscription: Record<string, unknown>, title: string, body: string, data: Record<string, string>) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) throw new Error('VAPID_NAO_CONFIGURADO');
  return await webpush.sendNotification(subscription as any, JSON.stringify({
    title,
    body,
    icon: 'assets/icon-192.png',
    badge: 'assets/icon-192.png',
    tag: `disb-${data.kind}-${data.request_id}`,
    data,
  }), { TTL: 300, urgency: 'high' as any });
}

async function deactivateDevice(admin: ReturnType<typeof createClient>, id: string) {
  const { error } = await admin.from('push_devices').update({ active: false, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) console.warn('Falha ao desativar dispositivo', id, error.message);
}

async function dispatchPush(admin: ReturnType<typeof createClient>, kind: DamageKind, requestId: string, callerId: string) {
  const table = kind === 'delivery' ? 'damage_requests' : 'sales_damage_requests';
  const { data: row, error } = await admin.from(table).select('*').eq('id', requestId).single();
  if (error || !row) throw new Error('SOLICITACAO_NAO_ENCONTRADA');

  const creatorId = String(row.created_by || row.delivery_user_id || row.seller_id || '');
  if (!creatorId || creatorId !== callerId) throw new Error('SOLICITACAO_NAO_PERTENCE_AO_USUARIO');

  const unit = String(row.unit || '').trim();
  if (!unit) throw new Error('UNIDADE_DA_SOLICITACAO_AUSENTE');

  const customer = [row.customer_code, row.customer_name].filter(Boolean).join(' - ');
  const title = kind === 'delivery' ? 'Nova avaria de entrega' : 'Nova avaria de vendas';
  const body = kind === 'delivery'
    ? [row.delivery_name || row.delivery_username || 'Entrega', customer ? `PDV ${customer}` : '', row.map_number ? `Mapa ${row.map_number}` : '', unit].filter(Boolean).join(' • ')
    : [row.request_code || '', row.seller_name || row.seller_username || 'Vendas', customer ? `PDV ${customer}` : '', unit].filter(Boolean).join(' • ');

  const recipients = await loadRecipients(admin, kind, unit, creatorId);
  const fcmRecipients = recipients.filter(r => r.channel === 'FCM' && r.fcm_token);
  const webRecipients = recipients.filter(r => r.channel === 'WEB' && r.subscription);
  const dataBase = { kind, request_id: String(row.id), unit };

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const recipient of webRecipients) {
    try {
      await sendWeb(recipient.subscription!, title, body, { ...dataBase, view: recipient.view });
      sent++;
    } catch (e) {
      failed++;
      const status = Number((e as any)?.statusCode || (e as any)?.status || 0);
      const msg = String((e as any)?.message || e || 'WEB_PUSH_ERROR');
      errors.push(msg.slice(0, 300));
      if (status === 404 || status === 410) await deactivateDevice(admin, recipient.id);
    }
  }

  for (const recipient of fcmRecipients) {
    try {
      await sendFcm(recipient.fcm_token!, title, body, { ...dataBase, view: recipient.view });
      sent++;
    } catch (e) {
      failed++;
      const msg = String((e as any)?.responseText || (e as any)?.message || e || 'FCM_ERROR');
      errors.push(msg.slice(0, 300));
      if (/UNREGISTERED|registration-token-not-registered|404/i.test(msg)) await deactivateDevice(admin, recipient.id);
    }
  }

  return { ok: true, recipients: recipients.length, sent, failed, errors: errors.slice(0, 5) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'SUPABASE_ENV_AUSENTE' }, 500);
  }

  const user = await authenticatedUser(req);
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: 'JSON_INVALIDO' }, 400); }
  const action = String(body?.action || '').trim().toLowerCase();

  if (action === 'config') {
    if (!VAPID_PUBLIC_KEY) return json({ error: 'VAPID_NAO_CONFIGURADO' }, 503);
    return json({ vapid_public_key: VAPID_PUBLIC_KEY });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (action === 'dispatch') {
    const kind = String(body?.kind || '') as DamageKind;
    const requestId = String(body?.request_id || '').trim();
    if (!['delivery', 'sales'].includes(kind) || !requestId) return json({ error: 'PARAMETROS_INVALIDOS' }, 400);
    try {
      return json(await dispatchPush(admin, kind, requestId, user.id));
    } catch (error) {
      console.error('dispatch push', error);
      return json({ error: String((error as any)?.message || error || 'PUSH_ERROR') }, 400);
    }
  }

  return json({ error: 'ACTION_INVALIDA' }, 400);
});
