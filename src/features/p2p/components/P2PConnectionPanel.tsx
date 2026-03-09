"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import CodeInput from "./CodeInput";
import {
  DEFAULT_CONNECT_TIMEOUT_MS,
  getPhaseLabel,
  type P2PErrorState,
  type P2PPhase,
} from "../lib/p2p";

interface P2PConnectionPanelProps {
  localPeerId: string;
  phase: P2PPhase;
  connectTimeoutMs?: number;
  error?: P2PErrorState | null;
  title?: string;
  description?: string[];
  onConnect: (peerId: string) => void;
  onRetry?: () => void;
  onClearError?: () => void;
  onReinitialize?: () => void;
}

const PHASE_BADGE_CLASS: Record<P2PPhase, string> = {
  initializing: "border-[var(--pixel-border)] text-[var(--pixel-muted)]",
  ready: "border-[var(--pixel-accent)] text-[var(--pixel-accent)]",
  connecting: "border-[var(--pixel-accent-2)] text-[var(--pixel-accent-2)]",
  connected: "border-[var(--pixel-accent)] text-[var(--pixel-accent)]",
  disconnected: "border-[var(--pixel-warn)] text-[var(--pixel-warn)]",
  error: "border-[var(--pixel-warn)] text-[var(--pixel-warn)]",
};

