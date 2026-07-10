// Faixas de preço (chips de filtro). max=null => sem teto.
export const PRICE_RANGES = [
  { key: 'ate100', label: 'Até R$ 100', min: null, max: 100 },
  { key: '100a200', label: 'R$ 100–200', min: 100, max: 200 },
  { key: '200a300', label: 'R$ 200–300', min: 200, max: 300 },
  { key: '300mais', label: 'R$ 300+', min: 300, max: null },
];
// Cor do nome → bolinha do chip de cor. Desconhecida cai num cinza neutro.
export const COLOR_HEX = {
  preto: '#111111', branco: '#f4f4f5', azul: '#3b82f6', 'azul marinho': '#1e3a8a',
  vermelho: '#ef4444', verde: '#22c55e', bege: '#d8c3a5', cinza: '#9ca3af',
  marrom: '#8b5a2b', rosa: '#ec4899', amarelo: '#eab308', laranja: '#f97316',
  roxo: '#8b5cf6', lilas: '#c4b5fd', vinho: '#7f1d1d', dourado: '#d4af37',
  prata: '#c0c0c0', nude: '#e3bc9a', caramelo: '#c97b3c', off: '#efe9dd',
};
export const colorDot = (name) => COLOR_HEX[String(name || '').toLowerCase()] || null;

// Delay negativo (0 a -5.9s) derivado do id: dessincroniza o "shine" dos cards.
// Sem isso o brilho de 6s pisca AO MESMO TEMPO em toda a grade e vira ruído de
// fundo constante; com fase própria por produto vira detalhe, não movimento.
export const shineDelay = (id) => {
  const sum = [...String(id ?? '')].reduce((a, c) => a + c.charCodeAt(0), 0);
  return `-${((sum % 60) / 10).toFixed(1)}s`;
};

// Categoria vem do banco no SINGULAR (CAMISA, CALÇA…) — na vitrine exibimos o
// PLURAL (CAMISAS, CALÇAS…). SÓ exibição: o valor do filtro/URL segue o original.
// Regra: já termina em S (TÊNIS, ÓCULOS) fica igual; senão ganha S.
export const pluralCat = (cat) => {
  const c = String(cat || '').trim();
  if (!c || c === 'TODOS') return c;
  return /s$/i.test(c) ? c : `${c}S`;
};
