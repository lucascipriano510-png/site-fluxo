// Supabase Edge Function — site-account
// Conta do site Fluxo Outlet: TELEFONE + SENHA, com código de recuperação
// (decisão do dono: sem OTP/SMS; recuperação = código guardado ou WhatsApp).
//
// Ações (POST { action, ... }):
//   register {phone, name, password}            -> { token, profile, recovery }
//   login    {phone, password}                  -> { token, profile }
//   recover  {phone, recovery, newPassword}     -> { token, profile, recovery(NOVO) }
//   orders   {token}                            -> { orders } (só do telefone do token)
//   me       {token}                            -> { profile }
//
// Segurança:
// - senha e código de recuperação: PBKDF2-SHA256 120k iterações, salt aleatório;
// - comparação em tempo constante;
// - 5 erros seguidos (senha OU código) = conta travada por 15 min;
// - token = payload assinado com HMAC-SHA256 (chave derivada da service key),
//   validade 90 dias — pedidos SÓ saem pro telefone dono do token (fecha o
//   furo do site inteiro poder consultar orders por telefone via anon).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const enc = new TextEncoder()
const MAX_ERROS = 5
const TRAVA_MIN = 15
const TOKEN_DIAS = 90

const b64 = (buf: Uint8Array) => btoa(String.fromCharCode(...buf))
const b64d = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const b64url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const b64urlDecode = (s: string) => atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4))

async function pbkdf2(secret: string, salt: Uint8Array, iters: number) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: iters, hash: 'SHA-256' }, key, 256)
  return new Uint8Array(bits)
}

async function hashSecret(secret: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iters = 120000
  const h = await pbkdf2(secret, salt, iters)
  return `pbkdf2$${iters}$${b64(salt)}$${b64(h)}`
}

function timingSafeEq(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i]
  return r === 0
}

async function verifySecret(secret: string, stored: string | null) {
  if (!stored) return false
  const [alg, itersS, saltB64, hashB64] = stored.split('$')
  if (alg !== 'pbkdf2') return false
  const h = await pbkdf2(secret, b64d(saltB64), Number(itersS))
  return timingSafeEq(h, b64d(hashB64))
}

