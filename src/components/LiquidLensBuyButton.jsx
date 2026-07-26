import { motion } from 'framer-motion';
import React from 'react';

// Uma lente curta, não um botão com efeito aplicado por cima. As camadas têm
// profundidades diferentes e o reflexo acompanha o ponto real de interação.
export default function LiquidLensBuyButton({ onClick, reducedMotion = false }) {
  const ref = React.useRef(null);

  const paintLight = (event) => {
    if (reducedMotion || !ref.current) return;
    const bounds = ref.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    ref.current.style.setProperty('--lens-x', `${x * 100}%`);
    ref.current.style.setProperty('--lens-y', `${y * 100}%`);
    ref.current.style.setProperty('--lens-shift-x', `${(x - 0.5) * 5}px`);
    ref.current.style.setProperty('--lens-shift-y', `${(y - 0.5) * 3}px`);
  };

  const resetLight = () => {
    if (!ref.current) return;
    ref.current.style.setProperty('--lens-x', '28%');
    ref.current.style.setProperty('--lens-y', '22%');
    ref.current.style.setProperty('--lens-shift-x', '-1px');
    ref.current.style.setProperty('--lens-shift-y', '-1px');
  };

  return (
    <motion.button
      ref={ref}
      type="button"
      className="flux-card-buy-cta"
      onClick={onClick}
      onPointerDown={paintLight}
      onPointerMove={(event) => { if (event.pointerType !== 'touch') paintLight(event); }}
      onPointerLeave={resetLight}
      onBlur={resetLight}
      whileHover={reducedMotion ? {} : { scale: 1.04, transition: { duration: 0.15, ease: 'easeOut' } }}
      whileTap={reducedMotion ? {} : { scale: 0.96, transition: { duration: 0.08 } }}
      style={{
        height: '32px', padding: '0 12px', borderRadius: '8px', flexShrink: 0,
        fontWeight: '750', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase',
        cursor: 'pointer', fontFamily: 'inherit', outline: 'none', touchAction: 'manipulation',
      }}
    >
      <span className="flux-card-buy-cta__body" aria-hidden="true">
        <span className="flux-card-buy-cta__refraction" />
        <span className="flux-card-buy-cta__reflection" />
        <span className="flux-card-buy-cta__rim" />
      </span>
      <span className="flux-card-buy-cta__label">COMPRAR</span>
    </motion.button>
  );
}
