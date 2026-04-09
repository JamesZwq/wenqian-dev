"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#22c55e", "#facc15", "#818cf8", "#f472b6", "#38bdf8", "#a78bfa", "#fb923c"];

export default function Confetti({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(false);

  useEffect(() => {
    if (!active || activeRef.current) return;
    activeRef.current = true;
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    cvs.width = window.innerWidth * dpr;
    cvs.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);
    cvs.style.width = `${window.innerWidth}px`;
    cvs.style.height = `${window.innerHeight}px`;

    const particles: { x: number; y: number; vx: number; vy: number; r: number; c: string; rot: number; rv: number; life: number }[] = [];
    const W = window.innerWidth;
    const H = window.innerHeight;

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: W * 0.5 + (Math.random() - 0.5) * W * 0.3,
        y: H * 0.45,
        vx: (Math.random() - 0.5) * 14,
        vy: -Math.random() * 18 - 4,
        r: Math.random() * 5 + 3,
        c: COLORS[Math.floor(Math.random() * COLORS.length)],
        rot: Math.random() * Math.PI * 2,
        rv: (Math.random() - 0.5) * 0.3,
        life: 1,
      });
    }

    let raf = 0;
    let cancelled = false;
    const startTime = performance.now();
    const MAX_DURATION = 4000;

    const draw = (now: number) => {
      if (cancelled) return;
      if (now - startTime > MAX_DURATION) {
        ctx.clearRect(0, 0, W, H);
        activeRef.current = false;
        return;
      }
      ctx.clearRect(0, 0, W, H);
      let alive = false;
      for (const p of particles) {
        p.vy += 0.35;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.rv;
        p.life -= 0.012;
        if (p.life <= 0) continue;
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.min(p.life, 1);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.r, -p.r * 0.4, p.r * 2, p.r * 0.8);
        ctx.restore();
      }
      if (alive) raf = requestAnimationFrame(draw);
      else { ctx.clearRect(0, 0, W, H); activeRef.current = false; }
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelled = true; cancelAnimationFrame(raf); ctx.clearRect(0, 0, W, H); activeRef.current = false; };
  }, [active]);

  useEffect(() => {
    if (!active && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      activeRef.current = false;
    }
  }, [active]);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[100]" />;
}
