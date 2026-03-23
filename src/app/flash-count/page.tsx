"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import P2PConnectionPanel from "../../features/p2p/components/P2PConnectionPanel";
import { usePeerConnection } from "../../features/p2p/hooks/usePeerConnection";
import { useJoinParam } from "../../features/p2p/hooks/useJoinParam";
import { P2P_CONNECT_TIMEOUT_MS } from "../../features/p2p/config";
import {
  generatePuzzleSet,
  toIsometric,
  cubeTopFace,
  cubeLeftFace,
  cubeRightFace,
  type BlockPuzzle,
  type Difficulty,
} from "./flashCountEngine";

// ─── Types ───

type GameMode = "menu" | "solo" | "p2p";
type GamePhase = "flash" | "answer" | "reveal" | "done";

type FlashPacket =
  | { type: "config"; difficulty: Difficulty; totalQuestions: number; puzzles: BlockPuzzle[]; timestamp: number }
  | { type: "progress"; completed: number; timestamp: number }
  | { type: "finished"; totalTime: number; timestamp: number }
  | { type: "rematch"; timestamp: number }
  | { type: "settings_preview"; difficulty: Difficulty; totalQuestions: number; timestamp: number };

type GameResult = {
  totalTime: number;
  speed: number;
  totalQuestions: number;
};

// ─── Constants ───

const DIFFICULTIES: { key: Difficulty; label: string }[] = [
  { key: "easy", label: "EASY" },
  { key: "medium", label: "MEDIUM" },
  { key: "hard", label: "HARD" },
];

const QUESTION_COUNTS = [10, 20, 50];
const LS_KEY = "flash-count-best";

const TILE_W = 40;
const TILE_H = 20;

// ─── Best speed helpers ───

function getSettingsKey(diff: Difficulty, count: number): string {
  return `${diff}:${count}`;
}

function getBestSpeed(diff: Difficulty, count: number): number | null {
  try {
    const all = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    const v = all[getSettingsKey(diff, count)];
    return typeof v === "number" ? v : null;
  } catch { return null; }
}

function saveBestSpeed(diff: Difficulty, count: number, speed: number): boolean {
  try {
    const key = getSettingsKey(diff, count);
    const all = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    const prev = all[key];
    if (typeof prev !== "number" || speed > prev) {
      all[key] = speed;
      localStorage.setItem(LS_KEY, JSON.stringify(all));
      return true;
    }
    return false;
  } catch { return false; }
}

// ─── Isometric SVG renderer ───

function IsometricBlocks({ puzzle, tileW, tileH }: { puzzle: BlockPuzzle; tileW: number; tileH: number }) {
  const { grid, rows, cols } = puzzle;

  // Compute SVG bounds
  const allPoints: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const h = grid[r][c];
      if (h === 0) continue;
      for (let l = 0; l < h; l++) {
        const { x, y } = toIsometric(r, c, l, tileW, tileH);
        allPoints.push(
          { x: x - tileW / 2, y: y - tileH },
          { x: x + tileW / 2, y: y - tileH },
          { x: x - tileW / 2, y: y + tileH },
          { x: x + tileW / 2, y: y + tileH },
        );
      }
    }
  }

  if (allPoints.length === 0) return null;

  const minX = Math.min(...allPoints.map(p => p.x));
  const maxX = Math.max(...allPoints.map(p => p.x));
  const minY = Math.min(...allPoints.map(p => p.y));
  const maxY = Math.max(...allPoints.map(p => p.y));

  const pad = 8;
  const svgW = maxX - minX + pad * 2;
  const svgH = maxY - minY + pad * 2;
  const offX = -minX + pad;
  const offY = -minY + pad;

  // Render back-to-front: row ascending, col ascending, layer ascending
  const cubes: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const h = grid[r][c];
      for (let l = 0; l < h; l++) {
        const { x, y } = toIsometric(r, c, l, tileW, tileH);
        const cx = x + offX;
        const cy = y + offY;
        const key = `${r}-${c}-${l}`;
        cubes.push(
          <g key={key}>
            <polygon
              points={cubeLeftFace(cx, cy, tileW, tileH)}
              fill="#4a8"
              stroke="#111"
              strokeWidth={0.8}
              strokeLinejoin="round"
            />
            <polygon
              points={cubeRightFace(cx, cy, tileW, tileH)}
              fill="#37a"
              stroke="#111"
              strokeWidth={0.8}
              strokeLinejoin="round"
            />
            <polygon
              points={cubeTopFace(cx, cy, tileW, tileH)}
              fill="#6dc"
              stroke="#111"
              strokeWidth={0.8}
              strokeLinejoin="round"
            />
          </g>,
        );
      }
    }
  }

  return (
    <svg
      width={svgW}
      height={svgH}
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="mx-auto block max-h-[200px] md:max-h-[280px] w-auto"
    >
      {cubes}
    </svg>
  );
}

