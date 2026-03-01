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
      className="fixed bottom-8 right-8 z-50 p-3 border-2 border-[#00ff88] bg-[#0a0a0b] text-[#00ff88] font-[family-name:var(--font-press-start)] text-[10px]"
    >
      <ArrowUp size={20} />
    </motion.button>
  );
}
