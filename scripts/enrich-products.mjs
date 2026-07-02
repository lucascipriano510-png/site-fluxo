// ═══════════════════════════════════════════════════════════════════════════
//  enrich-products.mjs — Classifica o catálogo por VISÃO (Gemini) e PREENCHE
//  no Supabase do site: color, secondary_colors, product_type, bot_description,
//  search_tags — olhando a FOTO de cada produto.
//
//  Seguro:
//   - Por padrão só preenche campo VAZIO (não sobrescreve o que você ajustou).
//     Use --force pra reclassificar tudo.
//   - Resumível: grava progresso em scripts/enrich-progress.json. Se parar,
//     rodar de novo continua de onde parou.
//   - Throttle + backoff (respeita o free tier do Gemini).
//   - --dry: só mostra o que faria, sem gravar.
//
//  Uso:
//    GEMINI_API_KEY=xxx node scripts/enrich-products.mjs            # todos os pendentes
//    GEMINI_API_KEY=xxx node scripts/enrich-products.mjs 10         # lote de 10
//    GEMINI_API_KEY=xxx node scripts/enrich-products.mjs --dry 5    # preview de 5
//    GEMINI_API_KEY=xxx node scripts/enrich-products.mjs --force    # reclassifica tudo
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const FORCE = args.includes('--force');
const LIMIT = Number(args.find(a => /^\d+$/.test(a))) || Infinity;

const KEY = process.env.GEMINI_API_KEY || process.env.AI_ASSIST_KEY;
const MODEL = process.env.ENRICH_MODEL || 'gemini-2.0-flash';
const THROTTLE_MS = Number(process.env.ENRICH_THROTTLE_MS) || 4500;
const OUT = path.join(__dirname, 'enrich-progress.json');

const SUPABASE_URL = process.env.SITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://tapgnlrjhrhewqlpahvg.supabase.co';
const SUPABASE_KEY = process.env.SITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_XaGrDdX2df8qolf2WocwuQ_FsVP1-kW';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!KEY) { console.log('❌ Sem chave do Gemini. Rode com GEMINI_API_KEY=...'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const CORES = 'preto, branco, cinza, azul, azul marinho, vermelho, verde, amarelo, laranja, rosa, roxo, lilas, marrom, bege, nude, caramelo, vinho, dourado, prata, off white, estampado';
const PROMPT = `Você analisa a FOTO de uma peça de roupa/produto de uma loja (outlet brasileiro).
Responda SOMENTE um JSON válido, sem texto extra:
{"cor":"<cor principal em pt-br>","cor_secundaria":["<0 a 2 cores secundárias reais da peça; [] se for lisa/sólida>"],"tipo":"<ex: camiseta, polo, calça jeans, bermuda, tênis, boné>","descricao":"<1 ou 2 frases curtas e vendedoras em pt-br, sem inventar marca>","tags":["3 a 6 palavras-chave de busca em pt-br"]}
Use preferencialmente estas cores: ${CORES}.`;

