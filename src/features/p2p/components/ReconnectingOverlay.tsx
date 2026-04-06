"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface ReconnectingOverlayProps {
  deadline: number; // epoch ms
}

export function ReconnectingOverlay({ deadline }: ReconnectingOverlayProps) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
  );

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mx-4 max-w-sm rounded-2xl border border-[var(--pixel-warn)] bg-[var(--pixel-card-bg)] p-6 shadow-xl backdrop-blur-xl"
      >
        <div className="flex items-center gap-3 mb-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            className="h-5 w-5 rounded-full border-2 border-[var(--pixel-warn)] border-t-transparent"
          />
          <p className="font-sans font-semibold text-sm tracking-tight text-[var(--pixel-warn)]">
            CONNECTION LOST
          </p>
        </div>

        <p className="font-mono text-sm text-[var(--pixel-text)] mb-3">
          Waiting for reconnection...
        </p>

        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-[var(--pixel-muted)]">
            Time remaining
          </span>
          <span className="font-mono text-lg font-bold text-[var(--pixel-warn)]">
            {mins}:{secs.toString().padStart(2, "0")}
          </span>
        </div>

        <div className="mt-3 h-1.5 rounded-full bg-[var(--pixel-border)] overflow-hidden">
          <motion.div
            className="h-full bg-[var(--pixel-warn)] origin-left"
            style={{ width: `${(remaining / 180) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
