"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import P2PConnectionPanel from "../../features/p2p/components/P2PConnectionPanel";
import { P2PChat } from "../../features/p2p/components/P2PChat";
import { P2P_CONNECT_TIMEOUT_MS } from "../../features/p2p/config";
import { IsometricBlocks } from "./components/IsometricBlocks";
import { RevealBlocks } from "./components/RevealBlocks";
import { AnswerBox } from "./components/AnswerBox";
import { ReconnectingOverlay } from "@/features/p2p/components/ReconnectingOverlay";
import { useFlashGame } from "./hooks/useFlashGame";
import { DIFFICULTIES, QUESTION_COUNTS, TILE_W, TILE_H, formatTime } from "./types";
import ShareButton from "../components/ShareButton";

// ── Shared UI primitives ──────────────────────────────────────────────────────

function SettingsPanel({
  difficulty,
  totalQuestions,
  onDifficulty,
  onCount,
}: {
  difficulty: string;
  totalQuestions: number;
  onDifficulty: (k: "easy" | "medium" | "hard") => void;
  onCount: (n: number) => void;
}) {
  return (
    <>
      <div className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-5">
        <h3 className="mb-4 font-sans font-semibold text-xs text-[var(--pixel-accent)]">DIFFICULTY</h3>
        <div className="flex gap-2">
          {DIFFICULTIES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onDifficulty(key)}
              className={`flex-1 rounded-xl border px-4 py-3 font-sans font-semibold text-sm transition-[transform,background-color] duration-150 hover:scale-[1.02] ${
                difficulty === key
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
              onClick={() => onCount(n)}
              className={`flex-1 rounded-xl border px-4 py-3 font-sans font-semibold text-sm transition-[transform,background-color] duration-150 hover:scale-[1.02] ${
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
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FlashCountPage() {
  const g = useFlashGame();

  const {
    difficulty, setDifficulty, totalQuestions, setTotalQuestions, bestSpeed,
    gameMode, setGameMode, gamePhase, puzzles, currentIndex,
    inputValue, shakeKey, flashColor, elapsed, revealPuzzle,
    soloResult, isNewRecord, resultDiff, resultCount,
    direction, waitingForConfig, hostPreview,
    myP2pAnswer, opponentSubmitted, questionResult, myScore, opponentScore, p2pGameResult,
    phase, localPeerId, error, isConnected, connect, send, sendChat, clearError, retryLastConnection, reinitialize, roomCode, connectSubstep,
    joinPeerId, inputRef, isReconnecting, reconnectDeadline,
    chatMessages, addMyMessage,
    startSolo, startP2pGame, exitToMenu, handleRematch,
    handleSoloInputChange, handleP2pInputChange, onRevealComplete,
    speed, isPlaying, showP2pSettings, showP2pWaiting, showGame,
    isP2pWaitingForOpponent, isP2pWaitingForMe,
  } = g;

  const connectionDescription = [
    "> Share your ID with a friend",
    "> Or enter their ID to connect",
    "> Host picks difficulty, then race!",
  ];

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
          title="Flash Count"
          text="Can you count 3D isometric blocks before they vanish? Try this visual memory challenge!"
        />
      </motion.div>

      <div className="relative z-10 container mx-auto px-3 md:px-4 py-4 md:py-8 min-h-screen flex flex-col items-center justify-center">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="mb-4 text-center md:mb-8"
        >
          <h1 className="mb-2 font-sans font-semibold text-2xl tracking-tight text-[var(--pixel-accent)] md:text-5xl">
            FLASH COUNT
          </h1>
          <p className="font-mono text-xs text-[var(--pixel-muted)] md:text-sm">
            &gt; Count the blocks before they vanish
            {gameMode === "solo" ? " | Solo" : gameMode === "p2p" ? " | P2P" : ""}
          </p>
        </motion.div>

        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">

            {/* ── Menu ── */}
            {gameMode === "menu" && (
              <motion.div
                key="menu"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
                className="mx-auto flex max-w-md flex-col items-center gap-4"
              >
                <SettingsPanel
                  difficulty={difficulty}
                  totalQuestions={totalQuestions}
                  onDifficulty={setDifficulty}
                  onCount={setTotalQuestions}
                />

                {bestSpeed !== null && (
                  <div className="w-full rounded-xl border border-[var(--pixel-accent)]/30 bg-[var(--pixel-card-bg)] px-5 py-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-[var(--pixel-muted)]">
                        Best ({difficulty} / {totalQuestions}Q)
                      </span>
                      <span className="font-mono text-sm font-bold text-[var(--pixel-accent)]">
                        {bestSpeed.toFixed(1)} /min
                      </span>
                    </div>
                  </div>
                )}

                <button
                  onClick={startSolo}
                  className="w-full rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-card-bg)] px-8 py-4 font-sans font-semibold text-sm tracking-tight text-[var(--pixel-accent)] shadow-xl shadow-[var(--pixel-glow)] transition-[transform,background-color] duration-150 hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
                >
                  SOLO
                </button>
                <button
                  onClick={() => setGameMode("p2p")}
                  className="w-full rounded-xl border border-[var(--pixel-accent-2)] bg-[var(--pixel-card-bg)] px-8 py-4 font-sans font-semibold text-sm tracking-tight text-[var(--pixel-accent-2)] shadow-xl shadow-[var(--pixel-glow)] transition-[transform,background-color] duration-150 hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
                >
                  P2P ONLINE
                </button>
              </motion.div>
            )}

            {/* ── P2P: Connecting ── */}
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
                  title="FLASH_COUNT_P2P"
                  description={connectionDescription}
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
                    onClick={exitToMenu}
                    className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[10px] text-[var(--pixel-muted)]"
                  >
                    MENU
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── P2P: Host settings ── */}
            {showP2pSettings && (
              <motion.div
                key="p2p-settings"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
                className="mx-auto flex max-w-md flex-col items-center gap-4"
              >
                <div className="w-full rounded-xl border border-[var(--pixel-accent-2)] bg-[var(--pixel-card-bg)] p-4">
                  <p className="mb-1 font-sans font-semibold text-xs text-[var(--pixel-accent-2)]">CONNECTED</p>
                  <p className="font-mono text-xs text-[var(--pixel-muted)]">&gt; You are the host. Choose settings and start!</p>
                </div>
                <SettingsPanel
                  difficulty={difficulty}
                  totalQuestions={totalQuestions}
                  onDifficulty={setDifficulty}
                  onCount={setTotalQuestions}
                />
                <button
                  onClick={startP2pGame}
                  className="w-full rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-accent)] px-8 py-4 font-sans font-semibold text-sm tracking-tight text-[var(--pixel-bg)] transition-[transform,background-color] duration-150 hover:scale-[1.02]"
                >
                  START RACE
                </button>
              </motion.div>
            )}

            {/* ── P2P: Guest waiting ── */}
            {showP2pWaiting && (
              <motion.div
                key="p2p-waiting"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
                className="mx-auto flex max-w-md flex-col items-center gap-4"
              >
                <div className="w-full rounded-xl border border-[var(--pixel-accent-2)] bg-[var(--pixel-card-bg)] p-6 text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    className="mx-auto mb-4 h-8 w-8 rounded-full border-2 border-[var(--pixel-accent-2)] border-t-transparent"
                  />
                  <p className="font-sans font-semibold text-sm text-[var(--pixel-accent-2)]">WAITING FOR HOST</p>
                  <p className="mt-2 font-mono text-xs text-[var(--pixel-muted)]">&gt; Host is configuring the game...</p>
                  {hostPreview && (
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <span className="rounded-md border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-2.5 py-1 font-mono text-xs text-[var(--pixel-text)]">
                        {hostPreview.difficulty.toUpperCase()}
                      </span>
                      <span className="rounded-md border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-2.5 py-1 font-mono text-xs text-[var(--pixel-text)]">
                        {hostPreview.totalQuestions}Q
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Game ── */}
            {showGame && (
              <motion.div
                key="game"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
                className="mx-auto flex max-w-lg flex-col items-center gap-4"
              >
                {!soloResult && !p2pGameResult ? (
                  <>
                    {/* Progress bar + stats */}
                    <div className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-sm text-[var(--pixel-text)]">
                          {currentIndex}/{puzzles.length}
                        </span>
                        {gameMode === "solo" && (
                          <span className="font-mono text-sm text-[var(--pixel-accent)]">
                            ⚡ {speed.toFixed(1)}/min
                          </span>
                        )}
                        {gameMode === "p2p" && (
                          <span className="font-mono text-sm font-bold">
                            <span className="text-[var(--pixel-accent)]">{myScore}</span>
                            <span className="text-[var(--pixel-muted)]"> : </span>
                            <span className="text-[var(--pixel-accent-2)]">{opponentScore}</span>
                          </span>
                        )}
                        <span className="font-mono text-sm text-[var(--pixel-muted)]">
                          {formatTime(elapsed)}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[var(--pixel-bg)] overflow-hidden">
                        <motion.div
                          className="h-full bg-[var(--pixel-accent)]"
                          initial={false}
                          animate={{ width: `${(currentIndex / puzzles.length) * 100}%` }}
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      </div>
                    </div>

                    {/* Main game card */}
                    <div className={`relative w-full rounded-xl border bg-[var(--pixel-card-bg)] overflow-hidden transition-all duration-200 ${
                      flashColor === "red"
                        ? "border-[#ef4444]/50 shadow-[0_0_12px_rgba(239,68,68,0.15)]"
                        : flashColor === "green"
                          ? "border-[#22c55e]/50 shadow-[0_0_12px_rgba(34,197,94,0.15)]"
                          : "border-[var(--pixel-border)] shadow-none"
                    }`}>
                      <div className="flex items-center justify-center p-6 md:p-10 min-h-[200px] md:min-h-[260px]">

                        {/* Flash phase: show blocks */}
                        {isPlaying && gamePhase === "flash" && (
                          <motion.div
                            key={`blocks-${currentIndex}`}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.1, ease: "easeOut" }}
                          >
                            <IsometricBlocks puzzle={puzzles[currentIndex]} tileW={TILE_W} tileH={TILE_H} />
                          </motion.div>
                        )}

                        {/* Answer phase: solo input */}
                        {isPlaying && gamePhase === "answer" && gameMode === "solo" && (
                          <motion.div
                            key={`answer-${currentIndex}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.1 }}
                            className="flex items-center justify-center gap-2 md:gap-3"
                          >
                            <span className="font-mono text-3xl md:text-5xl font-bold text-[var(--pixel-text)] whitespace-nowrap">
                              ? =
                            </span>
                            <motion.div
                              key={shakeKey}
                              animate={shakeKey > 0 && flashColor === "red" ? { x: [-6, 6, -3, 3, 0] } : {}}
                              transition={{ duration: 0.25 }}
                            >
                              <input
                                ref={inputRef}
                                type="number"
                                inputMode="numeric"
                                value={inputValue}
                                onChange={handleSoloInputChange}
                                disabled={gamePhase !== "answer"}
                                className="w-[3.5ch] min-w-[60px] md:min-w-[80px] border-b-2 border-[var(--pixel-accent)] bg-transparent font-mono text-3xl md:text-5xl font-bold text-[var(--pixel-accent)] text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="?"
                              />
                            </motion.div>
                          </motion.div>
                        )}

                        {/* Answer phase: P2P input + result */}
                        {isPlaying && gamePhase === "answer" && gameMode === "p2p" && (
                          <div className="w-full flex flex-col items-center gap-4">
                            <span className="font-mono text-xl text-[var(--pixel-muted)]">? = </span>

                            <AnimatePresence mode="wait">
                              {myP2pAnswer === null ? (
                                <motion.div
                                  key="p2p-input"
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -8 }}
                                  className="flex flex-col items-center gap-1"
                                >
                                  <input
                                    ref={inputRef}
                                    type="number"
                                    inputMode="numeric"
                                    value={inputValue}
                                    onChange={handleP2pInputChange}
                                    className="w-[4ch] min-w-[72px] border-b-2 border-[var(--pixel-accent)] bg-transparent font-mono text-4xl font-bold text-[var(--pixel-accent)] text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    placeholder="?"
                                    autoFocus
                                  />
                                  {isP2pWaitingForMe && (
                                    <motion.span
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      className="font-mono text-xs text-[var(--pixel-accent-2)]"
                                    >
                                      Opponent submitted! Enter your answer.
                                    </motion.span>
                                  )}
                                </motion.div>
                              ) : (
                                <motion.div
                                  key="p2p-submitted"
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="flex flex-col items-center gap-1"
                                >
                                  <span className="font-mono text-4xl font-bold text-[var(--pixel-accent-2)]">
                                    {myP2pAnswer}
                                  </span>
                                  <span className="font-mono text-xs text-[var(--pixel-muted)]">
                                    {isP2pWaitingForOpponent ? "Waiting for opponent..." : "Both submitted!"}
                                  </span>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Answer reveal (after both submit) */}
                            <AnimatePresence>
                              {questionResult ? (
                                <motion.div
                                  key="answer-boxes"
                                  initial={{ opacity: 0, y: 12 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="w-full flex gap-3 mt-2"
                                >
                                  <AnswerBox label="You" submitted={myP2pAnswer !== null} result={questionResult} isMe={true} />
                                  <AnswerBox label="Opponent" submitted={opponentSubmitted} result={questionResult} isMe={false} />
                                </motion.div>
                              ) : (
                                /* Pending status before both submit */
                                <div className="w-full flex gap-3">
                                  {[
                                    { label: "You", active: myP2pAnswer !== null, accent: "var(--pixel-accent)" },
                                    { label: "Opponent", active: opponentSubmitted, accent: "var(--pixel-accent-2)" },
                                  ].map(({ label, active, accent }) => (
                                    <div key={label} className="flex-1 flex flex-col items-center gap-1">
                                      <span className="font-mono text-[10px] text-[var(--pixel-muted)] uppercase tracking-wider">{label}</span>
                                      <div className={`w-full rounded-xl border-2 px-4 py-3 text-center font-mono text-2xl font-bold transition-all duration-300 ${
                                        active
                                          ? `border-[${accent}] bg-[${accent}]/10 text-[${accent}]`
                                          : "border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] text-[var(--pixel-muted)]"
                                      }`}>
                                        {active ? "★" : "—"}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}

                        {/* Reveal phase: solo animated block count */}
                        {gamePhase === "reveal" && revealPuzzle && gameMode === "solo" && (
                          <motion.div
                            key={`reveal-${currentIndex}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.15 }}
                          >
                            <RevealBlocks
                              puzzle={revealPuzzle}
                              tileW={TILE_W}
                              tileH={TILE_H}
                              onComplete={onRevealComplete}
                            />
                          </motion.div>
                        )}
                      </div>

                      {/* Flash countdown bar */}
                      {isPlaying && gamePhase === "flash" && (
                        <motion.div
                          key={`flash-bar-${currentIndex}`}
                          initial={{ scaleX: 1 }}
                          animate={{ scaleX: 0 }}
                          transition={{ duration: puzzles[currentIndex].flashDuration / 1000, ease: "linear" }}
                          className="h-1 origin-left bg-[var(--pixel-accent)]"
                        />
                      )}
                    </div>

                    <button
                      onClick={exitToMenu}
                      className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[10px] text-[var(--pixel-muted)] transition-colors hover:text-[var(--pixel-accent)]"
                    >
                      QUIT
                    </button>
                  </>
                ) : soloResult ? (
                  /* ── Solo result ── */
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="w-full rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-card-bg)] p-6 md:p-8"
                  >
                    <h2 className="mb-2 text-center font-sans font-semibold text-xl text-[var(--pixel-accent)] md:text-2xl">
                      COMPLETE!
                    </h2>

                    {isNewRecord && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.2 }}
                        className="mb-4 rounded-lg border border-[var(--pixel-accent)] bg-[color-mix(in_oklab,var(--pixel-accent)_12%,transparent)] px-4 py-3 text-center"
                      >
                        <p className="font-sans font-bold text-sm text-[var(--pixel-accent)] md:text-base">NEW RECORD!</p>
                        <p className="font-mono text-xs text-[var(--pixel-accent)]/80">
                          {soloResult.speed.toFixed(1)} puzzles/min — your fastest yet!
                        </p>
                      </motion.div>
                    )}

                    <div className="mb-4 flex items-center justify-center gap-2">
                      <span className="rounded-md border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-2 py-1 font-mono text-xs text-[var(--pixel-muted)]">
                        {resultDiff.toUpperCase()}
                      </span>
                      <span className="rounded-md border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-2 py-1 font-mono text-xs text-[var(--pixel-muted)]">
                        {resultCount}Q
                      </span>
                    </div>

                    <div className="space-y-3 font-mono text-sm md:text-base">
                      {[
                        { label: "Time", value: formatTime(soloResult.totalTime), color: "text-[var(--pixel-text)]" },
                        { label: "Speed", value: `${soloResult.speed.toFixed(1)} /min`, color: "text-[var(--pixel-accent)]" },
                        { label: "Puzzles", value: soloResult.totalQuestions, color: "text-[var(--pixel-text)]" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="flex justify-between rounded-lg bg-[var(--pixel-bg)] px-4 py-3">
                          <span className="text-[var(--pixel-muted)]">{label}</span>
                          <span className={color}>{value}</span>
                        </div>
                      ))}
                      {bestSpeed !== null && !isNewRecord && (
                        <div className="flex justify-between rounded-lg border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-4 py-3">
                          <span className="text-[var(--pixel-muted)]">Best</span>
                          <span className="text-[var(--pixel-accent)]">{bestSpeed.toFixed(1)} /min</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex flex-col gap-2">
                      <button onClick={startSolo} className="w-full rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-accent)] px-4 py-3 font-sans font-semibold text-sm text-[var(--pixel-bg)] transition-transform hover:scale-[1.02]">
                        PLAY AGAIN
                      </button>
                      <button onClick={exitToMenu} className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[10px] text-[var(--pixel-muted)] transition-colors hover:text-[var(--pixel-accent)]">
                        MENU
                      </button>
                    </div>
                  </motion.div>
                ) : p2pGameResult ? (
                  /* ── P2P result ── */
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="w-full rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-card-bg)] p-6 md:p-8"
                  >
                    <h2 className="mb-6 text-center font-sans font-semibold text-xl md:text-2xl">
                      {p2pGameResult.myScore > p2pGameResult.opponentScore ? (
                        <span className="text-[#22c55e]">YOU WIN!</span>
                      ) : p2pGameResult.myScore < p2pGameResult.opponentScore ? (
                        <span className="text-[#ef4444]">YOU LOSE</span>
                      ) : (
                        <span className="text-[var(--pixel-accent)]">DRAW!</span>
                      )}
                    </h2>

                    <div className="flex gap-4 mb-6">
                      {[
                        { label: "YOU", score: p2pGameResult.myScore, accent: "var(--pixel-accent)" },
                        { label: "OPPONENT", score: p2pGameResult.opponentScore, accent: "var(--pixel-accent-2)" },
                      ].map(({ label, score, accent }) => (
                        <div key={label} className={`flex-1 rounded-xl border-2 p-4 text-center`} style={{ borderColor: `var(--${accent.slice(6, -1)})`, background: `color-mix(in oklab, ${accent} 10%, transparent)` }}>
                          <p className="font-mono text-xs text-[var(--pixel-muted)] mb-1">{label}</p>
                          <p className="font-mono text-4xl font-bold" style={{ color: accent }}>{score}</p>
                          <p className="font-mono text-xs text-[var(--pixel-muted)] mt-1">/ {p2pGameResult.totalQuestions}</p>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3 font-mono text-sm mb-6">
                      {[
                        { label: "Questions", value: p2pGameResult.totalQuestions },
                        { label: "Time", value: formatTime(elapsed) },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between rounded-lg bg-[var(--pixel-bg)] px-4 py-3">
                          <span className="text-[var(--pixel-muted)]">{label}</span>
                          <span className="text-[var(--pixel-text)]">{value}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-2">
                      <button onClick={handleRematch} className="w-full rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-accent)] px-4 py-3 font-sans font-semibold text-sm text-[var(--pixel-bg)] transition-transform hover:scale-[1.02]">
                        REMATCH
                      </button>
                      <button onClick={exitToMenu} className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[10px] text-[var(--pixel-muted)] transition-colors hover:text-[var(--pixel-accent)]">
                        MENU
                      </button>
                    </div>
                  </motion.div>
                ) : null}
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

      <AnimatePresence>
        {isReconnecting && <ReconnectingOverlay deadline={reconnectDeadline} />}
      </AnimatePresence>
    </div>
  );
}
