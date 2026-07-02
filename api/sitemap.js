// FLUXO OUTLET — /sitemap.xml (Vercel Function)
// Sitemap gerado do Supabase: home + /p/:sku de cada produto ativo.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tapgnlrjhrhewqlpahvg.supabase.co';
const ANON = process.env.VITE_SUPABASE_ANON_KEY || '';
const SITE = 'https://www.fluxooutlet.com.br';

export default async function handler(req, res) {
  let rows = [];
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=id,sku,updated_at,is_active,is_kit,image&order=id`,
      { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } },
    );
    if (r.ok) rows = await r.json();
  } catch { /* sitemap mínimo */ }

  const urls = [`<url><loc>${SITE}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`];
  for (const p of rows) {
    if (p.is_active === false || p.is_kit === true || !p.image) continue;
    const id = encodeURIComponent(String(p.sku || p.id));
    const mod = p.updated_at ? `<lastmod>${String(p.updated_at).slice(0, 10)}</lastmod>` : '';
    urls.push(`<url><loc>${SITE}/p/${id}</loc>${mod}<changefreq>weekly</changefreq><priority>0.8</priority></url>`);
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.end(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`);
}
