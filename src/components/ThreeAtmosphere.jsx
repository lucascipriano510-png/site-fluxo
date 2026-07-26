// =====================================================================
// FLUXO OUTLET — Atmosfera 3D da home (three.js)
// Não é enfeite genérico: é o brilho-ambient da casa ganhando PROFUNDIDADE.
// Poeira fina de vitrine iluminada: gunmetal, flash de titânio e um reflexo
// denim raro, flutuando em 3D
// atrás de todo o conteúdo (z -1 dentro do shell isolado).
//
// Regras de convivência com a home (identidade > efeito):
// - MOTION SÓ NO SCROLL: parado, o frame congela e o rAF é DESLIGADO —
//   zero repaint, zero bateria, zero risco de flicker Android e nenhuma
//   disputa com a nitidez das fotos. Rolou, a poeira deriva com inércia
//   e paralaxe (mais lenta que a página = sensação de fundo distante);
//   parou de rolar, ela assenta e dorme de novo.
// - Carrega DEPOIS do load + idle do navegador (LCP intocado); o chunk
//   do three.js só baixa nesse momento (import dinâmico).
// - prefers-reduced-motion: atmosfera estática (1 frame), sem listener.
// - Qualquer falha de WebGL: efeito não liga, home fica como sempre foi.
// =====================================================================
import React from 'react';

const reduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

import { isLowEndDevice } from '../lib/deviceTier';

