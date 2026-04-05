"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

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
  // Tick every second so "last signal" updates in real time
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`fixed bottom-3 left-3 right-3 z-40 w-auto max-w-[calc(100vw-24px)] rounded-2xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-3 backdrop-blur-xl md:bottom-4 md:left-auto md:right-4 md:w-[300px] ${className}`}
    >
      <div className="mb-2 font-sans font-semibold text-[11px] text-[var(--pixel-accent-2)]">
        P2P STATUS
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
  );
}
