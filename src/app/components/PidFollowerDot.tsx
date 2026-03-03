"use client";

import React, { useEffect, useRef } from "react";
import { motion, useAnimationFrame, useMotionValue } from "framer-motion";

type PidParams = {
  kp: number;
  ki: number;
  kd: number;
};

function usePid(targetRef: React.MutableRefObject<number>, { kp, ki, kd }: PidParams) {
  const value = useMotionValue(0);
  const integralRef = useRef(0);
  const prevErrorRef = useRef(0);

  useAnimationFrame((_, delta) => {
    const dt = Math.max((delta || 16) / 1000, 1 / 120); // 秒，避免 0 和过大步长
    const current = value.get();
    const desired = targetRef.current;
    const error = desired - current;

    // 累积误差加一点衰减，并限制范围，避免积分暴走
    const integralUnclamped = (integralRef.current + error * dt) * 0.98;
    const integral = Math.max(-20, Math.min(20, integralUnclamped));
    const derivative = (error - prevErrorRef.current) / dt;

    const output = kp * error + ki * integral + kd * derivative;
    const nextUnclamped = current + output * dt;
    // 限制位置范围，防止一下子跑出视口，看起来像“消失”
    const maxOffset = 80;
    const next = Math.max(-maxOffset, Math.min(maxOffset, nextUnclamped));

    integralRef.current = integral;
    prevErrorRef.current = error;
    value.set(next);
  });

  return value;
}

export default function PidFollowerDot() {
  // 目标位置由 window mousemove 驱动，独立于其他组件
  const targetXRef = useRef(0);
  const targetYRef = useRef(0);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      const nx = (e.clientX / innerWidth) * 2 - 1; // [-1,1]
      const ny = (e.clientY / innerHeight) * 2 - 1;
      // 将归一化坐标映射到一个小范围的像素偏移
      targetXRef.current = nx * 50;
      targetYRef.current = ny * 30;
    };

    window.addEventListener("mousemove", handle);
    return () => window.removeEventListener("mousemove", handle);
  }, []);

  const x = usePid(targetXRef, { kp: 10, ki: 0.8, kd: 8 });
  const y = usePid(targetYRef, { kp: 10, ki: 0.8, kd: 8 });

  return (
    <motion.div
      style={{ x, y }}
      className="pointer-events-none fixed inset-0 z-[120] flex items-center justify-center"
    >
      <div className="w-4 h-4 rounded-full border border-[var(--pixel-accent)] bg-[color-mix(in_oklab,var(--pixel-accent)_40%,transparent)] shadow-[0_0_14px_color-mix(in_oklab,var(--pixel-accent)_90%,transparent)] opacity-95" />
    </motion.div>
  );
}



