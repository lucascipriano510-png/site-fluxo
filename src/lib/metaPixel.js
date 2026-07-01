// =====================================================================
// FLUXO OUTLET — Meta Pixel + CAPI híbrido
// - Carrega o script do Pixel uma vez (PageView inicial)
// - Expõe trackEvent(name, data) que dispara EM PARALELO:
//     1) fbq('track', name, data, { eventID })           [browser]
//     2) POST /functions/v1/webhook-meta com event_id    [server CAPI]
//   O mesmo event_id é usado nos dois lados → DEDUPLICAÇÃO na Meta.
// - Access token nunca é exposto no client (fica no Supabase secret).
// =====================================================================
import { supabase } from './supabaseClient';

const WEBHOOK_SECRET =
  import.meta.env.VITE_META_WEBHOOK_SECRET || 'METODOFLUXO';

// Pixel ID público — pode ficar no client (não é segredo).
export const META_PIXEL_ID = '1488076836116872';

let pixelLoaded = false;

export function initMetaPixel() {
  if (typeof window === 'undefined' || pixelLoaded) return;
  pixelLoaded = true;

  // Snippet oficial do Meta Pixel
  /* eslint-disable */
  (function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */

  try {
    ensureFbc(); // reconstrói _fbc do fbclid antes de qualquer evento
    window.fbq('init', META_PIXEL_ID);
    // PageView inicial (com event_id pra permitir dedup com a CAPI)
    trackEvent('PageView');
  } catch (e) {
    console.warn('[pixel] init falhou:', e);
  }
}

// UUID v4 leve (não precisa de dependência)
function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function readCookie(name) {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

// EMQ: garante o cookie _fbc no formato oficial da Meta (fb.1.<ts>.<fbclid>)
// quando o usuário chega via anúncio (?fbclid=...) e o Pixel ainda não criou o
// cookie. Persiste 90 dias (padrão Meta). Não sobrescreve um _fbc existente.
export function ensureFbc() {
  try {
    if (typeof window === 'undefined') return;
    if (readCookie('_fbc')) return;
    const fbclid = new URLSearchParams(window.location.search).get('fbclid');
    if (!fbclid) return;
    const fbc = `fb.1.${Date.now()}.${fbclid}`;
    const exp = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `_fbc=${fbc}; expires=${exp}; path=/; SameSite=Lax`;
  } catch (e) { /* silencioso */ }
}

// Coleta os parâmetros de browser do CLIENTE (pra gravar no pedido e enviar no
// Purchase depois). fbc já reconstruído por ensureFbc() se veio de anúncio.
export function getMetaBrowserParams() {
  ensureFbc();
  return {
    fbp: readCookie('_fbp') || null,
    fbc: readCookie('_fbc') || null,
    client_ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    src_url: typeof window !== 'undefined' ? window.location.href : '',
  };
}

async function sendCAPIEvent(payload) {
  const headers = { 'x-webhook-secret': WEBHOOK_SECRET };

  const { data, error } = await supabase.functions.invoke('webhook-meta', {
    headers,
    body: payload,
  });

  if (error) {
    console.warn('[capi] webhook-meta retornou erro:', error.message || error);
    return { ok: false, error: String(error.message || error) };
  }

  return { ok: true, data };
}

/**
 * Dispara um evento na Meta de forma híbrida (Pixel + CAPI) com dedup.
 * Fire-and-forget — nunca bloqueia / nunca lança.
 *
 * @param {string} eventName  - PageView | ViewContent | AddToCart | InitiateCheckout | Purchase
 * @param {object} [data]     - { value, currency, phone, custom_data, ... }
 * @returns {string} event_id usado (caso queira logar)
 */
export function trackEvent(eventName, data = {}) {
  const eventId = data.event_id || uuid();
  const value = Number(data.value || 0);
  const currency = data.currency || 'BRL';

  // 1) Pixel (browser) ------------------------------------------------
  try {
    if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
      const pixelData = {};
      if (value > 0) { pixelData.value = value; pixelData.currency = currency; }
      if (data.content_name) pixelData.content_name = data.content_name;
      if (data.content_ids)  pixelData.content_ids  = data.content_ids;
      if (data.content_type) pixelData.content_type = data.content_type;
      if (data.contents)     pixelData.contents     = data.contents;
      window.fbq('track', eventName, pixelData, { eventID: eventId });
    }
  } catch (e) {
    console.warn('[pixel] track falhou:', e);
  }

  // 2) CAPI (server) — paralelo, com mesmo event_id -------------------
  (async () => {
    try {
      const payload = {
        event_name: eventName,
        event_id: eventId,
        value: value || 0,
        currency,
        phone: data.phone || '',
        event_source_url: typeof window !== 'undefined' ? window.location.href : '',
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        fbp: readCookie('_fbp'),
        fbc: readCookie('_fbc'),
        custom_data: {
          ...(data.content_name ? { content_name: data.content_name } : {}),
          ...(data.content_ids  ? { content_ids:  data.content_ids  } : {}),
          ...(data.content_type ? { content_type: data.content_type } : {}),
          ...(data.contents     ? { contents:     data.contents     } : {}),
        },
      };

      await sendCAPIEvent(payload);
    } catch (err) {
      console.warn('[capi] falha:', err?.message || err);
    }
  })();

  return eventId;
}

// (Removido o wrapper compat dispatchCAPIPurchase: ninguém importava daqui —
// Admin/ManualSale usam o de ./capi.js — e o ternário tratava 'cancel' como
// Purchase, ou seja, um cancelamento viraria COMPRA na Meta se alguém usasse.)
