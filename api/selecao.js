// =====================================================================
// FLUXO OUTLET — /s/:ids (Vercel Function)
// Link de SELEÇÃO CURADA: /s/0001,0002,0003 — o vendedor manda um link,
// o WhatsApp mostra um MOSAICO das peças (og:image = /api/og-selecao) e,
// ao abrir, o cliente cai na vitrine só com essas peças (/?selecao=...).
// Mesmo padrão da /p/:sku (api/produto.js): bots recebem HTML com OG;
// humanos são redirecionados na hora pra SPA.
// Rewrite em vercel.json: /s/:ids -> /api/selecao?ids=:ids
// =====================================================================

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tapgnlrjhrhewqlpahvg.supabase.co';
// Mesmo fallback do supabaseClient.js — chave PUBLICÁVEL (pública por design).
const ANON = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_XaGrDdX2df8qolf2WocwuQ_FsVP1-kW';
const SITE = 'https://www.fluxooutlet.com.br';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function fetchProducts(ids) {
  const list = ids.map((s) => `"${s.replace(/[^\w-]/g, '')}"`).join(',');
  const fields = 'sku,name,price,promotional_price,image,stock';
  const headers = { apikey: ANON, Authorization: `Bearer ${ANON}` };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/products?select=${fields}&sku=in.(${list})`, { headers });
  return r.ok ? await r.json() : [];
}

export default async function handler(req, res) {
  // Aceita até 12 SKUs; o mosaico usa as 4 primeiras.
  const ids = String(req.query.ids || '')
    .slice(0, 256).split(',').map((s) => s.trim()).filter(Boolean).slice(0, 12);
  const idsParam = ids.join(',');
  const target = `${SITE}/?selecao=${encodeURIComponent(idsParam)}`;

  let products = [];
  try { if (ids.length) products = await fetchProducts(ids); } catch { /* segue sem OG */ }

  if (products.length === 0) { res.statusCode = 302; res.setHeader('Location', ids.length ? target : SITE); res.end(); return; }

  const names = products.slice(0, 4).map((p) => p.name).join(' • ');
  const title = `Seleção Fluxo Outlet — ${products.length} peça(s) escolhida(s) pra você`;
  const desc = `${names}${products.length > 4 ? ' e mais…' : ''} Toca pra ver tudo e finalizar.`;
  const ogImg = `${SITE}/api/og-selecao?ids=${encodeURIComponent(ids.slice(0, 12).join(','))}`;
  const canonical = `${SITE}/s/${encodeURIComponent(idsParam)}`;

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Fluxo Outlet">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(ogImg)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
<script>location.replace(${JSON.stringify(target)});</script>
</head><body><a href="${esc(target)}">${esc(title)} — ver na Fluxo Outlet</a></body></html>`;

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
  res.end(html);
}