export default function P2PConnectionPanel({
  localPeerId,
  phase,
  connectTimeoutMs,
  error = null,
  title = "P2P_CONNECTION",
  description = [
    "> Share your local peer code with a second device or another player.",
    "> Enter the remote peer code to create a direct browser-to-browser session.",
    "> This same panel can be reused for chat, co-op mini-games, whiteboards, and more.",
  ],
  onConnect,
  onRetry,
  onClearError,
  onReinitialize,
}: P2PConnectionPanelProps) {
  const [copySuccess, setCopySuccess] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);

  const effectiveTimeoutMs = connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
  const progressDurationSec = Math.max(0.1, effectiveTimeoutMs / 1000);

  useEffect(() => {
    if (!error) return;
    setResetSignal((value) => value + 1);
  }, [error?.code, error?.message]);

  const codeInputStatus = useMemo(() => {
    if (phase === "connecting") return "connecting";
    if (phase === "error" || phase === "disconnected") return "error";
    return "idle";
  }, [phase]);

  const handleCopy = async () => {
    if (!localPeerId) return;

    try {
      await navigator.clipboard.writeText(localPeerId);
      setCopySuccess(true);
      window.setTimeout(() => setCopySuccess(false), 1500);
    } catch {
      setCopySuccess(false);
    }
  };

  const handleConnect = (peerId: string) => {
    onClearError?.();
    onConnect(peerId);
  };

  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-3xl overflow-hidden border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] shadow-[0_0_32px_var(--pixel-glow)] backdrop-blur-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b-2 border-[var(--pixel-border)] bg-[var(--pixel-bg-alt)] px-4 py-3 md:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 bg-[var(--pixel-warn)]" />
              <div className="h-3 w-3 bg-[var(--pixel-accent-2)]" />
              <div className="h-3 w-3 bg-[var(--pixel-accent)]" />
            </div>
            <span className="truncate font-[family-name:var(--font-press-start)] text-[8px] tracking-widest text-[var(--pixel-accent)] md:text-[10px]">
              {title}
            </span>
          </div>

          <div
            className={`border px-2 py-1 font-[family-name:var(--font-press-start)] text-[7px] tracking-widest md:text-[8px] ${PHASE_BADGE_CLASS[phase]}`}
          >
            {getPhaseLabel(phase)}
          </div>
        </div>

        <div className="grid gap-6 p-5 md:grid-cols-[1.2fr_1fr] md:p-7">
          <div className="space-y-5">
            <div>
              <label className="mb-2 block font-[family-name:var(--font-press-start)] text-[8px] tracking-wider text-[var(--pixel-accent)] md:text-[10px]">
                [ YOUR_PEER_ID ]
              </label>

              <div className="flex gap-2">
                <input
                  readOnly
                  value={localPeerId}
                  placeholder={phase === "initializing" ? "Generating peer ID..." : "Unavailable"}
                  className="h-12 flex-1 border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-4 font-[family-name:var(--font-jetbrains)] text-sm text-[var(--pixel-accent)] focus:outline-none md:text-base"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!localPeerId}
                  className={`min-w-[80px] border-2 px-3 font-[family-name:var(--font-press-start)] text-[8px] tracking-wider transition-transform duration-150 md:text-[9px] ${
                    localPeerId
                      ? "border-[var(--pixel-accent)] bg-[var(--pixel-accent)] text-[var(--pixel-bg)] hover:scale-[1.03]"
                      : "cursor-not-allowed border-[var(--pixel-border)] bg-[var(--pixel-border)] text-[var(--pixel-bg)] opacity-60"
                  }`}
                >
                  {copySuccess ? "COPIED" : "COPY"}
                </button>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {onReinitialize && (
                  <button
                    type="button"
                    onClick={onReinitialize}
                    className="border border-[var(--pixel-border)] px-2 py-1 font-[family-name:var(--font-press-start)] text-[7px] tracking-wider text-[var(--pixel-muted)] transition-colors hover:border-[var(--pixel-accent-2)] hover:text-[var(--pixel-accent-2)] md:text-[8px]"
                  >
                    RECREATE ID
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-none border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)]/50 p-4">
              <CodeInput
                length={6}
                label="CONNECT_TO_PEER"
                disabled={phase === "initializing" || phase === "connecting" || !localPeerId}
                status={codeInputStatus}
                resetSignal={resetSignal}
                onComplete={handleConnect}
              />
            </div>

            <AnimatePresence mode="wait">
              {phase === "connecting" && (
                <motion.div
                  key="connecting"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="border-2 border-[var(--pixel-accent-2)] bg-[color-mix(in_oklab,var(--pixel-accent-2)_10%,transparent)] p-4"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="h-4 w-4 rounded-full border-2 border-[var(--pixel-accent-2)] border-t-transparent"
                    />
                    <div>
                      <p className="font-[family-name:var(--font-press-start)] text-[8px] tracking-wider text-[var(--pixel-accent-2)] md:text-[10px]">
                        [ HANDSHAKE_IN_PROGRESS ]
                      </p>
                      <p className="mt-1 font-[family-name:var(--font-jetbrains)] text-xs text-[var(--pixel-text)]">
                        Establishing a direct channel. The code input stays locked until this attempt succeeds or fails.
                      </p>
                    </div>
                  </div>

                  <motion.div
                    key={`connect-progress-${resetSignal}-${effectiveTimeoutMs}`}
                    initial={{ scaleX: 0, opacity: 0.6 }}
                    animate={{ scaleX: 1, opacity: 1 }}
                    transition={{ duration: progressDurationSec, ease: "linear" }}
                    className="h-1 origin-left bg-[var(--pixel-accent-2)]"
                  />
                </motion.div>
              )}

              {(phase === "error" || phase === "disconnected") && error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  className="border-2 border-[var(--pixel-warn)] bg-[color-mix(in_oklab,var(--pixel-warn)_10%,transparent)] p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="pt-0.5 font-[family-name:var(--font-press-start)] text-xs text-[var(--pixel-warn)]">
                      ⚠
                    </div>
                    <div className="flex-1">
                      <p className="font-[family-name:var(--font-press-start)] text-[8px] tracking-wider text-[var(--pixel-warn)] md:text-[10px]">
                        [ {error.title} ]
                      </p>
                      <p className="mt-1 font-[family-name:var(--font-jetbrains)] text-xs text-[var(--pixel-text)] md:text-sm">
                        {error.message}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {onRetry && error.recoverable && (
                          <button
                            type="button"
                            onClick={() => {
                              onClearError?.();
                              onRetry();
                            }}
                            className="border-2 border-[var(--pixel-warn)] px-3 py-2 font-[family-name:var(--font-press-start)] text-[8px] tracking-wider text-[var(--pixel-warn)] transition-colors hover:bg-[var(--pixel-warn)] hover:text-[var(--pixel-bg)]"
                          >
                            RETRY
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={onClearError}
                          className="border border-[var(--pixel-border)] px-3 py-2 font-[family-name:var(--font-press-start)] text-[8px] tracking-wider text-[var(--pixel-muted)] transition-colors hover:border-[var(--pixel-accent)] hover:text-[var(--pixel-accent)]"
                        >
                          CLEAR
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {phase === "initializing" && (
                <motion.div
                  key="initializing"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="border border-[var(--pixel-border)] px-4 py-3 font-[family-name:var(--font-jetbrains)] text-xs text-[var(--pixel-muted)]"
                >
                  &gt; Creating your local peer session...
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-4 border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)]/40 p-4">
            <div>
              <p className="font-[family-name:var(--font-press-start)] text-[8px] tracking-wider text-[var(--pixel-accent)] md:text-[10px]">
                [ STATUS ]
              </p>
              <p className="mt-2 font-[family-name:var(--font-jetbrains)] text-sm text-[var(--pixel-text)]">
                {phase === "ready" && "Your local peer is ready. You can share the code or enter another code now."}
                {phase === "connecting" && "A connection attempt is active. The panel is intentionally locked to avoid duplicated handshakes."}
                {phase === "connected" && "The direct connection is live. This panel can now be swapped out for any game or collaborative view."}
                {phase === "initializing" && "The local peer is still being prepared."}
                {(phase === "error" || phase === "disconnected") && "The previous attempt ended. You can retry immediately without refreshing the page."}
              </p>
            </div>

            <div>
              <p className="font-[family-name:var(--font-press-start)] text-[8px] tracking-wider text-[var(--pixel-accent)] md:text-[10px]">
                [ NOTES ]
              </p>
              <div className="mt-3 space-y-2 font-[family-name:var(--font-jetbrains)] text-xs text-[var(--pixel-muted)] md:text-sm">
                {description.map((line, index) => (
                  <motion.p
                    key={`${index}-${line}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.06 }}
                  >
                    {line}
                  </motion.p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
