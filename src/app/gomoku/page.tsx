"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import P2PConnectionPanel from "../../features/p2p/components/P2PConnectionPanel";
import { usePeerConnection } from "../../features/p2p/hooks/usePeerConnection";
import { useJoinParam } from "../../features/p2p/hooks/useJoinParam";
import { P2P_CONNECT_TIMEOUT_MS } from "../../features/p2p/config";
import GomokuExplosion from "../components/GomokuExplosion";
import { getAIMove } from "./gomokuAI";

type Player = "black" | "white";
type CellState = Player | null;
type GameStatus = "waiting" | "playing" | "won" | "draw";
type GameMode = "menu" | "ai" | "p2p";
type AIDifficulty = "easy" | "medium" | "hard";

type GamePacket =
  | {
      type: "move";
      row: number;
      col: number;
      timestamp: number;
    }
  | {
      type: "reset";
      timestamp: number;
    };

type GameState = {
  board: CellState[][];
  currentPlayer: Player;
  status: GameStatus;
  winner: Player | null;
  winningLine: number[][];
};

type Stats = {
  blackWins: number;
  whiteWins: number;
  draws: number;
};

const BOARD_SIZE = 15;
const STAR_POINTS = [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]];
const BOARD_PADDING = 10;

function createEmptyBoard(): CellState[][] {
  return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
}