function loadDone() { try { return JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { return {}; } }
function saveOne(map, id, obj) { map[id] = obj; fs.writeFileSync(OUT, JSON.stringify(map, null, 2)); }

async function fetchImageB64(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`img HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return { data: buf.toString('base64'), mime: r.headers.get('content-type') || 'image/jpeg' };
}

async function callVision(b64, mime) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;
  const body = {
    contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mime, data: b64 } }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 600, responseMimeType: 'application/json' },
  };
  let r;
  try { r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  catch (e) { return { ok: false, error: 'network: ' + e.message }; }
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = j?.error?.message || `HTTP ${r.status}`;
    const quota = /quota|exhausted|billing|per day|daily limit/i.test(msg);
    const transient = !quota && (/high demand|overloaded|try again|unavailable|temporar|deadline|50\d/i.test(msg) || r.status >= 500 || r.status === 429);
    const m = msg.match(/retry in ([\d.]+)s/i);
    return { ok: false, rateLimited: quota, transient, retryAfterMs: m ? Math.ceil(parseFloat(m[1]) * 1000) : null, error: msg };
  }
  const text = j?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { ok: false, error: 'sem JSON' };
  try { return { ok: true, data: JSON.parse(m[0]) }; } catch { return { ok: false, error: 'JSON inválido' }; }
}

const norm = (s) => String(s || '').trim().toLowerCase();
const isEmpty = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);

// Monta só o patch dos campos que devem ser preenchidos.
function buildPatch(p, ai) {
  const patch = {};
  if (ai.cor && (FORCE || isEmpty(p.color))) patch.color = norm(ai.cor);
  if (Array.isArray(ai.cor_secundaria)) {
    const sec = ai.cor_secundaria.map(norm).filter(c => c && c !== norm(ai.cor));
    if (sec.length && (FORCE || isEmpty(p.secondary_colors))) patch.secondary_colors = sec;
  }
  if (ai.tipo && (FORCE || isEmpty(p.product_type))) patch.product_type = norm(ai.tipo);
  if (ai.descricao && (FORCE || isEmpty(p.bot_description))) patch.bot_description = String(ai.descricao).trim();
  if (Array.isArray(ai.tags) && ai.tags.length && (FORCE || isEmpty(p.search_tags))) {
    patch.search_tags = ai.tags.map(norm).filter(Boolean).slice(0, 6);
  }
  return patch;
}

const { data: products, error } = await supabase
  .from('products')
  .select('id,name,category,subcategory,color,secondary_colors,product_type,bot_description,search_tags,image,gallery,is_kit')
  .order('id');
if (error) { console.log('ERRO lendo products:', error.message); process.exit(1); }

const done = loadDone();
const pending = (products || []).filter(p => {
  if (p.is_kit) return false;
  const img = p.image || (Array.isArray(p.gallery) && p.gallery[0]);
  if (!img) return false;
  if (done[p.id] && !FORCE) return false;
  if (!FORCE) {
    // já tem tudo que importa? pula
    if (!isEmpty(p.color) && !isEmpty(p.secondary_colors) && !isEmpty(p.bot_description)) return false;
  }
  return true;
});

console.log(`Catálogo: ${products.length} | pendentes: ${pending.length} | modo: ${DRY ? 'DRY (preview)' : FORCE ? 'FORCE (sobrescreve)' : 'preenche vazios'} | lote: ${LIMIT === Infinity ? 'todos' : LIMIT}`);

let ok = 0, err = 0, processed = 0, quotaPauses = 0;
for (const p of pending) {
  if (processed >= LIMIT) break;
  processed++;
  const tag = `[${processed}] ${(p.name || p.subcategory || p.category || p.id).toString().slice(0, 40)}`;
  let img;
  try { img = await fetchImageB64(p.image || p.gallery[0]); }
  catch (e) { console.log(`  ⚠️ ${tag}: imagem (${e.message}) — pulado`); err++; continue; }

  const waits = [5000, 12000, 25000];
  let res, t = 0;
  while (true) {
    res = await callVision(img.data, img.mime);
    if (res.ok) break;
    if (res.rateLimited) {
      if (quotaPauses >= 60) { console.log(`\n🛑 Cota esgotada — parando. Rode de novo depois (continua).`); process.exit(0); }
      quotaPauses++; await sleep((res.retryAfterMs && res.retryAfterMs <= 120000 ? res.retryAfterMs : 45000) + 3000); continue;
    }
    if (res.transient) { if (t >= waits.length) break; await sleep(waits[t++]); continue; }
    break;
  }
  if (!res.ok) { console.log(`  ⚠️ ${tag}: ${res.error}`); err++; await sleep(THROTTLE_MS); continue; }

  const patch = buildPatch(p, res.data);
  const resumo = `cor=${res.data.cor}${(res.data.cor_secundaria||[]).length ? ' +'+res.data.cor_secundaria.join('/') : ''} tipo=${res.data.tipo}`;
  if (Object.keys(patch).length === 0) { console.log(`  ⏭️  ${tag}: nada a preencher (${resumo})`); saveOne(done, p.id, res.data); await sleep(THROTTLE_MS); continue; }

  if (DRY) {
    console.log(`  👁️  ${tag}: ${resumo} → ${JSON.stringify(patch)}`);
  } else {
    const { error: upErr } = await supabase.from('products').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', p.id);
    if (upErr) { console.log(`  ❌ ${tag}: gravar (${upErr.message})`); err++; await sleep(THROTTLE_MS); continue; }
    console.log(`  ✅ ${tag}: ${resumo}`);
  }
  saveOne(done, p.id, res.data);
  ok++;
  await sleep(THROTTLE_MS);
}

console.log(`\nFim do lote. ✅ ${ok} | ⚠️ ${err} | progresso: scripts/enrich-progress.json`);
