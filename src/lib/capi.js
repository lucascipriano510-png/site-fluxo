// =====================================================================
// FLUXO OUTLET — Disparo CAPI (cliente)
// Chama a Edge Function `webhook-meta` no Supabase com o segredo compartilhado.
// Fire-and-forget: nunca lança / nunca bloqueia o fluxo de venda.
// =====================================================================
import { supabase } from './supabaseClient';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.SUPABASE_URL ||
  'https://tapgnlrjhrhewqlpahvg.supabase.co';

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.SUPABASE_ANON_KEY ||
  'sb_publishable_XaGrDdX2df8qolf2WocwuQ_FsVP1-kW';

// Senha compartilhada com a Edge Function (header x-webhook-secret).
// Conforme combinado: METODOFLUXO.
const WEBHOOK_SECRET =
  import.meta.env.VITE_META_WEBHOOK_SECRET || 'METODOFLUXO';

/**
 * Dispara o evento Purchase para a Meta via Edge Function.
 * Não lança erros — apenas loga no console.
 *
 * @param {{ phone: string|number, value: number, type?: 'purchase'|'cancel' }} payload
 */
export async function dispatchCAPIPurchase({ phone, value, type = 'purchase' }) {
  try {
    const url = `${SUPABASE_URL}/functions/v1/webhook-meta`;
    const body = JSON.stringify({
      phone: String(phone || ''),
      value: Number(value || 0),
      type,
    });

    // Tenta anexar o JWT do usuário logado (modo "app autenticado"),
    // mas o header principal de auth é o x-webhook-secret.
    let bearer = SUPABASE_ANON_KEY;
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) bearer = data.session.access_token;
    } catch (_) { /* opcional */ }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': WEBHOOK_SECRET,
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${bearer}`,
      },
      body,
      keepalive: true, // permite que a request finalize mesmo se a aba fechar
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.warn('[capi] webhook-meta retornou', res.status, txt);
      return { ok: false, status: res.status };
    }
    return { ok: true };
  } catch (err) {
    console.warn('[capi] falha ao chamar webhook-meta:', err?.message || err);
    return { ok: false, error: String(err?.message || err) };
  }
}
