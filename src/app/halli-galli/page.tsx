"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import P2PConnectionPanel from "@/features/p2p/components/P2PConnectionPanel";
import { P2PStatusPanel } from "@/features/p2p/components/P2PStatusPanel";
import { P2PChat } from "@/features/p2p/components/P2PChat";
import { P2P_CONNECT_TIMEOUT_MS } from "@/features/p2p/config";
import ShareButton from "../components/ShareButton";
import { useHalliGalliGame } from "./hooks/useHalliGalliGame";
import { FRUIT_EMOJI, FRUIT_COLOR, type HalliCard } from "./types";

const CONNECTION_DESCRIPTION = [
  "> Share your ID with a friend",
  "> Or enter their ID to connect",
  "> Ring when any fruit total = 5!",
];

// ── Card components ──────────────────────────────────────────���───

function CardFace({ card, keyId }: { card: HalliCard; keyId?: string }) {
  return (
    <motion.div
      key={keyId}
      initial={{ rotateY: 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="w-[72px] h-24 md:w-20 md:h-28 rounded-xl border-2 border-gray-200 bg-white flex flex-col items-center justify-center gap-1.5 shadow-md p-1.5 flex-shrink-0"
    >
      {card.fruits.map(({ fruit, count }) => (
        <div key={fruit} className="flex items-center gap-1">
          <span className="text-lg leading-none">{FRUIT_EMOJI[fruit]}</span>
          <span className="font-bold text-sm leading-none tabular-nums" style={{ color: FRUIT_COLOR[fruit] }}>
            ×{count}
          </span>
        </div>
      ))}
    </motion.div>
  );
}

function CardBack({ count }: { count: number }) {
  return (
    <div className="relative w-[72px] h-24 md:w-20 md:h-28 flex-shrink-0">
      <div className="w-full h-full rounded-xl border-2 border-[var(--pixel-border)] bg-gradient-to-br from-[var(--pixel-card-bg)] to-[var(--pixel-bg-alt)] flex items-center justify-center shadow-md">
        <div className="w-3/5 h-3/5 rounded-lg border border-[var(--pixel-border)] opacity-25" />
      </div>
      <div className="absolute -bottom-1.5 -right-1.5 rounded-full bg-[var(--pixel-accent)] min-w-[20px] px-1 py-0.5 text-center font-mono text-[10px] font-bold text-[var(--pixel-bg)]">
        {count}
      </div>
    </div>
  );
}

function EmptyCard() {
  return (
    <div className="w-[72px] h-24 md:w-20 md:h-28 rounded-xl border-2 border-dashed border-[var(--pixel-border)] opacity-20 flex-shrink-0" />
  );
}

// ── Player area ──────────────────────────────────────────────────

function PlayerArea({
  label,
  role,
  slot1,
  slot2,
  deckCount,
  isActive,
}: {
  label: string;
  role: string;
  slot1: HalliCard | null;
  slot2: HalliCard | null;
  deckCount: number;
  isActive: boolean;
}) {
  return (
    <div className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-3 md:p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-sans font-semibold text-[10px] uppercase tracking-wide text-[var(--pixel-accent)]">
            {label}
          </span>
          <span className="font-mono text-[10px] text-[var(--pixel-muted)]">{role}</span>
        </div>
        {isActive && (
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.1, repeat: Infinity }}
            className="font-mono text-[10px] text-[var(--pixel-accent-2)]"
          >
            ● FLIPPING...
          </motion.span>
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        {/* Pos 1 (older) */}
        <div className="flex flex-col items-center gap-1">
          <span className="font-mono text-[9px] uppercase tracking-wide text-[var(--pixel-muted)]">Pos 1</span>
          <AnimatePresence mode="wait">
            {slot1
              ? <CardFace key={slot1.fruits.map(f => f.fruit + f.count).join("-")} card={slot1} />
              : <EmptyCard key="e1" />
            }
          </AnimatePresence>
        </div>

        {/* Pos 2 (newer) */}
        <div className="flex flex-col items-center gap-1">
          <span className="font-mono text-[9px] uppercase tracking-wide text-[var(--pixel-muted)]">Pos 2</span>
          <AnimatePresence mode="wait">
            {slot2
              ? <CardFace key={slot2.fruits.map(f => f.fruit + f.count).join("-")} card={slot2} />
              : <EmptyCard key="e2" />
            }
          </AnimatePresence>
        </div>

        {/* Face-down deck */}
        {deckCount > 0 ? <CardBack count={deckCount} /> : <EmptyCard />}
      </div>
    </div>
  );
}


// ── Main page ────────────────────────────────────────────────────

export default function HalliGalliPage() {
  const {
    gameMode, setGameMode, myIndex, myView,
    phase, localPeerId, error, isConnected,
    connect, sendChat, clearError, retryLastConnection, reinitialize, joinPeerId,
    latencyMs, lastRemoteMessageAt,
    chatMessages, addMyMessage,
    doFlip, doBell, doRematch, exitToMenu,
  } = useHalliGalliGame();

  const canFlip = myView?.phase === "playing" && myView.isMyTurn && myView.myDeckCount > 0;
  const hasCards = myView && (myView.mySlot1 || myView.mySlot2 || myView.oppSlot1 || myView.oppSlot2);
  const canBell = myView?.phase === "playing" && !!hasCards;

  // Spacebar → ring bell
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        if (canBell) doBell();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canBell, doBell]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Back button */}
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        className="fixed left-4 top-4 z-50 md:left-6 md:top-6"
      >
        <Link
          href="/"
          className="inline-flex rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[10px] tracking-tight text-[var(--pixel-accent)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-md transition-colors hover:bg-[var(--pixel-bg-alt)] md:text-xs"
        >
          ← BACK
        </Link>
      </motion.div>

      {/* Share button */}
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        className="fixed right-4 top-4 z-50 md:right-6 md:top-6"
      >
        <ShareButton
          title="Halli Galli"
          text="Play Halli Galli online with a friend via P2P — ring the bell when any fruit totals 5!"
        />
      </motion.div>

      <div className="relative z-10 container mx-auto px-3 md:px-4 py-4 md:py-8 min-h-screen flex flex-col items-center justify-center">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mb-4 text-center md:mb-8"
        >
          <h1 className="mb-2 font-sans font-semibold text-2xl tracking-tight text-[var(--pixel-accent)] md:text-5xl">
            HALLI GALLI
          </h1>
          <p className="font-mono text-xs text-[var(--pixel-muted)] md:text-sm">
            &gt; Ring the bell when any fruit total = 5
            {isConnected ? " | P2P Connected" : ""}
          </p>
        </motion.div>

        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            {/* ── Menu ── */}
            {gameMode === "menu" && (
              <motion.div
                key="menu"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                className="mx-auto flex max-w-md flex-col items-center gap-4"
              >
                <div className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-5">
                  <h3 className="mb-3 font-sans font-semibold text-xs text-[var(--pixel-accent)]">HOW TO PLAY</h3>
                  <div className="space-y-1 font-mono text-[11px] text-[var(--pixel-muted)]">
                    <p>&gt; Each player has 2 card positions (Pos 1 &amp; Pos 2)</p>
                    <p>&gt; Take turns flipping — Pos 1 first, then Pos 2</p>
                    <p>&gt; Cards can show multiple fruit types 🍓🍌🍋🍇</p>
                    <p>&gt; When any fruit totals exactly <span className="text-[var(--pixel-accent)]">5</span>, ring the bell!</p>
                    <p>&gt; Press <span className="text-[var(--pixel-accent-2)]">Space</span> or click the bell button</p>
                    <p>&gt; Wrong ring = opponent takes all visible cards!</p>
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

            {/* ── P2P Connection ── */}
            {gameMode === "p2p" && !isConnected && (
              <motion.div
                key="connect"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
              >
                <P2PConnectionPanel
                  localPeerId={localPeerId}
                  phase={phase}
                  connectTimeoutMs={P2P_CONNECT_TIMEOUT_MS}
                  error={error}
                  title="HALLI_GALLI_P2P"
                  description={CONNECTION_DESCRIPTION}
                  autoConnectPeerId={joinPeerId}
                  onConnect={connect}
                  onRetry={retryLastConnection}
                  onClearError={clearError}
                  onReinitialize={reinitialize}
                />
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={exitToMenu}
                    className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[10px] text-[var(--pixel-muted)]"
                  >
                    MENU
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Game ── */}
            {gameMode === "p2p" && isConnected && (
              <motion.div
                key="game"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                className="flex flex-col items-center gap-3 md:gap-4"
              >
                {!myView ? (
                  <div className="py-20 text-center">
                    <span className="font-mono text-sm text-[var(--pixel-muted)] animate-pulse">
                      Dealing cards...
                    </span>
                  </div>
                ) : (
                  <>
                    {/* Opponent */}
                    <PlayerArea
                      label="Opponent"
                      role={myIndex === 0 ? "guest" : "host"}
                      slot1={myView.oppSlot1}
                      slot2={myView.oppSlot2}
                      deckCount={myView.oppDeckCount}
                      isActive={!myView.isMyTurn && myView.phase === "playing"}
                    />

                    {/* Bell result banner */}
                    <AnimatePresence>
                      {myView.lastBell && (
                        <motion.div
                          key={`bell-${myView.lastBell.valid}-${myView.lastBell.iWon}`}
                          initial={{ opacity: 0, y: -6, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          className={`w-full rounded-xl border px-4 py-2 text-center font-mono text-sm ${
                            myView.lastBell.valid && myView.lastBell.iWon
                              ? "border-[var(--pixel-accent)] text-[var(--pixel-accent)]"
                              : myView.lastBell.valid && !myView.lastBell.iWon
                                ? "border-[var(--pixel-warn)] text-[var(--pixel-warn)]"
                                : !myView.lastBell.valid && myView.lastBell.iWon
                                  ? "border-[var(--pixel-warn)] text-[var(--pixel-warn)]"
                                  : "border-[var(--pixel-accent)] text-[var(--pixel-accent)]"
                          }`}
                        >
                          {myView.lastBell.valid
                            ? myView.lastBell.iWon
                              ? "🔔 You rang first — pile is yours!"
                              : "🔔 Opponent rang first!"
                            : myView.lastBell.iWon
                              ? "✗ Wrong bell — opponent takes the pile!"
                              : "✗ Opponent wrong bell — pile is yours!"
                          }
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Game over */}
                    {myView.phase === "game_over" && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-card-bg)] p-5 text-center"
                      >
                        <div className="mb-1 font-mono text-[10px] text-[var(--pixel-muted)] uppercase tracking-wide">
                          Game Over
                        </div>
                        <div className="mb-4 font-sans font-bold text-3xl text-[var(--pixel-accent)]">
                          {myView.iWon ? "🏆 You Win!" : "😔 You Lose"}
                        </div>
                        <button
                          onClick={doRematch}
                          className="rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-accent)] px-6 py-2.5 font-sans font-semibold text-sm text-[var(--pixel-bg)] transition-transform hover:scale-[1.02]"
                        >
                          REMATCH
                        </button>
                      </motion.div>
                    )}

                    {/* Bell button */}
                    {myView.phase === "playing" && (
                      <motion.button
                        whileTap={{ scale: 0.93 }}
                        onClick={doBell}
                        disabled={!canBell}
                        className={`w-full rounded-2xl border-2 py-5 font-sans font-bold text-2xl tracking-tight transition-all select-none ${
                          canBell
                            ? "border-[var(--pixel-warn)] bg-[var(--pixel-warn)] text-[var(--pixel-bg)] shadow-lg hover:scale-[1.01] active:scale-[0.97] cursor-pointer"
                            : "border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] text-[var(--pixel-muted)] opacity-40 cursor-not-allowed"
                        }`}
                      >
                        🔔 RING THE BELL
                        <span className="ml-2 font-mono text-sm font-normal opacity-60">[Space]</span>
                      </motion.button>
                    )}

                    {/* My area */}
                    <PlayerArea
                      label="You"
                      role={myIndex === 0 ? "host" : "guest"}
                      slot1={myView.mySlot1}
                      slot2={myView.mySlot2}
                      deckCount={myView.myDeckCount}
                      isActive={myView.isMyTurn && myView.phase === "playing"}
                    />

                    {/* Flip + Menu */}
                    <div className="flex gap-2 w-full">
                      {myView.phase === "playing" && (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={doFlip}
                          disabled={!canFlip}
                          className={`flex-1 rounded-xl border py-3 font-sans font-semibold text-sm transition-all ${
                            canFlip
                              ? "border-[var(--pixel-accent)] bg-[var(--pixel-accent)] text-[var(--pixel-bg)] hover:scale-[1.02] cursor-pointer"
                              : "border-[var(--pixel-border)] text-[var(--pixel-muted)] opacity-40 cursor-not-allowed"
                          }`}
                        >
                          FLIP
                          {canFlip && <span className="ml-1 text-xs font-mono font-normal opacity-70">({myView.myDeckCount})</span>}
                        </motion.button>
                      )}
                      <button
                        onClick={exitToMenu}
                        className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-3 font-sans font-semibold text-[10px] text-[var(--pixel-muted)] transition-colors hover:text-[var(--pixel-accent)]"
                      >
                        MENU
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* P2P Status Panel */}
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
    </div>
  );
}
