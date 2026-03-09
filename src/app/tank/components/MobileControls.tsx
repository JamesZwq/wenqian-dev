"use client";

import type { Direction } from "../types";

type MobileControlsProps = {
  onMove: (direction: Direction) => void;
  onFirePress: () => void;
  onFireRelease: () => void;
  hidden?: boolean;
};

export function MobileControls({ onMove, onFirePress, onFireRelease, hidden }: MobileControlsProps) {
  if (hidden) return null;

  const handleTouch = (fn: () => void) => (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    fn();
  };

  return (
    <div className="mt-3 flex w-full items-end justify-between gap-4 md:hidden">
      <div className="flex flex-col items-center gap-2">
        <button
          onTouchStart={handleTouch(() => onMove("up"))}
          onMouseDown={handleTouch(() => onMove("up"))}
          className="h-12 w-12 border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] text-lg text-[var(--pixel-accent)]"
        >
          ↑
        </button>
        <div className="flex gap-2">
          <button
            onTouchStart={handleTouch(() => onMove("left"))}
            onMouseDown={handleTouch(() => onMove("left"))}
            className="h-12 w-12 border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] text-lg text-[var(--pixel-accent)]"
          >
            ←
          </button>
          <button
            onTouchStart={handleTouch(() => onMove("down"))}
            onMouseDown={handleTouch(() => onMove("down"))}
            className="h-12 w-12 border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] text-lg text-[var(--pixel-accent)]"
          >
            ↓
          </button>
          <button
            onTouchStart={handleTouch(() => onMove("right"))}
            onMouseDown={handleTouch(() => onMove("right"))}
            className="h-12 w-12 border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] text-lg text-[var(--pixel-accent)]"
          >
            →
          </button>
        </div>
      </div>

      <button
        onTouchStart={handleTouch(onFirePress)}
        onTouchEnd={handleTouch(onFireRelease)}
        onMouseDown={handleTouch(onFirePress)}
        onMouseUp={handleTouch(onFireRelease)}
        onMouseLeave={handleTouch(onFireRelease)}
        className="h-16 w-16 rounded-full border-2 border-[var(--pixel-warn)] bg-[var(--pixel-card-bg)] font-[family-name:var(--font-press-start)] text-[11px] text-[var(--pixel-warn)]"
      >
        FIRE
      </button>
    </div>
  );
}
