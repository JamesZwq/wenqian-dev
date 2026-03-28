"use client";

import { useEffect, useRef, useCallback } from "react";

// ── Config ──

const BASE_COUNT = 70;
const MOBILE_COUNT = 30;
const STAR_COUNT_DESKTOP = 90;
const STAR_COUNT_MOBILE = 40;
const CONNECTION_DIST = 140;
const MOUSE_RADIUS = 180;
const MOUSE_FORCE = 0.07;
const PARTICLE_SPEED = 0.22;
const DEPTH_LAYERS = 3;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  depth: number;
  alpha: number;
  hue: number;
}

interface Star {
  x: number;
  y: number;
  r: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  // pre-computed color string (avoid per-frame string concat)
  colorR: number;
  colorG: number;
  colorB: number;
}

// Pre-compute HSL → RGB for a hue in 230-270 range at fixed S/L
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hNorm = h / 360;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + hNorm * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

export default function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const stars = useRef<Star[]>([]);
  const mouse = useRef({ x: -9999, y: -9999 });
  const rafRef = useRef<number>(0);
  const frameRef = useRef(0);
  const themeRef = useRef<"dark" | "light">("dark");

  const createParticles = useCallback((w: number, h: number) => {
    const isMobile = w < 768;

    const count = isMobile ? MOBILE_COUNT : BASE_COUNT;
    const arr: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const depth = (i % DEPTH_LAYERS) / (DEPTH_LAYERS - 1);
      arr.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * PARTICLE_SPEED * 2,
        vy: (Math.random() - 0.5) * PARTICLE_SPEED * 2,
        r: 1.2 + depth * 1.6,
        depth,
        alpha: 0.3 + depth * 0.45,
        hue: 235 + Math.random() * 30,
      });
    }
    particles.current = arr;

    const starCount = isMobile ? STAR_COUNT_MOBILE : STAR_COUNT_DESKTOP;
    const starArr: Star[] = [];
    for (let i = 0; i < starCount; i++) {
      const hue = 230 + Math.random() * 40;
      const [r, g, b] = hslToRgb(hue, 0.5, 0.9);
      starArr.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.3,
        baseAlpha: Math.random() * 0.55 + 0.2,
        twinkleSpeed: 0.008 + Math.random() * 0.025,
        twinklePhase: Math.random() * Math.PI * 2,
        colorR: r, colorG: g, colorB: b,
      });
    }
    stars.current = starArr;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const detectTheme = () => {
      themeRef.current = document.documentElement.classList.contains("dark") ? "dark" : "light";
    };
    detectTheme();
    const observer = new MutationObserver(detectTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    // Use lower DPR for this overlay — soft particles don't need retina sharpness
    let cachedW = 0, cachedH = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      cachedW = window.innerWidth;
      cachedH = window.innerHeight;
      canvas.width = cachedW * dpr;
      canvas.height = cachedH * dpr;
      canvas.style.width = `${cachedW}px`;
      canvas.style.height = `${cachedH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const isMobile = cachedW < 768;
      const target = isMobile ? MOBILE_COUNT : BASE_COUNT;
      if (Math.abs(particles.current.length - target) > 10 || particles.current.length === 0) {
        createParticles(cachedW, cachedH);
      }
    };
    resize();
    window.addEventListener("resize", resize);

    const onMouse = (e: MouseEvent) => { mouse.current.x = e.clientX; mouse.current.y = e.clientY; };
    const onMouseLeave = () => { mouse.current.x = -9999; mouse.current.y = -9999; };
    window.addEventListener("mousemove", onMouse);
    window.addEventListener("mouseleave", onMouseLeave);
    const onTouch = (e: TouchEvent) => { if (e.touches.length > 0) { mouse.current.x = e.touches[0].clientX; mouse.current.y = e.touches[0].clientY; } };
    const onTouchEnd = () => { mouse.current.x = -9999; mouse.current.y = -9999; };
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("touchend", onTouchEnd);

    // Scroll-throttle: drop to ~15fps during active scroll
    let scrolling = false;
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      scrolling = true;
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => { scrolling = false; }, 150);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // Spatial grid for O(n) connection lookup
    const CELL = CONNECTION_DIST;
    let gridCols = 0, gridRows = 0;
    let grid: Int16Array = new Int16Array(0); // flat grid: each cell stores up to 8 indices
    const CELL_CAP = 8;
    let gridNext: Int16Array = new Int16Array(0);

    const rebuildGrid = (w: number, h: number, pts: Particle[]) => {
      gridCols = Math.ceil(w / CELL) + 1;
      gridRows = Math.ceil(h / CELL) + 1;
      const totalCells = gridCols * gridRows;
      // Reuse arrays if same size
      if (grid.length !== totalCells * CELL_CAP) {
        grid = new Int16Array(totalCells * CELL_CAP);
        gridNext = new Int16Array(totalCells); // count per cell
      }
      gridNext.fill(0);
      for (let i = 0; i < pts.length; i++) {
        const cx = Math.floor(pts[i].x / CELL);
        const cy = Math.floor(pts[i].y / CELL);
        if (cx < 0 || cy < 0 || cx >= gridCols || cy >= gridRows) continue;
        const cellIdx = cy * gridCols + cx;
        const cnt = gridNext[cellIdx];
        if (cnt < CELL_CAP) {
          grid[cellIdx * CELL_CAP + cnt] = i;
          gridNext[cellIdx] = cnt + 1;
        }
      }
    };

    // Pre-computed color strings for particles (avoid per-frame string alloc)
    const pColorCache: string[] = [];
    const pGlowCache: string[] = [];
    const pLineCache: string[] = [];

    const draw = () => {
      // Skip all work when tab is hidden
      if (document.hidden) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      frameRef.current++;
      const frame = frameRef.current;

      // Normal: every 2 frames (30fps). During scroll: every 4 frames (~15fps)
      const skip = scrolling ? 4 : 2;
      if (frame % skip !== 0) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const w = cachedW;
      const h = cachedH;
      const isDark = themeRef.current === "dark";
      const pts = particles.current;
      const strs = stars.current;
      const mx = mouse.current.x;
      const my = mouse.current.y;

      ctx.clearRect(0, 0, w, h);

      // ── Stars (only in dark, simple filled circles, NO gradients) ──
      if (isDark) {
        for (let i = 0; i < strs.length; i++) {
          const s = strs[i];
          const twinkle = Math.sin(frame * s.twinkleSpeed + s.twinklePhase);
          const a = s.baseAlpha * (0.5 + twinkle * 0.5);
          if (a < 0.06) continue;

          ctx.fillStyle = `rgba(${s.colorR},${s.colorG},${s.colorB},${a})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ── Update particles ──
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const speedMul = 0.4 + p.depth * 0.8;
        const dx = p.x - mx;
        const dy = p.y - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < MOUSE_RADIUS * MOUSE_RADIUS && d2 > 0) {
          const dist = Math.sqrt(d2);
          const force = (1 - dist / MOUSE_RADIUS) * MOUSE_FORCE;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }
        p.vx *= 0.985;
        p.vy *= 0.985;
        const speed = p.vx * p.vx + p.vy * p.vy;
        if (speed < 0.001) {
          p.vx += (Math.random() - 0.5) * 0.02;
          p.vy += (Math.random() - 0.5) * 0.02;
        }
        p.x += p.vx * speedMul;
        p.y += p.vy * speedMul;
        const pad = 20;
        if (p.x < -pad) p.x = w + pad;
        if (p.x > w + pad) p.x = -pad;
        if (p.y < -pad) p.y = h + pad;
        if (p.y > h + pad) p.y = -pad;
      }

      // Re-cache color strings every 60 frames (~1s)
      if (frame % 60 === 0 || pColorCache.length !== pts.length) {
        pColorCache.length = pts.length;
        pGlowCache.length = pts.length;
        pLineCache.length = pts.length;
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          const ba = isDark ? p.alpha : p.alpha * 0.4;
          const h = Math.round(p.hue);
          pColorCache[i] = isDark
            ? `hsla(${h},75%,82%,${ba.toFixed(2)})`
            : `hsla(${h},50%,50%,${ba.toFixed(2)})`;
          pGlowCache[i] = `hsla(${h},80%,75%,${(ba * 0.3).toFixed(2)})`;
          pLineCache[i] = isDark
            ? `hsla(${h},70%,72%,`
            : `hsla(${h},55%,55%,`;
        }
      }

      // ── Connections via spatial grid (skip during scroll — most expensive part) ──
      if (!scrolling) {
      rebuildGrid(w, h, pts);
      ctx.lineWidth = 0.6;
      const connDist2 = CONNECTION_DIST * CONNECTION_DIST;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const cx = Math.floor(a.x / CELL);
        const cy = Math.floor(a.y / CELL);

        // Check 3x3 neighborhood
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= gridCols || ny >= gridRows) continue;
            const cellIdx = ny * gridCols + nx;
            const cnt = gridNext[cellIdx];
            for (let k = 0; k < cnt; k++) {
              const j = grid[cellIdx * CELL_CAP + k];
              if (j <= i) continue;
              const b = pts[j];
              if (Math.abs(a.depth - b.depth) > 0.6) continue;
              const ddx = a.x - b.x;
              const ddy = a.y - b.y;
              const dd2 = ddx * ddx + ddy * ddy;
              if (dd2 < connDist2) {
                const d = Math.sqrt(dd2);
                const opacity = (1 - d / CONNECTION_DIST) * 0.35 * ((a.alpha + b.alpha) / 2);
                ctx.strokeStyle = pLineCache[i] + opacity.toFixed(2) + ")";
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
              }
            }
          }
        }
      }
      } // end if (!scrolling)

      // ── Draw particles (simple circles, no gradients) ──
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        ctx.fillStyle = pColorCache[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("scroll", onScroll);
      if (scrollTimer) clearTimeout(scrollTimer);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchend", onTouchEnd);
      observer.disconnect();
    };
  }, [createParticles]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: 3 }}
      aria-hidden="true"
    />
  );
}
