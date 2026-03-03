"use client";

import React from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { useIsMobile } from "../hooks/useIsMobile";

type DraggableFloatProps = React.ComponentProps<typeof motion.div>;

const SCROLL_SPRING = { stiffness: 280, damping: 32 };
const LAG_STRENGTH = 0.12;

export default function DraggableFloat({
  children,
  className = "",
  style,
  whileHover,
  whileTap,
  ...rest
}: DraggableFloatProps) {
  const isMobile = useIsMobile();
  const { scrollY, scrollX } = useScroll();
  const smoothY = useSpring(scrollY, SCROLL_SPRING);
  const smoothX = useSpring(scrollX, SCROLL_SPRING);
  const lagY = useTransform(
    [scrollY, smoothY],
    ([sy, ssy]) => ((sy as number) - (ssy as number)) * LAG_STRENGTH
  );
  const lagX = useTransform(
    [scrollX, smoothX],
    ([sx, ssx]) => ((sx as number) - (ssx as number)) * LAG_STRENGTH
  );

  const inner = (
    <motion.div
      drag={!isMobile}
      dragSnapToOrigin={!isMobile}
      dragElastic={0.2}
      dragMomentum={0.1}
      dragTransition={{ bounceStiffness: 600, bounceDamping: 25 }}
      whileHover={whileHover ?? { scale: 1.02 }}
      whileTap={whileTap ?? { scale: 0.98 }}
      style={style}
      className={
        isMobile
          ? `will-change-transform ${className}`
          : `cursor-grab active:cursor-grabbing will-change-transform ${className}`
      }
      {...rest}
    >
      {children}
    </motion.div>
  );

  if (isMobile) {
    return inner;
  }

  return (
    <motion.div style={{ x: lagX, y: lagY }} className="will-change-transform">
      {inner}
    </motion.div>
  );
}

