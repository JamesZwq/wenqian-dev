 "use client";

import { useState } from "react";

export default function BackgroundModeToggle() {
  const [mode, setMode] = useState<"wave" | "random">("random");

  const handleClick = () => {
    const next = mode === "wave" ? "random" : "wave";
    setMode(next);
    // 通知背景 Scene 切换模式
    window.dispatchEvent(new Event("bg-mode-toggle"));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="fixed right-3 bottom-10 z-30 px-2 py-[5px] rounded-[4px] border border-[color-mix(in_oklab,var(--pixel-border)_90%,black)] bg-[color-mix(in_oklab,var(--pixel-bg)_85%,transparent)] shadow-[0_0_0_1px_rgba(0,0,0,0.8)] hover:bg-[color-mix(in_oklab,var(--pixel-bg)_100%,transparent)] active:translate-y-[1px] transition-colors duration-150 font-[family-name:var(--font-press-start)] text-[9px] tracking-[0.15em] text-[color-mix(in_oklab,var(--pixel-text)_80%,transparent)]"
    >
      <span className="mr-2 opacity-70">BG MODE</span>
      <span className="text-[color-mix(in_oklab,var(--pixel-accent)_90%,white)]">
        {mode === "wave" ? "[ WAVE ]" : "[ SPIN ]"}
      </span>
    </button>
  );
}

