"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function PixelKeyboardHandler() {
  const [key, setKey] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "?" || e.key === "h" || e.key === "H") {
        setKey("HELP");
        setTimeout(() => setKey(null), 3000);
      }
      if (e.key === "Escape") {
        setKey(null);
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
            <div><kbd className="px-1.5 py-0.5 bg-[color-mix(in_oklab,var(--pixel-accent)_20%,transparent)] border border-[color-mix(in_oklab,var(--pixel-border)_50%,transparent)]">ESC</kbd> — Close</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
