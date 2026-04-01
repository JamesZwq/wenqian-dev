"use client";

import { useState, useCallback } from "react";

export default function BgSpeedControl() {
  const [speed, setSpeed] = useState(1);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setSpeed(v);
    window.dispatchEvent(new CustomEvent("bg-speed", { detail: v }));
  }, []);

  return (
    <div className="fixed right-3 bottom-10 z-30 flex items-center gap-2 px-2.5 py-[5px] rounded-xl border border-[color-mix(in_oklab,var(--pixel-border)_90%,transparent)] bg-[color-mix(in_oklab,var(--pixel-bg)_85%,transparent)] shadow-lg font-sans text-[9px] font-semibold tracking-tight text-[color-mix(in_oklab,var(--pixel-text)_80%,transparent)]">
      <span className="opacity-70">BG</span>
      <input
        type="range"
        min="0.2"
        max="10"
        step="0.1"
        value={speed}
        onChange={onChange}
        className="w-14 h-1 appearance-none rounded-full bg-[var(--pixel-border)] accent-[var(--pixel-accent)] cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--pixel-accent)]"
      />
      <span className="text-[color-mix(in_oklab,var(--pixel-accent)_90%,white)] min-w-[2.2em] text-right">
        {speed.toFixed(1)}x
      </span>
    </div>
  );
}
