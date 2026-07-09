// =====================================================================
// FLUXO OUTLET — Maquete 3D da FACHADA REAL construída pelo scroll
// O hero vira uma maquete de arquiteto da loja de verdade (referência:
// foto da fachada): frente preta, letreiro com o logo, vitrine de
// vidro, camisas vermelhas e jeans pendurados na entrada e o varal de
// luzinhas. O scroll É a timeline: rolando pra baixo as peças descem
// e encaixam uma a uma enquanto a câmera desce da vista aérea (maquete
// aberta em cima, como as físicas) até a visão da calçada; rolando pra
// cima, desmonta na ordem inversa.
//
// Mecânica: seção externa alta (260vh) + palco sticky de 100svh; o
// progresso do scroll (0..1) pilota TUDO (peças + câmera), suavizado
// por lerp no rAF pra scrub macio em qualquer roda/dedo.
//
// Regras de convivência (mesmas dos outros efeitos da casa):
// - three só depois do load + idle (import dinâmico, LCP em paz).
// - prefers-reduced-motion: maquete PRONTA e estática, sem pin longo.
// - Falha de WebGL: imagem da fachada no lugar, home segue normal.
// - Fora do viewport ou aba oculta: rAF desligado.
// =====================================================================
import React from 'react';
import { optimizeImage } from '../lib/images';

const FALLBACK_IMG = 'https://tapgnlrjhrhewqlpahvg.supabase.co/storage/v1/object/public/product-images/uploads/1782159728154-r4cgt90tly8.png';

const reduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;

