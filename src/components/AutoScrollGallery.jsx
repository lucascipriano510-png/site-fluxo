import React from 'react';

// ──────────────────────────────────────────────────────────────
// Galeria do card que passa as fotos SÓ ONDE O DEDO ESTÁ PASSANDO (mobile).
// Enquanto o cliente rola e o dedo passa por cima de um card (sem precisar
// segurar/pressionar), AQUELE card vai trocando as fotos sozinho. Saiu dele
// (foi pra outro card ou levantou o dedo), para. Apenas um por vez muda.
// Não bloqueia o scroll vertical: só listeners passivos (nunca preventDefault).
// Como o touchmove fica "preso" no alvo inicial, um rastreador global usa
// elementFromPoint p/ saber sobre qual card o dedo está a cada momento.
// ──────────────────────────────────────────────────────────────
// overflowX 'hidden' (não 'scroll') = o card NÃO é arrastável na horizontal; o
// swipe lateral passa pro carrossel pai. O auto-avanço usa scrollTo programático,
// que segue funcionando com overflow hidden. touchAction 'pan-y' libera só a
// rolagem vertical da página.
export const HOLD_SCROLL_STYLE = { position: 'absolute', inset: 0, display: 'flex', overflowX: 'hidden', overflowY: 'hidden', scrollSnapType: 'x mandatory', overscrollBehaviorX: 'contain', msOverflowStyle: 'none', scrollbarWidth: 'none', touchAction: 'pan-y' };
export const AUTOPLAY_MS = 1400; // ritmo entre as fotos enquanto o dedo está sobre o card (modo toque)
export const AUTO_CYCLE_MS = 2800; // ritmo do modo AUTO (destaque), sozinho — mais lento/ambiente

// Registro de galerias + rastreador global de toque (inicializado uma vez).
const galleryRegistry = new Map(); // element -> { activate, deactivate }
let activeGalleryEl = null;
let galleryListenersOn = false;
let galleryDwellCard = null;    // card atualmente sob o dedo (sendo cronometrado)
let galleryDwellTimer = null;   // dispara quando o dedo fica ~DWELL_MS sobre o MESMO card
let galleryLastCheck = 0;       // throttle do elementFromPoint
let galleryLastX = 0, galleryLastY = 0; // última posição do dedo (usada quando o timer dispara)
const GALLERY_DWELL_MS = 280;   // tempo do dedo SOBRE a imagem p/ começar a passar as fotos

const setActiveGalleryAt = (x, y) => {
  let el = null;
  try {
    const node = document.elementFromPoint(x, y);
    el = node ? node.closest('[data-autogallery="1"]') : null;
  } catch { el = null; }
  if (el === activeGalleryEl) return;
  if (activeGalleryEl && galleryRegistry.has(activeGalleryEl)) galleryRegistry.get(activeGalleryEl).deactivate();
  activeGalleryEl = el;
  if (el && galleryRegistry.has(el)) galleryRegistry.get(el).activate();
};
const ensureGalleryListeners = () => {
  if (galleryListenersOn || typeof window === 'undefined') return;
  galleryListenersOn = true;
  // Gatilho estilo "hover no mobile": o dedo passando/pousado SOBRE um card por
  // ~DWELL_MS faz aquele card começar a passar as fotos. Durante a rolagem por
  // arrasto o conteúdo acompanha o dedo, então o MESMO card fica sob ele -> depois
  // de ~1s ativa. Trocar de card (novo toque) troca o ativo. Um por vez. O cliente
  // não precisa saber que é toque.
  const cardAt = (x, y) => {
    try { const n = document.elementFromPoint(x, y); return n ? n.closest('[data-autogallery="1"]') : null; }
    catch { return null; }
  };
  const clearDwell = () => { if (galleryDwellTimer) { clearTimeout(galleryDwellTimer); galleryDwellTimer = null; } };
  const track = (x, y) => {
    galleryLastX = x; galleryLastY = y;
    const now = Date.now();
    if (now - galleryLastCheck < 70) return; // throttle do elementFromPoint
    galleryLastCheck = now;
    const el = cardAt(x, y);
    if (el === galleryDwellCard) return; // ainda sobre o mesmo card -> deixa o timer correr
    galleryDwellCard = el;
    clearDwell();
    // Trocou de card (ou saiu de todos): solta na hora o que estava passando (volta pra principal).
    if (activeGalleryEl && activeGalleryEl !== el && galleryRegistry.has(activeGalleryEl)) {
      galleryRegistry.get(activeGalleryEl).deactivate();
      activeGalleryEl = null;
    }
    // Sobre um novo card: cronometra o "descanso" p/ ativá-lo.
    if (el && el !== activeGalleryEl) {
      galleryDwellTimer = setTimeout(() => {
        galleryDwellTimer = null;
        setActiveGalleryAt(galleryLastX, galleryLastY);
      }, GALLERY_DWELL_MS);
    }
  };
  const onStart = (e) => { const t = e.touches && e.touches[0]; if (!t) return; galleryLastCheck = 0; galleryDwellCard = null; track(t.clientX, t.clientY); };
  const onMove = (e) => { const t = e.touches && e.touches[0]; if (!t) return; track(t.clientX, t.clientY); };
  const onEnd = () => { clearDwell(); galleryDwellCard = null; }; // levantar cancela o dwell pendente (tap seco não ativa)
  window.addEventListener('touchstart', onStart, { passive: true });
  window.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('touchend', onEnd, { passive: true });
  window.addEventListener('touchcancel', onEnd, { passive: true });
};

