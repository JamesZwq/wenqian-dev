"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import P2PConnectionPanel from "@/features/p2p/components/P2PConnectionPanel";
import { P2P_CONNECT_TIMEOUT_MS } from "@/features/p2p/config";
import ShareButton from "../components/ShareButton";
import { usePokerGame } from "./hooks/usePokerGame";
import type { Card, PlayerView } from "./types";
import { rankStr, suitSymbol, suitColor, getActions, getBlindLevel } from "./utils";

// ── Card component ──

function CardView({ card, faceDown, small }: { card?: Card | null; faceDown?: boolean; small?: boolean }) {
  const w = small ? "w-9 h-[52px]" : "w-[52px] h-[74px]";
  if (faceDown || !card) {
    return (
      <div className={`${w} rounded-lg border-2 border-blue-400/30 bg-gradient-to-br from-blue-900 to-indigo-800 flex items-center justify-center shadow-md`}>
        <div className="w-3/5 h-3/5 rounded-sm border border-blue-400/20 bg-blue-800/60" />
      </div>
    );
  }
  const c = suitColor(card.suit);
  const fs = small ? "text-[10px]" : "text-xs";
  const ss = small ? "text-base" : "text-xl";
  return (
    <motion.div
      initial={{ rotateY: 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`${w} rounded-lg border border-gray-300 bg-white flex flex-col items-center justify-center relative shadow-md`}
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
  const halfPot = Math.max(Math.floor(potTotal / 2), acts.minRaiseTo);
  const fullPot = Math.max(potTotal, acts.minRaiseTo);

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
            <button onClick={() => setRaiseVal(acts.minRaiseTo)} className="raise-quick-btn">MIN</button>
            {halfPot <= acts.maxRaiseTo && <button onClick={() => setRaiseVal(Math.min(halfPot, acts.maxRaiseTo))} className="raise-quick-btn">1/2 POT</button>}
            {fullPot <= acts.maxRaiseTo && <button onClick={() => setRaiseVal(Math.min(fullPot, acts.maxRaiseTo))} className="raise-quick-btn">POT</button>}
            <button onClick={() => setRaiseVal(acts.maxRaiseTo)} className="raise-quick-btn">ALL IN</button>
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
          className="flex-1 rounded-xl border border-red-500/60 bg-red-500/10 px-3 py-3 font-sans font-semibold text-[11px] text-red-400 transition-all hover:bg-red-500/20"
        >
          FOLD
        </button>
        {acts.canCheck ? (
          <button
            onClick={() => onAction("check")}
            className="flex-1 rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/10 px-3 py-3 font-sans font-semibold text-[11px] text-[var(--pixel-accent)] transition-all hover:bg-[var(--pixel-accent)]/20"
          >
            CHECK
          </button>
        ) : (
          <button
            onClick={() => onAction(acts.callIsAllIn ? "allin" : "call")}
            className="flex-1 rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/10 px-3 py-3 font-sans font-semibold text-[11px] text-[var(--pixel-accent)] transition-all hover:bg-[var(--pixel-accent)]/20"
          >
            {acts.callIsAllIn ? `ALL IN $${acts.callAmount}` : `CALL $${acts.callAmount}`}
          </button>
        )}
        {acts.canRaise && !showRaise && (
          <button
            onClick={() => setShowRaise(true)}
            className="flex-1 rounded-xl border border-yellow-500/60 bg-yellow-500/10 px-3 py-3 font-sans font-semibold text-[11px] text-yellow-400 transition-all hover:bg-yellow-500/20"
          >
            RAISE
          </button>
        )}
      </div>
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
  const potTotal = view.pot + view.myBet + view.opponentBet;
  const phaseName = view.phase === "preflop" ? "PRE-FLOP" : view.phase.toUpperCase();
  const sb = view.smallBlind;
  const isShowdown = view.phase === "showdown";

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
    <div className="w-full max-w-md mx-auto flex flex-col gap-3">
      {/* Header info */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-[var(--pixel-muted)]">
          Hand #{view.handNumber} &middot; Blinds {sb}/{sb * 2}
        </span>
        <span className="font-mono text-[10px] text-[var(--pixel-muted)]">{phaseName}</span>
      </div>

      {/* Opponent area */}
      <div className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-3">
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
              view.opponentCards.map((c, i) => <CardView key={i} card={c} small />)
            ) : (
              <><CardView faceDown small /><CardView faceDown small /></>
            )}
          </div>
          {view.opponentBet > 0 && (
            <span className="ml-auto font-mono text-xs text-[var(--pixel-accent-2)]">Bet: ${view.opponentBet}</span>
          )}
        </div>
        {isShowdown && view.result && !view.opponentFolded && (
          <div className="mt-1 font-mono text-[10px] text-[var(--pixel-muted)]">{view.result.opponentHandDesc}</div>
        )}
      </div>

      {/* Community cards + pot */}
      <div className="rounded-xl border border-[var(--pixel-border)] bg-gradient-to-b from-emerald-900/30 to-emerald-950/30 p-4 flex flex-col items-center gap-3">
        <div className="flex gap-2 min-h-[74px] items-center justify-center">
          {view.community.length === 0 ? (
            <span className="font-mono text-[10px] text-[var(--pixel-muted)]">Waiting for community cards...</span>
          ) : (
            view.community.map((c, i) => <CardView key={i} card={c} />)
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-[var(--pixel-muted)]">POT</span>
          <span className="font-mono text-lg font-bold text-yellow-400">${potTotal}</span>
        </div>
        {/* Last action */}
        {view.lastAction && (
          <span className="font-mono text-[10px] text-[var(--pixel-muted)]">{lastActionLabel()}</span>
        )}
      </div>

      {/* Showdown result */}
      {isShowdown && view.result && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`rounded-xl border p-3 text-center ${
            view.result.iWon === true
              ? "border-green-500/60 bg-green-500/10"
              : view.result.iWon === false
                ? "border-red-500/60 bg-red-500/10"
                : "border-yellow-500/60 bg-yellow-500/10"
          }`}
        >
          <div className={`font-sans font-bold text-lg ${
            view.result.iWon === true ? "text-green-400" : view.result.iWon === false ? "text-red-400" : "text-yellow-400"
          }`}>
            {view.result.iWon === true ? "YOU WIN!" : view.result.iWon === false ? "YOU LOSE" : "SPLIT POT"}
          </div>
          <div className="font-mono text-[10px] text-[var(--pixel-muted)] mt-1">
            {view.result.winnerHand === "Fold" ? "Opponent folded" : view.result.winnerHand}
          </div>
          <div className="mt-3">
            {isGameOver ? (
              <button
                onClick={onRematch}
                className="rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-accent)] px-6 py-2.5 font-sans font-semibold text-[11px] text-[var(--pixel-bg)] transition-transform hover:scale-[1.02]"
              >
                REMATCH (500 each)
              </button>
            ) : (
              <button
                onClick={onNextHand}
                className="rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-accent)] px-6 py-2.5 font-sans font-semibold text-[11px] text-[var(--pixel-bg)] transition-transform hover:scale-[1.02]"
              >
                NEXT HAND
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* My area */}
      <div className="rounded-xl border border-[var(--pixel-accent)]/30 bg-[var(--pixel-card-bg)] p-3">
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
            {view.myCards.map((c, i) => <CardView key={i} card={c} small />)}
          </div>
          {view.myBet > 0 && (
            <span className="ml-auto font-mono text-xs text-[var(--pixel-accent-2)]">Bet: ${view.myBet}</span>
          )}
        </div>
        {isShowdown && view.result && !view.myFolded && (
          <div className="mt-1 font-mono text-[10px] text-[var(--pixel-accent)]">{view.result.myHandDesc}</div>
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
    </div>
  );
}

// ── Page ──

const CONNECTION_DESC = [
  "> Share your ID with a friend",
  "> Or enter their ID to connect",
  "> Heads-up No-Limit Hold'em",
  "> 500 chips each, blinds double every 5 hands",
];

export default function PokerPage() {
  const {
    gameMode, setGameMode, displayView, isGameOver,
    phase, localPeerId, error, isConnected,
    connect, clearError, retryLastConnection, reinitialize, joinPeerId,
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
                    <p>&gt; Blinds double every 5 hands</p>
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
                />
                <div className="mt-4 flex justify-center">
                  <button onClick={exitToMenu} className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[10px] text-[var(--pixel-muted)]">
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
                  <button onClick={exitToMenu} className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[10px] text-[var(--pixel-muted)]">
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
    </div>
  );
}
