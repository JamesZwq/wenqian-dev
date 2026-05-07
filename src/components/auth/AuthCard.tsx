"use client";
import { motion } from "framer-motion";
import { cardEntry } from "./animation-variants";

interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/** Centered pixel-themed card used by every (auth)/* page. */
export function AuthCard({ title, subtitle, children }: Props) {
  return (
    <motion.div
      variants={cardEntry}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="w-full max-w-md rounded-2xl border-2 p-6 md:p-8 shadow-xl"
      style={{
        background: "var(--pixel-card-bg)",
        borderColor: "var(--pixel-border)",
        boxShadow: "0 12px 40px var(--pixel-glow)",
      }}
    >
      <h1
        className="font-sans font-bold tracking-tight text-2xl md:text-3xl mb-1"
        style={{
          background: "linear-gradient(135deg, var(--pixel-accent), var(--pixel-accent-2))",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p className="font-mono text-xs md:text-sm mb-6" style={{ color: "var(--pixel-muted)" }}>
          {subtitle}
        </p>
      )}
      {children}
    </motion.div>
  );
}
