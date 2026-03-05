"use client";

import { useState, useRef } from "react";
import {
  motion,
  useTransform,
  useMotionValueEvent,
  useMotionValue,
} from "framer-motion";
import { ArrowUp } from "lucide-react";
import { useScrollLag } from "./ScrollLagContext";

export default function BackToTop() {
  const scrollLag = useScrollLag();
  const zeroProgress = useMotionValue(0);
  const scrollYProgress = scrollLag?.scrollYProgress ?? zeroProgress;
  const [show, setShow] = useState(false);
  const showRef = useRef(false);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const next = v > 0.2;
    if (next !== showRef.current) {
      showRef.current = next;
      setShow(next);
    }
  });

  const opacity = useTransform(scrollYProgress, [0.15, 0.25], [0, 1]);
  const scale = useTransform(scrollYProgress, [0.15, 0.25], [0.8, 1]);

  return (
    <motion.button
      style={{ opacity, scale, pointerEvents: show ? "auto" : "none" }}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      whileHover={{ scale: 1.1, boxShadow: "0 0 20px rgba(0,255,136,0.4)" }}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-6 right-4 sm:bottom-8 sm:right-8 z-50 min-h-[44px] min-w-[44px] flex items-center justify-center p-3 border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] backdrop-blur-xl text-[var(--pixel-accent)] font-[family-name:var(--font-press-start)] text-[10px] touch-manipulation"
    >
      <ArrowUp size={20} />
    </motion.button>
  );
}
