import { exposicaoElemento, interacaoElemento } from './attention';
import { getVisitorId } from './leadSignals';
import { hasMyNumber } from './mySize';

// ── MOTOR DE INTENÇÃO (pesquisa: módulo 1 objetivo × módulo 3 wanting) ──
// Módulo 1: atenção = saliência × OBJETIVO × histórico — o objetivo da sessão
// é inferível pelas ações (abriu 2 bermudas = tá caçando bermuda). Módulo 3:
// voltar ao MESMO produto em sessões diferentes é o sinal comportamental mais
// forte de desejo (wanting), mais que tempo de tela ou curtida. O motor lê os
// dois sinais e REORDENA a grade padrão da home: peças de retorno primeiro,
// depois a categoria perseguida, depois o resto na ordem de sempre. NADA é
// adicionado à tela além do selo "Na sua mira" nas peças de retorno; sem sinal
// (primeira visita) a grade é EXATAMENTE a de hoje. Ordenação explícita do
// cliente (novidades) e busca continuam mandando — o motor só age no padrão.
const CATS_KEY = '@fluxo:intent:cats';      // sessionStorage — {CATEGORIA: aberturas}
const SID_KEY = '@fluxo:intent:sid';        // sessionStorage — id desta sessão
const RETORNO_KEY = '@fluxo:retorno';       // localStorage — {id: {sid, n, t}}
const RETORNO_MIN_SESSOES = 2;              // viu em 2+ sessões distintas = quase-venda
const RETORNO_VALIDADE_MS = 30 * 24 * 60 * 60 * 1000;
const RETORNO_MAX = 30;                     // entradas rastreadas (poda por recência)

const lerJson = (storage, key) => {
  try { return JSON.parse(storage.getItem(key)) || {}; } catch { return {}; }
};

