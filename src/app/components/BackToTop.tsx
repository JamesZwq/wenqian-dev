"use client";

import { useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
} from "framer-motion";
import { ArrowUp } from "lucide-react";

export default function BackToTop() {
  const { scrollYProgress } = useScroll();
  const [show, setShow] = useState(false);
  useMotionValueEvent(scrollYProgress, "change", (v) => setShow(v > 0.2));

  const opacity = useTransform(scrollYProgress, [0.15, 0.25], [0, 1]);
  const scale = useTransform(scrollYProgress, [0.15, 0.25], [0.8, 1]);

  return (
    <motion.button
      style={{ opacity, scale, pointerEvents: show ? "auto" : "none" }}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      whileHover={{ scale: 1.1, boxShadow: "0 0 20px rgba(0,255,136,0.4)" }}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-6 right-4 sm:bottom-8 sm:right-8 z-50 min-h-[44px] min-w-[44px] flex items-center justify-center p-3 border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg-alt)] text-[var(--pixel-accent)] font-[family-name:var(--font-press-start)] text-[10px] touch-manipulation"
    >
      <ArrowUp size={20} />
    </motion.button>
  );
}
