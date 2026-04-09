"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";
import P2PConnectionPanel from "@/features/p2p/components/P2PConnectionPanel";
import { P2PStatusPanel } from "@/features/p2p/components/P2PStatusPanel";
import { P2PChat } from "@/features/p2p/components/P2PChat";
import { ReconnectingOverlay } from "@/features/p2p/components/ReconnectingOverlay";
import { P2P_CONNECT_TIMEOUT_MS } from "@/features/p2p/config";
import ShareButton from "../components/ShareButton";
import Confetti from "../components/Confetti";
import { usePokerGame } from "./hooks/usePokerGame";
import type { Card, PlayerView } from "./types";
import { rankStr, suitSymbol, suitColor, getActions, isInBestHand, getNextBlindLevel, evaluateHand } from "./utils";
import type { EquityResult } from "./equity";
import type { EquityWorkerResponse } from "./equity.worker";

// ── Design tokens (Version D) ──

const D = {
  panelBg:     "var(--pixel-card-bg)",
  panelBorder: "var(--pixel-border)",
  oppBg:       "color-mix(in oklab, var(--pixel-bg-alt) 80%, transparent)",
  tableBg:     "color-mix(in oklab, var(--pixel-bg) 90%, transparent)",
  tableBorder: "var(--pixel-border)",
  myTurnBorder:"color-mix(in oklab, var(--pixel-accent) 60%, transparent)",
  myTurnGlow:  "0 0 0 1px color-mix(in oklab, var(--pixel-accent) 12%, transparent), 0 0 22px color-mix(in oklab, var(--pixel-accent) 10%, transparent)",
} as const;

type LogEntry = { who: "YOU" | "OPP"; action: string; amount: number; phase: string };

// ── Animated counter ──

function AnimatedNumber({ value, className, prefix = "$" }: { value: number; className?: string; prefix?: string }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current === value) return;
    const from = prev.current;
    prev.current = value;
    const diff = value - from;
    const dur = Math.max(200, Math.min(Math.abs(diff) * 4, 600));
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / dur, 1);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      setDisplay(Math.round(from + diff * ease));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span className={className}>{prefix}{display}</span>;
}

// ── Phase flash (light sweep on the table when new cards come) ──

