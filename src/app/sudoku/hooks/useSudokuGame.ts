"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePeerConnection } from "../../../features/p2p/hooks/usePeerConnection";
import { useP2PChat } from "../../../features/p2p/hooks/useP2PChat";
import { useJoinParam } from "../../../features/p2p/hooks/useJoinParam";
import { P2P_CONNECT_TIMEOUT_MS } from "../../../features/p2p/config";
import { useRoomUrl } from "@/features/p2p/hooks/useRoomUrl";
import { generatePuzzle } from "../sudokuGenerator";
import type { CellPos, Difficulty, GameMode, GameStatus, SudokuPacket } from "../types";

function loadBestTime(difficulty: Difficulty): number | null {
  try {
    const val = localStorage.getItem(`sudoku_best_${difficulty}`);
    return val ? Number(val) : null;
  } catch {
    return null;
  }
}

function saveBestTime(difficulty: Difficulty, time: number): boolean {
  try {
    const current = loadBestTime(difficulty);
    if (current === null || time < current) {
      localStorage.setItem(`sudoku_best_${difficulty}`, String(time));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centis = Math.floor((ms % 1000) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
}

export function useSudokuGame() {
  const [gameMode, setGameMode] = useState<GameMode>("menu");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [myIndex, setMyIndex] = useState<0 | 1 | null>(null);

  const [puzzle, setPuzzle] = useState<number[][]>([]);
  const [solution, setSolution] = useState<number[][]>([]);
  const [board, setBoard] = useState<number[][]>([]);
  const [locked, setLocked] = useState<boolean[][]>([]);
  const [selectedCell, setSelectedCell] = useState<CellPos | null>(null);
  const [status, setStatus] = useState<GameStatus>("idle");

  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const [mistakes, setMistakes] = useState(0);
  const [failureReason, setFailureReason] = useState<"mistakes" | "revealed" | null>(null);
  const mistakesRef = useRef(0);

  const [bestTimes, setBestTimes] = useState<Record<Difficulty, number | null>>({
    easy: null, medium: null, hard: null,
  });
  const [isNewBest, setIsNewBest] = useState(false);

  const [opponentCorrect, setOpponentCorrect] = useState(0);
  const [opponentComplete, setOpponentComplete] = useState(false);
  const [opponentTime, setOpponentTime] = useState<number | null>(null);

  // Refs to avoid stale closures in callbacks
  const difficultyRef = useRef(difficulty);
  const myIndexRef = useRef(myIndex);
  const gameModeRef = useRef(gameMode);
  const startTimeRef = useRef<number | null>(null);
  const solutionRef = useRef<number[][]>([]);
  const lockedRef = useRef<boolean[][]>([]);
  const boardRef = useRef<number[][]>([]);
  const statusRef = useRef<GameStatus>("idle");
  const selectedCellRef = useRef<CellPos | null>(null);
  const sendRef = useRef<((packet: SudokuPacket) => boolean) | null>(null);

  useEffect(() => { difficultyRef.current = difficulty; }, [difficulty]);
  useEffect(() => { myIndexRef.current = myIndex; }, [myIndex]);
  useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);
  useEffect(() => { startTimeRef.current = startTime; }, [startTime]);
  useEffect(() => { solutionRef.current = solution; }, [solution]);
  useEffect(() => { lockedRef.current = locked; }, [locked]);
  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { selectedCellRef.current = selectedCell; }, [selectedCell]);
  useEffect(() => { mistakesRef.current = mistakes; }, [mistakes]);

  const joinPeerId = useJoinParam();
  useEffect(() => { if (joinPeerId) setGameMode("p2p"); }, [joinPeerId]);

  // Load best times on mount
  useEffect(() => {
    setBestTimes({
      easy: loadBestTime("easy"),
      medium: loadBestTime("medium"),
      hard: loadBestTime("hard"),
    });
  }, []);

  // Timer
  useEffect(() => {
    if (status === "playing" && startTime !== null) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Date.now() - (startTimeRef.current ?? Date.now()));
      }, 100);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [status, startTime]);

  const initGame = useCallback((puzz: number[][], sol: number[][], diff: Difficulty) => {
    const lk = puzz.map(row => row.map(cell => cell !== 0));
    const newBoard = puzz.map(row => [...row]);
    setPuzzle(puzz);
    setSolution(sol);
    setBoard(newBoard);
    setLocked(lk);
    setSelectedCell(null);
    setStatus("playing");
    const now = Date.now();
    setStartTime(now);
    setElapsedTime(0);
    setDifficulty(diff);
    setOpponentCorrect(0);
    setOpponentComplete(false);
    setOpponentTime(null);
    setIsNewBest(false);
    setMistakes(0);
    setFailureReason(null);
    // Update refs immediately so callbacks can use fresh values
    solutionRef.current = sol;
    lockedRef.current = lk;
    boardRef.current = newBoard;
    statusRef.current = "playing";
    startTimeRef.current = now;
    difficultyRef.current = diff;
    mistakesRef.current = 0;
  }, []);

  const handleIncomingData = useCallback((packet: SudokuPacket) => {
    if (!packet?.type) return;
    if (packet.type === "puzzle_sync") {
      setMyIndex(1);
      myIndexRef.current = 1;
      setGameMode("p2p");
      gameModeRef.current = "p2p";
      initGame(packet.puzzle, packet.solution, packet.difficulty);
    } else if (packet.type === "progress") {
      setOpponentCorrect(packet.correct);
    } else if (packet.type === "game_complete") {
      setOpponentComplete(true);
      setOpponentTime(packet.time);
    } else if (packet.type === "new_game") {
      if (myIndexRef.current === 0) {
        const diff = difficultyRef.current;
        const { puzzle: puzz, solution: sol } = generatePuzzle(diff);
        initGame(puzz, sol, diff);
        sendRef.current?.({ type: "puzzle_sync", puzzle: puzz, solution: sol, difficulty: diff, timestamp: Date.now() });
      }
    }
  }, [initGame]);

  const { messages: chatMessages, onChat, addMyMessage } = useP2PChat();

  const { phase, localPeerId, error, isConnected, isReconnecting, reconnectDeadline, connect, send, sendChat, clearError, retryLastConnection, reinitialize, roomCode, connectSubstep } =
    usePeerConnection<SudokuPacket>({
      connectTimeoutMs: P2P_CONNECT_TIMEOUT_MS,
      handshake: { site: "wenqian.me", game: "sudoku" },
      acceptIncomingConnections: true,
      onData: handleIncomingData,
      onChat,
      onConnected: ({ direction, reconnected }) => {
        if (reconnected) return;
        const idx = direction === "outgoing" ? 0 : 1;
        setMyIndex(idx);
        myIndexRef.current = idx;
        if (idx === 0) {
          const diff = difficultyRef.current;
          const { puzzle: puzz, solution: sol } = generatePuzzle(diff);
          initGame(puzz, sol, diff);
          setGameMode("p2p");
          gameModeRef.current = "p2p";
          // send is available here because onConnected fires async (after component renders)
          send({ type: "puzzle_sync", puzzle: puzz, solution: sol, difficulty: diff, timestamp: Date.now() });
        }
      },
      onDisconnected: () => {
        setMyIndex(null);
        myIndexRef.current = null;
      },
    });

  useEffect(() => { sendRef.current = send; }, [send]);

  const handleCellInput = useCallback((row: number, col: number, value: number) => {
    if (statusRef.current !== "playing") return;
    if (lockedRef.current[row]?.[col]) return;

    const sol = solutionRef.current;
    const currentVal = boardRef.current[row]?.[col] ?? 0;

    // Count mistake if entering a wrong non-zero value different from what's already there
    let gameFailed = false;
    if (value !== 0 && sol.length > 0 && value !== sol[row]?.[col] && value !== currentVal) {
      const newMistakes = mistakesRef.current + 1;
      setMistakes(newMistakes);
      mistakesRef.current = newMistakes;
      if (newMistakes >= 3) {
        gameFailed = true;
        setStatus("failed");
        statusRef.current = "failed";
        setFailureReason("mistakes");
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }

    setBoard(prev => {
      const newBoard = prev.map(r => [...r]);
      newBoard[row][col] = value;
      boardRef.current = newBoard;

      // Send progress to opponent (P2P only, skip if just failed)
      if (!gameFailed && gameModeRef.current !== "solo" && sol.length > 0) {
        let correct = 0;
        for (let rr = 0; rr < 9; rr++)
          for (let cc = 0; cc < 9; cc++)
            if (newBoard[rr][cc] !== 0 && newBoard[rr][cc] === sol[rr][cc]) correct++;
        sendRef.current?.({ type: "progress", correct, timestamp: Date.now() });
      }

      // Check completion (skip if game just failed)
      if (!gameFailed && sol.length > 0) {
        let complete = true;
        outer: for (let rr = 0; rr < 9; rr++) {
          for (let cc = 0; cc < 9; cc++) {
            if (newBoard[rr][cc] !== sol[rr][cc]) { complete = false; break outer; }
          }
        }

        if (complete) {
          const now = Date.now();
          const elapsed = now - (startTimeRef.current ?? now);
          setStatus("complete");
          statusRef.current = "complete";
          if (timerRef.current) clearInterval(timerRef.current);
          setElapsedTime(elapsed);

          if (gameModeRef.current === "solo") {
            const isNew = saveBestTime(difficultyRef.current, elapsed);
            setIsNewBest(isNew);
            setBestTimes(prev => ({
              ...prev,
              [difficultyRef.current]: Math.min(elapsed, prev[difficultyRef.current] ?? Infinity),
            }));
          } else {
            sendRef.current?.({ type: "game_complete", time: elapsed, timestamp: Date.now() });
          }
        }
      }

      return newBoard;
    });
  }, []);

  const handleCellSelect = useCallback((row: number, col: number) => {
    setSelectedCell({ row, col });
  }, []);

  const startSolo = useCallback((diff: Difficulty) => {
    const { puzzle: puzz, solution: sol } = generatePuzzle(diff);
    setGameMode("solo");
    setMyIndex(null);
    initGame(puzz, sol, diff);
  }, [initGame]);

  const requestNewGame = useCallback(() => {
    if (gameModeRef.current === "solo") {
      const diff = difficultyRef.current;
      const { puzzle: puzz, solution: sol } = generatePuzzle(diff);
      initGame(puzz, sol, diff);
    } else {
      // Only host (myIndex === 0) can start new game in P2P
      if (myIndexRef.current === 0) {
        const diff = difficultyRef.current;
        const { puzzle: puzz, solution: sol } = generatePuzzle(diff);
        initGame(puzz, sol, diff);
        sendRef.current?.({ type: "puzzle_sync", puzzle: puzz, solution: sol, difficulty: diff, timestamp: Date.now() });
      }
    }
  }, [initGame]);

  const revealSolution = useCallback(() => {
    if (statusRef.current !== "playing") return;
    if (timerRef.current) clearInterval(timerRef.current);
    const sol = solutionRef.current;
    setBoard(sol.map(row => [...row]));
    boardRef.current = sol.map(row => [...row]);
    setStatus("failed");
    statusRef.current = "failed";
    setFailureReason("revealed");
  }, []);

  const exitToMenu = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setGameMode("menu");
    setStatus("idle");
    statusRef.current = "idle";
    setBoard([]);
    setPuzzle([]);
    setSolution([]);
    setLocked([]);
    setSelectedCell(null);
    setStartTime(null);
    setElapsedTime(0);
    setMyIndex(null);
    myIndexRef.current = null;
    setMistakes(0);
    mistakesRef.current = 0;
    setFailureReason(null);
    boardRef.current = [];
  }, []);

  // Keyboard handler (uses refs to avoid stale closures)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (statusRef.current !== "playing") return;
      const cell = selectedCellRef.current;

      if (e.key >= "1" && e.key <= "9") {
        if (cell) handleCellInput(cell.row, cell.col, parseInt(e.key));
      } else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
        if (cell) handleCellInput(cell.row, cell.col, 0);
      } else if (e.key === "ArrowUp" && cell) {
        e.preventDefault();
        setSelectedCell({ row: Math.max(0, cell.row - 1), col: cell.col });
      } else if (e.key === "ArrowDown" && cell) {
        e.preventDefault();
        setSelectedCell({ row: Math.min(8, cell.row + 1), col: cell.col });
      } else if (e.key === "ArrowLeft" && cell) {
        e.preventDefault();
        setSelectedCell({ row: cell.row, col: Math.max(0, cell.col - 1) });
      } else if (e.key === "ArrowRight" && cell) {
        e.preventDefault();
        setSelectedCell({ row: cell.row, col: Math.min(8, cell.col + 1) });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCellInput]);

  // Compute conflicts
  const conflicts: boolean[][] = board.length > 0
    ? (() => {
        const c: boolean[][] = Array.from({ length: 9 }, () => Array(9).fill(false));
        for (let r = 0; r < 9; r++) {
          for (let col = 0; col < 9; col++) {
            const val = board[r][col];
            if (!val) continue;
            for (let cc = 0; cc < 9; cc++) {
              if (cc !== col && board[r][cc] === val) { c[r][col] = true; c[r][cc] = true; }
            }
            for (let rr = 0; rr < 9; rr++) {
              if (rr !== r && board[rr][col] === val) { c[r][col] = true; c[rr][col] = true; }
            }
            const br = Math.floor(r / 3) * 3;
            const bc = Math.floor(col / 3) * 3;
            for (let rr = br; rr < br + 3; rr++) {
              for (let cc = bc; cc < bc + 3; cc++) {
                if ((rr !== r || cc !== col) && board[rr][cc] === val) {
                  c[r][col] = true; c[rr][cc] = true;
                }
              }
            }
          }
        }
        return c;
      })()
    : [];

  const correctCount = board.length > 0 && solution.length > 0
    ? board.reduce((acc, row, r) => acc + row.filter((v, c) => v !== 0 && !locked[r]?.[c] && v === solution[r][c]).length, 0)
    : 0;

  const totalToFill = locked.length > 0
    ? locked.reduce((acc, row) => acc + row.filter(v => !v).length, 0)
    : 0;

  useRoomUrl(roomCode, phase);

  return {
    // State
    gameMode, setGameMode,
    difficulty, setDifficulty,
    myIndex,
    puzzle, solution, board, locked, conflicts, selectedCell,
    status, elapsedTime, bestTimes, isNewBest,
    mistakes, failureReason,
    // Multiplayer
    opponentCorrect, opponentComplete, opponentTime,
    // Derived
    correctCount, totalToFill,
    // P2P
    phase, localPeerId, error, isConnected, isReconnecting, reconnectDeadline, connect, sendChat, clearError, retryLastConnection, reinitialize, roomCode, connectSubstep,
    joinPeerId,
    // Chat
    chatMessages, addMyMessage,
    // Handlers
    handleCellSelect, handleCellInput, startSolo, requestNewGame, exitToMenu, revealSolution,
  };
}
