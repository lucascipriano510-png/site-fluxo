// =====================================================================
// FLUXO OUTLET — Água na base do card (WebGL)
// Simulação física da equação da onda na GPU: o mouse "toca" a superfície
// escura sob o nome/preço e as ondas se propagam, refletem nas bordas e
// interferem. O render é só LUZ (brilho especular + sombra rasa em canvas
// transparente): o fundo e o texto do card continuam DOM normal por cima,
// legíveis — a água corre por baixo das palavras.
//
// Regra de ouro do site preservada: o canvas SÓ existe durante o hover
// (desktop / pointer fine). Ao sair, as ondas morrem em cena, o canvas
// esvanece e o contexto GPU é SOLTO (Chrome mata o 16º contexto vivo).
// prefers-reduced-motion ou WebGL indisponível = efeito nem liga.
// =====================================================================
import React from 'react';

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
varying vec2 v_uv;
void main() {
  vec4 c = texture2D(u_prev, v_uv);
  float h = c.r;
  float v = c.g;
  float sum =
    texture2D(u_prev, v_uv + vec2(u_texel.x, 0.0)).r +
    texture2D(u_prev, v_uv - vec2(u_texel.x, 0.0)).r +
    texture2D(u_prev, v_uv + vec2(0.0, u_texel.y)).r +
    texture2D(u_prev, v_uv - vec2(0.0, u_texel.y)).r;
  v += (sum * 0.25 - h) * 1.5;
  v *= 0.988;
  h += v;
  h *= 0.9985;
  if (u_drop.x >= 0.0) {
    vec2 d = (v_uv - u_drop) / u_dropRadius;
    h += u_dropStrength * exp(-dot(d, d));
  }
  gl_FragColor = vec4(h, v, 0.0, 1.0);
}`;

// Render: normal da superfície -> brilho especular nas cristas + sombra
// rasa nos vales, em alpha premultiplicado (canvas transparente).
const DRAW_FRAG = `
precision highp float;
uniform sampler2D u_water;
uniform vec2 u_texel;
varying vec2 v_uv;
void main() {
  float hl = texture2D(u_water, v_uv - vec2(u_texel.x, 0.0)).r;
  float hr = texture2D(u_water, v_uv + vec2(u_texel.x, 0.0)).r;
  float hb = texture2D(u_water, v_uv - vec2(0.0, u_texel.y)).r;
  float ht = texture2D(u_water, v_uv + vec2(0.0, u_texel.y)).r;
  vec2 grad = vec2(hr - hl, ht - hb);

  vec3 n = normalize(vec3(-grad.x * 10.0, -grad.y * 10.0, 1.0));
  vec3 light = normalize(vec3(-0.35, 0.6, 0.8));
  float spec = pow(max(dot(reflect(-light, n), vec3(0.0, 0.0, 1.0)), 0.0), 55.0);
  float tilt = dot(n, light) - dot(vec3(0.0, 0.0, 1.0), light);

  float glow = spec * 0.40 + max(tilt, 0.0) * 0.16;   // crista pega luz
  float shade = max(-tilt, 0.0) * 0.24;               // vale escurece
  float a = clamp(glow + shade, 0.0, 1.0);
  gl_FragColor = vec4(vec3(glow), a);                 // premultiplicado
}`;

// Mobile incluído (pedido do dono): Pointer Events cobrem mouse E dedo.
// O canvas é pointer-events:none, então o toque nunca rouba o scroll —
// o dedo passando só deixa ondas. Só reduced-motion desliga o efeito.
const canRun = () =>
  typeof window !== 'undefined' &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const compile = (gl, type, srcCode) => {
  const s = gl.createShader(type);
  gl.shaderSource(s, srcCode);
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

// Textura float renderizável (a sim precisa de precisão); tenta float,
// cai pra half-float; sem nenhum dos dois o efeito não liga.
const makeSimTexture = (gl, floatType, w, h) => {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, floatType, null);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  return { texture: t, fb, ok };
};

export default function WaterRippleFX() {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    if (!canRun()) return;
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!host) return;

    let state = null;     // recursos GL enquanto o mouse está na área
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

    const boot = () => {
      if (killed || state) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(2, Math.round(host.clientWidth * dpr));
      canvas.height = Math.max(2, Math.round(host.clientHeight * dpr));

      const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
      if (!gl) { console.warn('[agua] sem WebGL — efeito desligado'); killed = true; return; }

      // grade da sim acompanha o formato da área (ondas isotrópicas)
      const simW = 160;
      const simH = Math.max(24, Math.round((simW * host.clientHeight) / host.clientWidth));

      let floatType = null;
      if (gl.getExtension('OES_texture_float')) floatType = gl.FLOAT;
      let a = floatType && makeSimTexture(gl, floatType, simW, simH);
      if (!a || !a.ok) {
        const half = gl.getExtension('OES_texture_half_float');
        if (half) {
          floatType = half.HALF_FLOAT_OES;
          a = makeSimTexture(gl, floatType, simW, simH);
        }
      }
      if (!a || !a.ok) { console.warn('[agua] textura float não renderizável — efeito desligado'); killed = true; teardown(); return; }
      const b = makeSimTexture(gl, floatType, simW, simH);
      if (!b.ok) { console.warn('[agua] textura float (2ª) falhou — efeito desligado'); killed = true; teardown(); return; }

      let simProg, drawProg;
      try {
        simProg = link(gl, SIM_FRAG);
        drawProg = link(gl, DRAW_FRAG);
      } catch (err) {
        console.warn('[agua] shader não compilou — efeito desligado:', err?.message);
        killed = true; teardown(); return;
      }

      const quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

      state = { gl, simProg, drawProg, quad, texA: a, texB: b, simW, simH, drop: null };

      const bindQuad = (prog) => {
        const loc = gl.getAttribLocation(prog, 'a_pos');
        gl.bindBuffer(gl.ARRAY_BUFFER, quad);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      };

      const frame = () => {
        if (!state) return;
        const g = state.gl;

        // 1) física (2 subpassos por frame = ondas mais vivas)
        g.useProgram(simProg);
        bindQuad(simProg);
        g.viewport(0, 0, state.simW, state.simH);
        g.uniform2f(g.getUniformLocation(simProg, 'u_texel'), 1 / state.simW, 1 / state.simH);
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

        // 2) render: só a luz da água, fundo/texto do card seguem por baixo/cima
        g.bindFramebuffer(g.FRAMEBUFFER, null);
        g.viewport(0, 0, canvas.width, canvas.height);
        g.clearColor(0, 0, 0, 0);
        g.clear(g.COLOR_BUFFER_BIT);
        g.useProgram(drawProg);
        bindQuad(drawProg);
        g.uniform2f(g.getUniformLocation(drawProg, 'u_texel'), 1 / state.simW, 1 / state.simH);
        g.activeTexture(g.TEXTURE0);
        g.bindTexture(g.TEXTURE_2D, state.texA.texture);
        g.uniform1i(g.getUniformLocation(drawProg, 'u_water'), 0);
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
      dropAt(e.clientX, e.clientY, 0.045, 0.055); // esteira presente
    };

    const onDown = (e) => {
      onEnter(); // no touch não há hover: o toque em si acorda a água
      dropAt(e.clientX, e.clientY, 0.09, 0.22); // tchibum
    };

    const onLeave = () => {
      // deixa as ondas morrerem em cena, some suave e SOLTA o contexto GPU
      leaveTimer = setTimeout(() => {
        canvas.style.opacity = '0';
        leaveTimer = setTimeout(() => { if (state) teardown(); }, 450);
      }, 900);
    };

    // Pointer Events: um só código pra mouse e dedo. No touch, enter/leave
    // acontecem no pousar/levantar do dedo; cancel = scroll assumiu.
    host.addEventListener('pointerenter', onEnter);
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);
    host.addEventListener('pointercancel', onLeave);
    host.addEventListener('pointerdown', onDown);

    return () => {
      killed = true;
      host.removeEventListener('pointerenter', onEnter);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      host.removeEventListener('pointercancel', onLeave);
      host.removeEventListener('pointerdown', onDown);
      teardown();
    };
  }, []);

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
        zIndex: 5,             // acima do fundo da seção, abaixo do conteúdo (6)
        pointerEvents: 'none',
        opacity: 0,
        transition: 'opacity 0.35s ease',
      }}
    />
  );
}