// ─── Reveal animation: blocks appear one-by-one along a traversal path ───

function getBlockTraversal(puzzle: BlockPuzzle): { r: number; c: number; l: number }[] {
  const blocks: { r: number; c: number; l: number }[] = [];
  const { grid, rows, cols } = puzzle;
  // Traverse: layer 0 first (bottom), then 1, etc. Within each layer: back-to-front, left-to-right
  const maxH = Math.max(...grid.flat());
  for (let l = 0; l < maxH; l++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] > l) {
          blocks.push({ r, c, l });
        }
      }
    }
  }
  return blocks;
}

const REVEAL_INTERVAL = 80; // ms per block

function RevealBlocks({
  puzzle,
  tileW,
  tileH,
  onComplete,
}: {
  puzzle: BlockPuzzle;
  tileW: number;
  tileH: number;
  onComplete: () => void;
}) {
  const traversal = useMemo(() => getBlockTraversal(puzzle), [puzzle]);
  const [visibleCount, setVisibleCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setVisibleCount(0);
    intervalRef.current = setInterval(() => {
      setVisibleCount(prev => {
        const next = prev + 1;
        if (next >= traversal.length) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return traversal.length;
        }
        return next;
      });
    }, REVEAL_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [traversal]);

  // Auto-advance after all blocks revealed + a short pause
  useEffect(() => {
    if (visibleCount >= traversal.length && traversal.length > 0) {
      const t = setTimeout(onComplete, 400);
      return () => clearTimeout(t);
    }
  }, [visibleCount, traversal.length, onComplete]);

  // Compute SVG bounds from ALL blocks (not just visible) so the SVG doesn't resize
  const { rows, cols, grid } = puzzle;
  const allPoints: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const h = grid[r][c];
      if (h === 0) continue;
      for (let l = 0; l < h; l++) {
        const { x, y } = toIsometric(r, c, l, tileW, tileH);
        allPoints.push(
          { x: x - tileW / 2, y: y - tileH },
          { x: x + tileW / 2, y: y - tileH },
          { x: x - tileW / 2, y: y + tileH },
          { x: x + tileW / 2, y: y + tileH },
        );
      }
    }
  }

  if (allPoints.length === 0) return null;

  const minX = Math.min(...allPoints.map(p => p.x));
  const maxX = Math.max(...allPoints.map(p => p.x));
  const minY = Math.min(...allPoints.map(p => p.y));
  const maxY = Math.max(...allPoints.map(p => p.y));

  const pad = 8;
  const svgW = maxX - minX + pad * 2;
  const svgH = maxY - minY + pad * 2;
  const offX = -minX + pad;
  const offY = -minY + pad;

  const visibleSet = new Set(
    traversal.slice(0, visibleCount).map(b => `${b.r}-${b.c}-${b.l}`)
  );

  const cubes: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const h = grid[r][c];
      for (let l = 0; l < h; l++) {
        const key = `${r}-${c}-${l}`;
        if (!visibleSet.has(key)) continue;
        const { x, y } = toIsometric(r, c, l, tileW, tileH);
        const cx = x + offX;
        const cy = y + offY;
        cubes.push(
          <g key={key}>
            <polygon points={cubeLeftFace(cx, cy, tileW, tileH)} fill="#4a8" stroke="#111" strokeWidth={0.8} strokeLinejoin="round" />
            <polygon points={cubeRightFace(cx, cy, tileW, tileH)} fill="#37a" stroke="#111" strokeWidth={0.8} strokeLinejoin="round" />
            <polygon points={cubeTopFace(cx, cy, tileW, tileH)} fill="#6dc" stroke="#111" strokeWidth={0.8} strokeLinejoin="round" />
          </g>,
        );
      }
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="mx-auto block max-h-[200px] md:max-h-[280px] w-auto"
      >
        {cubes}
      </svg>
      <span className="font-mono text-2xl md:text-3xl font-bold text-[var(--pixel-accent)]">
        {visibleCount} / {traversal.length}
      </span>
    </div>
  );
}

