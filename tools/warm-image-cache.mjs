// =====================================================================
// FLUXO OUTLET — Aquecedor do cache de imagens (wsrv.nl)
//
// O problema na raiz: os uploads são full-res (1–5 MB) e o wsrv transforma
// on-the-fly. Imagem FRIA = buscar o original no Supabase + redimensionar
// = segundos de "quadrado escuro" pro PRIMEIRO cliente que abre cada foto.
//
// Este script percorre o catálogo inteiro e requisita cada imagem nos
// TAMANHOS EXATOS que o site usa (mesmos parâmetros do lib/images.js,
// incluindo sharp=1 — a nitidez calibrada NÃO muda). Depois de aquecido,
// nenhum cliente real paga o custo da transformação: no pior caso paga só
// um hop de rede entre bordas do CDN.
//
// Roda no GitHub Actions a cada 6h (.github/workflows/warm-image-cache.yml)
// ou manualmente: node tools/warm-image-cache.mjs
// Knobs: WARM_LIMIT (máx de URLs), WARM_CONCURRENCY (padrão 10).
// =====================================================================

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tapgnlrjhrhewqlpahvg.supabase.co';
// Chave publicável (a mesma pública no bundle do site) — só leitura via RLS.
const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_XaGrDdX2df8qolf2WocwuQ_FsVP1-kW';

const LIMIT = Number(process.env.WARM_LIMIT || 0) || Infinity;
const CONCURRENCY = Number(process.env.WARM_CONCURRENCY || 10);

// Réplica exata de optimizeImage (src/lib/images.js) — mudar lá = mudar aqui.
const wsrvUrl = (src, w, q, sharp = 1) => {
  const clean = String(src).split('?')[0];
  return `https://wsrv.nl/?url=${encodeURIComponent(clean)}&w=${w}&q=${q}&output=webp&we&sharp=${sharp}`;
};

const isWarmable = (src) =>
  typeof src === 'string' && /^https?:\/\//.test(src) && !src.includes('images.unsplash.com');

// Tamanhos que o site realmente pede (fonte: ProductImage, ProductPageOverlay,
// CatalogMain, CartOverlay). Atualizar se os componentes mudarem.
const MAIN_SIZES = [
  [320, 88], [480, 88], [640, 88], [900, 88], [1200, 88], [1600, 88], // srcset do card E do hero (q88 unificado 2026-07-11)
  [32, 35], [40, 35],   // LQIPs (blur-up do card e do hero)
  [300, 78],            // vistos recentemente
  [400, 80],            // relacionados + sugestões da sacola
];
const GALLERY_SIZES = [
  [300, 80],                                     // miniaturas
  [640, 88], [900, 88], [1200, 88], [1600, 88],  // hero ao trocar de foto (srcset q88)
  [40, 35],                                      // LQIP do hero
];

async function fetchProducts() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/products?select=id,image,gallery,is_active&order=id.asc`,
    { headers: { apikey: ANON_KEY, authorization: `Bearer ${ANON_KEY}` } }
  );
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

async function warmOne(url) {
  const started = Date.now();
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 30_000);
    try {
      const res = await fetch(url, { signal: ctl.signal });
      // Consome o corpo inteiro: só assim a borda finaliza e guarda o objeto.
      await res.arrayBuffer();
      clearTimeout(timer);
      return { ok: res.ok, status: res.status, ms: Date.now() - started };
    } catch (e) {
      clearTimeout(timer);
      if (tentativa === 2) return { ok: false, status: 0, ms: Date.now() - started, erro: e?.message };
    }
  }
}

const products = await fetchProducts();
const ativos = products.filter((p) => p.is_active !== false);

const urls = new Set();
for (const p of ativos) {
  if (isWarmable(p.image)) {
    for (const [w, q] of MAIN_SIZES) urls.add(wsrvUrl(p.image, w, q));
  }
  const gallery = Array.isArray(p.gallery) ? p.gallery : [];
  for (const g of gallery) {
    if (!isWarmable(g)) continue;
    for (const [w, q] of GALLERY_SIZES) urls.add(wsrvUrl(g, w, q));
  }
}

const fila = [...urls].slice(0, LIMIT === Infinity ? undefined : LIMIT);
console.log(`[warm] ${ativos.length} produtos ativos → ${urls.size} URLs únicas (aquecendo ${fila.length}, concorrência ${CONCURRENCY})`);

const stats = { ok: 0, falha: 0, frias: 0, msTotal: 0 };
let cursor = 0;
async function worker() {
  while (cursor < fila.length) {
    const url = fila[cursor++];
    const r = await warmOne(url);
    stats.msTotal += r.ms;
    if (r.ok) {
      stats.ok++;
      if (r.ms > 1500) stats.frias++; // demorou = transformou agora (estava fria)
    } else {
      stats.falha++;
      console.warn(`[warm] FALHA ${r.status} ${r.erro || ''} ← ${url.slice(0, 120)}`);
    }
  }
}
const t0 = Date.now();
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const totalS = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`[warm] concluído em ${totalS}s — ok: ${stats.ok} | transformadas agora (estavam frias): ${stats.frias} | falhas: ${stats.falha} | média ${(stats.msTotal / Math.max(1, fila.length)).toFixed(0)}ms/img`);
if (stats.falha > fila.length * 0.2) {
  console.error('[warm] mais de 20% de falhas — investigar (rate limit do wsrv? Supabase fora?)');
  process.exit(1);
}
