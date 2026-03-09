"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import P2PConnectionPanel from "../../features/p2p/components/P2PConnectionPanel";
import { usePeerConnection } from "../../features/p2p/hooks/usePeerConnection";
import { P2P_CONNECT_TIMEOUT_MS } from "../../features/p2p/config";
import GomokuExplosion from "../components/GomokuExplosion";

type Player = "black" | "white";
type CellState = Player | null;
type GameStatus = "waiting" | "playing" | "won" | "draw";

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
const CELL_SIZE = 30;
const STAR_POINTS = [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]];

export default function GomokuPage() {
  const [myColor, setMyColor] = useState<Player | null>(null);
  const [lastMove, setLastMove] = useState<{ row: number; col: number } | null>(null);
  const [stats, setStats] = useState<Stats>({
    blackWins: 0,
    whiteWins: 0,
    draws: 0,
  });
  
  const [gameState, setGameState] = useState<GameState>({
    board: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
    currentPlayer: "black",
    status: "waiting",
    winner: null,
    winningLine: [],
  });

  // 新增：爆炸动画状态
  const [showExplosion, setShowExplosion] = useState(false);
  const [explosionPieces, setExplosionPieces] = useState<Array<{ x: number; y: number; color: "black" | "white" }>>([]);

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
            // 不要在这里增加分数，因为对方已经在他们的 makeMove 中增加了
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
        // 对方发起重置，我们也要交换颜色
        setMyColor(prev => prev === "black" ? "white" : "black");
        setGameState({
          board: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
          currentPlayer: "black",
          status: "playing",
          winner: null,
          winningLine: [],
        });
        setLastMove(null);
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

        send({
          type: "move",
          row,
          col,
          timestamp: Date.now(),
        });

        if (winningLine.length > 0) {
          // 只在本地增加分数，不要在接收到对方移动时再加
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
    [checkWin, gameState.status, gameState.board, gameState.currentPlayer, myColor, send],
  );

  const resetGame = useCallback(() => {
    // 在重置前触发爆炸动画
    if (gameState.board.some(row => row.some(cell => cell !== null))) {
      const pieces: Array<{ x: number; y: number; color: "black" | "white" }> = [];
      const boardCenterX = (BOARD_SIZE * CELL_SIZE) / 2 + 10;
      const boardCenterY = (BOARD_SIZE * CELL_SIZE) / 2 + 10;
      
      gameState.board.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
          if (cell) {
            pieces.push({
              x: 10 + CELL_SIZE / 2 + colIndex * CELL_SIZE,
              y: 10 + CELL_SIZE / 2 + rowIndex * CELL_SIZE,
              color: cell,
            });
          }
        });
      });
      
      setExplosionPieces(pieces);
      setShowExplosion(true);
      
      // 延迟重置游戏状态，让爆炸动画先播放
      setTimeout(() => {
        const newMyColor: Player = myColor === "black" ? "white" : "black";
        setMyColor(newMyColor);
        
        setGameState({
          board: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
          currentPlayer: "black",
          status: "playing",
          winner: null,
          winningLine: [],
        });
        setLastMove(null);

        send({
          type: "reset",
          timestamp: Date.now(),
        });
      }, 300); // 给一点延迟让爆炸开始
    } else {
      // 如果棋盘是空的，直接重置
      const newMyColor: Player = myColor === "black" ? "white" : "black";
      setMyColor(newMyColor);
      
      setGameState({
        board: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
        currentPlayer: "black",
        status: "playing",
        winner: null,
        winningLine: [],
      });
      setLastMove(null);

      send({
        type: "reset",
        timestamp: Date.now(),
      });
    }
  }, [myColor, send, gameState.board]);

  const myPlayerId = myColor === "black" ? "P1" : myColor === "white" ? "P2" : null;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        className="fixed left-4 top-4 z-50 md:left-6 md:top-6"
      >
        <Link
          href="/"
          className="inline-flex border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-[family-name:var(--font-press-start)] text-[8px] tracking-wider text-[var(--pixel-accent)] shadow-[0_0_10px_var(--pixel-glow)] backdrop-blur-md transition-colors hover:bg-[var(--pixel-bg-alt)] md:text-[10px]"
        >
          ← BACK
        </Link>
      </motion.div>

      <div className="relative z-10 container mx-auto px-3 md:px-4 py-4 md:py-8 min-h-screen flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mb-5 text-center md:mb-8"
        >
          <h1 className="mb-3 font-[family-name:var(--font-press-start)] text-2xl tracking-wider text-[var(--pixel-accent)] md:text-5xl">
            [ GOMOKU ]
          </h1>
          <p className="font-[family-name:var(--font-jetbrains)] text-xs text-[var(--pixel-muted)] md:text-sm">
            &gt; P2P Five in a Row Game with unified error handling
          </p>
        </motion.div>

        <div className="w-full max-w-6xl">
          {!isConnected && (
            <P2PConnectionPanel
              localPeerId={localPeerId}
              phase={phase}
              connectTimeoutMs={P2P_CONNECT_TIMEOUT_MS}
              error={error}
              title="GOMOKU_P2P"
              description={connectionDescription}
              onConnect={connect}
              onRetry={retryLastConnection}
              onClearError={clearError}
              onReinitialize={reinitialize}
            />
          )}

          {isConnected && (
            <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
              {/* 左侧：游戏信息和控制 */}
              <div className="lg:w-80 space-y-4">
                {/* 玩家信息 */}
                <div className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-4 backdrop-blur-xl">
                  <h3 className="mb-3 font-[family-name:var(--font-press-start)] text-[10px] text-[var(--pixel-accent)]">
                    [ PLAYERS ]
                  </h3>
                  <div className="space-y-2">
                    <div className={`flex items-center gap-2 p-2 border ${myColor === "black" ? "border-[var(--pixel-accent)]" : "border-[var(--pixel-border)]"}`}>
                      <div className="w-6 h-6 bg-black border border-[var(--pixel-border)]" />
                      <span className="font-[family-name:var(--font-jetbrains)] text-sm">
                        {myColor === "black" ? `${myPlayerId} (You)` : "P1"}
                      </span>
                      {gameState.currentPlayer === "black" && (
                        <span className="ml-auto text-[var(--pixel-accent)]">●</span>
                      )}
                    </div>
                    <div className={`flex items-center gap-2 p-2 border ${myColor === "white" ? "border-[var(--pixel-accent)]" : "border-[var(--pixel-border)]"}`}>
                      <div className="w-6 h-6 bg-white border border-[var(--pixel-border)]" />
                      <span className="font-[family-name:var(--font-jetbrains)] text-sm">
                        {myColor === "white" ? `${myPlayerId} (You)` : "P2"}
                      </span>
                      {gameState.currentPlayer === "white" && (
                        <span className="ml-auto text-[var(--pixel-accent)]">●</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 游戏状态 */}
                <div className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-4 backdrop-blur-xl">
                  <h3 className="mb-3 font-[family-name:var(--font-press-start)] text-[10px] text-[var(--pixel-accent)]">
                    [ STATUS ]
                  </h3>
                  <div className="space-y-2 font-[family-name:var(--font-jetbrains)] text-sm">
                    {gameState.status === "waiting" && (
                      <p className="text-[var(--pixel-muted)]">&gt; Waiting for connection...</p>
                    )}
                    {gameState.status === "playing" && (
                      <p className="text-[var(--pixel-text)]">
                        &gt; {gameState.currentPlayer === myColor ? "Your turn" : "Opponent's turn"}
                      </p>
                    )}
                    {gameState.status === "won" && (
                      <p className={gameState.winner === myColor ? "text-[var(--pixel-accent)]" : "text-[var(--pixel-warn)]"}>
                        &gt; {gameState.winner === myColor ? "You won!" : "Opponent won!"}
                      </p>
                    )}
                    {gameState.status === "draw" && (
                      <p className="text-[var(--pixel-muted)]">&gt; Draw!</p>
                    )}
                  </div>
                </div>

                {/* 统计 */}
                <div className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-4 backdrop-blur-xl">
                  <h3 className="mb-3 font-[family-name:var(--font-press-start)] text-[10px] text-[var(--pixel-accent)]">
                    [ STATS ]
                  </h3>
                  <div className="space-y-1 font-[family-name:var(--font-jetbrains)] text-sm">
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

                {/* 控制按钮 */}
                {(gameState.status === "won" || gameState.status === "draw") && (
                  <button
                    onClick={resetGame}
                    className="w-full border-2 border-[var(--pixel-accent)] bg-[var(--pixel-accent)] px-4 py-3 font-[family-name:var(--font-press-start)] text-[10px] text-[var(--pixel-bg)] transition-transform hover:scale-[1.02]"
                  >
                    NEW GAME
                  </button>
                )}
              </div>

              {/* 右侧：棋盘 */}
              <div className="flex-1 flex items-center justify-center">
                <div className="relative inline-block border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-4 backdrop-blur-xl">
                  {/* 爆炸动画层 */}
                  {showExplosion && (
                    <GomokuExplosion
                      pieces={explosionPieces}
                      centerX={(BOARD_SIZE * CELL_SIZE) / 2 + 10}
                      centerY={(BOARD_SIZE * CELL_SIZE) / 2 + 10}
                      onComplete={() => setShowExplosion(false)}
                    />
                  )}
                  
                  <svg
                    width={BOARD_SIZE * CELL_SIZE + 20}
                    height={BOARD_SIZE * CELL_SIZE + 20}
                    className="cursor-pointer"
                  >
                    {/* 棋盘背景 */}
                    <rect
                      x="10"
                      y="10"
                      width={BOARD_SIZE * CELL_SIZE}
                      height={BOARD_SIZE * CELL_SIZE}
                      fill="var(--pixel-bg)"
                      stroke="var(--pixel-border)"
                      strokeWidth="2"
                    />

                    {/* 网格线 */}
                    {Array.from({ length: BOARD_SIZE }).map((_, i) => (
                      <g key={i}>
                        <line
                          x1={10 + CELL_SIZE / 2}
                          y1={10 + CELL_SIZE / 2 + i * CELL_SIZE}
                          x2={10 + CELL_SIZE / 2 + (BOARD_SIZE - 1) * CELL_SIZE}
                          y2={10 + CELL_SIZE / 2 + i * CELL_SIZE}
                          stroke="var(--pixel-border)"
                          strokeWidth="1"
                        />
                        <line
                          x1={10 + CELL_SIZE / 2 + i * CELL_SIZE}
                          y1={10 + CELL_SIZE / 2}
                          x2={10 + CELL_SIZE / 2 + i * CELL_SIZE}
                          y2={10 + CELL_SIZE / 2 + (BOARD_SIZE - 1) * CELL_SIZE}
                          stroke="var(--pixel-border)"
                          strokeWidth="1"
                        />
                      </g>
                    ))}

                    {/* 星位 */}
                    {STAR_POINTS.map(([row, col], i) => (
                      <circle
                        key={i}
                        cx={10 + CELL_SIZE / 2 + col * CELL_SIZE}
                        cy={10 + CELL_SIZE / 2 + row * CELL_SIZE}
                        r="3"
                        fill="var(--pixel-border)"
                      />
                    ))}

                    {/* 棋子 */}
                    {gameState.board.map((row, rowIndex) =>
                      row.map((cell, colIndex) => {
                        if (!cell) return null;
                        const isWinningPiece = gameState.winningLine.some(
                          ([r, c]) => r === rowIndex && c === colIndex
                        );
                        const isLastMove = lastMove?.row === rowIndex && lastMove?.col === colIndex;
                        return (
                          <g key={`${rowIndex}-${colIndex}`}>
                            <circle
                              cx={10 + CELL_SIZE / 2 + colIndex * CELL_SIZE}
                              cy={10 + CELL_SIZE / 2 + rowIndex * CELL_SIZE}
                              r={CELL_SIZE / 2 - 3}
                              fill={cell === "black" ? "black" : "white"}
                              stroke={isWinningPiece ? "var(--pixel-accent)" : "var(--pixel-border)"}
                              strokeWidth={isWinningPiece ? "3" : "1"}
                            />
                            {isLastMove && (
                              <circle
                                cx={10 + CELL_SIZE / 2 + colIndex * CELL_SIZE}
                                cy={10 + CELL_SIZE / 2 + rowIndex * CELL_SIZE}
                                r="4"
                                fill={cell === "black" ? "white" : "black"}
                              />
                            )}
                          </g>
                        );
                      })
                    )}

                    {/* 点击区域 */}
                    {gameState.status === "playing" && gameState.currentPlayer === myColor && (
                      <g>
                        {gameState.board.map((row, rowIndex) =>
                          row.map((cell, colIndex) => {
                            if (cell) return null;
                            return (
                              <rect
                                key={`click-${rowIndex}-${colIndex}`}
                                x={10 + colIndex * CELL_SIZE}
                                y={10 + rowIndex * CELL_SIZE}
                                width={CELL_SIZE}
                                height={CELL_SIZE}
                                fill="transparent"
                                className="cursor-pointer hover:fill-[var(--pixel-accent)] hover:opacity-10"
                                onClick={() => makeMove(rowIndex, colIndex)}
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
          )}
        </div>
      </div>
    </div>
  );
}