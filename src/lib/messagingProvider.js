// Camada de abstração para envio de mensagens.
// Por enquanto usa link wa.me. Preparado para Meta WhatsApp Cloud API, Evolution API, etc.

export function generateWhatsAppLink(phone, message) {
  const cleaned = String(phone || '').replace(/\D/g, '');
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}

// TODO: implementar envio real via provider (Meta Cloud API, Evolution API, etc.)
export async function sendMessage(phone, message) {
  console.log('[messagingProvider] sendMessage (mock):', { phone, message });
  return { success: true, mocked: true };
}

// TODO: processar webhook do provider ao receber mensagem do cliente
// Estrutura esperada: { from, message, timestamp, messageId }
export async function receiveWebhook(payload) {
  console.log('[messagingProvider] receiveWebhook:', payload);
  return { received: true };
}
