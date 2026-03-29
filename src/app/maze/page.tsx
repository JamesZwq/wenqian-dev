"use client";

import { Fragment } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { P2P_CONNECT_TIMEOUT_MS } from "../../features/p2p/config";
import P2PConnectionPanel from "../../features/p2p/components/P2PConnectionPanel";
import { P2PStatusPanel } from "../../features/p2p/components/P2PStatusPanel";
import SettingsPanel from "./SettingsPanel";
import { ITEM_META, type InventorySlot } from "./items";
import { formatTime } from "./types";
import { useMazeGame } from "./hooks/useMazeGame";
import { AnimatedCircle } from "./components/AnimatedCircle";

export default function MazePage() {
  const {
    // Settings
    settings, setSettings, settingsOpen, setSettingsOpen, handleSettingsClose,

    // Maze display
    cellSize, displayMaze, displayRows, displayCols,
    generationRevealLookup, revealedCellCount, totalCells,
    isGenerating, mazeGenerationProgress,

    // Game state
    mode, setMode,
    player1Pos, player2Pos, goalPos,
    trail, winner, elapsedTime,

    // Remote P2P state
    myRemotePlayerId, remotePeerLabel, latencyMs, lastRemoteMessageAt,
    remoteStatusLabel, connectionDescription,

    // Item state
    fieldItems, p1Inventory, p2Inventory, activeEffects,
    xrayStars,
    bombMode, setBombMode, bombBlasts,

    // Visual effects
    foggedCells, isPlayerFrozen,

    // D-pad
    dpadVisible,

    // P2P connection
    phase, localPeerId, error, isConnected, connect,
    clearError, retryLastConnection, reinitialize,
    joinPeerId,

    // Handlers
    startSingleGame, startAiGame, startLocalGame, startRemoteRound,
    exitToMenu, handleSwipeStart, handleSwipeEnd, handleTouchMove,
    isAiGameRef,
  } = useMazeGame();

  // Settings gear button
  const SettingsGearButton = (
    <button
      onClick={() => setSettingsOpen(true)}
      className="group rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-2 text-[var(--pixel-muted)] backdrop-blur-sm transition-colors hover:text-[var(--pixel-accent)]"
      title="Settings"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300 group-hover:rotate-90">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  );

  // Inventory UI component
  const InventoryUI = ({
    playerId,
    inventory,
  }: {
    playerId: 1 | 2;
    inventory: InventorySlot[];
  }) => {
    const accentColor =
      playerId === 1 ? "var(--pixel-accent)" : "var(--pixel-accent-2)";

    return (
      <div className="flex items-center gap-1.5">
        <span
          className="font-sans font-semibold text-[8px]"
          style={{ color: accentColor }}
        >
          P{playerId}
        </span>
        {inventory.map((slot, i) => (
          <div
            key={i}
            className="flex h-7 w-7 items-center justify-center border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] text-xs"
            title={slot ? ITEM_META[slot.type].label : "Empty"}
          >
            {slot ? ITEM_META[slot.type].emoji : "·"}
          </div>
        ))}
      </div>
    );
  };

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

      <SettingsPanel
        open={settingsOpen}
        settings={settings}
        onChange={setSettings}
        onClose={handleSettingsClose}
      />

      <div className="container relative z-10 mx-auto flex min-h-screen flex-col items-center justify-center px-3 py-6 md:px-4 md:py-10">
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mb-5 text-center md:mb-8"
        >
          <h1 className="mb-2 font-sans font-semibold text-xl tracking-tight text-[var(--pixel-accent)] md:mb-3 md:text-5xl">
            MAZE RUNNER
          </h1>
          <p className="font-mono text-[11px] text-[var(--pixel-muted)] md:text-sm">
            &gt; Single / local versus / remote P2P maze race
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {mode === "menu" && (
            <motion.div
              key="menu"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="flex max-w-[760px] flex-col items-center gap-4"
            >
              <button
                onClick={startSingleGame}
                className="w-full rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-card-bg)] px-8 py-4 font-sans font-semibold text-sm tracking-tight text-[var(--pixel-accent)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-sm transition-all hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
              >
                SINGLE PLAYER
              </button>
              <button
                onClick={startAiGame}
                className="w-full rounded-xl border border-[var(--pixel-warn)] bg-[var(--pixel-card-bg)] px-8 py-4 font-sans font-semibold text-sm tracking-tight text-[var(--pixel-warn)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-sm transition-all hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
              >
                VS AI
              </button>
              <button
                onClick={startLocalGame}
                className="w-full rounded-xl border border-[var(--pixel-warn)] bg-[var(--pixel-card-bg)] px-8 py-4 font-sans font-semibold text-sm tracking-tight text-[var(--pixel-warn)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-sm transition-all hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
              >
                LOCAL VS
              </button>
              <button
                onClick={() => setMode("remote")}
                className="w-full rounded-xl border border-[var(--pixel-accent-2)] bg-[var(--pixel-card-bg)] px-8 py-4 font-sans font-semibold text-sm tracking-tight text-[var(--pixel-accent-2)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-sm transition-all hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
              >
                REMOTE P2P
              </button>
              <div className="mt-2">{SettingsGearButton}</div>
            </motion.div>
          )}

          {mode === "remote" && !isConnected && (
            <motion.div
              key="remote-setup"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="w-full max-w-[760px] px-2 md:px-0"
            >
              <P2PConnectionPanel
                localPeerId={localPeerId}
                phase={phase}
                connectTimeoutMs={P2P_CONNECT_TIMEOUT_MS}
                error={error}
                description={connectionDescription}
                autoConnectPeerId={joinPeerId}
                onConnect={connect}
                onRetry={retryLastConnection}
                onClearError={clearError}
                onReinitialize={reinitialize}
              />
              <div className="mt-4 flex justify-center gap-2">
                <button
                  onClick={() => setMode("menu")}
                  className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[10px] text-[var(--pixel-muted)]"
                >
                  MENU
                </button>
                {SettingsGearButton}
              </div>
            </motion.div>
          )}

          {mode !== "menu" &&
            (mode !== "remote" || isConnected) &&
            displayMaze && (
              <motion.div
                key="game"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="flex w-full max-w-[900px] flex-wrap items-center justify-center gap-2 md:gap-4">
                  <div className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-3 py-2 font-sans font-semibold text-xs text-[var(--pixel-accent)] backdrop-blur-sm md:px-4 md:text-sm">
                    {isGenerating
                      ? `BUILD ${Math.round((revealedCellCount / totalCells) * 100)}%`
                      : formatTime(elapsedTime)}
                  </div>


                  {mode === "remote" && (
                    <div className="rounded-xl border border-[var(--pixel-accent-2)] bg-[var(--pixel-card-bg)] px-3 py-2 font-mono text-[10px] uppercase text-[var(--pixel-accent-2)] backdrop-blur-sm">
                      {remoteStatusLabel}
                    </div>
                  )}

                  <button
                    onClick={exitToMenu}
                    className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-3 py-2 font-sans font-semibold text-[10px] text-[var(--pixel-muted)] backdrop-blur-sm transition-colors hover:text-[var(--pixel-accent)]"
                  >
                    MENU
                  </button>

                  <button
                    onClick={() => {
                      if (mode === "single") startSingleGame();
                      else if (mode === "local") isAiGameRef.current ? startAiGame() : startLocalGame();
                      else if (mode === "remote") startRemoteRound();
                    }}
                    disabled={mode === "remote" && myRemotePlayerId !== 1}
                    className="rounded-xl border border-[var(--pixel-accent-2)] bg-[var(--pixel-card-bg)] px-3 py-2 font-sans font-semibold text-[10px] text-[var(--pixel-accent-2)] backdrop-blur-sm transition-colors hover:bg-[var(--pixel-bg-alt)] disabled:opacity-40"
                  >
                    NEW_MAZE
                  </button>

                  {SettingsGearButton}
                </div>

                <div className="relative max-w-full overflow-auto rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-2 backdrop-blur-sm md:p-4" style={{ minHeight: displayRows * cellSize + 16 }}>
                  <svg
                    width={displayCols * cellSize}
                    height={displayRows * cellSize}
                    className="block"
                    style={{ touchAction: "none" }}
                    onTouchStart={handleSwipeStart}
                    onTouchEnd={handleSwipeEnd}
                  >
                    {displayMaze.map((row, r) =>
                      row.map((cell, c) => (
                        <g key={`${r}-${c}`}>
                          {cell.walls.top && (
                            <line
                              x1={c * cellSize}
                              y1={r * cellSize}
                              x2={(c + 1) * cellSize}
                              y2={r * cellSize}
                              stroke="var(--pixel-border)"
                              strokeWidth="2"
                            />
                          )}
                          {cell.walls.right && (
                            <line
                              x1={(c + 1) * cellSize}
                              y1={r * cellSize}
                              x2={(c + 1) * cellSize}
                              y2={(r + 1) * cellSize}
                              stroke="var(--pixel-border)"
                              strokeWidth="2"
                            />
                          )}
                          {cell.walls.bottom && (
                            <line
                              x1={c * cellSize}
                              y1={(r + 1) * cellSize}
                              x2={(c + 1) * cellSize}
                              y2={(r + 1) * cellSize}
                              stroke="var(--pixel-border)"
                              strokeWidth="2"
                            />
                          )}
                          {cell.walls.left && (
                            <line
                              x1={c * cellSize}
                              y1={r * cellSize}
                              x2={c * cellSize}
                              y2={(r + 1) * cellSize}
                              stroke="var(--pixel-border)"
                              strokeWidth="2"
                            />
                          )}
                        </g>
                      ))
                    )}

                    <AnimatePresence>
                      {(isGenerating || generationRevealLookup.size > 0) && (
                        <motion.g
                          key="build-overlay"
                          initial={{ opacity: 1 }}
                          animate={{ opacity: 1 }}
                          exit={{
                            opacity: 0,
                            transition: { duration: 0.26, ease: "easeOut" },
                          }}
                        >
                          <rect
                            x={0}
                            y={0}
                            width={displayCols * cellSize}
                            height={displayRows * cellSize}
                            fill="var(--pixel-bg)"
                            opacity={0.92}
                          />

                          {displayMaze.map((row, r) =>
                            row.map((cell, c) => {
                              const isRevealed =
                                generationRevealLookup.has(`${r}-${c}`);
                              if (!isRevealed) return null;

                              return (
                                <g key={`visible-${r}-${c}`}>
                                  <rect
                                    x={c * cellSize + 2}
                                    y={r * cellSize + 2}
                                    width={cellSize - 4}
                                    height={cellSize - 4}
                                    fill="var(--pixel-bg)"
                                    opacity={0.96}
                                  />
                                  <rect
                                    x={c * cellSize + 4}
                                    y={r * cellSize + 4}
                                    width={cellSize - 8}
                                    height={cellSize - 8}
                                    fill="var(--pixel-accent)"
                                    opacity={0.05}
                                  />
                                  {cell.walls.top && (
                                    <line
                                      x1={c * cellSize}
                                      y1={r * cellSize}
                                      x2={(c + 1) * cellSize}
                                      y2={r * cellSize}
                                      stroke="var(--pixel-border)"
                                      strokeWidth="2"
                                    />
                                  )}
                                  {cell.walls.right && (
                                    <line
                                      x1={(c + 1) * cellSize}
                                      y1={r * cellSize}
                                      x2={(c + 1) * cellSize}
                                      y2={(r + 1) * cellSize}
                                      stroke="var(--pixel-border)"
                                      strokeWidth="2"
                                    />
                                  )}
                                  {cell.walls.bottom && (
                                    <line
                                      x1={c * cellSize}
                                      y1={(r + 1) * cellSize}
                                      x2={(c + 1) * cellSize}
                                      y2={(r + 1) * cellSize}
                                      stroke="var(--pixel-border)"
                                      strokeWidth="2"
                                    />
                                  )}
                                  {cell.walls.left && (
                                    <line
                                      x1={c * cellSize}
                                      y1={r * cellSize}
                                      x2={c * cellSize}
                                      y2={(r + 1) * cellSize}
                                      stroke="var(--pixel-border)"
                                      strokeWidth="2"
                                    />
                                  )}
                                </g>
                              );
                            })
                          )}

                          {isGenerating && (
                            <>
                              <motion.rect
                                x={0}
                                y={
                                  mazeGenerationProgress *
                                    displayRows *
                                    cellSize -
                                  20
                                }
                                width={displayCols * cellSize}
                                height={40}
                                fill="var(--pixel-bg)"
                                opacity={0.32}
                                initial={false}
                                animate={{
                                  y:
                                    mazeGenerationProgress *
                                      displayRows *
                                      cellSize -
                                    20,
                                }}
                                transition={{
                                  ease: "linear",
                                  duration: 0.06,
                                }}
                              />
                              <motion.line
                                x1={0}
                                x2={displayCols * cellSize}
                                y1={
                                  mazeGenerationProgress *
                                  displayRows *
                                  cellSize
                                }
                                y2={
                                  mazeGenerationProgress *
                                  displayRows *
                                  cellSize
                                }
                                stroke="var(--pixel-accent)"
                                strokeWidth="2"
                                opacity={0.42}
                                initial={false}
                                animate={{
                                  y1:
                                    mazeGenerationProgress *
                                    displayRows *
                                    cellSize,
                                  y2:
                                    mazeGenerationProgress *
                                    displayRows *
                                    cellSize,
                                }}
                                transition={{
                                  ease: "linear",
                                  duration: 0.06,
                                }}
                              />
                            </>
                          )}
                        </motion.g>
                      )}
                    </AnimatePresence>

                    {/* Start cell */}
                    <rect
                      x={2}
                      y={2}
                      width={cellSize - 4}
                      height={cellSize - 4}
                      fill="var(--pixel-accent)"
                      opacity="0.2"
                    />
                    {/* End cell */}
                    <rect
                      x={goalPos.col * cellSize + 2}
                      y={goalPos.row * cellSize + 2}
                      width={cellSize - 4}
                      height={cellSize - 4}
                      fill="var(--pixel-warn)"
                      opacity="0.3"
                    />
{/* X-Ray — 星辰连线指引 */}
                    {xrayStars.length > 0 && (
                      <g>
                        <defs>
                          <filter id="xstar-glow" x="-100%" y="-100%" width="300%" height="300%">
                            <feGaussianBlur stdDeviation={Math.max(2, cellSize * 0.07)} result="b" />
                            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                          </filter>
                        </defs>

                        {/* 连线：每颗星只连下一颗 */}
                        {xrayStars.slice(0, -1).map((a, i) => {
                          const b = xrayStars[i + 1];
                          return (
                            <motion.line
                              key={`xl-${i}`}
                              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                              stroke="var(--pixel-accent)"
                              strokeWidth={Math.max(1, cellSize * 0.04)}
                              strokeLinecap="round"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: [0, 1, 1], opacity: [0, 0.6, 0] }}
                              transition={{ duration: 1.2, times: [0, 0.35, 1], delay: a.delay, ease: "easeOut" }}
                            />
                          );
                        })}

                        {/* 星星 */}
                        {xrayStars.map((s, i) => {
                          const r = s.isEnd ? Math.max(2.5, cellSize * 0.14) : Math.max(1.5, cellSize * 0.08);
                          return (
                            <Fragment key={`xs-${i}`}>
                              <motion.circle
                                cx={s.x} cy={s.y} r={r * 3}
                                fill="var(--pixel-accent)"
                                filter="url(#xstar-glow)"
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: [0, 0.35, 0.2, 0], scale: [0, 1, 0.8, 0] }}
                                transition={{ duration: 1.4, times: [0, 0.15, 0.6, 1], delay: s.delay, ease: "easeOut" }}
                              />
                              <motion.circle
                                cx={s.x} cy={s.y} r={r}
                                fill={s.isEnd ? "var(--pixel-warn)" : "#fff"}
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: [0, 1, 0.8, 0], scale: [0, 1.2, 1, 0] }}
                                transition={{ duration: 1.2, times: [0, 0.12, 0.6, 1], delay: s.delay, ease: "easeOut" }}
                              />
                            </Fragment>
                          );
                        })}

                        {/* 终点光环 */}
                        {(() => {
                          const last = xrayStars[xrayStars.length - 1];
                          return (
                            <motion.circle
                              cx={last.x} cy={last.y}
                              r={cellSize * 0.12}
                              fill="none"
                              stroke="var(--pixel-warn)"
                              strokeWidth={Math.max(1.5, cellSize * 0.06)}
                              initial={{ opacity: 0, scale: 0 }}
                              animate={{ opacity: [0, 1, 0], scale: [0.5, 2.5, 3.5] }}
                              transition={{ duration: 0.9, delay: last.delay + 0.2, ease: "easeOut" }}
                            />
                          );
                        })()}
                      </g>
                    )}

                    {/* Field items */}
                    {!isGenerating &&
                      settings.itemsEnabled &&
                      fieldItems.map((item) => {
                        const meta = ITEM_META[item.type];
                        const cx = item.col * cellSize + cellSize / 2;
                        const cy = item.row * cellSize + cellSize / 2;
                        const r = Math.max(5, cellSize * 0.3);
                        return (
                          <g key={item.id}>
                            <circle
                              cx={cx}
                              cy={cy}
                              r={r}
                              fill={meta.color}
                              opacity="0.3"
                            />
                            <text
                              x={cx}
                              y={cy}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontSize={Math.max(8, cellSize * 0.4)}
                            >
                              {meta.emoji}
                            </text>
                          </g>
                        );
                      })}

                    {/* Trail */}
                    {trail.map((t, i) => {
                      const age = Date.now() - t.timestamp;
                      const opacity = Math.max(0, 1 - age / 1600);
                      const color =
                        t.playerId === 1
                          ? "var(--pixel-accent)"
                          : "var(--pixel-accent-2)";
                      return (
                        <motion.circle
                          key={i}
                          cx={t.col * cellSize + cellSize / 2}
                          cy={t.row * cellSize + cellSize / 2}
                          r={Math.max(3.5, cellSize * 0.15)}
                          fill={color}
                          opacity={opacity * 0.28}
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: opacity * 0.28 }}
                          transition={{ duration: 0.06, ease: "linear" }}
                        />
                      );
                    })}

                    {/* Fog overlay */}
                    {foggedCells &&
                      !isGenerating &&
                      displayMaze.map((row, r) =>
                        row.map((_, c) => {
                          if (foggedCells.has(`${r}-${c}`)) return null;
                          return (
                            <rect
                              key={`fog-${r}-${c}`}
                              x={c * cellSize}
                              y={r * cellSize}
                              width={cellSize}
                              height={cellSize}
                              fill="var(--pixel-bg)"
                              opacity={0.85}
                            />
                          );
                        })
                      )}

                    {/* Player 1 */}
                    {!isGenerating && (
                      <AnimatedCircle
                        x={player1Pos.col * cellSize + cellSize / 2}
                        y={player1Pos.row * cellSize + cellSize / 2}
                        radius={Math.max(5, cellSize * 0.27)}
                        fill={
                          isPlayerFrozen(1)
                            ? "#87CEEB"
                            : "var(--pixel-accent)"
                        }
                      />
                    )}

                    {/* Player 2 */}
                    {player2Pos && !isGenerating && (
                      <AnimatedCircle
                        x={player2Pos.col * cellSize + cellSize / 2}
                        y={player2Pos.row * cellSize + cellSize / 2}
                        radius={Math.max(5, cellSize * 0.27)}
                        fill={
                          isPlayerFrozen(2)
                            ? "#87CEEB"
                            : "var(--pixel-accent-2)"
                        }
                      />
                    )}

                    {/* Bomb blast animations */}
                    <AnimatePresence>
                      {bombBlasts.map((b) => (
                        <motion.g key={b.id}>
                          {/* Flash */}
                          <motion.circle
                            cx={b.x} cy={b.y}
                            r={cellSize * 0.15}
                            fill="#FF4500"
                            initial={{ opacity: 1, scale: 0 }}
                            animate={{ opacity: [1, 0.9, 0], scale: [0, 1.8, 3] }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                          />
                          {/* Shockwave ring */}
                          <motion.circle
                            cx={b.x} cy={b.y}
                            r={cellSize * 0.3}
                            fill="none"
                            stroke="#FF4500"
                            strokeWidth={Math.max(1.5, cellSize * 0.06)}
                            initial={{ opacity: 0.8, scale: 0 }}
                            animate={{ opacity: [0.8, 0.4, 0], scale: [0.3, 2, 3.5] }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                          />
                          {/* Outer ring */}
                          <motion.circle
                            cx={b.x} cy={b.y}
                            r={cellSize * 0.2}
                            fill="none"
                            stroke="#FFA500"
                            strokeWidth={Math.max(1, cellSize * 0.03)}
                            initial={{ opacity: 0.6, scale: 0 }}
                            animate={{ opacity: [0.6, 0.2, 0], scale: [0.5, 2.5, 4] }}
                            transition={{ duration: 0.7, delay: 0.05, ease: "easeOut" }}
                          />
                          {/* Debris particles */}
                          {[0, 60, 120, 180, 240, 300].map((angle) => (
                            <motion.circle
                              key={angle}
                              cx={b.x} cy={b.y}
                              r={Math.max(1.5, cellSize * 0.04)}
                              fill="#FFA500"
                              initial={{ opacity: 1, x: 0, y: 0 }}
                              animate={{
                                opacity: [1, 0.6, 0],
                                x: Math.cos((angle * Math.PI) / 180) * cellSize * 0.8,
                                y: Math.sin((angle * Math.PI) / 180) * cellSize * 0.8,
                              }}
                              transition={{ duration: 0.45, ease: "easeOut" }}
                            />
                          ))}
                        </motion.g>
                      ))}
                    </AnimatePresence>
                  </svg>

                  {/* P2P 输赢闪光 */}
                  {winner !== null && mode !== "single" && (
                    <motion.div
                      className="absolute inset-0 rounded-xl pointer-events-none"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 0.35, 0.2, 0] }}
                      transition={{ duration: 1.5, times: [0, 0.15, 0.5, 1], ease: "easeOut" }}
                      style={{
                        background: (() => {
                          // 判断当前玩家是否赢了
                          const myId = mode === "remote" ? myRemotePlayerId : 1;
                          const won = winner === myId;
                          return won
                            ? "radial-gradient(ellipse at center, rgba(34,197,94,0.5) 0%, rgba(34,197,94,0) 70%)"
                            : "radial-gradient(ellipse at center, rgba(239,68,68,0.5) 0%, rgba(239,68,68,0) 70%)";
                        })(),
                      }}
                    />
                  )}
                </div>

                {/* 底部信息区 — 固定最小高度，避免显隐导致迷宫位置抖动 */}
                <div className="flex min-h-[72px] flex-col items-center justify-start gap-2">
                  <div className="flex flex-wrap justify-center gap-4 text-xs font-mono text-[var(--pixel-muted)]">
                    {mode === "single" && (
                      <div>
                        <span className="text-[var(--pixel-accent)]">P1:</span>{" "}
                        WASD
                      </div>
                    )}
                    {mode === "local" && (
                      <>
                        <div>
                          <span className="text-[var(--pixel-accent)]">
                            P1:
                          </span>{" "}
                          WASD
                        </div>
                        <div>
                          <span className="text-[var(--pixel-accent-2)]">
                            P2:
                          </span>{" "}
                          Arrows
                        </div>
                      </>
                    )}
                    {mode === "remote" && (
                      <div>
                        <span className="text-[var(--pixel-accent-2)]">
                          REMOTE:
                        </span>{" "}
                        WASD/Arrows
                      </div>
                    )}
                  </div>

                  {/* Bomb mode indicator */}
                  {bombMode?.active && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-2 rounded-xl border border-[#FF4500] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[9px] text-[#FF4500]"
                    >
                      <span className="hidden md:inline">BOMB: Press arrow key to choose wall direction (ESC to cancel)</span>
                      <span className="md:hidden">BOMB: Swipe or D-pad to pick direction</span>
                      <button
                        onClick={() => setBombMode(null)}
                        className="ml-1 rounded-lg border border-[#FF4500]/40 px-2 py-0.5 text-[9px] transition-colors hover:bg-[#FF4500]/10 md:hidden"
                      >
                        CANCEL
                      </button>
                    </motion.div>
                  )}

                  {/* Active effects display */}
                  {activeEffects.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {activeEffects.map((e, i) => {
                        const meta = ITEM_META[e.type];
                        const remaining = Math.max(
                          0,
                          Math.ceil((e.expiresAt - Date.now()) / 1000)
                        );
                        return (
                          <div
                            key={i}
                            className="border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-2 py-1 font-mono text-[9px]"
                            style={{ color: meta.color }}
                          >
                            {meta.emoji} P{e.targetPlayer} {remaining}s
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Backpack UI — 生成时隐藏但保留占位，避免布局跳动 */}
                {settings.itemsEnabled && (
                  <div
                    className="flex flex-wrap items-center justify-center gap-4 rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-3 py-2 backdrop-blur-sm"
                    style={{ visibility: isGenerating ? "hidden" : "visible" }}
                  >
                    <InventoryUI playerId={1} inventory={p1Inventory} />
                    {player2Pos !== null && (
                      <InventoryUI playerId={2} inventory={p2Inventory} />
                    )}
                  </div>
                )}

                {/* Mobile: double-tap hint */}
                <div
                  className="mt-1 text-center font-mono text-[9px] text-[var(--pixel-muted)] md:hidden"
                  style={{ visibility: isGenerating ? "hidden" : "visible" }}
                >
                  Double-tap anywhere to {dpadVisible ? "hide" : "show"} D-pad
                </div>

                {winner && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.82 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-card-bg)] px-6 py-4 text-center backdrop-blur-sm"
                  >
                    <div className="mb-2 font-sans font-semibold text-lg text-[var(--pixel-accent)]">
                      {mode === "single"
                        ? "COMPLETED!"
                        : mode === "remote"
                          ? winner === myRemotePlayerId
                            ? "YOU WIN!"
                            : "REMOTE WINS!"
                          : `PLAYER ${winner} WINS!`}
                    </div>
                    <div className="font-mono text-sm text-[var(--pixel-text)]">
                      Time: {formatTime(elapsedTime)}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
        </AnimatePresence>
      </div>

      {mode === "remote" && (
        <P2PStatusPanel
          isConnected={isConnected}
          phase={phase}
          role={
            myRemotePlayerId === 1
              ? "host / player 1"
              : myRemotePlayerId === 2
                ? "guest / player 2"
                : "unknown"
          }
          localPeerId={localPeerId}
          remotePeerId={remotePeerLabel}
          latencyMs={latencyMs}
          lastRemoteMessageAt={lastRemoteMessageAt}
        />
      )}

      {/* Mobile D-pad — double-tap maze to toggle, fixed at bottom center */}
      {mode !== "menu" && (mode !== "remote" || isConnected) && displayMaze && (
        <AnimatePresence>
            {dpadVisible && (
              <motion.div
                key="dpad"
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 md:hidden"
                style={{ touchAction: "none" }}
              >
                <div className="grid grid-cols-3 gap-2">
                  {/* Row 1: empty, Up, empty */}
                  <div />
                  <button
                    type="button"
                    onPointerDown={(e) => { e.preventDefault(); handleTouchMove("up"); }}
                    className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] text-2xl text-[var(--pixel-accent)] shadow-lg active:scale-90 active:bg-[color-mix(in_oklab,var(--pixel-accent)_20%,transparent)]"
                    style={{ touchAction: "none" }}
                  >
                    ↑
                  </button>
                  <div />
                  {/* Row 2: Left, (center gap), Right */}
                  <button
                    type="button"
                    onPointerDown={(e) => { e.preventDefault(); handleTouchMove("left"); }}
                    className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] text-2xl text-[var(--pixel-accent)] shadow-lg active:scale-90 active:bg-[color-mix(in_oklab,var(--pixel-accent)_20%,transparent)]"
                    style={{ touchAction: "none" }}
                  >
                    ←
                  </button>
                  <div />
                  <button
                    type="button"
                    onPointerDown={(e) => { e.preventDefault(); handleTouchMove("right"); }}
                    className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] text-2xl text-[var(--pixel-accent)] shadow-lg active:scale-90 active:bg-[color-mix(in_oklab,var(--pixel-accent)_20%,transparent)]"
                    style={{ touchAction: "none" }}
                  >
                    →
                  </button>
                  {/* Row 3: empty, Down, empty */}
                  <div />
                  <button
                    type="button"
                    onPointerDown={(e) => { e.preventDefault(); handleTouchMove("down"); }}
                    className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] text-2xl text-[var(--pixel-accent)] shadow-lg active:scale-90 active:bg-[color-mix(in_oklab,var(--pixel-accent)_20%,transparent)]"
                    style={{ touchAction: "none" }}
                  >
                    ↓
                  </button>
                  <div />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
      )}
    </div>
  );
}
