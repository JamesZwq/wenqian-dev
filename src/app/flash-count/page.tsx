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

// P2P: new question-by-question flow
// "answer" packet: I submitted my answer for current question
// "question_result" packet: host broadcasts both answers + correct answer (after both submit)
type FlashPacket =
  | { type: "config"; difficulty: Difficulty; totalQuestions: number; puzzles: BlockPuzzle[]; timestamp: number }
  | { type: "answer"; questionIndex: number; value: number; timestamp: number }
  | { type: "question_result"; questionIndex: number; p1Answer: number; p2Answer: number; correct: number; timestamp: number }
  | { type: "rematch"; timestamp: number }
  | { type: "settings_preview"; difficulty: Difficulty; totalQuestions: number; timestamp: number };

type QuestionResult = {
  myAnswer: number;
  opponentAnswer: number;
  correct: number;
  myCorrect: boolean;
  opponentCorrect: boolean;
};

type GameResult = {
  myScore: number;
  opponentScore: number;
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

// ─── Reveal animation (layer-by-layer verification) ───

/** 按层分组：layer 0 (底层) 先显示，同层内按 row+col 排序 */
function getLayeredTraversal(puzzle: BlockPuzzle): { r: number; c: number; l: number }[][] {
  const { grid, rows, cols } = puzzle;
  const maxH = Math.max(...grid.flat());
  const layers: { r: number; c: number; l: number }[][] = [];
  for (let l = 0; l < maxH; l++) {
    const layer: { r: number; c: number; l: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] > l) {
          layer.push({ r, c, l });
        }
      }
    }
    if (layer.length > 0) layers.push(layer);
  }
  return layers;
}

