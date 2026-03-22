"use client";

import { useState, useRef } from "react";
import {
  motion,
  useTransform,
  useMotionValueEvent,
  useScroll,
} from "framer-motion";
import { ArrowUp } from "lucide-react";
import { useIsMobileContext } from "./IsMobileContext";

export default function BackToTop() {
  const isMobile = useIsMobileContext();
  const { scrollY } = useScroll();
  const [show, setShow] = useState(false);
  const showRef = useRef(false);

  useMotionValueEvent(scrollY, "change", (v) => {
    const next = v > 300;
    if (next !== showRef.current) {
      showRef.current = next;
      setShow(next);
    }
  });

  const opacity = useTransform(scrollY, [200, 400], [0, 1]);
  const scale = useTransform(scrollY, [200, 400], [0.8, 1]);

  if (isMobile) return null;

  return (
    <motion.button
      style={{ opacity, scale, pointerEvents: show ? "auto" : "none" }}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      whileHover={{ scale: 1.1, boxShadow: "0 8px 32px var(--pixel-glow)" }}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-16 right-4 sm:bottom-20 sm:right-8 z-50 min-h-[44px] min-w-[44px] flex items-center justify-center p-3 rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] backdrop-blur-xl text-[var(--pixel-accent)] shadow-lg touch-manipulation"
    >
      <ArrowUp size={20} />
    </motion.button>
  );
}
