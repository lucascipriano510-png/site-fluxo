// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, apikey, x-client-info',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const SUPABASE_ANON_KEY         = Deno.env.get('SUPABASE_ANON_KEY')!;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    return json({ error: 'Missing server env vars' }, 500);
  }

  // Auth: requer Bearer JWT de admin logado
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  const token = authHeader.slice(7);
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  // Busca todos os leads no Supabase
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: leads, error: fetchErr } = await admin.from('leads').select('id, nome');
  if (fetchErr) return json({ error: 'Erro ao buscar leads', details: fetchErr.message }, 500);
  if (!leads || leads.length === 0) return json({ ok: true, message: 'Nenhum lead encontrado', sucesso: 0, erro: 0 });

  console.log(`[analyze-all-leads] Iniciando análise de ${leads.length} leads`);

  let sucesso = 0;
  let erro = 0;

  for (const lead of leads) {
    let tentativas = 0;
    while (tentativas < 3) {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-lead`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ leadId: lead.id }),
        });

        if (res.status === 429) {
          tentativas++;
          console.log(`[AI] Rate limit em ${lead.nome}, aguardando 10s...`);
          await new Promise(r => setTimeout(r, 10000));
          continue;
        }

        if (res.ok) sucesso++;
        else erro++;
        break;
      } catch (e) {
        console.error(`[AI] Erro em ${lead.nome}:`, e);
        erro++;
        break;
      }
    }

    await new Promise(r => setTimeout(r, 5000));
  }

  console.log(`[analyze-all-leads] Concluído — sucesso: ${sucesso}, erro: ${erro}`);
  return json({ ok: true, total: leads.length, sucesso, erro });
});
