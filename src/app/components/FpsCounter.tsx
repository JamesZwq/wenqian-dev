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

      // 每 500ms 统计一次平均 FPS，避免过于抖动
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

  // 简单的颜色提示：低于 30 红色，30–50 橙色，50+ 绿色
  let colorClass = "text-[var(--pixel-accent)]";
  if (fps < 30) {
    colorClass = "text-[var(--pixel-warn)]";
  } else if (fps < 50) {
    colorClass = "text-[color-mix(in_oklab,var(--pixel-warn)_60%,var(--pixel-accent)_40%)]";
  }

  return (
    <div
      className={`mix-blend-difference mix-blend-mode pointer-events-none fixed right-2 bottom-2 z-[190] px-2 py-1 font-[family-name:var(--font-jetbrains)] text-[10px] ${colorClass}`}
      style={{ backdropFilter: "blur(6px)" }}
    >
      FPS: {fps}
    </div>
  );
}