const BLOCK_INTERVAL = 60;   // ms per block within a layer
const LAYER_PAUSE = 300;      // ms pause between layers

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
  const layers = useMemo(() => getLayeredTraversal(puzzle), [puzzle]);
  const totalBlocks = useMemo(() => layers.reduce((s, l) => s + l.length, 0), [layers]);

  // State: which layer, how many blocks within that layer
  const [currentLayer, setCurrentLayer] = useState(0);
  const [blocksInLayer, setBlocksInLayer] = useState(0);
  const [layerPausing, setLayerPausing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef(false);

  // Count all visible blocks across completed layers + current partial
  const visibleTotal = useMemo(() => {
    let count = 0;
    for (let i = 0; i < currentLayer && i < layers.length; i++) {
      count += layers[i].length;
    }
    if (currentLayer < layers.length) {
      count += Math.min(blocksInLayer, layers[currentLayer].length);
    }
    return count;
  }, [currentLayer, blocksInLayer, layers]);

  useEffect(() => {
    setCurrentLayer(0);
    setBlocksInLayer(0);
    setLayerPausing(false);
    doneRef.current = false;

    const advanceLayer = (layerIdx: number) => {
      if (layerIdx >= layers.length) {
        // All done
        doneRef.current = true;
        return;
      }
      setCurrentLayer(layerIdx);
      setBlocksInLayer(0);
      setLayerPausing(false);

      const layerSize = layers[layerIdx].length;
      let count = 0;

      intervalRef.current = setInterval(() => {
        count++;
        setBlocksInLayer(count);
        if (count >= layerSize) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          // Pause between layers
          setLayerPausing(true);
          timeoutRef.current = setTimeout(() => {
            advanceLayer(layerIdx + 1);
          }, LAYER_PAUSE);
        }
      }, BLOCK_INTERVAL);
    };

    advanceLayer(0);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [layers]);

  // Complete callback
  useEffect(() => {
    if (doneRef.current && visibleTotal >= totalBlocks && totalBlocks > 0) {
      const t = setTimeout(onComplete, 1800);
      return () => clearTimeout(t);
    }
  }, [visibleTotal, totalBlocks, onComplete]);

  // ─── SVG rendering ───
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

  // Build visible set: all completed layers + partial current layer
  const visibleSet = new Set<string>();
  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li];
    const limit = li < currentLayer ? layer.length : li === currentLayer ? blocksInLayer : 0;
    for (let bi = 0; bi < limit; bi++) {
      const b = layer[bi];
      visibleSet.add(`${b.r}-${b.c}-${b.l}`);
    }
  }

  // Layer colors: each layer gets a distinct tint so you can see the stacking
  const layerColors = [
    { left: "#4a9", right: "#37a", top: "#6dc" },   // layer 0
    { left: "#5ab", right: "#48b", top: "#7ed" },   // layer 1
    { left: "#6bc", right: "#59c", top: "#8fe" },   // layer 2
    { left: "#7cd", right: "#6ad", top: "#9ff" },   // layer 3
    { left: "#8de", right: "#7be", top: "#aff" },   // layer 4
  ];

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
        const clr = layerColors[Math.min(l, layerColors.length - 1)];
        cubes.push(
          <g key={key}>
            <polygon points={cubeLeftFace(cx, cy, tileW, tileH)} fill={clr.left} stroke="#111" strokeWidth={0.8} strokeLinejoin="round" />
            <polygon points={cubeRightFace(cx, cy, tileW, tileH)} fill={clr.right} stroke="#111" strokeWidth={0.8} strokeLinejoin="round" />
            <polygon points={cubeTopFace(cx, cy, tileW, tileH)} fill={clr.top} stroke="#111" strokeWidth={0.8} strokeLinejoin="round" />
          </g>,
        );
      }
    }
  }

  // Layer info for display
  const currentLayerLabel = currentLayer < layers.length
    ? `Layer ${currentLayer + 1}/${layers.length}`
    : `All ${layers.length} layers`;

  const currentLayerCount = currentLayer < layers.length ? layers[currentLayer].length : 0;
  const currentLayerVisible = currentLayer < layers.length ? Math.min(blocksInLayer, currentLayerCount) : 0;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="mx-auto block max-h-[200px] md:max-h-[280px] w-auto"
      >
        {cubes}
      </svg>
      {/* 计数器 */}
      <div className="flex flex-col items-center gap-1">
        <span className="font-mono text-2xl md:text-3xl font-bold text-[var(--pixel-accent)]">
          {visibleTotal} <span className="text-[var(--pixel-muted)] text-lg md:text-xl">/ {totalBlocks}</span>
        </span>
        <span className="font-mono text-[10px] md:text-xs text-[var(--pixel-muted)]">
          {currentLayer < layers.length ? (
            <>
              {currentLayerLabel}: {currentLayerVisible}/{currentLayerCount}
              {layerPausing && " ✓"}
            </>
          ) : (
            <span className="text-[var(--pixel-accent)]">✓ Verified</span>
          )}
        </span>
      </div>
    </div>
  );
}

// ─── P2P Answer Box ───

