"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import P2PConnectionPanel from "../../features/p2p/components/P2PConnectionPanel";
import { P2PChat } from "../../features/p2p/components/P2PChat";
import { P2P_CONNECT_TIMEOUT_MS } from "../../features/p2p/config";
import ShareButton from "../components/ShareButton";
import Confetti from "../components/Confetti";
import { ReconnectingOverlay } from "@/features/p2p/components/ReconnectingOverlay";
import { useReactionGame, formatMs } from "./hooks/useReactionGame";
import { LightStrip } from "./components/LightStrip";
import { TOTAL_ROUNDS } from "./types";

const ACCENT = "#84cc16";

const CONNECTION_DESCRIPTION = [
  "> Share your code with a friend",
  "> Or enter their code to connect",
  "> Host generates the lights — same delays for both",
];

export default function ReactionPage() {
  const {
    gameMode, setGameMode,
    myIndex,
    roundIndex, roundStatus,
    litCount, isGoSignal,
    lastReaction, lastWasFalseStart,
    myReactions, oppReactions,
    bestSingle, bestAverage,
    isNewBestSingle, isNewBestAverage,
    myAverage, myBest, oppAverage, oppBest,
    isComplete,
    phase, localPeerId, error, isConnected, connect, sendChat, clearError,
    retryLastConnection, reinitialize, roomCode, connectSubstep,
    joinPeerId, isReconnecting, reconnectDeadline,
    chatMessages, addMyMessage,
    handleClick, startSolo, requestNewGame, exitToMenu, advanceRound,
  } = useReactionGame();

  const isGameActive = gameMode === "solo" || (gameMode === "p2p" && isConnected);
  const isHost = myIndex === 0;
  const isGuest = myIndex === 1;

  const lightsDisabled = roundStatus === "idle" || roundStatus === "result";

  // P2P winner determination — both players done all 5 rounds
  const myDone = myReactions.every(r => r !== null);
  const oppDone = oppReactions.every(r => r !== null);
  const youWonP2P =
    gameMode === "p2p" &&
    isComplete &&
    myDone &&
    (!oppDone || (myAverage !== null && oppAverage !== null && myAverage <= oppAverage));

  const showConfetti = isComplete && (gameMode === "solo" || youWonP2P);

  const statusText = (() => {
    if (roundStatus === "idle") return "Get ready...";
    if (roundStatus === "waiting") {
      if (litCount < 5) return `Lights ${litCount} / 5...`;
      return "Wait for lights to go out...";
    }
    if (roundStatus === "go") return "GO! Click now!";
    if (roundStatus === "result") {
      if (lastWasFalseStart) return `JUMP START! (+${lastReaction} ms penalty)`;
      return formatMs(lastReaction);
    }
    return "";
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
            <button
              onClick={exitToMenu}
              className="inline-flex rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[10px] tracking-tight text-[var(--pixel-accent)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-md transition-colors hover:bg-[var(--pixel-bg-alt)] md:text-xs"
            >
              ← BACK
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
          title="Reaction — F1 Starting Lights"
          text="F1-style starting lights reaction time test. 5 rounds, fastest reflexes win. Solo or race a friend P2P!"
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
            REACTION
          </h1>
          <p className="font-mono text-xs text-[var(--pixel-muted)] md:text-sm">
            {gameMode === "menu" && "> F1-style starting lights — 5 rounds, fastest reflexes win"}
            {gameMode === "p2p" && !isConnected && "> P2P — same delays for both, lower average wins"}
            {isGameActive && `> ${gameMode === "solo" ? "Solo" : isHost ? "P2P Host" : "P2P Guest"} | Round ${Math.min(roundIndex + 1, TOTAL_ROUNDS)} / ${TOTAL_ROUNDS}`}
          </p>
        </motion.div>

        <div className="w-full max-w-3xl">
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
                {/* Best stats */}
                <div
                  className="w-full rounded-xl border p-5"
                  style={{
                    borderColor: ACCENT,
                    background: "color-mix(in oklab, #84cc16 6%, var(--pixel-card-bg))",
                  }}
                >
                  <h3
                    className="mb-3 font-sans font-semibold text-xs"
                    style={{ color: ACCENT }}
                  >
                    PERSONAL BEST
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-3 text-center">
                      <div className="font-mono text-[9px] uppercase text-[var(--pixel-muted)]">Best Single</div>
                      <div
                        className="mt-1 font-mono text-xl font-bold"
                        style={{ color: bestSingle !== null ? ACCENT : "var(--pixel-muted)" }}
                      >
                        {bestSingle !== null ? formatMs(bestSingle) : "— —"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-3 text-center">
                      <div className="font-mono text-[9px] uppercase text-[var(--pixel-muted)]">Best Avg (5)</div>
                      <div
                        className="mt-1 font-mono text-xl font-bold"
                        style={{ color: bestAverage !== null ? ACCENT : "var(--pixel-muted)" }}
                      >
                        {bestAverage !== null ? formatMs(bestAverage) : "— —"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Solo */}
                <button
                  onClick={() => startSolo()}
                  className="w-full rounded-xl border bg-[var(--pixel-card-bg)] px-8 py-5 font-sans font-semibold text-base tracking-tight shadow-xl shadow-[var(--pixel-glow)] transition-[transform,background-color] duration-150 hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
                  style={{ borderColor: ACCENT, color: ACCENT }}
                >
                  SOLO — START
                </button>

                {/* P2P */}
                <button
                  onClick={() => setGameMode("p2p")}
                  className="w-full rounded-xl border border-[var(--pixel-accent-2)] bg-[var(--pixel-card-bg)] px-8 py-5 font-sans font-semibold text-base tracking-tight text-[var(--pixel-accent-2)] shadow-xl shadow-[var(--pixel-glow)] transition-[transform,background-color] duration-150 hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
                >
                  P2P RACE
                </button>

                <p className="text-center font-mono text-[10px] text-[var(--pixel-muted)]">
                  &gt; 5 rounds · 1.0–3.0 s random delay · click on green
                </p>
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
                  title="REACTION_P2P"
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
            {isGameActive && (
              <motion.div
                key="game"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
                className="flex flex-col items-center gap-3 md:gap-4"
              >
                {/* Header — round indicator + status */}
                <div className="flex w-full items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="font-mono text-[10px] uppercase text-[var(--pixel-muted)]">Round</span>
                    <span
                      className="font-sans text-3xl md:text-4xl font-bold leading-none"
                      style={{ color: ACCENT }}
                    >
                      {Math.min(roundIndex + 1, TOTAL_ROUNDS)} / {TOTAL_ROUNDS}
                    </span>
                  </div>

                  <div className="flex flex-col items-center">
                    <span className="font-mono text-[10px] uppercase text-[var(--pixel-muted)]">Status</span>
                    <span
                      className={`font-mono text-base md:text-2xl font-bold leading-tight text-center ${
                        roundStatus === "result" && lastWasFalseStart
                          ? "text-[var(--pixel-warn)]"
                          : roundStatus === "go"
                            ? ""
                            : "text-[var(--pixel-text)]"
                      }`}
                      style={
                        roundStatus === "go" || (roundStatus === "result" && !lastWasFalseStart)
                          ? { color: ACCENT }
                          : undefined
                      }
                    >
                      {statusText}
                    </span>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="font-mono text-[10px] uppercase text-[var(--pixel-muted)]">Avg</span>
                    <span className="font-mono text-base md:text-xl font-bold leading-none text-[var(--pixel-text)]">
                      {myAverage !== null ? formatMs(myAverage) : "— —"}
                    </span>
                  </div>
                </div>

                {/* Light strip */}
                <LightStrip
                  litCount={litCount}
                  isGoSignal={isGoSignal && !lastWasFalseStart}
                  onClickArea={handleClick}
                  disabled={lightsDisabled}
                />

                {/* Per-round results table */}
                <div className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-3">
                  <div className={`grid ${gameMode === "p2p" ? "grid-cols-[auto_repeat(5,1fr)]" : "grid-cols-5"} gap-1.5 md:gap-2`}>
                    {gameMode === "p2p" && (
                      <div className="flex items-center font-mono text-[10px] text-[var(--pixel-muted)] pr-2">YOU</div>
                    )}
                    {myReactions.map((r, i) => {
                      const isCurrent = i === roundIndex && roundStatus !== "result";
                      const isFalse = r === 1000 && i < roundIndex;
                      return (
                        <div
                          key={`me-${i}`}
                          className={[
                            "rounded-lg border px-1 py-2 text-center font-mono",
                            isCurrent
                              ? "border-[color-mix(in_oklab,#84cc16_60%,transparent)] bg-[color-mix(in_oklab,#84cc16_10%,transparent)]"
                              : r !== null
                                ? "border-[var(--pixel-border)]"
                                : "border-[var(--pixel-border)] opacity-60",
                          ].join(" ")}
                        >
                          <div className="text-[9px] text-[var(--pixel-muted)]">R{i + 1}</div>
                          <div
                            className={`mt-0.5 text-[11px] md:text-sm font-bold ${
                              r === null
                                ? "text-[var(--pixel-muted)]"
                                : isFalse
                                  ? "text-[var(--pixel-warn)]"
                                  : "text-[var(--pixel-text)]"
                            }`}
                            style={r !== null && !isFalse ? { color: ACCENT } : undefined}
                          >
                            {r !== null ? (isFalse ? "JS" : formatMs(r)) : "— —"}
                          </div>
                        </div>
                      );
                    })}
                    {gameMode === "p2p" && (
                      <>
                        <div className="flex items-center font-mono text-[10px] text-[var(--pixel-accent-2)] pr-2">OPP</div>
                        {oppReactions.map((r, i) => {
                          const isFalse = r === 1000;
                          return (
                            <div
                              key={`opp-${i}`}
                              className="rounded-lg border border-[var(--pixel-border)] px-1 py-2 text-center font-mono"
                            >
                              <div className="text-[9px] text-[var(--pixel-muted)]">R{i + 1}</div>
                              <div
                                className={`mt-0.5 text-[11px] md:text-sm font-bold ${
                                  r === null
                                    ? "text-[var(--pixel-muted)]"
                                    : isFalse
                                      ? "text-[var(--pixel-warn)]"
                                      : "text-[var(--pixel-accent-2)]"
                                }`}
                              >
                                {r !== null ? (isFalse ? "JS" : formatMs(r)) : "— —"}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>

                  {/* Stats line */}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-center font-mono text-[10px] md:grid-cols-4">
                    <div className="rounded border border-[var(--pixel-border)] px-2 py-1">
                      <div className="text-[var(--pixel-muted)]">Best</div>
                      <div className="font-bold text-[var(--pixel-text)]" style={myBest !== null ? { color: ACCENT } : undefined}>
                        {myBest !== null ? formatMs(myBest) : "— —"}
                      </div>
                    </div>
                    <div className="rounded border border-[var(--pixel-border)] px-2 py-1">
                      <div className="text-[var(--pixel-muted)]">Avg</div>
                      <div className="font-bold text-[var(--pixel-text)]" style={myAverage !== null ? { color: ACCENT } : undefined}>
                        {myAverage !== null ? formatMs(myAverage) : "— —"}
                      </div>
                    </div>
                    {gameMode === "p2p" && (
                      <>
                        <div className="rounded border border-[var(--pixel-border)] px-2 py-1">
                          <div className="text-[var(--pixel-muted)]">Opp Best</div>
                          <div className="font-bold text-[var(--pixel-accent-2)]">
                            {oppBest !== null ? formatMs(oppBest) : "— —"}
                          </div>
                        </div>
                        <div className="rounded border border-[var(--pixel-border)] px-2 py-1">
                          <div className="text-[var(--pixel-muted)]">Opp Avg</div>
                          <div className="font-bold text-[var(--pixel-accent-2)]">
                            {oppAverage !== null ? formatMs(oppAverage) : "— —"}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Result banner */}
                {isComplete && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full rounded-xl border p-4 text-center font-mono"
                    style={{
                      borderColor:
                        gameMode === "solo" || youWonP2P
                          ? ACCENT
                          : oppDone
                            ? "var(--pixel-warn)"
                            : "var(--pixel-muted)",
                      color:
                        gameMode === "solo" || youWonP2P
                          ? ACCENT
                          : oppDone
                            ? "var(--pixel-warn)"
                            : "var(--pixel-muted)",
                    }}
                  >
                    {gameMode === "solo" && (
                      <>
                        <p className="text-sm font-bold">
                          COMPLETE! Avg {formatMs(myAverage)} · Best {formatMs(myBest)}
                        </p>
                        {(isNewBestSingle || isNewBestAverage) && (
                          <p className="mt-1 text-xs" style={{ color: ACCENT }}>
                            ★ NEW {isNewBestSingle && isNewBestAverage ? "BEST SINGLE & AVG" : isNewBestSingle ? "BEST SINGLE" : "BEST AVG"} ★
                          </p>
                        )}
                      </>
                    )}
                    {gameMode === "p2p" && (
                      <>
                        <p className="text-sm font-bold">
                          {!oppDone
                            ? `Done · Avg ${formatMs(myAverage)} — waiting for opponent...`
                            : youWonP2P
                              ? `YOU WIN! Your avg ${formatMs(myAverage)}`
                              : `OPPONENT WINS. Your avg ${formatMs(myAverage)}`}
                        </p>
                        {oppDone && (
                          <p className="mt-1 text-[10px] text-[var(--pixel-muted)]">
                            {isHost ? "Guest" : "Host"} avg: {formatMs(oppAverage)}
                          </p>
                        )}
                      </>
                    )}
                  </motion.div>
                )}

                {/* Controls */}
                <div className="flex w-full gap-2">
                  {/* NEXT ROUND button — between rounds */}
                  {roundStatus === "result" && !isComplete && (gameMode === "solo" || isHost) && (
                    <button
                      onClick={advanceRound}
                      className="flex-1 rounded-xl border px-4 py-2.5 font-sans font-semibold text-xs transition-transform hover:scale-[1.02]"
                      style={{
                        borderColor: ACCENT,
                        background: ACCENT,
                        color: "var(--pixel-bg)",
                      }}
                    >
                      NEXT ROUND →
                    </button>
                  )}
                  {roundStatus === "result" && !isComplete && gameMode === "p2p" && isGuest && (
                    <div className="flex-1 rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2.5 text-center font-mono text-[10px] text-[var(--pixel-muted)]">
                      Waiting for host...
                    </div>
                  )}

                  {/* PLAY AGAIN button — after round 5 */}
                  {isComplete && (gameMode === "solo" || isHost) && (
                    <button
                      onClick={requestNewGame}
                      className="flex-1 rounded-xl border px-4 py-2.5 font-sans font-semibold text-xs transition-transform hover:scale-[1.02]"
                      style={{
                        borderColor: ACCENT,
                        background: ACCENT,
                        color: "var(--pixel-bg)",
                      }}
                    >
                      {gameMode === "solo" ? "PLAY AGAIN" : "REMATCH"}
                    </button>
                  )}
                  {isComplete && gameMode === "p2p" && isGuest && (
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
