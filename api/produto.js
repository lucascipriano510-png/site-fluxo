// =====================================================================
// FLUXO OUTLET — /p/:sku (Vercel Function)
// SEO/OG por produto: bots (WhatsApp, Meta, Google) recebem HTML com meta
// tags + JSON-LD do produto; humanos são redirecionados na hora pra SPA
// (/?produto=SKU). Rewrite em vercel.json: /p/:sku -> /api/produto?sku=:sku
// =====================================================================

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tapgnlrjhrhewqlpahvg.supabase.co';
// Mesmo fallback do supabaseClient.js — chave PUBLICÁVEL (pública por design).
const ANON = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_XaGrDdX2df8qolf2WocwuQ_FsVP1-kW';
const SITE = 'https://www.fluxooutlet.com.br';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function fetchProduct(sku) {
  const fields = 'id,sku,name,description,bot_description,price,promotional_price,image,gallery,stock,is_kit,category';
  const headers = { apikey: ANON, Authorization: `Bearer ${ANON}` };
  let r = await fetch(`${SUPABASE_URL}/rest/v1/products?select=${fields}&sku=eq.${encodeURIComponent(sku)}&limit=1`, { headers });
  let rows = r.ok ? await r.json() : [];
  if (!rows.length && /^\d+$/.test(sku)) {
    r = await fetch(`${SUPABASE_URL}/rest/v1/products?select=${fields}&id=eq.${sku}&limit=1`, { headers });
    rows = r.ok ? await r.json() : [];
  }
  return rows[0] || null;
}

export default async function handler(req, res) {
  const sku = String(req.query.sku || '').slice(0, 64);
  const target = `${SITE}/?produto=${encodeURIComponent(sku)}`;

  let p = null;
  try { if (ANON && sku) p = await fetchProduct(sku); } catch { /* segue sem OG */ }

  if (!p) { res.statusCode = 302; res.setHeader('Location', sku ? target : SITE); res.end(); return; }

  const contentId = String(p.sku || p.id);
  const promo = Number(p.promotional_price || 0);
  const price = promo > 0 && promo < p.price ? promo : Number(p.price || 0);
  const desc = String(p.description || p.bot_description || `${p.name} — peça premium selecionada, Fluxo Outlet.`).replace(/\s+/g, ' ').trim();
  // og:image em JPG (WhatsApp não curte webp em preview) e ~1200px
  const ogImg = p.image ? `https://wsrv.nl/?url=${encodeURIComponent(String(p.image).split('?')[0])}&w=1200&q=85&output=jpg` : `${SITE}/og-image.jpg`;
  const canonical = `${SITE}/p/${encodeURIComponent(contentId)}`;
  const inStock = p.is_kit === true || Number(p.stock || 0) > 0;

  const ld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Product',
    name: p.name, sku: contentId,
    image: [p.image, ...(Array.isArray(p.gallery) ? p.gallery : [])].filter(Boolean),
    description: desc,
    brand: { '@type': 'Brand', name: 'Fluxo Outlet' },
    offers: {
      '@type': 'Offer', priceCurrency: 'BRL', price: price.toFixed(2), url: canonical,
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  });

  const title = `${p.name} | FLUXO OUTLET`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="Fluxo Outlet">
<meta property="og:title" content="${esc(p.name)} — R$ ${price.toFixed(2).replace('.', ',')}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(ogImg)}">
<meta property="og:url" content="${canonical}">
<meta property="product:price:amount" content="${price.toFixed(2)}">
<meta property="product:price:currency" content="BRL">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
<script>location.replace(${JSON.stringify(target)});</script>
<script type="application/ld+json">${ld}</script>
</head><body><a href="${esc(target)}">${esc(p.name)} — ver na Fluxo Outlet</a></body></html>`;

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
  res.end(html);
}
