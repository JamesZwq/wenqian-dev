"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useAnimationFrame, useMotionValue } from "framer-motion";

export default function CursorPet() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <CursorPetInner />;
}

function CursorPetInner() {
  const targetXRef = useRef(0);
  const targetYRef = useRef(0);
  const lastMoveTimeRef = useRef<number>(typeof performance !== "undefined" ? performance.now() : 0);
  const isTouchRef = useRef(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      isTouchRef.current = window.matchMedia("(pointer: coarse)").matches;
    }

    try {
      const stored = window.localStorage.getItem("cursorPetEnabled");
      if (stored !== null) {
        setEnabled(stored === "true");
      } else {
        const defaultEnabled = !isTouchRef.current;
        window.localStorage.setItem("cursorPetEnabled", defaultEnabled ? "true" : "false");
        setEnabled(defaultEnabled);
      }
    } catch {
      setEnabled(!isTouchRef.current);
    }

    // 1. 使用 pointermove，并加入黑魔法 { capture: true } 强行拦截坐标
    const handlePointer = (e: PointerEvent) => {
      if (e.pointerType === "touch") {
        isTouchRef.current = true;
        return;
      }
      isTouchRef.current = false;
      targetXRef.current = e.clientX;
      targetYRef.current = e.clientY;
      lastMoveTimeRef.current = performance.now();
    };

    // 2. 双重保险：兜底的 mousemove，同样在捕获阶段拦截
    const handleMouse = (e: MouseEvent) => {
      if (isTouchRef.current) return;
      targetXRef.current = e.clientX;
      targetYRef.current = e.clientY;
      lastMoveTimeRef.current = performance.now();
    };

    const handleToggle = (ev: Event) => {
      // If PetJailToggle sent details, use them; otherwise fall back to localStorage.
      const anyEv = ev as any;
      const detail = anyEv?.detail;
      let next: boolean | null = null;

      if (detail && typeof detail.enabled === "boolean") {
        next = detail.enabled;

        // If a mouse pointer triggered the toggle, seed the target coords immediately.
        if (typeof detail.x === "number" && typeof detail.y === "number") {
          targetXRef.current = detail.x;
          targetYRef.current = detail.y;
        }

        // Touch toggle shouldn't immediately switch us into follow mode.
        if (detail.pointerType === "touch") {
          isTouchRef.current = true;
        } else if (detail.pointerType) {
          isTouchRef.current = false;
        }
      } else {
        try {
          const stored = window.localStorage.getItem("cursorPetEnabled");
          if (stored !== null) next = stored === "true";
        } catch {
          // ignore
        }
      }

      // Apply state (do NOT invert again — PetJailToggle already decided the next value)
      if (next === null) {
        setEnabled((prev) => !prev);
        lastMoveTimeRef.current = performance.now();
        return;
      }

      setEnabled(next);

      // Wake immediately on enable to avoid Safari "needs extra click" behavior
      if (next) {
        lastMoveTimeRef.current = performance.now();
      }
    };

    // { capture: true } 确保即使你点击的按钮阻止了事件冒泡或捕获了指针，
    // window 也能在事件下发前，以上帝视角截获最新的鼠标位置！
    window.addEventListener("pointermove", handlePointer, { capture: true });
    window.addEventListener("mousemove", handleMouse, { capture: true });
    window.addEventListener("pointerdown", handlePointer, { capture: true });
    window.addEventListener("mousedown", handleMouse, { capture: true });
    document.addEventListener("pointermove", handlePointer, { capture: true });
    document.addEventListener("mousemove", handleMouse, { capture: true });
    window.addEventListener("cursor-pet-toggle", handleToggle as EventListener);
    
    return () => {
      window.removeEventListener("pointermove", handlePointer, { capture: true });
      window.removeEventListener("mousemove", handleMouse, { capture: true });
      window.removeEventListener("pointerdown", handlePointer, { capture: true });
      window.removeEventListener("mousedown", handleMouse, { capture: true });
      document.removeEventListener("pointermove", handlePointer, { capture: true });
      document.removeEventListener("mousemove", handleMouse, { capture: true });
      window.removeEventListener("cursor-pet-toggle", handleToggle as EventListener);
    };
  }, []);

  const x = useMotionValue(50);
  const y = useMotionValue(600);
  const bob = useMotionValue(0);

  useAnimationFrame((t, delta) => {
    const dt = Math.min(delta / 1000, 0.1); 

    const curX = x.get();
    const curY = y.get();

    const idleSinceMove = (performance.now() - lastMoveTimeRef.current) / 1000;
    const shouldFollowMouse = enabled && !isTouchRef.current && idleSinceMove <= 5;

    if (shouldFollowMouse) {
      const followSpeed = 12; 
      const lerpFactor = 1 - Math.exp(-followSpeed * dt);

      const tx = targetXRef.current;
      const ty = targetYRef.current;
      
      x.set(curX + (tx - curX) * lerpFactor);
      y.set(curY + (ty - curY) * lerpFactor);

      const idle = Math.min(Math.max(idleSinceMove - 1, 0) / 3, 1);
      const bobAmp = 3; 
      bob.set(Math.sin(t / 500) * bobAmp * idle);
    } else {
      const h = typeof window !== "undefined" ? window.innerHeight : 600;
      const targetLX = 50; 
      const targetLY = h - 32;

      const settleSpeed = 5;
      const lerpFactor = 1 - Math.exp(-settleSpeed * dt);

      x.set(curX + (targetLX - curX) * lerpFactor);
      y.set(curY + (targetLY - curY) * lerpFactor);

      const bobAmp = 1.5;
      bob.set(Math.sin(t / 700) * bobAmp);
    }
  });

  return (
    <motion.div
      style={{ x, y }}
      className="pointer-events-none fixed top-0 left-0 z-[120]"
    >
      <motion.div 
        style={{ y: bob }}
        className="relative -translate-x-1/2 -translate-y-1/2"
      >
        <div className="relative w-6 h-5 rounded-[999px] bg-[color-mix(in_oklab,var(--pixel-accent)_75%,transparent)] shadow-[0_0_10px_color-mix(in_oklab,var(--pixel-accent)_80%,transparent)] border border-[color-mix(in_oklab,var(--pixel-accent)_90%,black)]">
          <div className="absolute -top-[4px] left-1 w-2 h-2 rounded-t-[6px] bg-[color-mix(in_oklab,var(--pixel-accent)_85%,transparent)]" />
          <div className="absolute -top-[4px] right-1 w-2 h-2 rounded-t-[6px] bg-[color-mix(in_oklab,var(--pixel-accent)_85%,transparent)]" />
          <div className="absolute inset-0 flex items-center justify-center gap-[4px]">
            <div className="w-[3px] h-[3px] rounded-full bg-[var(--pixel-bg)]" />
            <div className="w-[3px] h-[3px] rounded-full bg-[var(--pixel-bg)]" />
          </div>
          <div className="absolute inset-x-0 bottom-[4px] flex justify-center">
            <div className="w-3 h-[1px] rounded-full bg-[color-mix(in_oklab,var(--pixel-bg)_60%,transparent)]" />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}