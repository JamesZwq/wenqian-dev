"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toIsometric, cubeTopFace, cubeLeftFace, cubeRightFace, type BlockPuzzle } from "../flashCountEngine";

/** ms per block — total reveal time scales with block count */
const BLOCK_INTERVAL = 150;

/** Pause after all blocks shown before advancing */
const COMPLETE_PAUSE_MS = 1500;

const LAYER_COLORS = [
  { left: "#4a9", right: "#37a", top: "#6dc" },
  { left: "#5ab", right: "#48b", top: "#7ed" },
  { left: "#6bc", right: "#59c", top: "#8fe" },
  { left: "#7cd", right: "#6ad", top: "#9ff" },
  { left: "#8de", right: "#7be", top: "#aff" },
];

/** Returns all blocks ordered bottom-layer-first, row/col within each layer */
function getLayeredBlocks(puzzle: BlockPuzzle): { r: number; c: number; l: number }[] {
  const { grid, rows, cols } = puzzle;
  const maxH = Math.max(...grid.flat());
  const blocks: { r: number; c: number; l: number }[] = [];
  for (let l = 0; l < maxH; l++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] > l) blocks.push({ r, c, l });
      }
    }
  }
  return blocks;
}

function computeBounds(puzzle: BlockPuzzle, tileW: number, tileH: number) {
  const { grid, rows, cols } = puzzle;
  const pts: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c]) continue;
      for (let l = 0; l < grid[r][c]; l++) {
        const { x, y } = toIsometric(r, c, l, tileW, tileH);
        pts.push({ x: x - tileW / 2, y: y - tileH }, { x: x + tileW / 2, y: y + tileH });
      }
    }
  }
  if (!pts.length) return null;
  const pad = 8;
  const minX = Math.min(...pts.map(p => p.x));
  const maxX = Math.max(...pts.map(p => p.x));
  const minY = Math.min(...pts.map(p => p.y));
  const maxY = Math.max(...pts.map(p => p.y));
  return { svgW: maxX - minX + pad * 2, svgH: maxY - minY + pad * 2, offX: -minX + pad, offY: -minY + pad };
}

export function RevealBlocks({
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
  const allBlocks = useMemo(() => getLayeredBlocks(puzzle), [puzzle]);
  const bounds = useMemo(() => computeBounds(puzzle, tileW, tileH), [puzzle, tileW, tileH]);
  const [visibleCount, setVisibleCount] = useState(0);
  // Stable ref — interval closure always calls the latest callback
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    setVisibleCount(0);
    let count = 0;
    const id = setInterval(() => {
      count++;
      setVisibleCount(count);
      if (count >= allBlocks.length) {
        clearInterval(id);
        setTimeout(() => onCompleteRef.current(), COMPLETE_PAUSE_MS);
      }
    }, BLOCK_INTERVAL);
    return () => clearInterval(id);
  }, [allBlocks]);

  if (!bounds) return null;
  const { svgW, svgH, offX, offY } = bounds;
  const { rows, cols, grid } = puzzle;

  const visibleSet = new Set(allBlocks.slice(0, visibleCount).map(b => `${b.r}-${b.c}-${b.l}`));

  const cubes: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      for (let l = 0; l < grid[r][c]; l++) {
        const key = `${r}-${c}-${l}`;
        if (!visibleSet.has(key)) continue;
        const { x, y } = toIsometric(r, c, l, tileW, tileH);
        const cx = x + offX, cy = y + offY;
        const clr = LAYER_COLORS[Math.min(l, LAYER_COLORS.length - 1)];
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
      <div className="flex flex-col items-center gap-1">
        <span className="font-mono text-2xl md:text-3xl font-bold text-[var(--pixel-accent)]">
          {visibleCount}{" "}
          <span className="text-[var(--pixel-muted)] text-lg md:text-xl">/ {allBlocks.length}</span>
        </span>
        {visibleCount >= allBlocks.length && (
          <span className="font-mono text-[10px] md:text-xs text-[var(--pixel-accent)]">✓ Verified</span>
        )}
      </div>
    </div>
  );
}