function PhaseFlash({ phase, handNumber }: { phase: string; handNumber: number }) {
  const [flash, setFlash] = useState(false);
  const prevPhase = useRef(phase);
  const prevHand = useRef(handNumber);

  useEffect(() => {
    if (phase === prevPhase.current && handNumber === prevHand.current) return;
    prevPhase.current = phase;
    prevHand.current = handNumber;
    if (phase === "flop" || phase === "turn" || phase === "river") {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 700);
      return () => clearTimeout(t);
    }
  }, [phase, handNumber]);

  return (
    <AnimatePresence>
      {flash && (
        <motion.div
          key={`${phase}-${handNumber}`}
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className="absolute inset-y-0 w-[60%]"
            style={{ background: "linear-gradient(90deg, transparent, color-mix(in oklab, var(--pixel-text) 18%, transparent), transparent)" }}
            initial={{ left: "-60%" }}
            animate={{ left: "100%" }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}


// ── Card component ──

function CardView({ card, faceDown, small, highlight, dimmed, delay, fresh }: {
  card?: Card | null; faceDown?: boolean; small?: boolean;
  highlight?: boolean; dimmed?: boolean; delay?: number; fresh?: boolean;
}) {
  const w = small ? "w-9 h-[52px]" : "w-[52px] h-[74px]";
  if (faceDown || !card) {
    return (
      <div className={`${w} rounded-lg border-2 border-blue-400/40 bg-gradient-to-br from-blue-900 to-indigo-800 flex items-center justify-center shadow-md ${dimmed ? "opacity-40" : ""}`}>
        <div className="w-3/5 h-3/5 rounded-sm border border-blue-400/30 bg-blue-800/60" />
      </div>
    );
  }
  const c = suitColor(card.suit);
  const fs = small ? "text-[10px]" : "text-xs";
  const ss = small ? "text-base" : "text-xl";
  return (
    <motion.div
      initial={fresh
        ? { opacity: 0, scale: 1.12 }
        : { rotateY: 90, opacity: 0 }}
      animate={highlight
        ? { rotateY: 0, opacity: 1, scale: [1, 1.06, 1] }
        : fresh
          ? { opacity: 1, scale: 1 }
          : { rotateY: 0, opacity: dimmed ? 0.35 : 1 }}
      transition={fresh
        ? { duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: delay ?? 0 }
        : highlight
          ? { rotateY: { duration: 0.3, delay: delay ?? 0 },
              scale: { duration: 0.6, delay: (delay ?? 0) + 0.3, repeat: Infinity, repeatType: "reverse" as const },
              opacity: { duration: 0.3, delay: delay ?? 0 } }
          : { duration: 0.3, delay: delay ?? 0 }}
      className={`${w} rounded-lg border-2 ${
        fresh ? "border-[var(--pixel-accent-2)]"
        : highlight ? "border-yellow-400"
        : "border-gray-300 dark:border-gray-500"
      } bg-white flex flex-col items-center justify-center relative dark:shadow-black/30`}
      style={fresh
        ? { boxShadow: "0 0 10px color-mix(in oklab, var(--pixel-accent-2) 35%, transparent)", willChange: "transform, opacity" }
        : highlight ? { zIndex: 2, boxShadow: "0 0 12px rgba(250,204,21,0.5)" } : { willChange: "transform, opacity" }}
    >
      <span className={`absolute top-0.5 left-1 font-bold ${fs}`} style={{ color: c }}>{rankStr(card.rank)}</span>
      <span className={ss} style={{ color: c }}>{suitSymbol(card.suit)}</span>
      <span className={`absolute bottom-0.5 right-1 font-bold rotate-180 ${fs}`} style={{ color: c }}>{rankStr(card.rank)}</span>
    </motion.div>
  );
}

// ── Dealer chip ──

function DealerChip({ show }: { show: boolean }) {
  if (!show) return <div className="w-6 h-6" />;
  return (
    <div className="w-6 h-6 rounded-full bg-yellow-400 border-2 border-yellow-600 flex items-center justify-center shadow-sm">
      <span className="text-[8px] font-black text-yellow-900">D</span>
    </div>
  );
}

// ── Action bar ──

function ActionBar({ view, onAction }: { view: PlayerView; onAction: (a: string, amt?: number) => void }) {
  const acts = getActions(view);
  const [showRaise, setShowRaise] = useState(false);
  const [raiseVal, setRaiseVal] = useState(0);

  useEffect(() => {
    if (acts?.canRaise) setRaiseVal(acts.minRaiseTo);
    setShowRaise(false);
  }, [view.handNumber, view.phase, view.isMyTurn]);

  // Also reset raise value when acts change
  useEffect(() => {
    if (acts?.canRaise && raiseVal < acts.minRaiseTo) setRaiseVal(acts.minRaiseTo);
  }, [acts?.minRaiseTo, acts?.canRaise, raiseVal]);

  if (!acts) return null;

  const potTotal = view.pot + view.myBet + view.opponentBet;
  const clamp = (v: number) => Math.min(Math.max(v, acts.minRaiseTo), acts.maxRaiseTo);
  const presets = [
    { label: "MIN", val: acts.minRaiseTo },
    { label: "1/2", val: clamp(Math.floor(potTotal / 2)) },
    { label: "POT", val: clamp(potTotal) },
    { label: "2x", val: clamp(potTotal * 2) },
    { label: "3x", val: clamp(potTotal * 3) },
    { label: "4x", val: clamp(potTotal * 4) },
    { label: "ALL IN", val: acts.maxRaiseTo },
  ].filter((p, i, arr) => {
    if (i === 0 || i === arr.length - 1) return true; // always show MIN & ALL IN
    return p.val > acts.minRaiseTo && p.val < acts.maxRaiseTo; // skip if same as MIN or ALL IN
  });

  return (
    <div className="w-full space-y-2">
      {showRaise && acts.canRaise && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-[var(--pixel-muted)]">RAISE TO</span>
            <span className="font-mono text-sm font-bold text-[var(--pixel-accent)]">${raiseVal}</span>
          </div>
          <input
            type="range"
            min={acts.minRaiseTo}
            max={acts.maxRaiseTo}
            step={view.bigBlind}
            value={raiseVal}
            onChange={e => setRaiseVal(Number(e.target.value))}
            className="w-full accent-[var(--pixel-accent)]"
          />
          <div className="flex gap-1.5 flex-wrap">
            {presets.map(p => (
              <button key={p.label} onClick={() => setRaiseVal(p.val)} className="raise-quick-btn">{p.label}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { onAction(raiseVal >= acts.maxRaiseTo ? "allin" : "raise", raiseVal); setShowRaise(false); }}
              className="flex-1 rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-accent)] px-4 py-2.5 font-sans font-semibold text-[10px] text-[var(--pixel-bg)] transition-transform hover:scale-[1.02]"
            >
              {raiseVal >= acts.maxRaiseTo ? "ALL IN" : `RAISE TO $${raiseVal}`}
            </button>
            <button
              onClick={() => setShowRaise(false)}
              className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-3 py-2.5 font-sans font-semibold text-[10px] text-[var(--pixel-muted)]"
            >
              CANCEL
            </button>
          </div>
        </motion.div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onAction("fold")}
          className="flex-1 rounded-xl border border-red-500/60 bg-red-500/10 dark:bg-red-500/20 px-3 py-3 font-sans font-semibold text-[11px] text-red-400 dark:text-red-300 transition-colors hover:bg-red-500/20 dark:hover:bg-red-500/30"
        >
          FOLD
        </button>
        {acts.canCheck ? (
          <button
            onClick={() => onAction("check")}
            className="flex-1 rounded-xl border border-[var(--pixel-accent)]/40 bg-[var(--pixel-card-bg)] px-3 py-3 font-sans font-semibold text-[11px] text-[var(--pixel-accent)] transition-colors hover:border-[var(--pixel-accent)] hover:bg-[var(--pixel-accent)]/10"
          >
            CHECK
          </button>
        ) : (
          <div className="relative flex-1">
            {/* Inward ripple rings */}
            {[0, 0.6, 1.2].map((delay, i) => (
              <motion.div
                key={i}
                className="pointer-events-none absolute inset-0 rounded-xl border-2 border-[var(--pixel-accent-2)]"
                animate={{ scale: [1.12, 1.0], opacity: [0, 0.5, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, delay, ease: "easeInOut" }}
              />
            ))}
            <button
              onClick={() => onAction(acts.callIsAllIn ? "allin" : "call")}
              className="relative z-10 w-full rounded-xl border border-[var(--pixel-accent-2)] bg-[var(--pixel-accent-2)]/15 dark:bg-[var(--pixel-accent-2)]/20 px-3 py-3 font-sans font-semibold text-[11px] text-[var(--pixel-accent-2)] transition-colors hover:bg-[var(--pixel-accent-2)]/25 dark:hover:bg-[var(--pixel-accent-2)]/30"
            >
              <span className="block">{acts.callIsAllIn ? "ALL IN" : "CALL"}</span>
              <span className="block text-[9px] font-mono opacity-80">${acts.callAmount}</span>
            </button>
          </div>
        )}
        {acts.canRaise && !showRaise && (
          <button
            onClick={() => setShowRaise(true)}
            className="flex-1 rounded-xl border border-yellow-500/60 dark:border-yellow-400/50 bg-yellow-500/10 dark:bg-yellow-500/20 px-3 py-3 font-sans font-semibold text-[11px] text-yellow-500 dark:text-yellow-300 transition-colors hover:bg-yellow-500/20 dark:hover:bg-yellow-500/30"
          >
            RAISE
          </button>
        )}
      </div>
    </div>
  );
}

// ── Equity overlay ──

function PctBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 flex-1 rounded-full bg-[var(--pixel-bg-alt)] overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(pct, 100)}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="h-full rounded-full"
        style={{ background: color }}
      />
    </div>
  );
}

function EquityOverlay({ result, loading }: { result: EquityResult | null; loading: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-xl"
    >
      <div className="w-full max-w-xs mx-3 rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] backdrop-blur-xl p-4 shadow-2xl">
        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-[10px] font-semibold tracking-widest text-[var(--pixel-accent)]">HAND ANALYSIS</span>
        </div>

        {loading || !result ? (
          <div className="py-6 text-center">
            <span className="font-mono text-xs text-[var(--pixel-muted)] animate-pulse">Computing...</span>
          </div>
        ) : (
          <>
            {/* Equity section */}
            <div className="space-y-1.5 mb-4">
              <div className="font-mono text-[9px] font-semibold text-[var(--pixel-muted)] tracking-wider mb-1">EQUITY</div>
              {([
                { label: "Win", pct: result.winPct, color: "#22c55e" },
                { label: "Lose", pct: result.losePct, color: "#ef4444" },
                { label: "Tie", pct: result.tiePct, color: "#eab308" },
              ] as const).map(r => (
                <div key={r.label} className="flex items-center gap-2">
                  <span className="font-mono text-[10px] w-8 text-right" style={{ color: r.color }}>{r.label}</span>
                  <PctBar pct={r.pct} color={r.color} />
                  <span className="font-mono text-[10px] w-12 text-right font-semibold" style={{ color: r.color }}>
                    {r.pct.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>

            {/* Hand distribution */}
            <div className="space-y-1">
              <div className="font-mono text-[9px] font-semibold text-[var(--pixel-muted)] tracking-wider mb-1">YOUR HAND ODDS</div>
              {result.handDist.map(h => (
                <div key={h.name} className="flex items-center gap-2">
                  <span className="font-mono text-[9px] w-[86px] text-right text-[var(--pixel-text)] truncate">{h.name}</span>
                  <div className="h-1.5 flex-1 rounded-full bg-[var(--pixel-bg-alt)] overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(h.pct, 100)}%` }}
                      transition={{ type: "spring", stiffness: 260, damping: 20 }}
                      className="h-full rounded-full bg-[var(--pixel-accent)]"
                      style={{ opacity: h.pct > 0 ? 1 : 0.2 }}
                    />
                  </div>
                  <span className={`font-mono text-[9px] w-11 text-right ${h.pct > 0 ? "text-[var(--pixel-accent)] font-semibold" : "text-[var(--pixel-muted)]"}`}>
                    {h.pct.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3 text-center font-mono text-[8px] text-[var(--pixel-muted)]">
              {result.exact
                ? <>{result.samples.toLocaleString()} combinations &middot; exact</>
                : <>~{result.samples.toLocaleString()} simulations &middot; approximate</>
              }
              {" "}&middot; opponent cards unknown
            </div>
          </>
        )}

        <div className="mt-2 text-center font-mono text-[8px] text-[var(--pixel-muted)]">
          <span className="hidden md:inline">Release SPACE to close</span>
          <span className="md:hidden">Tap outside to close</span>
        </div>
      </div>
    </motion.div>
  );
}

// ── PotDisplay ──

function PotDisplay({ pot, myBet, opponentBet, myChips, opponentChips }: {
  pot: number; myBet: number; opponentBet: number; myChips: number; opponentChips: number;
}) {
  const bets = myBet + opponentBet;
  const total = pot + bets;
  const effectiveStack = Math.min(myChips, opponentChips);
  const spr = total > 0 ? (effectiveStack / total).toFixed(1) : "—";
  return (
    <div className="flex items-center gap-3">
      <div className="text-center">
        <div className="font-mono text-[7px] tracking-widest text-[var(--pixel-muted)] mb-0.5">POT</div>
        <AnimatedNumber value={pot} className="font-mono text-base font-bold text-[var(--pixel-warn)]" />
      </div>
      <div className="w-px h-5 bg-[var(--pixel-border)]" />
      <div className="text-center">
        <div className="font-mono text-[7px] tracking-widest text-[var(--pixel-muted)] mb-0.5">BETS</div>
        <AnimatedNumber value={bets} className="font-mono text-sm font-bold text-[var(--pixel-accent-2)]" prefix="+" />
      </div>
      <div className="w-px h-5 bg-[var(--pixel-border)]" />
      <div className="text-center">
        <div className="font-mono text-[7px] tracking-widest text-[var(--pixel-muted)] mb-0.5">TOTAL</div>
        <AnimatedNumber value={total} className="font-mono text-sm font-bold text-[var(--pixel-warn)]" />
      </div>
      <div className="w-px h-5 bg-[var(--pixel-border)]" />
      <div className="text-center">
        <div className="font-mono text-[7px] tracking-widest text-[var(--pixel-muted)] mb-0.5">SPR</div>
        <span className="font-mono text-sm font-bold text-[var(--pixel-muted)]">{spr}</span>
      </div>
    </div>
  );
}

// ── PotOdds ──

function PotOdds({ toCall, total, equityPct }: { toCall: number; total: number; equityPct: number | null }) {
  if (toCall <= 0) return null;
  const oddsPct = Math.round((toCall / (total + toCall)) * 100);
  const isGood = equityPct !== null && equityPct > oddsPct;
  return (
    <div className={`font-mono text-[8px] font-bold px-2 py-0.5 rounded-md border ${
      isGood
        ? "text-[#4ade80] bg-[rgba(74,222,128,0.07)] border-[rgba(74,222,128,0.25)]"
        : "text-[var(--pixel-muted)] bg-[color-mix(in_oklab,var(--pixel-text)_3%,transparent)] border-[var(--pixel-border)]"
    }`}>
      {oddsPct}% pot odds{isGood ? " · Good odds" : " · Poor odds"}
    </div>
  );
}

// ── ChipBar ──

function ChipBar({ myChips, opponentChips }: { myChips: number; opponentChips: number }) {
  const total = myChips + opponentChips;
  if (total === 0) return null;
  const mePct = Math.round((myChips / total) * 100);
  const oppPct = 100 - mePct;
  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex items-center justify-between font-mono text-[8px]">
        <span className="text-[var(--pixel-accent-2)]">OPP {oppPct}%</span>
        <span className="text-[var(--pixel-accent)]">YOU {mePct}%</span>
      </div>
      <div className="w-full h-[3px] rounded-full overflow-hidden" style={{ background: "color-mix(in oklab, var(--pixel-text) 6%, transparent)" }}>
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${mePct}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ marginLeft: "auto", background: "linear-gradient(90deg, color-mix(in oklab, var(--pixel-accent) 50%, transparent), var(--pixel-accent))" }}
        />
      </div>
    </div>
  );
}

// ── BlindProgress ──

function BlindProgress({ handNumber, smallBlind }: { handNumber: number; smallBlind: number }) {
  const { nextSb, handsAway } = getNextBlindLevel(handNumber);
  const currentLevel = Math.floor(Math.log2((handNumber + 4) / 5));
  const levelStart = Math.round(5 * Math.pow(2, currentLevel) - 4);
  const levelEnd   = Math.round(5 * Math.pow(2, currentLevel + 1) - 4);
  const progress = (handNumber - levelStart) / Math.max(1, levelEnd - levelStart);

  return (
    <div className="flex items-center gap-2 w-full font-mono text-[8px] text-[var(--pixel-muted)]"
         style={{ border: "1px solid var(--pixel-border)", borderRadius: 7, padding: "4px 10px", background: "color-mix(in oklab, var(--pixel-bg) 50%, transparent)" }}>
      <span>Blinds <span className="text-[var(--pixel-warn)] font-bold">{smallBlind}/{smallBlind * 2}</span></span>
      <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: "color-mix(in oklab, var(--pixel-text) 6%, transparent)" }}>
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${Math.min(progress * 100, 100)}%` }}
          transition={{ duration: 0.5 }}
          style={{ background: "linear-gradient(90deg, rgba(251,191,36,0.4), #fbbf24)" }}
        />
      </div>
      {handsAway > 0
        ? <span>{handsAway} hand{handsAway !== 1 ? "s" : ""} → <span className="text-[var(--pixel-warn)] font-bold">{nextSb}/{nextSb * 2}</span></span>
        : <span className="text-[var(--pixel-warn)] font-bold">↑ next hand</span>
      }
    </div>
  );
}

// ── ActionLog ──

function ActionLog({ entries, isMyTurn }: { entries: LogEntry[]; isMyTurn: boolean }) {
  if (entries.length === 0 && !isMyTurn) return null;
  const visible = entries.slice(-5);
  return (
    <div className="w-full rounded-lg border flex flex-col gap-[3px] px-2 py-1.5"
         style={{ background: "color-mix(in oklab, var(--pixel-bg) 60%, transparent)", borderColor: "var(--pixel-border)" }}>
      {visible.map((e, i) => (
        <div key={i} className="flex items-center gap-1.5 font-mono text-[8px] text-[var(--pixel-muted)]">
          <span className={`font-bold w-6 ${e.who === "YOU" ? "text-[var(--pixel-accent)]" : "text-[var(--pixel-accent-2)]"}`}>
            {e.who}
          </span>
          <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: "color-mix(in oklab, var(--pixel-accent-2) 40%, transparent)" }} />
          <span className="text-[var(--pixel-text)]">{e.action.toUpperCase()}</span>
          {e.amount > 0 && (
            <span className="ml-auto text-[var(--pixel-warn)]">${e.amount}</span>
          )}
        </div>
      ))}
      {isMyTurn && (
        <div className="flex items-center gap-1.5 font-mono text-[8px]">
          <span className="font-bold w-6 text-[var(--pixel-accent)]">YOU</span>
          <motion.div
            className="w-1 h-1 rounded-full flex-shrink-0 bg-[var(--pixel-accent)]"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
          <span className="text-[var(--pixel-accent)]">to act…</span>
        </div>
      )}
    </div>
  );
}

// ── HandStrengthBadge ──

function HandStrengthBadge({ myCards, community }: { myCards: Card[]; community: Card[] }) {
  if (myCards.length < 2 || community.length < 3) return null;
  const { name } = evaluateHand(myCards, community);
  return (
    <div className="inline-flex items-center font-mono text-[8px] font-bold px-1.5 py-0.5 rounded-md"
         style={{ color: "var(--pixel-accent-2)", background: "color-mix(in oklab, var(--pixel-accent-2) 8%, transparent)", border: "1px solid color-mix(in oklab, var(--pixel-accent-2) 20%, transparent)" }}>
      {name.toUpperCase()}
    </div>
  );
}

// ── WinRateBar ──

function WinRateBar({ equityPct }: { equityPct: number | null }) {
  return (
    <div className="flex items-center gap-1.5 w-full mt-1.5">
      <span className="font-mono text-[7px] tracking-widest text-[var(--pixel-muted)] w-6">WIN</span>
      <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: "rgba(239,68,68,0.2)" }}>
        <motion.div
          className="h-full rounded-full"
          animate={{ width: equityPct !== null ? `${Math.min(equityPct, 100)}%` : "0%" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{ background: "linear-gradient(90deg, #4ade80, rgba(74,222,128,0.6))" }}
        />
      </div>
      <span className="font-mono text-[8px] font-bold w-8 text-right"
            style={{ color: equityPct !== null ? "#4ade80" : "var(--pixel-muted)" }}>
        {equityPct !== null ? `${equityPct.toFixed(0)}%` : "…"}
      </span>
    </div>
  );
}

// ── Poker table ──

function PokerTable({ view, isGameOver, onAction, onNextHand, onRematch }: {
  view: PlayerView;
  isGameOver: boolean;
  onAction: (a: string, amt?: number) => void;
  onNextHand: () => void;
  onRematch: () => void;
}) {
  // ── Equity Web Worker ──
  const equityWorkerRef = useRef<Worker | null>(null);

  useEffect(() => {
    equityWorkerRef.current = new Worker(
      new URL("./equity.worker.ts", import.meta.url)
    );
    return () => {
      equityWorkerRef.current?.terminate();
      equityWorkerRef.current = null;
    };
  }, []);

  // ── Equity analysis (hold SPACE / tap ?) ──
  const [showEquity, setShowEquity] = useState(false);
  const [equityResult, setEquityResult] = useState<EquityResult | null>(null);
  const [equityLoading, setEquityLoading] = useState(false);
  const equityCacheKey = useRef("");
  const canShowEquity = view.phase !== "showdown" && view.phase !== "waiting" && view.myCards.length === 2;

  // Compute equity on demand (via worker)
  useEffect(() => {
    if (!showEquity || !canShowEquity) return;
    const key = view.myCards.map(c => `${c.rank}${c.suit}`).join(",") + "|" + view.community.map(c => `${c.rank}${c.suit}`).join(",");
    if (equityCacheKey.current === key && equityResult) return; // cached
    equityCacheKey.current = key;
    setEquityLoading(true);
    setEquityResult(null);

    const worker = equityWorkerRef.current;
    if (!worker) return;

    const handler = (e: MessageEvent<EquityWorkerResponse>) => {
      if (e.data.id !== "full") return;
      setEquityResult(e.data.result);
      setEquityLoading(false);
      worker.removeEventListener("message", handler);
    };
    worker.addEventListener("message", handler);
    worker.postMessage({ id: "full", myCards: view.myCards, community: view.community });

    return () => worker.removeEventListener("message", handler);
  }, [showEquity, canShowEquity, view.myCards, view.community, equityResult]);

  // Reset cache on new hand/phase
  useEffect(() => {
    equityCacheKey.current = "";
    setEquityResult(null);
  }, [view.handNumber, view.phase]);

  // Keyboard: hold SPACE
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "button" || tag === "textarea" || tag === "select") return;
      e.preventDefault();
      if (canShowEquity) setShowEquity(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setShowEquity(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [canShowEquity]);

  // Safety: dismiss equity overlay on any touch/pointer activity outside the ? button
  useEffect(() => {
    if (!showEquity) return;
    const dismiss = () => setShowEquity(false);
    window.addEventListener("pointerdown", dismiss, { capture: true, once: true });
    return () => {
      window.removeEventListener("pointerdown", dismiss, { capture: true });
    };
  }, [showEquity]);

  const potTotal = view.pot + view.myBet + view.opponentBet;
  const phaseName = view.phase === "preflop" ? "PRE-FLOP" : view.phase.toUpperCase();
  const sb = view.smallBlind;
  const isShowdown = view.phase === "showdown";
  const isFoldWin = isShowdown && view.result?.winnerHand === "Fold";
  const showBestCards = isShowdown && !isFoldWin && view.result;
  const didWin = isShowdown && view.result?.iWon === true;
  const didLose = isShowdown && view.result?.iWon === false;
  const isRareHand = isShowdown && view.result && !isFoldWin &&
    ["Four of a Kind", "Straight Flush", "Royal Flush"].includes(view.result.winnerHand);

  // All-in flash
  const [allInFlash, setAllInFlash] = useState(false);
  const prevAllIn = useRef(false);
  useEffect(() => {
    const isAllIn = view.myAllIn || view.opponentAllIn;
    if (isAllIn && !prevAllIn.current) {
      setAllInFlash(true);
      const t = setTimeout(() => setAllInFlash(false), 800);
      return () => clearTimeout(t);
    }
    prevAllIn.current = !!isAllIn;
  }, [view.myAllIn, view.opponentAllIn]);

  // Determine which cards to highlight at showdown
  // Winner's best 5 cards glow; loser's non-best cards are dimmed
  const winnerBest = showBestCards
    ? (view.result!.iWon === true ? view.result!.myBestCards
       : view.result!.iWon === false ? view.result!.opponentBestCards
       : view.result!.myBestCards) // tie: highlight both
    : [];

  const lastActionLabel = (() => {
    if (!view.lastAction) return null;
    const who = view.lastAction.isMe ? "You" : "Opp";
    const a = view.lastAction.action.toUpperCase();
    const amt = view.lastAction.action === "raise" ? ` to $${view.lastAction.amount}` :
                view.lastAction.action === "call" ? ` $${view.lastAction.amount}` :
                view.lastAction.action === "allin" ? " ALL IN" : "";
    return `${who}: ${a}${amt}`;
  })();

  // ── Action log accumulation ──
  const [actionLog, setActionLog] = useState<LogEntry[]>([]);
  const prevLastAction = useRef<typeof view.lastAction>(undefined);
  const prevHandForLog = useRef(view.handNumber);

  useEffect(() => {
    if (view.handNumber !== prevHandForLog.current) {
      prevHandForLog.current = view.handNumber;
      setActionLog([]);
      prevLastAction.current = undefined;
      return;
    }
    if (
      view.lastAction &&
      (prevLastAction.current === undefined ||
        view.lastAction.action !== prevLastAction.current.action ||
        view.lastAction.amount !== prevLastAction.current.amount ||
        view.lastAction.isMe !== prevLastAction.current.isMe)
    ) {
      prevLastAction.current = view.lastAction;
      setActionLog(prev => [...prev, {
        who: view.lastAction!.isMe ? "YOU" : "OPP",
        action: view.lastAction!.action,
        amount: view.lastAction!.amount,
        phase: view.phase,
      }]);
    }
  }, [view.lastAction, view.handNumber, view.phase]);

  // ── Equity computation (always-on) ──
  const [equityPct, setEquityPct] = useState<number | null>(null);
  const eqKey = useRef("");

  useEffect(() => {
    if (view.myCards.length < 2 || view.phase === "showdown" || view.phase === "waiting") {
      setEquityPct(null);
      return;
    }
    const key = view.myCards.map(c => `${c.rank}${c.suit}`).join(",") + "|" + view.community.map(c => `${c.rank}${c.suit}`).join(",");
    if (eqKey.current === key) return;
    eqKey.current = key;

    const worker = equityWorkerRef.current;
    if (!worker) return;

    const timer = setTimeout(() => {
      const handler = (e: MessageEvent<EquityWorkerResponse>) => {
        if (e.data.id !== "quick") return;
        setEquityPct(Math.round(e.data.winPct));
        worker.removeEventListener("message", handler);
      };
      worker.addEventListener("message", handler);
      worker.postMessage({ id: "quick", myCards: view.myCards, community: view.community });
    }, 400);

    return () => clearTimeout(timer);
  }, [view.phase, view.myCards, view.community]);

  const myTurn = view.isMyTurn && !isShowdown;
  const toCall = view.lastAction && !view.lastAction.isMe && (view.lastAction.action === "raise" || view.lastAction.action === "call" || view.lastAction.action === "allin")
    ? view.lastAction.amount - view.myBet
    : view.opponentBet - view.myBet;

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-3 relative">
      {/* Equity overlay */}
      <AnimatePresence>
        {showEquity && canShowEquity && (
          <EquityOverlay result={equityResult} loading={equityLoading} />
        )}
      </AnimatePresence>

      {/* Confetti on win */}
      <Confetti active={didWin} />

      {/* All-in flash overlay */}
      <AnimatePresence>
        {allInFlash && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.4, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, times: [0, 0.15, 1] }}
            style={{ background: "radial-gradient(circle, rgba(250,204,21,0.4), transparent 70%)" }}
          />
        )}
      </AnimatePresence>

      {/* Header meta bar */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-[var(--pixel-muted)]">
          Hand #{view.handNumber} &middot; Blinds {sb}/{sb * 2}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-md"
                style={{ color: "var(--pixel-accent)", background: "color-mix(in oklab, var(--pixel-accent) 10%, transparent)", border: "1px solid color-mix(in oklab, var(--pixel-accent) 20%, transparent)" }}>
            {phaseName}
          </span>
          {canShowEquity && (
            <button
              onMouseDown={() => setShowEquity(true)}
              onMouseUp={() => setShowEquity(false)}
              onMouseLeave={() => setShowEquity(false)}
              onTouchStart={() => setShowEquity(true)}
              onTouchEnd={() => setShowEquity(false)}
              className="w-5 h-5 rounded-full border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] flex items-center justify-center font-mono text-[9px] font-bold text-[var(--pixel-muted)] hover:text-[var(--pixel-accent)] hover:border-[var(--pixel-accent)] transition-colors"
              title="Hold to show hand analysis (or hold SPACE)"
            >
              ?
            </button>
          )}
        </div>
      </div>

      {/* Opponent panel */}
      <div className="rounded-xl backdrop-blur-md p-3"
           style={{ background: D.oppBg, border: "1px solid var(--pixel-border)" }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <DealerChip show={!view.amDealer} />
            <span className="font-sans font-semibold text-xs text-[var(--pixel-text)]">OPPONENT</span>
            {view.opponentFolded && <span className="font-mono text-[9px] text-red-400">FOLDED</span>}
            {view.opponentAllIn && <span className="font-mono text-[9px] text-yellow-400">ALL IN</span>}
          </div>
          <AnimatedNumber value={view.opponentChips} className="font-mono text-sm font-bold text-[var(--pixel-accent)]" />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            {view.opponentCards ? (
              view.opponentCards.map((c, i) => {
                const hl = showBestCards && view.result!.iWon !== true && isInBestHand(c, view.result!.opponentBestCards);
                const dim = showBestCards && !isInBestHand(c, view.result!.opponentBestCards) && view.result!.iWon !== null;
                return <CardView key={i} card={c} small highlight={hl} dimmed={dim} delay={i * 0.12} />;
              })
            ) : (
              <>{[0, 1].map(i => (
                <motion.div key={i}
                  initial={false}
                  animate={isFoldWin && view.opponentFolded
                    ? { opacity: 0, y: -28, rotate: i === 0 ? -18 : -24 }
                    : { opacity: 1, y: 0, rotate: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.06, ease: "easeIn" }}
                >
                  <CardView faceDown small />
                </motion.div>
              ))}</>
            )}
          </div>
          {view.opponentBet > 0 && (
            <span className="ml-auto font-mono text-[10px] font-bold px-2 py-0.5 rounded-md"
                  style={{ color: "var(--pixel-accent-2)", background: "color-mix(in oklab, var(--pixel-accent-2) 8%, transparent)", border: "1px solid color-mix(in oklab, var(--pixel-accent-2) 20%, transparent)" }}>
              ${view.opponentBet}
            </span>
          )}
        </div>
        {isShowdown && view.result && !view.opponentFolded && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-1.5 font-mono text-[10px] text-[var(--pixel-muted)]"
          >
            {view.result.opponentHandDesc}
          </motion.div>
        )}
      </div>

      {/* Table center */}
      <div className="relative rounded-xl backdrop-blur-md p-4 flex flex-col items-center gap-3 overflow-hidden"
           style={{ background: D.tableBg, border: "1px solid " + D.tableBorder }}>
        {/* Top glow */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-12"
             style={{ background: "linear-gradient(180deg, color-mix(in oklab, var(--pixel-accent) 6%, transparent), transparent)" }} />
        <PhaseFlash phase={view.phase} handNumber={view.handNumber} />
        <div className="relative flex gap-2 min-h-[74px] items-center justify-center">
          {view.community.length === 0 ? (
            <span className="font-mono text-[10px] text-[var(--pixel-muted)]">Waiting for community cards...</span>
          ) : (
            view.community.map((c, i) => {
              const hl = showBestCards && isInBestHand(c, winnerBest);
              const dim = showBestCards && !isInBestHand(c, winnerBest);
              const isFresh = (view.phase === "turn" && i === 3) || (view.phase === "river" && i === 4);
              const isFlop = view.phase === "flop" && view.community.length === 3;
              const dealDelay = isFlop ? i * 0.1 : (isFresh ? 0 : i * 0.08);
              return <CardView key={i} card={c} highlight={hl} dimmed={dim} delay={dealDelay} fresh={isFresh} />;
            })
          )}
          {/* River glow burst */}
          <AnimatePresence>
            {view.phase === "river" && view.community.length === 5 && (
              <motion.div
                key={`river-glow-${view.handNumber}`}
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.3 }}
                  animate={{ opacity: [0, 0.8, 0], scale: 1 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  style={{ width: 140, height: 90, borderRadius: "50%", background: "radial-gradient(ellipse, color-mix(in oklab, var(--pixel-accent-2) 30%, transparent), transparent 70%)" }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <PotDisplay pot={view.pot} myBet={view.myBet} opponentBet={view.opponentBet} myChips={view.myChips} opponentChips={view.opponentChips} />
        {myTurn && toCall > 0 && (
          <PotOdds toCall={toCall} total={potTotal} equityPct={equityPct} />
        )}
        <ActionLog entries={actionLog} isMyTurn={myTurn} />
      </div>

      {/* Showdown result banner */}
      {isShowdown && view.result && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.92 }}
          animate={didLose
            ? { opacity: 1, y: 0, scale: 1, x: [0, -6, 6, -4, 4, -2, 2, 0] }
            : { opacity: 1, y: 0, scale: 1 }}
          transition={didLose
            ? { opacity: { type: "spring", stiffness: 300, damping: 24 }, y: { type: "spring", stiffness: 300, damping: 24 }, scale: { type: "spring", stiffness: 300, damping: 24 }, x: { duration: 0.5, delay: 0.2 } }
            : { type: "spring", stiffness: 300, damping: 24 }}
          className="rounded-xl p-4 text-center overflow-hidden relative backdrop-blur-md"
          style={{
            border: view.result.iWon === true
              ? "1px solid rgba(34,197,94,0.5)"
              : view.result.iWon === false
                ? "1px solid rgba(239,68,68,0.5)"
                : "1px solid rgba(234,179,8,0.5)",
            background: view.result.iWon === true
              ? "rgba(34,197,94,0.08)"
              : view.result.iWon === false
                ? "rgba(239,68,68,0.08)"
                : "rgba(234,179,8,0.08)",
          }}
        >
          {/* Shimmer overlay for winner */}
          {view.result.iWon === true && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-green-400/10 to-transparent"
              initial={{ x: "-100%" }}
              animate={{ x: "200%" }}
              transition={{ duration: 1.5, delay: 0.3, repeat: Infinity, repeatDelay: 2 }}
            />
          )}

          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.15 }}
            className={`font-sans font-bold text-xl relative ${
              view.result.iWon === true ? "text-green-400" : view.result.iWon === false ? "text-red-400" : "text-yellow-400"
            }`}
          >
            {view.result.iWon === true ? "YOU WIN!" : view.result.iWon === false ? "YOU LOSE" : "SPLIT POT"}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="font-mono text-xs text-[var(--pixel-muted)] mt-1.5 relative"
          >
            {view.result.winnerHand === "Fold" ? "Opponent folded" : (
              <span>
                {view.result.iWon === true ? "Your hand: " : view.result.iWon === false ? "Opponent's hand: " : "Both hands: "}
                <span className={view.result.iWon === true ? "text-green-400 font-semibold" : view.result.iWon === false ? "text-red-400 font-semibold" : "text-yellow-400 font-semibold"}>
                  {view.result.winnerHand}
                </span>
              </span>
            )}
          </motion.div>

          {/* Show both hand descriptions at showdown (non-fold) */}
          {!isFoldWin && view.result.myHandDesc && view.result.opponentHandDesc && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ delay: 0.55 }}
              className="mt-2 flex justify-center gap-4 font-mono text-[10px] relative"
            >
              <span className={view.result.iWon === true ? "text-green-400" : "text-[var(--pixel-muted)]"}>
                You: {view.result.myHandDesc}
              </span>
              <span className="text-[var(--pixel-muted)]">vs</span>
              <span className={view.result.iWon === false ? "text-red-400" : "text-[var(--pixel-muted)]"}>
                Opp: {view.result.opponentHandDesc}
              </span>
            </motion.div>
          )}

          {isRareHand && (
            <motion.div
              initial={{ opacity: 0, letterSpacing: "0em" }}
              animate={{ opacity: 1, letterSpacing: "0.08em" }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="font-mono text-[10px] font-bold mt-2"
              style={{ background: "linear-gradient(90deg, var(--pixel-warn), var(--pixel-accent-2), var(--pixel-warn))",
                       WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
            >
              {view.result!.winnerHand.toUpperCase()}
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-3 relative"
          >
            {isGameOver ? (
              <div className="space-y-2">
                <div className={`font-sans font-bold text-sm ${view.result.iWon === true ? "text-green-400" : "text-red-400"}`}>
                  {view.result.iWon === true ? "OPPONENT BUSTED!" : "YOU BUSTED!"}
                </div>
                <button
                  onClick={onRematch}
                  className="rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-accent)] px-6 py-2.5 font-sans font-semibold text-[11px] text-[var(--pixel-bg)] transition-transform hover:scale-[1.02]"
                >
                  REMATCH (500 each)
                </button>
              </div>
            ) : (
              <button
                onClick={onNextHand}
                className="rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-accent)] px-6 py-2.5 font-sans font-semibold text-[11px] text-[var(--pixel-bg)] transition-transform hover:scale-[1.02]"
              >
                NEXT HAND
              </button>
            )}
          </motion.div>
        </motion.div>
      )}

      {/* My panel */}
      <div className="rounded-xl backdrop-blur-md p-3 relative overflow-hidden"
           style={{
             background: D.panelBg,
             border: "1px solid " + (myTurn ? D.myTurnBorder : D.panelBorder),
             boxShadow: myTurn ? D.myTurnGlow : undefined,
           }}>
        {/* Pulse bar when it's my turn */}
        {myTurn && (
          <motion.div
            className="absolute inset-x-0 top-0 h-[2px]"
            style={{ background: "linear-gradient(90deg, transparent, var(--pixel-accent), transparent)" }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        {/* All-in rings */}
        <AnimatePresence>
          {allInFlash && view.myAllIn && (
            <>
              {[0, 1].map(i => (
                <motion.div key={`allin-ring-${i}`}
                  className="pointer-events-none absolute inset-0 rounded-xl"
                  style={{ border: "2px solid rgba(251,191,36,0.7)" }}
                  initial={{ opacity: 1, scale: 0.5 }}
                  animate={{ opacity: 0, scale: 1.18 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.7, delay: i * 0.15, ease: "easeOut" }}
                />
              ))}
            </>
          )}
        </AnimatePresence>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <DealerChip show={view.amDealer} />
            <span className="font-sans font-semibold text-xs text-[var(--pixel-accent)]">YOU</span>
            {myTurn && (
              <span className="font-mono text-[8px] font-bold tracking-widest px-1.5 py-0.5 rounded-md"
                    style={{ color: "var(--pixel-accent)", background: "color-mix(in oklab, var(--pixel-accent) 12%, transparent)", border: "1px solid color-mix(in oklab, var(--pixel-accent) 25%, transparent)" }}>
                YOUR TURN
              </span>
            )}
            {view.myFolded && <span className="font-mono text-[9px] text-red-400">FOLDED</span>}
            {view.myAllIn && <span className="font-mono text-[9px] text-yellow-400">ALL IN</span>}
          </div>
          <AnimatedNumber value={view.myChips} className="font-mono text-sm font-bold text-[var(--pixel-accent)]" />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            {view.myCards.map((c, i) => {
              const hl = showBestCards && view.result!.iWon !== false && isInBestHand(c, view.result!.myBestCards);
              const dim = showBestCards && !isInBestHand(c, view.result!.myBestCards) && view.result!.iWon !== null;
              return <CardView key={i} card={c} small highlight={hl} dimmed={dim} delay={i * 0.12} />;
            })}
          </div>
          <HandStrengthBadge myCards={view.myCards} community={view.community} />
          {view.myBet > 0 && (
            <span className="ml-auto font-mono text-[10px] font-bold px-2 py-0.5 rounded-md"
                  style={{ color: "var(--pixel-accent-2)", background: "color-mix(in oklab, var(--pixel-accent-2) 8%, transparent)", border: "1px solid color-mix(in oklab, var(--pixel-accent-2) 20%, transparent)" }}>
              ${view.myBet}
            </span>
          )}
        </div>
        <WinRateBar equityPct={equityPct} />
        {isShowdown && view.result && !view.myFolded && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-1.5 font-mono text-[10px] text-[var(--pixel-accent)]"
          >
            {view.result.myHandDesc}
          </motion.div>
        )}
      </div>

      {/* Action buttons — fixed height container prevents layout shift */}
      <div style={{ minHeight: myTurn && !isShowdown ? undefined : 0 }}>
        <AnimatePresence mode="wait">
          {myTurn && !isShowdown ? (
            <motion.div
              key="actions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <ActionBar view={view} onAction={onAction} />
            </motion.div>
          ) : !isShowdown && view.phase !== "waiting" ? (
            <motion.div
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="text-center py-3"
            >
              <span className="font-mono text-[10px] text-[var(--pixel-muted)] animate-pulse">
                Waiting for opponent...
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Equity hint */}
      {canShowEquity && !isShowdown && (
        <div className="text-center">
          <span className="font-mono text-[8px] text-[var(--pixel-muted)] opacity-60">
            <span className="hidden md:inline">Hold SPACE for hand analysis</span>
            <span className="md:hidden">Hold [?] for hand analysis</span>
          </span>
        </div>
      )}
    </div>
  );
}

// ── Connection celebration ──

function ConnectCelebration() {
  return (
    <motion.div
      key="celebration"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      className="mx-auto flex max-w-md flex-col items-center justify-center py-16"
    >
      {/* Expanding rings */}
      <div className="relative flex items-center justify-center mb-8">
        {[0, 0.3, 0.6].map((delay, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border-2 border-[var(--pixel-accent)]"
            initial={{ width: 20, height: 20, opacity: 0.8 }}
            animate={{ width: 120, height: 120, opacity: 0 }}
            transition={{ duration: 1.5, delay, repeat: Infinity, ease: "easeOut" }}
          />
        ))}
        {/* Center checkmark / connected icon */}
        <motion.div
          className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: "color-mix(in oklab, var(--pixel-accent) 15%, transparent)", border: "2px solid var(--pixel-accent)" }}
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.2, 1] }}
          transition={{ duration: 0.5, delay: 0.1, times: [0, 0.6, 1] }}
        >
          <motion.svg
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
            className="h-8 w-8 text-[var(--pixel-accent)]"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <motion.path d="M5 12l5 5L19 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.5 }} />
          </motion.svg>
        </motion.div>
      </div>

      {/* Text */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 300, damping: 24 }}
        className="text-center space-y-2"
      >
        <div className="font-sans font-bold text-xl"
             style={{ background: "linear-gradient(135deg, var(--pixel-accent), var(--pixel-accent-2))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          CONNECTED
        </div>
        <motion.div
          className="font-mono text-xs text-[var(--pixel-muted)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          Preparing the table...
        </motion.div>
      </motion.div>

      {/* Subtle card icons floating up */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {["♠", "♥", "♦", "♣"].map((suit, i) => (
          <motion.span
            key={suit}
            className="absolute text-2xl"
            style={{
              left: `${20 + i * 20}%`,
              bottom: "10%",
              color: suit === "♥" || suit === "♦" ? "rgba(239,68,68,0.3)" : "color-mix(in oklab, var(--pixel-accent) 30%, transparent)"
            }}
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: -200, opacity: [0, 0.6, 0] }}
            transition={{ duration: 2, delay: 0.3 + i * 0.2, ease: "easeOut" }}
          >
            {suit}
          </motion.span>
        ))}
      </div>
    </motion.div>
  );
}

// ── Page ──

const CONNECTION_DESC = [
  "> Share your ID with a friend",
  "> Or enter their ID to connect",
  "> Heads-up No-Limit Hold'em",
  "> 500 chips each, blinds double every 5 -> 10 -> 20 -> 40 -> ... hands",
];

export default function PokerPage() {
  const {
    gameMode, setGameMode, displayView, isGameOver,
    phase, localPeerId, error, isConnected, isReconnecting, reconnectDeadline, connectSubstep,
    connect, sendChat, clearError, retryLastConnection, reinitialize, joinPeerId, roomCode,
    latencyMs, lastRemoteMessageAt,
    chatMessages, addMyMessage,
    doAction, requestNextHand, requestRematch, exitToMenu,
  } = usePokerGame();

  const [showConnectCelebration, setShowConnectCelebration] = useState(false);
  const prevConnected = useRef(false);

  useEffect(() => {
    if (isConnected && !prevConnected.current) {
      setShowConnectCelebration(true);
      const t = setTimeout(() => setShowConnectCelebration(false), 2200);
      return () => clearTimeout(t);
    }
    prevConnected.current = isConnected;
  }, [isConnected]);

  const handleAction = useCallback((action: string, amount?: number) => {
    doAction(action as "fold" | "check" | "call" | "raise" | "allin", amount ?? 0);
  }, [doAction]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="fixed left-4 top-4 z-50 md:left-6 md:top-6">
        <Link href="/" className="inline-flex rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[10px] tracking-tight text-[var(--pixel-accent)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-md transition-colors hover:bg-[var(--pixel-bg-alt)] md:text-xs">
          &larr; BACK
        </Link>
      </motion.div>

      <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="fixed right-4 top-4 z-50 md:right-6 md:top-6">
        <ShareButton title="Texas Hold'em" text="Play heads-up Texas Hold'em poker with a friend via P2P — no signup needed!" />
      </motion.div>

      <div className="relative z-10 container mx-auto px-3 md:px-4 py-4 md:py-8 min-h-screen flex flex-col items-center justify-center">
        <motion.div initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-4 text-center md:mb-6">
          <h1
            className="mb-2 font-sans font-bold text-2xl tracking-tight md:text-5xl"
            style={{ background: "linear-gradient(135deg, var(--pixel-accent), var(--pixel-accent-2))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
          >
            TEXAS HOLD&apos;EM
          </h1>
          <p className="font-mono text-xs text-[var(--pixel-muted)] md:text-sm">
            &gt; Heads-up No-Limit Poker{isConnected ? " | P2P Connected" : ""}
          </p>
        </motion.div>

        <div className="w-full max-w-6xl">
          <AnimatePresence mode="wait">
            {gameMode === "menu" && (
              <motion.div key="menu" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }} transition={{ type: "spring", stiffness: 380, damping: 26 }} className="mx-auto flex max-w-md flex-col items-center gap-4">
                <div className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-5 text-center">
                  <h3 className="mb-3 font-sans font-semibold text-xs text-[var(--pixel-accent)]">GAME RULES</h3>
                  <div className="space-y-1 font-mono text-[11px] text-[var(--pixel-muted)] text-left">
                    <p>&gt; 2-player heads-up No-Limit Hold&apos;em</p>
                    <p>&gt; Each player starts with $500</p>
                    <p>&gt; Blinds start at 1/2</p>
                    <p>&gt; Blinds double every 5 -&gt; 10 -&gt; 20 -&gt; 40 -&gt; ... hands</p>
                    <p>&gt; Play until someone busts!</p>
                  </div>
                </div>
                <button
                  onClick={() => setGameMode("p2p")}
                  className="w-full rounded-xl border border-[var(--pixel-accent-2)] bg-[var(--pixel-card-bg)] px-8 py-4 font-sans font-semibold text-sm tracking-tight text-[var(--pixel-accent-2)] shadow-xl shadow-[var(--pixel-glow)] transition-[transform,background-color] duration-150 hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
                >
                  PLAY P2P
                </button>
              </motion.div>
            )}

            {gameMode === "p2p" && !isConnected && !showConnectCelebration && (
              <motion.div key="p2p" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }} transition={{ type: "spring", stiffness: 380, damping: 26 }}>
                <P2PConnectionPanel
                  localPeerId={localPeerId}
                  phase={phase}
                  connectTimeoutMs={P2P_CONNECT_TIMEOUT_MS}
                  error={error}
                  title="POKER_P2P"
                  description={CONNECTION_DESC}
                  autoConnectPeerId={joinPeerId}
                  onConnect={connect}
                  onRetry={retryLastConnection}
                  onClearError={clearError}
                  onReinitialize={reinitialize}
                  roomCode={roomCode}
                  connectSubstep={connectSubstep}
                />
                <div className="mt-4 flex justify-center">
                  <button onClick={exitToMenu} className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] backdrop-blur-md px-4 py-2 font-sans font-semibold text-[10px] text-[var(--pixel-muted)]">
                    MENU
                  </button>
                </div>
              </motion.div>
            )}

            {showConnectCelebration && (
              <ConnectCelebration />
            )}

            {gameMode === "p2p" && isConnected && displayView && !showConnectCelebration && (
              <motion.div key="game" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }} transition={{ type: "spring", stiffness: 380, damping: 26 }}>
                <div className="w-full max-w-md mx-auto flex flex-col gap-2 mb-2 px-1">
                  <ChipBar myChips={displayView.myChips} opponentChips={displayView.opponentChips} />
                  <BlindProgress handNumber={displayView.handNumber} smallBlind={displayView.smallBlind} />
                </div>
                <PokerTable
                  view={displayView}
                  isGameOver={isGameOver}
                  onAction={handleAction}
                  onNextHand={requestNextHand}
                  onRematch={requestRematch}
                />
                <div className="mt-4 flex justify-center">
                  <button onClick={exitToMenu} className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] backdrop-blur-md px-4 py-2 font-sans font-semibold text-[10px] text-[var(--pixel-muted)]">
                    MENU
                  </button>
                </div>
              </motion.div>
            )}

            {gameMode === "p2p" && isConnected && !displayView && !showConnectCelebration && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
                <span className="font-mono text-sm text-[var(--pixel-muted)] animate-pulse">Dealing cards...</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {gameMode === "p2p" && isConnected && (
        <P2PStatusPanel
          isConnected={isConnected}
          phase={phase}
          role={localPeerId ? "connected" : "unknown"}
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
