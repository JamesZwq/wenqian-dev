"use client";

import { useMemo } from "react";
import { toIsometric, cubeTopFace, cubeLeftFace, cubeRightFace, type BlockPuzzle } from "../flashCountEngine";

const CUBE_COLORS = { left: "#4a8", right: "#37a", top: "#6dc" };

function computeBounds(puzzle: BlockPuzzle, tileW: number, tileH: number) {
  const { grid, rows, cols } = puzzle;
  const pts: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const h = grid[r][c];
      if (!h) continue;
      for (let l = 0; l < h; l++) {
        const { x, y } = toIsometric(r, c, l, tileW, tileH);
        pts.push(
          { x: x - tileW / 2, y: y - tileH },
          { x: x + tileW / 2, y: y - tileH },
          { x: x - tileW / 2, y: y + tileH },
          { x: x + tileW / 2, y: y + tileH },
        );
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

export function IsometricBlocks({
  puzzle,
  tileW,
  tileH,
}: {
  puzzle: BlockPuzzle;
  tileW: number;
  tileH: number;
}) {
  const bounds = useMemo(() => computeBounds(puzzle, tileW, tileH), [puzzle, tileW, tileH]);
  if (!bounds) return null;

  const { svgW, svgH, offX, offY } = bounds;
  const { grid, rows, cols } = puzzle;

  const cubes: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      for (let l = 0; l < grid[r][c]; l++) {
        const { x, y } = toIsometric(r, c, l, tileW, tileH);
        const cx = x + offX;
        const cy = y + offY;
        const key = `${r}-${c}-${l}`;
        cubes.push(
          <g key={key}>
            <polygon points={cubeLeftFace(cx, cy, tileW, tileH)} fill={CUBE_COLORS.left} stroke="#111" strokeWidth={0.8} strokeLinejoin="round" />
            <polygon points={cubeRightFace(cx, cy, tileW, tileH)} fill={CUBE_COLORS.right} stroke="#111" strokeWidth={0.8} strokeLinejoin="round" />
            <polygon points={cubeTopFace(cx, cy, tileW, tileH)} fill={CUBE_COLORS.top} stroke="#111" strokeWidth={0.8} strokeLinejoin="round" />
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
