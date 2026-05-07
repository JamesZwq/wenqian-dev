"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Cycle background speed via `B`. Slow → normal → fast → slow.
const BG_SPEEDS = [0.5, 2, 5] as const;

export default function PixelKeyboardHandler() {
  const [key, setKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const bgSpeedIdxRef = useRef(1); // start at "normal" (2x)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept while typing in form fields.
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "?" || e.key === "h" || e.key === "H") {
        setKey("HELP");
        setTimeout(() => setKey(null), 3000);
      }
      if (e.key === "Escape") {
        setKey(null);
      }
      // `B` — cycle background speed
      if ((e.key === "b" || e.key === "B") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        bgSpeedIdxRef.current = (bgSpeedIdxRef.current + 1) % BG_SPEEDS.length;
        const speed = BG_SPEEDS[bgSpeedIdxRef.current];
        window.dispatchEvent(new CustomEvent("bg-speed", { detail: speed }));
        setToast(`BG speed ${speed}x`);
        setTimeout(() => setToast(null), 1200);
      }
      // Number keys: scroll to sections
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const targets: Record<string, string> = {
          "1": "#education",
          "2": "#publications",
          "3": "#skills",
          "0": "#",
        };
        const sel = targets[e.key];
        if (sel) {
          const el = document.querySelector(sel);
          el?.scrollIntoView({ behavior: "smooth" });
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <AnimatePresence>
        {key === "HELP" && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] px-6 py-4 border-2 border-[var(--pixel-border)] bg-[color-mix(in_oklab,var(--pixel-bg)_95%,black_5%)] font-[family-name:var(--font-jetbrains)] text-sm text-[var(--pixel-accent)]"
            style={{ boxShadow: "0 0 20px var(--pixel-glow)" }}
          >
            <div className="font-[family-name:var(--font-press-start)] text-[10px] mb-3 text-[var(--pixel-accent-2)]">
              [ KEYBOARD_SHORTCUTS ]
            </div>
            <div className="space-y-1.5">
              <div><kbd className="px-1.5 py-0.5 bg-[color-mix(in_oklab,var(--pixel-accent)_20%,transparent)] border border-[color-mix(in_oklab,var(--pixel-border)_50%,transparent)]">?</kbd> or <kbd className="px-1.5 py-0.5 bg-[color-mix(in_oklab,var(--pixel-accent)_20%,transparent)] border border-[color-mix(in_oklab,var(--pixel-border)_50%,transparent)]">H</kbd> — Show help</div>
              <div><kbd className="px-1.5 py-0.5 bg-[color-mix(in_oklab,var(--pixel-accent)_20%,transparent)] border border-[color-mix(in_oklab,var(--pixel-border)_50%,transparent)]">1</kbd> — Education</div>
              <div><kbd className="px-1.5 py-0.5 bg-[color-mix(in_oklab,var(--pixel-accent)_20%,transparent)] border border-[color-mix(in_oklab,var(--pixel-border)_50%,transparent)]">2</kbd> — Publications</div>
              <div><kbd className="px-1.5 py-0.5 bg-[color-mix(in_oklab,var(--pixel-accent)_20%,transparent)] border border-[color-mix(in_oklab,var(--pixel-border)_50%,transparent)]">3</kbd> — Skills</div>
              <div><kbd className="px-1.5 py-0.5 bg-[color-mix(in_oklab,var(--pixel-accent)_20%,transparent)] border border-[color-mix(in_oklab,var(--pixel-border)_50%,transparent)]">0</kbd> — Top</div>
              <div><kbd className="px-1.5 py-0.5 bg-[color-mix(in_oklab,var(--pixel-accent)_20%,transparent)] border border-[color-mix(in_oklab,var(--pixel-border)_50%,transparent)]">B</kbd> — Cycle background speed</div>
              <div><kbd className="px-1.5 py-0.5 bg-[color-mix(in_oklab,var(--pixel-accent)_20%,transparent)] border border-[color-mix(in_oklab,var(--pixel-border)_50%,transparent)]">ESC</kbd> — Close</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[200] px-3 py-1.5 border border-[var(--pixel-border)] bg-[color-mix(in_oklab,var(--pixel-bg)_92%,black_8%)] font-[family-name:var(--font-jetbrains)] text-xs text-[var(--pixel-accent)] rounded-lg"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
