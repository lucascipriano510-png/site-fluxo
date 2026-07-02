// Corrige vocabulário das descrições já gravadas pro tom Brás: look->kit, clean->claro.
import { createClient } from '@supabase/supabase-js';
const URL = 'https://tapgnlrjhrhewqlpahvg.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!KEY) { console.log('sem service key'); process.exit(1); }
const s = createClient(URL, KEY, { auth: { persistSession: false } });

const fix = (t) => String(t || '')
  .replace(/\blooks?\b/gi, 'kit')
  .replace(/\bcleans?\b/gi, 'claro');

const { data, error } = await s.from('products').select('id,bot_description').not('bot_description','is',null);
if (error) { console.log('ERRO:', error.message); process.exit(1); }
let n = 0;
for (const p of data) {
  const novo = fix(p.bot_description);
  if (novo !== p.bot_description) {
    const { error: e } = await s.from('products').update({ bot_description: novo }).eq('id', p.id);
    if (e) console.log('❌', p.id, e.message);
    else { console.log('✏️', p.id, '→', novo.slice(0, 55)); n++; }
  }
}
console.log(`\n${n} descrições corrigidas.`);
