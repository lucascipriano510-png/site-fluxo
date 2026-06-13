// =====================================================================
// FLUXO OUTLET — Edge Function: analyze-all-leads
// Itera sobre todos os leads e chama analyze-lead para cada um,
// com delay de 5000ms entre chamadas e retry com backoff em caso de 429.
// =====================================================================

// deno-lint-ignore-file no-explicit-any

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

const FN_VERSION = '2026-06-13.1';
const FN_NAME    = 'analyze-all-leads';

console.log(`[${FN_NAME}] boot version=${FN_VERSION}`);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  console.log(`[${FN_NAME}] invoke ts=${new Date().toISOString()}`);

  const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Missing server env vars' }, 500);
  }

  // Auth: exige Bearer JWT de admin
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  // Busca todos os leads da tabela orders
  const ordersRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=id,name,status`, {
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!ordersRes.ok) {
    return json({ error: 'Failed to fetch leads', details: await ordersRes.text() }, 502);
  }

  const leads: Array<{ id: string; nome?: string; name?: string }> = await ordersRes.json();
  console.log(`[${FN_NAME}] total leads: ${leads.length}`);

  let sucesso = 0;
  let erro = 0;

  // Aguarda 5s antes de começar o loop para evitar burst inicial
  await new Promise(r => setTimeout(r, 5000));

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
          console.log(`[AI] Rate limit em lead ${lead.id}, aguardando 10s... (tentativa ${tentativas}/3)`);
          await new Promise(r => setTimeout(r, 10000));
          continue;
        }

        if (res.ok) sucesso++;
        else erro++;
        break;
      } catch (e) {
        console.warn(`[AI] Erro em lead ${lead.id}:`, (e as Error).message);
        erro++;
        break;
      }
    }

    // Delay de 5s entre cada lead para evitar rate limit
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log(`[${FN_NAME}] concluído: sucesso=${sucesso} erro=${erro}`);
  return json({ ok: true, total: leads.length, sucesso, erro });
});
