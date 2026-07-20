// =====================================================================
// FLUXO OUTLET — Caçador de arquivos órfãos no Storage
//
// Por quê: uploadImage()/uploadVideo() (src/lib/supabase.js) sempre criam um
// arquivo NOVO (nome com timestamp+random) e nunca apagam o antigo quando uma
// foto/vídeo é trocado. Toda edição de produto/banner desde sempre deixou um
// órfão pra trás — é a causa raiz mais provável do "storage_size_exceeded"
// que bloqueou o projeto (investigação de 2026-07-20, aprendizado/pesquisas.md).
//
// O que este script faz:
//   1. Lista TODOS os arquivos dos buckets product-images e product-videos.
//   2. Lista TODA referência real a esses buckets: products.image,
//      products.gallery[], products.video_url, banners.image,
//      banners.image_desktop, banners.video_url, site_config.category_images,
//      site_config.logo_url — de TODAS as linhas (ativas ou não: um produto
//      inativo pode voltar a ficar ativo e a imagem precisa continuar lá).
//   3. Arquivo que não aparece em NENHUMA referência = órfão.
//   4. Por segurança, IGNORA arquivos enviados nas últimas ORPHAN_MIN_AGE_HOURS
//      horas (default 48h) — evita apagar algo no meio de um upload/edição
//      que ainda não foi salvo na tabela.
//
// Modo padrão = SÓ RELATÓRIO (dry-run). Pra apagar de verdade:
//   ORPHAN_DELETE=1 node tools/find-orphan-storage.mjs
//
// Credencial: prefira SUPABASE_SERVICE_ROLE_KEY (bypassa RLS, delete garantido).
// Sem ela, cai pro anon key — a policy "product-images delete"/"product-videos
// delete" já é `to public`, então o anon consegue apagar, mas rode o dry-run
// primeiro e confira a lista com calma antes de confirmar.
// =====================================================================

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tapgnlrjhrhewqlpahvg.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_XaGrDdX2df8qolf2WocwuQ_FsVP1-kW';
const KEY = SERVICE_KEY || ANON_KEY;
const USING_SERVICE_KEY = !!SERVICE_KEY;

