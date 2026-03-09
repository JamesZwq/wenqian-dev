"use client";

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

function formatLastSeen(lastRemoteMessageAt?: number | null) {
  if (!lastRemoteMessageAt) return "no signal";
  const delta = Date.now() - lastRemoteMessageAt;
  if (delta < 1000) return "just now";
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`fixed bottom-3 left-3 right-3 z-40 w-auto max-w-[calc(100vw-24px)] border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-3 backdrop-blur-xl md:bottom-4 md:left-auto md:right-4 md:w-[300px] ${className}`}
    >
      <div className="mb-2 font-[family-name:var(--font-press-start)] text-[10px] text-[var(--pixel-accent-2)]">
        [ P2P STATUS ]
      </div>

      <div className="space-y-2 font-[family-name:var(--font-jetbrains)] text-xs text-[var(--pixel-text)]">
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
          <span>{formatLastSeen(lastRemoteMessageAt)}</span>
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
