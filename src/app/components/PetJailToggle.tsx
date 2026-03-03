"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function PetJailToggle() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      setEnabled(false);
      return;
    }
    // 首次加载时强制设置为关在监狱里
    try {
      window.localStorage.setItem("cursorPetEnabled", "false");
      setEnabled(false);
    } catch {
      setEnabled(false);
    }
  }, []);

  const isOn = enabled;

  const handleClick = () => {
    if (typeof window === "undefined") return;
    const next = !isOn;
    setEnabled(next);
    try {
      window.localStorage.setItem("cursorPetEnabled", next ? "true" : "false");
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event("cursor-pet-toggle"));
  };

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      whileHover={{
        scale: 1.03,
        boxShadow: "0 0 12px rgba(255,255,255,0.35)",
      }}
      whileTap={{ scale: 0.97 }}
      className="pointer-events-auto fixed bottom-4 left-4 z-[130] flex flex-col items-center gap-1"
    >
      {/* 小小说明文字 */}
      <span className="font-[family-name:var(--font-press-start)] text-[8px] text-[color-mix(in_oklab,var(--pixel-text)_80%,transparent)] tracking-[0.15em]">
        {isOn ? "PET FREE" : "PET JAIL"}
      </span>

      {/* 像素风小监狱 */}
      <motion.div
        className="relative w-10 h-8 border-2 border-[var(--pixel-border)] bg-[color-mix(in_oklab,var(--pixel-bg)_60%,transparent)] shadow-[0_0_10px_color-mix(in_oklab,var(--pixel-bg)_80%,transparent)]"
        animate={{
          y: isOn ? [0, -2, 0] : 0,
        }}
        transition={
          isOn
            ? { repeat: Infinity, duration: 1.8, ease: "easeInOut" }
            : { duration: 0.2 }
        }
      >
        {/* 笼子的栅栏：顶部横梁 + 多条竖栏，营造笼子网格的感觉 */}
        <div className="absolute inset-1">
          {/* 顶部横梁 */}
          <div className="w-full h-[1px] bg-[color-mix(in_oklab,var(--pixel-border)_95%,black)] opacity-80" />
          {/* 多条竖栏 */}
          <div className="absolute inset-0 flex justify-between px-[2px] pt-[1px]">
            <div className="w-[1px] bg-[color-mix(in_oklab,var(--pixel-border)_90%,black)] opacity-75" />
            <div className="w-[1px] bg-[color-mix(in_oklab,var(--pixel-border)_90%,black)] opacity-75" />
            <div className="w-[1px] bg-[color-mix(in_oklab,var(--pixel-border)_90%,black)] opacity-75" />
            <div className="w-[1px] bg-[color-mix(in_oklab,var(--pixel-border)_90%,black)] opacity-75" />
          </div>
        </div>

        {/* 牢门（可开合） */}
        <motion.div
          className="absolute inset-y-1 right-0 w-4 border-l-2 border-[var(--pixel-border)] bg-[color-mix(in_oklab,var(--pixel-bg)_80%,transparent)] origin-right"
          animate={{
            rotateY: isOn ? -75 : 0,
          }}
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
        >
          {/* 门把手 */}
          <div className="absolute inset-y-0 left-0 flex items-center">
            <div className="w-[2px] h-3 bg-[color-mix(in_oklab,var(--pixel-border)_80%,black)] ml-[1px]" />
          </div>
        </motion.div>
      </motion.div>
    </motion.button>
  );
}

