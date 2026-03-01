"use client";

import React from "react";
import { motion, useTransform } from "framer-motion";
import { useMouse } from "./MouseProvider";

function PixelDot({
  x,
  y,
  size,
  depth,
  reverse,
}: {
  x: string;
  y: string;
  size: number;
  depth: number;
  reverse?: boolean;
}) {
  const { smoothX, smoothY } = useMouse();
  const mult = reverse ? -1 : 1;
  const moveX = useTransform(smoothX, [-1, 1], [-depth * mult, depth * mult]);
  const moveY = useTransform(smoothY, [-1, 1], [-depth * mult, depth * mult]);

  return (
    <motion.div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        x: moveX,
        y: moveY,
      }}
      className="bg-[#00ff88] opacity-20 pointer-events-none"
    />
  );
}

function PixelGrid({ depth }: { depth: number }) {
  const { smoothX, smoothY } = useMouse();
  const moveX = useTransform(smoothX, [-1, 1], [-depth, depth]);
  const moveY = useTransform(smoothY, [-1, 1], [-depth, depth]);

  return (
    <motion.div
      style={{ x: moveX, y: moveY }}
      className="absolute inset-0 pointer-events-none"
    >
      <div
        className="w-full h-full opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(#00ff88 1px, transparent 1px),
            linear-gradient(90deg, #00ff88 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
        }}
      />
    </motion.div>
  );
}

function SecondaryGrid() {
  const { smoothX, smoothY } = useMouse();
  const moveX = useTransform(smoothX, [-1, 1], [8, -8]);
  const moveY = useTransform(smoothY, [-1, 1], [8, -8]);

  return (
    <motion.div
      style={{ x: moveX, y: moveY }}
      className="absolute inset-0 pointer-events-none"
    >
      <div
        className="w-full h-full opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(#00d4ff 1px, transparent 1px),
            linear-gradient(90deg, #00d4ff 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
        }}
      />
    </motion.div>
  );
}

function CornerBracket({
  x,
  y,
  d,
  r,
  char,
}: {
  x: string;
  y: string;
  d: number;
  r: boolean;
  char: string;
}) {
  const { smoothX, smoothY } = useMouse();
  const mult = r ? -1 : 1;
  const moveX = useTransform(smoothX, [-1, 1], [-d * mult, d * mult]);
  const moveY = useTransform(smoothY, [-1, 1], [-d * mult, d * mult]);

  return (
    <motion.span
      style={{
        position: "absolute",
        left: x,
        top: y,
        x: moveX,
        y: moveY,
      }}
      className="text-[#00ff88] opacity-20 font-[family-name:var(--font-press-start)] text-lg pointer-events-none"
    >
      {char}
    </motion.span>
  );
}

export default function MouseReactiveBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Primary pixel grid */}
      <PixelGrid depth={12} />

      {/* Secondary finer grid - opposite direction */}
      <SecondaryGrid />

      {/* Floating pixel dots */}
      {[
        { x: "8%", y: "12%", s: 4, d: 25, r: true },
        { x: "92%", y: "18%", s: 6, d: -30, r: false },
        { x: "5%", y: "75%", s: 5, d: 28, r: false },
        { x: "88%", y: "82%", s: 4, d: -22, r: true },
        { x: "50%", y: "8%", s: 3, d: 15, r: true },
        { x: "15%", y: "45%", s: 5, d: -20, r: false },
        { x: "85%", y: "55%", s: 4, d: 18, r: true },
        { x: "25%", y: "25%", s: 3, d: -12, r: true },
        { x: "75%", y: "35%", s: 5, d: 14, r: false },
        { x: "35%", y: "85%", s: 4, d: -16, r: true },
        { x: "65%", y: "70%", s: 3, d: 10, r: false },
      ].map((item, i) => (
        <PixelDot
          key={i}
          x={item.x}
          y={item.y}
          size={item.s}
          depth={item.d}
          reverse={item.r}
        />
      ))}

      {/* Corner brackets - ASCII style */}
      <CornerBracket x="2%" y="2%" d={8} r={false} char="[" />
      <CornerBracket x="96%" y="2%" d={-8} r={true} char="]" />
      <CornerBracket x="2%" y="96%" d={-8} r={true} char="[" />
      <CornerBracket x="96%" y="96%" d={8} r={false} char="]" />
    </div>
  );
}
