"use client";

import { useState, useRef } from "react";
import {
  motion,
  useTransform,
  useMotionValueEvent,
  useScroll,
} from "framer-motion";
import { ArrowUp } from "lucide-react";

export default function BackToTop() {
  // 核心修改 1：直接获取页面的绝对滚动像素 (scrollY)，摒弃百分比
  const { scrollY } = useScroll();
  const [show, setShow] = useState(false);
  const showRef = useRef(false);

  useMotionValueEvent(scrollY, "change", (v) => {
    // 向下滚动超过 300px 时，才允许鼠标点击交互
    const next = v > 300;
    if (next !== showRef.current) {
      showRef.current = next;
      setShow(next);
    }
  });

  // 核心修改 2：使用绝对像素映射区间
  // 当滚动距离在 0 ~ 200px 之间时，opacity 为 0（完全消失/最浅）
  // 当滚动距离在 200 ~ 400px 之间时，逐渐显现
  // 当滚动距离 > 400px 后，opacity 永远锁定在 1（完全实心/最深）
  const opacity = useTransform(scrollY, [200, 400], [0, 1]);
  const scale = useTransform(scrollY, [200, 400], [0.8, 1]);

  return (
    <motion.button
      style={{ opacity, scale, pointerEvents: show ? "auto" : "none" }}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      whileHover={{ scale: 1.1, boxShadow: "0 0 20px rgba(0,255,136,0.4)" }}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-16 right-4 sm:bottom-20 sm:right-8 z-50 min-h-[44px] min-w-[44px] flex items-center justify-center p-3 border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] backdrop-blur-xl text-[var(--pixel-accent)] font-[family-name:var(--font-press-start)] text-[10px] touch-manipulation"
    >
      <ArrowUp size={20} />
    </motion.button>
  );
}