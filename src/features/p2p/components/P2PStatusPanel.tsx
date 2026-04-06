"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

type P2PStatusPanelProps = {
  isConnected: boolean;
  phase?: string;
  role?: string;
  localPeerId?: string | null;
  remotePeerId?: string | null;
  latencyMs?: number | null;
  lastRemoteMessageAt?: number | null;
  className?: string;
};

function formatLastSeen(lastRemoteMessageAt: number | null | undefined, now: number) {
  if (!lastRemoteMessageAt) return "no signal";
  const delta = now - lastRemoteMessageAt;
  if (delta < 1500) return "just now";
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`;
  return `${Math.floor(delta / 60_000)}m ago`;
}

/* ── animation variants ── */
const springTransition = {
  type: "spring" as const,
  stiffness: 340,
  damping: 28,
  mass: 0.8,
};

const panelVariants = {
  expanded: {
    width: 300,
    height: "auto" as const,
    borderRadius: 16,
    opacity: 1,
    transition: springTransition,
  },
  minimized: {
    width: 44,
    height: 44,
    borderRadius: 22,
    opacity: 1,
    transition: springTransition,
  },
};

const contentVariants = {
  show: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: { delay: 0.12, duration: 0.22, ease: "easeOut" as const },
  },
  hide: {
    opacity: 0,
    scale: 0.92,
    filter: "blur(6px)",
    transition: { duration: 0.14, ease: "easeIn" as const },
  },
};

const dotVariants = {
  show: {
    opacity: 1,
    scale: 1,
    transition: { delay: 0.08, type: "spring" as const, stiffness: 500, damping: 25 },
  },
  hide: {
    opacity: 0,
    scale: 0.3,
    transition: { duration: 0.1 },
  },
};

export function P2PStatusPanel({
  isConnected,
  phase,
  role,
  localPeerId,
  remotePeerId,
  latencyMs,
  lastRemoteMessageAt,
  className = "",
}: P2PStatusPanelProps) {
  const [now, setNow] = useState(Date.now);
  const [minimized, setMinimized] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 768
  );

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const toggle = useCallback(() => setMinimized((v) => !v), []);

  return (
    <motion.div
      layout
      variants={panelVariants}
      initial="expanded"
      animate={minimized ? "minimized" : "expanded"}
      className={`fixed bottom-4 right-4 z-40 cursor-pointer overflow-hidden border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] backdrop-blur-xl shadow-lg ${className}`}
      onClick={minimized ? toggle : undefined}
      style={{ originX: 1, originY: 1 }}
    >
      <AnimatePresence mode="wait">
        {minimized ? (
          /* ── minimized: pulsing dot ── */
          <motion.div
            key="dot"
            variants={dotVariants}
            initial="hide"
            animate="show"
            exit="hide"
            className="flex items-center justify-center w-full h-full"
          >
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--pixel-accent)] opacity-40" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--pixel-accent)]" />
            </span>
          </motion.div>
        ) : (
          /* ── expanded: full panel ── */
          <motion.div
            key="content"
            variants={contentVariants}
            initial="hide"
            animate="show"
            exit="hide"
            className="p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-sans font-semibold text-[11px] text-[var(--pixel-accent-2)]">
                P2P STATUS
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggle(); }}
                className="flex items-center justify-center w-5 h-5 rounded-md hover:bg-[var(--pixel-border)] transition-colors"
                aria-label="Minimize"
              >
                <svg width="10" height="2" viewBox="0 0 10 2" fill="currentColor" className="text-[var(--pixel-muted)]">
                  <rect width="10" height="2" rx="1" />
                </svg>
              </button>
            </div>

            <div className="space-y-2 font-mono text-xs text-[var(--pixel-text)]">
              <div className="flex justify-between gap-3">
                <span className="text-[var(--pixel-muted)]">state</span>
                <span>{isConnected ? "connected" : phase || "idle"}</span>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-[var(--pixel-muted)]">role</span>
                <span>{role || "unknown"}</span>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-[var(--pixel-muted)]">latency</span>
                <span>{latencyMs != null ? `${latencyMs} ms` : "--"}</span>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-[var(--pixel-muted)]">last signal</span>
                <span>{formatLastSeen(lastRemoteMessageAt, now)}</span>
              </div>

              <div className="pt-1">
                <div className="mb-1 text-[10px] uppercase text-[var(--pixel-muted)]">
                  local peer
                </div>
                <div className="break-all text-[11px]">{localPeerId || "--"}</div>
              </div>

              <div className="pt-1">
                <div className="mb-1 text-[10px] uppercase text-[var(--pixel-muted)]">
                  remote peer
                </div>
                <div className="break-all text-[11px]">{remotePeerId || "--"}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