export default function GomokuPage() {
  const [gameMode, setGameMode] = useState<GameMode>("menu");
  const joinPeerId = useJoinParam();
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>("medium");

  // Auto-enter P2P mode when ?join= is present
  useEffect(() => {
    if (joinPeerId) setGameMode("p2p");
  }, [joinPeerId]);
  const [myColor, setMyColor] = useState<Player | null>(null);
  const [lastMove, setLastMove] = useState<{ row: number; col: number } | null>(null);
  const [previewPos, setPreviewPos] = useState<{ row: number; col: number } | null>(null);
  const [cellSize, setCellSize] = useState(30);
  const [stats, setStats] = useState<Stats>({
    blackWins: 0,
    whiteWins: 0,
    draws: 0,
  });

  const [gameState, setGameState] = useState<GameState>({
    board: createEmptyBoard(),
    currentPlayer: "black",
    status: "waiting",
    winner: null,
    winningLine: [],
  });

  const [showExplosion, setShowExplosion] = useState(false);
  const [explosionPieces, setExplosionPieces] = useState<Array<{ x: number; y: number; color: "black" | "white" }>>([]);

  const aiTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const gameStateRef = useRef(gameState);
  const gameModeRef = useRef(gameMode);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    gameModeRef.current = gameMode;
  }, [gameMode]);

  // Responsive cell size
  useEffect(() => {
    const update = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const isMobile = vw < 768;

      const hPad = isMobile ? 32 : 96;
      const vReserved = isMobile ? 260 : 300;

      const maxW = vw - hPad;
      const maxH = vh - vReserved;

      const totalBoardPad = BOARD_PADDING * 2;
      const maxCellFromW = (maxW - totalBoardPad) / BOARD_SIZE;
      const maxCellFromH = (maxH - totalBoardPad) / BOARD_SIZE;

      const next = Math.floor(Math.min(maxCellFromW, maxCellFromH));
      setCellSize(Math.max(18, Math.min(30, next)));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Cleanup AI timer
  useEffect(() => {
    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  }, []);

  const checkWin = useCallback((board: CellState[][], row: number, col: number, player: Player): number[][] => {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

    for (const [dx, dy] of directions) {
      const line: number[][] = [[row, col]];

      for (let i = 1; i < 5; i++) {
        const newRow = row + dx * i;
        const newCol = col + dy * i;
        if (newRow < 0 || newRow >= BOARD_SIZE || newCol < 0 || newCol >= BOARD_SIZE) break;
        if (board[newRow][newCol] !== player) break;
        line.push([newRow, newCol]);
      }

      for (let i = 1; i < 5; i++) {
        const newRow = row - dx * i;
        const newCol = col - dy * i;
        if (newRow < 0 || newRow >= BOARD_SIZE || newCol < 0 || newCol >= BOARD_SIZE) break;
        if (board[newRow][newCol] !== player) break;
        line.unshift([newRow, newCol]);
      }

      if (line.length >= 5) return line.slice(0, 5);
    }

    return [];
  }, []);

  // Apply a move and return new state
  const applyMove = useCallback((prevState: GameState, row: number, col: number, isLocal: boolean): GameState => {
    if (prevState.status !== "playing" || prevState.board[row][col] !== null) {
      return prevState;
    }

    const newBoard = prevState.board.map(r => [...r]);
    const currentPlayer = prevState.currentPlayer;
    newBoard[row][col] = currentPlayer;

    const winningLine = checkWin(newBoard, row, col, currentPlayer);

    if (winningLine.length > 0) {
      if (isLocal) {
        setStats(prev => ({
          ...prev,
          blackWins: prev.blackWins + (currentPlayer === "black" ? 1 : 0),
          whiteWins: prev.whiteWins + (currentPlayer === "white" ? 1 : 0),
        }));
      }
      return {
        board: newBoard,
        currentPlayer,
        status: "won",
        winner: currentPlayer,
        winningLine,
      };
    }

    const isFull = newBoard.every(row => row.every(cell => cell !== null));
    if (isFull) {
      if (isLocal) {
        setStats(prev => ({ ...prev, draws: prev.draws + 1 }));
      }
      return {
        board: newBoard,
        currentPlayer,
        status: "draw",
        winner: null,
        winningLine: [],
      };
    }

    return {
      board: newBoard,
      currentPlayer: currentPlayer === "black" ? "white" : "black",
      status: "playing",
      winner: null,
      winningLine: [],
    };
  }, [checkWin]);

  // AI move logic
  const triggerAIMove = useCallback(() => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);

    const delay = 300 + Math.random() * 300;
    aiTimerRef.current = setTimeout(() => {
      const gs = gameStateRef.current;
      if (gameModeRef.current !== "ai" || gs.status !== "playing" || gs.currentPlayer !== "white") return;

      const move = getAIMove(
        gs.board.map(r => [...r]),
        "white",
        aiDifficulty
      );

      setLastMove({ row: move.row, col: move.col });
      setGameState(prev => applyMove(prev, move.row, move.col, true));
    }, delay);
  }, [aiDifficulty, applyMove]);

  // Watch for AI turn
  useEffect(() => {
    if (gameMode === "ai" && gameState.status === "playing" && gameState.currentPlayer === "white") {
      triggerAIMove();
    }
  }, [gameMode, gameState.status, gameState.currentPlayer, triggerAIMove]);

  const handleIncomingData = useCallback(
    (payload: GamePacket) => {
      if (!payload?.type) return;

      if (payload.type === "move") {
        setGameState(prevState => {
          if (prevState.status !== "playing" || prevState.board[payload.row][payload.col] !== null) {
            return prevState;
          }

          const newBoard = prevState.board.map(r => [...r]);
          const currentPlayer = prevState.currentPlayer;
          newBoard[payload.row][payload.col] = currentPlayer;

          const winningLine = checkWin(newBoard, payload.row, payload.col, currentPlayer);
          setLastMove({ row: payload.row, col: payload.col });

          if (winningLine.length > 0) {
            return {
              board: newBoard,
              currentPlayer,
              status: "won",
              winner: currentPlayer,
              winningLine,
            };
          }

          const isFull = newBoard.every(row => row.every(cell => cell !== null));
          if (isFull) {
            return {
              board: newBoard,
              currentPlayer,
              status: "draw",
              winner: null,
              winningLine: [],
            };
          }

          return {
            board: newBoard,
            currentPlayer: currentPlayer === "black" ? "white" : "black",
            status: "playing",
            winner: null,
            winningLine: [],
          };
        });
      } else if (payload.type === "reset") {
        setMyColor(prev => prev === "black" ? "white" : "black");
        setGameState({
          board: createEmptyBoard(),
          currentPlayer: "black",
          status: "playing",
          winner: null,
          winningLine: [],
        });
        setLastMove(null);
        setPreviewPos(null);
      }
    },
    [checkWin],
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
  } = usePeerConnection<GamePacket>({
    connectTimeoutMs: P2P_CONNECT_TIMEOUT_MS,
    onData: handleIncomingData,
    acceptIncomingConnections: true,
    onConnected: ({ direction }) => {
      setMyColor(direction === "outgoing" ? "black" : "white");
      setGameState(prev => ({ ...prev, status: "playing" }));
    },
    onDisconnected: () => {
      setMyColor(null);
      setGameState(prev => ({ ...prev, status: "waiting" }));
    },
  });

  const connectionDescription = useMemo(
    () => [
      "> Share your ID with a friend",
      "> Or enter their ID to connect",
      "> P1 (Black) = 先手, P2 (White) = 后手",
    ],
    [],
  );

  const makeMove = useCallback(
    (row: number, col: number) => {
      if (gameMode === "ai") {
        // AI mode: player is always black
        if (
          gameState.status !== "playing" ||
          gameState.board[row][col] !== null ||
          gameState.currentPlayer !== "black"
        ) {
          return;
        }

        setLastMove({ row, col });
        setPreviewPos(null);
        setGameState(prevState => applyMove(prevState, row, col, true));
        return;
      }

      // P2P mode
      if (
        gameState.status !== "playing" ||
        gameState.board[row][col] !== null ||
        myColor !== gameState.currentPlayer
      ) {
        return;
      }

      setGameState(prevState => {
        const newBoard = prevState.board.map(r => [...r]);
        const currentPlayer = prevState.currentPlayer;
        newBoard[row][col] = currentPlayer;

        const winningLine = checkWin(newBoard, row, col, currentPlayer);
        setLastMove({ row, col });
        setPreviewPos(null);

        send({
          type: "move",
          row,
          col,
          timestamp: Date.now(),
        });

        if (winningLine.length > 0) {
          setStats(prev => ({
            ...prev,
            blackWins: prev.blackWins + (currentPlayer === "black" ? 1 : 0),
            whiteWins: prev.whiteWins + (currentPlayer === "white" ? 1 : 0),
          }));

          return {
            board: newBoard,
            currentPlayer,
            status: "won",
            winner: currentPlayer,
            winningLine,
          };
        }

        const isFull = newBoard.every(row => row.every(cell => cell !== null));
        if (isFull) {
          setStats(prev => ({ ...prev, draws: prev.draws + 1 }));
          return {
            board: newBoard,
            currentPlayer,
            status: "draw",
            winner: null,
            winningLine: [],
          };
        }

        return {
          board: newBoard,
          currentPlayer: currentPlayer === "black" ? "white" : "black",
          status: "playing",
          winner: null,
          winningLine: [],
        };
      });
    },
    [applyMove, checkWin, gameMode, gameState.status, gameState.board, gameState.currentPlayer, myColor, send],
  );

  // Mobile: tap to preview, tap again to confirm
  const handleBoardClick = useCallback(
    (row: number, col: number) => {
      if (gameState.board[row][col] !== null) return;

      const isMobile = window.innerWidth < 768;

      if (isMobile) {
        // If same position, confirm
        if (previewPos?.row === row && previewPos?.col === col) {
          makeMove(row, col);
          return;
        }
        // Otherwise set preview
        setPreviewPos({ row, col });
        return;
      }

      // Desktop: direct place
      makeMove(row, col);
    },
    [gameState.board, makeMove, previewPos],
  );

  const resetGame = useCallback(() => {
    if (gameState.board.some(row => row.some(cell => cell !== null))) {
      const pieces: Array<{ x: number; y: number; color: "black" | "white" }> = [];

      gameState.board.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
          if (cell) {
            pieces.push({
              x: BOARD_PADDING + cellSize / 2 + colIndex * cellSize,
              y: BOARD_PADDING + cellSize / 2 + rowIndex * cellSize,
              color: cell,
            });
          }
        });
      });

      setExplosionPieces(pieces);
      setShowExplosion(true);

      setTimeout(() => {
        if (gameMode === "ai") {
          setGameState({
            board: createEmptyBoard(),
            currentPlayer: "black",
            status: "playing",
            winner: null,
            winningLine: [],
          });
          setLastMove(null);
          setPreviewPos(null);
        } else {
          const newMyColor: Player = myColor === "black" ? "white" : "black";
          setMyColor(newMyColor);

          setGameState({
            board: createEmptyBoard(),
            currentPlayer: "black",
            status: "playing",
            winner: null,
            winningLine: [],
          });
          setLastMove(null);
          setPreviewPos(null);

          send({
            type: "reset",
            timestamp: Date.now(),
          });
        }
      }, 300);
    } else {
      if (gameMode === "ai") {
        setGameState({
          board: createEmptyBoard(),
          currentPlayer: "black",
          status: "playing",
          winner: null,
          winningLine: [],
        });
        setLastMove(null);
        setPreviewPos(null);
      } else {
        const newMyColor: Player = myColor === "black" ? "white" : "black";
        setMyColor(newMyColor);

        setGameState({
          board: createEmptyBoard(),
          currentPlayer: "black",
          status: "playing",
          winner: null,
          winningLine: [],
        });
        setLastMove(null);
        setPreviewPos(null);

        send({
          type: "reset",
          timestamp: Date.now(),
        });
      }
    }
  }, [cellSize, gameMode, gameState.board, myColor, send]);

  const startAIGame = useCallback((diff: AIDifficulty) => {
    setAiDifficulty(diff);
    setGameMode("ai");
    setMyColor("black");
    setGameState({
      board: createEmptyBoard(),
      currentPlayer: "black",
      status: "playing",
      winner: null,
      winningLine: [],
    });
    setLastMove(null);
    setPreviewPos(null);
    setStats({ blackWins: 0, whiteWins: 0, draws: 0 });
  }, []);

  const exitToMenu = useCallback(() => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    setGameMode("menu");
    setGameState({
      board: createEmptyBoard(),
      currentPlayer: "black",
      status: "waiting",
      winner: null,
      winningLine: [],
    });
    setMyColor(null);
    setLastMove(null);
    setPreviewPos(null);
  }, []);

  const myPlayerId = myColor === "black" ? "P1" : myColor === "white" ? "P2" : null;
  const isMyTurn = gameMode === "ai"
    ? gameState.currentPlayer === "black"
    : gameState.currentPlayer === myColor;
  const opponentLabel = gameMode === "ai" ? "AI" : "Opponent";

  const boardPixels = BOARD_SIZE * cellSize + BOARD_PADDING * 2;
  const stoneRadius = cellSize / 2 - 2;

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
          className="inline-flex rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[8px] tracking-tight text-[var(--pixel-accent)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-md transition-colors hover:bg-[var(--pixel-bg-alt)] md:text-[10px]"
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
            GOMOKU
          </h1>
          <p className="font-mono text-xs text-[var(--pixel-muted)] md:text-sm">
            &gt; Five in a Row {gameMode === "ai" ? `| AI (${aiDifficulty})` : gameMode === "p2p" ? "| P2P" : ""}
          </p>
        </motion.div>

        <div className="w-full max-w-6xl">
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
                <div className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-5 backdrop-blur-xl">
                  <h3 className="mb-4 font-sans font-semibold text-xs text-[var(--pixel-accent)]">
                    VS AI
                  </h3>
                  <div className="flex flex-col gap-2">
                    {(["easy", "medium", "hard"] as const).map(diff => (
                      <button
                        key={diff}
                        onClick={() => startAIGame(diff)}
                        className="w-full rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-card-bg)] px-4 py-3 font-sans font-semibold text-sm tracking-tight text-[var(--pixel-accent)] transition-all hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
                      >
                        {diff.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

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
                  title="GOMOKU_P2P"
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

            {/* ─── Game Board ─── */}
            {((gameMode === "ai") || (gameMode === "p2p" && isConnected)) && (
              <motion.div
                key="game"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                className="flex flex-col items-center gap-3 md:gap-4"
              >
                {/* ─── Mobile compact status bar ─── */}
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
                  {/* ─── Desktop sidebar ─── */}
                  <div className="hidden lg:block lg:w-72 space-y-4">
                    {/* Players */}
                    <div className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-4 backdrop-blur-xl">
                      <h3 className="mb-3 font-sans font-semibold text-[10px] text-[var(--pixel-accent)]">
                        PLAYERS
                      </h3>
                      <div className="space-y-2">
                        <div className={`flex items-center gap-2 p-2 border ${
                          (gameMode === "ai" || myColor === "black")
                            ? "border-[var(--pixel-accent)]"
                            : "border-[var(--pixel-border)]"
                        }`}>
                          <div className="w-5 h-5 bg-black border border-[var(--pixel-border)]" />
                          <span className="font-mono text-sm">
                            {gameMode === "ai" ? "You (Black)" : myColor === "black" ? `${myPlayerId} (You)` : "P1"}
                          </span>
                          {gameState.currentPlayer === "black" && (
                            <span className="ml-auto text-[var(--pixel-accent)]">●</span>
                          )}
                        </div>
                        <div className={`flex items-center gap-2 p-2 border ${
                          (gameMode === "ai" ? false : myColor === "white")
                            ? "border-[var(--pixel-accent)]"
                            : "border-[var(--pixel-border)]"
                        }`}>
                          <div className="w-5 h-5 bg-white border border-[var(--pixel-border)]" />
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
                    <div className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-4 backdrop-blur-xl">
                      <h3 className="mb-3 font-sans font-semibold text-[10px] text-[var(--pixel-accent)]">
                        STATUS
                      </h3>
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
                            &gt; {gameState.winner === (gameMode === "ai" ? "black" : myColor) ? "You won!" : `${opponentLabel} won!`}
                          </p>
                        )}
                        {gameState.status === "draw" && (
                          <p className="text-[var(--pixel-muted)]">&gt; Draw!</p>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-4 backdrop-blur-xl">
                      <h3 className="mb-3 font-sans font-semibold text-[10px] text-[var(--pixel-accent)]">
                        STATS
                      </h3>
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

                  {/* ─── Board ─── */}
                  <div className="flex-1 flex items-center justify-center">
                    <div className="relative inline-block rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-2 md:p-4 backdrop-blur-xl">
                      {showExplosion && (
                        <GomokuExplosion
                          pieces={explosionPieces}
                          centerX={boardPixels / 2}
                          centerY={boardPixels / 2}
                          onComplete={() => setShowExplosion(false)}
                        />
                      )}

                      <svg
                        width={boardPixels}
                        height={boardPixels}
                        className="cursor-pointer block"
                        style={{ touchAction: "manipulation" }}
                      >
                        {/* Background */}
                        <rect
                          x={BOARD_PADDING}
                          y={BOARD_PADDING}
                          width={BOARD_SIZE * cellSize}
                          height={BOARD_SIZE * cellSize}
                          fill="var(--pixel-bg)"
                          stroke="var(--pixel-border)"
                          strokeWidth="2"
                        />

                        {/* Grid lines */}
                        {Array.from({ length: BOARD_SIZE }).map((_, i) => (
                          <g key={i}>
                            <line
                              x1={BOARD_PADDING + cellSize / 2}
                              y1={BOARD_PADDING + cellSize / 2 + i * cellSize}
                              x2={BOARD_PADDING + cellSize / 2 + (BOARD_SIZE - 1) * cellSize}
                              y2={BOARD_PADDING + cellSize / 2 + i * cellSize}
                              stroke="var(--pixel-border)"
                              strokeWidth="1"
                            />
                            <line
                              x1={BOARD_PADDING + cellSize / 2 + i * cellSize}
                              y1={BOARD_PADDING + cellSize / 2}
                              x2={BOARD_PADDING + cellSize / 2 + i * cellSize}
                              y2={BOARD_PADDING + cellSize / 2 + (BOARD_SIZE - 1) * cellSize}
                              stroke="var(--pixel-border)"
                              strokeWidth="1"
                            />
                          </g>
                        ))}

                        {/* Star points */}
                        {STAR_POINTS.map(([row, col], i) => (
                          <circle
                            key={i}
                            cx={BOARD_PADDING + cellSize / 2 + col * cellSize}
                            cy={BOARD_PADDING + cellSize / 2 + row * cellSize}
                            r={Math.max(2, cellSize * 0.08)}
                            fill="var(--pixel-border)"
                          />
                        ))}

                        {/* Stones */}
                        {gameState.board.map((row, rowIndex) =>
                          row.map((cell, colIndex) => {
                            if (!cell) return null;
                            const isWinningPiece = gameState.winningLine.some(
                              ([r, c]) => r === rowIndex && c === colIndex
                            );
                            const isLastMoveHere = lastMove?.row === rowIndex && lastMove?.col === colIndex;
                            return (
                              <g key={`${rowIndex}-${colIndex}`}>
                                <circle
                                  cx={BOARD_PADDING + cellSize / 2 + colIndex * cellSize}
                                  cy={BOARD_PADDING + cellSize / 2 + rowIndex * cellSize}
                                  r={stoneRadius}
                                  fill={cell === "black" ? "black" : "white"}
                                  stroke={isWinningPiece ? "var(--pixel-accent)" : "var(--pixel-border)"}
                                  strokeWidth={isWinningPiece ? "3" : "1"}
                                />
                                {isLastMoveHere && (
                                  <circle
                                    cx={BOARD_PADDING + cellSize / 2 + colIndex * cellSize}
                                    cy={BOARD_PADDING + cellSize / 2 + rowIndex * cellSize}
                                    r={Math.max(2.5, cellSize * 0.12)}
                                    fill={cell === "black" ? "white" : "black"}
                                  />
                                )}
                              </g>
                            );
                          })
                        )}

                        {/* Preview stone (mobile) */}
                        {previewPos && gameState.board[previewPos.row][previewPos.col] === null && (
                          <circle
                            cx={BOARD_PADDING + cellSize / 2 + previewPos.col * cellSize}
                            cy={BOARD_PADDING + cellSize / 2 + previewPos.row * cellSize}
                            r={stoneRadius}
                            fill={gameState.currentPlayer === "black" ? "black" : "white"}
                            opacity={0.35}
                            stroke="var(--pixel-accent)"
                            strokeWidth="2"
                            strokeDasharray="4 2"
                          />
                        )}

                        {/* Click targets */}
                        {gameState.status === "playing" &&
                          (gameMode === "ai" ? gameState.currentPlayer === "black" : gameState.currentPlayer === myColor) && (
                          <g>
                            {gameState.board.map((row, rowIndex) =>
                              row.map((cell, colIndex) => {
                                if (cell) return null;
                                return (
                                  <rect
                                    key={`click-${rowIndex}-${colIndex}`}
                                    x={BOARD_PADDING + colIndex * cellSize}
                                    y={BOARD_PADDING + rowIndex * cellSize}
                                    width={cellSize}
                                    height={cellSize}
                                    fill="transparent"
                                    className="cursor-pointer hover:fill-[var(--pixel-accent)] hover:opacity-10"
                                    onClick={() => handleBoardClick(rowIndex, colIndex)}
                                  />
                                );
                              })
                            )}
                          </g>
                        )}
                      </svg>
                    </div>
                  </div>
                </div>

                {/* ─── Mobile confirm button ─── */}
                {previewPos && (
                  <div className="flex gap-2 md:hidden">
                    <button
                      onClick={() => {
                        makeMove(previewPos.row, previewPos.col);
                      }}
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

                {/* ─── Mobile bottom controls ─── */}
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
    </div>
  );
}
