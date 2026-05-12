"use client";

import React from "react";
import { motion } from "framer-motion";
import { useIsMobileContext, useIsTouchLikeContext } from "./IsMobileContext";
import { useScrollLag } from "./ScrollLagContext";

type DraggableFloatProps = React.ComponentProps<typeof motion.div>;

export default function DraggableFloat({
  children,
  className = "",
  style,
  whileHover,
  whileTap,
  initial,
  animate,
  whileInView,
  variants,
  transition,
  viewport,
  ...rest
}: DraggableFloatProps) {
  const isMobile = useIsMobileContext();
  const isTouchLike = useIsTouchLikeContext();
  const scrollLag = useScrollLag();
  const canUseFinePointerMotion = !isMobile && !isTouchLike;

  const inner = (
    <motion.div
      drag={canUseFinePointerMotion}
      dragSnapToOrigin={canUseFinePointerMotion}
      dragElastic={0.2}
      dragTransition={{ bounceStiffness: 600, bounceDamping: 25 }}
      whileHover={canUseFinePointerMotion ? whileHover ?? { scale: 1.02 } : undefined}
      whileTap={canUseFinePointerMotion ? whileTap ?? { scale: 0.98 } : undefined}
      initial={canUseFinePointerMotion ? initial : undefined}
      animate={canUseFinePointerMotion ? animate : undefined}
      whileInView={canUseFinePointerMotion ? whileInView : undefined}
      variants={canUseFinePointerMotion ? variants : undefined}
      transition={canUseFinePointerMotion ? transition : undefined}
      viewport={canUseFinePointerMotion ? viewport : undefined}
      style={style}
      className={
        canUseFinePointerMotion
          ? `cursor-grab active:cursor-grabbing will-change-transform ${className}`
          : className
      }
      {...rest}
    >
      {children}
    </motion.div>
  );

  if (!canUseFinePointerMotion) {
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
