// =====================================================================
// FLUXO OUTLET — Edge Function: google-catalog
// Feed CSV pro GOOGLE MERCHANT CENTER (free listings / aba Shopping).
// Irmã do meta-catalog (NÃO mexer lá: feed da Meta já aprovado e rodando).
// Diferenças pro Google:
//   - link = /p/:sku (canônica, mesma do sitemap; OG + JSON-LD por produto)
//   - identifier_exists=no (roupa de outlet sem GTIN/código de barras —
//     sem isso o Google reprova os itens por "identificador ausente")
//   - google_product_category mapeada por categoria do site
//
// URL do feed (colar no Merchant Center em "Feed programado"):
//   https://<project>.supabase.co/functions/v1/google-catalog?token=<FEED_TOKEN>
//
// Auth: token na query string (o fetcher do Google não manda Authorization
// header → verify_jwt=false, mesmo padrão do meta-catalog). Dados = os
// mesmos públicos do site.
// =====================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const FEED_TOKEN = 'flx-feed-x7K2m9Qw4Zr8pT3v';
const SITE_URL = 'https://www.fluxooutlet.com.br';
const BRAND = 'Fluxo Outlet';

const FN_VERSION = '2026-07-02.1';

// Categoria do site → taxonomia oficial do Google Shopping.
// Chaves normalizadas com trim+uppercase (a categoria "ÓCULOS " tem espaço no banco).
const GOOGLE_CATEGORY: Record<string, string> = {
  'CAMISA':  'Apparel & Accessories > Clothing > Shirts & Tops',
  'CALÇA':   'Apparel & Accessories > Clothing > Pants',
  'BERMUDA': 'Apparel & Accessories > Clothing > Shorts',
  'TÊNIS':   'Apparel & Accessories > Shoes',
  'CHINELO': 'Apparel & Accessories > Shoes',
  'ÓCULOS':  'Apparel & Accessories > Clothing Accessories > Sunglasses',
};

// Escapa um campo CSV (aspas, vírgulas, quebras de linha).
function csv(v: unknown): string {
  const s = String(v ?? '').replace(/\r?\n/g, ' ').trim();
  return `"${s.replace(/"/g, '""')}"`;
}

function moneyBRL(n: number): string {
  return `${(Math.round(n * 100) / 100).toFixed(2)} BRL`;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get('token') !== FEED_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await admin
    .from('products')
    .select('id, sku, name, description, bot_description, price, promotional_price, offer_active, offer_discount_percent, offer_ends_at, stock, image, gallery, category, subcategory, color, material, is_kit, is_active')
    .order('id', { ascending: true });

  if (error) {
    return new Response(`feed error: ${error.message}`, { status: 500 });
  }

  const now = Date.now();
  const header = [
    'id', 'title', 'description', 'availability', 'condition',
    'price', 'sale_price', 'link', 'image_link', 'additional_image_link',
    'brand', 'color', 'material', 'product_type',
    'google_product_category', 'identifier_exists',
  ].join(',');

  const lines: string[] = [header];

  for (const p of data || []) {
    if (p.is_kit === true) continue;            // kit não tem estoque próprio
    if (p.is_active === false) continue;
    if (!p.image) continue;                     // Google exige image_link
    const price = Number(p.price || 0);
    if (price <= 0) continue;                   // Google exige preço > 0

    // Mesmo id do feed Meta e do Pixel (String(sku || id)) — um id só em todo lugar.
    const contentId = String(p.sku || p.id);

    // sale_price: Oferta do Dia viva tem prioridade; senão preço promocional.
    let sale: number | null = null;
    const pct = Number(p.offer_discount_percent || 0);
    const offerLive = p.offer_active === true && pct > 0 &&
      p.offer_ends_at && new Date(p.offer_ends_at).getTime() > now;
    if (offerLive) {
      sale = price * (1 - pct / 100);
    } else if (Number(p.promotional_price || 0) > 0 && Number(p.promotional_price) < price) {
      sale = Number(p.promotional_price);
    }

    const description = String(p.description || p.bot_description || '').trim()
      || `${p.name} — peça premium selecionada, Fluxo Outlet.`;

    const gallery = (Array.isArray(p.gallery) ? p.gallery : []).filter(Boolean).slice(0, 10);
    const catKey = String(p.category || '').trim().toUpperCase();

    lines.push([
      csv(contentId),
      csv(p.name),
      csv(description),
      csv(Number(p.stock || 0) > 0 ? 'in stock' : 'out of stock'),
      csv('new'),
      csv(moneyBRL(price)),
      csv(sale != null ? moneyBRL(sale) : ''),
      csv(`${SITE_URL}/p/${encodeURIComponent(contentId)}`),
      csv(p.image),
      csv(gallery.join(',')),
      csv(BRAND),
      csv(p.color || ''),
      csv(p.material || ''),
      csv([p.category, p.subcategory].filter(Boolean).join(' > ')),
      csv(GOOGLE_CATEGORY[catKey] || 'Apparel & Accessories'),
      csv('no'),
    ].join(','));
  }

  console.log(`[google-catalog] v${FN_VERSION} feed servido: ${lines.length - 1} itens`);

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
});
