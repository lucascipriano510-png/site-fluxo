// =====================================================================
// FLUXO OUTLET — Disparo CAPI (cliente)
// Chama a Edge Function `webhook-meta` no Supabase com o segredo compartilhado.
// Fire-and-forget: nunca lança / nunca bloqueia o fluxo de venda.
// =====================================================================
import { supabase } from './supabaseClient';

// Senha compartilhada com a Edge Function (header x-webhook-secret).
// Conforme combinado: METODOFLUXO.
const WEBHOOK_SECRET =
  import.meta.env.VITE_META_WEBHOOK_SECRET || 'METODOFLUXO';

/**
 * Dispara um evento para a Meta via Edge Function.
 * Não lança erros — apenas loga no console.
 */
async function dispatchCAPI(eventName, { phone, value, currency = 'BRL' }) {
  try {
    const payload = {
      event_name: eventName,
      phone: String(phone || ''),
      value: Number(value || 0),
      currency,
      test_event_code: 'TEST58091'
    };
    const headers = {
      'x-webhook-secret': WEBHOOK_SECRET,
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
    };

    const { error } = await supabase.functions.invoke('webhook-meta', {
      body: payload,
      headers,
    });

    if (error) {
      console.warn(`[capi] webhook-meta retornou erro (${eventName}):`, error.message || error);
      return { ok: false, error: String(error.message || error) };
    }
    return { ok: true };
  } catch (err) {
    console.warn(`[capi] falha ao chamar webhook-meta (${eventName}):`, err?.message || err);
    return { ok: false, error: String(err?.message || err) };
  }
}

/**
 * Dispara o evento Purchase para a Meta via Edge Function.
 */
export async function dispatchCAPIPurchase({ phone, value }) {
  return dispatchCAPI('Purchase', { phone, value });
}

/**
 * Dispara o evento Refund para a Meta via Edge Function.
 */
export async function dispatchCAPIRefund({ phone, value }) {
  return dispatchCAPI('Refund', { phone, value });
}
