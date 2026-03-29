"use client";

import GomokuExplosion from "../../components/GomokuExplosion";
import { BOARD_PADDING, BOARD_SIZE, STAR_POINTS, type CellState, type GameState, type Player } from "../types";

export function GomokuBoard({
  gameState,
  cellSize,
  boardPixels,
  stoneRadius,
  previewPos,
  lastMove,
  myColor,
  gameMode,
  showExplosion,
  explosionPieces,
  onCellClick,
  onExplosionComplete,
}: {
  gameState: GameState;
  cellSize: number;
  boardPixels: number;
  stoneRadius: number;
  previewPos: { row: number; col: number } | null;
  lastMove: { row: number; col: number } | null;
  myColor: Player | null;
  gameMode: string;
  showExplosion: boolean;
  explosionPieces: Array<{ x: number; y: number; color: "black" | "white" }>;
  onCellClick: (row: number, col: number) => void;
  onExplosionComplete: () => void;
}) {
  const isInteractive = gameState.status === "playing" &&
    (gameMode === "ai" ? gameState.currentPlayer === "black" : gameState.currentPlayer === myColor);

  return (
    <div className="relative inline-block rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-2 md:p-4">
      {showExplosion && (
        <GomokuExplosion
          pieces={explosionPieces}
          centerX={boardPixels / 2}
          centerY={boardPixels / 2}
          onComplete={onExplosionComplete}
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
          x={BOARD_PADDING} y={BOARD_PADDING}
          width={BOARD_SIZE * cellSize} height={BOARD_SIZE * cellSize}
          fill="var(--pixel-bg)" stroke="var(--pixel-border)" strokeWidth="2"
        />

        {/* Grid lines */}
        {Array.from({ length: BOARD_SIZE }).map((_, i) => (
          <g key={i}>
            <line
              x1={BOARD_PADDING + cellSize / 2} y1={BOARD_PADDING + cellSize / 2 + i * cellSize}
              x2={BOARD_PADDING + cellSize / 2 + (BOARD_SIZE - 1) * cellSize} y2={BOARD_PADDING + cellSize / 2 + i * cellSize}
              stroke="var(--pixel-border)" strokeWidth="1"
            />
            <line
              x1={BOARD_PADDING + cellSize / 2 + i * cellSize} y1={BOARD_PADDING + cellSize / 2}
              x2={BOARD_PADDING + cellSize / 2 + i * cellSize} y2={BOARD_PADDING + cellSize / 2 + (BOARD_SIZE - 1) * cellSize}
              stroke="var(--pixel-border)" strokeWidth="1"
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

        {/* Placed stones */}
        {gameState.board.map((row, ri) =>
          row.map((cell, ci) => {
            if (!cell) return null;
            const isWinning = gameState.winningLine.some(([r, c]) => r === ri && c === ci);
            const isLast = lastMove?.row === ri && lastMove?.col === ci;
            return (
              <g key={`${ri}-${ci}`}>
                <circle
                  cx={BOARD_PADDING + cellSize / 2 + ci * cellSize}
                  cy={BOARD_PADDING + cellSize / 2 + ri * cellSize}
                  r={stoneRadius}
                  fill={cell === "black" ? "black" : "white"}
                  stroke={isWinning ? "var(--pixel-accent)" : "var(--pixel-border)"}
                  strokeWidth={isWinning ? "3" : "1"}
                />
                {isLast && (
                  <circle
                    cx={BOARD_PADDING + cellSize / 2 + ci * cellSize}
                    cy={BOARD_PADDING + cellSize / 2 + ri * cellSize}
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
            stroke="var(--pixel-accent)" strokeWidth="2" strokeDasharray="4 2"
          />
        )}

        {/* Click targets */}
        {isInteractive && (
          <g>
            {gameState.board.map((row, ri) =>
              row.map((cell, ci) => {
                if (cell) return null;
                return (
                  <rect
                    key={`click-${ri}-${ci}`}
                    x={BOARD_PADDING + ci * cellSize} y={BOARD_PADDING + ri * cellSize}
                    width={cellSize} height={cellSize}
                    fill="transparent"
                    className="cursor-pointer hover:fill-[var(--pixel-accent)] hover:opacity-10"
                    onClick={() => onCellClick(ri, ci)}
                  />
                );
              })
            )}
          </g>
        )}
      </svg>
    </div>
  );
}
