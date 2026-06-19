// =====================================================================
// FLUXO OUTLET — Formatação compartilhada (moeda BRL)
// =====================================================================
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatBRL = (v) => BRL.format(Number(v) || 0);
