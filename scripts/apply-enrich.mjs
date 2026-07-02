// Aplica no catálogo as classificações que EU (Claude) fiz olhando as fotos.
// Lê scripts/_apply.json = { "<id>": {color, secondary_colors[], product_type, bot_description, search_tags[]} }
// Grava só os campos informados. Não sobrescreve com vazio.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL = process.env.SITE_SUPABASE_URL || 'https://tapgnlrjhrhewqlpahvg.supabase.co';
// EXIGE a SERVICE KEY: a RLS bloqueia UPDATE pra anon (volta 0 linhas SEM erro =
// falso positivo). Sem ela, ABORTA — pra nunca achar que gravou sem gravar.
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!KEY || KEY.length < 50) { console.log('❌ SUPABASE_SERVICE_KEY ausente/curta — abortando pra não dar falso positivo.'); process.exit(1); }
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });
// Confirma de verdade: usa .select() e conta linhas realmente afetadas.

const map = JSON.parse(fs.readFileSync(path.join(__dirname, '_apply.json'), 'utf8'));
let ok = 0, err = 0;
for (const [id, v] of Object.entries(map)) {
  const patch = { updated_at: new Date().toISOString() };
  if (v.color) patch.color = v.color;
  if (Array.isArray(v.secondary_colors) && v.secondary_colors.length) patch.secondary_colors = v.secondary_colors;
  if (v.product_type) patch.product_type = v.product_type;
  if (v.bot_description) patch.bot_description = v.bot_description;
  if (Array.isArray(v.search_tags) && v.search_tags.length) patch.search_tags = v.search_tags;
  const { data, error } = await supabase.from('products').update(patch).eq('id', Number(id)).select('id');
  if (error) { console.log(`❌ ${id}: ${error.message}`); err++; }
  else if (!data || data.length === 0) { console.log(`❌ ${id}: 0 linhas (id não encontrado/sem permissão)`); err++; }
  else { console.log(`✅ ${id}: cor=${v.color || '—'}${(v.secondary_colors||[]).length ? ' +'+v.secondary_colors.join('/') : ''}`); ok++; }
}
console.log(`\n${ok} gravados, ${err} erros.`);
