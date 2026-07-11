import React from 'react';
import { isLowEndDevice } from '../lib/deviceTier';

// ── PRODUTO "HOLOGRÁFICO" ────────────────────────────────────────────────
// A foto da peça reage à INCLINAÇÃO física do celular: paralaxe sutil + um
// brilho de luz que corre pela imagem conforme o aparelho vira — sensação
// de carta holográfica. DeviceOrientation roda solto no Android (maioria da
// clientela); iOS exige permissão via gesto, então fica de fora por ora —
// o efeito é 100% progressivo (sem giroscópio = foto normal).
// Engenharia: UM wrapper com transform + UM véu com background-position,
// ambos via rAF com lerp — zero repaint pesado, zero re-render React.
// Aparelho fraco e motion reduzido nem ligam o listener.
const HoloTilt = ({ children, className = '', style }) => {
  const ref = React.useRef(null);
  const sheenRef = React.useRef(null);

  React.useEffect(() => {
    const el = ref.current;
    const sheen = sheenRef.current;
    if (!el || !sheen) return undefined;
    if (isLowEndDevice()) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return undefined;
    if (typeof DeviceOrientationEvent === 'undefined') return undefined;
    // iOS: requestPermission exige gesto do usuário — sem prompt intrusivo aqui.
    if (typeof DeviceOrientationEvent.requestPermission === 'function') return undefined;

    let raf = 0;
    let gx = 0; let gy = 0; // alvo (inclinação normalizada -1..1)
    let cx = 0; let cy = 0; // atual (persegue o alvo com lerp)
    const paint = () => {
      cx += (gx - cx) * 0.12;
      cy += (gy - cy) * 0.12;
      el.style.transform = `scale(1.045) translate(${(cx * 7).toFixed(2)}px, ${(cy * 7).toFixed(2)}px)`;
      sheen.style.opacity = String(Math.min(0.5, Math.hypot(cx, cy) * 0.55));
      sheen.style.backgroundPosition = `${(50 + cx * 55).toFixed(1)}% ${(50 + cy * 55).toFixed(1)}%`;
      if (Math.abs(gx - cx) > 0.002 || Math.abs(gy - cy) > 0.002) raf = requestAnimationFrame(paint);
      else raf = 0;
    };
    const onTilt = (e) => {
      if (e.gamma == null || e.beta == null) return;
      gx = Math.max(-1, Math.min(1, e.gamma / 28));       // vira esquerda/direita
      gy = Math.max(-1, Math.min(1, (e.beta - 45) / 28)); // inclina frente/trás (45° = pegada natural)
      if (!raf) raf = requestAnimationFrame(paint);
    };
    window.addEventListener('deviceorientation', onTilt, { passive: true });
    return () => {
      window.removeEventListener('deviceorientation', onTilt);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div ref={ref} className={className} style={{ ...style, willChange: 'transform' }}>
        {children}
      </div>
      {/* Véu holográfico: luz que corre pela foto com a inclinação */}
      <div
        ref={sheenRef}
        aria-hidden="true"
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          opacity: 0,
          mixBlendMode: 'screen',
          background: 'radial-gradient(60% 45% at 50% 50%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 45%, rgba(0,0,0,0) 70%)',
          backgroundSize: '160% 160%',
          backgroundPosition: '50% 50%',
          transition: 'opacity 0.3s ease',
        }}
      />
    </>
  );
};

export default HoloTilt;
