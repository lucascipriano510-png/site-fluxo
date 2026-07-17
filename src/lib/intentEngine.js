import { exposicaoElemento, interacaoElemento } from './attention';

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

/** Chamar ao abrir produto: liga o clique à posição que o motor deu. */
export function tocouPecaImpulsionada(product) {
  if (!product) return;
  if (impulsoRetorno.has(product.id)) interacaoElemento('motor_intencao', { tipo: 'retorno', sku: product.sku || null });
  else if (impulsoCategoria.has(product.id)) interacaoElemento('motor_intencao', { tipo: 'categoria', sku: product.sku || null });
}
