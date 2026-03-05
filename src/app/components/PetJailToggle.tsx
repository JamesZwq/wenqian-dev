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
    // 与 CursorPet 一致：从 localStorage 读取，非触摸设备默认放出（true）
    try {
      const stored = window.localStorage.getItem("cursorPetEnabled");
      if (stored !== null) {
        setEnabled(stored === "true");
      } else {
        const finePointer = !window.matchMedia("(pointer: coarse)").matches;
        setEnabled(finePointer);
      }
    } catch {
      setEnabled(false);
    }
  }, []);

  const isOn = enabled;

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (typeof window === "undefined") return;

    // Capture coords BEFORE state update (React events can be transient in some setups)
    const x = e.clientX;
    const y = e.clientY;
    const pointerType = e.pointerType;

    setEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("cursorPetEnabled", next ? "true" : "false");
      } catch {
        // ignore
      }

      // Prefer a CustomEvent with details so CursorPet can "wake up" immediately on Safari
      try {
        window.dispatchEvent(
          new CustomEvent("cursor-pet-toggle", {
            detail: { enabled: next, x, y, pointerType },
          })
        );
      } catch {
        window.dispatchEvent(new Event("cursor-pet-toggle"));
      }

      return next;
    });
  };

  return (
    <motion.button
      type="button"
      onPointerDown={handlePointerDown}
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

      {/* 像素风小监狱（重新设计） */}
      <motion.div
        className="relative w-11 h-9 rounded-[6px] border-2 border-[color-mix(in_oklab,var(--pixel-border)_95%,black)] bg-[color-mix(in_oklab,var(--pixel-bg)_70%,transparent)] shadow-[0_0_10px_color-mix(in_oklab,var(--pixel-bg)_85%,transparent)] overflow-hidden"
        animate={{
          y: isOn ? [0, -2, 0] : 0,
        }}
        transition={
          isOn
            ? { repeat: Infinity, duration: 1.8, ease: "easeInOut" }
            : { duration: 0.2 }
        }
      >
        {/* 顶部拱形 & 链条 */}
        <div className="absolute top-0 inset-x-1 h-2 rounded-t-[6px] bg-[color-mix(in_oklab,var(--pixel-bg)_85%,transparent)] border-b border-[color-mix(in_oklab,var(--pixel-border)_80%,black)]">
          <div className="mx-auto mt-[2px] flex gap-[2px] justify-center">
            <div className="w-[2px] h-[3px] bg-[color-mix(in_oklab,var(--pixel-border)_80%,black)] opacity-80" />
            <div className="w-[2px] h-[3px] bg-[color-mix(in_oklab,var(--pixel-border)_80%,black)] opacity-80" />
            <div className="w-[2px] h-[3px] bg-[color-mix(in_oklab,var(--pixel-border)_80%,black)] opacity-80" />
          </div>
        </div>

        {/* 底部石台 */}
        <div className="absolute bottom-0 inset-x-0 h-2 bg-[color-mix(in_oklab,var(--pixel-bg)_90%,black)] opacity-60" />

        {/* 笼子内部栅栏 + 小宠物的剪影 */}
        <div className="absolute inset-x-1 top-2 bottom-2 flex items-center justify-center">
          {/* 栅栏 */}
          <div className="absolute inset-y-0 inset-x-0 flex justify-between px-[3px]">
            <div className="w-[1px] bg-[color-mix(in_oklab,var(--pixel-border)_85%,black)] opacity-75" />
            <div className="w-[1px] bg-[color-mix(in_oklab,var(--pixel-border)_85%,black)] opacity-75" />
            <div className="w-[1px] bg-[color-mix(in_oklab,var(--pixel-border)_85%,black)] opacity-75" />
            <div className="w-[1px] bg-[color-mix(in_oklab,var(--pixel-border)_85%,black)] opacity-75" />
          </div>

          {/* 小宠物的剪影：关着时更亮，放出时变淡 */}
          <div
            className="relative w-4 h-3 rounded-[999px] mx-auto"
            style={{
              backgroundColor: isOn
                ? "color-mix(in_oklab,var(--pixel-accent)_30%,transparent)"
                : "color-mix(in_oklab,var(--pixel-accent)_80%,transparent)",
            }}
          >
            {/* 耳朵 */}
            <div className="absolute -top-[3px] left-[3px] w-[5px] h-[4px] rounded-t-[6px] bg-[color-mix(in_oklab,var(--pixel-accent)_90%,transparent)]" />
            <div className="absolute -top-[3px] right-[3px] w-[5px] h-[4px] rounded-t-[6px] bg-[color-mix(in_oklab,var(--pixel-accent)_90%,transparent)]" />
            {/* 眼睛 */}
            <div className="absolute inset-0 flex items-center justify-center gap-[3px]">
              <div className="w-[2px] h-[2px] rounded-full bg-[var(--pixel-bg)] opacity-90" />
              <div className="w-[2px] h-[2px] rounded-full bg-[var(--pixel-bg)] opacity-90" />
            </div>
          </div>
        </div>

        {/* 牢门（可开合）：PET JAIL 时门关(rotateY:-80)，PET FREE 时门开(rotateY:0) */}
        <motion.div
          className="absolute inset-y-1 right-0 w-4 border-l-2 border-[var(--pixel-border)] bg-[color-mix(in_oklab,var(--pixel-bg)_80%,transparent)] origin-right"
          animate={{
            rotateY: isOn ? 0 : -80,
            x: isOn ? 1 : 0,
            opacity: isOn ? 0.9 : 1,
          }}
          transition={{ type: "spring", stiffness: 520, damping: 32 }}
        >
          {/* 门把手 */}
          <div className="absolute inset-y-0 left-0 flex items-center">
            <div className="w-[2px] h-3 bg-[color-mix(in_oklab,var(--pixel-border)_80%,black)] ml-[1px]" />
          </div>
          {/* 小锁头 */}
          <div className="absolute bottom-[3px] right-[3px] w-[5px] h-[4px] rounded-[2px] bg-[color-mix(in_oklab,var(--pixel-border)_90%,black)]">
            <div className="absolute -top-[3px] inset-x-[1px] h-[3px] rounded-t-[4px] border border-[color-mix(in_oklab,var(--pixel-border)_90%,black)] bg-[color-mix(in_oklab,var(--pixel-bg)_80%,transparent)]" />
          </div>
        </motion.div>
      </motion.div>
    </motion.button>
  );
}

