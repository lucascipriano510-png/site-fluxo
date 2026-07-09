// =====================================================================
// FLUXO OUTLET — Herói imersivo da home (three.js, branch de teste)
// A cena da fachada (parede de concreto + letreiro) ganha PROFUNDIDADE
// real: um mapa de profundidade sintético fatia a imagem em frações —
// painel de texto na frente, parede/letreiro ao fundo, piso perto — e
// cada fração desliza em velocidade própria conforme o giroscópio
// (celular) ou o cursor (desktop). É a técnica multiplane dos vídeos
// 3D imersivos, num único quad WebGL (1 draw call, leve pra mobile).
//
// Regras de convivência (mesmas do ThreeAtmosphere):
// - Imagem estática carrega PRIMEIRO (LCP intocado); o chunk do three
//   só baixa depois do load + idle e o canvas faz fade por cima.
// - prefers-reduced-motion: só a imagem estática, sem WebGL.
// - Sem giroscópio/cursor a cena deriva sozinha (nunca congela).
// - Fora do viewport ou aba oculta: rAF desligado.
// - Qualquer falha de WebGL/textura: fica a imagem, home segue normal.
// =====================================================================
import React from 'react';
import { optimizeImage, buildSrcSet } from '../lib/images';

const HERO_IMG = 'https://tapgnlrjhrhewqlpahvg.supabase.co/storage/v1/object/public/product-images/uploads/1782159728154-r4cgt90tly8.png';

const reduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Mapa de profundidade da cena (branco = perto, preto = longe), pintado
// em canvas: é ele que define as "frações" e quanto cada uma se move.
function paintDepth() {
  const c = document.createElement('canvas');
  c.width = 160; c.height = 200;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#737373'; // plano médio
  ctx.fillRect(0, 0, 160, 200);

  // Parede + letreiro: o ponto mais FUNDO da cena (recuo radial na luz)
  const wall = ctx.createRadialGradient(108, 78, 8, 108, 78, 105);
  wall.addColorStop(0, 'rgba(28,28,28,0.95)');
  wall.addColorStop(1, 'rgba(28,28,28,0)');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, 160, 200);

  // Painel esquerdo com o texto: fração mais PRÓXIMA (flutua na frente)
  const panel = ctx.createLinearGradient(0, 0, 78, 0);
  panel.addColorStop(0, 'rgba(224,224,224,0.9)');
  panel.addColorStop(1, 'rgba(224,224,224,0)');
  ctx.fillStyle = panel;
  ctx.fillRect(0, 0, 78, 200);

  // Piso: aproxima na base
  const floor = ctx.createLinearGradient(0, 138, 0, 200);
  floor.addColorStop(0, 'rgba(217,217,217,0)');
  floor.addColorStop(1, 'rgba(217,217,217,0.85)');
  ctx.fillStyle = floor;
  ctx.fillRect(0, 138, 160, 62);
  return c;
}

const FRAG = `
  precision mediump float;
  uniform sampler2D uTex;
  uniform sampler2D uDepth;
  uniform vec2 uCover;   // janela de recorte cover-fit
  uniform vec2 uCenter;  // centro do recorte (foco no letreiro no desktop)
  uniform vec2 uShift;   // paralaxe suavizada (-1..1)
  uniform float uZoom;   // dolly lento
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 uv = (vUv - 0.5) * uCover / uZoom + uCenter;
    float d = texture2D(uDepth, uv).r;              // 0 = longe, 1 = perto
    vec2 suv = uv + uShift * (d - 0.35) * 0.034;    // frações em velocidades próprias
    vec3 col = texture2D(uTex, suv).rgb;
    // Facho do letreiro respirando (bem sutil, período ~14s)
    float breathe = 0.5 + 0.5 * sin(uTime * 0.45);
    float spot = smoothstep(0.72, 0.18, distance(suv, vec2(0.66, 0.38)));
    col *= 1.0 + spot * breathe * 0.10;
    // Vinheta que assenta a cena no fundo zinc-950 da home
    float vig = smoothstep(1.12, 0.42, distance(vUv, vec2(0.5)));
    col *= mix(0.7, 1.0, vig);
    // Grão de filme animado
    float g = fract(sin(dot(vUv * 917.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
    col += (g - 0.5) * 0.035;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const VERT = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
`;

