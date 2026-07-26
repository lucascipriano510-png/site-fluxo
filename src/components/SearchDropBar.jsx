import React, { forwardRef, useImperativeHandle } from 'react';
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { isLowEndDevice } from '../lib/deviceTier';

// =====================================================================
// A BARRA-GOTA — a barra de busca INTEIRA é uma gota d'água deitada na
// página: vidro líquido NEUTRO (água não tem cor — nada de tinta),
// menisco claro na borda de cima, brilho especular alongado como luz
// batendo na superfície e sombra descolando ela do fundo.
// Tocada, a barra toda treme como gelatina: squash & stretch sutil
// (barra larga não pode esticar no X — o tremor vivo é no Y) com o
// contorno ondulando fora de fase, que é o que lê "líquido".
// Aparelho fraco / prefers-reduced-motion: vidro parado.
// Recebe o input como children; o visual é todo do wrapper.
// =====================================================================

const REST_RADIUS = '28px 28px 28px 28px / 28px 28px 28px 28px';
const WOBBLE = {
  scaleY: [1, 0.90, 1.08, 0.96, 1.02, 1],
  scaleX: [1, 1.012, 0.994, 1.004, 0.999, 1],
  borderRadius: [
    REST_RADIUS,
    '31px 25px 33px 24px / 35px 22px 31px 24px',
    '25px 32px 24px 33px / 23px 34px 24px 32px',
    '29px 26px 30px 26px / 30px 25px 29px 26px',
    '27px 29px 28px 28px / 28px 29px 27px 28px',
    REST_RADIUS,
  ],
};
const WOBBLE_T = { duration: 0.85, times: [0, 0.15, 0.34, 0.55, 0.78, 1], ease: 'easeOut' };

const SearchDropBar = forwardRef(function SearchDropBar({ focused, children }, ref) {
  const reduced = useReducedMotion();
  const still = reduced || isLowEndDevice();
  const controls = useAnimationControls();

  useImperativeHandle(ref, () => ({
    wobble() {
      if (still) return;
      controls.stop();
      controls.start({ ...WOBBLE, transition: WOBBLE_T });
    },
  }), [still, controls]);

  return (
    <motion.div
      animate={controls}
      className="relative"
      style={{
        borderRadius: REST_RADIUS,
        transformOrigin: '50% 65%',
        // Corpo d'água neutro: película clara em cima afinando pro meio,
        // juntando de novo embaixo — vidro, não pintura.
        background:
          'radial-gradient(70% 120% at 18% -28%, rgb(var(--hero-light-rgb, 232 234 236) / 0.19), transparent 62%), linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03) 38%, rgba(255,255,255,0.015) 62%, rgba(255,255,255,0.06)), var(--bg-surface)',
        border: `1px solid ${focused ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.15)'}`,
        boxShadow: [
          'inset 0 1px 1.5px rgba(255,255,255,0.30)',      // menisco (luz de cima)
          'inset 0 -12px 18px -14px rgba(255,255,255,0.12)', // reflexo do fundo da gota
          'inset 0 -1px 2px rgba(0,0,0,0.35)',              // peso da água na base
          '0 12px 24px -14px rgba(0,0,0,0.65)',             // gota descolada da página
          focused ? '0 4px 28px -6px rgba(255,255,255,0.10)' : '0 0 0 0 rgba(255,255,255,0)', // foco: água acesa (neutra)
        ].join(', '),
        transition: 'border-color 0.35s cubic-bezier(0.22,1,0.36,1), box-shadow 0.35s cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      {/* Brilho especular alongado — a luz escorrendo na superfície da gota */}
      <span aria-hidden="true" className="absolute pointer-events-none" style={{ top: 5, left: 22, right: '52%', height: 7, borderRadius: 9999, background: 'rgb(var(--hero-light-rgb, 232 234 236) / 0.18)', filter: 'blur(3px)' }} />
      {/* Faísca menor no canto oposto, como segunda fonte de luz */}
      <span aria-hidden="true" className="absolute pointer-events-none" style={{ top: 7, right: 30, width: 26, height: 4, borderRadius: 9999, background: 'rgba(255,255,255,0.09)', filter: 'blur(2px)' }} />
      {children}
    </motion.div>
  );
});

export default SearchDropBar;
