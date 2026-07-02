// =====================================================================
// FLUXO OUTLET — /api/og-selecao?ids=0001,0002,... (Vercel Edge Function)
// Gera a IMAGEM do preview (1200x630) da seleção: mosaico de até 4 peças
// com etiqueta de preço, pro WhatsApp mostrar o "cardápio" na conversa.
// Usada como og:image pela /s/:ids (api/selecao.js).
// =====================================================================

import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tapgnlrjhrhewqlpahvg.supabase.co';
// Mesmo fallback do supabaseClient.js — chave PUBLICÁVEL (pública por design).
const ANON = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_XaGrDdX2df8qolf2WocwuQ_FsVP1-kW';

// wsrv: baixa a foto já reduzida em JPG (satori não decodifica webp; original de 1-5MB estoura o edge).
const thumb = (src, w) =>
  `https://wsrv.nl/?url=${encodeURIComponent(String(src).split('?')[0])}&w=${w}&h=${Math.round(w * 1.05)}&fit=cover&output=jpg&q=80`;

const fmtBRL = (n) => `R$ ${Number(n || 0).toFixed(2).replace('.', ',')}`;

async function fetchProducts(ids) {
  const list = ids.slice(0, 4).map((s) => `"${s.replace(/[^\w-]/g, '')}"`).join(',');
  const fields = 'sku,name,price,promotional_price,image,stock';
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/products?select=${fields}&sku=in.(${list})&limit=4`,
    { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } },
  );
  if (!r.ok) return [];
  const rows = await r.json();
  // Mantém a ordem que o vendedor mandou no link.
  const order = ids.map((s) => s.toUpperCase());
  return rows
    .filter((p) => p.image)
    .sort((a, b) => order.indexOf(String(a.sku).toUpperCase()) - order.indexOf(String(b.sku).toUpperCase()));
}

// Um tile do mosaico: foto cobrindo o espaço + etiqueta de preço no rodapé.
function tile(p, w, h) {
  const promo = Number(p.promotional_price || 0);
  const price = promo > 0 && promo < p.price ? promo : p.price;
  return {
    type: 'div',
    props: {
      style: { display: 'flex', position: 'relative', width: w, height: h, overflow: 'hidden' },
      children: [
        { type: 'img', props: { src: thumb(p.image, Math.max(w, 400)), width: w, height: h, style: { objectFit: 'cover', width: '100%', height: '100%' } } },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex', position: 'absolute', left: 12, bottom: 12,
              background: '#09090b', color: '#ffffff', padding: '6px 14px',
              borderRadius: 999, fontSize: 26, fontWeight: 700,
            },
            children: fmtBRL(price),
          },
        },
      ],
    },
  };
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const ids = String(searchParams.get('ids') || '')
    .split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4);

  let products = [];
  try { products = await fetchProducts(ids); } catch { /* cai no fallback */ }

  const W = 1200, H = 630, BAR = 76;
  const bodyH = H - BAR;

  // Layout por quantidade: 1 = inteira; 2 = lado a lado; 3 = 1 grande + 2 empilhadas; 4 = grade 2x2.
  let grid;
  if (products.length <= 1) {
    grid = products.length ? [tile(products[0], W, bodyH)] : [];
  } else if (products.length === 2) {
    grid = [tile(products[0], W / 2, bodyH), tile(products[1], W / 2, bodyH)];
  } else if (products.length === 3) {
    grid = [
      tile(products[0], W / 2, bodyH),
      {
        type: 'div',
        props: {
          style: { display: 'flex', flexDirection: 'column', width: W / 2, height: bodyH },
          children: [tile(products[1], W / 2, bodyH / 2), tile(products[2], W / 2, bodyH / 2)],
        },
      },
    ];
  } else {
    grid = [
      {
        type: 'div',
        props: {
          style: { display: 'flex', flexWrap: 'wrap', width: W, height: bodyH },
          children: products.slice(0, 4).map((p) => tile(p, W / 2, bodyH / 2)),
        },
      },
    ];
  }

  return new ImageResponse(
    {
      type: 'div',
      props: {
        style: { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#09090b' },
        children: [
          { type: 'div', props: { style: { display: 'flex', width: W, height: bodyH }, children: grid } },
          {
            type: 'div',
            props: {
              style: {
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: W, height: BAR, padding: '0 32px', background: '#09090b', color: '#ffffff',
              },
              children: [
                { type: 'div', props: { style: { display: 'flex', fontSize: 30, fontWeight: 800, letterSpacing: 4 }, children: 'FLUXO OUTLET' } },
                { type: 'div', props: { style: { display: 'flex', fontSize: 22, color: '#a1a1aa' }, children: products.length ? `Seleção montada pra você — ${products.length} peça(s)` : 'fluxooutlet.com.br' } },
              ],
            },
          },
        ],
      },
    },
    {
      width: W,
      height: H,
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    },
  );
}
