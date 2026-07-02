// Lista produtos que precisam de cor/descrição e baixa as imagens localmente
// pra eu (Claude) olhar e preencher. Não grava nada no catálogo.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMG_DIR = path.join(__dirname, '_enrich_imgs');
const OUT = path.join(__dirname, '_enrich_pending.json');
fs.mkdirSync(IMG_DIR, { recursive: true });

const URL = process.env.SITE_SUPABASE_URL || 'https://tapgnlrjhrhewqlpahvg.supabase.co';
const KEY = process.env.SITE_SUPABASE_ANON_KEY || 'sb_publishable_XaGrDdX2df8qolf2WocwuQ_FsVP1-kW';
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const isEmpty = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);
const LIMIT = Number(process.argv.find(a => /^\d+$/.test(a))) || Infinity;

const { data: products, error } = await supabase
  .from('products')
  .select('id,name,category,subcategory,color,secondary_colors,product_type,bot_description,image,gallery,is_kit')
  .order('id');
if (error) { console.log('ERRO:', error.message); process.exit(1); }

const pending = (products || []).filter(p => {
  if (p.is_kit) return false;
  const img = p.image || (Array.isArray(p.gallery) && p.gallery[0]);
  if (!img) return false;
  return isEmpty(p.color) || isEmpty(p.secondary_colors) || isEmpty(p.bot_description);
});

console.log(`Catálogo: ${products.length} | pendentes: ${pending.length}`);

const list = [];
let i = 0;
for (const p of pending) {
  if (i >= LIMIT) break;
  i++;
  const src = p.image || p.gallery[0];
  // baixa otimizada (webp 600px) pra ficar leve
  const url = `https://wsrv.nl/?url=${encodeURIComponent(src.split('?')[0])}&w=600&output=jpg&q=80`;
  const file = path.join(IMG_DIR, `${p.id}.jpg`);
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    list.push({ id: p.id, name: p.name, category: p.category, subcategory: p.subcategory, color: p.color, secondary_colors: p.secondary_colors, product_type: p.product_type, bot_description: p.bot_description, img: file });
  } catch (e) {
    console.log(`  ⚠️ ${p.id} ${p.name}: imagem falhou (${e.message})`);
  }
}
fs.writeFileSync(OUT, JSON.stringify(list, null, 2));
console.log(`Baixadas: ${list.length} imagens em scripts/_enrich_imgs/`);
console.log(`Lista: scripts/_enrich_pending.json`);
list.forEach(p => console.log(`  ${p.id} | ${p.name} | cor atual: ${p.color || '—'}`));
