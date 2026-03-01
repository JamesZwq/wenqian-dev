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
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-8 right-8 z-50 p-3 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-xl hover:shadow-2xl"
    >
      <ArrowUp size={24} className="text-zinc-700 dark:text-zinc-300" />
    </motion.button>
  );
}
