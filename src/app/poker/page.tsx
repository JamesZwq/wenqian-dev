"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";
import P2PConnectionPanel from "@/features/p2p/components/P2PConnectionPanel";
import { P2PStatusPanel } from "@/features/p2p/components/P2PStatusPanel";
import { P2PChat } from "@/features/p2p/components/P2PChat";
import { P2P_CONNECT_TIMEOUT_MS } from "@/features/p2p/config";
import ShareButton from "../components/ShareButton";
import { usePokerGame } from "./hooks/usePokerGame";
import type { Card, PlayerView } from "./types";
import { rankStr, suitSymbol, suitColor, getActions, isInBestHand } from "./utils";
import { calcEquity, type EquityResult } from "./equity";

// ── Card component ──

function CardView({ card, faceDown, small, highlight, dimmed, delay }: {
  card?: Card | null; faceDown?: boolean; small?: boolean;
  highlight?: boolean; dimmed?: boolean; delay?: number;
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
      initial={{ rotateY: 90, opacity: 0 }}
      animate={highlight
        ? { rotateY: 0, opacity: 1, scale: [1, 1.08, 1], boxShadow: ["0 0 0px rgba(250,204,21,0)", "0 0 18px rgba(250,204,21,0.7)", "0 0 10px rgba(250,204,21,0.5)"] }
        : { rotateY: 0, opacity: dimmed ? 0.35 : 1 }}
      transition={highlight
        ? { rotateY: { duration: 0.3, delay: delay ?? 0 }, scale: { duration: 0.5, delay: (delay ?? 0) + 0.3, repeat: Infinity, repeatType: "reverse" }, boxShadow: { duration: 0.5, delay: (delay ?? 0) + 0.3, repeat: Infinity, repeatType: "reverse" }, opacity: { duration: 0.3, delay: delay ?? 0 } }
        : { duration: 0.3, delay: delay ?? 0 }}
      className={`${w} rounded-lg border-2 ${highlight ? "border-yellow-400" : "border-gray-300 dark:border-gray-500"} bg-white flex flex-col items-center justify-center relative shadow-md dark:shadow-black/30`}
      style={highlight ? { zIndex: 2 } : undefined}
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
          className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] backdrop-blur-md p-3 space-y-2"
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
              className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] backdrop-blur-md px-3 py-2.5 font-sans font-semibold text-[10px] text-[var(--pixel-muted)]"
            >
              CANCEL
            </button>
          </div>
        </motion.div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onAction("fold")}
          className="flex-1 rounded-xl border border-red-500/60 bg-red-500/10 dark:bg-red-500/20 backdrop-blur-md px-3 py-3 font-sans font-semibold text-[11px] text-red-400 dark:text-red-300 transition-all hover:bg-red-500/20 dark:hover:bg-red-500/30"
        >
          FOLD
        </button>
        {acts.canCheck ? (
          <button
            onClick={() => onAction("check")}
            className="flex-1 rounded-xl border border-[var(--pixel-accent)]/40 bg-[var(--pixel-card-bg)] backdrop-blur-md px-3 py-3 font-sans font-semibold text-[11px] text-[var(--pixel-accent)] transition-all hover:border-[var(--pixel-accent)] hover:bg-[var(--pixel-accent)]/10"
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
              className="relative z-10 w-full rounded-xl border border-[var(--pixel-accent-2)] bg-[var(--pixel-accent-2)]/15 dark:bg-[var(--pixel-accent-2)]/20 backdrop-blur-md px-3 py-3 font-sans font-semibold text-[11px] text-[var(--pixel-accent-2)] transition-all hover:bg-[var(--pixel-accent-2)]/25 dark:hover:bg-[var(--pixel-accent-2)]/30"
            >
              <span className="block">{acts.callIsAllIn ? "ALL IN" : "CALL"}</span>
              <span className="block text-[9px] font-mono opacity-80">${acts.callAmount}</span>
            </button>
          </div>
        )}
        {acts.canRaise && !showRaise && (
          <button
            onClick={() => setShowRaise(true)}
            className="flex-1 rounded-xl border border-yellow-500/60 dark:border-yellow-400/50 bg-yellow-500/10 dark:bg-yellow-500/20 backdrop-blur-md px-3 py-3 font-sans font-semibold text-[11px] text-yellow-500 dark:text-yellow-300 transition-all hover:bg-yellow-500/20 dark:hover:bg-yellow-500/30"
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
                      transition={{ duration: 0.4, ease: "easeOut" }}
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

// ── Poker table ──

function PokerTable({ view, isGameOver, onAction, onNextHand, onRematch }: {
  view: PlayerView;
  isGameOver: boolean;
  onAction: (a: string, amt?: number) => void;
  onNextHand: () => void;
  onRematch: () => void;
}) {
  // ── Equity analysis (hold SPACE / tap ?) ──
  const [showEquity, setShowEquity] = useState(false);
  const [equityResult, setEquityResult] = useState<EquityResult | null>(null);
  const [equityLoading, setEquityLoading] = useState(false);
  const equityCacheKey = useRef("");
  const canShowEquity = view.phase !== "showdown" && view.phase !== "waiting" && view.myCards.length === 2;

  // Compute equity on demand
  useEffect(() => {
    if (!showEquity || !canShowEquity) return;
    const key = view.myCards.map(c => `${c.rank}${c.suit}`).join(",") + "|" + view.community.map(c => `${c.rank}${c.suit}`).join(",");
    if (equityCacheKey.current === key && equityResult) return; // cached
    equityCacheKey.current = key;
    setEquityLoading(true);
    setEquityResult(null);
    // Defer to next frame so "Computing..." renders first
    const raf = requestAnimationFrame(() => {
      const r = calcEquity(view.myCards, view.community);
      setEquityResult(r);
      setEquityLoading(false);
    });
    return () => cancelAnimationFrame(raf);
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

  const potTotal = view.pot + view.myBet + view.opponentBet;
  const phaseName = view.phase === "preflop" ? "PRE-FLOP" : view.phase.toUpperCase();
  const sb = view.smallBlind;
  const isShowdown = view.phase === "showdown";
  const isFoldWin = isShowdown && view.result?.winnerHand === "Fold";
  const showBestCards = isShowdown && !isFoldWin && view.result;

  // Determine which cards to highlight at showdown
  // Winner's best 5 cards glow; loser's non-best cards are dimmed
  const winnerBest = showBestCards
    ? (view.result!.iWon === true ? view.result!.myBestCards
       : view.result!.iWon === false ? view.result!.opponentBestCards
       : view.result!.myBestCards) // tie: highlight both
    : [];

  const lastActionLabel = useCallback(() => {
    if (!view.lastAction) return null;
    const who = view.lastAction.isMe ? "You" : "Opponent";
    const a = view.lastAction.action.toUpperCase();
    const amt = view.lastAction.action === "raise" ? ` to $${view.lastAction.amount}` :
                view.lastAction.action === "call" ? ` $${view.lastAction.amount}` :
                view.lastAction.action === "allin" ? " ALL IN" : "";
    return `${who}: ${a}${amt}`;
  }, [view.lastAction]);

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-3 relative">
      {/* Equity overlay */}
      <AnimatePresence>
        {showEquity && canShowEquity && (
          <EquityOverlay result={equityResult} loading={equityLoading} />
        )}
      </AnimatePresence>

      {/* Header info */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-[var(--pixel-muted)]">
          Hand #{view.handNumber} &middot; Blinds {sb}/{sb * 2}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-[var(--pixel-muted)]">{phaseName}</span>
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

      {/* Opponent area */}
      <div className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] backdrop-blur-md p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <DealerChip show={!view.amDealer} />
            <span className="font-sans font-semibold text-xs text-[var(--pixel-text)]">OPPONENT</span>
            {view.opponentFolded && <span className="font-mono text-[9px] text-red-400">FOLDED</span>}
            {view.opponentAllIn && <span className="font-mono text-[9px] text-yellow-400">ALL IN</span>}
          </div>
          <span className="font-mono text-sm font-bold text-[var(--pixel-accent)]">${view.opponentChips}</span>
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
              <><CardView faceDown small dimmed={isFoldWin && view.opponentFolded} /><CardView faceDown small dimmed={isFoldWin && view.opponentFolded} /></>
            )}
          </div>
          {view.opponentBet > 0 && (
            <span className="ml-auto font-mono text-xs text-[var(--pixel-accent-2)]">Bet: ${view.opponentBet}</span>
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

      {/* Community cards + pot */}
      <div className="rounded-xl border border-[var(--pixel-border)] bg-gradient-to-b from-emerald-900/20 to-emerald-950/20 dark:from-emerald-900/40 dark:to-emerald-950/40 backdrop-blur-md p-4 flex flex-col items-center gap-3">
        <div className="flex gap-2 min-h-[74px] items-center justify-center">
          {view.community.length === 0 ? (
            <span className="font-mono text-[10px] text-[var(--pixel-muted)]">Waiting for community cards...</span>
          ) : (
            view.community.map((c, i) => {
              const hl = showBestCards && isInBestHand(c, winnerBest);
              const dim = showBestCards && !isInBestHand(c, winnerBest);
              return <CardView key={i} card={c} highlight={hl} dimmed={dim} delay={i * 0.08} />;
            })
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-[var(--pixel-muted)]">POT</span>
          <span className="font-mono text-lg font-bold text-yellow-500 dark:text-yellow-300">${potTotal}</span>
        </div>
        {/* Last action */}
        {view.lastAction && (
          <span className="font-mono text-[10px] text-[var(--pixel-muted)]">{lastActionLabel()}</span>
        )}
      </div>

      {/* Showdown result */}
      {isShowdown && view.result && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className={`rounded-xl border p-4 text-center overflow-hidden relative backdrop-blur-md ${
            view.result.iWon === true
              ? "border-green-500/60 bg-green-500/10 dark:bg-green-500/15"
              : view.result.iWon === false
                ? "border-red-500/60 bg-red-500/10 dark:bg-red-500/15"
                : "border-yellow-500/60 bg-yellow-500/10 dark:bg-yellow-500/15"
          }`}
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

      {/* My area */}
      <div className="rounded-xl border border-[var(--pixel-accent)]/40 dark:border-[var(--pixel-accent)]/50 bg-[var(--pixel-card-bg)] backdrop-blur-md p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <DealerChip show={view.amDealer} />
            <span className="font-sans font-semibold text-xs text-[var(--pixel-accent)]">YOU</span>
            {view.myFolded && <span className="font-mono text-[9px] text-red-400">FOLDED</span>}
            {view.myAllIn && <span className="font-mono text-[9px] text-yellow-400">ALL IN</span>}
          </div>
          <span className="font-mono text-sm font-bold text-[var(--pixel-accent)]">${view.myChips}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            {view.myCards.map((c, i) => {
              const hl = showBestCards && view.result!.iWon !== false && isInBestHand(c, view.result!.myBestCards);
              const dim = showBestCards && !isInBestHand(c, view.result!.myBestCards) && view.result!.iWon !== null;
              return <CardView key={i} card={c} small highlight={hl} dimmed={dim} delay={i * 0.12} />;
            })}
          </div>
          {view.myBet > 0 && (
            <span className="ml-auto font-mono text-xs text-[var(--pixel-accent-2)]">Bet: ${view.myBet}</span>
          )}
        </div>
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

      {/* Action buttons */}
      {view.isMyTurn && !isShowdown && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <ActionBar view={view} onAction={onAction} />
        </motion.div>
      )}

      {/* Waiting indicator */}
      {!view.isMyTurn && !isShowdown && view.phase !== "waiting" && (
        <div className="text-center py-2">
          <span className="font-mono text-[10px] text-[var(--pixel-muted)] animate-pulse">
            Waiting for opponent...
          </span>
        </div>
      )}

      {/* Help hint */}
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
    phase, localPeerId, error, isConnected,
    connect, sendChat, clearError, retryLastConnection, reinitialize, joinPeerId, roomCode,
    latencyMs, lastRemoteMessageAt,
    chatMessages, addMyMessage,
    doAction, requestNextHand, requestRematch, exitToMenu,
  } = usePokerGame();

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
          <h1 className="mb-2 font-sans font-semibold text-2xl tracking-tight text-[var(--pixel-accent)] md:text-5xl">
            TEXAS HOLD&apos;EM
          </h1>
          <p className="font-mono text-xs text-[var(--pixel-muted)] md:text-sm">
            &gt; Heads-up No-Limit Poker{isConnected ? " | P2P Connected" : ""}
          </p>
        </motion.div>

        <div className="w-full max-w-6xl">
          <AnimatePresence mode="wait">
            {gameMode === "menu" && (
              <motion.div key="menu" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} className="mx-auto flex max-w-md flex-col items-center gap-4">
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
                  className="w-full rounded-xl border border-[var(--pixel-accent-2)] bg-[var(--pixel-card-bg)] px-8 py-4 font-sans font-semibold text-sm tracking-tight text-[var(--pixel-accent-2)] shadow-xl shadow-[var(--pixel-glow)] transition-all hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
                >
                  PLAY P2P
                </button>
              </motion.div>
            )}

            {gameMode === "p2p" && !isConnected && (
              <motion.div key="p2p" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}>
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
                />
                <div className="mt-4 flex justify-center">
                  <button onClick={exitToMenu} className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] backdrop-blur-md px-4 py-2 font-sans font-semibold text-[10px] text-[var(--pixel-muted)]">
                    MENU
                  </button>
                </div>
              </motion.div>
            )}

            {gameMode === "p2p" && isConnected && displayView && (
              <motion.div key="game" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}>
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

            {gameMode === "p2p" && isConnected && !displayView && (
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
    </div>
  );
}
