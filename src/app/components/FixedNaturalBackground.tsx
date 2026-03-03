"use client";

import React from "react";
import { motion, useTransform } from "framer-motion";
import { useMouse } from "./MouseProvider";

/**
 * 固定全屏自然风格背景，5+ 图层，滚动时背景不移动。
 * 同时根据鼠标位置产生轻微视差和光晕偏移，让背景更“灵动”。
 * 只有液态玻璃卡片随页面滚动。
 */
export default function FixedNaturalBackground() {
  const { smoothX, smoothY } = useMouse();

  // 不同深度的视差系数（远处移动更小，近处更明显）
  const skyX = useTransform(smoothX, [-1, 1], [18, -18]);
  const skyY = useTransform(smoothY, [-1, 1], [10, -6]);

  const farHillX = useTransform(smoothX, [-1, 1], [14, -14]);
  const farHillY = useTransform(smoothY, [-1, 1], [8, -4]);

  const midHillX = useTransform(smoothX, [-1, 1], [20, -20]);
  const midHillY = useTransform(smoothY, [-1, 1], [10, -6]);

  const treesX = useTransform(smoothX, [-1, 1], [26, -26]);
  const treesY = useTransform(smoothY, [-1, 1], [12, -8]);

  const grassX = useTransform(smoothX, [-1, 1], [32, -32]);
  const grassY = useTransform(smoothY, [-1, 1], [16, -10]);

  // 光晕 / 高光随鼠标缓慢偏移，营造“追随光线”的感觉
  const haloMainX = useTransform(smoothX, [-1, 1], [-40, 40]);
  const haloMainY = useTransform(smoothY, [-1, 1], [-24, 24]);

  const haloSoftX = useTransform(smoothX, [-1, 1], [30, -30]);
  const haloSoftY = useTransform(smoothY, [-1, 1], [-18, 18]);

  // 一层额外的柔和光斑，接近鼠标移动轨迹
  const cursorGlowX = useTransform(smoothX, [-1, 1], [-80, 80]);
  const cursorGlowY = useTransform(smoothY, [-1, 1], [-40, 40]);

  return (
    <div
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
      aria-hidden
    >
      {/* Layer 1: 天空渐变（最远，位移最小） */}
      <motion.div
        className="absolute inset-0"
        style={{
          x: skyX,
          y: skyY,
          background:
            "linear-gradient(180deg, #e8f4ff 0%, #f0f9ff 25%, #fefce8 55%, #f0fdf4 85%, #dcfce7 100%)",
        }}
      />

      {/* Layer 2: 远处山峦 */}
      <motion.div
        className="absolute inset-0 flex items-end"
        style={{ x: farHillX, y: farHillY }}
      >
        <svg
          viewBox="0 0 1200 400"
          className="w-full h-[70%]"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="hill1" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#c5f3d4" />
              <stop offset="100%" stopColor="#86efac" />
            </linearGradient>
          </defs>
          <path
            d="M-10 400 L-10 280 Q80 220 200 260 Q350 200 500 240 Q650 180 800 220 Q950 200 1100 250 L1210 250 L1210 400 Z"
            fill="url(#hill1)"
            opacity={0.9}
          />
        </svg>
      </motion.div>

      {/* Layer 3: 中景山丘 */}
      <motion.div
        className="absolute inset-0 flex items-end"
        style={{ x: midHillX, y: midHillY }}
      >
        <svg
          viewBox="0 0 1200 400"
          className="w-full h-[65%]"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="hill2" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#a7f3d0" />
              <stop offset="100%" stopColor="#6ee7b7" />
            </linearGradient>
          </defs>
          <path
            d="M-10 400 L-10 300 Q100 250 250 290 Q400 240 550 280 Q700 230 850 270 Q1000 250 1150 290 L1210 290 L1210 400 Z"
            fill="url(#hill2)"
            opacity={0.9}
          />
        </svg>
      </motion.div>

      {/* Layer 4: 树林剪影 */}
      <motion.div
        className="absolute inset-0 flex items-end"
        style={{ x: treesX, y: treesY }}
      >
        <svg
          viewBox="0 0 1200 400"
          className="w-full h-[70%]"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="trees" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#166534" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#14532d" stopOpacity={0.7} />
            </linearGradient>
          </defs>
          <path
            d="M0 400 L0 320 L50 320 L50 280 L80 280 L80 240 L120 240 L120 200 L160 200 L160 260 L200 260 L200 220 L240 220 L240 280 L280 280 L280 320 L320 320 L320 260 L360 260 L360 220 L400 220 L400 280 L440 280 L440 240 L480 240 L480 300 L520 300 L520 260 L560 260 L560 220 L600 220 L600 280 L640 280 L640 320 L680 320 L680 260 L720 260 L720 220 L760 220 L760 280 L800 280 L800 240 L840 240 L840 300 L880 300 L880 260 L920 260 L920 220 L960 220 L960 280 L1000 280 L1000 320 L1040 320 L1040 260 L1080 260 L1080 300 L1120 300 L1120 320 L1200 320 L1200 400 Z"
            fill="url(#trees)"
          />
        </svg>
      </motion.div>

      {/* Layer 5: 近处草地（前景位移稍大） */}
      <motion.div
        className="absolute inset-0 flex items-end"
        style={{ x: grassX, y: grassY }}
      >
        <svg
          viewBox="0 0 1200 200"
          className="w-full h-[45%]"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="grass" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#86efac" />
              <stop offset="100%" stopColor="#4ade80" />
            </linearGradient>
          </defs>
          <path
            d="M-10 200 L-10 100 Q100 80 250 90 Q400 70 550 85 Q700 75 850 88 Q1000 78 1150 92 L1210 95 L1210 200 Z"
            fill="url(#grass)"
            opacity={0.95}
          />
        </svg>
      </motion.div>

      {/* Layer 6: 光晕 & 光斑，轻微跟随鼠标 */}
      <motion.div
        className="absolute top-[8%] right-[15%] w-[35vw] h-[35vw] rounded-full opacity-25"
        style={{
          x: haloMainX,
          y: haloMainY,
          background: "radial-gradient(circle, #fef08a 0%, transparent 70%)",
        }}
      />
      <motion.div
        className="absolute top-[15%] left-[10%] w-[25vw] h-[25vw] rounded-full opacity-18"
        style={{
          x: haloSoftX,
          y: haloSoftY,
          background: "radial-gradient(circle, #fef9c3 0%, transparent 70%)",
        }}
      />
      <motion.div
        className="absolute top-1/3 left-1/2 w-[26vw] h-[26vw] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-18 mix-blend-screen"
        style={{
          x: cursorGlowX,
          y: cursorGlowY,
          background: "radial-gradient(circle, rgba(190,242,100,0.9) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}
