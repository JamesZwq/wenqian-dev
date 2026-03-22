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
        boxShadow: "0 0 12px rgba(99,102,241,0.35)",
      }}
      whileTap={{ scale: 0.97 }}
      className="pointer-events-auto fixed bottom-4 left-4 z-[130] flex flex-col items-center gap-1"
    >
      <span className="font-sans text-[8px] font-semibold text-[color-mix(in_oklab,var(--pixel-text)_80%,transparent)] tracking-tight">
        {isOn ? "PET FREE" : "PET JAIL"}
      </span>

      <motion.div
        className="relative w-11 h-9 rounded-xl border-2 border-[color-mix(in_oklab,var(--pixel-border)_95%,transparent)] bg-[color-mix(in_oklab,var(--pixel-bg)_70%,transparent)] shadow-lg overflow-hidden"
        animate={{
          y: isOn ? [0, -2, 0] : 0,
        }}
        transition={
          isOn
            ? { repeat: Infinity, duration: 1.8, ease: "easeInOut" }
            : { duration: 0.2 }
        }
      >
        <div className="absolute top-0 inset-x-1 h-2 rounded-t-xl bg-[color-mix(in_oklab,var(--pixel-bg)_85%,transparent)] border-b border-[color-mix(in_oklab,var(--pixel-border)_80%,transparent)]">
          <div className="mx-auto mt-[2px] flex gap-[2px] justify-center">
            <div className="w-[2px] h-[3px] bg-[color-mix(in_oklab,var(--pixel-border)_80%,transparent)] opacity-80" />
            <div className="w-[2px] h-[3px] bg-[color-mix(in_oklab,var(--pixel-border)_80%,transparent)] opacity-80" />
            <div className="w-[2px] h-[3px] bg-[color-mix(in_oklab,var(--pixel-border)_80%,transparent)] opacity-80" />
          </div>
        </div>

        <div className="absolute bottom-0 inset-x-0 h-2 bg-[color-mix(in_oklab,var(--pixel-bg)_90%,black)] opacity-60 rounded-b-xl" />

        <div className="absolute inset-x-1 top-2 bottom-2 flex items-center justify-center">
          <div className="absolute inset-y-0 inset-x-0 flex justify-between px-[3px]">
            <div className="w-[1px] bg-[color-mix(in_oklab,var(--pixel-border)_85%,transparent)] opacity-75" />
            <div className="w-[1px] bg-[color-mix(in_oklab,var(--pixel-border)_85%,transparent)] opacity-75" />
            <div className="w-[1px] bg-[color-mix(in_oklab,var(--pixel-border)_85%,transparent)] opacity-75" />
            <div className="w-[1px] bg-[color-mix(in_oklab,var(--pixel-border)_85%,transparent)] opacity-75" />
          </div>

          <div
            className="relative w-4 h-3 rounded-[999px] mx-auto"
            style={{
              backgroundColor: isOn
                ? "color-mix(in_oklab,var(--pixel-accent)_30%,transparent)"
                : "color-mix(in_oklab,var(--pixel-accent)_80%,transparent)",
            }}
          >
            <div className="absolute -top-[3px] left-[3px] w-[5px] h-[4px] rounded-t-[6px] bg-[color-mix(in_oklab,var(--pixel-accent)_90%,transparent)]" />
            <div className="absolute -top-[3px] right-[3px] w-[5px] h-[4px] rounded-t-[6px] bg-[color-mix(in_oklab,var(--pixel-accent)_90%,transparent)]" />
            <div className="absolute inset-0 flex items-center justify-center gap-[3px]">
              <div className="w-[2px] h-[2px] rounded-full bg-[var(--pixel-bg)] opacity-90" />
              <div className="w-[2px] h-[2px] rounded-full bg-[var(--pixel-bg)] opacity-90" />
            </div>
          </div>
        </div>

        <motion.div
          className="absolute inset-y-1 right-0 w-4 rounded-r-lg border-l-2 border-[var(--pixel-border)] bg-[color-mix(in_oklab,var(--pixel-bg)_80%,transparent)] origin-right"
          animate={{
            rotateY: isOn ? 0 : -80,
            x: isOn ? 1 : 0,
            opacity: isOn ? 0.9 : 1,
          }}
          transition={{ type: "spring", stiffness: 520, damping: 32 }}
        >
          <div className="absolute inset-y-0 left-0 flex items-center">
            <div className="w-[2px] h-3 bg-[color-mix(in_oklab,var(--pixel-border)_80%,transparent)] ml-[1px]" />
          </div>
          <div className="absolute bottom-[3px] right-[3px] w-[5px] h-[4px] rounded-[2px] bg-[color-mix(in_oklab,var(--pixel-border)_90%,transparent)]">
            <div className="absolute -top-[3px] inset-x-[1px] h-[3px] rounded-t-[4px] border border-[color-mix(in_oklab,var(--pixel-border)_90%,transparent)] bg-[color-mix(in_oklab,var(--pixel-bg)_80%,transparent)]" />
          </div>
        </motion.div>
      </motion.div>
    </motion.button>
  );
}
