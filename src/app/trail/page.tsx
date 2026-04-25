"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import P2PConnectionPanel from "../../features/p2p/components/P2PConnectionPanel";
import { P2PChat } from "../../features/p2p/components/P2PChat";
import { P2P_CONNECT_TIMEOUT_MS } from "../../features/p2p/config";
import ShareButton from "../components/ShareButton";
import Confetti from "../components/Confetti";
import { ReconnectingOverlay } from "@/features/p2p/components/ReconnectingOverlay";
import { useTrailGame, formatTime } from "./hooks/useTrailGame";
import { TrailGrid, formatCell } from "./components/TrailGrid";
import { GRID_SIZES, type GridSize } from "./types";

const SIZE_LABELS: Record<GridSize, string> = {
  3: "3×3",
  4: "4×4",
  5: "5×5",
};

const CONNECTION_DESCRIPTION = [
  "> Share your ID with a friend",
  "> Or enter their ID to connect",
  "> Host generates the shuffle — same grid for both",
];

const TRAIL_ACCENT = "#22d3ee";

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

export default function TrailPage() {
  const {
    gameMode, setGameMode,
    size, setSize,
    myIndex,
    cells, currentIndex, currentTarget, nextTarget, status,
    elapsedTime, penalty, bestTimes, isNewBest,
    wrongClickIndex, penaltyFlash,
    totalCells,
    opponentIndex, opponentComplete, opponentTime,
    phase, localPeerId, error, isConnected, connect, sendChat, clearError, retryLastConnection, reinitialize, roomCode, connectSubstep,
    joinPeerId, isReconnecting, reconnectDeadline,
    chatMessages, addMyMessage,
    handleClick, startSolo, requestNewGame, exitToMenu,
  } = useTrailGame();

  const isGameActive = gameMode === "solo" || (gameMode === "p2p" && isConnected);
  const isHost = myIndex === 0;
  const isGuest = myIndex === 1;

  const youWonP2P =
    gameMode === "p2p" &&
    status === "complete" &&
    (!opponentComplete || (opponentTime !== null && elapsedTime <= opponentTime));

  const showConfetti =
    status === "complete" &&
    (gameMode === "solo" || youWonP2P);

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ ["--pixel-accent" as string]: TRAIL_ACCENT }}
    >
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

      {/* Back to home button (menu only) */}
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
          title="Trail — Cognitive Flexibility Test"
          text="Trail Making test — click numbers and letters in alternating order: 1, A, 2, B, ... Solo or race a friend P2P!"
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
          <h1 className="mb-1 font-sans font-semibold text-2xl tracking-tight text-[var(--pixel-accent)] md:text-5xl">
            TRAIL
          </h1>
          <p className="font-mono text-xs text-[var(--pixel-muted)] md:text-sm">
            {gameMode === "menu" && "> Click 1 → A → 2 → B → ... — alternating order"}
            {gameMode === "p2p" && !isConnected && "> P2P — same shuffled grid, first to finish wins"}
            {isGameActive && `> ${SIZE_LABELS[size]} | ${gameMode === "solo" ? "Solo" : isHost ? "P2P Host" : "P2P Guest"}`}
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
                  <h3 className="mb-1 font-sans font-semibold text-xs text-[var(--pixel-accent)]">SOLO</h3>
                  <p className="mb-4 font-mono text-[10px] text-[var(--pixel-muted)]">&gt; Best times recorded per size</p>
                  <div className="grid grid-cols-3 gap-2">
                    {GRID_SIZES.map(sz => (
                      <button
                        key={sz}
                        onClick={() => startSolo(sz)}
                        className="group flex flex-col items-start rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-card-bg)] px-3 py-2.5 font-sans font-semibold text-sm tracking-tight text-[var(--pixel-accent)] transition-[transform,background-color] duration-150 hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
                      >
                        <span className="text-sm">{SIZE_LABELS[sz]}</span>
                        <span className="font-mono text-[9px] text-[var(--pixel-muted)] group-hover:text-[var(--pixel-accent)]">
                          {bestTimes[sz] !== null ? formatTime(bestTimes[sz]!) : "— — —"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* P2P */}
                <div className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-5">
                  <h3 className="mb-1 font-sans font-semibold text-xs text-[var(--pixel-accent-2)]">P2P RACE</h3>
                  <p className="mb-4 font-mono text-[10px] text-[var(--pixel-muted)]">&gt; Select size, then connect to a friend</p>
                  <div className="mb-3 grid grid-cols-3 gap-1.5">
                    {GRID_SIZES.map(sz => (
                      <button
                        key={sz}
                        onClick={() => setSize(sz)}
                        className={`rounded-xl border px-2 py-2 font-sans font-semibold text-[10px] transition-[transform,background-color] duration-150 hover:scale-[1.02] ${
                          size === sz
                            ? "border-[var(--pixel-accent-2)] bg-[color-mix(in_oklab,var(--pixel-accent-2)_15%,transparent)] text-[var(--pixel-accent-2)]"
                            : "border-[var(--pixel-border)] bg-transparent text-[var(--pixel-muted)] hover:border-[var(--pixel-accent-2)] hover:text-[var(--pixel-accent-2)]"
                        }`}
                      >
                        {SIZE_LABELS[sz]}
                      </button>
                    ))}
                  </div>
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
                  title="TRAIL_P2P"
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
            {isGameActive && cells.length > 0 && (
              <motion.div
                key="game"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
                className="flex flex-col items-center gap-3 md:gap-4"
              >
                {/* Header — big NEXT target + timer + penalty indicator */}
                <div className="flex w-full max-w-xl items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="font-mono text-[10px] uppercase text-[var(--pixel-muted)]">Next</span>
                    <span className="font-sans text-4xl md:text-5xl font-bold text-[var(--pixel-accent)] leading-none">
                      {status === "complete" || currentTarget === null ? "✓" : formatCell(currentTarget)}
                    </span>
                    {status !== "complete" && nextTarget !== null && (
                      <span className="mt-1 font-mono text-[10px] text-[var(--pixel-muted)]">
                        then {formatCell(nextTarget)}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col items-center">
                    <span className="font-mono text-[10px] uppercase text-[var(--pixel-muted)]">Time</span>
                    <span className={`font-mono text-2xl md:text-3xl font-bold leading-none ${
                      status === "complete" ? "text-[var(--pixel-accent)]" : "text-[var(--pixel-text)]"
                    }`}>
                      {formatTime(elapsedTime)}
                    </span>
                    <AnimatePresence>
                      {penaltyFlash > 0 && (
                        <motion.span
                          key={penaltyFlash}
                          initial={{ opacity: 1, y: 0, x: 0 }}
                          animate={{ opacity: 0, y: -10, x: [0, -2, 2, -2, 0] }}
                          transition={{ duration: 0.8 }}
                          className="absolute mt-8 font-mono text-sm font-bold text-[var(--pixel-warn)] pointer-events-none"
                        >
                          +1s
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="font-mono text-[10px] uppercase text-[var(--pixel-muted)]">Penalty</span>
                    <span className={`font-mono text-lg md:text-xl font-bold leading-none ${
                      penalty > 0 ? "text-[var(--pixel-warn)]" : "text-[var(--pixel-muted)]"
                    }`}>
                      +{(penalty / 1000).toFixed(1)}s
                    </span>
                  </div>
                </div>

                {/* P2P opponent progress */}
                {gameMode === "p2p" && (
                  <div className="w-full max-w-xl rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-3">
                    <div className="mb-2 flex items-center justify-between font-mono text-[10px]">
                      <span className="text-[var(--pixel-accent-2)]">{isHost ? "GUEST" : "HOST"}</span>
                      <span className="text-[var(--pixel-muted)]">
                        {Math.min(opponentIndex, totalCells)} / {totalCells}
                        {opponentComplete && opponentTime !== null && ` — ${formatTime(opponentTime)}`}
                      </span>
                    </div>
                    <ProgressBar value={Math.min(opponentIndex, totalCells)} max={totalCells} color="accent-2" />
                  </div>
                )}

                {/* Grid */}
                <TrailGrid
                  cells={cells}
                  size={size}
                  currentIndex={currentIndex}
                  wrongClickIndex={wrongClickIndex}
                  onCellClick={handleClick}
                  disabled={status === "complete"}
                />

                {/* Result banner */}
                {status === "complete" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`w-full max-w-xl rounded-xl border p-4 text-center font-mono ${
                      gameMode === "solo"
                        ? "border-[var(--pixel-accent)] text-[var(--pixel-accent)]"
                        : youWonP2P
                          ? "border-[var(--pixel-accent)] text-[var(--pixel-accent)]"
                          : opponentComplete
                            ? "border-[var(--pixel-warn)] text-[var(--pixel-warn)]"
                            : "border-[var(--pixel-muted)] text-[var(--pixel-muted)]"
                    }`}
                  >
                    {gameMode === "solo" && (
                      <>
                        <p className="text-sm font-bold">COMPLETED! Time: {formatTime(elapsedTime)}</p>
                        {isNewBest && (
                          <p className="mt-1 text-xs text-[var(--pixel-accent)]">★ NEW BEST ★</p>
                        )}
                        {penalty > 0 && (
                          <p className="mt-1 text-[10px] text-[var(--pixel-warn)]">(includes +{(penalty / 1000).toFixed(1)}s penalty)</p>
                        )}
                      </>
                    )}
                    {gameMode === "p2p" && (
                      <>
                        <p className="text-sm font-bold">
                          {!opponentComplete
                            ? `Finished in ${formatTime(elapsedTime)} — waiting for opponent...`
                            : youWonP2P
                              ? `YOU WIN! ${formatTime(elapsedTime)}`
                              : `OPPONENT WINS. You: ${formatTime(elapsedTime)}`}
                        </p>
                        {opponentComplete && opponentTime !== null && (
                          <p className="mt-1 text-[10px] text-[var(--pixel-muted)]">
                            {isHost ? "Guest" : "Host"}: {formatTime(opponentTime)}
                          </p>
                        )}
                      </>
                    )}
                  </motion.div>
                )}

                {/* Best times panel — solo only */}
                {gameMode === "solo" && (
                  <div className="w-full max-w-xl rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-3">
                    <h3 className="mb-2 font-sans font-semibold text-[10px] text-[var(--pixel-accent)]">BEST TIMES</h3>
                    <div className="grid grid-cols-3 gap-1.5">
                      {GRID_SIZES.map(sz => (
                        <div
                          key={sz}
                          className={`rounded-lg border px-2 py-1.5 text-center font-mono ${
                            sz === size
                              ? "border-[var(--pixel-accent)] bg-[color-mix(in_oklab,var(--pixel-accent)_10%,transparent)]"
                              : "border-[var(--pixel-border)]"
                          }`}
                        >
                          <div className="text-[9px] text-[var(--pixel-muted)]">{SIZE_LABELS[sz]}</div>
                          <div className={`text-[11px] font-bold ${sz === size ? "text-[var(--pixel-accent)]" : "text-[var(--pixel-text)]"}`}>
                            {bestTimes[sz] !== null ? formatTime(bestTimes[sz]!) : "--:--"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Controls */}
                <div className="flex gap-2 w-full max-w-xl">
                  {status === "complete" && (gameMode === "solo" || isHost) && (
                    <button
                      onClick={requestNewGame}
                      className="flex-1 rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-accent)] px-4 py-2.5 font-sans font-semibold text-xs text-[var(--pixel-bg)] transition-transform hover:scale-[1.02]"
                    >
                      {gameMode === "solo" ? "NEW GAME" : "REMATCH"}
                    </button>
                  )}
                  {status === "complete" && gameMode === "p2p" && isGuest && (
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
