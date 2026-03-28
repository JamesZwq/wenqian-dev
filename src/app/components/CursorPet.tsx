"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useAnimationFrame, useMotionValue } from "framer-motion";

export default function CursorPet() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return <CursorPetInner />;
}

// 小屋: fixed bottom-4 left-4, SVG 56x44, 门在中间
// 雪宝回家时躺在门口位置 (小屋中心附近)
const BED_X_LIE = 16 + 28;  // 小屋水平中心
const BED_Y_LIE_OFFSET = 36; // 门的垂直位置

function CursorPetInner() {
  const targetXRef = useRef(0);
  const targetYRef = useRef(0);
  const lastMoveTimeRef = useRef<number>(performance.now());
  const isTouchRef = useRef(false);
  const [enabled, setEnabled] = useState(false);

  const enabledRef = useRef(enabled);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  const vxRef = useRef(0);
  const vyRef = useRef(0);
  const prevXRef = useRef(0);
  const prevYRef = useRef(0);

  useEffect(() => {
    isTouchRef.current = window.matchMedia("(pointer: coarse)").matches;
    try {
      const stored = window.localStorage.getItem("cursorPetEnabled");
      if (stored !== null) setEnabled(stored === "true");
      else {
        const def = !isTouchRef.current;
        window.localStorage.setItem("cursorPetEnabled", String(def));
        setEnabled(def);
      }
    } catch { setEnabled(!isTouchRef.current); }

    const handlePointer = (e: PointerEvent) => {
      if (e.pointerType === "touch") { isTouchRef.current = true; return; }
      isTouchRef.current = false;
      targetXRef.current = e.clientX;
      targetYRef.current = e.clientY;
      lastMoveTimeRef.current = performance.now();
    };

    const handleToggle = (ev: Event) => {
      const detail = (ev as CustomEvent).detail;
      let next: boolean | null = null;
      if (detail && typeof detail.enabled === "boolean") {
        next = detail.enabled;
        if (typeof detail.x === "number") { targetXRef.current = detail.x; targetYRef.current = detail.y; }
        if (detail.pointerType === "touch") isTouchRef.current = true;
        else if (detail.pointerType) isTouchRef.current = false;
      } else {
        try { const s = window.localStorage.getItem("cursorPetEnabled"); if (s !== null) next = s === "true"; } catch {}
      }
      if (next === null) { setEnabled(p => !p); lastMoveTimeRef.current = performance.now(); return; }
      setEnabled(next);
      if (next) lastMoveTimeRef.current = performance.now();
    };

    window.addEventListener("pointermove", handlePointer, { capture: true });
    window.addEventListener("pointerdown", handlePointer, { capture: true });
    window.addEventListener("cursor-pet-toggle", handleToggle as EventListener);
    return () => {
      window.removeEventListener("pointermove", handlePointer, { capture: true });
      window.removeEventListener("pointerdown", handlePointer, { capture: true });
      window.removeEventListener("cursor-pet-toggle", handleToggle as EventListener);
    };
  }, []);

  const x = useMotionValue(BED_X_LIE);
  const y = useMotionValue(window.innerHeight - BED_Y_LIE_OFFSET);
  const bob = useMotionValue(0);

  const eyeScale = useMotionValue(1); // 1 = open, 0.1 = closed
  const zIndex = useMotionValue(120); // 120 = above hut, 118 = behind hut

  // Limb swing
  const leftArmSwing = useMotionValue(0);
  const rightArmSwing = useMotionValue(0);
  const leftLegSwing = useMotionValue(0);
  const rightLegSwing = useMotionValue(0);
  const armPhaseRef = useRef(0);

  useAnimationFrame((t, delta) => {
    // Skip when tab is hidden
    if (document.hidden) return;
    const dt = Math.min(delta / 1000, 0.1);
    const curX = x.get();
    const curY = y.get();
    const idle = (performance.now() - lastMoveTimeRef.current) / 1000;
    const awake = enabledRef.current && !isTouchRef.current && idle <= 5;
    const h = window.innerHeight;

    let newX = curX, newY = curY;

    if (awake) {
      const f = 1 - Math.exp(-12 * dt);
      newX = curX + (targetXRef.current - curX) * f;
      newY = curY + (targetYRef.current - curY) * f;
      x.set(newX); y.set(newY);
      const idleBob = Math.min(Math.max(idle - 1, 0) / 3, 1);
      bob.set(Math.sin(t / 500) * 3 * idleBob);
      eyeScale.set(eyeScale.get() + (1 - eyeScale.get()) * 0.12);
      zIndex.set(120); // 在小屋前面
    } else {
      // 走回小屋（站着走，不躺下）
      const f = 1 - Math.exp(-5 * dt);
      newX = curX + (BED_X_LIE - curX) * f;
      newY = curY + (h - BED_Y_LIE_OFFSET - curY) * f;
      x.set(newX); y.set(newY);
      bob.set(0);
      eyeScale.set(eyeScale.get() + (0.1 - eyeScale.get()) * 0.06);
      zIndex.set(118); // 在小屋后面（被门挡住）
    }

    // Velocity
    const rawVx = (newX - prevXRef.current) / Math.max(dt, 0.001);
    const rawVy = (newY - prevYRef.current) / Math.max(dt, 0.001);
    prevXRef.current = newX; prevYRef.current = newY;
    vxRef.current += (rawVx - vxRef.current) * 0.15;
    vyRef.current += (rawVy - vyRef.current) * 0.15;
    const speed = Math.sqrt(vxRef.current ** 2 + vyRef.current ** 2);

    if (speed > 5 && awake) {
      armPhaseRef.current += dt * Math.min(speed * 0.02, 12);
      const sw = Math.sin(armPhaseRef.current);
      const amp = Math.min(speed * 0.06, 28);
      leftArmSwing.set(sw * amp);
      rightArmSwing.set(-sw * amp);
      leftLegSwing.set(-sw * amp * 0.7);
      rightLegSwing.set(sw * amp * 0.7);
    } else {
      const idle2 = awake ? Math.sin(t / 800) * 3 : 0;
      leftArmSwing.set(leftArmSwing.get() + (idle2 - leftArmSwing.get()) * 0.08);
      rightArmSwing.set(rightArmSwing.get() + (-idle2 - rightArmSwing.get()) * 0.08);
      leftLegSwing.set(leftLegSwing.get() * 0.92);
      rightLegSwing.set(rightLegSwing.get() * 0.92);
    }

    if (awake) {
      const drag = Math.max(-20, Math.min(20, -vxRef.current * 0.025));
      leftArmSwing.set(leftArmSwing.get() + drag * 0.3);
      rightArmSwing.set(rightArmSwing.get() + drag * 0.3);
    }
  });

  return (
    <motion.div
      style={{ x, y, zIndex }}
      className="pointer-events-none fixed top-0 left-0"
    >
      <motion.div
        style={{ y: bob }}
        className="relative -translate-x-1/2 -translate-y-1/2"
      >
        {/* ⛄ Olaf (雪宝) */}
        <svg width="32" height="44" viewBox="0 0 32 44" fill="none" style={{ overflow: "visible", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.12))" }}>
          <defs>
            <radialGradient id="ol-snow" cx="0.4" cy="0.3" r="0.7">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#e8eef5" />
            </radialGradient>
            <radialGradient id="ol-snow2" cx="0.45" cy="0.35" r="0.65">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#dde5f0" />
            </radialGradient>
          </defs>

          {/* ── 左脚 ── */}
          <motion.g style={{ rotate: leftLegSwing, transformOrigin: "12px 38px" }}>
            <ellipse cx="11" cy="42" rx="3.5" ry="1.8" fill="#8B6F50" stroke="#6d5438" strokeWidth="0.4" />
          </motion.g>
          {/* ── 右脚 ── */}
          <motion.g style={{ rotate: rightLegSwing, transformOrigin: "20px 38px" }}>
            <ellipse cx="21" cy="42" rx="3.5" ry="1.8" fill="#8B6F50" stroke="#6d5438" strokeWidth="0.4" />
          </motion.g>

          {/* ── 下身 (大雪球) ── */}
          <ellipse cx="16" cy="35" rx="10" ry="7.5" fill="url(#ol-snow2)" stroke="#c8d0da" strokeWidth="0.5" />

          {/* ── 纽扣 (煤球) ── */}
          <circle cx="16" cy="31" r="1.2" fill="#2a2a2a" />
          <circle cx="16" cy="34.5" r="1.2" fill="#2a2a2a" />
          <circle cx="16" cy="38" r="1" fill="#2a2a2a" />

          {/* ── 左臂 (树枝) ── */}
          <motion.g style={{ rotate: leftArmSwing, transformOrigin: "6px 28px" }}>
            <path d="M6 28 L0 22 M2.5 24 L1 21" stroke="#6d5438" strokeWidth="1.2" strokeLinecap="round" fill="none" />
          </motion.g>
          {/* ── 右臂 (树枝) ── */}
          <motion.g style={{ rotate: rightArmSwing, transformOrigin: "26px 28px" }}>
            <path d="M26 28 L32 22 M29.5 24 L31 21" stroke="#6d5438" strokeWidth="1.2" strokeLinecap="round" fill="none" />
          </motion.g>

          {/* ── 上身 (中雪球) ── */}
          <ellipse cx="16" cy="24" rx="8" ry="6.5" fill="url(#ol-snow)" stroke="#c8d0da" strokeWidth="0.5" />

          {/* ── 头 (小雪球) ── */}
          <ellipse cx="16" cy="12.5" rx="9.5" ry="9" fill="url(#ol-snow)" stroke="#c8d0da" strokeWidth="0.5" />

          {/* ── 头发 (三根树枝) ── */}
          <g>
            <path d="M16 3.5 L15 0 M14.5 1.5 L13 0.5" stroke="#6d5438" strokeWidth="1" strokeLinecap="round" fill="none" />
            <path d="M18 4 L19.5 1 M19 2 L21 1.5" stroke="#6d5438" strokeWidth="0.8" strokeLinecap="round" fill="none" />
            <path d="M14 4.5 L12 2" stroke="#6d5438" strokeWidth="0.7" strokeLinecap="round" fill="none" />
          </g>

          {/* ── 蝴蝶结 (头顶右侧) ── */}
          <g transform="translate(21, 5)">
            <ellipse cx="-2.8" cy="0" rx="3" ry="1.8" fill="#e53935" />
            <ellipse cx="2.8" cy="0" rx="3" ry="1.8" fill="#e53935" />
            <circle cx="0" cy="0" r="1.2" fill="#c62828" />
            {/* 飘带 */}
            <path d="M-1 1.2 Q-2 4 -3.5 5" stroke="#c62828" strokeWidth="0.6" fill="none" strokeLinecap="round" />
            <path d="M1 1.2 Q2 4 3.5 5" stroke="#c62828" strokeWidth="0.6" fill="none" strokeLinecap="round" />
          </g>

          {/* ── 眼睛 (煤球眼) ── */}
          <motion.g style={{ scaleY: eyeScale, transformOrigin: "16px 11px" }}>
            <circle cx="12.5" cy="11" r="1.8" fill="#1a1a1a" />
            <circle cx="19.5" cy="11" r="1.8" fill="#1a1a1a" />
            {/* 高光 */}
            <circle cx="12" cy="10.3" r="0.6" fill="white" opacity="0.9" />
            <circle cx="19" cy="10.3" r="0.6" fill="white" opacity="0.9" />
          </motion.g>

          {/* ── 眉毛 ── */}
          <path d="M10 8.5 Q12.5 7.5 14 8.5" fill="none" stroke="#5a4030" strokeWidth="0.6" strokeLinecap="round" />
          <path d="M18 8.5 Q19.5 7.5 22 8.5" fill="none" stroke="#5a4030" strokeWidth="0.6" strokeLinecap="round" />

          {/* ── 胡萝卜鼻子 ── */}
          <path d="M16 12.5 L21 13.5 L16 14.5 Z" fill="#FF8C00" stroke="#E07000" strokeWidth="0.3" strokeLinejoin="round" />

          {/* ── 嘴 (大大的傻笑) ── */}
          <path d="M11 16.5 Q13 19 16 19 Q19 19 21 16.5" fill="none" stroke="#4a3828" strokeWidth="0.8" strokeLinecap="round" />
          {/* 牙齿 */}
          <rect x="14.5" y="16.8" width="1.2" height="1.5" rx="0.3" fill="white" stroke="#ddd" strokeWidth="0.2" />
          <rect x="16.3" y="16.8" width="1.2" height="1.5" rx="0.3" fill="white" stroke="#ddd" strokeWidth="0.2" />
        </svg>
      </motion.div>
    </motion.div>
  );
}