// Galeria do card por CROSSFADE de opacidade — SEM scroll e SEM transform, logo
// SEM camada de GPU em repouso. A imagem visível renderiza direta = nitidez máxima
// no desktop (o Chrome usa downscale de alta qualidade só fora de camadas GPU).
const AutoScrollGallery = ({ count = 1, children, auto = false, startDelay = 0 }) => {
  const ref = React.useRef(null);
  const timerRef = React.useRef(null);
  const multi = count > 1;
  const [idx, setIdx] = React.useState(0);
  const advance = React.useCallback(() => setIdx((i) => (i + 1) % count), [count]);

  // MODO AUTO (destaque): cicla sozinho após startDelay.
  React.useEffect(() => {
    if (!auto || !multi) return;
    let intervalId = null;
    const startId = setTimeout(() => {
      advance();
      intervalId = setInterval(advance, AUTO_CYCLE_MS);
    }, startDelay);
    return () => { clearTimeout(startId); if (intervalId) clearInterval(intervalId); };
  }, [auto, multi, startDelay, advance]);

  // MODO TOQUE (catálogo): cicla enquanto o dedo está parado sobre o card.
  React.useEffect(() => {
    if (auto || !multi) return;
    ensureGalleryListeners();
    const el = ref.current;
    if (!el) return;
    el.setAttribute('data-autogallery', '1');
    const controller = {
      activate: () => {
        if (timerRef.current) return;
        advance();
        timerRef.current = setInterval(advance, AUTOPLAY_MS);
      },
      // Ao interromper (dedo saiu / tocou em outra área): para o ciclo E volta
      // SEMPRE pra primeira imagem (a principal), não importa onde parou.
      // O crossfade de opacidade já faz a volta suave.
      deactivate: () => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        setIdx(0);
      },
    };
    galleryRegistry.set(el, controller);
    return () => {
      controller.deactivate();
      galleryRegistry.delete(el);
      if (activeGalleryEl === el) activeGalleryEl = null;
    };
  }, [auto, multi, advance]);

  // DESKTOP (hover): passar o mouse por cima vai trocando as fotos; sair volta
  // SEMPRE pra principal. Só em dispositivos com hover real (não dispara em toque).
  const canHover = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: hover)').matches;
  const hoverStart = () => {
    if (auto || timerRef.current) return;
    advance();
    timerRef.current = setInterval(advance, AUTOPLAY_MS);
  };
  const hoverStop = () => {
    if (auto) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setIdx(0);
  };

  const arr = React.Children.toArray(children);
  // Imagem ÚNICA (a maioria): renderiza DIRETA, sem nenhum wrapper de opacidade
  // -> nenhuma camada de GPU -> a foto renderiza direto = nitidez maxima.
  if (arr.length <= 1) return arr[0] || null;
  // Múltiplas: crossfade por opacidade. touchAction pan-y deixa o arrasto
  // horizontal passar pro carrossel pai.
  return (
    <div
      ref={ref}
      style={{ position: 'absolute', inset: 0, touchAction: 'pan-y' }}
      onMouseEnter={canHover ? hoverStart : undefined}
      onMouseLeave={canHover ? hoverStop : undefined}
    >
      {arr.map((child, i) => (
        <div
          key={i}
          style={{
            position: 'absolute', inset: 0,
            opacity: i === idx ? 1 : 0,
            transition: 'opacity 0.45s ease',
            pointerEvents: i === idx ? 'auto' : 'none',
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
};

export default AutoScrollGallery;
