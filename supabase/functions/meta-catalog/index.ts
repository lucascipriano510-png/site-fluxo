// =====================================================================
// FLUXO OUTLET — Edge Function: meta-catalog
// Feed CSV de produtos pro CATÁLOGO DO META (Gerenciador de Comércio).
// O Meta busca esta URL sozinho (agendado) e mantém o catálogo em sincronia
// com a tabela `products`: estoque zerou -> "out of stock"; produto novo
// entra; oferta viva vira sale_price.
//
// URL do feed (colar no Meta em "Usar um URL"):
//   https://<project>.supabase.co/functions/v1/meta-catalog?token=<FEED_TOKEN>
//
// Auth: token na query string (o fetcher do Meta não manda Authorization
// header, então a função é deployada com verify_jwt=false e valida o token
// aqui). Os dados são os mesmos públicos do site — o token só evita scraping
// preguiçoso do CSV pronto.
//
// IMPORTANTE (dedup com Pixel/CAPI): o `id` de cada item é o MESMO valor que
// o site manda em content_ids (String(sku || id)) — é isso que liga o evento
// ViewContent/AddToCart/Purchase ao item do catálogo no anúncio dinâmico.
// =====================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const FEED_TOKEN = 'flx-feed-x7K2m9Qw4Zr8pT3v';
const SITE_URL = 'https://www.fluxooutlet.com.br';
const BRAND = 'Fluxo Outlet';

const FN_VERSION = '2026-07-02.1';

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
  ].join(',');

  const lines: string[] = [header];

  for (const p of data || []) {
    if (p.is_kit === true) continue;            // kit não tem estoque próprio
    if (p.is_active === false) continue;
    if (!p.image) continue;                     // Meta exige image_link
    const price = Number(p.price || 0);
    if (price <= 0) continue;                   // Meta exige preço > 0

    // Mesmo id que o Pixel/CAPI manda em content_ids (dedup do anúncio dinâmico).
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

    lines.push([
      csv(contentId),
      csv(p.name),
      csv(description),
      csv(Number(p.stock || 0) > 0 ? 'in stock' : 'out of stock'),
      csv('new'),
      csv(moneyBRL(price)),
      csv(sale != null ? moneyBRL(sale) : ''),
      csv(`${SITE_URL}/?produto=${encodeURIComponent(contentId)}`),
      csv(p.image),
      csv(gallery.join(',')),
      csv(BRAND),
      csv(p.color || ''),
      csv(p.material || ''),
      csv([p.category, p.subcategory].filter(Boolean).join(' > ')),
    ].join(','));
  }

  console.log(`[meta-catalog] v${FN_VERSION} feed servido: ${lines.length - 1} itens`);

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
});
