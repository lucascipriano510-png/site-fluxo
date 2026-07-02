// =====================================================================
// FLUXO OUTLET — /status/:sku (Vercel Edge Function)
// Arte PRONTA pra Status do WhatsApp / Stories (1080x1920), com direção
// de arte de drop de streetwear. 3 estilos no mesmo template:
//   ?style=poster (padrão) — foto full-bleed + degradê + preço gigante
//   ?style=drop           — bold typography + etiqueta de preço rotacionada
//   ?style=neon           — moldura com glow esmeralda, vibe vitrine de rua
// Uso: abrir fluxooutlet.com.br/status/0001 no celular -> salvar -> postar.
// Rewrite em vercel.json: /status/:sku -> /api/og-status?sku=:sku
// =====================================================================

import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tapgnlrjhrhewqlpahvg.supabase.co';
// Mesmo fallback do supabaseClient.js — chave PUBLICÁVEL (pública por design).
const ANON = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_XaGrDdX2df8qolf2WocwuQ_FsVP1-kW';

const thumb = (src, w, h) =>
  `https://wsrv.nl/?url=${encodeURIComponent(String(src).split('?')[0])}&w=${w}&h=${h}&fit=cover&output=jpg&q=85`;

const fmtBRL = (n) => `R$ ${Number(n || 0).toFixed(2).replace('.', ',')}`;

// Fonte de poster (Archivo Black) — satori não aceita woff2; TTF do repo oficial
// do Google Fonts. Cache em módulo: baixa 1x por instância, não por request.
let _fontPromise = null;
function getFont() {
  if (!_fontPromise) {
    _fontPromise = fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/archivoblack/ArchivoBlack-Regular.ttf')
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null);
  }
  return _fontPromise;
}

async function fetchProduct(sku) {
  const fields = 'id,sku,name,price,promotional_price,offer_active,offer_discount_percent,offer_ends_at,image';
  const headers = { apikey: ANON, Authorization: `Bearer ${ANON}` };
  const clean = sku.replace(/[^\w-]/g, '');
  let r = await fetch(`${SUPABASE_URL}/rest/v1/products?select=${fields}&sku=eq.${encodeURIComponent(clean)}&limit=1`, { headers });
  let rows = r.ok ? await r.json() : [];
  if (!rows.length && /^\d+$/.test(clean)) {
    r = await fetch(`${SUPABASE_URL}/rest/v1/products?select=${fields}&id=eq.${clean}&limit=1`, { headers });
    rows = r.ok ? await r.json() : [];
  }
  return rows[0] || null;
}

const div = (style, children) => ({ type: 'div', props: { style: { display: 'flex', ...style }, children } });
const txt = (style, s) => ({ type: 'div', props: { style: { display: 'flex', ...style }, children: s } });

const W = 1080, H = 1920;
const ZINC950 = '#09090b', EMERALD = '#10b981', AMBER = '#fbbf24';

