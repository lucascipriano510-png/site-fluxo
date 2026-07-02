// =====================================================================
// FLUXO OUTLET — /status/:sku (Vercel Edge Function)
// Arte PRONTA pra Status do WhatsApp / Stories (1080x1920): foto grande,
// nome, preço (com "de/por" quando tem promoção ou Oferta do Dia) e marca.
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

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const sku = String(searchParams.get('sku') || '').slice(0, 64);

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

  const W = 1080, H = 1920, IMG_H = 1400;

  const priceRow = sale != null
    ? [
        { type: 'div', props: { style: { display: 'flex', fontSize: 44, color: '#71717a', textDecoration: 'line-through' }, children: fmtBRL(price) } },
        { type: 'div', props: { style: { display: 'flex', fontSize: 92, fontWeight: 800, color: '#fbbf24' }, children: fmtBRL(sale) } },
      ]
    : [
        { type: 'div', props: { style: { display: 'flex', fontSize: 92, fontWeight: 800, color: '#10b981' }, children: fmtBRL(price) } },
      ];

  return new ImageResponse(
    {
      type: 'div',
      props: {
        style: { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#09090b' },
        children: [
          // Topo: marca
          {
            type: 'div',
            props: {
              style: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: 110 },
              children: [{ type: 'div', props: { style: { display: 'flex', fontSize: 44, fontWeight: 800, letterSpacing: 10, color: '#ffffff' }, children: 'FLUXO OUTLET' } }],
            },
          },
          // Foto
          {
            type: 'div',
            props: {
              style: { display: 'flex', width: W, height: IMG_H, overflow: 'hidden' },
              children: [{ type: 'img', props: { src: thumb(p.image, W, IMG_H), width: W, height: IMG_H, style: { objectFit: 'cover', width: '100%', height: '100%' } } }],
            },
          },
          // Rodapé: nome + preço + selo de oferta
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, padding: '0 60px', gap: 10 },
              children: [
                { type: 'div', props: { style: { display: 'flex', fontSize: 46, fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', textAlign: 'center' }, children: String(p.name || '').slice(0, 40) } },
                { type: 'div', props: { style: { display: 'flex', alignItems: 'flex-end', gap: 24 }, children: priceRow } },
                ...(sale != null ? [{ type: 'div', props: { style: { display: 'flex', fontSize: 30, fontWeight: 800, color: '#09090b', background: '#fbbf24', padding: '8px 26px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 3 }, children: offerLive ? 'Oferta do dia 🔥' : 'Promoção 🔥' } }] : []),
              ],
            },
          },
        ],
      },
    },
    {
      width: W,
      height: H,
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' },
    },
  );
}
