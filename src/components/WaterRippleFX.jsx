// =====================================================================
// FLUXO OUTLET — Água real no card (WebGL)
// Simulação física da equação da onda rodando na GPU: o mouse "toca" a
// superfície e as ondas se propagam, refletem nas bordas e interferem
// entre si — refração desloca a imagem do produto e um brilho especular
// dá o volume 3D. Não é animação pré-pronta: cada frame resolve física.
//
// Por que não mata a nitidez (regra de ouro deste site): o canvas SÓ
// existe durante o hover. Em repouso ele é desmontado e a <img> volta a
// ser pintada sem camada GPU. Desktop apenas (pointer: fine) e respeita
// prefers-reduced-motion. Qualquer falha (WebGL/CORS) = efeito desliga
// sozinho e o card fica como sempre foi.
// =====================================================================
import React from 'react';
import { optimizeImage } from '../lib/images';

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// Passo de física: altura (r) e velocidade (g) por texel, ping-pong.
// v += (média dos vizinhos - h) * rigidez; amortece; h += v.
const SIM_FRAG = `
precision highp float;
uniform sampler2D u_prev;
uniform vec2 u_texel;
uniform vec2 u_drop;        // uv da gota; x < 0 = sem gota neste frame
uniform float u_dropRadius;
uniform float u_dropStrength;
varying v_uv_decl vec2 v_uv;
void main() {
  vec4 c = texture2D(u_prev, v_uv);
  float h = c.r;
  float v = c.g;
  float sum =
    texture2D(u_prev, v_uv + vec2(u_texel.x, 0.0)).r +
    texture2D(u_prev, v_uv - vec2(u_texel.x, 0.0)).r +
    texture2D(u_prev, v_uv + vec2(0.0, u_texel.y)).r +
    texture2D(u_prev, v_uv - vec2(0.0, u_texel.y)).r;
  v += (sum * 0.25 - h) * 1.9;
  v *= 0.99;
  h += v;
  h *= 0.9985;
  if (u_drop.x >= 0.0) {
    vec2 d = (v_uv - u_drop) / u_dropRadius;
    h += u_dropStrength * exp(-dot(d, d));
  }
  gl_FragColor = vec4(h, v, 0.0, 1.0);
}`;

// Render: gradiente da altura -> refração (desloca uv da foto) + normal
// -> brilho especular (a "luz batendo na água").
const DRAW_FRAG = `
precision highp float;
uniform sampler2D u_water;
uniform sampler2D u_image;
uniform vec2 u_texel;
uniform vec2 u_imgScale;
uniform vec2 u_imgOffset;
varying v_uv_decl vec2 v_uv;
void main() {
  float hl = texture2D(u_water, v_uv - vec2(u_texel.x, 0.0)).r;
  float hr = texture2D(u_water, v_uv + vec2(u_texel.x, 0.0)).r;
  float hb = texture2D(u_water, v_uv - vec2(0.0, u_texel.y)).r;
  float ht = texture2D(u_water, v_uv + vec2(0.0, u_texel.y)).r;
  vec2 grad = vec2(hr - hl, ht - hb);

  vec2 uv = v_uv * u_imgScale + u_imgOffset;
  uv += grad * 0.55;                       // refração
  uv = clamp(uv, u_imgOffset, u_imgScale + u_imgOffset);
  vec3 color = texture2D(u_image, vec2(uv.x, 1.0 - uv.y)).rgb;

  vec3 n = normalize(vec3(-grad.x * 14.0, -grad.y * 14.0, 1.0));
  vec3 light = normalize(vec3(-0.35, 0.55, 0.85));
  float spec = pow(max(dot(reflect(-light, n), vec3(0.0, 0.0, 1.0)), 0.0), 70.0);
  float diff = max(dot(n, light), 0.0) * 0.10;
  gl_FragColor = vec4(color + spec * 0.55 + diff - 0.05, 1.0);
}`;

const SIM_W = 144;
const SIM_H = 180; // 4:5, mesmo aspecto do card

