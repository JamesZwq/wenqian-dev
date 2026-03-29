"use client";

import { motion } from "framer-motion";
import { MOVE_DURATION } from "../types";

export function AnimatedCircle({ x, y, radius, fill }: {
  x: number;
  y: number;
  radius: number;
  fill: string;
}) {
  return (
    <motion.circle
      cx={x}
      cy={y}
      r={radius}
      fill={fill}
      initial={false}
      animate={{ cx: x, cy: y }}
      transition={{ duration: MOVE_DURATION, ease: "linear" }}
    />
  );
}
