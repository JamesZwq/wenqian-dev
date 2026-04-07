"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

// ─── Config ───────────────────────────────────
const INTRO_DURATION = 2.5;
const THEME_LERP = 5.0;
const BG_LIGHT = new THREE.Color(0xfafbfe);
const BG_DARK = new THREE.Color(0x0c0a1d);

// ─── Vertex Shader (fullscreen quad) ──────────
const VS = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// ─── Fragment Shader (topographic contour) ────
const FS = `
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
  float tThick = 1.0 + uTransition * 0.8;   /* lines swell during transition */

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

export function Scene({ theme }) {
  const containerRef = useRef(null);
  const stateRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  /* theme prop → animation target */
  useEffect(() => {
    if (!stateRef.current) return;
    stateRef.current.themeTarget = theme === "dark" ? 1.0 : 0.0;
  }, [theme]);

  /* WebGL setup */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const W = container.clientWidth;
    const H = container.clientHeight;
    const isDark = document.documentElement.classList.contains("dark");

    // Renderer
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H);
    renderer.setClearColor(isDark ? BG_DARK : BG_LIGHT);
    container.appendChild(renderer.domElement);
    renderer.domElement.style.pointerEvents = "none";

    // Scene + camera
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

    // Fullscreen quad
    const geo = new THREE.PlaneGeometry(2, 2);
    const uniforms = {
      uTime:       { value: 0 },
      uAmplitude:  { value: 0 },
      uTheme:      { value: isDark ? 1.0 : 0.0 },
      uTransition: { value: 0 },
      uMouse:      { value: new THREE.Vector2(0, 0) },
      uResolution: { value: new THREE.Vector2(W, H) },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VS,
      fragmentShader: FS,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
    scene.add(new THREE.Mesh(geo, mat));

    // Bloom
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(W, H),
      isDark ? 0.2 : 0, 0.7, 0.4
    );
    composer.addPass(bloom);

    // State
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
    };
    stateRef.current = state;
    composer.render();

    // ── Speed event ──
    const onSpeed = (e) => { state.speedMul = e.detail; };
    window.addEventListener("bg-speed", onSpeed);

    // ── Scroll throttle ──
    let scrolling = false;
    let scrollTimer = null;
    let skipFrame = false;
    const onScroll = () => {
      scrolling = true;
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => { scrolling = false; }, 150);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // ── Mouse ──
    const onMouse = (e) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMouse, { passive: true });

    // ── Animate (capped at ~30fps to save GPU) ──
    const TARGET_INTERVAL = 33; // ~30fps
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
      uniforms.uTime.value = state.accTime;

      // Intro fade-in
      const intro = Math.min(elapsed / INTRO_DURATION, 1);
      uniforms.uAmplitude.value = 1 - Math.pow(1 - intro, 3);

      // Theme transition (exponential ease)
      state.themeCurrent += (state.themeTarget - state.themeCurrent) * (1 - Math.exp(-THEME_LERP * dt));
      if (Math.abs(state.themeTarget - state.themeCurrent) < 0.0005) {
        state.themeCurrent = state.themeTarget;
      }
      uniforms.uTheme.value = state.themeCurrent;

      // Transition energy — bell curve peaking at midpoint (0.5)
      const transRaw = Math.min(state.themeCurrent, 1 - state.themeCurrent) * 2;
      state.transEnergy += (transRaw - state.transEnergy) * (1 - Math.exp(-10.0 * dt));
      uniforms.uTransition.value = state.transEnergy;

      // Bloom: base dark-mode glow + dramatic transition pulse
      bloom.strength = state.themeCurrent * 0.2 + state.transEnergy * 0.8;

      // Smooth mouse — slow drift for gentle convergence/dispersion
      const ms = 1 - Math.exp(-1 * dt);
      uniforms.uMouse.value.x += (mouseRef.current.x - uniforms.uMouse.value.x) * ms;
      uniforms.uMouse.value.y += (mouseRef.current.y - uniforms.uMouse.value.y) * ms;

      composer.render();
    };

    state.frameId = requestAnimationFrame(animate);

    // ── Resize ──
    let resizeTimer = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!container) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        renderer.setSize(w, h);
        composer.setSize(w, h);
        uniforms.uResolution.value.set(w, h);
      }, 200);
    };
    window.addEventListener("resize", onResize);

    // ── Cleanup ──
    return () => {
      cancelAnimationFrame(state.frameId);
      window.removeEventListener("bg-speed", onSpeed);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      if (scrollTimer) clearTimeout(scrollTimer);
      if (resizeTimer) clearTimeout(resizeTimer);
      renderer.dispose();
      geo.dispose();
      mat.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      stateRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ backgroundColor: theme === "dark" ? "#0c0a1d" : "#fafbfe" }}
    />
  );
}
