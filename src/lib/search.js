// ===== BUSCA INTELIGENTE =====
// Pensada pra realidade de outlet de roupa: o cliente digita do jeito que fala,
// com acento ou sem, no singular ou plural, com erro de digitação, e às vezes
// busca por intenção ("calça até 150", "promo", "tênis preto 42").
//
// Recursos:
//  - normaliza acentos/caixa ("tênis" == "tenis", "calça" == "calca")
//  - procura em vários campos (nome, sku, categoria, sub, cor, material, tipo,
//    tags, coleção, descrição do bot)
//  - sinônimos da nossa loja (sapato→tênis, blusa→camisa, casaco→moletom...)
//  - singular/plural automático
//  - tolera 1 erro de digitação (fuzzy) em palavras de 4+ letras
//  - entende intenção: faixa de preço, tamanho, "promo/oferta", "novidade"
//  - ranqueia por relevância (nome exato > começa com > contém > outro campo)

import { isOfferLive, offerPrice } from './offers.js';

export function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos (faixa de diacríticos combinantes)
    .replace(/[^a-z0-9\s]/g, ' ')    // pontuação vira espaço
    .replace(/\s+/g, ' ')
    .trim();
}

// Grupos de sinônimos (já sem acento). Buscar por qualquer um acha os outros.
const SYNONYM_GROUPS = [
  ['camisa', 'camiseta', 'camisas', 'blusa', 'tshirt', 'tee', 'gola'],
  ['calca', 'calcas', 'jeans', 'sarja', 'pantalona', 'jogger'],
  ['bermuda', 'bermudas', 'short', 'shorts'],
  ['tenis', 'sapato', 'sapatos', 'calcado', 'calcados', 'sneaker', 'sneakers'],
  ['bone', 'bones', 'cap', 'chapeu', 'touca'],
  ['moletom', 'casaco', 'jaqueta', 'blusao', 'agasalho', 'corta vento'],
  ['vestido', 'vestidos'],
  ['conjunto', 'conjuntos', 'kit', 'kits', 'combo', 'combos'],
  ['oculos', 'oculos de sol'],
  ['relogio', 'relogios'],
  ['masculino', 'homem', 'masculina'],
  ['feminino', 'mulher', 'feminina'],
  ['infantil', 'crianca', 'kids'],
];

const synonymIndex = (() => {
  const map = new Map();
  SYNONYM_GROUPS.forEach(group => group.forEach(word => {
    const existing = map.get(word) || new Set();
    group.forEach(g => existing.add(g));
    map.set(word, existing);
  }));
  return map;
})();

const singular = (w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);

function expandTerm(term) {
  const out = new Set([term]);
  out.add(singular(term));
  out.add(term.endsWith('s') ? term : term + 's');
  (synonymIndex.get(term) || []).forEach(s => out.add(s));
  (synonymIndex.get(singular(term)) || []).forEach(s => out.add(s));
  return Array.from(out).filter(t => t && t.length >= 2);
}

// Distância de edição limitada a 1 (rápida): true se <= 1 troca/insert/delete.
function withinOneEdit(a, b) {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (la > lb) i++;
    else if (lb > la) j++;
    else { i++; j++; }
  }
  if (i < la || j < lb) edits++;
  return edits <= 1;
}

export function productHaystack(p) {
  const parts = [
    p.name, p.sku, p.category, p.subcategory, p.collection_name,
    p.color, p.product_type, p.material, p.bot_description,
    ...(Array.isArray(p.secondary_colors) ? p.secondary_colors : []),
    ...(Array.isArray(p.search_tags) ? p.search_tags : []),
  ];
  return normalize(parts.filter(Boolean).join(' '));
}

const OFFER_WORDS = /\b(promo|promocao|promocoes|oferta|ofertas|desconto|descontos|off|barato|baratos|baratinho|liquida|liquidacao|sale|queima)\b/g;
const NEW_WORDS = /\b(novidade|novidades|novo|nova|novos|novas|lancamento|lancamentos)\b/g;
const CURRENCY_WORDS = /\b(reais|real|conto|contos|pila|pilas|pratas)\b/g;

