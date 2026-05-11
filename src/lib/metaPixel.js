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

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://tapgnlrjhrhewqlpahvg.supabase.co';

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
      const url = `${SUPABASE_URL}/functions/v1/webhook-meta`;
      let bearer = '';
      try {
        const { data: s } = await supabase.auth.getSession();
        if (s?.session?.access_token) bearer = s.session.access_token;
      } catch {}

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

      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': WEBHOOK_SECRET,
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    } catch (err) {
      console.warn('[capi] falha:', err?.message || err);
    }
  })();

  return eventId;
}

// Compat com chamada antiga
export async function dispatchCAPIPurchase({ phone, value, type = 'purchase' }) {
  return trackEvent(type === 'cancel' ? 'Purchase' : 'Purchase', { phone, value });
}
