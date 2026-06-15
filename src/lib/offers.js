// ===== OFERTA DO DIA =====
// Fonte ÚNICA de verdade da lógica de ofertas com prazo.
//
// Regras (definidas com o dono):
//  - Oferta = desconto por PORCENTAGEM sobre o preço normal (preço antigo fica riscado).
//  - O dono escolhe ATÉ QUE DIA a oferta vale (campo `offer_ends_at`, 'YYYY-MM-DD').
//    Esse dia é INCLUSIVO: a oferta vale o dia inteiro e MORRE na virada (00:00 / meia-noite
//    do dia seguinte), no fuso local. O temporizador sempre busca essa meia-noite.
//  - Itens em oferta NÃO recebem o desconto de 5% no Pix (a oferta já é o desconto).
//
// Campos no produto:
//  - offer_active            boolean
//  - offer_discount_percent  number  (ex.: 30 = 30% OFF)
//  - offer_ends_at           'YYYY-MM-DD' (último dia, inclusive)

// Campanhas de oferta (rótulo + chave). Ordem padrão de exibição na home.
export const OFFER_CAMPAIGNS = ['dia', 'semana', 'mes'];
export const CAMPAIGN_LABELS = {
  dia: 'Ofertas do Dia',
  semana: 'Ofertas da Semana',
  mes: 'Ofertas do Mês',
};
export const CAMPAIGN_SHORT = { dia: 'Dia', semana: 'Semana', mes: 'Mês' };
export function offerCampaign(product) {
  const c = String(product?.offer_campaign || 'dia').toLowerCase();
  return OFFER_CAMPAIGNS.includes(c) ? c : 'dia';
}

// Instante exato em que a oferta expira: meia-noite (00:00) da virada do dia escolhido.
export function offerEndsAt(product) {
  const raw = product?.offer_ends_at;
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(raw));
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    // d + 1 → 00:00 do dia SEGUINTE = fim do dia escolhido (meia-noite local).
    return new Date(y, mo - 1, d + 1, 0, 0, 0, 0);
  }
  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

// Porcentagem de desconto saneada (0 se inválida).
export function offerPercent(product) {
  const pct = Math.round(Number(product?.offer_discount_percent));
  return Number.isFinite(pct) && pct > 0 && pct < 100 ? pct : 0;
}

// A oferta está no ar AGORA? (flag ligada + % válido + dentro do prazo)
export function isOfferLive(product, now = Date.now()) {
  if (!product || !product.offer_active) return false;
  if (offerPercent(product) <= 0) return false;
  const end = offerEndsAt(product);
  if (!end) return false;
  return now < end.getTime();
}

// Preço unitário JÁ com o desconto da oferta (2 casas).
export function offerPrice(product) {
  const base = Number(product?.price) || 0;
  const pct = offerPercent(product);
  if (pct <= 0) return base;
  return Math.round(base * (1 - pct / 100) * 100) / 100;
}

// Quebra o tempo restante até `target` em dias/horas/min/seg.
export function breakdown(target, now = Date.now()) {
  const end = target instanceof Date ? target.getTime() : Number(target);
  let diff = Math.max(0, end - now);
  const total = diff;
  const days = Math.floor(diff / 86400000); diff -= days * 86400000;
  const hours = Math.floor(diff / 3600000); diff -= hours * 3600000;
  const minutes = Math.floor(diff / 60000); diff -= minutes * 60000;
  const seconds = Math.floor(diff / 1000);
  return { days, hours, minutes, seconds, total, expired: total <= 0 };
}

// Data local de hoje em 'YYYY-MM-DD' (para o min do input date, sem furo de fuso).
export function todayLocalISO(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

// 'YYYY-MM-DD' → 'DD/MM' para exibição amigável.
export function formatDayMonth(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? `${m[3]}/${m[2]}` : '';
}