const DELETE = process.env.ORPHAN_DELETE === '1';
const MIN_AGE_HOURS = Number(process.env.ORPHAN_MIN_AGE_HOURS || 48);
const MIN_AGE_MS = MIN_AGE_HOURS * 60 * 60_000;

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function api(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${path} -> HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

// Lista TODOS os objetos de um bucket (paginado, 1000 por página — máx do Storage API).
async function listAllObjects(bucket) {
  const all = [];
  let offset = 0;
  const limit = 1000;
  for (;;) {
    const page = await api(`/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      body: JSON.stringify({ prefix: '', limit, offset, sortBy: { column: 'name', order: 'asc' } }),
    });
    if (!Array.isArray(page) || page.length === 0) break;
    all.push(...page);
    if (page.length < limit) break;
    offset += limit;
  }
  return all;
}

// Extrai o nome de arquivo (última parte do path) de uma URL pública do Supabase Storage.
// Ignora URLs que não são deste projeto (Unsplash, etc.) — elas não vão bater
// com nenhum nome de arquivo do bucket mesmo, então não precisam de filtro extra.
function filenameFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const clean = url.split('?')[0];
    return decodeURIComponent(clean.split('/').pop() || '');
  } catch { return null; }
}

async function fetchProducts() {
  return api('/rest/v1/products?select=id,image,gallery,video_url');
}
async function fetchBanners() {
  return api('/rest/v1/banners?select=id,image,image_desktop,video_url');
}
async function fetchSiteConfig() {
  const rows = await api('/rest/v1/site_config?select=category_images,logo_url&id=eq.main&limit=1');
  return rows[0] || null;
}

// site_config.category_images: mapa categoria -> (string URL) | { url, pos }.
// Mesma normalização de src/lib/images.js getCatImgData, sem importar o módulo
// (este script roda fora do Vite, standalone — mesma lógica, réplica pequena).
function categoryImageUrls(categoryImages) {
  if (!categoryImages || typeof categoryImages !== 'object') return [];
  return Object.values(categoryImages)
    .map((v) => (typeof v === 'string' ? v : v?.url))
    .filter(Boolean);
}

console.log(`[orphans] modo: ${DELETE ? 'DELETE (apagando de verdade)' : 'DRY-RUN (só relatório, nada é apagado)'}`);
console.log(`[orphans] credencial: ${USING_SERVICE_KEY ? 'service_role' : 'anon (fallback — confira a policy de delete se falhar)'}`);
console.log(`[orphans] margem de segurança: ignora arquivos com menos de ${MIN_AGE_HOURS}h`);

const [products, banners, siteConfig, imageObjects, videoObjects] = await Promise.all([
  fetchProducts(),
  fetchBanners(),
  fetchSiteConfig(),
  listAllObjects('product-images'),
  listAllObjects('product-videos'),
]);

// Monta o conjunto de nomes de arquivo REFERENCIADOS por alguma linha do banco.
const referenced = new Set();
for (const p of products) {
  referenced.add(filenameFromUrl(p.image));
  (Array.isArray(p.gallery) ? p.gallery : []).forEach((g) => referenced.add(filenameFromUrl(g)));
  referenced.add(filenameFromUrl(p.video_url));
}
for (const b of banners) {
  referenced.add(filenameFromUrl(b.image));
  referenced.add(filenameFromUrl(b.image_desktop));
  referenced.add(filenameFromUrl(b.video_url));
}
if (siteConfig) {
  categoryImageUrls(siteConfig.category_images).forEach((u) => referenced.add(filenameFromUrl(u)));
  referenced.add(filenameFromUrl(siteConfig.logo_url));
}
referenced.delete(null);
referenced.delete('');

console.log(`[orphans] ${products.length} produtos, ${banners.length} banners, ${referenced.size} nomes de arquivo referenciados no total`);

const now = Date.now();
function findOrphans(objects, bucketLabel) {
  const orphans = [];
  let totalBytes = 0, skippedRecent = 0;
  for (const obj of objects) {
    totalBytes += obj.metadata?.size || 0;
    if (referenced.has(obj.name)) continue;
    const createdAt = obj.created_at ? new Date(obj.created_at).getTime() : 0;
    if (createdAt && now - createdAt < MIN_AGE_MS) { skippedRecent++; continue; }
    orphans.push(obj);
  }
  const orphanBytes = orphans.reduce((s, o) => s + (o.metadata?.size || 0), 0);
  console.log(`\n[orphans] bucket ${bucketLabel}: ${objects.length} arquivos (${(totalBytes / 1024 / 1024).toFixed(1)}MB total)`);
  console.log(`[orphans]   → ${orphans.length} órfãos (${(orphanBytes / 1024 / 1024).toFixed(1)}MB) | ${skippedRecent} recentes ignorados (<${MIN_AGE_HOURS}h)`);
  return orphans;
}

const orphanImages = findOrphans(imageObjects, 'product-images');
const orphanVideos = findOrphans(videoObjects, 'product-videos');

if (orphanImages.length === 0 && orphanVideos.length === 0) {
  console.log('\n[orphans] nada pra limpar — nenhum órfão encontrado.');
  process.exit(0);
}

const listPreview = (arr) => arr.slice(0, 20).map((o) => `  - uploads/${o.name}  (${((o.metadata?.size || 0) / 1024).toFixed(0)}KB, criado ${o.created_at})`).join('\n');
if (orphanImages.length > 0) { console.log('\n[orphans] product-images (amostra até 20):'); console.log(listPreview(orphanImages)); }
if (orphanVideos.length > 0) { console.log('\n[orphans] product-videos (amostra até 20):'); console.log(listPreview(orphanVideos)); }

if (!DELETE) {
  console.log('\n[orphans] DRY-RUN: nada foi apagado. Confira a lista acima e rode de novo com ORPHAN_DELETE=1 pra apagar.');
  process.exit(0);
}

// Apaga em lotes (bulk delete endpoint aceita várias prefixes por chamada).
async function removeBatch(bucket, names) {
  const chunks = [];
  for (let i = 0; i < names.length; i += 100) chunks.push(names.slice(i, i + 100));
  let removed = 0;
  for (const chunk of chunks) {
    await api(`/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      body: JSON.stringify({ prefixes: chunk.map((n) => `uploads/${n}`) }),
    });
    removed += chunk.length;
    console.log(`[orphans] ${bucket}: apagados ${removed}/${names.length}`);
  }
}

if (orphanImages.length > 0) await removeBatch('product-images', orphanImages.map((o) => o.name));
if (orphanVideos.length > 0) await removeBatch('product-videos', orphanVideos.map((o) => o.name));

const freedMB = ([...orphanImages, ...orphanVideos].reduce((s, o) => s + (o.metadata?.size || 0), 0) / 1024 / 1024).toFixed(1);
console.log(`\n[orphans] concluído — ${orphanImages.length + orphanVideos.length} arquivos apagados, ~${freedMB}MB liberados.`);
