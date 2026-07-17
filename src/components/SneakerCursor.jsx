import React from 'react';

// Tênis pendurado pelo cadarço na ponta do cursor — imagem clássica do
// streetwear (tênis no fio de luz), na linha "física própria" do site.
// DESKTOP ONLY: só monta com (hover:hover)+(pointer:fine); celular nem liga.
// O cursor do sistema NÃO é escondido — isto é um acompanhante, não substituto
// (esconder cursor em loja = fricção na compra). pointer-events-none sempre.
// Mesma receita do TouchGlow: UM elemento fixo movido só por transform no
// compositor, zero re-render React, nada tocando os cards (cicatriz GPU).
// Traço BRANCO neutro — glow colorido foi recusado pelo dono (2026-07-11).
const SneakerCursor = () => {
  const wrapRef = React.useRef(null);
  const swingRef = React.useRef(null);

  React.useEffect(() => {
    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return undefined;
    const wrap = wrapRef.current;
    const swing = swingRef.current;
    if (!wrap || !swing) return undefined;

    let raf = 0;
    let running = false;
    let px = -300, py = -300;        // posição suavizada do conjunto
    let tx = -300, ty = -300;        // alvo (cursor real)
    let theta = 0, omega = 0;        // pêndulo: ângulo e velocidade angular
    let squash = 1, squashV = 0;     // mola vertical do clique
    let lastMove = 0;
    let visible = false;

    const setVisible = (v) => {
      if (visible === v) return;
      visible = v;
      wrap.style.opacity = v ? '1' : '0';
    };

    const step = () => {
      const prevX = px;
      // segue o cursor com um leve atraso (dá vida sem "colar" no ponteiro)
      px += (tx - px) * 0.3;
      py += (ty - py) * 0.3;
      const vx = px - prevX;

      // pêndulo: mola pro centro + amortecimento + arrasto do movimento
      omega += -0.16 * theta - 0.12 * omega - vx * 0.038;
      theta += omega;
      if (theta > 0.85) { theta = 0.85; omega = 0; }
      if (theta < -0.85) { theta = -0.85; omega = 0; }

      // mola do clique (squash volta sozinho pra 1)
      squashV += (1 - squash) * 0.25 - squashV * 0.35;
      squash += squashV;

      wrap.style.transform = `translate3d(${px}px, ${py}px, 0)`;
      swing.style.transform = `rotate(${(theta * 57.3).toFixed(2)}deg) scale(1, ${squash.toFixed(3)})`;

      // parado há 4s e pêndulo assentado → some e desliga o loop (CPU zero)
      const idle = performance.now() - lastMove > 4000;
      const settled = Math.abs(omega) < 0.001 && Math.abs(theta) < 0.01 && Math.abs(1 - squash) < 0.01;
      if (idle && settled) {
        setVisible(false);
        running = false;
        return;
      }
      raf = requestAnimationFrame(step);
    };

    const wake = () => {
      lastMove = performance.now();
      setVisible(true);
      if (!running) { running = true; raf = requestAnimationFrame(step); }
    };

    const move = (e) => {
      tx = e.clientX;
      ty = e.clientY;
      wake();
    };
    const down = () => {
      squashV -= 0.18;               // quicada
      omega += (Math.random() - 0.5) * 0.06;
      wake();
    };
    // brilho branco discreto sobre elemento interativo
    const INTERACTIVE = 'a, button, input, select, textarea, label, [role="button"]';
    const over = (e) => { swing.style.filter = e.target?.closest?.(INTERACTIVE) ? 'drop-shadow(0 0 6px rgba(255,255,255,0.55))' : 'none'; };
    const leaveDoc = () => setVisible(false);

    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', down, { passive: true });
    document.addEventListener('mouseover', over, { passive: true });
    document.documentElement.addEventListener('mouseleave', leaveDoc);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', down);
      document.removeEventListener('mouseover', over);
      document.documentElement.removeEventListener('mouseleave', leaveDoc);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      // z-350: acima dos modais (o acompanhante pertence ao cursor, que opera
      // em qualquer camada) — ver escala de z-index documentada no App.jsx.
      className="fixed top-0 left-0 pointer-events-none z-[350]"
      style={{ opacity: 0, transition: 'opacity 0.6s ease', transform: 'translate3d(-300px, -300px, 0)' }}
    >
      {/* pivô do pêndulo = ponta do cursor; o conjunto balança em volta dele */}
      <div ref={swingRef} style={{ transformOrigin: '2px 2px', willChange: 'transform' }}>
        <svg width="58" height="84" viewBox="0 0 58 84" fill="none" style={{ display: 'block' }}>
          {/* cadarço: cai do ponteiro com uma curva leve */}
          <path d="M2 2 C 6 14, 20 20, 24 34" stroke="rgba(255,255,255,0.85)" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M2 2 C 10 12, 26 22, 30 35" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" strokeLinecap="round" />
          {/* tênis (silhueta lateral, bico pra direita, pendurado pelo colarinho) */}
          <g transform="translate(4 30) rotate(9 26 22)">
            <path
              d="M14 8 Q 13 4 17 3 L 26 2 Q 29 2 30 5 L 33 13 Q 40 16 47 20 Q 52 22 52 27 L 52 30 Q 52 34 47 34 L 10 34 Q 5 34 5 29 L 5 24 Q 5 18 9 14 Z"
              fill="rgba(10,10,11,0.9)"
              stroke="rgba(255,255,255,0.9)"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            {/* sola */}
            <path d="M5 28 L 52 28" stroke="rgba(255,255,255,0.65)" strokeWidth="1.2" />
            {/* passadores do cadarço */}
            <path d="M20 8 L 27 11 M19 13 L 28 16" stroke="rgba(255,255,255,0.6)" strokeWidth="1.1" strokeLinecap="round" />
            {/* respiro do calcanhar */}
            <path d="M11 12 Q 8 16 8 22" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeLinecap="round" />
          </g>
        </svg>
      </div>
    </div>
  );
};

export default SneakerCursor;
