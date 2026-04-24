"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import P2PConnectionPanel from "@/features/p2p/components/P2PConnectionPanel";
import { P2PStatusPanel } from "@/features/p2p/components/P2PStatusPanel";
import { P2PChat } from "@/features/p2p/components/P2PChat";
import { ReconnectingOverlay } from "@/features/p2p/components/ReconnectingOverlay";
import { P2P_CONNECT_TIMEOUT_MS } from "@/features/p2p/config";
import ShareButton from "../components/ShareButton";
import { canUseAction } from "./gameLogic";
import { usePulseDuelGame } from "./hooks/usePulseDuelGame";
import {
  ACTION_ACCENT,
  ACTION_COST,
  ACTION_DESCRIPTION,
  ACTION_LABEL,
  type DuelAction,
} from "./types";

const ACTIONS: DuelAction[] = ["charge", "strike", "guard", "break"];

const CONNECTION_DESCRIPTION = [
  "> Share the room code with your rival",
  "> Lock one move per pulse",
  "> Charge, strike, guard, or break on the same shared clock",
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "0.0";
  return (ms / 1000).toFixed(ms >= 1000 ? 1 : 2);
}

function ResourcePips({
  count,
  max,
  fill,
  empty,
}: {
  count: number;
  max: number;
  fill: string;
  empty: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: max }, (_, index) => {
        const active = index < count;
        return (
          <span
            key={index}
            className="block h-2.5 w-6 rounded-sm border"
            style={{
              background: active ? fill : empty,
              borderColor: active ? fill : "rgba(255,255,255,0.12)",
              boxShadow: active ? `0 0 12px ${fill}` : "none",
            }}
          />
        );
      })}
    </div>
  );
}

function ActionBadge({ action }: { action: DuelAction | null }) {
  if (!action) {
    return <span className="text-[10px] uppercase tracking-wide text-white/35">WAITING</span>;
  }

  return (
    <span
      className="rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide"
      style={{
        color: ACTION_ACCENT[action],
        borderColor: ACTION_ACCENT[action],
        background: `${ACTION_ACCENT[action]}14`,
      }}
    >
      {ACTION_LABEL[action]}
    </span>
  );
}

function FighterBand({
  title,
  subtitle,
  hp,
  stamina,
  maxHp,
  maxStamina,
  status,
  accent,
  align,
}: {
  title: string;
  subtitle: string;
  hp: number;
  stamina: number;
  maxHp: number;
  maxStamina: number;
  status: ReactNode;
  accent: string;
  align: "top" | "bottom";
}) {
  const justify = align === "top" ? "items-start" : "items-end";
  const textAlign = align === "top" ? "text-left" : "text-right";

  return (
    <div
      className={`relative flex min-h-[168px] flex-col justify-center gap-4 px-5 py-5 md:px-7 ${justify} ${textAlign}`}
      style={{
        background:
          align === "top"
            ? "linear-gradient(180deg, rgba(239,68,68,0.14) 0%, rgba(12,10,10,0.42) 100%)"
            : "linear-gradient(0deg, rgba(6,182,212,0.12) 0%, rgba(12,10,10,0.42) 100%)",
      }}
    >
      <div className="flex w-full items-center justify-between gap-4">
        <div>
          <div className="font-sans text-xl font-semibold tracking-tight text-white md:text-2xl">{title}</div>
          <div className="font-mono text-[11px] uppercase tracking-wide text-white/45">{subtitle}</div>
        </div>
        {status}
      </div>

      <div className="flex w-full flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <span className="font-mono text-[11px] uppercase tracking-wide text-white/45">Integrity</span>
          <span className="font-mono text-sm font-semibold text-white">{hp} / {maxHp}</span>
        </div>
        <ResourcePips count={hp} max={maxHp} fill={accent} empty="rgba(255,255,255,0.08)" />
      </div>

      <div className="flex w-full flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <span className="font-mono text-[11px] uppercase tracking-wide text-white/45">Stamina</span>
          <span className="font-mono text-sm font-semibold text-white">{stamina} / {maxStamina}</span>
        </div>
        <ResourcePips count={stamina} max={maxStamina} fill="rgba(245,158,11,0.92)" empty="rgba(255,255,255,0.08)" />
      </div>
    </div>
  );
}

