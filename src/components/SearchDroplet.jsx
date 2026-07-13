import React, { forwardRef, useImperativeHandle } from 'react';
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { Search } from 'lucide-react';
import { isLowEndDevice } from '../lib/deviceTier';

// =====================================================================
// A GOTA — o ícone da busca é uma gota d'água pousada na barra: lente
// que entorta o brilho atrás dela (backdrop-filter), reflexo especular
// e cáustica esmeralda embaixo. Tocou na barra, treme como gelatina:
// molas de squash & stretch preservando volume (scaleX·scaleY ≈ 1) com
// o contorno ondulando junto. Em repouso, flutua devagar.
// Aparelho fraco / prefers-reduced-motion: gota parada e sem lente —
// o luxo é opcional, a busca não.
// A gota é decorativa (aria-hidden) e não captura toque: o toque é da
// barra, que avisa a gota via ref.wobble().
// =====================================================================

// Tremida de gelatina: amplitude decai a cada meia-volta; borderRadius
// ondula fora de fase com a escala pra parecer líquido, não borracha.
const WOBBLE = {
  scaleX: [1, 1.22, 0.84, 1.1, 0.95, 1.02, 1],
  scaleY: [1, 0.78, 1.16, 0.9, 1.05, 0.98, 1],
  borderRadius: [
    '50%',
    '46% 54% 58% 42% / 56% 48% 52% 44%',
    '58% 42% 44% 56% / 44% 58% 42% 56%',
    '48% 52% 54% 46% / 52% 46% 54% 48%',
    '52% 48% 47% 53% / 49% 53% 47% 51%',
    '50%',
    '50%',
  ],
};
const WOBBLE_T = { duration: 0.9, times: [0, 0.12, 0.28, 0.46, 0.65, 0.84, 1], ease: 'easeOut' };

const SearchDroplet = forwardRef(function SearchDroplet({ focused }, ref) {
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
      aria-hidden="true"
      className="absolute left-3 top-1/2 -mt-[17px] pointer-events-none z-[1]"
      animate={still ? undefined : { y: [0, -2.5, 0, 2.5, 0] }}
      transition={still ? undefined : { duration: 4.6, repeat: Infinity, ease: 'easeInOut' }}
    >
      <motion.div
        animate={controls}
        className="relative grid place-items-center w-[34px] h-[34px]"
        style={{
          borderRadius: '50%',
          // Corpo d'água: quase transparente no miolo, menisco claro na borda
          // superior e o fundo puxando pro esmeralda da marca.
          background:
            'radial-gradient(circle at 32% 26%, rgba(255,255,255,0.30), rgba(255,255,255,0.07) 40%, rgba(255,255,255,0.02) 58%, rgba(16,185,129,0.12) 100%)',
          boxShadow: [
            'inset 0 2px 3px rgba(255,255,255,0.30)',   // menisco (luz de cima)
            'inset 0 -4px 7px rgba(16,185,129,0.25)',   // fundo da gota tinge de esmeralda
            'inset -2px -2px 6px rgba(0,0,0,0.20)',     // massa d'água (sombra interna)
            '0 6px 10px -5px rgba(16,185,129,0.40)',    // cáustica projetada na barra
            focused ? '0 0 14px 1px rgba(16,185,129,0.35)' : '0 0 0 0 rgba(16,185,129,0)', // busca ativa: gota acende
          ].join(', '),
          border: '1px solid rgba(255,255,255,0.16)',
          // A lente: entorta o marejado esmeralda pintado na barra atrás dela.
          backdropFilter: still ? undefined : 'blur(2.5px) saturate(1.7) brightness(1.12)',
          WebkitBackdropFilter: still ? undefined : 'blur(2.5px) saturate(1.7) brightness(1.12)',
          transition: 'box-shadow 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* A lupa mora DENTRO da gota, levemente afundada como se refratada */}
        <Search size={15} strokeWidth={2.5} style={{ color: 'rgba(236,253,245,0.92)', transform: 'translateY(0.5px)' }} />
        {/* Faísca especular — o ponto de luz que faz ler "água" e não "botão" */}
        <span
          className="absolute"
          style={{
            top: 5, left: 8, width: 8, height: 5,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.8)',
            filter: 'blur(1.3px)',
            transform: 'rotate(-24deg)',
          }}
        />
      </motion.div>
    </motion.div>
  );
});

export default SearchDroplet;
