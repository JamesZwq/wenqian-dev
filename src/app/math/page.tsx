"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import P2PConnectionPanel from "../../features/p2p/components/P2PConnectionPanel";
import { usePeerConnection } from "../../features/p2p/hooks/usePeerConnection";
import { useJoinParam } from "../../features/p2p/hooks/useJoinParam";
import { P2P_CONNECT_TIMEOUT_MS } from "../../features/p2p/config";
import {
  generateQuestionSet,
  type Operation,
  type Question,
} from "./mathEngine";

// ─── Types ───

type GameMode = "menu" | "solo" | "p2p";

type MathPacket =
  | { type: "config"; operations: Operation[]; totalQuestions: number; questions: Question[]; timestamp: number }
  | { type: "progress"; completed: number; timestamp: number }
  | { type: "finished"; totalTime: number; timestamp: number }
  | { type: "rematch"; timestamp: number };

type GameResult = {
  totalTime: number;
  speed: number;
  totalQuestions: number;
};

// ─── Constants ───

const ALL_OPS: { op: Operation; label: string }[] = [
  { op: "add", label: "+" },
  { op: "sub", label: "−" },
  { op: "mul", label: "×" },
  { op: "div", label: "÷" },
  { op: "mod", label: "%" },
];

const OP_LABEL_MAP: Record<Operation, string> = {
  add: "+", sub: "−", mul: "×", div: "÷", mod: "%",
};

const QUESTION_COUNTS = [10, 20, 50];
const LS_KEY = "math-sprint-best";

// ─── Best speed helpers ───

function getSettingsKey(ops: Operation[], count: number): string {
  return [...ops].sort().join(",") + ":" + count;
}

function getBestSpeed(ops: Operation[], count: number): number | null {
  try {
    const all = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    const v = all[getSettingsKey(ops, count)];
    return typeof v === "number" ? v : null;
  } catch { return null; }
}

function saveBestSpeed(ops: Operation[], count: number, speed: number): boolean {
  try {
    const key = getSettingsKey(ops, count);
    const all = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    const prev = all[key];
    if (typeof prev !== "number" || speed > prev) {
      all[key] = speed;
      localStorage.setItem(LS_KEY, JSON.stringify(all));
      return true; // new record
    }
    return false;
  } catch { return false; }
}

// ─── Component ───