// Extrai intenção da query e devolve { terms, priceMin, priceMax, sizes, onlyOffer, onlyNew }
export function parseQueryIntent(raw) {
  const intent = { terms: [], priceMin: null, priceMax: null, sizes: [], onlyOffer: false, onlyNew: false };
  let q = ` ${normalize(raw)} `;
  if (!q.trim()) return intent;

  if (OFFER_WORDS.test(q)) { intent.onlyOffer = true; q = q.replace(OFFER_WORDS, ' '); }
  if (NEW_WORDS.test(q)) { intent.onlyNew = true; q = q.replace(NEW_WORDS, ' '); }

  // Faixa de preço
  let m;
  if ((m = q.match(/(?:de|entre)?\s*(\d+)\s*(?:a|ate|e|-)\s*(\d+)/))) {
    const a = Number(m[1]), b = Number(m[2]);
    intent.priceMin = Math.min(a, b); intent.priceMax = Math.max(a, b);
    q = q.replace(m[0], ' ');
  } else if ((m = q.match(/(?:ate|abaixo de|menos de|no maximo|maximo|max)\s*(\d+)/))) {
    intent.priceMax = Number(m[1]); q = q.replace(m[0], ' ');
  } else if ((m = q.match(/(?:acima de|mais de|a partir de|no minimo|minimo|min)\s*(\d+)/))) {
    intent.priceMin = Number(m[1]); q = q.replace(m[0], ' ');
  } else if ((m = q.match(/(\d+)\s*(?:reais|real|conto|contos|pila|pilas)/))) {
    intent.priceMax = Number(m[1]); q = q.replace(m[0], ' ');
  }
  q = q.replace(CURRENCY_WORDS, ' ');

  // Tamanho explícito: "tam M", "tamanho gg", "numero 40", "n 42"
  const sizeRe = /\b(?:tam|tamanho|numero|num|n)\s*([a-z0-9]{1,4})\b/g;
  let sm;
  while ((sm = sizeRe.exec(q)) !== null) intent.sizes.push(sm[1].toUpperCase());
  q = q.replace(sizeRe, ' ');

  // Número de roupa solto (34–50) também vira tamanho
  const tokens = q.split(/\s+/).filter(Boolean);
  const remaining = [];
  tokens.forEach(t => {
    if (/^\d{2}$/.test(t) && Number(t) >= 34 && Number(t) <= 50) intent.sizes.push(t.toUpperCase());
    else remaining.push(t);
  });

  intent.terms = remaining.filter(t => t.length >= 1);
  return intent;
}

const effectivePrice = (p) => {
  if (isOfferLive(p)) return offerPrice(p);
  const promo = Number(p.promotional_price);
  if (promo > 0 && promo < Number(p.price || 0)) return promo;
  return Number(p.price) || 0;
};

function termMatches(term, haystack, words) {
  // Letra única (recém-digitada após espaço: "calça j…") casa como PREFIXO de
  // palavra — sem isso o expandTerm (mín. 2 letras) descartava o termo e a
  // grade ZERAVA no meio da digitação de "calça jogador".
  if (term.length === 1) return words.some(w => w.startsWith(term));
  for (const v of expandTerm(term)) {
    if (haystack.includes(v)) return true;
  }
  if (term.length >= 4) {
    for (const w of words) {
      if (w.length >= 3 && withinOneEdit(w, term)) return true;
    }
  }
  return false;
}

// true/false: o produto satisfaz a intenção (termos + preço + tamanho + promo + novo)
export function productMatchesIntent(p, intent, opts = {}) {
  const hay = opts.haystack || productHaystack(p);
  const words = hay.split(' ');

  for (const t of intent.terms) {
    if (!termMatches(t, hay, words)) return false; // AND: todo termo precisa bater
  }
  if (intent.onlyOffer && !isOfferLive(p)) {
    const promo = Number(p.promotional_price);
    if (!(promo > 0 && promo < Number(p.price || 0))) return false;
  }
  if (intent.onlyNew) {
    const created = p.created_at ? new Date(p.created_at).getTime() : 0;
    if (!created || Date.now() - created > 30 * 24 * 60 * 60 * 1000) return false;
  }
  if (intent.priceMin != null && effectivePrice(p) < intent.priceMin) return false;
  if (intent.priceMax != null && effectivePrice(p) > intent.priceMax) return false;
  if (intent.sizes.length > 0) {
    const has = Array.isArray(p.sizes) && p.sizes.some(s => {
      const name = String((typeof s === 'string' ? s : s.size) || '').trim().toUpperCase();
      const stock = typeof s === 'string' ? (p.stock || 0) : Number(s.stock || 0);
      return stock > 0 && intent.sizes.includes(name);
    });
    if (!has) return false;
  }
  return true;
}

// Pontuação de relevância (maior = mais relevante).
export function scoreProductForSearch(p, intent) {
  let score = 0;
  const name = normalize(p.name);
  for (const t of intent.terms) {
    if (name === t) score += 120;
    else if (name.startsWith(t)) score += 50;
    else if (name.includes(` ${t}`)) score += 35; // início de palavra no nome
    else if (name.includes(t)) score += 20;
    else if (normalize(p.category).includes(t) || normalize(p.subcategory).includes(t)) score += 12;
    else score += 5; // bateu via sinônimo/fuzzy/outro campo
  }
  score += Math.min(p.sales || 0, 60) * 0.1; // leve empurrão pros mais vendidos
  if (isOfferLive(p)) score += 4;
  if ((p.stock || 0) > 0) score += 1;
  return score;
}

export function hasActiveQuery(intent) {
  return !!(intent && (intent.terms.length > 0 || intent.onlyOffer || intent.onlyNew || intent.priceMin != null || intent.priceMax != null || intent.sizes.length > 0));
}
