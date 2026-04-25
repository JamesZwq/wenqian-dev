"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import P2PConnectionPanel from "../../features/p2p/components/P2PConnectionPanel";
import { P2PChat } from "../../features/p2p/components/P2PChat";
import { P2P_CONNECT_TIMEOUT_MS } from "../../features/p2p/config";
import ShareButton from "../components/ShareButton";
import Confetti from "../components/Confetti";
import { ReconnectingOverlay } from "@/features/p2p/components/ReconnectingOverlay";
import { usePatternGame } from "./hooks/usePatternGame";
import { PatternBoard } from "./components/PatternBoard";

const ACCENT = "#a855f7";

const CONNECTION_DESCRIPTION = [
  "> Share your ID with a friend",
  "> Or enter their ID to connect",
  "> Host generates the sequence — same pattern for both",
];

export default function PatternPage() {
  const {
    gameMode, setGameMode,
    myIndex,
    sequence, round, status, playerInputIndex, activeColor,
    bestRound, isNewBest,
    oppRound, oppGameOver, oppFinalRound,
    phase, localPeerId, error, isConnected, connect, sendChat, clearError, retryLastConnection, reinitialize, roomCode, connectSubstep,
    joinPeerId, isReconnecting, reconnectDeadline,
    chatMessages, addMyMessage,
    handleClick, startSolo, requestNewGame, exitToMenu,
  } = usePatternGame();

  const isGameActive = gameMode === "solo" || (gameMode === "p2p" && isConnected);
  const isHost = myIndex === 0;
  const isGuest = myIndex === 1;

  const myFinalRound = status === "game_over" ? Math.max(0, round - 1) : round - 1;

  // P2P win logic: both fail → highest round wins; you alive but opponent fails first → keep going
  const youWonP2P =
    gameMode === "p2p" &&
    status === "game_over" &&
    oppGameOver &&
    oppFinalRound !== null &&
    myFinalRound > oppFinalRound;

  const tied =
    gameMode === "p2p" &&
    status === "game_over" &&
    oppGameOver &&
    oppFinalRound !== null &&
    myFinalRound === oppFinalRound;

  const showConfetti =
    (gameMode === "solo" && status === "game_over" && isNewBest && myFinalRound > 0) ||
    (gameMode === "p2p" && youWonP2P);

  const statusMsg = (() => {
    if (status === "showing") return "Watch carefully...";
    if (status === "input") return "Your turn — repeat the pattern";
    if (status === "game_over") {
      if (gameMode === "solo") return `WRONG! Final round: ${myFinalRound}`;
      if (youWonP2P) return `YOU WIN! Final round: ${myFinalRound}`;
      if (tied) return `TIE! Both reached round ${myFinalRound}`;
      if (oppGameOver) return `Opponent reached ${oppFinalRound}, you reached ${myFinalRound}`;
      return `Final round: ${myFinalRound} — opponent still playing...`;
    }
    return "Press START to begin";
  })();

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Back button */}
      <AnimatePresence>
        {gameMode !== "menu" && (
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            className="fixed left-4 top-4 z-50 md:left-6 md:top-6"
          >
            {isGameActive ? (
              <button
                onClick={exitToMenu}
                className="inline-flex rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[10px] tracking-tight text-[var(--pixel-accent)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-md transition-colors hover:bg-[var(--pixel-bg-alt)] md:text-xs"
              >
                ← BACK
              </button>
            ) : (
              <button
                onClick={() => setGameMode("menu")}
                className="inline-flex rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[10px] tracking-tight text-[var(--pixel-accent)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-md transition-colors hover:bg-[var(--pixel-bg-alt)] md:text-xs"
              >
                ← BACK
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back to home (menu only) */}
      {gameMode === "menu" && (
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          className="fixed left-4 top-4 z-50 md:left-6 md:top-6"
        >
          <Link
            href="/"
            className="inline-flex rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[10px] tracking-tight text-[var(--pixel-accent)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-md transition-colors hover:bg-[var(--pixel-bg-alt)] md:text-xs"
          >
            ← HOME
          </Link>
        </motion.div>
      )}

      {/* Share button */}
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        className="fixed right-4 top-4 z-50 md:right-6 md:top-6"
      >
        <ShareButton
          title="Pattern — Memory Test"
          text="Watch the color sequence, then repeat it. How many rounds can you remember? Solo or P2P!"
        />
      </motion.div>

      <div className="relative z-10 container mx-auto px-3 md:px-4 py-4 md:py-8 min-h-screen flex flex-col items-center justify-center">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="mb-4 text-center md:mb-6"
        >
          <h1
            className="mb-1 font-sans font-semibold text-2xl tracking-tight md:text-5xl"
            style={{ color: ACCENT }}
          >
            PATTERN
          </h1>
          <p className="font-mono text-xs text-[var(--pixel-muted)] md:text-sm">
            {gameMode === "menu" && "> Watch the sequence, then repeat — how many rounds can you remember?"}
            {gameMode === "p2p" && !isConnected && "> P2P — same sequence, highest round wins"}
            {isGameActive && `> ${gameMode === "solo" ? "Solo" : isHost ? "P2P Host" : "P2P Guest"}`}
          </p>
        </motion.div>

        <div className="w-full max-w-6xl">
          <AnimatePresence mode="wait">
            {/* ─── Menu ─── */}
            {gameMode === "menu" && (
              <motion.div
                key="menu"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
                className="mx-auto flex max-w-md flex-col items-center gap-4"
              >
                {/* Solo */}
                <div className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-5">
                  <h3 className="mb-1 font-sans font-semibold text-xs" style={{ color: ACCENT }}>SOLO</h3>
                  <p className="mb-4 font-mono text-[10px] text-[var(--pixel-muted)]">
                    &gt; Best round: {bestRound !== null ? bestRound : "— — —"}
                  </p>
                  <button
                    onClick={startSolo}
                    className="w-full rounded-xl border bg-[var(--pixel-card-bg)] px-8 py-4 font-sans font-semibold text-sm tracking-tight shadow-xl shadow-[var(--pixel-glow)] transition-[transform,background-color] duration-150 hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
                    style={{ borderColor: ACCENT, color: ACCENT }}
                  >
                    START SOLO
                  </button>
                </div>

                {/* P2P */}
                <div className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-5">
                  <h3 className="mb-1 font-sans font-semibold text-xs text-[var(--pixel-accent-2)]">P2P RACE</h3>
                  <p className="mb-4 font-mono text-[10px] text-[var(--pixel-muted)]">&gt; Both see the same sequence — highest round wins</p>
                  <button
                    onClick={() => setGameMode("p2p")}
                    className="w-full rounded-xl border border-[var(--pixel-accent-2)] bg-[var(--pixel-card-bg)] px-8 py-4 font-sans font-semibold text-sm tracking-tight text-[var(--pixel-accent-2)] shadow-xl shadow-[var(--pixel-glow)] transition-[transform,background-color] duration-150 hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
                  >
                    P2P ONLINE
                  </button>
                </div>
              </motion.div>
            )}

            {/* ─── P2P Connection ─── */}
            {gameMode === "p2p" && !isConnected && (
              <motion.div
                key="p2p-connect"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
              >
                <P2PConnectionPanel
                  localPeerId={localPeerId}
                  phase={phase}
                  connectTimeoutMs={P2P_CONNECT_TIMEOUT_MS}
                  error={error}
                  title="PATTERN_P2P"
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
                    onClick={() => setGameMode("menu")}
                    className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[10px] text-[var(--pixel-muted)]"
                  >
                    MENU
                  </button>
                </div>
              </motion.div>
            )}

            {/* ─── Game ─── */}
            {isGameActive && sequence.length > 0 && (
              <motion.div
                key="game"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
                className="flex flex-col items-center gap-3 md:gap-4"
              >
                {/* Header — round + best */}
                <div className="flex w-full max-w-xl items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="font-mono text-[10px] uppercase text-[var(--pixel-muted)]">Round</span>
                    <span
                      className="font-sans text-4xl md:text-5xl font-bold leading-none"
                      style={{ color: ACCENT }}
                    >
                      {round}
                    </span>
                  </div>

                  <div className="flex flex-col items-center">
                    <span className="font-mono text-[10px] uppercase text-[var(--pixel-muted)]">Status</span>
                    <span
                      className={`font-mono text-xs md:text-sm font-bold leading-tight text-center max-w-[16rem] ${
                        status === "game_over"
                          ? youWonP2P || (gameMode === "solo" && isNewBest)
                            ? "text-[var(--pixel-accent)]"
                            : "text-[var(--pixel-warn)]"
                          : "text-[var(--pixel-text)]"
                      }`}
                    >
                      {statusMsg}
                    </span>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="font-mono text-[10px] uppercase text-[var(--pixel-muted)]">Best</span>
                    <span className="font-mono text-lg md:text-xl font-bold leading-none text-[var(--pixel-text)]">
                      {bestRound !== null ? bestRound : "—"}
                    </span>
                  </div>
                </div>

                {/* P2P opponent panel */}
                {gameMode === "p2p" && (
                  <div className="w-full max-w-xl rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-3">
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span className="text-[var(--pixel-accent-2)]">{isHost ? "GUEST" : "HOST"}</span>
                      <span className="text-[var(--pixel-muted)]">
                        Round {oppRound}
                        {oppGameOver && oppFinalRound !== null && ` — final ${oppFinalRound}`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Board */}
                <PatternBoard
                  activeColor={activeColor}
                  onColorClick={handleClick}
                  disabled={status !== "input"}
                />

                {/* Progress dots — show progress in current round */}
                <div className="flex flex-wrap gap-1.5 max-w-xl justify-center">
                  {Array.from({ length: round }).map((_, i) => {
                    const filled = status === "input" ? i < playerInputIndex : status === "showing" ? false : status === "game_over" ? i < playerInputIndex : false;
                    return (
                      <span
                        key={i}
                        className="block h-2 w-2 rounded-full transition-colors"
                        style={{
                          backgroundColor: filled ? ACCENT : "var(--pixel-border)",
                        }}
                      />
                    );
                  })}
                </div>

                {/* Result banner */}
                {status === "game_over" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`w-full max-w-xl rounded-xl border p-4 text-center font-mono ${
                      gameMode === "solo"
                        ? isNewBest
                          ? "border-[var(--pixel-accent)] text-[var(--pixel-accent)]"
                          : "border-[var(--pixel-warn)] text-[var(--pixel-warn)]"
                        : youWonP2P
                          ? "border-[var(--pixel-accent)] text-[var(--pixel-accent)]"
                          : oppGameOver && oppFinalRound !== null && oppFinalRound > myFinalRound
                            ? "border-[var(--pixel-warn)] text-[var(--pixel-warn)]"
                            : "border-[var(--pixel-muted)] text-[var(--pixel-muted)]"
                    }`}
                  >
                    {gameMode === "solo" && (
                      <>
                        <p className="text-sm font-bold">GAME OVER — Final round: {myFinalRound}</p>
                        {isNewBest && myFinalRound > 0 && (
                          <p className="mt-1 text-xs text-[var(--pixel-accent)]">★ NEW BEST ★</p>
                        )}
                      </>
                    )}
                    {gameMode === "p2p" && (
                      <>
                        <p className="text-sm font-bold">
                          {!oppGameOver
                            ? `You finished at round ${myFinalRound} — waiting for opponent...`
                            : youWonP2P
                              ? `YOU WIN! ${myFinalRound} vs ${oppFinalRound}`
                              : tied
                                ? `TIE — both reached ${myFinalRound}`
                                : `OPPONENT WINS. ${myFinalRound} vs ${oppFinalRound}`}
                        </p>
                      </>
                    )}
                  </motion.div>
                )}

                {/* Controls */}
                <div className="flex gap-2 w-full max-w-xl">
                  {status === "game_over" && (gameMode === "solo" || isHost) && (
                    <button
                      onClick={requestNewGame}
                      className="flex-1 rounded-xl border px-4 py-2.5 font-sans font-semibold text-xs transition-transform hover:scale-[1.02]"
                      style={{
                        borderColor: ACCENT,
                        backgroundColor: ACCENT,
                        color: "var(--pixel-bg)",
                      }}
                    >
                      {gameMode === "solo" ? "NEW GAME" : "REMATCH"}
                    </button>
                  )}
                  {status === "game_over" && gameMode === "p2p" && isGuest && (
                    <div className="flex-1 rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2.5 text-center font-mono text-[10px] text-[var(--pixel-muted)]">
                      Waiting for host...
                    </div>
                  )}
                  <button
                    onClick={exitToMenu}
                    className="flex-1 rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2.5 font-sans font-semibold text-xs text-[var(--pixel-muted)] transition-colors hover:text-[var(--pixel-accent)]"
                  >
                    MENU
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <Confetti active={showConfetti} />

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