let hmacKeyPromise: Promise<CryptoKey> | null = null
function hmacKey() {
  if (!hmacKeyPromise) {
    hmacKeyPromise = (async () => {
      const material = await crypto.subtle.digest('SHA-256', enc.encode(SERVICE_KEY + '::site-account-v1'))
      return crypto.subtle.importKey('raw', material, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
    })()
  }
  return hmacKeyPromise
}

async function makeToken(phone: string) {
  const payload = b64url(JSON.stringify({ p: phone, exp: Date.now() + TOKEN_DIAS * 24 * 3600 * 1000 }))
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(), enc.encode(payload)))
  return `${payload}.${b64(sig).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
}

async function phoneFromToken(token: unknown): Promise<string | null> {
  if (typeof token !== 'string' || !token.includes('.')) return null
  const [payload, sigPart] = token.split('.')
  let sig: Uint8Array
  try { sig = Uint8Array.from(b64urlDecode(sigPart), (c) => c.charCodeAt(0)) } catch { return null }
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(), sig, enc.encode(payload))
  if (!ok) return null
  try {
    const data = JSON.parse(b64urlDecode(payload))
    if (!data?.p || Date.now() > Number(data.exp)) return null
    return String(data.p)
  } catch { return null }
}

// Código de recuperação legível: sem 0/O/1/I/L (cliente vai anotar no papel)
function genRecovery() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const pick = () => chars[crypto.getRandomValues(new Uint8Array(1))[0] % chars.length]
  const bloco = () => Array.from({ length: 4 }, pick).join('')
  return `FLX-${bloco()}-${bloco()}`
}

const normPhone = (v: unknown) => String(v ?? '').replace(/\D/g, '')

serve(async (req) => {
  // x-client-info e apikey: o supabase-js manda esses headers no invoke()
  // do navegador — sem eles no preflight, o CORS derruba a chamada.
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  }
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body.action ?? '')
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    // ── REGISTER ─────────────────────────────────────────────────────
    if (action === 'register') {
      const phone = normPhone(body.phone)
      const name = String(body.name ?? '').trim()
      const password = String(body.password ?? '')
      if (phone.length < 10 || phone.length > 13) return json({ error: 'WhatsApp inválido (use DDD + número).' }, 400)
      if (name.length < 2) return json({ error: 'Informe seu nome.' }, 400)
      if (password.length < 6) return json({ error: 'Senha muito curta (mínimo 6 caracteres).' }, 400)

      const { data: existing } = await supabase.from('site_accounts').select('id').eq('phone', phone).maybeSingle()
      if (existing) return json({ error: 'Já existe conta com esse WhatsApp. Entre com sua senha ou recupere o acesso.' }, 409)

      const recovery = genRecovery()
      const { error } = await supabase.from('site_accounts').insert([{
        phone,
        name,
        password_hash: await hashSecret(password),
        recovery_hash: await hashSecret(recovery),
      }])
      if (error) throw new Error(error.message)

      return json({ token: await makeToken(phone), profile: { name, phone }, recovery })
    }

    // ── Helpers de conta p/ login e recover ──────────────────────────
    const getConta = async (phone: string) => {
      const { data } = await supabase
        .from('site_accounts')
        .select('id, name, phone, password_hash, recovery_hash, failed_attempts, locked_until')
        .eq('phone', phone)
        .maybeSingle()
      return data
    }
    const contaTravada = (conta: { locked_until: string | null }) =>
      conta.locked_until && new Date(conta.locked_until).getTime() > Date.now()
    const registraErro = async (conta: { id: string; failed_attempts: number }) => {
      const tentativas = (conta.failed_attempts ?? 0) + 1
      await supabase.from('site_accounts').update({
        failed_attempts: tentativas,
        locked_until: tentativas >= MAX_ERROS ? new Date(Date.now() + TRAVA_MIN * 60000).toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq('id', conta.id)
      return MAX_ERROS - tentativas
    }

    // ── LOGIN ────────────────────────────────────────────────────────
    if (action === 'login') {
      const phone = normPhone(body.phone)
      const password = String(body.password ?? '')
      const conta = await getConta(phone)
      if (!conta) return json({ error: 'WhatsApp ou senha incorretos.' }, 401)
      if (contaTravada(conta)) return json({ error: `Muitas tentativas. Aguarde ${TRAVA_MIN} minutos e tente de novo.` }, 429)

      if (!(await verifySecret(password, conta.password_hash))) {
        const restam = await registraErro(conta)
        return json({ error: restam > 0 ? 'WhatsApp ou senha incorretos.' : `Conta travada por ${TRAVA_MIN} min (muitas tentativas).` }, 401)
      }

      await supabase.from('site_accounts').update({ failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() }).eq('id', conta.id)
      return json({ token: await makeToken(phone), profile: { name: conta.name, phone } })
    }

    // ── RECOVER (código de recuperação -> senha nova + código NOVO) ──
    if (action === 'recover') {
      const phone = normPhone(body.phone)
      const recovery = String(body.recovery ?? '').trim().toUpperCase()
      const newPassword = String(body.newPassword ?? '')
      if (newPassword.length < 6) return json({ error: 'Senha nova muito curta (mínimo 6 caracteres).' }, 400)

      const conta = await getConta(phone)
      if (!conta) return json({ error: 'Código de recuperação inválido.' }, 401)
      if (contaTravada(conta)) return json({ error: `Muitas tentativas. Aguarde ${TRAVA_MIN} minutos e tente de novo.` }, 429)

      if (!(await verifySecret(recovery, conta.recovery_hash))) {
        const restam = await registraErro(conta)
        return json({ error: restam > 0 ? 'Código de recuperação inválido.' : `Conta travada por ${TRAVA_MIN} min (muitas tentativas).` }, 401)
      }

      // código é de uso único: senha nova + código NOVO
      const novoCodigo = genRecovery()
      const { error } = await supabase.from('site_accounts').update({
        password_hash: await hashSecret(newPassword),
        recovery_hash: await hashSecret(novoCodigo),
        failed_attempts: 0,
        locked_until: null,
        updated_at: new Date().toISOString(),
      }).eq('id', conta.id)
      if (error) throw new Error(error.message)

      return json({ token: await makeToken(phone), profile: { name: conta.name, phone }, recovery: novoCodigo })
    }

    // ── ORDERS (exige token válido — pedidos SÓ do dono do telefone) ─
    if (action === 'orders') {
      const phone = await phoneFromToken(body.token)
      if (!phone) return json({ error: 'Sessão expirada. Entre de novo.' }, 401)
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, created_at, status, value, items')
        .eq('phone', phone)
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) throw new Error(error.message)
      return json({ orders: data ?? [] })
    }

    // ── ME (valida sessão ao abrir o site) ───────────────────────────
    if (action === 'me') {
      const phone = await phoneFromToken(body.token)
      if (!phone) return json({ error: 'Sessão expirada.' }, 401)
      const { data } = await supabase.from('site_accounts').select('name, phone').eq('phone', phone).maybeSingle()
      if (!data) return json({ error: 'Conta não encontrada.' }, 404)
      return json({ profile: data })
    }

    return json({ error: 'Ação desconhecida.' }, 400)
  } catch (err) {
    console.error('[site-account] erro:', err)
    return json({ error: 'Erro interno. Tenta de novo em instantes.' }, 500)
  }
})
