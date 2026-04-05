"use client";

import React from "react";
import type { CellPos } from "../types";

interface SudokuBoardProps {
  board: number[][];
  locked: boolean[][];
  conflicts: boolean[][];
  solution: number[][];
  selectedCell: CellPos | null;
  onCellSelect: (row: number, col: number) => void;
  onNumberInput: (value: number) => void;
  showNumberPad?: boolean;
}

export function SudokuBoard({
  board,
  locked,
  conflicts,
  solution,
  selectedCell,
  onCellSelect,
  onNumberInput,
  showNumberPad = true,
}: SudokuBoardProps) {
  if (board.length === 0) return null;

  const selRow = selectedCell?.row ?? -1;
  const selCol = selectedCell?.col ?? -1;
  const selVal = selectedCell ? board[selRow]?.[selCol] : 0;
  const selBoxRow = selectedCell ? Math.floor(selRow / 3) : -1;
  const selBoxCol = selectedCell ? Math.floor(selCol / 3) : -1;

  return (
    <div className="flex flex-col items-center gap-3 md:gap-4">
      {/* Board: rendered as 3 box-rows × 3 box-cols */}
      <div
        className="rounded-xl border-2 border-[color-mix(in_oklab,var(--pixel-accent)_50%,transparent)] overflow-hidden shadow-lg shadow-[var(--pixel-glow)]"
        style={{ display: "inline-grid", gridTemplateRows: "repeat(3, auto)", gap: "2px", background: "color-mix(in oklab, var(--pixel-accent) 30%, transparent)" }}
      >
        {[0, 1, 2].map(boxRow => (
          <div key={boxRow} style={{ display: "grid", gridTemplateColumns: "repeat(3, auto)", gap: "2px" }}>
            {[0, 1, 2].map(boxCol => (
              <div
                key={boxCol}
                style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}
                className="bg-[var(--pixel-bg)]"
              >
                {[0, 1, 2].map(dr =>
                  [0, 1, 2].map(dc => {
                    const r = boxRow * 3 + dr;
                    const c = boxCol * 3 + dc;
                    const val = board[r][c];
                    const isLocked = locked[r]?.[c];
                    const isSelected = r === selRow && c === selCol;
                    const isSameBox = boxRow === selBoxRow && boxCol === selBoxCol;
                    const isSameRow = r === selRow;
                    const isSameCol = c === selCol;
                    const isHighlighted = !isSelected && (isSameRow || isSameCol || isSameBox);
                    const isSameNum = !isSelected && selVal !== 0 && val === selVal;
                    const isConflict = conflicts[r]?.[c];
                    const isCorrect = val !== 0 && val === solution[r]?.[c] && !isLocked;

                    let bgClass = "bg-[var(--pixel-bg)]";
                    if (isSelected) bgClass = "bg-[color-mix(in_oklab,var(--pixel-accent)_25%,var(--pixel-bg))]";
                    else if (isConflict) bgClass = "bg-[color-mix(in_oklab,var(--pixel-warn)_15%,var(--pixel-bg))]";
                    else if (isSameNum) bgClass = "bg-[color-mix(in_oklab,var(--pixel-accent)_18%,var(--pixel-bg))]";
                    else if (isHighlighted) bgClass = "bg-[color-mix(in_oklab,var(--pixel-accent)_7%,var(--pixel-bg))]";

                    let textClass = "";
                    if (isConflict) textClass = "text-[var(--pixel-warn)] font-semibold";
                    else if (isLocked) textClass = "text-[var(--pixel-text)] font-bold";
                    else if (isCorrect) textClass = "text-[var(--pixel-accent)] font-semibold";
                    else textClass = "text-[var(--pixel-accent-2)] font-medium";

                    // Inner borders between cells within a box
                    const borderRight = dc < 2 ? "border-r border-[var(--pixel-border)]" : "";
                    const borderBottom = dr < 2 ? "border-b border-[var(--pixel-border)]" : "";

                    return (
                      <div
                        key={`${r}-${c}`}
                        onClick={() => onCellSelect(r, c)}
                        className={[
                          "flex items-center justify-center cursor-pointer select-none",
                          "w-8 h-8 md:w-10 md:h-10 lg:w-11 lg:h-11",
                          "font-mono text-sm md:text-base lg:text-lg",
                          "transition-colors duration-75",
                          bgClass, textClass, borderRight, borderBottom,
                        ].join(" ")}
                      >
                        {val !== 0 ? val : ""}
                      </div>
                    );
                  })
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Number pad */}
      {showNumberPad && (
        <div className="flex flex-col gap-1.5 w-full max-w-[216px]">
          <div className="grid grid-cols-3 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
              <button
                key={n}
                onClick={() => onNumberInput(n)}
                className="h-11 rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] font-mono text-base font-semibold text-[var(--pixel-accent)] transition-all hover:bg-[var(--pixel-bg-alt)] hover:scale-105 active:scale-95"
              >
                {n}
              </button>
            ))}
          </div>
          <button
            onClick={() => onNumberInput(0)}
            className="h-9 w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] font-mono text-xs font-semibold text-[var(--pixel-muted)] transition-all hover:bg-[var(--pixel-bg-alt)] hover:border-[var(--pixel-warn)] hover:text-[var(--pixel-warn)] active:scale-95"
          >
            ERASE
          </button>
        </div>
      )}
    </div>
  );
}
