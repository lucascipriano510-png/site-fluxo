// =====================================================================
// FLUXO OUTLET — Disparo CAPI (cliente)
// Chama a Edge Function `webhook-meta` no Supabase com o segredo compartilhado.
// Fire-and-forget: nunca lança / nunca bloqueia o fluxo de venda.
// =====================================================================
import { supabase } from './supabaseClient';

// Senha compartilhada com a Edge Function (header x-webhook-secret).
const WEBHOOK_SECRET =
  import.meta.env.VITE_META_WEBHOOK_SECRET || 'METODOFLUXO';

// Normaliza telefone BR para formato E.164 sem o "+": garante prefixo 55.
function normalizePhoneBR(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  // Se já começa com 55 e tem 12-13 dígitos, mantém.
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  // 10 ou 11 dígitos (DDD + número) → prefixa 55.
  if (digits.length === 10 || digits.length === 11) return '55' + digits;
  return digits;
}

/**
 * Dispara um evento para a Meta via Edge Function.
 * Não lança erros — apenas loga no console.
 */
async function dispatchCAPI(eventName, { phone, value, name, currency = 'BRL', event_id } = {}) {
  try {
    const payload = {
      event_name: eventName,
      phone: normalizePhoneBR(phone),
      name: String(name || '').trim(),
      value: Number(value || 0),
      currency,
    };
    if (event_id) payload.event_id = event_id;

    const headers = {
      'x-webhook-secret': WEBHOOK_SECRET,
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
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
export async function dispatchCAPIPurchase({ phone, value, name, event_id } = {}) {
  return dispatchCAPI('Purchase', { phone, value, name, event_id });
}

/**
 * Dispara o evento Refund para a Meta via Edge Function.
 */
export async function dispatchCAPIRefund({ phone, value, name, event_id } = {}) {
  return dispatchCAPI('Refund', { phone, value, name, event_id });
}
