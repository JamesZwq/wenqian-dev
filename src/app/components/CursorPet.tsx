"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useAnimationFrame, useMotionValue } from "framer-motion";

export default function CursorPet() {
  const [mounted, setMounted] = useState(false);

  // 只在客户端挂载完成后再渲染，避免 SSR 与客户端初始 transform 不一致导致的 hydration 报错
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <CursorPetInner />;
}

function CursorPetInner() {
  // 目标位置由 window mousemove 驱动
  const targetXRef = useRef(0);
  const targetYRef = useRef(0);
  const lastMoveTimeRef = useRef<number>(typeof performance !== "undefined" ? performance.now() : 0);
  const isTouchRef = useRef(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      isTouchRef.current = window.matchMedia("(pointer: coarse)").matches;
    }

    // 首次加载时强制关在监狱里
    try {
      window.localStorage.setItem("cursorPetEnabled", "false");
      setEnabled(false);
    } catch {
      setEnabled(false);
    }

    const handle = (e: MouseEvent) => {
      targetXRef.current = e.clientX;
      targetYRef.current = e.clientY;
      lastMoveTimeRef.current = performance.now();
    };

    const handleToggle = () => {
      try {
        const stored = window.localStorage.getItem("cursorPetEnabled");
        const next = stored === "false";
        setEnabled(next);
      } catch {
        setEnabled((prev) => !prev);
      }
    };

    window.addEventListener("mousemove", handle);
    window.addEventListener("cursor-pet-toggle", handleToggle as EventListener);
    return () => {
      window.removeEventListener("mousemove", handle);
      window.removeEventListener("cursor-pet-toggle", handleToggle as EventListener);
    };
  }, []);

  const x = useMotionValue(typeof window !== "undefined" ? window.innerWidth / 2 : 0);
  const y = useMotionValue(typeof window !== "undefined" ? window.innerHeight / 2 : 0);
  const bob = useMotionValue(0);

  useAnimationFrame((t, delta) => {
    const dt = Math.max((delta || 16) / 1000, 1 / 120);

    const curX = x.get();
    const curY = y.get();

    const idleSinceMove = (performance.now() - lastMoveTimeRef.current) / 1000;
    // 只要开关是开启的，且不是触摸设备，并且 2 秒内有鼠标移动，就跟随鼠标；
    // 否则就回到左下角自己漂浮
    const shouldFollowMouse =
      enabled && !isTouchRef.current && idleSinceMove <= 2; // 2 秒内有移动就跟随

    if (shouldFollowMouse) {
      // 跟随鼠标：简单缓动
      const followSpeed = 8;
      const tx = targetXRef.current;
      const ty = targetYRef.current;
      x.set(curX + (tx - curX) * followSpeed * dt);
      y.set(curY + (ty - curY) * followSpeed * dt);

      // 闲置时的“自己动一下”：做一个极小幅度的上下轻微摆动
      const idle = Math.min(Math.max(idleSinceMove - 1, 0) / 3, 1); // 鼠标停 1s 后慢慢开启，3s 后达到满强度
      const bobAmp = 3; // 最大摆动幅度（像素）
      const bobValue = Math.sin(t / 500) * bobAmp * idle;
      bob.set(bobValue);
    } else {
      // 没有鼠标或开关关闭：宠物缓慢靠近左下角“监狱”的中心位置，然后停住并做极小的“呼吸”
      const h = typeof window !== "undefined" ? window.innerHeight : 600;
      // page.tsx 中监狱是 fixed bottom-4 left-4，宽度 w-10 (≈40px)，高度 h-8 (≈32px)
      // left: 16px, top: h - 16 - 32 = h - 48，中心大约在 (16 + 20, (h - 48) + 16)
      const baseX = 50; // 监狱的水平中心
      const baseY = h - 32; // 监狱的垂直中心

      const settleSpeed = 4;
      const targetLX = baseX;
      const targetLY = baseY;

      x.set(curX + (targetLX - curX) * settleSpeed * dt);
      y.set(curY + (targetLY - curY) * settleSpeed * dt);

      const bobAmp = 1.5;
      const bobValue = Math.sin(t / 700) * bobAmp;
      bob.set(bobValue);
    }
  });

  return (
    <motion.div
      style={{ x, y, translateY: bob }}
      className="pointer-events-none fixed top-0 left-0 z-[120]"
    >
      {/* 像素风小宠物：一个小“胶囊”形状 + 耳朵 + 眼睛 */}
      <div className="relative -translate-x-1/2 -translate-y-1/2">
        <div className="relative w-6 h-5 rounded-[999px] bg-[color-mix(in_oklab,var(--pixel-accent)_75%,transparent)] shadow-[0_0_10px_color-mix(in_oklab,var(--pixel-accent)_80%,transparent)] border border-[color-mix(in_oklab,var(--pixel-accent)_90%,black)]">
          {/* 耳朵 */}
          <div className="absolute -top-[4px] left-1 w-2 h-2 rounded-t-[6px] bg-[color-mix(in_oklab,var(--pixel-accent)_85%,transparent)]" />
          <div className="absolute -top-[4px] right-1 w-2 h-2 rounded-t-[6px] bg-[color-mix(in_oklab,var(--pixel-accent)_85%,transparent)]" />
          {/* 眼睛 */}
          <div className="absolute inset-0 flex items-center justify-center gap-[4px]">
            <div className="w-[3px] h-[3px] rounded-full bg-[var(--pixel-bg)]" />
            <div className="w-[3px] h-[3px] rounded-full bg-[var(--pixel-bg)]" />
          </div>
          {/* 小嘴巴 */}
          <div className="absolute inset-x-0 bottom-[4px] flex justify-center">
            <div className="w-3 h-[1px] rounded-full bg-[color-mix(in_oklab,var(--pixel-bg)_60%,transparent)]" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}


