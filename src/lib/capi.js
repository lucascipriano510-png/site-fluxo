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
 * Dispara o evento Purchase para a Meta via Edge Function.
 * Não lança erros — apenas loga no console.
 *
 * @param {{ phone: string|number, value: number, type?: 'purchase'|'cancel' }} payload
 */
export async function dispatchCAPIPurchase({ phone, value, type = 'purchase' }) {
  try {
    const payload = {
      phone: String(phone || ''),
      value: Number(value || 0),
      type,
    };

    const { error } = await supabase.functions.invoke('webhook-meta', {
      body: payload,
      headers,
    });

    if (error) {
      console.warn('[capi] webhook-meta retornou erro:', error.message || error);
      return { ok: false, error: String(error.message || error) };
    }
    return { ok: true };
  } catch (err) {
    console.warn('[capi] falha ao chamar webhook-meta:', err?.message || err);
    return { ok: false, error: String(err?.message || err) };
  }
}
