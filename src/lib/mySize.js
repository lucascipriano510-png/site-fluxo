import { interacaoElemento, observarExposicao } from './attention';
import { sizeGuideKind } from '../components/SizeGuideModal';

// ── SEU NÚMERO (pesquisa módulo 3 — desejo de possuir) ──
// A dúvida nº1 do WhatsApp real é "tem [peça] no [tamanho]?" (165 msgs), e o
// módulo 3 mostra que desejo exige que o resultado "se aplique a mim": a peça
// tem que parecer DO MEU tamanho, não "disponível". O site aprende o número do
// cliente na primeira peça que ele põe na sacola (por tipo de peça: camisa M /
// calça 42 / tênis 41 — mesma divisão do guia de medidas) e daí em diante a
// vitrine responde antes da pergunta: chip "Seu 42" na faixa do card e destaque
// no seletor. Fica no aparelho (localStorage), zero cadastro; pra quem nunca
// escolheu tamanho o site é EXATAMENTE o de hoje — benefício ganho, não imposto.
// Aprende só commit com UM tamanho (mais de um = compra pra outros, ambíguo);
// recência corrige sozinha (comprou presente → próxima compra própria regrava).
const KEY = '@fluxo:seu-numero';

const lerMapa = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
};

const tamanhoValido = (s) => {
  const n = String(s || '').trim().toUpperCase();
  return n && n !== 'U' && n !== 'UNICO' && n !== 'ÚNICO' && n !== 'PADRÃO' && n !== 'PADRAO';
};

/** Chamar no commit da sacola. Só aprende quando UM tamanho foi escolhido. */
export function rememberMySize(product, selectedSizes) {
  try {
    if (!product || product.is_kit) return;
    const picked = Object.entries(selectedSizes || {}).filter(([, q]) => Number(q) > 0).map(([s]) => s);
    if (picked.length !== 1 || !tamanhoValido(picked[0])) return;
    const mapa = lerMapa();
    mapa[sizeGuideKind(product)] = { size: String(picked[0]).trim(), t: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(mapa));
  } catch { /* memória de tamanho nunca quebra a compra */ }
}

/** Número aprendido pro TIPO deste produto (ou null). */
export function getMySize(product) {
  try {
    if (!product || product.is_kit) return null;
    const lembrado = lerMapa()[sizeGuideKind(product)];
    return lembrado?.size || null;
  } catch { return null; }
}

/** O número do cliente, SE este produto o tem em estoque (senão null — nunca
 *  sinalizar negativo no card; ausência = card igual ao de todo mundo). */
export function hasMyNumber(product) {
  const meu = getMySize(product);
  if (!meu) return null;
  const tem = (product.sizes || []).some((s) => {
    const nome = typeof s === 'string' ? s : s?.size;
    const stock = typeof s === 'string' ? (product.stock || 0) : Number(s?.stock || 0);
    return String(nome).trim() === meu && stock > 0;
  });
  return tem ? meu : null;
}

// ── Telemetria (elemento 'meu_numero' no attention.js) ──
let ioArmado = false;
/** Ref do primeiro chip personalizado renderizado: 1 exposição por sessão. */
export function marcarMeuNumeroExposto(el) {
  if (ioArmado || !el) return;
  ioArmado = true;
  observarExposicao(el, 'meu_numero');
}

/** Chamar ao abrir produto: registra interação se o card mostrava o chip. */
export function tocouCardComMeuNumero(product) {
  if (hasMyNumber(product)) interacaoElemento('meu_numero', { sku: product.sku || null });
}
