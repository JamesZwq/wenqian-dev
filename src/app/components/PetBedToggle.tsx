"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function PetBedToggle() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") { setEnabled(false); return; }
    try {
      const stored = window.localStorage.getItem("cursorPetEnabled");
      if (stored !== null) setEnabled(stored === "true");
      else {
        const def = !window.matchMedia("(pointer: coarse)").matches;
        window.localStorage.setItem("cursorPetEnabled", String(def));
        setEnabled(def);
      }
    } catch { setEnabled(false); }
  }, []);

  const isAwake = enabled;

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (typeof window === "undefined") return;
    const x = e.clientX, y = e.clientY, pointerType = e.pointerType;
    setEnabled((prev) => {
      const next = !prev;
      try { window.localStorage.setItem("cursorPetEnabled", next ? "true" : "false"); } catch {}
      queueMicrotask(() => {
        try { window.dispatchEvent(new CustomEvent("cursor-pet-toggle", { detail: { enabled: next, x, y, pointerType } })); }
        catch { window.dispatchEvent(new Event("cursor-pet-toggle")); }
      });
      return next;
    });
  };

  return (
    <>
      {/* 层1: 小屋主体 (z-119) */}
      <motion.button
        type="button"
        onPointerDown={handlePointerDown}
        whileHover={{ scale: 1.05, boxShadow: "0 0 14px rgba(180,220,255,0.3)" }}
        whileTap={{ scale: 0.95 }}
        className="pointer-events-auto fixed bottom-4 left-4 z-[119] flex flex-col items-center gap-0.5"
      >
        <span className="font-sans text-[7px] font-semibold tracking-tight"
          style={{ color: "color-mix(in oklab, var(--pixel-text) 60%, transparent)" }}>
          {isAwake ? "OUTSIDE" : "HOME"}
        </span>

        <svg width="56" height="44" viewBox="0 0 56 44" fill="none" style={{ overflow: "visible" }}>
          <defs>
            <linearGradient id="hut-wall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e8f0fa" />
              <stop offset="100%" stopColor="#c8d8ef" />
            </linearGradient>
            <linearGradient id="hut-roof" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f0f6ff" />
              <stop offset="100%" stopColor="#d8e8f8" />
            </linearGradient>
          </defs>

          {/* 地面雪 */}
          <ellipse cx="28" cy="42" rx="28" ry="3" fill="#e8f0fa" opacity="0.6" />

          {/* 墙壁 */}
          <rect x="8" y="20" width="40" height="22" rx="3" fill="url(#hut-wall)" stroke="#b0c8e0" strokeWidth="0.6" />

          {/* 屋顶 */}
          <path d="M4 21 L28 5 L52 21 Z" fill="url(#hut-roof)" stroke="#b0c8e0" strokeWidth="0.6" />
          {/* 屋顶积雪 */}
          <path d="M3 21 Q8 18 13 21 Q18 17 23 20 Q28 16 33 20 Q38 17 43 21 Q48 18 53 21" fill="white" />
          <path d="M3 21 Q8 18 13 21 Q18 17 23 20 Q28 16 33 20 Q38 17 43 21 Q48 18 53 21" fill="none" stroke="#d0ddef" strokeWidth="0.4" />

          {/* 门洞 (深色, 门关上时被门板盖住) */}
          <rect x="21" y="28" width="14" height="14" rx="7" fill="#4a6888" />

          {/* 窗户 (左) */}
          <rect x="12" y="24" width="6" height="6" rx="1" fill="#a8d0f0" stroke="#7098c0" strokeWidth="0.5" />
          <line x1="15" y1="24" x2="15" y2="30" stroke="#7098c0" strokeWidth="0.4" />
          <line x1="12" y1="27" x2="18" y2="27" stroke="#7098c0" strokeWidth="0.4" />

          {/* 窗户 (右) */}
          <rect x="38" y="24" width="6" height="6" rx="1" fill="#a8d0f0" stroke="#7098c0" strokeWidth="0.5" />
          <line x1="41" y1="24" x2="41" y2="30" stroke="#7098c0" strokeWidth="0.4" />
          <line x1="38" y1="27" x2="44" y2="27" stroke="#7098c0" strokeWidth="0.4" />

          {/* 烟囱 */}
          <rect x="36" y="8" width="5" height="10" rx="1" fill="#b0c0d4" stroke="#90a8c0" strokeWidth="0.4" />
          <path d="M35 8.5 Q38.5 7 42 8.5" fill="white" stroke="#d0ddef" strokeWidth="0.3" />

          {/* 雪花 */}
          <text x="6" y="16" fontSize="4" fill="#b0c8e8" opacity="0.6">&#x2744;</text>
          <text x="46" y="14" fontSize="3" fill="#b0c8e8" opacity="0.5">&#x2744;</text>
          <text x="2" y="36" fontSize="3" fill="#c0d4ea" opacity="0.4">&#x2744;</text>
        </svg>
      </motion.button>

      {/* 层3: 门板 + zzz (z-121, 盖在雪宝上面) */}
      <div className="pointer-events-none fixed bottom-4 left-4 z-[121]">
        <div className="flex flex-col items-center gap-0.5">
          {/* 占位对齐标签高度 */}
          <span className="text-[7px] opacity-0 select-none">X</span>
          <div className="relative" style={{ width: 56, height: 44 }}>
            {/* 门板 — 关门/开门动画 */}
            <motion.svg
              width="14" height="14"
              viewBox="0 0 14 14"
              className="absolute"
              style={{ left: 21, top: 28, transformOrigin: "0px 7px" }}
              animate={{
                rotateY: isAwake ? -110 : 0,
              }}
              transition={{
                type: "spring", stiffness: 250, damping: 22,
                delay: isAwake ? 0 : 0.5,
              }}
            >
              <rect x="0" y="0" width="14" height="14" rx="7" fill="#8bb0d8" stroke="#7098c0" strokeWidth="0.5" />
              {/* 门把 */}
              <circle cx="10" cy="7" r="1.2" fill="#a0c0e0" stroke="#7098c0" strokeWidth="0.4" />
            </motion.svg>

            {/* Zzz */}
            <motion.div
              className="absolute font-sans font-bold text-[7px] leading-none"
              style={{ right: 2, top: 0, color: "color-mix(in oklab, var(--pixel-accent) 70%, transparent)" }}
              animate={{
                opacity: isAwake ? 0 : [0.4, 0.8, 0.4],
                y: isAwake ? 0 : [0, -2, 0],
              }}
              transition={isAwake ? { duration: 0.2 } : { repeat: Infinity, duration: 2, ease: "easeInOut" }}
            >
              z<span className="text-[5px]">z</span><span className="text-[4px]">z</span>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
}
