// Detecção de aparelho fraco/dados economizados — os efeitos caros (atmosfera
// three.js, morph de View Transition) são LUXO: quem tem pouco hardware ou
// pediu economia recebe o site rápido e limpo, sem pagar pelo cenário.
export const isLowEndDevice = () => {
  try {
    if (navigator.connection?.saveData) return true;
    if (navigator.deviceMemory && navigator.deviceMemory <= 3) return true;
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 3) return true;
  } catch { /* sem sinal = assume capaz */ }
  return false;
};
