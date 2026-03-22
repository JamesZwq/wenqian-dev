"use client";

import React, { useEffect, useRef, useState } from "react";

export default function FpsCounter() {
  const [fps, setFps] = useState<number | null>(null);
  const framesRef = useRef(0);
  const lastTimeRef = useRef<typeof performance.now extends () => number ? number : number>(
    typeof performance !== "undefined" ? performance.now() : Date.now()
  );
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const loop = () => {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      framesRef.current += 1;
      const delta = now - lastTimeRef.current;

      if (delta >= 500) {
        const currentFps = (framesRef.current * 1000) / delta;
        setFps(Math.round(currentFps));
        framesRef.current = 0;
        lastTimeRef.current = now;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  if (fps === null) return null;

  let colorClass = "text-[var(--pixel-accent)]";
  if (fps < 30) {
    colorClass = "text-[var(--pixel-warn)]";
  } else if (fps < 50) {
    colorClass = "text-[color-mix(in_oklab,var(--pixel-warn)_60%,var(--pixel-accent)_40%)]";
  }

  return (
    <div
      className={`mix-blend-difference mix-blend-mode pointer-events-none fixed right-2 bottom-2 z-[190] px-2 py-1 font-mono text-[10px] ${colorClass}`}
    >
      FPS: {fps}
    </div>
  );
}
