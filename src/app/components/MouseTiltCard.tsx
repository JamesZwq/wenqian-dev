"use client";

import React, { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useMouse } from "./MouseProvider";

/**
 * 卡片随鼠标产生轻微 3D 倾斜，增强交互感
 */
export default function MouseTiltCard({
  children,
  className = "",
  intensity = 8,
}: {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { smoothX, smoothY } = useMouse();

  // 基于全局鼠标 + 卡片中心计算倾斜
  const rotateX = useTransform(smoothY, [-1, 1], [intensity, -intensity]);
  const rotateY = useTransform(smoothX, [-1, 1], [-intensity, intensity]);

  const springConfig = { damping: 25, stiffness: 150 };
  const springRotateX = useSpring(rotateX, springConfig);
  const springRotateY = useSpring(rotateY, springConfig);

  return (
    <motion.div
      ref={cardRef}
      style={{
        rotateX: springRotateX,
        rotateY: springRotateY,
        transformStyle: "preserve-3d",
        perspective: 1000,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