const canRun = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(pointer: fine)').matches &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// cache de <img> decodificadas por URL (hover repetido não rebaixa nada)
const imgCache = new Map();
const loadImage = (url) => {
  if (imgCache.has(url)) return imgCache.get(url);
  const p = new Promise((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = url;
  });
  imgCache.set(url, p);
  return p;
};

const compile = (gl, type, srcCode) => {
  const s = gl.createShader(type);
  // GLSL1: varying declarado igual nos dois estágios — macro só pra manter
  // o fonte único acima legível
  gl.shaderSource(s, srcCode.replace(/varying v_uv_decl/g, 'varying'));
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s) || 'shader');
  }
  return s;
};

const link = (gl, fragSrc) => {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) || 'link');
  }
  return p;
};

// Textura float renderizável (sim precisa de precisão); tenta float,
// cai pra half-float; sem nenhum dos dois o efeito não liga.
const makeSimTexture = (gl, floatType) => {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SIM_W, SIM_H, 0, gl.RGBA, floatType, null);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  return { texture: t, fb, ok };
};

export default function WaterRippleFX({ src }) {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    if (!canRun() || !src) return;
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!host) return;

    let state = null;     // recursos GL enquanto o mouse está no card
    let raf = 0;
    let killed = false;
    let leaveTimer = 0;

    const teardown = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      clearTimeout(leaveTimer);
      if (state) {
        state.gl.getExtension('WEBGL_lose_context')?.loseContext();
        state = null;
      }
      canvas.style.opacity = '0';
      canvas.width = canvas.height = 1; // libera o backbuffer
    };

    const boot = async () => {
      let image;
      try {
        image = await loadImage(optimizeImage(src, 800, 85));
      } catch {
        killed = true; // sem textura (CORS/404) => efeito nunca liga
        return;
      }
      if (killed || state) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(2, Math.round(host.clientWidth * dpr));
      canvas.height = Math.max(2, Math.round(host.clientHeight * dpr));

      const gl = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: false });
      if (!gl) { killed = true; return; }

      let floatType = null;
      if (gl.getExtension('OES_texture_float')) floatType = gl.FLOAT;
      let a = floatType && makeSimTexture(gl, floatType);
      if (!a || !a.ok) {
        const half = gl.getExtension('OES_texture_half_float');
        if (half) {
          floatType = half.HALF_FLOAT_OES;
          a = makeSimTexture(gl, floatType);
        }
      }
      if (!a || !a.ok) { killed = true; teardown(); return; }
      const b = makeSimTexture(gl, floatType);
      if (!b.ok) { killed = true; teardown(); return; }

      let simProg, drawProg;
      try {
        simProg = link(gl, SIM_FRAG);
        drawProg = link(gl, DRAW_FRAG);
      } catch {
        killed = true; teardown(); return;
      }

      const quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

      const imgTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, imgTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);

      // object-fit: cover feito no shader (u_imgScale/u_imgOffset)
      const canvasAspect = canvas.width / canvas.height;
      const imgAspect = image.naturalWidth / image.naturalHeight;
      let sx = 1, sy = 1;
      if (imgAspect > canvasAspect) sx = canvasAspect / imgAspect;
      else sy = imgAspect / canvasAspect;
      const imgScale = [sx, sy];
      const imgOffset = [(1 - sx) / 2, (1 - sy) / 2];

      state = {
        gl, simProg, drawProg, quad, imgTex, imgScale, imgOffset,
        texA: a, texB: b,
        drop: null,             // {x, y, radius, strength} em uv
        idleFrames: 0,
      };

      const bindQuad = (prog) => {
        const loc = gl.getAttribLocation(prog, 'a_pos');
        gl.bindBuffer(gl.ARRAY_BUFFER, quad);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      };

      const frame = () => {
        if (!state) return;
        const { gl: g } = state;

        // 1) física (2 subpassos por frame = ondas mais vivas)
        g.useProgram(simProg);
        bindQuad(simProg);
        g.viewport(0, 0, SIM_W, SIM_H);
        g.uniform2f(g.getUniformLocation(simProg, 'u_texel'), 1 / SIM_W, 1 / SIM_H);
        for (let i = 0; i < 2; i++) {
          const d = (i === 0 && state.drop) ? state.drop : null;
          g.uniform2f(g.getUniformLocation(simProg, 'u_drop'), d ? d.x : -1, d ? d.y : -1);
          g.uniform1f(g.getUniformLocation(simProg, 'u_dropRadius'), d ? d.radius : 0.05);
          g.uniform1f(g.getUniformLocation(simProg, 'u_dropStrength'), d ? d.strength : 0);
          g.bindFramebuffer(g.FRAMEBUFFER, state.texB.fb);
          g.activeTexture(g.TEXTURE0);
          g.bindTexture(g.TEXTURE_2D, state.texA.texture);
          g.uniform1i(g.getUniformLocation(simProg, 'u_prev'), 0);
          g.drawArrays(g.TRIANGLES, 0, 3);
          const tmp = state.texA; state.texA = state.texB; state.texB = tmp;
        }
        state.drop = null;

        // 2) render da água sobre a foto
        g.bindFramebuffer(g.FRAMEBUFFER, null);
        g.viewport(0, 0, canvas.width, canvas.height);
        g.useProgram(drawProg);
        bindQuad(drawProg);
        g.uniform2f(g.getUniformLocation(drawProg, 'u_texel'), 1 / SIM_W, 1 / SIM_H);
        g.uniform2fv(g.getUniformLocation(drawProg, 'u_imgScale'), state.imgScale);
        g.uniform2fv(g.getUniformLocation(drawProg, 'u_imgOffset'), state.imgOffset);
        g.activeTexture(g.TEXTURE0);
        g.bindTexture(g.TEXTURE_2D, state.texA.texture);
        g.uniform1i(g.getUniformLocation(drawProg, 'u_water'), 0);
        g.activeTexture(g.TEXTURE1);
        g.bindTexture(g.TEXTURE_2D, state.imgTex);
        g.uniform1i(g.getUniformLocation(drawProg, 'u_image'), 1);
        g.drawArrays(g.TRIANGLES, 0, 3);

        raf = requestAnimationFrame(frame);
      };

      canvas.style.opacity = '1';
      raf = requestAnimationFrame(frame);
    };

    let last = { x: -1, y: -1 };
    const dropAt = (clientX, clientY, radius, strength) => {
      if (!state) return;
      const r = host.getBoundingClientRect();
      state.drop = {
        x: (clientX - r.left) / r.width,
        y: 1 - (clientY - r.top) / r.height, // GL: y pra cima
        radius,
        strength,
      };
    };

    const onEnter = () => {
      if (killed) return;
      clearTimeout(leaveTimer);
      if (!state) boot();
      else canvas.style.opacity = '1';
    };

    const onMove = (e) => {
      if (!state) return;
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      if (dx * dx + dy * dy < 9) return; // só quando anda de verdade
      last = { x: e.clientX, y: e.clientY };
      // gota do rastro: forte o bastante pra esteira aparecer em foto clara
      // (0.014 era fisicamente correto e visualmente inútil)
      dropAt(e.clientX, e.clientY, 0.032, 0.05);
    };

    const onDown = (e) => dropAt(e.clientX, e.clientY, 0.07, 0.22); // tchibum

    const onLeave = () => {
      // deixa as ondas morrerem em cena, some suave e SOLTA o contexto GPU
      // (senão cada card hoverado guardaria um WebGL vivo — Chrome mata no 16º)
      leaveTimer = setTimeout(() => {
        canvas.style.opacity = '0';
        leaveTimer = setTimeout(() => { if (state) { teardown(); } }, 450);
      }, 900);
    };

    host.addEventListener('mouseenter', onEnter);
    host.addEventListener('mousemove', onMove);
    host.addEventListener('mouseleave', onLeave);
    host.addEventListener('pointerdown', onDown);

    return () => {
      killed = true;
      host.removeEventListener('mouseenter', onEnter);
      host.removeEventListener('mousemove', onMove);
      host.removeEventListener('mouseleave', onLeave);
      host.removeEventListener('pointerdown', onDown);
      teardown();
    };
  }, [src]);

  if (!canRun()) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 5,             // acima das fotos, abaixo de selos (10/20) e X (30)
        pointerEvents: 'none',
        opacity: 0,
        transition: 'opacity 0.35s ease',
      }}
    />
  );
}
