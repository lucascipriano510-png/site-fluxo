// Resposta tátil curtinha nos momentos de decisão (escolher tamanho, fechar
// sacola). Android vibra; iOS Safari não suporta navigator.vibrate e ignora
// sem erro. Pulso de 10-20ms = "tick" de aparelho, não zumbido de notificação.
export const hapticTick = (ms = 12) => {
  try { navigator.vibrate?.(ms); } catch { /* sem suporte, segue o jogo */ }
};
