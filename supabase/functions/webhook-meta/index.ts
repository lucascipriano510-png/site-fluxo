// =====================================================================
// FLUXO OUTLET — Edge Function: webhook-meta
// CAPI híbrida (server-side) — espelha eventos do Pixel do navegador.
//
// Recebe POST {
//   event_name: 'Purchase' | 'AddToCart' | 'InitiateCheckout' | 'PageView' | 'ViewContent',
//   event_id:   string  (UUID gerado no client — DEDUP entre Pixel e CAPI),
//   value?:     number,
//   currency?:  'BRL',
//   phone?:     string,
//   event_source_url?: string,
//   user_agent?: string,
//   fbp?:       string,
//   fbc?:       string,
//   custom_data?: Record<string, unknown>,
// }
//
// Auth aceita:
//   - Header  x-webhook-secret: META_WEBHOOK_SECRET   (chamadas do site)
//   - Header  Authorization: Bearer <jwt usuário>     (chamadas do admin)
//
// Compat: ainda aceita o payload antigo { phone, value, type } -> Purchase.
// =====================================================================

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, x-webhook-secret, apikey, x-client-info',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function cleanPhone(raw: string): string {
  return String(raw || '').replace(/\D/g, '');
}

const ALLOWED_EVENTS = new Set([
  'PageView',
  'ViewContent',
  'AddToCart',
  'InitiateCheckout',
  'Purchase',
]);

// 🔖 Version stamp — atualize a cada deploy para auditar o que está publicado.
const FN_VERSION = '2026-05-11.2';
const FN_NAME    = 'webhook-meta';
const FN_NOTES   = 'phone obrigatório apenas para Purchase; PageView/ViewContent/AddToCart/InitiateCheckout liberados';

