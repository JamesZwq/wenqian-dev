// ─── Flash Count Engine ───
// Generates 3D block structures on a grid with gravity.
// Users must count ALL blocks including hidden ones beneath/behind visible blocks.

export type Difficulty = "easy" | "medium" | "hard";

export type BlockPuzzle = {
  /** 2D heightmap: grid[row][col] = number of stacked blocks at that position */
  grid: number[][];
  /** Total number of blocks (the correct answer) */
  answer: number;
  /** Grid dimensions */
  rows: number;
  cols: number;
  /** Flash duration in ms */
  flashDuration: number;
};

export type FlashCountConfig = {
  difficulty: Difficulty;
  totalQuestions: number;
};

const DIFFICULTY_PARAMS: Record<Difficulty, {
  gridSize: number;
  minBlocks: number;
  maxHeight: number;
  maxPositions: number;
  flashBase: number;
  flashDecay: number;
  flashMin: number;
}> = {
  easy: {
    gridSize: 3,
    minBlocks: 3,
    maxHeight: 3,
    maxPositions: 5,
    flashBase: 1200,
    flashDecay: 15,
    flashMin: 600,
  },
  medium: {
    gridSize: 4,
    minBlocks: 5,
    maxHeight: 4,
    maxPositions: 8,
    flashBase: 900,
    flashDecay: 12,
    flashMin: 400,
  },
  hard: {
    gridSize: 5,
    minBlocks: 8,
    maxHeight: 5,
    maxPositions: 12,
    flashBase: 700,
    flashDecay: 10,
    flashMin: 300,
  },
};

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generatePuzzle(difficulty: Difficulty, questionIndex: number): BlockPuzzle {
  const params = DIFFICULTY_PARAMS[difficulty];
  const { gridSize, minBlocks, maxHeight, maxPositions } = params;

  // Create empty grid
  const grid: number[][] = Array.from({ length: gridSize }, () =>
    Array(gridSize).fill(0)
  );

  // Pick random positions to place columns of blocks
  const allPositions: [number, number][] = [];
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      allPositions.push([r, c]);
    }
  }

  // Shuffle and pick a subset
  for (let i = allPositions.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [allPositions[i], allPositions[j]] = [allPositions[j], allPositions[i]];
  }

  const numPositions = randInt(
    Math.min(minBlocks, maxPositions),
    Math.min(maxPositions, allPositions.length)
  );
  const chosen = allPositions.slice(0, numPositions);

  // Assign random heights
  let totalBlocks = 0;
  for (const [r, c] of chosen) {
    // Scale max height slightly with question index for variety
    const effectiveMax = Math.min(maxHeight, 2 + Math.floor(questionIndex / 5));
    const height = randInt(1, Math.max(1, effectiveMax));
    grid[r][c] = height;
    totalBlocks += height;
  }

  // Ensure minimum block count
  if (totalBlocks < minBlocks) {
    for (const [r, c] of chosen) {
      if (totalBlocks >= minBlocks) break;
      const add = randInt(1, Math.min(2, maxHeight - grid[r][c]));
      if (add > 0) {
        grid[r][c] += add;
        totalBlocks += add;
      }
    }
  }

  // Flash duration decreases with question index
  const flash = Math.max(
    params.flashMin,
    params.flashBase - questionIndex * params.flashDecay
  );

  return {
    grid,
    answer: totalBlocks,
    rows: gridSize,
    cols: gridSize,
    flashDuration: flash,
  };
}

export function generatePuzzleSet(difficulty: Difficulty, count: number): BlockPuzzle[] {
  const puzzles: BlockPuzzle[] = [];
  for (let i = 0; i < count; i++) {
    puzzles.push(generatePuzzle(difficulty, i));
  }
  return puzzles;
}

// ─── Isometric rendering helpers ───

// Convert grid (row, col, layer) to isometric screen coordinates
// Uses a standard isometric projection where:
//   x-axis goes right-down, y-axis goes left-down, z-axis goes up
export function toIsometric(
  row: number,
  col: number,
  layer: number,
  tileW: number,
  tileH: number,
): { x: number; y: number } {
  const x = (col - row) * (tileW / 2);
  const y = (col + row) * (tileH / 2) - layer * tileH;
  return { x, y };
}

// Generate the 6 points of an isometric cube's top face
export function cubeTopFace(
  cx: number,
  cy: number,
  tw: number,
  th: number,
): string {
  return [
    `${cx},${cy - th}`,
    `${cx + tw / 2},${cy - th / 2}`,
    `${cx},${cy}`,
    `${cx - tw / 2},${cy - th / 2}`,
  ].join(" ");
}

export function cubeLeftFace(
  cx: number,
  cy: number,
  tw: number,
  th: number,
): string {
  return [
    `${cx - tw / 2},${cy - th / 2}`,
    `${cx},${cy}`,
    `${cx},${cy + th}`,
    `${cx - tw / 2},${cy + th / 2}`,
  ].join(" ");
}

export function cubeRightFace(
  cx: number,
  cy: number,
  tw: number,
  th: number,
): string {
  return [
    `${cx + tw / 2},${cy - th / 2}`,
    `${cx},${cy}`,
    `${cx},${cy + th}`,
    `${cx + tw / 2},${cy + th / 2}`,
  ].join(" ");
}
