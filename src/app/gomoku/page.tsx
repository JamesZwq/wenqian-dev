"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import P2PConnectionPanel from "../../features/p2p/components/P2PConnectionPanel";
import { P2PStatusPanel } from "../../features/p2p/components/P2PStatusPanel";
import { P2PChat } from "../../features/p2p/components/P2PChat";
import { P2P_CONNECT_TIMEOUT_MS } from "../../features/p2p/config";
import { ReconnectingOverlay } from "@/features/p2p/components/ReconnectingOverlay";
import { useGomokuGame } from "./hooks/useGomokuGame";
import { GomokuBoard } from "./components/GomokuBoard";
import ShareButton from "../components/ShareButton";

const CONNECTION_DESCRIPTION = [
  "> Share your ID with a friend",
  "> Or enter their ID to connect",
  "> P1 (Black) = 先手, P2 (White) = 后手",
];

export default function GomokuPage() {
  const {
    gameMode, setGameMode, aiDifficulty,
    myColor, lastMove, previewPos, setPreviewPos,
    cellSize, stats, gameState,
    showExplosion, setShowExplosion, explosionPieces,
    phase, localPeerId, error, isConnected, connect, sendChat, clearError, retryLastConnection, reinitialize, roomCode,
    joinPeerId, latencyMs, lastRemoteMessageAt, isReconnecting, reconnectDeadline,
    chatMessages, addMyMessage,
    startAIGame, exitToMenu, handleBoardClick, makeMove, resetGame,
    myPlayerId, isMyTurn, opponentLabel, boardPixels, stoneRadius,
  } = useGomokuGame();

  return (
    <div className="relative min-h-screen overflow-hidden">
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

      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        className="fixed right-4 top-4 z-50 md:right-6 md:top-6"
      >
        <ShareButton
          title="Gomoku — Five in a Row"
          text="Play Gomoku (Five in a Row) vs AI or challenge a friend via P2P — no signup needed!"
        />
      </motion.div>

      <div className="relative z-10 container mx-auto px-3 md:px-4 py-4 md:py-8 min-h-screen flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="mb-4 text-center md:mb-8"
        >
          <h1 className="mb-2 font-sans font-semibold text-2xl tracking-tight text-[var(--pixel-accent)] md:text-5xl">
            GOMOKU
          </h1>
          <p className="font-mono text-xs text-[var(--pixel-muted)] md:text-sm">
            &gt; Five in a Row{" "}
            {gameMode === "ai" ? `| AI (${aiDifficulty})` : gameMode === "p2p" ? "| P2P" : ""}
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
                <div className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-5">
                  <h3 className="mb-4 font-sans font-semibold text-xs text-[var(--pixel-accent)]">VS AI</h3>
                  <div className="flex flex-col gap-2">
                    {(["easy", "medium", "hard"] as const).map(diff => (
                      <button
                        key={diff}
                        onClick={() => startAIGame(diff)}
                        className="w-full rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-card-bg)] px-4 py-3 font-sans font-semibold text-sm tracking-tight text-[var(--pixel-accent)] transition-[transform,background-color] duration-150 hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
                      >
                        {diff.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setGameMode("p2p")}
                  className="w-full rounded-xl border border-[var(--pixel-accent-2)] bg-[var(--pixel-card-bg)] px-8 py-4 font-sans font-semibold text-sm tracking-tight text-[var(--pixel-accent-2)] shadow-xl shadow-[var(--pixel-glow)] transition-[transform,background-color] duration-150 hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
                >
                  P2P ONLINE
                </button>
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
                  title="GOMOKU_P2P"
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
                    onClick={exitToMenu}
                    className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[10px] text-[var(--pixel-muted)]"
                  >
                    MENU
                  </button>
                </div>
              </motion.div>
            )}

            {/* ─── Game ─── */}
            {((gameMode === "ai") || (gameMode === "p2p" && isConnected)) && (
              <motion.div
                key="game"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
                className="flex flex-col items-center gap-3 md:gap-4"
              >
                {/* Mobile compact status bar */}
                <div className="flex w-full items-center justify-center gap-2 md:hidden">
                  <div className="flex items-center gap-1.5 rounded-lg border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-2.5 py-1.5">
                    <div className="h-3 w-3 rounded-full bg-black border border-[var(--pixel-border)]" />
                    <span className="font-mono text-[10px] text-[var(--pixel-accent)]">{stats.blackWins}</span>
                  </div>
                  <div className={`rounded-lg border px-2.5 py-1.5 font-mono text-[10px] ${
                    gameState.status === "won"
                      ? gameState.winner === (gameMode === "ai" ? "black" : myColor)
                        ? "border-[var(--pixel-accent)] text-[var(--pixel-accent)]"
                        : "border-[var(--pixel-warn)] text-[var(--pixel-warn)]"
                      : gameState.status === "draw"
                        ? "border-[var(--pixel-muted)] text-[var(--pixel-muted)]"
                        : isMyTurn
                          ? "border-[var(--pixel-accent)] text-[var(--pixel-accent)]"
                          : "border-[var(--pixel-border)] text-[var(--pixel-muted)]"
                  }`}>
                    {gameState.status === "won"
                      ? gameState.winner === (gameMode === "ai" ? "black" : myColor) ? "WIN!" : "LOSE"
                      : gameState.status === "draw"
                        ? "DRAW"
                        : isMyTurn ? "YOUR TURN" : `${opponentLabel.toUpperCase()}'S`}
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-2.5 py-1.5">
                    <div className="h-3 w-3 rounded-full bg-white border border-[var(--pixel-border)]" />
                    <span className="font-mono text-[10px] text-[var(--pixel-accent)]">{stats.whiteWins}</span>
                  </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-3 md:gap-6">
                  {/* Desktop sidebar */}
                  <div className="hidden lg:block lg:w-72 space-y-4">
                    {/* Players */}
                    <div className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-4">
                      <h3 className="mb-3 font-sans font-semibold text-[10px] text-[var(--pixel-accent)]">PLAYERS</h3>
                      <div className="space-y-2">
                        <div className={`flex items-center gap-2 rounded-lg p-2 border ${
                          (gameMode === "ai" || myColor === "black")
                            ? "border-[var(--pixel-accent)]"
                            : "border-[var(--pixel-border)]"
                        }`}>
                          <div className="w-5 h-5 rounded-full bg-black border border-[var(--pixel-border)]" />
                          <span className="font-mono text-sm">
                            {gameMode === "ai" ? "You (Black)" : myColor === "black" ? `${myPlayerId} (You)` : "P1"}
                          </span>
                          {gameState.currentPlayer === "black" && (
                            <span className="ml-auto text-[var(--pixel-accent)]">●</span>
                          )}
                        </div>
                        <div className={`flex items-center gap-2 rounded-lg p-2 border ${
                          (gameMode === "ai" ? false : myColor === "white")
                            ? "border-[var(--pixel-accent)]"
                            : "border-[var(--pixel-border)]"
                        }`}>
                          <div className="w-5 h-5 rounded-full bg-white border border-[var(--pixel-border)]" />
                          <span className="font-mono text-sm">
                            {gameMode === "ai" ? `AI (${aiDifficulty})` : myColor === "white" ? `${myPlayerId} (You)` : "P2"}
                          </span>
                          {gameState.currentPlayer === "white" && (
                            <span className="ml-auto text-[var(--pixel-accent)]">●</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-4">
                      <h3 className="mb-3 font-sans font-semibold text-[10px] text-[var(--pixel-accent)]">STATUS</h3>
                      <div className="space-y-2 font-mono text-sm">
                        {gameState.status === "waiting" && (
                          <p className="text-[var(--pixel-muted)]">&gt; Waiting for connection...</p>
                        )}
                        {gameState.status === "playing" && (
                          <p className="text-[var(--pixel-text)]">
                            &gt; {isMyTurn ? "Your turn" : `${opponentLabel}'s turn`}
                          </p>
                        )}
                        {gameState.status === "won" && (
                          <p className={
                            gameState.winner === (gameMode === "ai" ? "black" : myColor)
                              ? "text-[var(--pixel-accent)]"
                              : "text-[var(--pixel-warn)]"
                          }>
                            &gt; {gameState.winner === (gameMode === "ai" ? "black" : myColor)
                              ? "You won!"
                              : `${opponentLabel} won!`}
                          </p>
                        )}
                        {gameState.status === "draw" && (
                          <p className="text-[var(--pixel-muted)]">&gt; Draw!</p>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-4">
                      <h3 className="mb-3 font-sans font-semibold text-[10px] text-[var(--pixel-accent)]">STATS</h3>
                      <div className="space-y-1 font-mono text-sm">
                        <div className="flex justify-between">
                          <span>Black wins:</span>
                          <span className="text-[var(--pixel-accent)]">{stats.blackWins}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>White wins:</span>
                          <span className="text-[var(--pixel-accent)]">{stats.whiteWins}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Draws:</span>
                          <span className="text-[var(--pixel-muted)]">{stats.draws}</span>
                        </div>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-col gap-2">
                      {(gameState.status === "won" || gameState.status === "draw") && (
                        <button
                          onClick={resetGame}
                          className="w-full rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-accent)] px-4 py-3 font-sans font-semibold text-[10px] text-[var(--pixel-bg)] transition-transform hover:scale-[1.02]"
                        >
                          NEW GAME
                        </button>
                      )}
                      <button
                        onClick={exitToMenu}
                        className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[10px] text-[var(--pixel-muted)] transition-colors hover:text-[var(--pixel-accent)]"
                      >
                        MENU
                      </button>
                    </div>
                  </div>

                  {/* Board */}
                  <div className="flex-1 flex items-center justify-center">
                    <GomokuBoard
                      gameState={gameState}
                      cellSize={cellSize}
                      boardPixels={boardPixels}
                      stoneRadius={stoneRadius}
                      previewPos={previewPos}
                      lastMove={lastMove}
                      myColor={myColor}
                      gameMode={gameMode}
                      showExplosion={showExplosion}
                      explosionPieces={explosionPieces}
                      onCellClick={handleBoardClick}
                      onExplosionComplete={() => setShowExplosion(false)}
                    />
                  </div>
                </div>

                {/* Mobile confirm button */}
                {previewPos && (
                  <div className="flex gap-2 md:hidden">
                    <button
                      onClick={() => makeMove(previewPos.row, previewPos.col)}
                      className="rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-accent)] px-6 py-2.5 font-sans font-semibold text-[10px] text-[var(--pixel-bg)]"
                    >
                      CONFIRM
                    </button>
                    <button
                      onClick={() => setPreviewPos(null)}
                      className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2.5 font-sans font-semibold text-[10px] text-[var(--pixel-muted)]"
                    >
                      CANCEL
                    </button>
                  </div>
                )}

                {/* Mobile bottom controls */}
                <div className="flex gap-2 lg:hidden">
                  {(gameState.status === "won" || gameState.status === "draw") && (
                    <button
                      onClick={resetGame}
                      className="rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-accent)] px-5 py-2.5 font-sans font-semibold text-[10px] text-[var(--pixel-bg)]"
                    >
                      NEW GAME
                    </button>
                  )}
                  <button
                    onClick={exitToMenu}
                    className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2.5 font-sans font-semibold text-[10px] text-[var(--pixel-muted)]"
                  >
                    MENU
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {gameMode === "p2p" && isConnected && (
        <P2PStatusPanel
          isConnected={isConnected}
          phase={phase}
          role={myColor === "black" ? "P1 / black" : myColor === "white" ? "P2 / white" : "unknown"}
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
