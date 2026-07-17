import { supabase } from './supabaseClient';
import { getVisitorId } from './leadSignals';
import { isOwnerDevice } from './metaPixel';

// ===== ENGENHARIA DA ATENÇÃO — Fase 1: medição (módulo 1 da pesquisa) =====
// A atenção visual é uma competição (saliência × objetivo × histórico aprendido)
// e o funil dela falha em elos independentes: detectar → orientar → compreender
// → explorar → agir. Tempo alto na página NÃO diz se é interesse ou confusão —
// só comportamento pareado distingue. Este módulo grava os elos como eventos
// na MESMA tabela dos sinais de lead (site_lead_signals, coluna meta jsonb):
//
//   sessao              1x por sessão — nº da visita, origem (utm/referrer), device
//   marco_sessao        1x por sessão POR MARCO — scroll, interacao, produto,
//                       carrinho, checkout, whatsapp, lead (+ms desde a entrada)
//   exposicao_elemento  1x por sessão por elemento saliente (banner, cupom…),
//                       com contador VITALÍCIO de exposições do visitante
//   interacao_elemento  clique no elemento, carregando em qual exposição ocorreu
//
// Todo evento carrega {sid, visita} no meta → agregação sem join. A curva
// "taxa de interação × nº da exposição" é o detector de habituação (Teste 4
// da pesquisa); o funil por segmento de visita cobre os Testes 1 e 5.
//
// Abandono sem interação NÃO tem evento próprio: deriva-se (sessão sem marco
// 'interacao'), porque gravação na saída da página é não-confiável.
// Aparelho do dono (fluxo_owner_device) não emite NADA — teste não é dado.

const VISITA_KEY = '@fluxo:atencao:visita-n';   // localStorage — contador vitalício de visitas
const SESSAO_KEY = '@fluxo:atencao:sessao';     // sessionStorage — {sid, t0, visita}
const MARCOS_KEY = '@fluxo:atencao:marcos';     // sessionStorage — marcos já gravados
const EXPS_KEY = '@fluxo:atencao:exps';       // localStorage — exposições vitalícias por elemento
const EXPS_SESSAO_KEY = '@fluxo:atencao:exps-sessao'; // sessionStorage — elementos já expostos nesta sessão