function ActionButton({
  action,
  disabled,
  locked,
  canAfford,
  onClick,
}: {
  action: DuelAction;
  disabled: boolean;
  locked: boolean;
  canAfford: boolean;
  onClick: (action: DuelAction) => void;
}) {
  const accent = ACTION_ACCENT[action];
  const cost = ACTION_COST[action];

  return (
    <button
      type="button"
      onClick={() => onClick(action)}
      disabled={disabled}
      className="flex min-h-[92px] w-full flex-col justify-between rounded-lg border px-4 py-3 text-left transition-[transform,border-color,background-color,opacity] duration-150"
      style={{
        borderColor: locked ? accent : disabled ? "rgba(255,255,255,0.08)" : `${accent}80`,
        background: locked ? `${accent}20` : disabled ? "rgba(255,255,255,0.03)" : `${accent}12`,
        color: locked ? "white" : disabled ? "rgba(255,255,255,0.38)" : "white",
        opacity: locked ? 1 : canAfford ? 1 : 0.5,
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: locked ? `0 0 20px ${accent}30` : "none",
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="font-sans text-base font-semibold tracking-tight">{ACTION_LABEL[action]}</span>
        <span
          className="rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wide"
          style={{ background: `${accent}1e`, color: accent }}
        >
          {cost === 0 ? "FREE" : `${cost} STA`}
        </span>
      </div>

      <div className="font-mono text-[11px] leading-5 text-white/62">
        {ACTION_DESCRIPTION[action as Exclude<DuelAction, "idle">]}
      </div>

      <div className="font-mono text-[10px] uppercase tracking-wide" style={{ color: locked ? accent : "rgba(255,255,255,0.38)" }}>
        {locked ? "Locked in" : canAfford ? "Tap to lock" : "Not enough stamina"}
      </div>
    </button>
  );
}

export default function PulseDuelPage() {
  const {
    gameMode,
    setGameMode,
    myIndex,
    view,
    phase,
    localPeerId,
    error,
    isConnected,
    isReconnecting,
    reconnectDeadline,
    roomCode,
    connectSubstep,
    connect,
    sendChat,
    clearError,
    retryLastConnection,
    reinitialize,
    joinPeerId,
    latencyMs,
    lastRemoteMessageAt,
    clockOffsetMs,
    countdownEnd,
    chatMessages,
    addMyMessage,
    doAction,
    doRematch,
    exitToMenu,
  } = usePulseDuelGame();

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const hostNow = useMemo(() => {
    if (myIndex === 1) return now + (clockOffsetMs ?? 0);
    return now;
  }, [clockOffsetMs, myIndex, now]);

  const preRoundMs = view ? Math.max(0, view.roundStartsAt - hostNow) : 0;
  const planningMs = view ? Math.max(0, view.roundEndsAt - hostNow) : 0;
  const revealMs = view ? Math.max(0, view.revealEndsAt - hostNow) : 0;
  const canAct = !!view && view.phase === "planning" && preRoundMs === 0 && planningMs > 0 && !view.myLockedAction;

  const planProgress = view
    ? clamp(
        (hostNow - view.roundStartsAt) / Math.max(1, view.roundEndsAt - view.roundStartsAt),
        0,
        1,
      )
    : 0;
  const revealProgress = view && view.phase !== "planning"
    ? clamp(
        1 - (revealMs / Math.max(1, view.revealEndsAt - view.roundEndsAt)),
        0,
        1,
      )
    : 0;

  const headline = useMemo(() => {
    if (!view) return "SYNCING ARENA";
    if (view.result === "win") return "YOU WON THE DUEL";
    if (view.result === "lose") return "YOU WERE CUT DOWN";
    if (view.result === "draw") return "DOUBLE KNOCKOUT";
    if (preRoundMs > 0) return "ROUND ARMS IN";
    if (view.phase === "planning") return view.myLockedAction ? "MOVE LOCKED" : "CHOOSE YOUR LINE";
    return "EXCHANGE RESOLVED";
  }, [preRoundMs, view]);

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[#090909] text-white"
      style={{
        backgroundImage: `
          linear-gradient(180deg, rgba(239,68,68,0.06) 0%, rgba(9,9,9,0) 24%),
          linear-gradient(0deg, rgba(6,182,212,0.06) 0%, rgba(9,9,9,0) 24%),
          repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 120px),
          repeating-linear-gradient(180deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 72px)
        `,
      }}
    >
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        className="fixed left-4 top-4 z-50 md:left-6 md:top-6"
      >
        <Link
          href="/"
          className="inline-flex rounded-lg border border-white/10 bg-black/50 px-4 py-2 font-sans text-xs font-semibold tracking-tight text-white/80 backdrop-blur-md transition-colors hover:bg-black/70"
        >
          ← BACK
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        className="fixed right-4 top-4 z-50 md:right-6 md:top-6"
      >
        <ShareButton
          title="Pulse Duel"
          text="Play Pulse Duel with a friend in the browser — lock your move on a shared clock and out-read the other side."
        />
      </motion.div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col items-center justify-center px-3 py-6 md:px-6 md:py-10">
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 24 }}
          className="mb-5 text-center md:mb-8"
        >
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.28em] text-[#f59e0b]">P2P DUEL</div>
          <h1 className="font-sans text-4xl font-semibold tracking-tight text-white md:text-6xl">Pulse Duel</h1>
          <p className="mt-2 font-mono text-xs text-white/48 md:text-sm">
            Charge for stamina. Strike the greedy. Guard the strike. Break the guard.
            {isConnected ? " | shared clock linked" : ""}
          </p>
        </motion.div>

        <div className="w-full">
          <AnimatePresence mode="wait">
            {gameMode === "menu" && (
              <motion.div
                key="menu"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 260, damping: 24 }}
                className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1.5fr_1fr]"
              >
                <div className="overflow-hidden rounded-xl border border-white/10 bg-black/45 backdrop-blur-md">
                  <div className="border-b border-white/10 px-5 py-4 md:px-6">
                    <div className="font-sans text-xl font-semibold tracking-tight text-white md:text-2xl">The arena runs on one pulse.</div>
                    <div className="mt-1 font-mono text-[11px] uppercase tracking-wide text-white/45">Each round lasts just long enough to bluff once.</div>
                  </div>
                  <div className="grid gap-0 md:grid-cols-2">
                    <div className="border-b border-white/10 px-5 py-5 md:border-b-0 md:border-r md:border-white/10 md:px-6">
                      <div className="mb-2 font-mono text-[11px] uppercase tracking-wide text-[#ef4444]">Action Triangle</div>
                      <div className="space-y-2 font-mono text-sm leading-6 text-white/72">
                        <p>STRIKE catches CHARGE and BREAK.</p>
                        <p>GUARD absorbs STRIKE.</p>
                        <p>BREAK punishes GUARD.</p>
                        <p>Every lock is judged on the same host-time axis, not arrival order.</p>
                      </div>
                    </div>
                    <div className="px-5 py-5 md:px-6">
                      <div className="mb-2 font-mono text-[11px] uppercase tracking-wide text-[#06b6d4]">Round Flow</div>
                      <div className="space-y-2 font-mono text-sm leading-6 text-white/72">
                        <p>Start with 4 integrity and 2 stamina.</p>
                        <p>Each pulse lets you lock exactly one move.</p>
                        <p>Charge builds options. Over-guarding gets punished.</p>
                        <p>First side to cut the other to zero wins.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-between gap-4 rounded-xl border border-white/10 bg-black/45 p-5 backdrop-blur-md md:p-6">
                  <div>
                    <div className="mb-2 font-mono text-[11px] uppercase tracking-wide text-[#f59e0b]">Fight Plan</div>
                    <div className="space-y-2 font-mono text-sm leading-6 text-white/68">
                      <p>Room is P2P only.</p>
                      <p>First lock sticks.</p>
                      <p>Both locks in early and the pulse snaps shut faster.</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setGameMode("p2p")}
                    className="w-full rounded-lg border border-[#f59e0b] bg-[#f59e0b] px-5 py-4 font-sans text-sm font-semibold tracking-tight text-black transition-transform hover:scale-[1.01]"
                  >
                    ENTER P2P ARENA
                  </button>
                </div>
              </motion.div>
            )}

            {gameMode === "p2p" && !isConnected && (
              <motion.div
                key="connect"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 260, damping: 24 }}
                className="mx-auto max-w-md"
              >
                <P2PConnectionPanel
                  localPeerId={localPeerId}
                  phase={phase}
                  connectTimeoutMs={P2P_CONNECT_TIMEOUT_MS}
                  error={error}
                  title="PULSE_DUEL"
                  description={CONNECTION_DESCRIPTION}
                  autoConnectPeerId={joinPeerId}
                  onConnect={connect}
                  onRetry={retryLastConnection}
                  onClearError={clearError}
                  onReinitialize={reinitialize}
                  roomCode={roomCode}
                  connectSubstep={connectSubstep}
                />
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={exitToMenu}
                    className="rounded-lg border border-white/10 bg-black/50 px-4 py-2 font-sans text-[11px] font-semibold text-white/58"
                  >
                    MENU
                  </button>
                </div>
              </motion.div>
            )}

            {gameMode === "p2p" && isConnected && (
              <motion.div
                key="game"
                initial={{ opacity: 0, scale: 0.985 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.985 }}
                transition={{ type: "spring", stiffness: 260, damping: 24 }}
                className="w-full"
              >
                {!view ? (
                  <div className="py-20 text-center">
                    <span className="font-mono text-sm text-white/44">Synchronizing duel state...</span>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-black/50 backdrop-blur-md">
                    <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
                      <div className="relative border-b border-white/10 lg:border-b-0 lg:border-r lg:border-white/10">
                        <FighterBand
                          title="Opponent"
                          subtitle={myIndex === 0 ? "guest" : "host"}
                          hp={view.oppHp}
                          stamina={view.oppStamina}
                          maxHp={view.targetHp}
                          maxStamina={view.maxStamina}
                          status={
                            view.phase === "planning"
                              ? (
                                <span className="font-mono text-[10px] uppercase tracking-wide text-white/48">
                                  {view.oppLockedIn ? "LOCKED" : "READING"}
                                </span>
                              )
                              : <ActionBadge action={view.lastRound?.oppAction ?? null} />
                          }
                          accent="rgba(239,68,68,0.95)"
                          align="top"
                        />

                        <div className="relative border-y border-white/10 bg-[linear-gradient(90deg,rgba(239,68,68,0.08)_0%,rgba(245,158,11,0.05)_50%,rgba(6,182,212,0.08)_100%)] px-5 py-6 md:px-7">
                          <div
                            className="absolute inset-y-0 left-0"
                            style={{
                              width: `${(view.phase === "planning" ? planProgress : revealProgress) * 100}%`,
                              background:
                                view.phase === "planning"
                                  ? "linear-gradient(90deg, rgba(245,158,11,0.22) 0%, rgba(239,68,68,0.12) 100%)"
                                  : "linear-gradient(90deg, rgba(6,182,212,0.22) 0%, rgba(14,165,233,0.08) 100%)",
                            }}
                          />
                          <div className="relative z-10 flex flex-col gap-5">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                              <div>
                                <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/45">Round {view.roundNumber}</div>
                                <div className="mt-1 font-sans text-2xl font-semibold tracking-tight text-white md:text-3xl">{headline}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-mono text-[11px] uppercase tracking-wide text-white/45">
                                  {preRoundMs > 0 ? "Arms in" : view.phase === "planning" ? "Lock window" : "Reveal"}
                                </div>
                                <div className="font-mono text-2xl font-semibold text-[#f59e0b]">
                                  {preRoundMs > 0
                                    ? formatCountdown(preRoundMs)
                                    : view.phase === "planning"
                                      ? formatCountdown(planningMs)
                                      : formatCountdown(revealMs)}
                                </div>
                              </div>
                            </div>

                            <div className="h-2 overflow-hidden rounded-full bg-white/8">
                              <motion.div
                                animate={{
                                  width: `${(view.phase === "planning" ? planProgress : revealProgress) * 100}%`,
                                }}
                                transition={{ ease: "linear", duration: 0.08 }}
                                className="h-full rounded-full"
                                style={{
                                  background:
                                    view.phase === "planning"
                                      ? "linear-gradient(90deg, #f59e0b 0%, #ef4444 100%)"
                                      : "linear-gradient(90deg, #06b6d4 0%, #38bdf8 100%)",
                                }}
                              />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <div className="mb-2 font-mono text-[11px] uppercase tracking-wide text-white/45">Your lock</div>
                                <ActionBadge action={view.phase === "planning" ? view.myLockedAction : view.lastRound?.myAction ?? null} />
                              </div>
                              <div className="md:text-right">
                                <div className="mb-2 font-mono text-[11px] uppercase tracking-wide text-white/45">Opponent state</div>
                                {view.phase === "planning" ? (
                                  <span className="font-mono text-sm text-white/72">
                                    {view.oppLockedIn ? "Move locked" : "Still reading"}
                                  </span>
                                ) : (
                                  <ActionBadge action={view.lastRound?.oppAction ?? null} />
                                )}
                              </div>
                            </div>

                            {view.lastRound && (
                              <motion.div
                                key={`${view.roundNumber}-${view.lastRound.myAction}-${view.lastRound.oppAction}-${view.phase}`}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4"
                              >
                                <div className="font-mono text-sm text-white/72">{view.lastRound.summary}</div>
                                <div className="font-mono text-xs uppercase tracking-wide text-white/45">
                                  dealt {view.lastRound.damageDealt} · took {view.lastRound.damageTaken}
                                </div>
                              </motion.div>
                            )}

                            {view.result && (
                              <div className="border-t border-white/10 pt-4">
                                <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/45">Result</div>
                                <div
                                  className="mt-1 font-sans text-3xl font-semibold tracking-tight"
                                  style={{
                                    color:
                                      view.result === "win"
                                        ? "#22c55e"
                                        : view.result === "lose"
                                          ? "#ef4444"
                                          : "#f59e0b",
                                  }}
                                >
                                  {view.result === "win" ? "Victory" : view.result === "lose" ? "Defeat" : "Draw"}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <FighterBand
                          title="You"
                          subtitle={myIndex === 0 ? "host" : "guest"}
                          hp={view.myHp}
                          stamina={view.myStamina}
                          maxHp={view.targetHp}
                          maxStamina={view.maxStamina}
                          status={<ActionBadge action={view.phase === "planning" ? view.myLockedAction : view.lastRound?.myAction ?? null} />}
                          accent="rgba(6,182,212,0.95)"
                          align="bottom"
                        />

                        <AnimatePresence>
                          {countdownEnd && countdownEnd > hostNow && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.96 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0 }}
                              className="absolute inset-0 z-20 flex items-center justify-center bg-black/58 backdrop-blur-[2px]"
                            >
                              <div className="text-center">
                                <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/45">Round One</div>
                                <div className="mt-2 font-sans text-6xl font-semibold tracking-tight text-[#f59e0b]">
                                  {Math.max(1, Math.ceil((countdownEnd - hostNow) / 1000))}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <aside className="flex flex-col gap-4 p-4 md:p-5">
                        <div className="border-b border-white/10 pb-4">
                          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/45">Decision Grid</div>
                          <div className="mt-1 font-mono text-xs leading-5 text-white/62">
                            One move per pulse. First lock sticks. Early double-lock snaps the pulse shut faster.
                          </div>
                        </div>

                        <div className="grid gap-3">
                          {ACTIONS.map((action) => (
                            <ActionButton
                              key={action}
                              action={action}
                              disabled={!canAct || !canUseAction({ hp: view.myHp, stamina: view.myStamina }, action)}
                              locked={view.myLockedAction === action}
                              canAfford={canUseAction({ hp: view.myHp, stamina: view.myStamina }, action)}
                              onClick={doAction}
                            />
                          ))}
                        </div>

                        <div className="mt-auto border-t border-white/10 pt-4">
                          <div className="grid grid-cols-2 gap-3 font-mono text-[11px] uppercase tracking-wide text-white/45">
                            <span>latency</span>
                            <span className="text-right text-white/72">{latencyMs != null ? `${latencyMs} ms` : "--"}</span>
                            <span>signal</span>
                            <span className="text-right text-white/72">{lastRemoteMessageAt ? "live" : "--"}</span>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {view.result && (
                              <button
                                type="button"
                                onClick={doRematch}
                                className="rounded-lg border border-[#f59e0b] bg-[#f59e0b] px-4 py-2 font-sans text-sm font-semibold tracking-tight text-black"
                              >
                                REMATCH
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={exitToMenu}
                              className="rounded-lg border border-white/10 bg-black/45 px-4 py-2 font-sans text-sm font-semibold tracking-tight text-white/72"
                            >
                              MENU
                            </button>
                          </div>
                        </div>
                      </aside>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {gameMode === "p2p" && isConnected && (
        <P2PStatusPanel
          isConnected={isConnected}
          phase={phase}
          role={myIndex === 0 ? "host" : myIndex === 1 ? "guest" : "unknown"}
          localPeerId={localPeerId}
          latencyMs={latencyMs}
          lastRemoteMessageAt={lastRemoteMessageAt}
        />
      )}

      <P2PChat
        messages={chatMessages}
        onSend={(text) => { if (sendChat(text)) addMyMessage(text); }}
        isConnected={gameMode === "p2p" && isConnected}
      />

      <AnimatePresence>
        {isReconnecting && <ReconnectingOverlay deadline={reconnectDeadline} />}
      </AnimatePresence>
    </div>
  );
}
