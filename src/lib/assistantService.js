const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

// Gera resposta sugerida baseada no atendimento.
// Estrutura preparada para substituição futura por IA (OpenAI, Claude, etc.).
export function generateSuggestedReply(atendimento) {
  const contato = atendimento?.contato || {};
  const nome = (contato.nome || 'cliente').split(' ')[0];
  const produto = contato.produto_interesse || 'nossos produtos';
  const valor = contato.valor_potencial
    ? BRL.format(Number(contato.valor_potencial))
    : null;
  const status = atendimento?.status || 'novo';

  if (status === 'novo') {
    return valor
      ? `Olá, ${nome}! Vi que você se interessou por ${produto}. Temos disponível por ${valor}. Posso confirmar o pedido para você agora?`
      : `Olá, ${nome}! Vi que você finalizou um pedido conosco. Estamos prontos para confirmar. Posso te ajudar?`;
  }

  if (status === 'aguardando_pagamento') {
    return `Olá, ${nome}! Seu pedido está aguardando o pagamento. Assim que confirmarmos, tratamos do envio imediatamente. Precisa de ajuda com o pagamento?`;
  }

  if (status === 'aguardando_cliente') {
    return `Olá, ${nome}! Precisamos de mais algumas informações para concluir seu pedido. Pode nos retornar quando possível?`;
  }

  if (status === 'em_atendimento') {
    return `Olá, ${nome}! Estou aqui para te ajudar. Alguma dúvida sobre o pedido de ${produto}?`;
  }

  return `Olá, ${nome}! Aqui é da nossa equipe. Estamos à disposição. Como posso te atender?`;
}

// Classifica o lead com base no valor potencial.
// Preparado para uso de IA futura.
export function classifyLead(atendimento) {
  const valor = Number(atendimento?.contato?.valor_potencial || 0);
  if (valor >= 500) return 'alta';
  if (valor >= 150) return 'normal';
  return 'baixa';
}

// Resume o atendimento em texto curto.
// Preparado para uso de IA futura.
export function summarizeConversation(atendimento) {
  const contato = atendimento?.contato || {};
  const partes = [];
  if (contato.nome) partes.push(`Cliente: ${contato.nome}`);
  if (contato.telefone) partes.push(`Tel: ${contato.telefone}`);
  if (contato.produto_interesse) partes.push(`Interesse: ${contato.produto_interesse}`);
  if (contato.valor_potencial) partes.push(`Valor: ${BRL.format(Number(contato.valor_potencial))}`);
  partes.push(`Status: ${atendimento?.status || 'novo'}`);
  return partes.join(' | ');
}