const lerJson = (storage, key, fallback) => {
  try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const gravarJson = (storage, key, value) => {
  try { storage.setItem(key, JSON.stringify(value)); } catch {}
};

let sessaoCache = null;

function sessaoAtual() {
  if (sessaoCache) return sessaoCache;
  sessaoCache = lerJson(sessionStorage, SESSAO_KEY, null);
  return sessaoCache;
}

// Insert direto (não passa pelo emitSignal: o throttle dele é por produto e
// derrubaria marcos distintos emitidos em sequência). Fire-and-forget sempre.
function gravar(event, meta) {
  if (isOwnerDevice()) return;
  const s = sessaoAtual();
  try {
    supabase.from('site_lead_signals').insert([{
      visitor_id: getVisitorId(),
      event,
      meta: { ...meta, sid: s?.sid || null, visita: s?.visita || null },
    }]).then(() => {}, (e) => console.warn('[attention] falhou:', e?.message));
  } catch { /* a loja nunca espera/quebra por telemetria */ }
}

function capturarOrigem() {
  const p = new URLSearchParams(window.location.search);
  let ref = 'direto';
  try {
    const host = document.referrer ? new URL(document.referrer).hostname : '';
    if (host && host !== window.location.hostname) ref = host;
  } catch {}
  return {
    utm_source: p.get('utm_source') || null,
    utm_medium: p.get('utm_medium') || null,
    utm_campaign: p.get('utm_campaign') || null,
    ref,
    entrada: window.location.pathname,
  };
}

/** Chamar 1x na montagem do App. Reload no meio da sessão não re-emite nada. */
export function iniciarAtencao() {
  if (isOwnerDevice()) return;
  try {
    if (!sessaoAtual()) {
      const visita = (Number(localStorage.getItem(VISITA_KEY)) || 0) + 1;
      try { localStorage.setItem(VISITA_KEY, String(visita)); } catch {}
      sessaoCache = {
        sid: `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        t0: Date.now(),
        visita,
      };
      gravarJson(sessionStorage, SESSAO_KEY, sessaoCache);
      gravar('sessao', {
        origem: capturarOrigem(),
        device: window.matchMedia?.('(min-width: 1024px)')?.matches ? 'desktop' : 'mobile',
      });
    }

    // Primeiro scroll REAL (>40px): o catálogo rola pelo #root, não pela window.
    // O threshold descarta os scrollTo programáticos de navegação interna.
    const scroller = document.getElementById('root') || window;
    const aoRolar = () => {
      const y = scroller === window ? window.scrollY : scroller.scrollTop;
      if (y < 40) return;
      scroller.removeEventListener('scroll', aoRolar);
      marco('scroll');
    };
    scroller.addEventListener('scroll', aoRolar, { passive: true });
  } catch { /* silencioso */ }
}

/** Grava um marco do funil — no máximo 1x por sessão por marco. */
export function marco(nome, extra = {}) {
  try {
    const s = sessaoAtual();
    if (!s) return;
    const feitos = lerJson(sessionStorage, MARCOS_KEY, {});
    if (feitos[nome]) return;
    feitos[nome] = 1;
    gravarJson(sessionStorage, MARCOS_KEY, feitos);
    gravar('marco_sessao', { marco: nome, ms: Date.now() - s.t0, ...extra });
  } catch {}
}

// Sinais de engajamento do leadSignals viram marcos do funil. O primeiro
// deles também fecha o elo 'interacao' (com o tipo que destravou a sessão).
const MARCO_POR_SINAL = {
  produto_visto: 'produto',
  carrinho_add: 'carrinho',
  checkout_aberto: 'checkout',
  whatsapp_produto: 'whatsapp',
  telefone_informado: 'lead',
};

/** Chamado pelo emitSignal — não usar direto. */
export function marcarEngajamento(evento) {
  if (evento === 'welcome_popup_visto') return; // exposição passiva, não interação
  marco('interacao', { tipo: evento });
  const m = MARCO_POR_SINAL[evento];
  if (m) marco(m);
}

const expsVitalicias = () => lerJson(localStorage, EXPS_KEY, {});

/**
 * Exposição de um elemento saliente (banner, cupom_boas_vindas, subbanner…).
 * 1x por sessão; o contador vitalício por visitante é o eixo X da curva de
 * habituação ("em qual exposição o elemento morre pra esse cliente").
 */
export function exposicaoElemento(elemento) {
  if (isOwnerDevice()) return;
  try {
    if (!sessaoAtual()) return;
    const nestaSessao = lerJson(sessionStorage, EXPS_SESSAO_KEY, {});
    if (nestaSessao[elemento]) return;
    nestaSessao[elemento] = 1;
    gravarJson(sessionStorage, EXPS_SESSAO_KEY, nestaSessao);
    const exps = expsVitalicias();
    exps[elemento] = (Number(exps[elemento]) || 0) + 1;
    gravarJson(localStorage, EXPS_KEY, exps);
    gravar('exposicao_elemento', { elemento, exposicao_n: exps[elemento] });
  } catch {}
}

/** Interação com o elemento — registra em qual exposição vitalícia ocorreu. */
export function interacaoElemento(elemento, extra = {}) {
  if (isOwnerDevice()) return;
  try {
    if (!sessaoAtual()) return;
    const n = Number(expsVitalicias()[elemento]) || 1;
    gravar('interacao_elemento', { elemento, exposicao_n: n, ...extra });
    marco('interacao', { tipo: `elemento:${elemento}` });
  } catch {}
}

/**
 * Observa um nó e registra a exposição quando ≥50% dele fica visível.
 * Retorna cleanup (padrão useEffect). Elemento fora da tela nunca conta:
 * exposição é o que o cliente VIU, não o que o React montou.
 */
export function observarExposicao(node, elemento) {
  if (!node || typeof IntersectionObserver === 'undefined') return () => {};
  const io = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      exposicaoElemento(elemento);
      io.disconnect();
    }
  }, { threshold: 0.5 });
  io.observe(node);
  return () => io.disconnect();
}
