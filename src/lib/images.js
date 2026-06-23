// =====================================================================
// FLUXO OUTLET — Utilitários de imagem (otimização via CDN wsrv.nl)
// Uploads são salvos em ALTA RESOLUÇÃO (1–5 MB). O proxy wsrv.nl faz
// resize + WebP on-the-fly; sem ele um card de ~200px baixaria o original
// inteiro. O onError do <img> sempre cai pra URL original se o proxy falhar.
// =====================================================================

// Flag de sessão: se wsrv.nl falhou nessa sessão, pula o proxy em todas as imagens.
// Chave _v2: reseta qualquer trava antiga que tenha ficado presa no navegador
// (uma falha transitória do wsrv desligava o proxy e servia o original cru,
// ignorando largura/qualidade/sharpen — causa de "não muda nada faça o que fizer").
const WSRV_FAILED_KEY = 'wsrv_failed_v2';
let wsrvFailed = sessionStorage.getItem(WSRV_FAILED_KEY) === '1';

export const markWsrvFailed = () => {
  wsrvFailed = true;
  try { sessionStorage.setItem(WSRV_FAILED_KEY, '1'); } catch {}
};

// Otimização de imagens via CDN (WebP + resize on-the-fly).
export const optimizeImage = (src, width = 600, quality = 90) => {
  if (!src || typeof src !== 'string') return src;
  if (src.startsWith('data:') || src.startsWith('blob:')) return src;
  try {
    const clean = src.split('?')[0];

    // Unsplash: otimização via parâmetros nativos
    if (clean.includes('images.unsplash.com')) {
      const u = new URL(src);
      u.searchParams.set('w', String(width));
      u.searchParams.set('q', String(quality));
      u.searchParams.set('fm', 'webp');
      u.searchParams.set('fit', 'crop');
      return u.toString();
    }

    // Se wsrv.nl já falhou nessa sessão, usa URL direta para qualquer origem
    if (wsrvFailed) return src;

    // Supabase Storage + demais URLs externas: wsrv.nl faz resize + WebP on-the-fly.
    // &sharp = sharpen pós-redução (o pulo do gato): imagem reduzida fica mole;
    // o sharpen devolve o "estalo" de nitidez que as CDNs profissionais aplicam.
    return `https://wsrv.nl/?url=${encodeURIComponent(clean)}&w=${width}&q=${quality}&output=webp&we&sharp=5`;
  } catch {
    return src;
  }
};

export const buildSrcSet = (src, widths = [400, 600, 900, 1200, 1600], quality = 90) => {
  if (!src) return undefined;
  return widths.map((w) => `${optimizeImage(src, w, quality)} ${w}w`).join(', ');
};

// Normaliza o dado de imagem de categoria: aceita string (url) ou { url, pos }.
export const getCatImgData = (val) => {
  if (!val) return { url: null, pos: '50% 50%' };
  if (typeof val === 'string') return { url: val, pos: '50% 50%' };
  return { url: val.url || null, pos: val.pos || '50% 50%' };
};
