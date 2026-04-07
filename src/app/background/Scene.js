"use client";

import React, { useEffect, useRef } from "react";

// ─── Config ───────────────────────────────────
const INTRO_DURATION = 2.5;
const THEME_LERP = 5.0;
const TARGET_INTERVAL = 33; // ~30fps

// ─── Vertex Shader (fullscreen quad) ──────────
const VS = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// ─── Fragment Shader (topographic contour) ────
const FS = `
#extension GL_OES_standard_derivatives : enable
precision mediump float;

uniform float uTime;
uniform float uTheme;
uniform float uAmplitude;
uniform float uTransition;
uniform vec2  uMouse;
uniform vec2  uResolution;

varying vec2 vUv;

/* ── Simplex 2D — Ashima Arts ── */
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                           + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                           dot(x12.zw, x12.zw)), 0.0);
  m = m * m * m * m;
  vec3 x_ = 2.0 * fract(p * C.www) - 1.0;
  vec3 h  = abs(x_) - 0.5;
  vec3 ox = floor(x_ + 0.5);
  vec3 a0 = x_ - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x * x0.x  + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

/* 3-octave FBM — smooth flowing terrain */
float fbm(vec2 p) {
  float f = 0.0;
  f += 0.500 * snoise(p); p *= 2.02;
  f += 0.250 * snoise(p); p *= 2.03;
  f += 0.125 * snoise(p);
  return f / 0.875;
}

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);

  float t = uTime * 0.06;

  /* ── mouse distortion field (ring, not point) ── */
  vec2  mp    = uMouse * vec2(aspect * 0.5, -0.5);
  float mDist = length(p - mp);
  float ringR = 0.22;
  float ringW = 0.14;
  float mInfl = exp(-pow(mDist - ringR, 2.0) / (2.0 * ringW * ringW))
              * smoothstep(0.7, 0.3, mDist);
  vec2  mDir  = (p - mp) / (mDist + 0.001);
  vec2  mWarp = mDir * mInfl * 0.025;

  /* domain warping → organic contour shapes */
  vec2 q = vec2(
    fbm(p * 1.5 + mWarp * 0.5 + vec2(t * 0.5, 0.0)),
    fbm(p * 1.5 + mWarp * 0.5 + vec2(0.0, t * 0.35) + vec2(5.2, 1.3))
  );
  float h = fbm(p * 1.5 + q * 0.35 + mWarp + vec2(t * 0.2, -t * 0.15));

  /* ── contour lines ── */
  float interval = 0.1;
  float tThick = 1.0 + uTransition * 0.8;

  /* minor contours */
  float cv  = h / interval;
  float f   = fract(cv);
  float d   = min(f, 1.0 - f);
  float fw  = max(fwidth(cv), 0.001);
  float minorLine = 1.0 - smoothstep(0.0, fw * 1.2 * tThick, d);

  /* major contours — every 5th */
  float mcv = h / (interval * 5.0);
  float mf  = fract(mcv);
  float md  = min(mf, 1.0 - mf);
  float mfw = max(fwidth(mcv), 0.0002);
  float majorLine = 1.0 - smoothstep(0.0, mfw * 2.0 * tThick, md);

  /* opacity — boosted during transition */
  float minorA = mix(0.25, 0.22, uTheme) + uTransition * 0.30;
  float majorA = mix(0.55, 0.50, uTheme) + uTransition * 0.35;
  float lineAlpha = max(minorLine * minorA, majorLine * majorA);

  /* ── colours ── */
  vec3 bgL = vec3(0.980, 0.984, 0.996);
  vec3 bgD = vec3(0.047, 0.039, 0.114);
  vec3 bg  = mix(bgL, bgD, uTheme);

  /* line colour — accent colours from design system */
  float hn  = smoothstep(-0.5, 0.5, h);
  vec3 loL  = vec3(0.388, 0.400, 0.945);
  vec3 hiL  = vec3(0.545, 0.361, 0.965);
  vec3 loD  = vec3(0.506, 0.549, 0.973);
  vec3 hiD  = vec3(0.655, 0.545, 0.980);
  vec3 lineColor = mix(mix(loL, hiL, hn), mix(loD, hiD, hn), uTheme);

  /* flash toward white at transition peak */
  lineColor = mix(lineColor, vec3(1.0), uTransition * 0.5);

  /* soft vignette */
  float vig = 1.0 - smoothstep(0.35, 1.15, length(p * vec2(0.55, 0.8)));

  vec3 color = mix(bg, lineColor, lineAlpha * uAmplitude * vig);

  /* subtle background glow during transition */
  color += lineColor * uTransition * 0.06 * vig;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

// ─── WebGL helpers ────────────────────────────
function compileShader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

function createProgram(gl, vsSrc, fsSrc) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(prog));
    return null;
  }
  // Shaders no longer needed after linking
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return prog;
}

// ─── React component ─────────────────────────
export function Scene({ theme }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  /* theme prop → animation target */
  useEffect(() => {
    if (!stateRef.current) return;
    stateRef.current.themeTarget = theme === "dark" ? 1.0 : 0.0;
  }, [theme]);

  /* Raw WebGL setup */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { antialias: false, alpha: false })
            || canvas.getContext("experimental-webgl", { antialias: false, alpha: false });
    if (!gl) { console.error("WebGL not supported"); return; }

    // Enable OES_standard_derivatives for fwidth()
    gl.getExtension("OES_standard_derivatives");

    const program = createProgram(gl, VS, FS);
    if (!program) return;
    gl.useProgram(program);

    // Fullscreen quad: two triangles
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // Uniform locations
    const uTime       = gl.getUniformLocation(program, "uTime");
    const uTheme      = gl.getUniformLocation(program, "uTheme");
    const uAmplitude  = gl.getUniformLocation(program, "uAmplitude");
    const uTransition = gl.getUniformLocation(program, "uTransition");
    const uMouse      = gl.getUniformLocation(program, "uMouse");
    const uResolution = gl.getUniformLocation(program, "uResolution");

    // Sizing
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
    };
    resize();

    let resizeTimer = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 200);
    };
    window.addEventListener("resize", onResize);

    // State
    const isDark = document.documentElement.classList.contains("dark");
    const tv = isDark ? 1.0 : 0.0;
    const state = {
      themeTarget: tv,
      themeCurrent: tv,
      transEnergy: 0,
      speedMul: 0.4,
      accTime: 0,
      startTime: performance.now(),
      lastTime: performance.now(),
      frameId: 0,
      mouseX: 0,
      mouseY: 0,
    };
    stateRef.current = state;

    // Events
    const onSpeed = (e) => { state.speedMul = e.detail; };
    window.addEventListener("bg-speed", onSpeed);

    const onMouse = (e) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMouse, { passive: true });

    // Render loop (~30fps)
    let lastRenderTime = 0;

    const animate = () => {
      state.frameId = requestAnimationFrame(animate);
      if (document.hidden) return;

      const now = performance.now();
      if (now - lastRenderTime < TARGET_INTERVAL) return;
      lastRenderTime = now;

      const dt = Math.min((now - state.lastTime) / 1000, 0.1);
      state.lastTime = now;
      const elapsed = (now - state.startTime) / 1000;

      state.accTime += dt * state.speedMul;
      gl.uniform1f(uTime, state.accTime);

      // Intro fade-in
      const intro = Math.min(elapsed / INTRO_DURATION, 1);
      gl.uniform1f(uAmplitude, 1 - Math.pow(1 - intro, 3));

      // Theme transition
      state.themeCurrent += (state.themeTarget - state.themeCurrent) * (1 - Math.exp(-THEME_LERP * dt));
      if (Math.abs(state.themeTarget - state.themeCurrent) < 0.0005) {
        state.themeCurrent = state.themeTarget;
      }
      gl.uniform1f(uTheme, state.themeCurrent);

      // Transition energy
      const transRaw = Math.min(state.themeCurrent, 1 - state.themeCurrent) * 2;
      state.transEnergy += (transRaw - state.transEnergy) * (1 - Math.exp(-10.0 * dt));
      gl.uniform1f(uTransition, state.transEnergy);

      // Smooth mouse
      const ms = 1 - Math.exp(-1 * dt);
      state.mouseX += (mouseRef.current.x - state.mouseX) * ms;
      state.mouseY += (mouseRef.current.y - state.mouseY) * ms;
      gl.uniform2f(uMouse, state.mouseX, state.mouseY);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    state.frameId = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      cancelAnimationFrame(state.frameId);
      window.removeEventListener("bg-speed", onSpeed);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("resize", onResize);
      if (resizeTimer) clearTimeout(resizeTimer);
      gl.deleteProgram(program);
      gl.deleteBuffer(buf);
      stateRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      style={{ backgroundColor: theme === "dark" ? "#0c0a1d" : "#fafbfe" }}
    />
  );
}