console.log(`[${FN_NAME}] boot version=${FN_VERSION} notes="${FN_NOTES}"`);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  // Health-check / auditoria de versão publicada (sem auth, somente leitura).
  if (req.method === 'GET') {
    return json({
      ok: true,
      fn: FN_NAME,
      version: FN_VERSION,
      notes: FN_NOTES,
      allowed_events: [...ALLOWED_EVENTS],
      deployed_at_runtime: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  console.log(`[${FN_NAME}] invoke version=${FN_VERSION} ts=${new Date().toISOString()}`);

  const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const SUPABASE_ANON_KEY         = Deno.env.get('SUPABASE_ANON_KEY')!;
  const META_PIXEL_ID             = Deno.env.get('META_PIXEL_ID')!;
  const META_ACCESS_TOKEN         = Deno.env.get('META_ACCESS_TOKEN')!;
  const META_WEBHOOK_SECRET       = Deno.env.get('META_WEBHOOK_SECRET')!;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !META_PIXEL_ID || !META_ACCESS_TOKEN) {
    return json({ error: 'Missing server env vars' }, 500);
  }

  // ---------- AUTH ----------
  const headerSecret = req.headers.get('x-webhook-secret') || '';
  const authHeader   = req.headers.get('Authorization') || '';
  let authorized = false;
  let authMode: 'secret' | 'session' | null = null;

  if (META_WEBHOOK_SECRET && headerSecret && headerSecret === META_WEBHOOK_SECRET) {
    authorized = true;
    authMode = 'secret';
  } else if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (user) { authorized = true; authMode = 'session'; }
  }
  if (!authorized) return json({ error: 'Unauthorized' }, 401);

  // ---------- PARSE ----------
  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  // Compat: payload legado { phone, value, type:'cancel'? } => Purchase
  let eventName = String(body?.event_name || 'Purchase');
  if (!ALLOWED_EVENTS.has(eventName)) eventName = 'Purchase';

  const value      = Number(body?.value ?? 0) || 0;
  const currency   = String(body?.currency || 'BRL');
  const phoneRaw   = String(body?.phone ?? '').trim();
  const phoneClean = cleanPhone(phoneRaw);
  const phoneHash  = phoneClean.length >= 8 ? await sha256(phoneClean) : null;

  const eventId    = String(body?.event_id || crypto.randomUUID());
  const sourceUrl  = String(body?.event_source_url || '');
  const userAgent  = String(body?.user_agent || req.headers.get('user-agent') || '');
  const fbp        = body?.fbp ? String(body.fbp) : null;
  const fbc        = body?.fbc ? String(body.fbc) : null;
  const clientIp   = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null;
  const customData = (body?.custom_data && typeof body.custom_data === 'object') ? body.custom_data : {};

  // Para Purchase manter validações fortes (registro de venda)
  if (eventName === 'Purchase') {
    if (!phoneHash) return json({ error: 'phone is required for Purchase' }, 400);
    if (value < 0)  return json({ error: 'value must be non-negative' }, 400);
  }

  // ---------- LOG (apenas Purchase vai pra rastreio_conversoes) ----------
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let rowId: string | null = null;
  if (eventName === 'Purchase') {
    const { data: inserted, error: insertErr } = await admin
      .from('rastreio_conversoes')
      .insert({
        phone: phoneClean,
        phone_hash: phoneHash,
        value,
        event_name: eventName,
        status: 'pendente',
        source: String(body?.source || (authMode === 'session' ? 'admin' : 'webhook')),
        raw_payload: body,
      })
      .select()
      .single();
    if (insertErr || !inserted) {
      return json({ error: 'Failed to persist event', details: insertErr?.message }, 500);
    }
    rowId = inserted.id;
  }

  // ---------- META CAPI ----------
  const eventTimeSec = Math.floor(Date.now() / 1000);
  const metaUrl = `https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(META_ACCESS_TOKEN)}`;

  const userData: Record<string, unknown> = {};
  if (phoneHash)  userData.ph  = [phoneHash];
  if (fbp)        userData.fbp = fbp;
  if (fbc)        userData.fbc = fbc;
  if (clientIp)   userData.client_ip_address = clientIp;
  if (userAgent)  userData.client_user_agent = userAgent;

  const baseCustom: Record<string, unknown> = { ...customData };
  if (value > 0) {
    baseCustom.value = value;
    baseCustom.currency = currency;
  }

  // test_event_code: enviado em todas as chamadas para aparecer no painel
  // "Testar eventos" do Meta Events Manager. Pode vir do body (override),
  // do secret META_TEST_EVENT_CODE ou usar o default abaixo.
  const testEventCode =
    (typeof body?.test_event_code === 'string' && body.test_event_code) ||
    Deno.env.get('META_TEST_EVENT_CODE') ||
    'TEST58091';

  const metaPayload: Record<string, unknown> = {
    data: [
      {
        event_name: eventName,
        event_time: eventTimeSec,
        event_id: eventId,                       // 🔑 DEDUP com o Pixel
        action_source: 'website',
        event_source_url: sourceUrl || undefined,
        user_data: userData,
        custom_data: baseCustom,
      },
    ],
    test_event_code: testEventCode,
  };

  let metaStatus = 0;
  let metaJson: any = null;
  let metaErrText = '';
  try {
    const r = await fetch(metaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metaPayload),
    });
    metaStatus = r.status;
    const text = await r.text();
    try { metaJson = JSON.parse(text); } catch { metaErrText = text; }
  } catch (err) {
    metaErrText = (err as Error).message;
  }

  const ok = metaStatus >= 200 && metaStatus < 300 && metaJson && !metaJson.error;

  // ---------- UPDATE rastreio (só p/ Purchase) ----------
  if (rowId) {
    if (ok) {
      await admin.from('rastreio_conversoes')
        .update({ status: 'enviado', fb_trace_id: metaJson?.fbtrace_id || null, error_log: null })
        .eq('id', rowId);
    } else {
      await admin.from('rastreio_conversoes')
        .update({
          status: 'erro',
          error_log: JSON.stringify({ http_status: metaStatus, response: metaJson || metaErrText || 'unknown' }),
        })
        .eq('id', rowId);
    }
  }

  return json(
    ok
      ? { ok: true, id: rowId, event_id: eventId, event_name: eventName, fb_trace_id: metaJson?.fbtrace_id || null }
      : { ok: false, id: rowId, event_id: eventId, event_name: eventName, error: 'Meta CAPI rejected', details: metaJson || metaErrText },
    ok ? 200 : 502,
  );
});