// ── ESTILO 1: POSTER (padrão) — foto full-bleed, degradê, preço gigante ──────
function stylePoster(p, price, sale, offerLive) {
  const img = { type: 'img', props: { src: thumb(p.image, W, H), width: W, height: H, style: { objectFit: 'cover', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' } } };
  const shade = div({ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(180deg, rgba(9,9,11,0.55) 0%, rgba(9,9,11,0) 22%, rgba(9,9,11,0) 46%, rgba(9,9,11,0.94) 82%)' }, []);

  const topBar = div({ position: 'absolute', top: 56, left: 64, right: 64, alignItems: 'center', justifyContent: 'space-between' }, [
    txt({ fontFamily: 'Archivo', fontSize: 46, color: '#fff', letterSpacing: 8 }, 'FLUXO OUTLET'),
    offerLive
      ? txt({ fontFamily: 'Archivo', fontSize: 26, color: ZINC950, background: AMBER, padding: '12px 26px', borderRadius: 999, letterSpacing: 3 }, 'OFERTA DO DIA 🔥')
      : txt({ fontFamily: 'Archivo', fontSize: 26, color: '#fff', border: '3px solid rgba(255,255,255,0.85)', padding: '10px 26px', borderRadius: 999, letterSpacing: 3 }, 'DROP NOVO'),
  ]);

  const priceBlock = sale != null
    ? [
        txt({ fontSize: 46, color: '#d4d4d8', textDecoration: 'line-through' }, `de ${fmtBRL(price)}`),
        txt({ fontFamily: 'Archivo', fontSize: 150, color: AMBER, lineHeight: 1 }, fmtBRL(sale)),
      ]
    : [txt({ fontFamily: 'Archivo', fontSize: 150, color: '#fff', lineHeight: 1 }, fmtBRL(price))];

  const bottom = div({ position: 'absolute', left: 64, right: 64, bottom: 72, flexDirection: 'column', gap: 18 }, [
    div({ width: 130, height: 10, background: sale != null ? AMBER : EMERALD }, []),
    txt({ fontFamily: 'Archivo', fontSize: 58, color: '#fff', textTransform: 'uppercase', lineHeight: 1.1 }, String(p.name || '').slice(0, 34)),
    ...priceBlock,
    txt({ fontSize: 30, color: '#a1a1aa', letterSpacing: 2 }, 'responde esse status e garante a sua 📲'),
  ]);

  return div({ position: 'relative', width: '100%', height: '100%', background: ZINC950 }, [img, shade, topBar, bottom]);
}

// ── ESTILO 2: DROP — bold typography, etiqueta rotacionada, barras diagonais ─
function styleDrop(p, price, sale, offerLive) {
  const IMG_H = 1150;
  const stripe = (top, rot) => div({ position: 'absolute', top, left: -100, width: W + 200, height: 54, background: sale != null ? AMBER : EMERALD, transform: `rotate(${rot}deg)`, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, [
    txt({ fontFamily: 'Archivo', fontSize: 30, color: ZINC950, letterSpacing: 6, whiteSpace: 'nowrap' }, 'FLUXO OUTLET • FLUXO OUTLET • FLUXO OUTLET • FLUXO OUTLET • FLUXO OUTLET'),
  ]);

  const sticker = div({
    position: 'absolute', right: 48, top: IMG_H + 150 - 90, transform: 'rotate(-5deg)',
    flexDirection: 'column', alignItems: 'center', background: sale != null ? AMBER : '#fff',
    padding: '26px 42px', borderRadius: 24, boxShadow: '0 18px 40px rgba(0,0,0,0.55)',
  }, [
    ...(sale != null ? [txt({ fontSize: 34, color: '#3f3f46', textDecoration: 'line-through' }, fmtBRL(price))] : []),
    txt({ fontFamily: 'Archivo', fontSize: 92, color: ZINC950, lineHeight: 1 }, fmtBRL(sale != null ? sale : price)),
    ...(sale != null && offerLive ? [txt({ fontFamily: 'Archivo', fontSize: 24, color: ZINC950, letterSpacing: 3 }, 'OFERTA DO DIA 🔥')] : []),
  ]);

  return div({ flexDirection: 'column', width: '100%', height: '100%', background: 'linear-gradient(180deg, #1c1c1f 0%, #09090b 60%)', position: 'relative' }, [
    stripe(96, -3),
    div({ position: 'absolute', top: 220, left: 0, width: W, height: IMG_H, overflow: 'hidden' }, [
      { type: 'img', props: { src: thumb(p.image, W, IMG_H), width: W, height: IMG_H, style: { objectFit: 'cover', width: '100%', height: '100%' } } },
    ]),
    sticker,
    div({ position: 'absolute', left: 56, right: 56, top: IMG_H + 300, flexDirection: 'column', gap: 16 }, [
      txt({ fontFamily: 'Archivo', fontSize: 84, color: '#fff', textTransform: 'uppercase', lineHeight: 1.02 }, String(p.name || '').slice(0, 26)),
      txt({ fontSize: 32, color: '#a1a1aa', letterSpacing: 2 }, 'peça premium selecionada • Uberaba-MG'),
    ]),
    stripe(H - 140, -3),
  ]);
}

// ── ESTILO 3: NEON — moldura com glow, vitrine de rua ────────────────────────
function styleNeon(p, price, sale, offerLive) {
  const glow = sale != null ? AMBER : EMERALD;
  const IMG_H = 1180;
  return div({ flexDirection: 'column', width: '100%', height: '100%', background: ZINC950, position: 'relative', padding: 40 }, [
    div({ flexDirection: 'column', width: '100%', height: '100%', border: `5px solid ${glow}`, borderRadius: 36, boxShadow: `0 0 90px ${glow}66, inset 0 0 60px ${glow}22`, overflow: 'hidden', alignItems: 'center' }, [
      div({ height: 130, alignItems: 'center', justifyContent: 'center', gap: 20 }, [
        txt({ fontFamily: 'Archivo', fontSize: 46, color: '#fff', letterSpacing: 10, textShadow: `0 0 30px ${glow}` }, 'FLUXO OUTLET'),
      ]),
      div({ width: W - 80 - 10, height: IMG_H, overflow: 'hidden' }, [
        { type: 'img', props: { src: thumb(p.image, W - 90, IMG_H), width: W - 90, height: IMG_H, style: { objectFit: 'cover', width: '100%', height: '100%' } } },
      ]),
      div({ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, gap: 14, padding: '0 60px' }, [
        txt({ fontFamily: 'Archivo', fontSize: 52, color: '#fff', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.05 }, String(p.name || '').slice(0, 30)),
        div({ alignItems: 'flex-end', gap: 22 }, [
          ...(sale != null ? [txt({ fontSize: 40, color: '#71717a', textDecoration: 'line-through' }, fmtBRL(price))] : []),
          txt({ fontFamily: 'Archivo', fontSize: 118, color: glow, lineHeight: 1, textShadow: `0 0 44px ${glow}` }, fmtBRL(sale != null ? sale : price)),
        ]),
        txt({ fontSize: 28, color: '#a1a1aa', letterSpacing: 3 }, offerLive ? 'OFERTA DO DIA — CORRE 🔥' : 'responde esse status e garante 📲'),
      ]),
    ]),
  ]);
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const sku = String(searchParams.get('sku') || '').slice(0, 64);
  const style = String(searchParams.get('style') || 'poster');

  let p = null;
  try { if (sku) p = await fetchProduct(sku); } catch { /* cai no 404 */ }
  if (!p || !p.image) return new Response('produto não encontrado', { status: 404 });

  // Mesma lógica de preço do feed: Oferta do Dia viva > preço promocional.
  const price = Number(p.price || 0);
  let sale = null;
  const pct = Number(p.offer_discount_percent || 0);
  const offerLive = p.offer_active === true && pct > 0 &&
    p.offer_ends_at && new Date(p.offer_ends_at).getTime() > Date.now();
  if (offerLive) sale = price * (1 - pct / 100);
  else if (Number(p.promotional_price || 0) > 0 && Number(p.promotional_price) < price) sale = Number(p.promotional_price);

  const body =
    style === 'drop' ? styleDrop(p, price, sale, offerLive) :
    style === 'neon' ? styleNeon(p, price, sale, offerLive) :
    stylePoster(p, price, sale, offerLive);

  const fontData = await getFont();
  return new ImageResponse(body, {
    width: W,
    height: H,
    // Sem a fonte (fetch falhou) satori cai na padrão — a arte sai igual, menos "poster".
    ...(fontData ? { fonts: [{ name: 'Archivo', data: fontData, style: 'normal', weight: 400 }] } : {}),
    headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' },
  });
}