export default function ThreeAtmosphere() {
  const mountRef = React.useRef(null);

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    // Aparelho fraco/economia de dados: nem baixa o chunk do three (~190 KB gz).
    if (isLowEndDevice()) return;

    let disposed = false;
    let cleanup = null;
    let idleId = 0;

    const build = async () => {
      let THREE;
      try {
        THREE = await import('three');
      } catch {
        return; // sem chunk, sem efeito — home segue normal
      }
      if (disposed) return;

      const fine = window.matchMedia('(pointer: fine)').matches;
      const N = fine ? 2400 : 1300;
      const BAND = 26;              // altura do campo (unidades de mundo); faz wrap
      const PARALLAX = 0.0035;      // px de scroll -> mundo (bem mais lento que a página)

      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' });
      } catch {
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, fine ? 2 : 1.5));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setClearColor(0x000000, 0);
      const canvas = renderer.domElement;
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
      mount.appendChild(canvas);

      const scene = new THREE.Scene();
      // Fog na cor do fundo da página: partícula longe some NO fundo (profundidade
      // de verdade, não pontinho flutuando na frente).
      scene.fog = new THREE.FogExp2(0x0b0d12, 0.052);

      const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 60);
      camera.position.set(0, 0, 11);

      // Sprite redondo e macio (ponto quadrado cru é cara de iniciante)
      const spriteCanvas = document.createElement('canvas');
      spriteCanvas.width = spriteCanvas.height = 64;
      const sctx = spriteCanvas.getContext('2d');
      const grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.4, 'rgba(255,255,255,0.45)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      sctx.fillStyle = grad;
      sctx.fillRect(0, 0, 64, 64);
      const sprite = new THREE.CanvasTexture(spriteCanvas);

      // Paleta 60/30/10: mineral na base, titânio como flash e denim apenas
      // na região de assinatura. Verde pertence ao WhatsApp.
      const gunmetal = new THREE.Color(0x9399a6);
      const titanium = new THREE.Color(0xe8eaec);
      const denim = new THREE.Color(0x617dc8);

      const spreadX = 16 * Math.max(1, window.innerWidth / window.innerHeight);
      const base = new Float32Array(N * 3);   // posição de nascença
      const pos  = new Float32Array(N * 3);   // posição do frame
      const col  = new Float32Array(N * 3);
      const phase = new Float32Array(N);
      const speed = new Float32Array(N);

      const tmp = new THREE.Color();
      for (let i = 0; i < N; i++) {
        const x = (Math.random() - 0.5) * spreadX;
        const y = (Math.random() - 0.5) * BAND;
        const z = -2 - Math.random() * 14; // tudo ATRÁS do plano da página
        base[i * 3] = x; base[i * 3 + 1] = y; base[i * 3 + 2] = z;

        // Flash de provador no alto esquerdo; denim no canto oposto. O restante
        // fica mineral para não disputar com as fotos dos produtos.
        const nx = x / spreadX + 0.5;   // 0..1
        const ny = y / BAND + 0.5;      // 0..1 (1 = topo)
        const wFlash = Math.exp(-(((nx - 0.14) ** 2) / 0.035 + ((ny - 0.88) ** 2) / 0.07));
        const wDenim = Math.exp(-(((nx - 0.92) ** 2) / 0.035 + ((ny - 0.90) ** 2) / 0.07));
        tmp.copy(gunmetal).lerp(titanium, Math.min(0.72, wFlash)).lerp(denim, Math.min(0.82, wDenim));
        // variação de brilho individual (poeira não é uniforme)
        const dim = 0.35 + Math.random() * 0.65;
        col[i * 3] = tmp.r * dim; col[i * 3 + 1] = tmp.g * dim; col[i * 3 + 2] = tmp.b * dim;

        phase[i] = Math.random() * Math.PI * 2;
        speed[i] = 0.4 + Math.random() * 0.9;
      }
      pos.set(base);

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

      const mat = new THREE.PointsMaterial({
        size: 0.14,
        map: sprite,
        vertexColors: true,
        transparent: true,
        opacity: 0.5,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      scene.add(new THREE.Points(geo, mat));

      // ---- Motor de motion: só acorda com scroll, dorme quando assenta ----
      // Quem rola nesta home é o #root (html/body têm overflow hidden):
      // window.scrollY fica em 0 pra sempre — listener e leitura vão nele.
      const scroller = document.getElementById('root');
      const getScroll = () => (scroller ? scroller.scrollTop : window.scrollY);
      const scrollTarget = scroller ?? window;

      let raf = 0;
      let running = false;
      let smooth = getScroll();
      let energy = 0;
      let lastT = 0;

      const wrap = (v) => {
        let r = (v + BAND / 2) % BAND;
        if (r < 0) r += BAND;
        return r - BAND / 2;
      };

      const frame = (t) => {
        // dt real: suavização INDEPENDENTE de fps (senão em máquina lenta
        // a poeira demoraria segundos a mais pra assentar e dormir)
        const dt = lastT ? Math.min(80, t - lastT) : 16;
        lastT = t;
        const k = Math.min(1, dt / 130);

        const target = getScroll();
        smooth += (target - smooth) * Math.min(1, dt / 110);
        const v = target - smooth;
        // energia sobe com a velocidade do scroll e decai sozinha ao parar
        // (assenta e DORME ~1,5s depois do último movimento, em qualquer fps)
        energy += (Math.min(1, Math.abs(v) / 60) - energy) * k;

        const drift = smooth * PARALLAX;
        const tt = t * 0.001;
        for (let i = 0; i < N; i++) {
          const j = i * 3;
          pos[j]     = base[j] + Math.cos(tt * speed[i] + phase[i]) * 0.28 * energy;
          pos[j + 1] = wrap(base[j + 1] + drift + Math.sin(tt * speed[i] + phase[i]) * 0.38 * energy);
          pos[j + 2] = base[j + 2];
        }
        geo.attributes.position.needsUpdate = true;
        renderer.render(scene, camera);

        if (energy > 0.004 || Math.abs(v) > 0.5) {
          raf = requestAnimationFrame(frame);
        } else {
          running = false; // assentou: DORME (zero repaint até o próximo scroll)
        }
      };

      const wake = () => {
        if (running || disposed || document.hidden) return;
        running = true;
        raf = requestAnimationFrame(frame);
      };

      const onVisibility = () => {
        if (document.hidden) { cancelAnimationFrame(raf); running = false; }
      };

      const onResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        if (!running) renderer.render(scene, camera);
      };

      // primeiro frame estático (atmosfera presente mesmo sem mexer)
      renderer.render(scene, camera);

      if (!reduced()) {
        scrollTarget.addEventListener('scroll', wake, { passive: true });
        document.addEventListener('visibilitychange', onVisibility);
      }
      window.addEventListener('resize', onResize);

      cleanup = () => {
        scrollTarget.removeEventListener('scroll', wake);
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('resize', onResize);
        cancelAnimationFrame(raf);
        geo.dispose();
        mat.dispose();
        sprite.dispose();
        renderer.dispose();
        renderer.forceContextLoss?.();
        canvas.remove();
      };
    };

    // Espera load + ociosidade: o chunk do three não disputa com LCP/imagens
    const whenIdle = () => {
      idleId = 'requestIdleCallback' in window
        ? requestIdleCallback(() => build(), { timeout: 4000 })
        : setTimeout(() => build(), 1500);
    };
    if (document.readyState === 'complete') whenIdle();
    else window.addEventListener('load', whenIdle, { once: true });

    return () => {
      disposed = true;
      window.removeEventListener('load', whenIdle);
      if ('cancelIdleCallback' in window) cancelIdleCallback(idleId);
      else clearTimeout(idleId);
      cleanup?.();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none' }}
    />
  );
}
