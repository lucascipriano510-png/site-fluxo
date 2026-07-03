// =====================================================================
// FLUXO OUTLET — Grade completa de tamanhos no card aberto.
// A loja trabalha com grade padrão (camisa M–GG, calça 38–48, tênis 37–43).
// O card mostra a grade INTEIRA: o que não tem estoque aparece riscado com
// "Avise-me" — assim esgotado vira pedido de encomenda em vez de sumir.
// Tamanho fora do padrão (P, XGG…) que chegar entra na posição certa.
// =====================================================================

// Ordem canônica de tamanhos de letra (numérico ordena por valor).
// G1–G4 são plus size (entram depois do GG).
const LETTER_ORDER = ['PP', 'P', 'M', 'G', 'GG', 'G1', 'G2', 'G3', 'G4', 'XG', 'XGG', 'EG', 'EGG'];

const STANDARD_GRIDS = {
  roupas: ['M', 'G', 'GG'],
  calcas: ['38', '40', '42', '44', '46', '48'],
  calcados: ['37', '38', '39', '40', '41', '42', '43'],
};

const norm = (s) => String(s ?? '').trim().toUpperCase();
// Acessório de tamanho único (boné, óculos…) não tem grade pra expandir.
const isUnico = (s) => ['U', 'UNICO', 'ÚNICO', 'UNICA', 'ÚNICA', 'PADRAO', 'PADRÃO', 'TAM ÚNICO', 'TAM UNICO'].includes(norm(s));
// Tamanho "de grade": letra conhecida ou número de 2 dígitos. Etiqueta fora
// disso (ex.: "PADRÃO") indica produto sem grade — não inventa M/G/GG riscado.
const isGradeSize = (s) => LETTER_ORDER.includes(norm(s)) || /^\d{2}$/.test(norm(s));

// Tipo da peça: mesma dedução do guia de medidas (categoria > formato do tamanho).
export function sizeGridKind(product) {
  const ctx = `${product?.category || ''} ${product?.subcategory || ''} ${product?.name || ''}`;
  if (/CAL[ÇC]AD|T[ÊE]NIS|SAPAT|CHINEL|SAND[ÁA]L/i.test(ctx)) return 'calcados';
  if (/CAL[ÇC]A|BERMUDA|SHORT|JEANS/i.test(ctx)) return 'calcas';
  const sizes = (product?.sizes || []).map((s) => norm(typeof s === 'string' ? s : s?.size));
  if (sizes.some((s) => /^\d+$/.test(s))) return 'calcas';
  return 'roupas';
}

function sortKey(size) {
  const s = norm(size);
  if (/^\d+$/.test(s)) return [0, Number(s), ''];
  const idx = LETTER_ORDER.indexOf(s);
  return [1, idx === -1 ? LETTER_ORDER.length : idx, s];
}
const compareSizes = (a, b) => {
  const [ta, na, sa] = sortKey(a);
  const [tb, nb, sb] = sortKey(b);
  return ta - tb || na - nb || sa.localeCompare(sb);
};

// Grade completa do card: união [grade padrão ∪ tamanhos cadastrados], ordenada.
// Retorna [{ size, stock }]; stock 0 = riscado + Avise-me.
// Não expande a grade quando: kit, tamanho único, ou produto sem grade cadastrada
// (produto de estoque simples não pode virar um paredão de esgotado falso).
export function buildSizeGrid(product) {
  // `size` mantém a grafia cadastrada — carrinho e baixa de estoque casam por
  // string exata; só a chave de comparação é normalizada.
  const own = (product?.sizes || []).map((s) => ({
    size: String(typeof s === 'string' ? s : s?.size ?? '').trim(),
    stock: typeof s === 'string' ? Number(product?.stock || 0) : Number(s?.stock || 0),
  })).filter((e) => e.size);

  const skipExpand = product?.is_kit || own.length === 0
    || own.some((e) => isUnico(e.size)) || !own.some((e) => isGradeSize(e.size));
  if (skipExpand) return own;

  const byKey = new Map(own.map((e) => [norm(e.size), e]));
  const keys = new Set([...STANDARD_GRIDS[sizeGridKind(product)].map(norm), ...byKey.keys()]);

  return [...keys]
    .sort(compareSizes)
    .map((key) => byKey.get(key) ?? { size: key, stock: 0 });
}
