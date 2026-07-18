import React from 'react';
import { isLowEndDevice } from '../lib/deviceTier';
import { isOwnerDevice } from '../lib/metaPixel';

// ── SUB-BANNER SCRUB (PROTÓTIPO — SÓ O DONO VÊ) ──
// Banner no fluxo NORMAL da página (sem pinning); o conteúdo é função pura
// da posição do banner na viewport — reverso automático quadro a quadro.
// v2 pós-feedback do dono (2026-07-18: "pequeno, lento, muda pouco, só 2"):
//  • formato grande: imagem ocupa o banner INTEIRO, texto sobreposto embaixo;
//  • 3 looks: A|X preto → LV grafite → Burberry bege (foto do provador);
//  • a troca acontece na JANELA ATIVA (banner de fato visível): o progresso
//    bruto 0..1 da travessia é remapeado pra 0.12..0.88 — nada de gastar
//    animação enquanto o banner mal aparece na borda;
//  • carregamento por BISSEÇÃO (1º, último, meio, quartos…): com ~5 quadros
//    o scrub já responde inteiro (grosso) e refina conforme baixa.
// Frames: public/scrub-teste/f01..f33.jpg (ffmpeg xfade em cadeia).
// Scroll da página é no #root (mina conhecida). Nada de setState no scroll.
// GATE: isOwnerDevice() — cliente não vê até o dono aprovar.
const TOTAL = 33;
const SRC = (n) => `/scrub-teste/f${String(n).padStart(2, '0')}.jpg`;

// Looks e as janelas (no progresso remapeado) em que cada título aparece.
const LOOKS = [
  { rotulo: 'Look 01', nome: 'Conjunto A|X preto', ate: 0.30 },
  { rotulo: 'Look 02', nome: 'Conjunto LV grafite', de: 0.38, ate: 0.62 },
  { rotulo: 'Look 03', nome: 'Conjunto Burberry bege', de: 0.72 },
];

// Ordem de download por bisseção: pontas primeiro, depois os meios.
function ordemBissecao(total) {
  const ordem = [1, total];
  const fila = [[1, total]];
  while (fila.length) {
    const [a, b] = fila.shift();
    const m = Math.floor((a + b) / 2);
    if (m === a || m === b) continue;
    ordem.push(m);
    fila.push([a, m], [m, b]);
  }
  return ordem;
}

const ScrubBanner = () => {
  const wrapRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const textoRefs = React.useRef([]);
  const barRef = React.useRef(null);
  const imgsRef = React.useRef([]);
  const prontosRef = React.useRef(new Set());
  const armadoRef = React.useRef(false);
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

    // Cover ancorado no topo: corta pés antes de cortar cabeça/logo.
    const desenhar = (img) => {
      if (!img || !canvas.width) return;
      const cw = canvas.width; const ch = canvas.height;
      const s = Math.max(cw / img.width, ch / img.height);
      ctx.drawImage(img, (cw - img.width * s) / 2, 0, img.width * s, img.height * s);
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
      const bruto = (vh - rect.top) / (vh + rect.height);
      // Janela ativa: a apresentação inteira acontece enquanto o banner está
      // visível de verdade, não raspando as bordas da tela.
      const p = Math.min(1, Math.max(0, (bruto - 0.12) / 0.76));
      const alvo = 1 + Math.round(p * (TOTAL - 1));
      const n = quadroMaisProximo(alvo);
      if (n !== null && n !== ultimoDesenhado) {
        ultimoDesenhado = n;
        desenhar(imgsRef.current[n - 1]);
      }
      LOOKS.forEach((lk, i) => {
        const el = textoRefs.current[i];
        if (!el) return;
        const entra = lk.de == null ? 1 : Math.min(1, Math.max(0, (p - lk.de) / 0.08));
        const sai = lk.ate == null ? 0 : Math.min(1, Math.max(0, (p - lk.ate) / 0.08));
        const o = Math.max(0, entra - sai);
        el.style.opacity = String(o);
        el.style.transform = `translateY(${(1 - entra) * 16 - sai * 16}px)`;
      });
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
      for (const n of ordemBissecao(TOTAL)) {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => { prontosRef.current.add(n); ultimoDesenhado = null; aoRolar(); };
        img.src = SRC(n);
        imgsRef.current[n - 1] = img;
      }
    };

    dimensionar();
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { carregarFrames(); io.disconnect(); } }, { rootMargin: '900px' });
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
      style={{ height: 'min(122vw, 560px)', background: '#131316' }}
      aria-label="Troca de look pelo scroll (protótipo)"
    >
      {estatico
        ? <img src={SRC(TOTAL)} alt="Conjunto Burberry bege" className="absolute inset-0 w-full h-full object-cover object-top" loading="lazy" />
        : <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />}
      <span className="absolute top-3 left-3 text-[8px] font-black uppercase tracking-[0.2em] text-amber-300 border border-amber-400/40 bg-zinc-950/70 backdrop-blur-sm rounded-md px-2 py-1">
        Teste — só você vê
      </span>
      {/* Legenda sobreposta: gradiente embaixo, um título por vez */}
      <div className="absolute inset-x-0 bottom-0 pt-16 pb-4 px-5 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(9,9,11,0.92), rgba(9,9,11,0.55) 55%, transparent)' }}>
        <div className="relative" style={{ minHeight: 52 }}>
          {LOOKS.map((lk, i) => (
            <div key={lk.rotulo} ref={(el) => { textoRefs.current[i] = el; }} className="absolute inset-x-0 bottom-0" style={{ opacity: i === 0 ? 1 : 0 }}>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-400">{lk.rotulo} · de 03</p>
              <p className="text-[24px] leading-tight font-black uppercase tracking-tight text-white">{lk.nome}</p>
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-[10px] font-bold text-zinc-400">O look troca com a rolagem — pra cima desfaz.</p>
      </div>
      {/* Fio de progresso: o banner obedece o dedo */}
      <div className="absolute bottom-0 left-0 h-[3px] bg-emerald-500/80" ref={barRef} style={{ width: 0 }} />
    </section>
  );
};

export default ScrubBanner;