export default function MaqueteHero() {
  const outerRef = React.useRef(null);
  const stageRef = React.useRef(null);
  const [failed, setFailed] = React.useState(false);
  const still = reduced();

  React.useEffect(() => {
    const outer = outerRef.current;
    const stage = stageRef.current;
    if (!outer || !stage) return;

    let disposed = false;
    let cleanup = null;
    let idleId = 0;

    const build = async () => {
      let THREE;
      try { THREE = await import('three'); } catch { setFailed(true); return; }
      if (disposed) return;

      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
      } catch { setFailed(true); return; }
      const fine = window.matchMedia('(pointer: fine)').matches;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, fine ? 2 : 1.75));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      const canvas = renderer.domElement;
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity 0.7s ease;';
      stage.appendChild(canvas);

      // ---- Palco: estúdio claro neutro (a fachada preta é quem manda) ----
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#e9e9e7');
      scene.fog = new THREE.Fog('#e9e9e7', 16, 30);

      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);

      scene.add(new THREE.HemisphereLight('#ffffff', '#b9b9b4', 1.1));
      const sun = new THREE.DirectionalLight('#fff5e8', 1.7);
      sun.position.set(-4, 8, 6.5);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = -7; sun.shadow.camera.right = 7;
      sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -7;
      sun.shadow.bias = -0.0005;
      scene.add(sun);

      // Mesa do estúdio (recebe a sombra da maquete)
      const studio = new THREE.Mesh(
        new THREE.CircleGeometry(20, 48).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: '#e2e2df', roughness: 1 })
      );
      studio.receiveShadow = true;
      studio.position.y = -0.021;
      scene.add(studio);

      const mat = (color, extra = {}) =>
        new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, transparent: true, opacity: 0, ...extra });
      const box = (w, h, d, m) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
        mesh.castShadow = true; mesh.receiveShadow = true;
        return mesh;
      };

      // ---- Peças da maquete (posições finais) + ordem de montagem ----
      // Cada peça desce flutuando até encaixar: {mesh, start, dur, drop, op}
      const pieces = [];
      const add = (mesh, x, y, z, start, dur, opts = {}) => {
        mesh.position.set(x, y, z);
        scene.add(mesh);
        pieces.push({ mesh, y, start, dur, drop: opts.drop ?? 1.6, op: opts.op ?? 1 });
        return mesh;
      };

      const preto = '#161616';
      const pretoFosco = '#1d1d1b';

      // Base (tampo de maquete) + calçada molhada da rua
      add(box(7.6, 0.22, 4.8, mat('#dcdcd8')), 0, 0.11, -0.2, 0.0, 0.09, { drop: 1.2 });
      add(box(6.6, 0.06, 1.6, mat('#33332f', { roughness: 0.45 })), 0, 0.25, 1.0, 0.05, 0.08, { drop: 1.0 });
      // Piso interno da loja
      add(box(6.0, 0.06, 2.2, mat('#242422')), 0, 0.25, -1.0, 0.08, 0.08, { drop: 1.0 });

      // Interior: fundo e laterais escuras (maquete aberta em cima)
      add(box(6.0, 3.0, 0.18, mat(pretoFosco)), 0, 1.72, -2.1, 0.1, 0.09);
      add(box(0.18, 3.0, 2.2, mat(pretoFosco)), -2.95, 1.72, -1.0, 0.13, 0.08);
      add(box(0.18, 3.0, 2.2, mat(pretoFosco)), 2.95, 1.72, -1.0, 0.13, 0.08);

      // Fachada preta: coluna esquerda, moldura da vitrine, coluna direita
      add(box(0.55, 3.4, 0.26, mat(preto)), -2.75, 1.7, 0, 0.16, 0.09);
      add(box(2.9, 0.5, 0.26, mat(preto)), -1.0, 0.25, 0, 0.19, 0.08, { drop: 1.1 });   // soleira vitrine
      add(box(0.7, 3.4, 0.26, mat(preto)), 2.65, 1.7, 0, 0.21, 0.09);
      // Viga superior que segura letreiro e luzinhas (vão livre = entrada)
      add(box(6.1, 0.6, 0.3, mat(preto)), 0, 3.1, 0, 0.24, 0.09);

      // Vidro da vitrine (o único material translúcido)
      add(
        box(2.8, 2.35, 0.05, mat('#aebfc4', { roughness: 0.08, metalness: 0.1 })),
        -1.0, 1.68, 0.02, 0.36, 0.1, { op: 0.14, drop: 1.2 }
      );

      // Letreiro: placa preta inclinada com o LOGO REAL (og-image)
      const logoTex = new THREE.TextureLoader().load('/og-image.jpg');
      logoTex.colorSpace = THREE.SRGBColorSpace;
      const board = box(6.1, 1.5, 0.16, mat('#0b0b0b'));
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(1.45, 1.45),
        new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, opacity: 0 })
      );
      face.position.z = 0.085;
      board.add(face);
      board.rotation.x = -0.06;
      // Letreiro chega CEDO: é ele que dá identidade à montagem
      add(board, 0, 4.2, 0.06, 0.28, 0.1, { drop: 1.3 });

      // Entrada: barra + camisas VERMELHAS (o acento da cena, como na foto)
      const barMat = mat('#3d3d3a', { roughness: 0.5, metalness: 0.4 });
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.7, 12).rotateZ(Math.PI / 2), barMat);
      bar.castShadow = true;
      add(bar, 1.15, 2.55, -0.45, 0.42, 0.08, { drop: 0.9 });
      ['#b3271e', '#c22b20', '#a82419'].forEach((tint, i) => {
        add(box(0.42, 0.56, 0.06, mat(tint, { roughness: 0.8 })), 0.65 + i * 0.5, 2.2, -0.45, 0.46 + i * 0.04, 0.08, { drop: 0.9 });
      });
      // Jeans pendurados abaixo
      ['#3b5a7a', '#33506e', '#42648a'].forEach((tint, i) => {
        add(box(0.36, 0.62, 0.06, mat(tint, { roughness: 0.85 })), 0.68 + i * 0.48, 1.25, -0.45, 0.54 + i * 0.04, 0.08, { drop: 0.9 });
      });

      // Vitrine por dentro: vaso branco com planta (tá na foto!)
      const vaso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.5, 18), mat('#f2f2ef'));
      vaso.castShadow = true;
      add(vaso, -1.85, 0.55, -0.55, 0.62, 0.08, { drop: 0.9 });
      const planta = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), mat('#2f4032', { roughness: 1 }));
      planta.castShadow = true;
      add(planta, -1.85, 1.0, -0.55, 0.66, 0.08, { drop: 0.9 });

      // Varal de luzinhas: cortina de pontos quentes sob a viga (fecho da cena)
      const bulbGeo = new THREE.SphereGeometry(0.045, 6, 6);
      const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0 });
      const N_BULBS = 72;
      const lights = new THREE.InstancedMesh(bulbGeo, bulbMat, N_BULBS);
      const tmp = new THREE.Matrix4();
      for (let i = 0; i < N_BULBS; i++) {
        const col = i % 24;
        const row = Math.floor(i / 24);
        const x = -2.75 + col * 0.24 + (Math.sin(i * 7.3) * 0.05);
        const y = 2.78 - row * 0.22 - Math.abs(Math.sin(i * 3.1)) * 0.18;
        tmp.makeTranslation(x, y, 0.22);
        lights.setMatrixAt(i, tmp);
      }
      add(lights, 0, 0, 0, 0.74, 0.12, { drop: 0.5 });

      // ---- Scrub: progresso do scroll suavizado pilota peças + câmera ----
      let target = 0;
      let p = still ? 1 : 0;
      const onScroll = () => {
        const rect = outer.getBoundingClientRect();
        const range = outer.offsetHeight - stage.offsetHeight;
        target = range > 0 ? clamp01(-rect.top / range) : 1;
      };
      const scroller = document.getElementById('root') || window;
      if (!still) {
        onScroll();
        scroller.addEventListener('scroll', onScroll, { passive: true });
      } else { target = 1; }

      const apply = (t) => {
        for (const pc of pieces) {
          const e = easeOutQuint(clamp01((p - pc.start) / pc.dur));
          pc.mesh.position.y = pc.y + pc.drop * (1 - e);
          pc.mesh.rotation.y = 0.22 * (1 - e);
          pc.mesh.material.opacity = Math.min(pc.op, e * 1.8 * pc.op);
          pc.mesh.castShadow = e > 0.4;
          if (pc.mesh.children[0]) pc.mesh.children[0].material.opacity = Math.min(1, e * 1.8);
        }
        // Luzinhas piscam de leve quando acesas (fecho vivo da maquete)
        const le = clamp01((p - 0.74) / 0.12);
        bulbMat.opacity = le * (0.82 + 0.18 * Math.sin(t * 2.6));
        // Câmera: vista aérea da maquete aberta -> visão da calçada.
        // Ease suave (quadrático): a órbita acompanha o scrub inteiro,
        // sem "chegar" cedo demais enquanto as peças ainda caem.
        const cp = 1 - (1 - clamp01(p)) ** 2;
        const azim = lerp(0.95, -0.08, cp);
        const radius = lerp(cam.start, cam.end, cp);
        const height = lerp(cam.start * 0.6, 1.9, cp);
        camera.position.set(Math.sin(azim) * radius, height, Math.cos(azim) * radius);
        camera.lookAt(0, lerp(0.6, cam.lookY, cp), -0.3);
      };

      // Distância que ENQUADRA a fachada (6.1 de largura) no aspecto atual —
      // em retrato o fov horizontal é estreito e a câmera precisa recuar.
      const cam = { start: 12, end: 7, lookY: 1.7 };
      const fit = () => {
        const w = stage.clientWidth || 1;
        const h = stage.clientHeight || 1;
        renderer.setSize(w, h, false);
        const aspect = w / h;
        camera.aspect = aspect;
        camera.fov = aspect < 0.9 ? 50 : 34;
        const tanV = Math.tan((camera.fov / 2) * (Math.PI / 180));
        const tanH = tanV * aspect;
        cam.end = Math.max(3.6 / tanV, 3.45 / tanH) * 1.05;
        cam.start = cam.end * 1.6;
        cam.lookY = aspect < 0.9 ? 2.15 : 2.3;
        scene.fog.near = cam.start + 3;
        scene.fog.far = cam.start + 18;
        camera.far = cam.start + 22;
        camera.updateProjectionMatrix();
      };
      fit();
      const ro = new ResizeObserver(fit);
      ro.observe(stage);

      let rafId = 0;
      let running = false;
      let shown = false;
      const t0 = performance.now();
      const frame = (now) => {
        if (!running) return;
        p += (target - p) * 0.09; // scrub macio
        apply((now - t0) / 1000);
        renderer.render(scene, camera);
        if (!shown) { shown = true; canvas.style.opacity = '1'; }
        rafId = requestAnimationFrame(frame);
      };
      const start = () => { if (!running) { running = true; rafId = requestAnimationFrame(frame); } };
      const stop = () => { running = false; if (rafId) cancelAnimationFrame(rafId); rafId = 0; };

      const disposeScene = () => {
        ro.disconnect();
        scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
        logoTex.dispose(); renderer.dispose(); canvas.remove();
      };

      if (still) {
        p = 1; target = 1; apply(0); renderer.render(scene, camera);
        canvas.style.opacity = '1';
        cleanup = disposeScene;
        return;
      }

      const io = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && !document.hidden) start(); else stop();
      }, { threshold: 0 });
      io.observe(stage);
      const onVis = () => { if (document.hidden) stop(); else start(); };
      document.addEventListener('visibilitychange', onVis);

      cleanup = () => {
        stop();
        io.disconnect();
        document.removeEventListener('visibilitychange', onVis);
        scroller.removeEventListener('scroll', onScroll);
        disposeScene();
      };
    };

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
  }, [still]);

  // Falha de WebGL: volta a fachada estática no tamanho do banner antigo
  if (failed) {
    return (
      <section className="relative w-full max-w-[640px] lg:max-w-none mx-auto aspect-[4/5] lg:aspect-auto lg:h-[520px] overflow-hidden">
        <img
          src={optimizeImage(FALLBACK_IMG, 900, 88)}
          alt="Fachada da Fluxo Outlet"
          className="absolute inset-0 w-full h-full object-cover"
        />
      </section>
    );
  }

  return (
    // Seção alta = curso do scrub; reduced-motion dispensa o pin longo
    <section ref={outerRef} className={still ? 'relative' : 'relative h-[260vh]'}>
      <div
        ref={stageRef}
        className={`${still ? 'relative' : 'sticky top-0'} w-full overflow-hidden bg-[#e9e9e7]`}
        style={{ height: still ? 'min(78svh, 640px)' : '100svh' }}
      >
        {/* Dica de scroll enquanto a maquete monta */}
        {!still && (
          <div className="absolute bottom-6 inset-x-0 flex justify-center pointer-events-none" aria-hidden="true">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 animate-pulse">
              Role pra construir a loja
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