export default function MathSprintPage() {
  const [gameMode, setGameMode] = useState<GameMode>("menu");
  const joinPeerId = useJoinParam();

  // Auto-enter P2P mode when ?join= is present
  useEffect(() => {
    if (joinPeerId) setGameMode("p2p");
  }, [joinPeerId]);

  // Settings
  const [selectedOps, setSelectedOps] = useState<Operation[]>(["add", "sub"]);
  const [totalQuestions, setTotalQuestions] = useState(20);

  // Game state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [flashColor, setFlashColor] = useState<"green" | "red" | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [bestSpeed, setBestSpeed] = useState<number | null>(null);
  const [resultOps, setResultOps] = useState<Operation[]>([]);
  const [resultCount, setResultCount] = useState(0);
  const [direction, setDirection] = useState<"outgoing" | "incoming" | null>(null);

  // P2P state
  const [opponentProgress, setOpponentProgress] = useState(0);
  const [opponentFinished, setOpponentFinished] = useState<GameResult | null>(null);
  const [waitingForConfig, setWaitingForConfig] = useState(false);
  const [p2pSettingsReady, setP2pSettingsReady] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionsRef = useRef(questions);
  const currentIndexRef = useRef(currentIndex);

  useEffect(() => { questionsRef.current = questions; }, [questions]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  // Load best speed when settings change
  useEffect(() => {
    setBestSpeed(getBestSpeed(selectedOps, totalQuestions));
  }, [selectedOps, totalQuestions]);

  // ─── Timer ───

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    const now = Date.now();
    setStartTime(now);
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - now);
    }, 200);
  }, [stopTimer]);

  useEffect(() => stopTimer, [stopTimer]);

  // ─── Speed ───

  const speed = useMemo(() => {
    if (currentIndex === 0 || elapsed === 0) return 0;
    return currentIndex / (elapsed / 60000);
  }, [currentIndex, elapsed]);

  // ─── P2P ───

  const handleIncomingData = useCallback(
    (payload: MathPacket) => {
      if (!payload?.type) return;

      switch (payload.type) {
        case "config": {
          setQuestions(payload.questions);
          setTotalQuestions(payload.totalQuestions);
          setSelectedOps(payload.operations);
          setCurrentIndex(0);
          setInputValue("");
          setResult(null);
          setIsNewRecord(false);
          setOpponentProgress(0);
          setOpponentFinished(null);
          setWaitingForConfig(false);
          setP2pSettingsReady(false);
          setResultOps(payload.operations);
          setResultCount(payload.totalQuestions);
          const now = Date.now();
          setStartTime(now);
          setElapsed(0);
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = setInterval(() => {
            setElapsed(Date.now() - now);
          }, 200);
          setTimeout(() => inputRef.current?.focus(), 100);
          break;
        }
        case "progress": {
          setOpponentProgress(payload.completed);
          break;
        }
        case "finished": {
          setOpponentFinished({
            totalTime: payload.totalTime,
            speed: 0,
            totalQuestions: questionsRef.current.length,
          });
          break;
        }
        case "rematch": {
          setResult(null);
          setIsNewRecord(false);
          setOpponentProgress(0);
          setOpponentFinished(null);
          setCurrentIndex(0);
          setInputValue("");
          setWaitingForConfig(false);
          if (direction === "outgoing") {
            setP2pSettingsReady(false);
          } else {
            setWaitingForConfig(true);
          }
          break;
        }
      }
    },
    [direction],
  );

  const {
    phase,
    localPeerId,
    error,
    isConnected,
    connect,
    send,
    clearError,
    retryLastConnection,
    reinitialize,
  } = usePeerConnection<MathPacket>({
    connectTimeoutMs: P2P_CONNECT_TIMEOUT_MS,
    onData: handleIncomingData,
    acceptIncomingConnections: true,
    onConnected: ({ direction: dir }) => {
      setDirection(dir);
      if (dir === "outgoing") {
        setP2pSettingsReady(false);
        setWaitingForConfig(false);
      } else {
        setWaitingForConfig(true);
        setP2pSettingsReady(false);
      }
    },
    onDisconnected: () => {
      setDirection(null);
      setWaitingForConfig(false);
      setP2pSettingsReady(false);
      stopTimer();
    },
  });

  const connectionDescription = useMemo(
    () => [
      "> Share your ID with a friend",
      "> Or enter their ID to connect",
      "> Host picks settings, then race!",
    ],
    [],
  );

  // ─── Start game ───

  const startSolo = useCallback(() => {
    const qs = generateQuestionSet(selectedOps, totalQuestions);
    setQuestions(qs);
    setCurrentIndex(0);
    setInputValue("");
    setResult(null);
    setIsNewRecord(false);
    setResultOps([...selectedOps]);
    setResultCount(totalQuestions);
    setGameMode("solo");
    startTimer();
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [selectedOps, totalQuestions, startTimer]);

  const startP2pGame = useCallback(() => {
    const qs = generateQuestionSet(selectedOps, totalQuestions);
    setQuestions(qs);
    setCurrentIndex(0);
    setInputValue("");
    setResult(null);
    setIsNewRecord(false);
    setOpponentProgress(0);
    setOpponentFinished(null);
    setP2pSettingsReady(true);
    setResultOps([...selectedOps]);
    setResultCount(totalQuestions);

    send({
      type: "config",
      operations: selectedOps,
      totalQuestions,
      questions: qs,
      timestamp: Date.now(),
    });

    startTimer();
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [selectedOps, totalQuestions, send, startTimer]);

  // ─── Answer logic ───

  const finishGame = useCallback((totalTime: number, total: number, ops: Operation[], count: number) => {
    const spd = total / (totalTime / 60000);
    const nr = saveBestSpeed(ops, count, spd);
    setResult({ totalTime, speed: spd, totalQuestions: total });
    setIsNewRecord(nr);
    setBestSpeed(getBestSpeed(ops, count));
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInputValue(val);

      if (currentIndex >= questions.length) return;

      const currentQ = questions[currentIndex];
      const answerStr = String(currentQ.answer);

      if (val === "-" && currentQ.answer < 0) return;

      if (val === answerStr) {
        // Correct — subtle green pulse
        setFlashColor("green");
        setTimeout(() => setFlashColor(null), 350);

        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);
        setInputValue("");

        if (gameMode === "p2p") {
          send({ type: "progress", completed: nextIndex, timestamp: Date.now() });
        }

        if (nextIndex >= questions.length) {
          stopTimer();
          const totalTime = Date.now() - startTime;
          finishGame(totalTime, questions.length, resultOps, resultCount);

          if (gameMode === "p2p") {
            send({ type: "finished", totalTime, timestamp: Date.now() });
          }
        } else {
          inputRef.current?.focus();
        }
      } else if (val.length >= answerStr.length && val !== answerStr) {
        // Wrong — subtle red pulse + shake + clear
        setShakeKey(k => k + 1);
        setFlashColor("red");
        setTimeout(() => {
          setFlashColor(null);
          setInputValue("");
          inputRef.current?.focus();
        }, 350);
      }
    },
    [currentIndex, questions, gameMode, send, stopTimer, startTime, finishGame, resultOps, resultCount],
  );

  // ─── Exit ───

  const exitToMenu = useCallback(() => {
    stopTimer();
    setGameMode("menu");
    setResult(null);
    setIsNewRecord(false);
    setQuestions([]);
    setCurrentIndex(0);
    setInputValue("");
    setOpponentProgress(0);
    setOpponentFinished(null);
    setWaitingForConfig(false);
    setP2pSettingsReady(false);
  }, [stopTimer]);

  const handleRematch = useCallback(() => {
    send({ type: "rematch", timestamp: Date.now() });
    setResult(null);
    setIsNewRecord(false);
    setOpponentProgress(0);
    setOpponentFinished(null);
    setCurrentIndex(0);
    setInputValue("");

    if (direction === "outgoing") {
      setP2pSettingsReady(false);
      setWaitingForConfig(false);
    } else {
      setWaitingForConfig(true);
    }
  }, [send, direction]);

  // ─── Helpers ───

  const toggleOp = (op: Operation) => {
    setSelectedOps(prev => {
      if (prev.includes(op)) {
        if (prev.length <= 1) return prev;
        return prev.filter(o => o !== op);
      }
      return [...prev, op];
    });
  };

  const formatTime = (ms: number) => {
    const secs = Math.floor(ms / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const opsLabel = (ops: Operation[]) => ops.map(o => OP_LABEL_MAP[o]).join(" ");

  const isPlaying = questions.length > 0 && currentIndex < questions.length && !result;
  const showP2pSettings = gameMode === "p2p" && isConnected && !p2pSettingsReady && direction === "outgoing" && !result;
  const showP2pWaiting = gameMode === "p2p" && isConnected && waitingForConfig && !result;
  const showGame = (gameMode === "solo" || (gameMode === "p2p" && isConnected && !showP2pSettings && !showP2pWaiting)) && questions.length > 0;

  // ─── Render ───

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
          className="inline-flex rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[8px] tracking-tight text-[var(--pixel-accent)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-md transition-colors hover:bg-[var(--pixel-bg-alt)] md:text-[10px]"
        >
          ← BACK
        </Link>
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
                <div className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-5 backdrop-blur-xl">
                  <h3 className="mb-4 font-sans font-semibold text-xs text-[var(--pixel-accent)]">
                    OPERATIONS
                  </h3>
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
                <div className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-5 backdrop-blur-xl">
                  <h3 className="mb-4 font-sans font-semibold text-xs text-[var(--pixel-accent)]">
                    QUESTIONS
                  </h3>
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

                {/* Best speed display */}
                {bestSpeed !== null && (
                  <div className="w-full rounded-xl border border-[var(--pixel-accent)]/30 bg-[var(--pixel-card-bg)] px-5 py-3 backdrop-blur-xl">
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
                  className="w-full rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-card-bg)] px-8 py-4 font-sans font-semibold text-sm tracking-tight text-[var(--pixel-accent)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-xl transition-all hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
                >
                  SOLO
                </button>
                <button
                  onClick={() => setGameMode("p2p")}
                  className="w-full rounded-xl border border-[var(--pixel-accent-2)] bg-[var(--pixel-card-bg)] px-8 py-4 font-sans font-semibold text-sm tracking-tight text-[var(--pixel-accent-2)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-xl transition-all hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
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
                  description={connectionDescription}
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
                <div className="w-full rounded-xl border border-[var(--pixel-accent-2)] bg-[var(--pixel-card-bg)] p-4 backdrop-blur-xl">
                  <p className="mb-1 font-sans font-semibold text-xs text-[var(--pixel-accent-2)]">
                    CONNECTED
                  </p>
                  <p className="font-mono text-xs text-[var(--pixel-muted)]">
                    &gt; You are the host. Choose settings and start!
                  </p>
                </div>

                <div className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-5 backdrop-blur-xl">
                  <h3 className="mb-4 font-sans font-semibold text-xs text-[var(--pixel-accent)]">
                    OPERATIONS
                  </h3>
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

                <div className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-5 backdrop-blur-xl">
                  <h3 className="mb-4 font-sans font-semibold text-xs text-[var(--pixel-accent)]">
                    QUESTIONS
                  </h3>
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
                <div className="w-full rounded-xl border border-[var(--pixel-accent-2)] bg-[var(--pixel-card-bg)] p-6 backdrop-blur-xl text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    className="mx-auto mb-4 h-8 w-8 rounded-full border-2 border-[var(--pixel-accent-2)] border-t-transparent"
                  />
                  <p className="font-sans font-semibold text-sm text-[var(--pixel-accent-2)]">
                    WAITING FOR HOST
                  </p>
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
                    {/* Progress bar + stats */}
                    <div className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-4 backdrop-blur-xl">
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

                      {/* P2P opponent progress */}
                      {gameMode === "p2p" && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-xs text-[var(--pixel-muted)]">
                              Opponent: {opponentProgress}/{questions.length}
                            </span>
                            {opponentFinished && (
                              <span className="font-mono text-xs text-[var(--pixel-accent-2)]">
                                DONE
                              </span>
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

                    {/* Question display — slot-machine scroll + inline input */}
                    <div className="w-full">
                      {/* Current question with inline input */}
                      <div className={`relative w-full rounded-xl border bg-[var(--pixel-card-bg)] p-6 md:p-10 backdrop-blur-xl overflow-hidden transition-all duration-200 ${
                        flashColor === "red"
                          ? "border-[#ef4444]/50 shadow-[0_0_12px_rgba(239,68,68,0.15)]"
                          : flashColor === "green"
                            ? "border-[#22c55e]/50 shadow-[0_0_12px_rgba(34,197,94,0.15)]"
                            : "border-[var(--pixel-border)] shadow-none"
                      }`}>
                        {isPlaying && (
                          <motion.div
                            key={currentIndex}
                            initial={{ opacity: 0, y: 48 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
                            className="flex items-center justify-center gap-2 md:gap-3"
                          >
                            <span className="font-mono text-3xl md:text-5xl font-bold text-[var(--pixel-text)] whitespace-nowrap">
                              {questions[currentIndex].display} =
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
                                autoFocus
                                value={inputValue}
                                onChange={handleInputChange}
                                disabled={!isPlaying}
                                className="w-[3.5ch] min-w-[60px] md:min-w-[80px] border-b-2 border-[var(--pixel-accent)] bg-transparent font-mono text-3xl md:text-5xl font-bold text-[var(--pixel-accent)] text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="?"
                              />
                            </motion.div>
                          </motion.div>
                        )}
                      </div>

                      {/* Next question preview */}
                      {isPlaying && currentIndex + 1 < questions.length && (
                        <motion.div
                          key={`next-${currentIndex + 1}`}
                          initial={{ opacity: 0, y: 24 }}
                          animate={{ opacity: 0.35, y: 0 }}
                          transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
                          className="mt-3 w-full rounded-xl border border-[var(--pixel-border)]/50 bg-[var(--pixel-card-bg)]/50 py-3 md:py-4 text-center backdrop-blur-sm"
                        >
                          <span className="font-mono text-lg md:text-2xl text-[var(--pixel-muted)]">
                            {questions[currentIndex + 1].display} = ?
                          </span>
                        </motion.div>
                      )}
                    </div>

                    {/* Controls */}
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
                    className="w-full rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-card-bg)] p-6 md:p-8 backdrop-blur-xl"
                  >
                    <h2 className="mb-2 text-center font-sans font-semibold text-xl text-[var(--pixel-accent)] md:text-2xl">
                      {gameMode === "p2p" && opponentFinished
                        ? result.totalTime <= opponentFinished.totalTime
                          ? "YOU WIN!"
                          : "YOU LOSE"
                        : "COMPLETE!"}
                    </h2>

                    {/* New record celebration */}
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

                    {/* Settings tag */}
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

                      {/* Opponent result */}
                      {gameMode === "p2p" && opponentFinished && (
                        <div className="flex justify-between rounded-lg border border-[var(--pixel-accent-2)] bg-[var(--pixel-bg)] px-4 py-3">
                          <span className="text-[var(--pixel-accent-2)]">Opponent</span>
                          <span className="text-[var(--pixel-accent-2)]">{formatTime(opponentFinished.totalTime)}</span>
                        </div>
                      )}
                      {gameMode === "p2p" && !opponentFinished && (
                        <div className="flex items-center justify-between rounded-lg border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-4 py-3">
                          <span className="text-[var(--pixel-muted)]">Opponent</span>
                          <span className="text-[var(--pixel-muted)]">Still playing... ({opponentProgress}/{questions.length})</span>
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