function AnswerBox({
  label,
  submitted,
  answer,
  result,
  isMe,
}: {
  label: string;
  submitted: boolean;
  answer: number | null;
  result: QuestionResult | null;
  isMe: boolean;
}) {
  const showAnswer = result !== null;
  const myAnswer = isMe ? result?.myAnswer : result?.opponentAnswer;
  const correct = isMe ? result?.myCorrect : result?.opponentCorrect;

  return (
    <div className="flex flex-col items-center gap-1.5 flex-1">
      <span className="font-mono text-[10px] text-[var(--pixel-muted)] uppercase tracking-wider">{label}</span>
      <motion.div
        animate={showAnswer ? { scale: [1, 1.08, 1] } : {}}
        transition={{ duration: 0.3 }}
        className={`w-full rounded-xl border-2 px-4 py-3 text-center font-mono text-2xl font-bold transition-all duration-300 ${
          showAnswer
            ? correct
              ? "border-[#22c55e] bg-[#22c55e]/15 text-[#22c55e]"
              : "border-[#ef4444] bg-[#ef4444]/15 text-[#ef4444]"
            : submitted
            ? "border-[var(--pixel-accent-2)] bg-[var(--pixel-accent-2)]/10 text-[var(--pixel-muted)]"
            : "border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] text-[var(--pixel-muted)]"
        }`}
      >
        {showAnswer
          ? myAnswer
          : submitted
          ? "★"
          : "—"}
      </motion.div>
      {showAnswer && (
        <span className={`font-mono text-xs font-bold ${correct ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
          {correct ? "✓ CORRECT" : `✗ WAS ${result.correct}`}
        </span>
      )}
    </div>
  );
}

// ─── Component ───

export default function FlashCountPage() {
  const [gameMode, setGameMode] = useState<GameMode>("menu");
  const joinPeerId = useJoinParam();

  useEffect(() => {
    if (joinPeerId) setGameMode("p2p");
  }, [joinPeerId]);

  // Settings
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [totalQuestions, setTotalQuestions] = useState(20);

  // Game state (solo)
  const [puzzles, setPuzzles] = useState<BlockPuzzle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [gamePhase, setGamePhase] = useState<GamePhase>("flash");
  const [inputValue, setInputValue] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [flashColor, setFlashColor] = useState<"green" | "red" | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [soloResult, setSoloResult] = useState<{ totalTime: number; speed: number; totalQuestions: number } | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [bestSpeed, setBestSpeed] = useState<number | null>(null);
  const [resultDiff, setResultDiff] = useState<Difficulty>("easy");
  const [resultCount, setResultCount] = useState(0);
  const [direction, setDirection] = useState<"outgoing" | "incoming" | null>(null);
  const [revealPuzzle, setRevealPuzzle] = useState<BlockPuzzle | null>(null);

  // P2P state
  const [waitingForConfig, setWaitingForConfig] = useState(false);
  const [p2pSettingsReady, setP2pSettingsReady] = useState(false);
  const [hostPreview, setHostPreview] = useState<{ difficulty: Difficulty; totalQuestions: number } | null>(null);

  // P2P question-by-question state
  const [myP2pAnswer, setMyP2pAnswer] = useState<number | null>(null);  // null = not submitted
  const [opponentSubmitted, setOpponentSubmitted] = useState(false);     // opponent submitted (but value hidden)
  const [questionResult, setQuestionResult] = useState<QuestionResult | null>(null); // revealed after both submit
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [p2pGameResult, setP2pGameResult] = useState<GameResult | null>(null);
  // ref to track my submitted answer for the current question (for host computation)
  const myP2pAnswerRef = useRef<number | null>(null);
  const opponentAnswerRef = useRef<number | null>(null);
  const puzzlesRef = useRef(puzzles);

  useEffect(() => { puzzlesRef.current = puzzles; }, [puzzles]);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // ─── Speed (solo) ───

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

  // ─── P2P: reset per-question state ───

  const resetP2pQuestion = useCallback(() => {
    setMyP2pAnswer(null);
    setOpponentSubmitted(false);
    setQuestionResult(null);
    myP2pAnswerRef.current = null;
    opponentAnswerRef.current = null;
  }, []);

  // ─── P2P: process question result locally (used by both host & guest) ───

  const processQuestionResult = useCallback((qIdx: number, myAns: number, oppAns: number, correct: number) => {
    const myCorrect = myAns === correct;
    const oppCorrect = oppAns === correct;
    setQuestionResult({ myAnswer: myAns, opponentAnswer: oppAns, correct, myCorrect, opponentCorrect: oppCorrect });
    setMyScore(prev => prev + (myCorrect ? 1 : 0));
    setOpponentScore(prev => prev + (oppCorrect ? 1 : 0));
    // Auto-advance after 4s
    setTimeout(() => {
      const pz = puzzlesRef.current;
      const nextIdx = qIdx + 1;
      setCurrentIndex(nextIdx);
      resetP2pQuestion();
      if (nextIdx >= pz.length) {
        stopTimer();
        setGamePhase("done");
        setMyScore(ms => {
          setOpponentScore(os => {
            setP2pGameResult({ myScore: ms, opponentScore: os, totalQuestions: pz.length });
            return os;
          });
          return ms;
        });
      } else {
        startFlash(pz[nextIdx]);
      }
    }, 4000);
  }, [resetP2pQuestion, stopTimer, startFlash]);

  // ─── P2P: after both submitted, host computes & broadcasts result ───

  const broadcastResult = useCallback((qIdx: number, myAns: number, oppAns: number, send: (p: FlashPacket) => void) => {
    const pz = puzzlesRef.current[qIdx];
    if (!pz) return;
    const correct = pz.answer;
    send({
      type: "question_result",
      questionIndex: qIdx,
      p1Answer: myAns,   // host = p1
      p2Answer: oppAns,  // guest = p2
      correct,
      timestamp: Date.now(),
    });
    // Host also processes the result locally
    processQuestionResult(qIdx, myAns, oppAns, correct);
  }, [processQuestionResult]);

  // ─── P2P incoming data ───

  const sendRef = useRef<((p: FlashPacket) => void) | null>(null);
  const directionRef = useRef<"outgoing" | "incoming" | null>(null);
  useEffect(() => { directionRef.current = direction; }, [direction]);

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
          setSoloResult(null);
          setIsNewRecord(false);
          setMyScore(0);
          setOpponentScore(0);
          setP2pGameResult(null);
          setWaitingForConfig(false);
          setP2pSettingsReady(false);
          setResultDiff(payload.difficulty);
          setResultCount(payload.totalQuestions);
          resetP2pQuestion();
          const now = Date.now();
          setStartTime(now);
          setElapsed(0);
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = setInterval(() => setElapsed(Date.now() - now), 200);
          setGamePhase("flash");
          if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
          flashTimerRef.current = setTimeout(() => {
            setGamePhase("answer");
            setTimeout(() => inputRef.current?.focus(), 50);
          }, payload.puzzles[0].flashDuration);
          break;
        }
        case "answer": {
          // Opponent submitted their answer
          const oppAns = payload.value;
          opponentAnswerRef.current = oppAns;
          setOpponentSubmitted(true);
          // If I'm host and I've already submitted, broadcast result
          if (directionRef.current === "outgoing" && myP2pAnswerRef.current !== null && sendRef.current) {
            broadcastResult(payload.questionIndex, myP2pAnswerRef.current, oppAns, sendRef.current);
          }
          break;
        }
        case "question_result": {
          // Guest receives result from host (host already processed locally)
          const myAns = payload.p2Answer;  // guest = p2
          const oppAns = payload.p1Answer; // host = p1
          processQuestionResult(payload.questionIndex, myAns, oppAns, payload.correct);
          break;
        }
        case "rematch": {
          setSoloResult(null); setIsNewRecord(false);
          setMyScore(0); setOpponentScore(0); setP2pGameResult(null);
          setCurrentIndex(0); setInputValue("");
          resetP2pQuestion();
          setWaitingForConfig(false);
          if (directionRef.current === "outgoing") setP2pSettingsReady(false);
          else { setWaitingForConfig(true); setHostPreview(null); }
          break;
        }
        case "settings_preview": {
          setHostPreview({ difficulty: payload.difficulty, totalQuestions: payload.totalQuestions });
          break;
        }
      }
    },
    [broadcastResult, resetP2pQuestion, startFlash, stopTimer, processQuestionResult],
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
    onDisconnected: () => { setDirection(null); setWaitingForConfig(false); setP2pSettingsReady(false); stopTimer(); setRevealPuzzle(null); resetP2pQuestion(); },
  });

  // Keep sendRef in sync
  useEffect(() => { sendRef.current = send; }, [send]);

  const connectionDescription = useMemo(() => [
    "> Share your ID with a friend",
    "> Or enter their ID to connect",
    "> Host picks difficulty, then race!",
  ], []);

  // Send settings preview to guest when host changes settings
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
    setSoloResult(null);
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
    setSoloResult(null);
    setIsNewRecord(false);
    setMyScore(0);
    setOpponentScore(0);
    setP2pGameResult(null);
    setP2pSettingsReady(true);
    setResultDiff(difficulty);
    setResultCount(totalQuestions);
    resetP2pQuestion();
    send({ type: "config", difficulty, totalQuestions, puzzles: pz, timestamp: Date.now() });
    startTimer();
    startFlash(pz[0]);
  }, [difficulty, totalQuestions, send, startTimer, startFlash, resetP2pQuestion]);

  // ─── Solo answer logic ───

  const finishSoloGame = useCallback((totalTime: number, total: number, diff: Difficulty, count: number) => {
    const spd = total / (totalTime / 60000);
    const nr = saveBestSpeed(diff, count, spd);
    setSoloResult({ totalTime, speed: spd, totalQuestions: total });
    setIsNewRecord(nr);
    setBestSpeed(getBestSpeed(diff, count));
  }, []);

  const handleSoloInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInputValue(val);

      if (gamePhase !== "answer" || currentIndex >= puzzles.length) return;

      const currentP = puzzles[currentIndex];
      const answerStr = String(currentP.answer);

      if (val === answerStr) {
        setFlashColor("green");
        setTimeout(() => setFlashColor(null), 350);
        setRevealPuzzle(currentP);
        setGamePhase("reveal");
        setInputValue("");
      } else if (val.length >= answerStr.length && val !== answerStr) {
        setShakeKey(k => k + 1);
        setFlashColor("red");
        setTimeout(() => {
          setFlashColor(null);
          setInputValue("");
          inputRef.current?.focus();
        }, 350);
      }
    },
    [gamePhase, currentIndex, puzzles],
  );

  const onRevealComplete = useCallback(() => {
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    setRevealPuzzle(null);

    if (nextIndex >= puzzles.length) {
      stopTimer();
      const totalTime = Date.now() - startTime;
      setGamePhase("done");
      finishSoloGame(totalTime, puzzles.length, resultDiff, resultCount);
    } else {
      startFlash(puzzles[nextIndex]);
    }
  }, [currentIndex, puzzles, stopTimer, startTime, finishSoloGame, resultDiff, resultCount, startFlash]);

  // ─── P2P answer logic ───

  const handleP2pInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInputValue(val);

      if (gamePhase !== "answer" || myP2pAnswer !== null) return;
      if (currentIndex >= puzzlesRef.current.length) return;

      const currentP = puzzlesRef.current[currentIndex];
      const answerStr = String(currentP.answer);

      // Submit when input length matches answer length
      if (val.length >= answerStr.length) {
        const numVal = parseInt(val, 10);
        if (isNaN(numVal)) {
          setInputValue("");
          return;
        }
        // Lock in this answer
        setMyP2pAnswer(numVal);
        myP2pAnswerRef.current = numVal;
        setInputValue(String(numVal));
        // Send to peer
        send({ type: "answer", questionIndex: currentIndex, value: numVal, timestamp: Date.now() });
        // If host and opponent already submitted, broadcast result
        if (direction === "outgoing" && opponentAnswerRef.current !== null) {
          broadcastResult(currentIndex, numVal, opponentAnswerRef.current, send);
        }
      }
    },
    [gamePhase, myP2pAnswer, currentIndex, send, direction, broadcastResult],
  );

  // ─── Exit ───

  const exitToMenu = useCallback(() => {
    stopTimer();
    if (flashTimerRef.current) { clearTimeout(flashTimerRef.current); flashTimerRef.current = null; }
    setGameMode("menu"); setSoloResult(null); setIsNewRecord(false); setPuzzles([]);
    setCurrentIndex(0); setInputValue(""); setGamePhase("flash");
    setMyScore(0); setOpponentScore(0); setP2pGameResult(null);
    setWaitingForConfig(false); setP2pSettingsReady(false);
    resetP2pQuestion();
  }, [stopTimer, resetP2pQuestion]);

  const handleRematch = useCallback(() => {
    send({ type: "rematch", timestamp: Date.now() });
    setSoloResult(null); setIsNewRecord(false);
    setMyScore(0); setOpponentScore(0); setP2pGameResult(null);
    setCurrentIndex(0); setInputValue(""); setGamePhase("flash");
    resetP2pQuestion();
    if (direction === "outgoing") { setP2pSettingsReady(false); setWaitingForConfig(false); }
    else setWaitingForConfig(true);
  }, [send, direction, resetP2pQuestion]);

  // ─── Helpers ───

  const formatTime = (ms: number) => {
    const secs = Math.floor(ms / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const isPlaying = puzzles.length > 0 && currentIndex < puzzles.length && !soloResult && !p2pGameResult;
  const showP2pSettings = gameMode === "p2p" && isConnected && !p2pSettingsReady && direction === "outgoing" && !p2pGameResult;
  const showP2pWaiting = gameMode === "p2p" && isConnected && waitingForConfig && !p2pGameResult;
  const showGame = (gameMode === "solo" || (gameMode === "p2p" && isConnected && !showP2pSettings && !showP2pWaiting)) && puzzles.length > 0;
  const isP2pWaitingForOpponent = gameMode === "p2p" && myP2pAnswer !== null && !opponentSubmitted && !questionResult;
  const isP2pWaitingForMe = gameMode === "p2p" && opponentSubmitted && myP2pAnswer === null && !questionResult;

  // ─── Settings panel ───

  const settingsPanel = (
    <>
      <div className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-5 backdrop-blur-sm">
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

      <div className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-5 backdrop-blur-sm">
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
                  <div className="w-full rounded-xl border border-[var(--pixel-accent)]/30 bg-[var(--pixel-card-bg)] px-5 py-3 backdrop-blur-sm">
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
                  className="w-full rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-card-bg)] px-8 py-4 font-sans font-semibold text-sm tracking-tight text-[var(--pixel-accent)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-sm transition-all hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
                >
                  SOLO
                </button>
                <button
                  onClick={() => setGameMode("p2p")}
                  className="w-full rounded-xl border border-[var(--pixel-accent-2)] bg-[var(--pixel-card-bg)] px-8 py-4 font-sans font-semibold text-sm tracking-tight text-[var(--pixel-accent-2)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-sm transition-all hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
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
                <div className="w-full rounded-xl border border-[var(--pixel-accent-2)] bg-[var(--pixel-card-bg)] p-4 backdrop-blur-sm">
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
                <div className="w-full rounded-xl border border-[var(--pixel-accent-2)] bg-[var(--pixel-card-bg)] p-6 backdrop-blur-sm text-center">
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
                {!soloResult && !p2pGameResult ? (
                  <>
                    {/* Progress bar + stats */}
                    <div className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-4 backdrop-blur-sm">
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
                    <div className={`relative w-full rounded-xl border bg-[var(--pixel-card-bg)] backdrop-blur-sm overflow-hidden transition-all duration-200 ${
                      flashColor === "red"
                        ? "border-[#ef4444]/50 shadow-[0_0_12px_rgba(239,68,68,0.15)]"
                        : flashColor === "green"
                          ? "border-[#22c55e]/50 shadow-[0_0_12px_rgba(34,197,94,0.15)]"
                          : "border-[var(--pixel-border)] shadow-none"
                    }`}>
                      {/* Block display area */}
                      <div className="flex items-center justify-center p-6 md:p-10 min-h-[200px] md:min-h-[260px]">
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
                        {/* P2P answer phase */}
                        {isPlaying && gamePhase === "answer" && gameMode === "p2p" && (
                          <div className="w-full flex flex-col items-center gap-4">
                            {/* Puzzle question indicator */}
                            <span className="font-mono text-xl text-[var(--pixel-muted)]">? = </span>

                            {/* Input (hidden/locked after submit) */}
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
                                  {isP2pWaitingForOpponent ? (
                                    <span className="font-mono text-xs text-[var(--pixel-muted)]">Waiting for opponent...</span>
                                  ) : (
                                    <span className="font-mono text-xs text-[var(--pixel-accent-2)]">Both submitted!</span>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Answer boxes (shown after both submit) */}
                            <AnimatePresence>
                              {questionResult && (
                                <motion.div
                                  key="answer-boxes"
                                  initial={{ opacity: 0, y: 12 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="w-full flex gap-3 mt-2"
                                >
                                  <AnswerBox
                                    label="You"
                                    submitted={myP2pAnswer !== null}
                                    answer={myP2pAnswer}
                                    result={questionResult}
                                    isMe={true}
                                  />
                                  <AnswerBox
                                    label="Opponent"
                                    submitted={opponentSubmitted}
                                    answer={null}
                                    result={questionResult}
                                    isMe={false}
                                  />
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Waiting status when no result yet */}
                            {!questionResult && (
                              <div className="w-full flex gap-3">
                                <div className="flex-1 flex flex-col items-center gap-1">
                                  <span className="font-mono text-[10px] text-[var(--pixel-muted)] uppercase tracking-wider">You</span>
                                  <div className={`w-full rounded-xl border-2 px-4 py-3 text-center font-mono text-2xl font-bold ${
                                    myP2pAnswer !== null
                                      ? "border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/10 text-[var(--pixel-accent)]"
                                      : "border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] text-[var(--pixel-muted)]"
                                  }`}>
                                    {myP2pAnswer !== null ? "★" : "—"}
                                  </div>
                                </div>
                                <div className="flex-1 flex flex-col items-center gap-1">
                                  <span className="font-mono text-[10px] text-[var(--pixel-muted)] uppercase tracking-wider">Opponent</span>
                                  <div className={`w-full rounded-xl border-2 px-4 py-3 text-center font-mono text-2xl font-bold ${
                                    opponentSubmitted
                                      ? "border-[var(--pixel-accent-2)] bg-[var(--pixel-accent-2)]/10 text-[var(--pixel-muted)]"
                                      : "border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] text-[var(--pixel-muted)]"
                                  }`}>
                                    {opponentSubmitted ? "★" : "—"}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        {gamePhase === "reveal" && revealPuzzle && gameMode === "solo" && (
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
                ) : soloResult ? (
                  /* ─── Solo Result Card ─── */
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="w-full rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-card-bg)] p-6 md:p-8 backdrop-blur-sm"
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
                      <div className="flex justify-between rounded-lg bg-[var(--pixel-bg)] px-4 py-3">
                        <span className="text-[var(--pixel-muted)]">Time</span>
                        <span className="text-[var(--pixel-text)]">{formatTime(soloResult.totalTime)}</span>
                      </div>
                      <div className="flex justify-between rounded-lg bg-[var(--pixel-bg)] px-4 py-3">
                        <span className="text-[var(--pixel-muted)]">Speed</span>
                        <span className="text-[var(--pixel-accent)]">{soloResult.speed.toFixed(1)} /min</span>
                      </div>
                      <div className="flex justify-between rounded-lg bg-[var(--pixel-bg)] px-4 py-3">
                        <span className="text-[var(--pixel-muted)]">Puzzles</span>
                        <span className="text-[var(--pixel-text)]">{soloResult.totalQuestions}</span>
                      </div>
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
                  /* ─── P2P Result Card ─── */
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="w-full rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-card-bg)] p-6 md:p-8 backdrop-blur-sm"
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

                    {/* Score display */}
                    <div className="flex gap-4 mb-6">
                      <div className="flex-1 rounded-xl border-2 border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/10 p-4 text-center">
                        <p className="font-mono text-xs text-[var(--pixel-muted)] mb-1">YOU</p>
                        <p className="font-mono text-4xl font-bold text-[var(--pixel-accent)]">{p2pGameResult.myScore}</p>
                        <p className="font-mono text-xs text-[var(--pixel-muted)] mt-1">/ {p2pGameResult.totalQuestions}</p>
                      </div>
                      <div className="flex-1 rounded-xl border-2 border-[var(--pixel-accent-2)] bg-[var(--pixel-accent-2)]/10 p-4 text-center">
                        <p className="font-mono text-xs text-[var(--pixel-muted)] mb-1">OPPONENT</p>
                        <p className="font-mono text-4xl font-bold text-[var(--pixel-accent-2)]">{p2pGameResult.opponentScore}</p>
                        <p className="font-mono text-xs text-[var(--pixel-muted)] mt-1">/ {p2pGameResult.totalQuestions}</p>
                      </div>
                    </div>

                    <div className="space-y-3 font-mono text-sm mb-6">
                      <div className="flex justify-between rounded-lg bg-[var(--pixel-bg)] px-4 py-3">
                        <span className="text-[var(--pixel-muted)]">Questions</span>
                        <span className="text-[var(--pixel-text)]">{p2pGameResult.totalQuestions}</span>
                      </div>
                      <div className="flex justify-between rounded-lg bg-[var(--pixel-bg)] px-4 py-3">
                        <span className="text-[var(--pixel-muted)]">Time</span>
                        <span className="text-[var(--pixel-text)]">{formatTime(elapsed)}</span>
                      </div>
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
    </div>
  );
}
