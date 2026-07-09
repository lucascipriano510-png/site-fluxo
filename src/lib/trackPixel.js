import { trackEvent } from './metaPixel';

// Wrapper compat: encaminha pro pipeline híbrido (Pixel + CAPI com dedup)
export const trackPixel = (eventName, payload = {}) => {
  try { trackEvent(eventName, payload); }
  catch (e) { console.warn('[trackPixel] falhou:', e); }
};