// ─── Component ───

export default function FlashCountPage() {
  const [gameMode, setGameMode] = useState<GameMode>("menu");
  const joinPeerId = useJoinParam();

  // Auto-enter P2P mode when ?join= is present
  useEffect(() => {
    if (joinPeerId) setGameMode("p2p");
  }, [joinPeerId]);

  // Settings
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [totalQuestions, setTotalQuestions] = useState(20);

  // Game state
  const [puzzles, setPuzzles] = useState<BlockPuzzle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [gamePhase, setGamePhase] = useState<GamePhase>("flash");
  const [inputValue, setInputValue] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [flashColor, setFlashColor] = useState<"green" | "red" | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [bestSpeed, setBestSpeed] = useState<number | null>(null);
  const [resultDiff, setResultDiff] = useState<Difficulty>("easy");
  const [resultCount, setResultCount] = useState(0);
  const [direction, setDirection] = useState<"outgoing" | "incoming" | null>(null);
  const [revealPuzzle, setRevealPuzzle] = useState<BlockPuzzle | null>(null);

  // P2P state
  const [opponentProgress, setOpponentProgress] = useState(0);
  const [opponentFinished, setOpponentFinished] = useState<GameResult | null>(null);
  const [waitingForConfig, setWaitingForConfig] = useState(false);
  const [p2pSettingsReady, setP2pSettingsReady] = useState(false);
  const [hostPreview, setHostPreview] = useState<{ difficulty: Difficulty; totalQuestions: number } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const puzzlesRef = useRef(puzzles);

  useEffect(() => { puzzlesRef.current = puzzles; }, [puzzles]);

  // Load best speed
  useEffect(() => {
    setBestSpeed(getBestSpeed(difficulty, totalQuestions));
  }, [difficulty, totalQuestions]);

  // ─── Timer ───

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    const now = Date.now();
    setStartTime(now);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(Date.now() - now), 200);
  }, [stopTimer]);

  useEffect(() => {
    return () => {
      stopTimer();
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, [stopTimer]);

  // ─── Speed ───

  const speed = useMemo(() => {
    if (currentIndex === 0 || elapsed === 0) return 0;
    return currentIndex / (elapsed / 60000);
  }, [currentIndex, elapsed]);

  // ─── Flash control ───

  const startFlash = useCallback((puzzle: BlockPuzzle) => {
    setGamePhase("flash");
    setInputValue("");
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => {
      setGamePhase("answer");
      setTimeout(() => inputRef.current?.focus(), 50);
    }, puzzle.flashDuration);
  }, []);

  // ─── P2P ───

  const handleIncomingData = useCallback(
    (payload: FlashPacket) => {
      if (!payload?.type) return;
      switch (payload.type) {
        case "config": {
          setPuzzles(payload.puzzles);
          setTotalQuestions(payload.totalQuestions);
          setDifficulty(payload.difficulty);
          setCurrentIndex(0);
          setInputValue("");
          setResult(null);
          setIsNewRecord(false);
          setOpponentProgress(0);
          setOpponentFinished(null);
          setWaitingForConfig(false);
          setP2pSettingsReady(false);
          setResultDiff(payload.difficulty);
          setResultCount(payload.totalQuestions);
          const now = Date.now();
          setStartTime(now);
          setElapsed(0);
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = setInterval(() => setElapsed(Date.now() - now), 200);
          // Start first flash
          setGamePhase("flash");
          if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
          flashTimerRef.current = setTimeout(() => {
            setGamePhase("answer");
            setTimeout(() => inputRef.current?.focus(), 50);
          }, payload.puzzles[0].flashDuration);
          break;
        }
        case "progress": setOpponentProgress(payload.completed); break;
        case "finished": {
          setOpponentFinished({ totalTime: payload.totalTime, speed: 0, totalQuestions: puzzlesRef.current.length });
          break;
        }
        case "rematch": {
          setResult(null); setIsNewRecord(false); setOpponentProgress(0); setOpponentFinished(null);
          setCurrentIndex(0); setInputValue(""); setWaitingForConfig(false);
          if (direction === "outgoing") setP2pSettingsReady(false);
          else { setWaitingForConfig(true); setHostPreview(null); }
          break;
        }
        case "settings_preview": {
          setHostPreview({ difficulty: payload.difficulty, totalQuestions: payload.totalQuestions });
          break;
        }
      }
    },
    [direction],
  );

  const {
    phase, localPeerId, error, isConnected, connect, send, clearError, retryLastConnection, reinitialize,
  } = usePeerConnection<FlashPacket>({
    connectTimeoutMs: P2P_CONNECT_TIMEOUT_MS,
    onData: handleIncomingData,
    acceptIncomingConnections: true,
    onConnected: ({ direction: dir }) => {
      setDirection(dir);
      if (dir === "outgoing") { setP2pSettingsReady(false); setWaitingForConfig(false); }
      else { setWaitingForConfig(true); setP2pSettingsReady(false); }
    },
    onDisconnected: () => { setDirection(null); setWaitingForConfig(false); setP2pSettingsReady(false); stopTimer(); },
  });

  const connectionDescription = useMemo(() => [
    "> Share your ID with a friend",
    "> Or enter their ID to connect",
    "> Host picks difficulty, then race!",
  ], []);

  // Send settings preview to guest when host changes difficulty/questions
  useEffect(() => {
    if (gameMode === "p2p" && isConnected && direction === "outgoing" && !p2pSettingsReady) {
      send({ type: "settings_preview", difficulty, totalQuestions, timestamp: Date.now() });
    }
  }, [gameMode, isConnected, direction, p2pSettingsReady, difficulty, totalQuestions, send]);

  // ─── Start game ───

  const startSolo = useCallback(() => {
    const pz = generatePuzzleSet(difficulty, totalQuestions);
    setPuzzles(pz);
    setCurrentIndex(0);
    setInputValue("");
    setResult(null);
    setIsNewRecord(false);
    setResultDiff(difficulty);
    setResultCount(totalQuestions);
    setGameMode("solo");
    startTimer();
    startFlash(pz[0]);
  }, [difficulty, totalQuestions, startTimer, startFlash]);

  const startP2pGame = useCallback(() => {
    const pz = generatePuzzleSet(difficulty, totalQuestions);
    setPuzzles(pz);
    setCurrentIndex(0);
    setInputValue("");
    setResult(null);
    setIsNewRecord(false);
    setOpponentProgress(0);
    setOpponentFinished(null);
    setP2pSettingsReady(true);
    setResultDiff(difficulty);
    setResultCount(totalQuestions);
    send({ type: "config", difficulty, totalQuestions, puzzles: pz, timestamp: Date.now() });
    startTimer();
    startFlash(pz[0]);
  }, [difficulty, totalQuestions, send, startTimer, startFlash]);

  // ─── Answer logic ───

  const finishGame = useCallback((totalTime: number, total: number, diff: Difficulty, count: number) => {
    const spd = total / (totalTime / 60000);
    const nr = saveBestSpeed(diff, count, spd);
    setResult({ totalTime, speed: spd, totalQuestions: total });
    setIsNewRecord(nr);
    setBestSpeed(getBestSpeed(diff, count));
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInputValue(val);

      if (gamePhase !== "answer" || currentIndex >= puzzles.length) return;

      const currentP = puzzles[currentIndex];
      const answerStr = String(currentP.answer);

      if (val === answerStr) {
        // Correct — green pulse, then reveal
        setFlashColor("green");
        setTimeout(() => setFlashColor(null), 350);

        setRevealPuzzle(currentP);
        setGamePhase("reveal");
        setInputValue("");

        if (gameMode === "p2p") {
          send({ type: "progress", completed: currentIndex + 1, timestamp: Date.now() });
        }
      } else if (val.length >= answerStr.length && val !== answerStr) {
        // Wrong
        setShakeKey(k => k + 1);
        setFlashColor("red");
        setTimeout(() => {
          setFlashColor(null);
          setInputValue("");
          inputRef.current?.focus();
        }, 350);
      }
    },
    [gamePhase, currentIndex, puzzles, gameMode, send],
  );

  // ─── Reveal complete → advance to next question ───

  const onRevealComplete = useCallback(() => {
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    setRevealPuzzle(null);

    if (nextIndex >= puzzles.length) {
      stopTimer();
      const totalTime = Date.now() - startTime;
      setGamePhase("done");
      finishGame(totalTime, puzzles.length, resultDiff, resultCount);
      if (gameMode === "p2p") {
        send({ type: "finished", totalTime, timestamp: Date.now() });
      }
    } else {
      startFlash(puzzles[nextIndex]);
    }
  }, [currentIndex, puzzles, stopTimer, startTime, finishGame, resultDiff, resultCount, gameMode, send, startFlash]);

  // ─── Exit ───

  const exitToMenu = useCallback(() => {
    stopTimer();
    if (flashTimerRef.current) { clearTimeout(flashTimerRef.current); flashTimerRef.current = null; }
    setGameMode("menu"); setResult(null); setIsNewRecord(false); setPuzzles([]);
    setCurrentIndex(0); setInputValue(""); setGamePhase("flash");
    setOpponentProgress(0); setOpponentFinished(null); setWaitingForConfig(false); setP2pSettingsReady(false);
  }, [stopTimer]);

  const handleRematch = useCallback(() => {
    send({ type: "rematch", timestamp: Date.now() });
    setResult(null); setIsNewRecord(false); setOpponentProgress(0); setOpponentFinished(null);
    setCurrentIndex(0); setInputValue(""); setGamePhase("flash");
    if (direction === "outgoing") { setP2pSettingsReady(false); setWaitingForConfig(false); }
    else setWaitingForConfig(true);
  }, [send, direction]);

  // ─── Helpers ───

  const formatTime = (ms: number) => {
    const secs = Math.floor(ms / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const isPlaying = puzzles.length > 0 && currentIndex < puzzles.length && !result;
  const showP2pSettings = gameMode === "p2p" && isConnected && !p2pSettingsReady && direction === "outgoing" && !result;
  const showP2pWaiting = gameMode === "p2p" && isConnected && waitingForConfig && !result;
  const showGame = (gameMode === "solo" || (gameMode === "p2p" && isConnected && !showP2pSettings && !showP2pWaiting)) && puzzles.length > 0;

  // ─── Settings panel (shared between menu and p2p host) ───

  const settingsPanel = (
    <>
      <div className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-5 backdrop-blur-xl">
        <h3 className="mb-4 font-sans font-semibold text-xs text-[var(--pixel-accent)]">
          DIFFICULTY
        </h3>
        <div className="flex gap-2">
          {DIFFICULTIES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDifficulty(key)}
              className={`flex-1 rounded-xl border px-4 py-3 font-sans font-semibold text-sm transition-all hover:scale-[1.02] ${
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
    </>
  );

  // ─── Render ───

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

      <div className="relative z-10 container mx-auto px-3 md:px-4 py-4 md:py-8 min-h-screen flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
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
            {/* ─── Menu ─── */}
            {gameMode === "menu" && (
              <motion.div
                key="menu"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                className="mx-auto flex max-w-md flex-col items-center gap-4"
              >
                {settingsPanel}

                {bestSpeed !== null && (
                  <div className="w-full rounded-xl border border-[var(--pixel-accent)]/30 bg-[var(--pixel-card-bg)] px-5 py-3 backdrop-blur-xl">
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
                  title="FLASH_COUNT_P2P"
                  description={connectionDescription}
                  autoConnectPeerId={joinPeerId}
                  onConnect={connect}
                  onRetry={retryLastConnection}
                  onClearError={clearError}
                  onReinitialize={reinitialize}
                />
                <div className="mt-4 flex justify-center">
                  <button onClick={exitToMenu} className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[10px] text-[var(--pixel-muted)]">
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
                  <p className="mb-1 font-sans font-semibold text-xs text-[var(--pixel-accent-2)]">CONNECTED</p>
                  <p className="font-mono text-xs text-[var(--pixel-muted)]">&gt; You are the host. Choose settings and start!</p>
                </div>
                {settingsPanel}
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
                          {currentIndex}/{puzzles.length}
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
                          animate={{ width: `${(currentIndex / puzzles.length) * 100}%` }}
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      </div>

                      {gameMode === "p2p" && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-xs text-[var(--pixel-muted)]">
                              Opponent: {opponentProgress}/{puzzles.length}
                            </span>
                            {opponentFinished && (
                              <span className="font-mono text-xs text-[var(--pixel-accent-2)]">DONE</span>
                            )}
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-[var(--pixel-bg)] overflow-hidden">
                            <motion.div
                              className="h-full bg-[var(--pixel-accent-2)]"
                              initial={false}
                              animate={{ width: `${(opponentProgress / puzzles.length) * 100}%` }}
                              transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Main game card */}
                    <div className={`relative w-full rounded-xl border bg-[var(--pixel-card-bg)] backdrop-blur-xl overflow-hidden transition-all duration-200 ${
                      flashColor === "red"
                        ? "border-[#ef4444]/50 shadow-[0_0_12px_rgba(239,68,68,0.15)]"
                        : flashColor === "green"
                          ? "border-[#22c55e]/50 shadow-[0_0_12px_rgba(34,197,94,0.15)]"
                          : "border-[var(--pixel-border)] shadow-none"
                    }`}>
                      {/* Block display area */}
                      <div className="flex items-center justify-center p-6 md:p-10 min-h-[200px] md:min-h-[280px]">
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
                        {isPlaying && gamePhase === "answer" && (
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
                                onChange={handleInputChange}
                                disabled={gamePhase !== "answer"}
                                className="w-[3.5ch] min-w-[60px] md:min-w-[80px] border-b-2 border-[var(--pixel-accent)] bg-transparent font-mono text-3xl md:text-5xl font-bold text-[var(--pixel-accent)] text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="?"
                              />
                            </motion.div>
                          </motion.div>
                        )}
                        {gamePhase === "reveal" && revealPuzzle && (
                          <motion.div
                            key={`reveal-${currentIndex}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.15 }}
                          >
                            <RevealBlocks puzzle={revealPuzzle} tileW={TILE_W} tileH={TILE_H} onComplete={onRevealComplete} />
                          </motion.div>
                        )}
                      </div>

                      {/* Flash progress indicator */}
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
                        <p className="font-sans font-bold text-sm text-[var(--pixel-accent)] md:text-base">NEW RECORD!</p>
                        <p className="font-mono text-xs text-[var(--pixel-accent)]/80">
                          {result.speed.toFixed(1)} puzzles/min — your fastest yet!
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
                      <div className="flex justify-between rounded-lg bg-[var(--pixel-bg)] px-4 py-3">
                        <span className="text-[var(--pixel-muted)]">Time</span>
                        <span className="text-[var(--pixel-text)]">{formatTime(result.totalTime)}</span>
                      </div>
                      <div className="flex justify-between rounded-lg bg-[var(--pixel-bg)] px-4 py-3">
                        <span className="text-[var(--pixel-muted)]">Speed</span>
                        <span className="text-[var(--pixel-accent)]">{result.speed.toFixed(1)} /min</span>
                      </div>
                      <div className="flex justify-between rounded-lg bg-[var(--pixel-bg)] px-4 py-3">
                        <span className="text-[var(--pixel-muted)]">Puzzles</span>
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
                          <span className="text-[var(--pixel-muted)]">Still playing... ({opponentProgress}/{puzzles.length})</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex flex-col gap-2">
                      {gameMode === "solo" && (
                        <button onClick={startSolo} className="w-full rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-accent)] px-4 py-3 font-sans font-semibold text-sm text-[var(--pixel-bg)] transition-transform hover:scale-[1.02]">
                          PLAY AGAIN
                        </button>
                      )}
                      {gameMode === "p2p" && (
                        <button onClick={handleRematch} className="w-full rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-accent)] px-4 py-3 font-sans font-semibold text-sm text-[var(--pixel-bg)] transition-transform hover:scale-[1.02]">
                          REMATCH
                        </button>
                      )}
                      <button onClick={exitToMenu} className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[10px] text-[var(--pixel-muted)] transition-colors hover:text-[var(--pixel-accent)]">
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