const sidAtual = () => {
  try {
    let sid = sessionStorage.getItem(SID_KEY);
    if (!sid) {
      sid = `i_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      sessionStorage.setItem(SID_KEY, sid);
    }
    return sid;
  } catch { return 'i_fallback'; }
};

// Cache do mapa de retorno (localStorage parseado 1x; invalidado nas escritas).
let retornoCache = null;
const lerRetorno = () => {
  if (!retornoCache) retornoCache = lerJson(localStorage, RETORNO_KEY);
  return retornoCache;
};
const gravarRetorno = (mapa) => {
  retornoCache = mapa;
  try { localStorage.setItem(RETORNO_KEY, JSON.stringify(mapa)); } catch {}
};

/** Chamar quando um produto abre (handleProductClick). */
export function notarProdutoVisto(product) {
  if (!product || product.is_kit) return;
  try {
    const cat = String(product.category || '').trim().toUpperCase();
    if (cat && cat !== 'TODOS') {
      const cats = lerJson(sessionStorage, CATS_KEY);
      cats[cat] = (Number(cats[cat]) || 0) + 1;
      sessionStorage.setItem(CATS_KEY, JSON.stringify(cats));
    }
    const sid = sidAtual();
    const mapa = { ...lerRetorno() };
    const atual = mapa[product.id];
    // Conta SESSÕES distintas: reabrir na mesma sessão não é "voltou outro dia".
    mapa[product.id] = atual && atual.sid !== sid
      ? { sid, n: (Number(atual.n) || 1) + 1, t: Date.now() }
      : { sid, n: atual ? Number(atual.n) || 1 : 1, t: Date.now() };
    const ids = Object.keys(mapa);
    if (ids.length > RETORNO_MAX) {
      ids.sort((a, b) => (mapa[b].t || 0) - (mapa[a].t || 0));
      ids.slice(RETORNO_MAX).forEach((id) => delete mapa[id]);
    }
    gravarRetorno(mapa);
  } catch { /* motor nunca quebra a loja */ }
}

/** Peça entrou na sacola = desejo convertido; sai da mira. */
export function limparRetorno(productId) {
  try {
    const mapa = { ...lerRetorno() };
    if (mapa[productId]) { delete mapa[productId]; gravarRetorno(mapa); }
  } catch {}
}

/** Ids das peças que o visitante abriu em 2+ sessões nos últimos 30 dias. */
export function pecasDeRetorno() {
  const agora = Date.now();
  const mapa = lerRetorno();
  const ids = new Set();
  for (const id of Object.keys(mapa)) {
    const e = mapa[id];
    if ((Number(e?.n) || 0) >= RETORNO_MIN_SESSOES && agora - (e?.t || 0) < RETORNO_VALIDADE_MS) {
      ids.add(Number(id) || id);
    }
  }
  return ids;
}

/** Categoria perseguida NESTA sessão (2+ aberturas e líder isolada), ou null. */
export function categoriaDaSessao() {
  try {
    const cats = lerJson(sessionStorage, CATS_KEY);
    let melhor = null; let melhorN = 0; let empate = false;
    for (const [cat, n] of Object.entries(cats)) {
      const v = Number(n) || 0;
      if (v > melhorN) { melhor = cat; melhorN = v; empate = false; }
      else if (v === melhorN) empate = true;
    }
    return melhorN >= 2 && !empate ? melhor : null;
  } catch { return null; }
}

// Quem foi impulsionado na última reordenação (pra ligar clique → motor).
let impulsoRetorno = new Set();
let impulsoCategoria = new Set();
let exposicaoMarcada = false;

/** Reordena a lista padrão da grade. Sem sinal, devolve a lista intocada. */
export function aplicarMotor(list) {
  try {
    const retorno = pecasDeRetorno();
    const cat = categoriaDaSessao();
    if (retorno.size === 0 && !cat) { impulsoRetorno = new Set(); impulsoCategoria = new Set(); return list; }
    const frente = []; const meio = []; const resto = [];
    impulsoRetorno = new Set(); impulsoCategoria = new Set();
    for (const p of list) {
      if (retorno.has(p.id)) { frente.push(p); impulsoRetorno.add(p.id); }
      else if (cat && String(p.category || '').trim().toUpperCase() === cat) { meio.push(p); impulsoCategoria.add(p.id); }
      else resto.push(p);
    }
    if (frente.length === 0 && meio.length === 0) return list;
    if (!exposicaoMarcada) { exposicaoMarcada = true; exposicaoElemento('motor_intencao'); }
    return [...frente, ...meio, ...resto];
  } catch { return list; }
}

/** Card em posição impulsionada nesta sessão? (selo "Na sua mira") */
export function estaNaMira(productId) {
  return impulsoRetorno.has(productId);
}

// ── RÉGUA DA GRADE PADRÃO (2026-07-17, regra escolhida com o dono) ──
// Avaliação mandava primeiro, mas quase ninguém avalia → mesmos produtos
// sempre no topo (vitrine congelada = habituação, módulo 1). Nova ordem:
//   1. tem o NÚMERO do visitante em estoque (quando o site já o conhece);
//   2. vendas (demanda real > estrela escassa);
//   3. avaliação vira DESEMPATE (era o critério principal);
//   4. sorteio diário estável: embaralhamento próprio por visitante+dia entre
//      empatados — a vitrine de amanhã é outra, mas NUNCA muda sob o dedo.
// Peça com UM tamanho sobrando desce pro fim (resto de grade)... a menos que
// o tamanho seja o do visitante — aí é relevância perfeita e sobe pro topo.
// Tamanho único de projeto (U/PADRÃO) e kit não são "resto": ficam normais.
// "Novidades primeiro" foi VETADO pelo dono: refazer fotos re-cadastra a
// peça e ela pareceria nova sem ser.
const TAM_UNICO = new Set(['U', 'UNICO', 'ÚNICO', 'PADRÃO', 'PADRAO']);

function bandaTamanho(p) {
  if (p.is_kit) return 1;
  if (hasMyNumber(p)) return 0;
  const emEstoque = (p.sizes || []).filter((s) => {
    const stock = typeof s === 'string' ? (p.stock || 0) : Number(s?.stock || 0);
    return stock > 0;
  });
  if (emEstoque.length === 1) {
    const nome = String(typeof emEstoque[0] === 'string' ? emEstoque[0] : emEstoque[0]?.size || '').trim().toUpperCase();
    if (!TAM_UNICO.has(nome)) return 2;
  }
  return 1;
}

let jitterBase = null;
const jitterCache = new Map();
function jitterDiario(id) {
  if (jitterBase === null) {
    try { jitterBase = `${getVisitorId()}:${new Date().toISOString().slice(0, 10)}`; } catch { jitterBase = 'x'; }
  }
  if (jitterCache.has(id)) return jitterCache.get(id);
  const s = `${jitterBase}:${id}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  jitterCache.set(id, h);
  return h;
}

/** Ordena a grade padrão (o motor de intenção roda POR CIMA do resultado). */
export function ordenarGradePadrao(list, ratingsMap) {
  try {
    return [...list].sort((a, b) => {
      const ba = bandaTamanho(a); const bb = bandaTamanho(b);
      if (ba !== bb) return ba - bb;
      const sa = a.sales || 0; const sb = b.sales || 0;
      if (sb !== sa) return sb - sa;
      const ra = ratingsMap?.[a.id]?.mode || 0; const rb = ratingsMap?.[b.id]?.mode || 0;
      if (rb !== ra) return rb - ra;
      const ca = ratingsMap?.[a.id]?.count || 0; const cb = ratingsMap?.[b.id]?.count || 0;
      if (cb !== ca) return cb - ca;
      return jitterDiario(a.id) - jitterDiario(b.id);
    });
  } catch { return list; }
}

/** Chamar ao abrir produto: liga o clique à posição que o motor deu. */
export function tocouPecaImpulsionada(product) {
  if (!product) return;
  if (impulsoRetorno.has(product.id)) interacaoElemento('motor_intencao', { tipo: 'retorno', sku: product.sku || null });
  else if (impulsoCategoria.has(product.id)) interacaoElemento('motor_intencao', { tipo: 'categoria', sku: product.sku || null });
}
