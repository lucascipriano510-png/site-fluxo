import { supabase } from './supabaseClient';
import { marcarEngajamento } from './attention';
import { isOwnerDevice } from './metaPixel';

// ===== CAPTURA DE SINAIS DE LEAD (o "cerco") =====
// O site emite sinais ricos de cada interação relevante — com DETALHE do produto
// (nome, sku, cor, tamanho, categoria, marca/tipo, preço). O Fluxo Command lê
// esses sinais read-only (mesmo Supabase, como já faz com `orders`), classifica
// o lead e gera a mensagem pronta. ZERO acoplamento: o site grava só nos dados
// dele e funciona sozinho; nunca chama o Fluxo Command.
//
// Identidade: cada navegador ganha um visitor_id (localStorage). Quando o cliente
// informa o WhatsApp, todos os sinais daquele visitor_id passam a ter telefone —
// é assim que ligamos o histórico anônimo ao contato real.

const VISITOR_KEY = '@fluxo:visitor-id';
const PHONE_KEY = '@fluxo:lead-phone';
const NAME_KEY = '@fluxo:lead-name';

export function getVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `v_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch { return `v_${Date.now()}`; }
}

export function setKnownLead(phone, name) {
  try {
    const ph = String(phone || '').replace(/\D/g, '');
    if (ph.length >= 10) localStorage.setItem(PHONE_KEY, ph);
    if (name && String(name).trim()) localStorage.setItem(NAME_KEY, String(name).trim());
  } catch {}
}
export function getKnownLead() {
  try {
    return { phone: localStorage.getItem(PHONE_KEY) || null, name: localStorage.getItem(NAME_KEY) || null };
  } catch { return { phone: null, name: null }; }
}

// Extrai o "objeto de desejo" com detalhe — ex.: camisa azul GG Lacoste.
function productDetail(p) {
  if (!p) return {};
  return {
    product_id: p.id != null ? String(p.id) : null,
    product_sku: p.sku || null,
    product_name: p.name || null,
    category: p.category || null,
    subcategory: p.subcategory || null,
    color: p.color || null,
    brand: p.product_type || null, // marca/modelo (ex.: lacoste, premium)
    material: p.material || null,
    price: p.price != null ? Number(p.price) : null,
  };
}

// Dedup leve: não martela o mesmo evento+produto+tamanho em poucos segundos.
const recent = new Map();
function throttled(key, ms = 4000) {
  const now = Date.now();
  if (now - (recent.get(key) || 0) < ms) return true;
  recent.set(key, now);
  return false;
}

/**
 * Emite um sinal de lead (fire-and-forget; nunca bloqueia/erra na UI).
 * @param {string} event - produto_visto | whatsapp_produto | carrinho_add | checkout_aberto | telefone_informado
 *   (os eventos de atenção — sessao, marco_sessao, exposicao_elemento,
 *   interacao_elemento — gravam direto pelo lib/attention.js, sem passar aqui)
 * @param {{product?, size?, qty?, cart?, phone?, name?, meta?}} data
 */
export function emitSignal(event, data = {}) {
  try {
    // Aparelho do dono/teste não grava sinal: teste não é dado (os 350
    // produto_visto de 2026-07 tinham dezenas de visitas do próprio dono).
    if (isOwnerDevice()) return;
    const { product, size, qty, cart, phone, name, meta } = data;
    marcarEngajamento(event); // funil de atenção: engajamento fecha marcos da sessão
    const known = getKnownLead();
    const ph = (phone ? String(phone).replace(/\D/g, '') : '') || known.phone || null;
    const dKey = `${event}:${product?.sku || (cart ? 'cart' : '')}:${size || ''}`;
    if (throttled(dKey)) return;
    const row = {
      visitor_id: getVisitorId(),
      phone: ph,
      name: name || known.name || null,
      event,
      ...productDetail(product),
      size: size || null,
      qty: qty != null ? Number(qty) : null,
      cart_json: Array.isArray(cart) ? cart : null,
      meta: meta || null,
    };
    // não await — a loja não pode esperar/quebrar por causa de telemetria
    supabase.from('site_lead_signals').insert([row]).then(
      () => {},
      (e) => console.warn('[leadSignals] falhou:', e?.message)
    );
  } catch (e) { /* silencioso */ }
}

// Snapshot enxuto do carrinho pra anexar nos sinais (detalhe sem peso).
export function cartSnapshot(cart) {
  return (cart || []).map(i => ({
    sku: i.sku || null, name: i.name || null, color: i.color || null,
    size: i.size || null, qty: i.quantity || 1, price: Number(i.price) || 0,
    brand: i.product_type || null,
  }));
}
