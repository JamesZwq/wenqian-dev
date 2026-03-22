 "use client";

import { useState } from "react";

export default function BackgroundModeToggle() {
  const [mode, setMode] = useState<"wave" | "random">("random");

  const handleClick = () => {
    const next = mode === "wave" ? "random" : "wave";
    setMode(next);
    window.dispatchEvent(new Event("bg-mode-toggle"));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="fixed right-3 bottom-10 z-30 px-2 py-[5px] rounded-xl border border-[color-mix(in_oklab,var(--pixel-border)_90%,transparent)] bg-[color-mix(in_oklab,var(--pixel-bg)_85%,transparent)] shadow-lg hover:bg-[color-mix(in_oklab,var(--pixel-bg)_100%,transparent)] active:translate-y-[1px] transition-colors duration-150 font-sans text-[9px] font-semibold tracking-tight text-[color-mix(in_oklab,var(--pixel-text)_80%,transparent)]"
    >
      <span className="mr-2 opacity-70">BG</span>
      <span className="text-[color-mix(in_oklab,var(--pixel-accent)_90%,white)]">
        {mode === "wave" ? "Wave" : "Spin"}
      </span>
    </button>
  );
}