export default function ImmersiveHero({ src = HERO_IMG }) {
  const sectionRef = React.useRef(null);
  const mountRef = React.useRef(null);

  // Dim no scroll-out: mesma linguagem do banner antigo (a home escurece
  // o herói conforme ele sai da viewport — continuidade com o catálogo).
  React.useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    let rafId = 0;
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const rect = section.getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, -rect.top / (rect.height || 1)));
        section.style.setProperty('--hero-dim', (progress * 0.55).toFixed(3));
        section.style.setProperty('--hero-parallax', `${(-rect.top > 0 ? -rect.top * 0.35 : 0).toFixed(1)}px`);
      });
    };
    onScroll();
    const scroller = document.getElementById('root') || window;
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => { scroller.removeEventListener('scroll', onScroll); if (rafId) cancelAnimationFrame(rafId); };
  }, []);

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount || reduced()) return;

    let disposed = false;
    let cleanup = null;
    let idleId = 0;

    const build = async () => {
      let THREE;
      try { THREE = await import('three'); } catch { return; }
      if (disposed) return;

      // Textura via proxy wsrv (regra da casa) com CORS anônimo
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = optimizeImage(src, 1080, 88);
      try { await img.decode(); } catch { return; }
      if (disposed) return;

      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power' });
      } catch { return; }
      const fine = window.matchMedia('(pointer: fine)').matches;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, fine ? 2 : 1.75));
      const canvas = renderer.domElement;
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity 0.9s ease;';
      mount.appendChild(canvas);

      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.needsUpdate = true;
      const depthTex = new THREE.CanvasTexture(paintDepth());
      depthTex.minFilter = THREE.LinearFilter;

      const uniforms = {
        uTex: { value: tex },
        uDepth: { value: depthTex },
        uCover: { value: new THREE.Vector2(1, 1) },
        uCenter: { value: new THREE.Vector2(0.5, 0.5) },
        uShift: { value: new THREE.Vector2(0, 0) },
        uZoom: { value: 1.1 },
        uTime: { value: 0 },
      };
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const geo = new THREE.PlaneGeometry(2, 2);
      const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG });
      scene.add(new THREE.Mesh(geo, mat));

      // Cover-fit + foco: no recorte desktop (paisagem) mira o letreiro
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const fit = () => {
        const w = mount.clientWidth || 1;
        const h = mount.clientHeight || 1;
        renderer.setSize(w, h, false);
        const ca = w / h;
        const cover = uniforms.uCover.value;
        if (ca > imgAspect) cover.set(1, imgAspect / ca); else cover.set(ca / imgAspect, 1);
        // centro desejado (letreiro levemente acima do meio), preso pra
        // janela + paralaxe nunca amostrarem fora da textura; o pior caso
        // é o zoom MÍNIMO (janela maior), por isso 1.10 aqui
        const hx = 0.5 * cover.x / 1.1 + 0.024;
        const hy = 0.5 * cover.y / 1.1 + 0.024;
        uniforms.uCenter.value.set(
          Math.min(Math.max(0.5, hx), 1 - hx),
          Math.min(Math.max(0.56, hy), 1 - hy) // v cresce pra CIMA na textura; 0.56 = letreiro inteiro no recorte paisagem
        );
      };
      fit();
      const ro = new ResizeObserver(fit);
      ro.observe(mount);

      // ---- Entrada: giroscópio (celular) / cursor (desktop) + deriva ----
      const target = { x: 0, y: 0 };
      const shift = uniforms.uShift.value;
      let gyroBase = null;
      let lastInput = 0;

      const onPointer = (e) => {
        target.x = (e.clientX / window.innerWidth) * 2 - 1;
        target.y = (e.clientY / window.innerHeight) * 2 - 1;
        lastInput = performance.now();
      };
      const onGyro = (e) => {
        if (e.gamma == null || e.beta == null) return;
        if (!gyroBase) gyroBase = { g: e.gamma, b: e.beta };
        target.x = Math.max(-1, Math.min(1, (e.gamma - gyroBase.g) / 16));
        target.y = Math.max(-1, Math.min(1, (e.beta - gyroBase.b) / 14));
        lastInput = performance.now();
      };
      if (fine) window.addEventListener('pointermove', onPointer, { passive: true });
      // iOS 13+ exige permissão via gesto; sem evento, a deriva assume.
      else if (typeof DeviceOrientationEvent === 'undefined' || typeof DeviceOrientationEvent.requestPermission !== 'function') {
        window.addEventListener('deviceorientation', onGyro, { passive: true });
      }

      // ---- Loop: só roda visível e com aba ativa ----
      let rafId = 0;
      let running = false;
      const t0 = performance.now();
      let shown = false;
      const frame = (now) => {
        if (!running) return;
        const t = (now - t0) / 1000;
        uniforms.uTime.value = t;
        uniforms.uZoom.value = 1.1 + 0.04 * (0.5 + 0.5 * Math.sin(t * 0.11)); // dolly ~57s
        // Deriva lenta assume quando não há input há 3s (cena nunca congela)
        const idle = now - lastInput > 3000;
        const tx = idle ? Math.sin(t * 0.14) * 0.45 : target.x;
        const ty = idle ? Math.cos(t * 0.10) * 0.35 : target.y;
        shift.x += (tx - shift.x) * 0.045;
        shift.y += (ty - shift.y) * 0.045;
        renderer.render(scene, camera);
        if (!shown) { shown = true; canvas.style.opacity = '1'; }
        rafId = requestAnimationFrame(frame);
      };
      const start = () => { if (!running) { running = true; rafId = requestAnimationFrame(frame); } };
      const stop = () => { running = false; if (rafId) cancelAnimationFrame(rafId); rafId = 0; };

      const io = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && !document.hidden) start(); else stop();
      }, { threshold: 0.05 });
      io.observe(mount);
      const onVis = () => { if (document.hidden) stop(); else start(); };
      document.addEventListener('visibilitychange', onVis);

      cleanup = () => {
        stop();
        io.disconnect();
        ro.disconnect();
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('pointermove', onPointer);
        window.removeEventListener('deviceorientation', onGyro);
        tex.dispose(); depthTex.dispose(); geo.dispose(); mat.dispose();
        renderer.dispose();
        canvas.remove();
      };
    };

    // Depois do load + idle, como o ThreeAtmosphere (LCP em paz)
    const kick = () => {
      const ric = window.requestIdleCallback || ((fn) => setTimeout(fn, 350));
      idleId = ric(build);
    };
    if (document.readyState === 'complete') kick();
    else window.addEventListener('load', kick, { once: true });

    return () => {
      disposed = true;
      window.removeEventListener('load', kick);
      const cic = window.cancelIdleCallback || clearTimeout;
      if (idleId) cic(idleId);
      cleanup?.();
    };
  }, [src]);

  return (
    <section
      ref={sectionRef}
      className="relative w-full max-w-[640px] lg:max-w-none mx-auto aspect-[4/5] lg:aspect-auto lg:h-[520px] overflow-hidden select-none"
    >
      <div
        ref={mountRef}
        className="absolute inset-0"
        style={{ willChange: 'transform', transform: 'translate3d(0, var(--hero-parallax, 0px), 0)', transformOrigin: '50% 0%' }}
      >
        {/* Base estática: é o LCP, o fallback sem WebGL e a versão reduced-motion */}
        <img
          src={optimizeImage(src, 900, 88)}
          srcSet={buildSrcSet(src, [640, 900, 1200], 88)}
          sizes="100vw"
          alt="Fachada da Fluxo Outlet — letreiro iluminado na parede de concreto"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: '52% 46%' }}
          fetchPriority="high"
          decoding="async"
        />
      </div>
      {/* Dimmer de saída (mesma linguagem do banner antigo) */}
      <div className="absolute inset-0 bg-zinc-950 pointer-events-none" style={{ opacity: 'var(--hero-dim, 0)', willChange: 'opacity' }} aria-hidden="true" />
    </section>
  );
}
