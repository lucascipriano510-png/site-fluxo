import React from 'react';
import { isLowEndDevice } from '../lib/deviceTier';
import { isOwnerDevice } from '../lib/metaPixel';

// ── SUB-BANNER SCRUB (PROTÓTIPO — SÓ O DONO VÊ) ──
// Conceito 2026-07-18: banner no fluxo NORMAL da página (sem pinning, sem
// travar rolagem); só o conteúdo interno é função pura da posição do banner
// na tela: nascendo embaixo = look A (conjunto A|X), centro = troca de roupa,
// saindo por cima = look B (conjunto LV). O reverso é automático — rolou pra
// cima, volta quadro a quadro, porque o quadro exibido É a posição.
// Frames pré-gerados (ffmpeg xfade dos vídeos do provador) em
// public/scrub-teste/f01..f42.jpg; só baixam quando o banner chega a 600px
// da tela. Scroll da página é no #root (mina conhecida) — listener vai nele.
// Nada de setState no scroll: canvas + estilos atualizados direto via refs.
// GATE: isOwnerDevice() — cliente não vê até o dono aprovar o teste.
const TOTAL = 42;
const SRC = (n) => `/scrub-teste/f${String(n).padStart(2, '0')}.jpg`;

const ScrubBanner = () => {
  const wrapRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const lookARef = React.useRef(null);
  const lookBRef = React.useRef(null);
  const barRef = React.useRef(null);
  const imgsRef = React.useRef([]);      // Image por frame (1-based no índice-1)
  const prontosRef = React.useRef(new Set());
  const armadoRef = React.useRef(false); // já começou a baixar frames?
  const ehDono = isOwnerDevice();
  const estatico = isLowEndDevice() || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

  React.useEffect(() => {
    if (!ehDono || estatico) return undefined;
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return undefined;
    const ctx = canvas.getContext('2d');

    const dimensionar = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
    };

    // Desenho cover (quadro 452x640 preenchendo o canvas, ancorado no topo:
    // corta pés antes de cortar cabeça/logo da parede).
    const desenhar = (img) => {
      if (!img || !canvas.width) return;
      const cw = canvas.width; const ch = canvas.height;
      const s = Math.max(cw / img.width, ch / img.height);
      const w = img.width * s; const h = img.height * s;
      ctx.drawImage(img, (cw - w) / 2, 0, w, h);
    };

    const quadroMaisProximo = (alvo) => {
      const prontos = prontosRef.current;
      for (let d = 0; d < TOTAL; d++) {
        if (prontos.has(alvo - d)) return alvo - d;
        if (prontos.has(alvo + d)) return alvo + d;
      }
      return null;
    };

    let ultimoDesenhado = null;
    const aplicar = () => {
      const vh = window.innerHeight;
      const rect = wrap.getBoundingClientRect();
      // Progresso 0→1 enquanto o banner atravessa a viewport (função pura da
      // posição = reversível por construção).
      const p = Math.min(1, Math.max(0, (vh - rect.top) / (vh + rect.height)));
      const alvo = 1 + Math.round(p * (TOTAL - 1));
      const n = quadroMaisProximo(alvo);
      if (n !== null && n !== ultimoDesenhado) {
        ultimoDesenhado = n;
        desenhar(imgsRef.current[n - 1]);
      }
      // Textos trocam junto com a roupa. Janelas SEPARADAS (A sai até 0.45,
      // B entra a partir de 0.55): os dois títulos legíveis ao mesmo tempo
      // viravam papa de texto no meio da travessia.
      const tA = Math.min(1, Math.max(0, (p - 0.30) / 0.15));
      const tB = Math.min(1, Math.max(0, (p - 0.55) / 0.15));
      if (lookARef.current) {
        lookARef.current.style.opacity = String(1 - tA);
        lookARef.current.style.transform = `translateY(${tA * -14}px)`;
      }
      if (lookBRef.current) {
        lookBRef.current.style.opacity = String(tB);
        lookBRef.current.style.transform = `translateY(${(1 - tB) * 14}px)`;
      }
      if (barRef.current) barRef.current.style.width = `${p * 100}%`;
    };

    let agendado = false;
    const aoRolar = () => {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(() => { agendado = false; aplicar(); });
    };

    const carregarFrames = () => {
      if (armadoRef.current) return;
      armadoRef.current = true;
      for (let n = 1; n <= TOTAL; n++) {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => { prontosRef.current.add(n); ultimoDesenhado = null; aoRolar(); };
        img.src = SRC(n);
        imgsRef.current[n - 1] = img;
      }
    };

    dimensionar();
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { carregarFrames(); io.disconnect(); } }, { rootMargin: '600px' });
    io.observe(wrap);
    const scroller = document.getElementById('root') || window;
    const aoRedimensionar = () => { dimensionar(); ultimoDesenhado = null; aoRolar(); };
    scroller.addEventListener('scroll', aoRolar, { passive: true });
    window.addEventListener('resize', aoRedimensionar);
    aplicar();
    return () => {
      io.disconnect();
      scroller.removeEventListener('scroll', aoRolar);
      window.removeEventListener('resize', aoRedimensionar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehDono, estatico]);

  if (!ehDono) return null;

  return (
    <section
      ref={wrapRef}
      className="relative overflow-hidden rounded-3xl border border-white/10 mx-4 my-6"
      style={{ height: 'min(78vw, 360px)', background: '#131316' }}
      aria-label="Troca de look pelo scroll (protótipo)"
    >
      {/* Palco: frames à direita, painel de texto à esquerda */}
      <div className="absolute inset-0 flex">
        <div className="relative flex-1 flex flex-col justify-center gap-2 px-5">
          <span className="self-start text-[8px] font-black uppercase tracking-[0.2em] text-amber-400 border border-amber-400/30 bg-amber-400/10 rounded-md px-2 py-1">
            Teste — só você vê
          </span>
          <div className="relative mt-2" style={{ minHeight: 84 }}>
            <div ref={lookARef} className="absolute inset-x-0 top-0">
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-sky-400">Look 01</p>
              <p className="text-[20px] leading-tight font-black uppercase tracking-tight text-white">Conjunto A|X preto</p>
            </div>
            <div ref={lookBRef} className="absolute inset-x-0 top-0" style={{ opacity: 0 }}>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">Look 02</p>
              <p className="text-[20px] leading-tight font-black uppercase tracking-tight text-white">Conjunto LV grafite</p>
            </div>
          </div>
          <p className="text-[10px] font-bold text-zinc-500 leading-snug">O look troca com a rolagem — pra baixo veste, pra cima desveste.</p>
        </div>
        <div className="relative h-full" style={{ width: '56%' }}>
          {estatico
            ? <img src={SRC(TOTAL)} alt="Conjunto LV grafite" className="w-full h-full object-cover object-top" loading="lazy" />
            : <canvas ref={canvasRef} className="w-full h-full" />}
          <div className="absolute inset-y-0 left-0 w-10 pointer-events-none" style={{ background: 'linear-gradient(to right, #131316, transparent)' }} />
        </div>
      </div>
      {/* Fio de progresso: mostra que o banner obedece o dedo */}
      <div className="absolute bottom-0 left-0 h-[3px] bg-emerald-500/80" ref={barRef} style={{ width: 0 }} />
    </section>
  );
};

export default ScrubBanner;
