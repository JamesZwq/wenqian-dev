"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import P2PConnectionPanel from "../../features/p2p/components/P2PConnectionPanel";
import { P2PChat } from "../../features/p2p/components/P2PChat";
import { P2P_CONNECT_TIMEOUT_MS } from "../../features/p2p/config";
import ShareButton from "../components/ShareButton";
import { useSudokuGame, formatTime } from "./hooks/useSudokuGame";
import { SudokuBoard } from "./components/SudokuBoard";
import type { Difficulty } from "./types";

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "EASY",
  medium: "MEDIUM",
  hard: "HARD",
};

const CONNECTION_DESCRIPTION = [
  "> Share your ID with a friend",
  "> Or enter their ID to connect",
  "> Host generates the puzzle — same board for both",
];

function ProgressBar({ value, max, color = "accent" }: { value: number; max: number; color?: "accent" | "accent-2" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-[var(--pixel-border)] overflow-hidden">
      <motion.div
        className={`h-full rounded-full bg-[var(--pixel-${color})]`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.3 }}
      />
    </div>
  );
}

export default function SudokuPage() {
  const {
    gameMode, setGameMode,
    difficulty, setDifficulty,
    myIndex,
    board, locked, conflicts, solution, selectedCell,
    status, elapsedTime, bestTimes, isNewBest,
    opponentCorrect, opponentComplete, opponentTime,
    correctCount, totalToFill,
    phase, localPeerId, error, isConnected, connect, sendChat, clearError, retryLastConnection, reinitialize, roomCode,
    joinPeerId,
    chatMessages, addMyMessage,
    handleCellSelect, handleCellInput, startSolo, requestNewGame, exitToMenu,
  } = useSudokuGame();

  const isGameActive = gameMode === "solo" || (gameMode === "p2p" && isConnected);
  const isHost = myIndex === 0;
  const isGuest = myIndex === 1;

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

      {/* Back to home button (always visible in menu) */}
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
          title="Sudoku — P2P Race"
          text="Play Sudoku solo or race a friend P2P — no signup, same puzzle, fastest solver wins!"
        />
      </motion.div>

      <div className="relative z-10 container mx-auto px-3 md:px-4 py-4 md:py-8 min-h-screen flex flex-col items-center justify-center">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mb-4 text-center md:mb-6"
        >
          <h1 className="mb-1 font-sans font-semibold text-2xl tracking-tight text-[var(--pixel-accent)] md:text-5xl">
            SUDOKU
          </h1>
          <p className="font-mono text-xs text-[var(--pixel-muted)] md:text-sm">
            {gameMode === "menu" && "> Fill the grid — no repeats in row, column, or box"}
            {gameMode === "p2p" && !isConnected && "> P2P — same puzzle, first to finish wins"}
            {isGameActive && `> ${DIFFICULTY_LABELS[difficulty]} | ${gameMode === "solo" ? "Solo" : isHost ? "P2P Host" : "P2P Guest"}`}
          </p>
        </motion.div>

        <div className="w-full max-w-6xl">
          <AnimatePresence mode="wait">
            {/* ─── Menu ─── */}
            {gameMode === "menu" && (
              <motion.div
                key="menu"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                className="mx-auto flex max-w-md flex-col items-center gap-4"
              >
                {/* Solo */}
                <div className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-5">
                  <h3 className="mb-1 font-sans font-semibold text-xs text-[var(--pixel-accent)]">SOLO</h3>
                  <p className="mb-4 font-mono text-[10px] text-[var(--pixel-muted)]">&gt; Best times recorded per difficulty</p>
                  <div className="flex flex-col gap-2">
                    {(["easy", "medium", "hard"] as Difficulty[]).map(diff => (
                      <button
                        key={diff}
                        onClick={() => startSolo(diff)}
                        className="group flex items-center justify-between w-full rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-card-bg)] px-4 py-3 font-sans font-semibold text-sm tracking-tight text-[var(--pixel-accent)] transition-all hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
                      >
                        <span>{DIFFICULTY_LABELS[diff]}</span>
                        <span className="font-mono text-[10px] text-[var(--pixel-muted)] group-hover:text-[var(--pixel-accent)]">
                          {bestTimes[diff] !== null ? `BEST: ${formatTime(bestTimes[diff]!)}` : "NO RECORD"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* P2P */}
                <div className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-5">
                  <h3 className="mb-1 font-sans font-semibold text-xs text-[var(--pixel-accent-2)]">P2P RACE</h3>
                  <p className="mb-4 font-mono text-[10px] text-[var(--pixel-muted)]">&gt; Select difficulty, then connect to a friend</p>
                  <div className="mb-3 flex gap-2">
                    {(["easy", "medium", "hard"] as Difficulty[]).map(diff => (
                      <button
                        key={diff}
                        onClick={() => setDifficulty(diff)}
                        className={`flex-1 rounded-xl border px-2 py-2 font-sans font-semibold text-[10px] transition-all hover:scale-[1.02] ${
                          difficulty === diff
                            ? "border-[var(--pixel-accent-2)] bg-[color-mix(in_oklab,var(--pixel-accent-2)_15%,transparent)] text-[var(--pixel-accent-2)]"
                            : "border-[var(--pixel-border)] bg-transparent text-[var(--pixel-muted)] hover:border-[var(--pixel-accent-2)] hover:text-[var(--pixel-accent-2)]"
                        }`}
                      >
                        {DIFFICULTY_LABELS[diff]}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setGameMode("p2p")}
                    className="w-full rounded-xl border border-[var(--pixel-accent-2)] bg-[var(--pixel-card-bg)] px-8 py-4 font-sans font-semibold text-sm tracking-tight text-[var(--pixel-accent-2)] shadow-xl shadow-[var(--pixel-glow)] transition-all hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
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
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
              >
                <P2PConnectionPanel
                  localPeerId={localPeerId}
                  phase={phase}
                  connectTimeoutMs={P2P_CONNECT_TIMEOUT_MS}
                  error={error}
                  title="SUDOKU_P2P"
                  description={CONNECTION_DESCRIPTION}
                  autoConnectPeerId={joinPeerId}
                  onConnect={connect}
                  onRetry={retryLastConnection}
                  onClearError={clearError}
                  onReinitialize={reinitialize}
                  roomCode={roomCode}
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
            {isGameActive && board.length > 0 && (
              <motion.div
                key="game"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                className="flex flex-col items-center gap-3 md:gap-4"
              >
                {/* Mobile compact status */}
                <div className="flex w-full items-center justify-center gap-2 md:hidden">
                  <div className={`rounded-lg border px-3 py-1.5 font-mono text-[10px] ${
                    status === "complete"
                      ? "border-[var(--pixel-accent)] text-[var(--pixel-accent)]"
                      : "border-[var(--pixel-border)] text-[var(--pixel-muted)]"
                  }`}>
                    {status === "complete" ? (isNewBest && gameMode === "solo" ? "NEW BEST!" : "DONE!") : formatTime(elapsedTime)}
                  </div>
                  <div className="rounded-lg border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-3 py-1.5 font-mono text-[10px] text-[var(--pixel-accent)]">
                    {correctCount}/{totalToFill}
                  </div>
                  {gameMode === "p2p" && (
                    <div className="rounded-lg border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-3 py-1.5 font-mono text-[10px] text-[var(--pixel-accent-2)]">
                      OPP: {opponentCorrect}/{totalToFill}
                    </div>
                  )}
                </div>

                {/* Main layout */}
                <div className="flex flex-col lg:flex-row gap-3 md:gap-6 w-full justify-center">
                  {/* Desktop sidebar */}
                  <div className="hidden lg:block lg:w-64 space-y-3">
                    {/* Timer */}
                    <div className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-4">
                      <h3 className="mb-2 font-sans font-semibold text-[10px] text-[var(--pixel-accent)]">TIMER</h3>
                      <div className={`font-mono text-2xl font-bold ${status === "complete" ? "text-[var(--pixel-accent)]" : "text-[var(--pixel-text)]"}`}>
                        {formatTime(status === "complete" ? elapsedTime : elapsedTime)}
                      </div>
                      {gameMode === "solo" && bestTimes[difficulty] !== null && (
                        <div className="mt-1 font-mono text-[10px] text-[var(--pixel-muted)]">
                          BEST: {formatTime(bestTimes[difficulty]!)}
                        </div>
                      )}
                      {status === "complete" && isNewBest && gameMode === "solo" && (
                        <div className="mt-2 rounded-lg border border-[var(--pixel-accent)] px-2 py-1 font-mono text-[10px] text-[var(--pixel-accent)]">
                          NEW BEST!
                        </div>
                      )}
                    </div>

                    {/* Progress */}
                    <div className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-4">
                      <h3 className="mb-3 font-sans font-semibold text-[10px] text-[var(--pixel-accent)]">
                        {gameMode === "p2p" ? "RACE PROGRESS" : "PROGRESS"}
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <div className="mb-1 flex justify-between font-mono text-[10px]">
                            <span className="text-[var(--pixel-text)]">{gameMode === "p2p" ? (isHost ? "You (Host)" : "You (Guest)") : "You"}</span>
                            <span className="text-[var(--pixel-accent)]">{correctCount} / {totalToFill}</span>
                          </div>
                          <ProgressBar value={correctCount} max={totalToFill} color="accent" />
                        </div>
                        {gameMode === "p2p" && (
                          <div>
                            <div className="mb-1 flex justify-between font-mono text-[10px]">
                              <span className="text-[var(--pixel-text)]">{isHost ? "Guest" : "Host"}</span>
                              <span className="text-[var(--pixel-accent-2)]">{opponentCorrect} / {totalToFill}</span>
                            </div>
                            <ProgressBar value={opponentCorrect} max={totalToFill} color="accent-2" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-4">
                      <h3 className="mb-2 font-sans font-semibold text-[10px] text-[var(--pixel-accent)]">STATUS</h3>
                      <div className="space-y-1 font-mono text-xs">
                        {status === "playing" && (
                          <p className="text-[var(--pixel-text)]">&gt; {gameMode === "p2p" ? "Race in progress" : "Solving..."}</p>
                        )}
                        {status === "complete" && gameMode === "solo" && (
                          <p className="text-[var(--pixel-accent)]">&gt; Puzzle solved!</p>
                        )}
                        {status === "complete" && gameMode === "p2p" && (
                          <>
                            <p className="text-[var(--pixel-accent)]">&gt; Your time: {formatTime(elapsedTime)}</p>
                            {opponentComplete && opponentTime !== null && (
                              <p className={elapsedTime <= opponentTime ? "text-[var(--pixel-accent)]" : "text-[var(--pixel-warn)]"}>
                                &gt; {isHost ? "Guest" : "Host"}: {formatTime(opponentTime)}
                              </p>
                            )}
                            {opponentComplete && opponentTime !== null && (
                              <p className={`font-bold ${elapsedTime <= opponentTime ? "text-[var(--pixel-accent)]" : "text-[var(--pixel-warn)]"}`}>
                                &gt; {elapsedTime <= opponentTime ? "You win!" : "Opponent wins!"}
                              </p>
                            )}
                            {!opponentComplete && (
                              <p className="text-[var(--pixel-muted)]">&gt; Waiting for opponent...</p>
                            )}
                          </>
                        )}
                        {status === "playing" && gameMode === "p2p" && opponentComplete && (
                          <p className="text-[var(--pixel-warn)]">&gt; Opponent finished! Finish up!</p>
                        )}
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="space-y-2">
                      {status === "complete" && (isHost || gameMode === "solo") && (
                        <button
                          onClick={requestNewGame}
                          className="w-full rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-accent)] px-4 py-3 font-sans font-semibold text-[10px] text-[var(--pixel-bg)] transition-transform hover:scale-[1.02]"
                        >
                          NEW GAME
                        </button>
                      )}
                      {status === "complete" && isGuest && gameMode === "p2p" && (
                        <p className="text-center font-mono text-[10px] text-[var(--pixel-muted)]">Waiting for host to start new game...</p>
                      )}
                      <button
                        onClick={exitToMenu}
                        className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[10px] text-[var(--pixel-muted)] transition-colors hover:text-[var(--pixel-accent)]"
                      >
                        MENU
                      </button>
                    </div>

                    {/* Keyboard hint */}
                    <div className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-bg)]/50 p-3">
                      <p className="font-mono text-[9px] text-[var(--pixel-muted)] space-y-1">
                        <span className="block">&gt; Click cell, type 1–9</span>
                        <span className="block">&gt; Arrow keys to navigate</span>
                        <span className="block">&gt; Delete/0 to clear</span>
                      </p>
                    </div>
                  </div>

                  {/* Board */}
                  <div className="flex items-center justify-center">
                    <SudokuBoard
                      board={board}
                      locked={locked}
                      conflicts={conflicts}
                      solution={solution}
                      selectedCell={selectedCell}
                      onCellSelect={handleCellSelect}
                      onNumberInput={(v) => {
                        if (selectedCell) handleCellInput(selectedCell.row, selectedCell.col, v);
                      }}
                      showNumberPad={true}
                    />
                  </div>
                </div>

                {/* Mobile bottom controls */}
                <div className="flex flex-col items-center gap-2 w-full max-w-xs md:hidden">
                  {status === "complete" && (
                    <div className={`w-full rounded-xl border p-3 text-center font-mono text-xs ${
                      gameMode === "solo"
                        ? "border-[var(--pixel-accent)] text-[var(--pixel-accent)]"
                        : opponentComplete && opponentTime !== null
                          ? elapsedTime <= opponentTime
                            ? "border-[var(--pixel-accent)] text-[var(--pixel-accent)]"
                            : "border-[var(--pixel-warn)] text-[var(--pixel-warn)]"
                          : "border-[var(--pixel-muted)] text-[var(--pixel-muted)]"
                    }`}>
                      {gameMode === "solo" && (isNewBest ? `NEW BEST! ${formatTime(elapsedTime)}` : `Done! ${formatTime(elapsedTime)}`)}
                      {gameMode === "p2p" && opponentComplete && opponentTime !== null && (
                        elapsedTime <= opponentTime ? `You win! ${formatTime(elapsedTime)}` : `Opponent wins! You: ${formatTime(elapsedTime)}`
                      )}
                      {gameMode === "p2p" && !opponentComplete && "You finished! Waiting for opponent..."}
                    </div>
                  )}
                  {status === "playing" && gameMode === "p2p" && opponentComplete && (
                    <div className="w-full rounded-xl border border-[var(--pixel-warn)] p-2 text-center font-mono text-[10px] text-[var(--pixel-warn)]">
                      Opponent finished — keep going!
                    </div>
                  )}
                  <div className="flex gap-2 w-full">
                    {status === "complete" && (isHost || gameMode === "solo") && (
                      <button
                        onClick={requestNewGame}
                        className="flex-1 rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-accent)] px-4 py-2.5 font-sans font-semibold text-[10px] text-[var(--pixel-bg)]"
                      >
                        NEW GAME
                      </button>
                    )}
                    <button
                      onClick={exitToMenu}
                      className="flex-1 rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2.5 font-sans font-semibold text-[10px] text-[var(--pixel-muted)]"
                    >
                      MENU
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <P2PChat
        messages={chatMessages}
        onSend={(text) => { if (sendChat(text)) addMyMessage(text); }}
        isConnected={gameMode === "p2p" && isConnected}
      />
    </div>
  );
}
