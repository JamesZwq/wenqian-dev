"use client";

import React from "react";
import { motion } from "framer-motion";
import { useIsMobileContext } from "./IsMobileContext";
import { useScrollLag } from "./ScrollLagContext";

type DraggableFloatProps = React.ComponentProps<typeof motion.div>;

export default function DraggableFloat({
  children,
  className = "",
  style,
  whileHover,
  whileTap,
  ...rest
}: DraggableFloatProps) {
  const isMobile = useIsMobileContext();
  const scrollLag = useScrollLag();

  const inner = (
    <motion.div
      drag={!isMobile}
      dragSnapToOrigin={!isMobile}
      dragElastic={0.2}
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

  if (scrollLag) {
    return (
      <motion.div
        style={{ x: scrollLag.lagX, y: scrollLag.lagY }}
        className="will-change-transform"
      >
        {inner}
      </motion.div>
    );
  }

  return inner;
}

