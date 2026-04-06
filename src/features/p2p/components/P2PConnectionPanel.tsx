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
  autoConnectPeerId?: string | null;
  roomCode?: string | null;
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
  reconnecting: "border-[var(--pixel-warn)] text-[var(--pixel-warn)]",
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
    "> Enter a room code to create or join a room.",
    "> Share the same code with a friend.",
    "> Direct browser-to-browser, no server required.",
  ],
  autoConnectPeerId,
  roomCode,
  onConnect,
  onRetry,
  onClearError,
  onReinitialize,
}: P2PConnectionPanelProps) {
  const [copySuccess, setCopySuccess] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [autoConnectRetries, setAutoConnectRetries] = useState(0);
  const MAX_AUTO_RETRIES = 3;

  const effectiveTimeoutMs = connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
  const progressDurationSec = Math.max(0.1, effectiveTimeoutMs / 1000);

  // Auto-connect when autoConnectPeerId is provided and phase is ready
  useEffect(() => {
    // Don't retry if we're already the host (roomCode set + phase ready = waiting for opponent)
    if (autoConnectPeerId && phase === "ready" && !roomCode && autoConnectRetries < MAX_AUTO_RETRIES) {
      const delay = autoConnectRetries === 0 ? 0 : 1000 * autoConnectRetries;
      const timer = setTimeout(() => {
        setAutoConnectRetries(prev => prev + 1);
        onConnect(autoConnectPeerId);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [autoConnectPeerId, phase, roomCode, autoConnectRetries, onConnect]);

  useEffect(() => {
    if (!error) return;
    setResetSignal((value) => value + 1);
  }, [error?.code, error?.message]);

  const codeInputStatus = useMemo(() => {
    if (phase === "connecting") return "connecting";
    if (phase === "error" || phase === "disconnected") return "error";
    return "idle";
  }, [phase]);

  const isWaitingForOpponent = !!roomCode && phase === "ready";

  const handleShareLink = async () => {
    const code = roomCode;
    if (!code) return;
    const url = new URL(window.location.href);
    url.searchParams.set("join", code);
    const shareUrl = url.toString();

    // Derive friendly game name from pathname: /poker → Poker, /halli-galli → Halli Galli
    const gameName = url.pathname
      .replace(/^\//, "")
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ") || "Game";

    const GAME_DESC: Record<string, string> = {
      poker: "Texas Hold'em Poker — P2P, no server, just us",
      gomoku: "Gomoku (Five in a Row) — classic board game",
      chat: "Private P2P Chat — end-to-end, no server",
      sudoku: "Sudoku Race — solve the same puzzle, see who's faster",
      math: "Math Sprint — race to solve mental math",
      maze: "Maze Race — navigate the maze before your opponent",
      "halli-galli": "Halli Galli — spot 5 matching fruits and ring the bell",
      "flash-count": "Flash Count — count the blocks before time runs out",
    };
    const slug = url.pathname.replace(/^\//, "");
    const gameDesc = GAME_DESC[slug] || gameName;

    const shareText = `Come play ${gameName} with me!\n${gameDesc}\n\nRoom code: ${code}\n${shareUrl}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: `Join ${gameName}`, text: `${gameDesc}\nRoom code: ${code}`, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareText);
      }
      setCopySuccess(true);
      window.setTimeout(() => setCopySuccess(false), 1500);
    } catch (e) {
      // User cancelled share dialog — not an error
      if (e instanceof DOMException && e.name === "AbortError") return;
      setCopySuccess(false);
    }
  };

  const handleConnect = (code: string) => {
    onClearError?.();
    onConnect(code);
  };

  return (
    <div className="flex w-full items-center justify-center px-2 md:min-h-[60vh] md:px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 26 }}
        className="w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-xl"
      >
        <div className="flex items-center justify-between gap-3 rounded-t-2xl border-b border-[var(--pixel-border)] bg-[var(--pixel-bg-alt)] px-4 py-3 md:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 bg-[var(--pixel-warn)]" />
              <div className="h-3 w-3 bg-[var(--pixel-accent-2)]" />
              <div className="h-3 w-3 bg-[var(--pixel-accent)]" />
            </div>
            <span className="truncate font-sans font-semibold text-[10px] tracking-tight text-[var(--pixel-accent)] md:text-xs">
              {title}
            </span>
          </div>

          <div
            className={`rounded-md border px-2 py-1 font-sans font-semibold text-[8px] tracking-tight md:text-[9px] ${PHASE_BADGE_CLASS[phase]}`}
          >
            {isWaitingForOpponent ? "WAITING" : getPhaseLabel(phase)}
          </div>
        </div>

        <div className="grid gap-4 p-4 md:gap-6 md:grid-cols-[1.2fr_1fr] md:p-7">
          <div className="space-y-4 md:space-y-5">
            <AnimatePresence mode="wait">
              {isWaitingForOpponent ? (
                <motion.div
                  key="waiting"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
                  transition={{ type: "spring", stiffness: 380, damping: 26 }}
                  className="space-y-4"
                >
                  {/* Room info card */}
                  <div className="rounded-xl border border-[var(--pixel-accent)] bg-[color-mix(in_oklab,var(--pixel-accent)_8%,transparent)] p-4">
                    <p className="mb-2 font-sans font-semibold text-[10px] tracking-tight text-[var(--pixel-accent)] md:text-xs">
                      ROOM CREATED
                    </p>
                    <div className="mb-3 flex items-center gap-3">
                      <span className="font-mono text-2xl font-bold tracking-[0.15em] text-[var(--pixel-accent)]">
                        {roomCode}
                      </span>
                      <motion.div
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        className="font-mono text-xs text-[var(--pixel-muted)]"
                      >
                        waiting for opponent...
                      </motion.div>
                    </div>
                    <button
                      type="button"
                      onClick={handleShareLink}
                      className="rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-accent)] px-3 py-2 font-sans font-semibold text-[9px] tracking-tight text-[var(--pixel-bg)] transition-transform duration-150 hover:scale-[1.03] md:text-[10px]"
                    >
                      {copySuccess ? "COPIED!" : "SHARE LINK"}
                    </button>
                  </div>

                  {/* Waiting animation — clean breathing dots */}
                  <div className="flex items-center justify-center gap-4 py-4">
                    {/* Host — solid circle */}
                    <motion.div
                      className="flex h-12 w-12 items-center justify-center rounded-full"
                      style={{ background: "rgba(129,140,248,0.12)", border: "2px solid var(--pixel-accent)" }}
                      animate={{ boxShadow: ["0 0 0px rgba(129,140,248,0)", "0 0 20px rgba(129,140,248,0.3)", "0 0 0px rgba(129,140,248,0)"] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <span className="text-lg">👤</span>
                    </motion.div>

                    {/* Connection line with traveling dot */}
                    <div className="relative h-[2px] w-20 rounded-full" style={{ background: "rgba(129,140,248,0.15)" }}>
                      <motion.div
                        className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[var(--pixel-accent)]"
                        style={{ boxShadow: "0 0 8px var(--pixel-accent)" }}
                        animate={{ left: ["-4px", "calc(100% + 4px)"], opacity: [0, 1, 1, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      />
                    </div>

                    {/* Opponent — breathing empty circle */}
                    <motion.div
                      className="flex h-12 w-12 items-center justify-center rounded-full"
                      style={{ border: "2px dashed var(--pixel-muted)" }}
                      animate={{
                        borderColor: ["rgba(139,92,246,0.2)", "rgba(139,92,246,0.5)", "rgba(139,92,246,0.2)"],
                        scale: [1, 1.05, 1],
                      }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <motion.span
                        className="font-mono text-sm font-bold text-[var(--pixel-muted)]"
                        animate={{ opacity: [0.3, 0.7, 0.3] }}
                        transition={{ duration: 3, repeat: Infinity }}
                      >
                        ?
                      </motion.span>
                    </motion.div>
                  </div>

                  {/* Hint */}
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-center font-mono text-[11px] text-[var(--pixel-muted)]"
                  >
                    Share the code <span className="font-bold text-[var(--pixel-accent)]">{roomCode}</span> — your friend enters the same code to join
                  </motion.p>
                </motion.div>
              ) : (
                <motion.div
                  key="input"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
                  transition={{ type: "spring", stiffness: 380, damping: 26 }}
                  className="space-y-4"
                >
                  {/* Room code input */}
                  <div className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-bg)]/50 p-4">
                    <CodeInput
                      length={6}
                      label="ROOM CODE"
                      disabled={phase === "initializing" || phase === "connecting"}
                      status={codeInputStatus}
                      resetSignal={resetSignal}
                      initialValue={autoConnectPeerId ?? undefined}
                      onComplete={handleConnect}
                    />
                  </div>

                  {/* How it works guide (idle only) */}
                  {phase === "ready" && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-center gap-3 py-3">
                        <motion.div
                          className="flex h-10 w-10 items-center justify-center rounded-full"
                          style={{ background: "rgba(129,140,248,0.1)", border: "2px solid var(--pixel-accent)" }}
                          animate={{ scale: [1, 1.06, 1] }}
                          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <span className="text-base">👤</span>
                        </motion.div>

                        <div className="relative h-[2px] w-20 rounded-full" style={{ background: "rgba(129,140,248,0.12)" }}>
                          <motion.div
                            className="absolute inset-y-0 left-0 rounded-full bg-[var(--pixel-accent)]"
                            animate={{ width: ["0%", "100%"] }}
                            transition={{ duration: 1.8, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
                          />
                        </div>

                        <motion.div
                          className="flex h-10 w-10 items-center justify-center rounded-full"
                          style={{ border: "2px dashed var(--pixel-muted)" }}
                          animate={{ borderColor: ["var(--pixel-muted)", "var(--pixel-accent)", "var(--pixel-muted)"] }}
                          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <motion.span
                            className="text-base"
                            animate={{ opacity: [0.3, 0.7, 0.3] }}
                            transition={{ duration: 2.5, repeat: Infinity }}
                          >
                            👤
                          </motion.span>
                        </motion.div>
                      </div>

                      <div className="space-y-2.5 px-1">
                        {[
                          { icon: "⌨️", text: "Enter any room code — a word, number, anything" },
                          { icon: "🔗", text: "Share the same code with your friend" },
                          { icon: "⚡", text: "First in creates the room, second auto-joins" },
                        ].map((item, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5 + i * 0.15 }}
                            className="flex items-start gap-2.5"
                          >
                            <span className="mt-0.5 text-sm leading-none">{item.icon}</span>
                            <span className="font-mono text-xs leading-relaxed text-[var(--pixel-muted)]">
                              {item.text}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {phase === "connecting" && (
                <motion.div
                  key="connecting"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-center gap-3 rounded-xl border border-[var(--pixel-accent-2)] bg-[color-mix(in_oklab,var(--pixel-accent-2)_10%,transparent)] p-4"
                >
                  {/* Pulsing connecting indicator */}
                  <div className="relative flex h-6 w-6 items-center justify-center flex-shrink-0">
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-[var(--pixel-accent-2)] border-t-transparent"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    <motion.div
                      className="h-2 w-2 rounded-full bg-[var(--pixel-accent-2)]"
                      animate={{ scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                    />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <span className="font-sans font-semibold text-[10px] tracking-tight text-[var(--pixel-accent-2)]">
                      CONNECTING...
                    </span>
                    {/* Shimmer progress bar */}
                    <div className="relative h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(167,139,250,0.15)" }}>
                      <motion.div
                        key={`connect-progress-${resetSignal}-${effectiveTimeoutMs}`}
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{ background: "linear-gradient(90deg, var(--pixel-accent-2), var(--pixel-accent))" }}
                        initial={{ scaleX: 0, transformOrigin: "left" }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: progressDurationSec, ease: "linear" }}
                      />
                      {/* Shimmer overlay */}
                      <motion.div
                        className="absolute inset-0"
                        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)" }}
                        animate={{ x: ["-100%", "200%"] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {(phase === "error" || phase === "disconnected") && error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  className="rounded-xl border border-[var(--pixel-warn)] bg-[color-mix(in_oklab,var(--pixel-warn)_10%,transparent)] p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="pt-0.5 font-sans font-semibold text-xs text-[var(--pixel-warn)]">
                      ⚠
                    </div>
                    <div className="flex-1">
                      <p className="font-sans font-semibold text-[10px] tracking-tight text-[var(--pixel-warn)] md:text-xs">
                        {error.title}
                      </p>
                      <p className="mt-1 font-mono text-xs text-[var(--pixel-text)] md:text-sm">
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
                            className="rounded-xl border border-[var(--pixel-warn)] px-3 py-2 font-sans font-semibold text-[9px] tracking-tight text-[var(--pixel-warn)] transition-colors hover:bg-[var(--pixel-warn)] hover:text-[var(--pixel-bg)]"
                          >
                            RETRY
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={onClearError}
                          className="rounded-xl border border-[var(--pixel-border)] px-3 py-2 font-sans font-semibold text-[9px] tracking-tight text-[var(--pixel-muted)] transition-colors hover:border-[var(--pixel-accent)] hover:text-[var(--pixel-accent)]"
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
                  className="rounded-xl border border-[var(--pixel-border)] px-4 py-3 font-mono text-xs text-[var(--pixel-muted)]"
                >
                  &gt; Preparing...
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="hidden space-y-4 rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-bg)]/40 p-4 md:block">
            <div>
              <p className="font-sans font-semibold text-[10px] tracking-tight text-[var(--pixel-accent)] md:text-xs">
                STATUS
              </p>
              <p className="mt-2 font-mono text-sm text-[var(--pixel-text)]">
                {phase === "ready" && !isWaitingForOpponent && "Enter a room code. If nobody is in that room, you'll create it. Otherwise you'll join automatically."}
                {isWaitingForOpponent && "You created the room. Share the code with your friend and wait for them to join."}
                {phase === "connecting" && "Joining the room..."}
                {phase === "connected" && "Connected! The game is starting."}
                {phase === "initializing" && "Preparing the connection..."}
                {(phase === "error" || phase === "disconnected") && "Something went wrong. You can retry or enter a new code."}
              </p>
            </div>

            <div>
              <p className="font-sans font-semibold text-[10px] tracking-tight text-[var(--pixel-accent)] md:text-xs">
                NOTES
              </p>
              <div className="mt-3 space-y-2 font-mono text-xs text-[var(--pixel-muted)] md:text-sm">
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
