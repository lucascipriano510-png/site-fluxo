import React from 'react';

// Luz ambiente que segue o dedo/cursor — continuação dos neons do galpão do
// hero de vídeo. UM único elemento fixo movido só por transform (compositor,
// zero repaint e zero re-render React) — respeita a cicatriz GPU×nitidez:
// nada é criado sobre os cards além deste glow translúcido em blend screen.
// Some sozinho após 1,4s parado; motion reduzido = nunca aparece.
const TouchGlow = () => {
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    let raf = 0;
    let x = -600;
    let y = -600;
    let idleTimer = 0;
    const paint = () => { raf = 0; el.style.transform = `translate3d(${x - 260}px, ${y - 260}px, 0)`; };
    const move = (e) => {
      const t = e.touches ? e.touches[0] : e;
      if (!t) return;
      x = t.clientX; y = t.clientY;
      el.style.opacity = '1';
      if (!raf) raf = requestAnimationFrame(paint);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { el.style.opacity = '0'; }, 1400);
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('touchmove', move);
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(idleTimer);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="fixed top-0 left-0 w-[520px] h-[520px] rounded-full pointer-events-none z-[35]"
      style={{
        opacity: 0,
        transition: 'opacity 0.8s ease',
        mixBlendMode: 'screen',
        transform: 'translate3d(-600px, -600px, 0)',
        background: 'radial-gradient(circle, rgba(96,165,250,0.10) 0%, rgba(239,68,68,0.05) 38%, rgba(0,0,0,0) 68%)',
      }}
    />
  );
};

export default TouchGlow;
