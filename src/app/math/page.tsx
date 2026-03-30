"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import P2PConnectionPanel from "../../features/p2p/components/P2PConnectionPanel";
import { P2P_CONNECT_TIMEOUT_MS } from "../../features/p2p/config";
import { useMathGame } from "./hooks/useMathGame";
import { ALL_OPS, QUESTION_COUNTS, formatTime, opsLabel } from "./types";
import ShareButton from "../components/ShareButton";

const CONNECTION_DESCRIPTION = [
  "> Share your ID with a friend",
  "> Or enter their ID to connect",
  "> Host picks settings, then race!",
];

export default function MathSprintPage() {
  const {
    selectedOps, toggleOp, totalQuestions, setTotalQuestions, bestSpeed,
    gameMode, setGameMode, questions, currentIndex, inputValue,
    flashColor, shaking, elapsed, result, isNewRecord, resultOps, resultCount,
    direction, opponentProgress, opponentFinished,
    phase, localPeerId, error, isConnected, connect, clearError, retryLastConnection, reinitialize,
    joinPeerId, inputRef,
    startSolo, startP2pGame, exitToMenu, handleRematch, handleInputChange,
    speed, isPlaying, showP2pSettings, showP2pWaiting, showGame,
  } = useMathGame();

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
          title="Math Sprint"
          text="Speed arithmetic challenge — solo or P2P online race! How fast can you do mental math?"
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
            MATH SPRINT
          </h1>
          <p className="font-mono text-xs text-[var(--pixel-muted)] md:text-sm">
            &gt; Speed arithmetic challenge
            {gameMode === "solo" ? " | Solo" : gameMode === "p2p" ? " | P2P" : ""}
          </p>
        </motion.div>

        <div className="w-full max-w-2xl">
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
                {/* Operations */}
                <div className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-5">
                  <h3 className="mb-4 font-sans font-semibold text-xs text-[var(--pixel-accent)]">OPERATIONS</h3>
                  <div className="flex flex-wrap gap-2">
                    {ALL_OPS.map(({ op, label }) => (
                      <button
                        key={op}
                        onClick={() => toggleOp(op)}
                        className={`min-w-[48px] rounded-xl border px-4 py-3 font-mono text-lg font-bold transition-all hover:scale-[1.05] ${
                          selectedOps.includes(op)
                            ? "border-[var(--pixel-accent)] bg-[var(--pixel-accent)] text-[var(--pixel-bg)]"
                            : "border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] text-[var(--pixel-muted)]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question count */}
                <div className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-5">
                  <h3 className="mb-4 font-sans font-semibold text-xs text-[var(--pixel-accent)]">QUESTIONS</h3>
                  <div className="flex gap-2">
                    {QUESTION_COUNTS.map(n => (
                      <button
                        key={n}
                        onClick={() => setTotalQuestions(n)}
                        className={`flex-1 rounded-xl border px-4 py-3 font-sans font-semibold text-sm transition-all hover:scale-[1.02] ${
                          totalQuestions === n
                            ? "border-[var(--pixel-accent)] bg-[var(--pixel-accent)] text-[var(--pixel-bg)]"
                            : "border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] text-[var(--pixel-muted)]"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Best speed */}
                {bestSpeed !== null && (
                  <div className="w-full rounded-xl border border-[var(--pixel-accent)]/30 bg-[var(--pixel-card-bg)] px-5 py-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-[var(--pixel-muted)]">
                        Best ({opsLabel(selectedOps)} / {totalQuestions}Q)
                      </span>
                      <span className="font-mono text-sm font-bold text-[var(--pixel-accent)]">
                        {bestSpeed.toFixed(1)} /min
                      </span>
                    </div>
                  </div>
                )}

                {/* Start buttons */}
                <button
                  onClick={startSolo}
                  className="w-full rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-card-bg)] px-8 py-4 font-sans font-semibold text-sm tracking-tight text-[var(--pixel-accent)] shadow-xl shadow-[var(--pixel-glow)] transition-all hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
                >
                  SOLO
                </button>
                <button
                  onClick={() => setGameMode("p2p")}
                  className="w-full rounded-xl border border-[var(--pixel-accent-2)] bg-[var(--pixel-card-bg)] px-8 py-4 font-sans font-semibold text-sm tracking-tight text-[var(--pixel-accent-2)] shadow-xl shadow-[var(--pixel-glow)] transition-all hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
                >
                  P2P ONLINE
                </button>
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
                  title="MATH_SPRINT_P2P"
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

            {/* ─── P2P Host Settings ─── */}
            {showP2pSettings && (
              <motion.div
                key="p2p-settings"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                className="mx-auto flex max-w-md flex-col items-center gap-4"
              >
                <div className="w-full rounded-xl border border-[var(--pixel-accent-2)] bg-[var(--pixel-card-bg)] p-4">
                  <p className="mb-1 font-sans font-semibold text-xs text-[var(--pixel-accent-2)]">CONNECTED</p>
                  <p className="font-mono text-xs text-[var(--pixel-muted)]">
                    &gt; You are the host. Choose settings and start!
                  </p>
                </div>

                <div className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-5">
                  <h3 className="mb-4 font-sans font-semibold text-xs text-[var(--pixel-accent)]">OPERATIONS</h3>
                  <div className="flex flex-wrap gap-2">
                    {ALL_OPS.map(({ op, label }) => (
                      <button
                        key={op}
                        onClick={() => toggleOp(op)}
                        className={`min-w-[48px] rounded-xl border px-4 py-3 font-mono text-lg font-bold transition-all hover:scale-[1.05] ${
                          selectedOps.includes(op)
                            ? "border-[var(--pixel-accent)] bg-[var(--pixel-accent)] text-[var(--pixel-bg)]"
                            : "border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] text-[var(--pixel-muted)]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-5">
                  <h3 className="mb-4 font-sans font-semibold text-xs text-[var(--pixel-accent)]">QUESTIONS</h3>
                  <div className="flex gap-2">
                    {QUESTION_COUNTS.map(n => (
                      <button
                        key={n}
                        onClick={() => setTotalQuestions(n)}
                        className={`flex-1 rounded-xl border px-4 py-3 font-sans font-semibold text-sm transition-all hover:scale-[1.02] ${
                          totalQuestions === n
                            ? "border-[var(--pixel-accent)] bg-[var(--pixel-accent)] text-[var(--pixel-bg)]"
                            : "border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] text-[var(--pixel-muted)]"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={startP2pGame}
                  className="w-full rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-accent)] px-8 py-4 font-sans font-semibold text-sm tracking-tight text-[var(--pixel-bg)] transition-all hover:scale-[1.02]"
                >
                  START RACE
                </button>
              </motion.div>
            )}

            {/* ─── P2P Guest Waiting ─── */}
            {showP2pWaiting && (
              <motion.div
                key="p2p-waiting"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                className="mx-auto flex max-w-md flex-col items-center gap-4"
              >
                <div className="w-full rounded-xl border border-[var(--pixel-accent-2)] bg-[var(--pixel-card-bg)] p-6 text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    className="mx-auto mb-4 h-8 w-8 rounded-full border-2 border-[var(--pixel-accent-2)] border-t-transparent"
                  />
                  <p className="font-sans font-semibold text-sm text-[var(--pixel-accent-2)]">WAITING FOR HOST</p>
                  <p className="mt-2 font-mono text-xs text-[var(--pixel-muted)]">
                    &gt; Host is configuring the game...
                  </p>
                </div>
              </motion.div>
            )}

            {/* ─── Game ─── */}
            {showGame && (
              <motion.div
                key="game"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                className="mx-auto flex max-w-lg flex-col items-center gap-4"
              >
                {!result ? (
                  <>
                    {/* Progress + stats */}
                    <div className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-sm text-[var(--pixel-text)]">
                          {currentIndex}/{questions.length}
                        </span>
                        <span className="font-mono text-sm text-[var(--pixel-accent)]">
                          ⚡ {speed.toFixed(1)}/min
                        </span>
                        <span className="font-mono text-sm text-[var(--pixel-muted)]">
                          {formatTime(elapsed)}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[var(--pixel-bg)] overflow-hidden">
                        <motion.div
                          className="h-full bg-[var(--pixel-accent)]"
                          initial={false}
                          animate={{ width: `${(currentIndex / questions.length) * 100}%` }}
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      </div>

                      {/* Opponent progress (P2P) */}
                      {gameMode === "p2p" && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-xs text-[var(--pixel-muted)]">
                              Opponent: {opponentProgress}/{questions.length}
                            </span>
                            {opponentFinished && (
                              <span className="font-mono text-xs text-[var(--pixel-accent-2)]">DONE</span>
                            )}
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-[var(--pixel-bg)] overflow-hidden">
                            <motion.div
                              className="h-full bg-[var(--pixel-accent-2)]"
                              initial={false}
                              animate={{ width: `${(opponentProgress / questions.length) * 100}%` }}
                              transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Question display */}
                    <div className={`relative w-full rounded-xl border bg-[var(--pixel-card-bg)] p-6 md:p-10 overflow-hidden transition-all duration-200 ${
                      flashColor === "red"
                        ? "border-[#ef4444]/50 shadow-[0_0_12px_rgba(239,68,68,0.15)]"
                        : flashColor === "green"
                          ? "border-[#22c55e]/50 shadow-[0_0_12px_rgba(34,197,94,0.15)]"
                          : "border-[var(--pixel-border)] shadow-none"
                    }`}>
                      {isPlaying && (
                        <div className="flex items-center justify-center gap-2 md:gap-3">
                          <div className="relative overflow-hidden">
                            <AnimatePresence mode="popLayout">
                              <motion.span
                                key={currentIndex}
                                initial={{ opacity: 0, y: 36 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -36 }}
                                transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                                className="block font-mono text-3xl md:text-5xl font-bold text-[var(--pixel-text)] whitespace-nowrap"
                              >
                                {questions[currentIndex].display} =
                              </motion.span>
                            </AnimatePresence>
                          </div>

                          <div className={shaking ? "animate-shake" : ""}>
                            <input
                              ref={inputRef}
                              type="number"
                              inputMode="numeric"
                              value={inputValue}
                              onChange={handleInputChange}
                              disabled={!isPlaying}
                              className="w-[3.5ch] min-w-[60px] md:min-w-[80px] border-b-2 border-[var(--pixel-accent)] bg-transparent font-mono text-3xl md:text-5xl font-bold text-[var(--pixel-accent)] text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              placeholder="?"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Next question preview */}
                    {isPlaying && currentIndex + 1 < questions.length && (
                      <motion.div
                        key={`next-${currentIndex + 1}`}
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 0.35, y: 0 }}
                        transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
                        className="mt-3 w-full rounded-xl border border-[var(--pixel-border)]/50 bg-[var(--pixel-card-bg)]/50 py-3 md:py-4 text-center"
                      >
                        <span className="font-mono text-lg md:text-2xl text-[var(--pixel-muted)]">
                          {questions[currentIndex + 1].display} = ?
                        </span>
                      </motion.div>
                    )}

                    <button
                      onClick={exitToMenu}
                      className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[10px] text-[var(--pixel-muted)] transition-colors hover:text-[var(--pixel-accent)]"
                    >
                      QUIT
                    </button>
                  </>
                ) : (
                  /* ─── Result Card ─── */
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="w-full rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-card-bg)] p-6 md:p-8"
                  >
                    <h2 className="mb-2 text-center font-sans font-semibold text-xl text-[var(--pixel-accent)] md:text-2xl">
                      {gameMode === "p2p" && opponentFinished
                        ? result.totalTime <= opponentFinished.totalTime ? "YOU WIN!" : "YOU LOSE"
                        : "COMPLETE!"}
                    </h2>

                    {isNewRecord && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.2 }}
                        className="mb-4 rounded-lg border border-[var(--pixel-accent)] bg-[color-mix(in_oklab,var(--pixel-accent)_12%,transparent)] px-4 py-3 text-center"
                      >
                        <p className="font-sans font-bold text-sm text-[var(--pixel-accent)] md:text-base">
                          NEW RECORD!
                        </p>
                        <p className="font-mono text-xs text-[var(--pixel-accent)]/80">
                          {result.speed.toFixed(1)} questions/min — your fastest yet!
                        </p>
                      </motion.div>
                    )}

                    <div className="mb-4 flex items-center justify-center gap-2">
                      <span className="rounded-md border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-2 py-1 font-mono text-xs text-[var(--pixel-muted)]">
                        {opsLabel(resultOps)}
                      </span>
                      <span className="rounded-md border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-2 py-1 font-mono text-xs text-[var(--pixel-muted)]">
                        {resultCount}Q
                      </span>
                    </div>

                    <div className="space-y-3 font-mono text-sm md:text-base">
                      <div className="flex justify-between rounded-lg bg-[var(--pixel-bg)] px-4 py-3">
                        <span className="text-[var(--pixel-muted)]">Time</span>
                        <span className="text-[var(--pixel-text)]">{formatTime(result.totalTime)}</span>
                      </div>
                      <div className="flex justify-between rounded-lg bg-[var(--pixel-bg)] px-4 py-3">
                        <span className="text-[var(--pixel-muted)]">Speed</span>
                        <span className="text-[var(--pixel-accent)]">{result.speed.toFixed(1)} /min</span>
                      </div>
                      <div className="flex justify-between rounded-lg bg-[var(--pixel-bg)] px-4 py-3">
                        <span className="text-[var(--pixel-muted)]">Questions</span>
                        <span className="text-[var(--pixel-text)]">{result.totalQuestions}</span>
                      </div>
                      {bestSpeed !== null && !isNewRecord && (
                        <div className="flex justify-between rounded-lg border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-4 py-3">
                          <span className="text-[var(--pixel-muted)]">Best</span>
                          <span className="text-[var(--pixel-accent)]">{bestSpeed.toFixed(1)} /min</span>
                        </div>
                      )}
                      {gameMode === "p2p" && opponentFinished && (
                        <div className="flex justify-between rounded-lg border border-[var(--pixel-accent-2)] bg-[var(--pixel-bg)] px-4 py-3">
                          <span className="text-[var(--pixel-accent-2)]">Opponent</span>
                          <span className="text-[var(--pixel-accent-2)]">{formatTime(opponentFinished.totalTime)}</span>
                        </div>
                      )}
                      {gameMode === "p2p" && !opponentFinished && (
                        <div className="flex items-center justify-between rounded-lg border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-4 py-3">
                          <span className="text-[var(--pixel-muted)]">Opponent</span>
                          <span className="text-[var(--pixel-muted)]">
                            Still playing... ({opponentProgress}/{questions.length})
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex flex-col gap-2">
                      {gameMode === "solo" && (
                        <button
                          onClick={startSolo}
                          className="w-full rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-accent)] px-4 py-3 font-sans font-semibold text-sm text-[var(--pixel-bg)] transition-transform hover:scale-[1.02]"
                        >
                          PLAY AGAIN
                        </button>
                      )}
                      {gameMode === "p2p" && (
                        <button
                          onClick={handleRematch}
                          className="w-full rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-accent)] px-4 py-3 font-sans font-semibold text-sm text-[var(--pixel-bg)] transition-transform hover:scale-[1.02]"
                        >
                          REMATCH
                        </button>
                      )}
                      <button
                        onClick={exitToMenu}
                        className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[10px] text-[var(--pixel-muted)] transition-colors hover:text-[var(--pixel-accent)]"
                      >
                        MENU
                      </button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
