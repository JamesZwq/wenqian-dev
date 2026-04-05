import type { Difficulty } from "./types";
import { DIFFICULTY_CLUES } from "./types";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isValid(grid: number[][], row: number, col: number, num: number): boolean {
  for (let c = 0; c < 9; c++) if (grid[row][c] === num) return false;
  for (let r = 0; r < 9; r++) if (grid[r][col] === num) return false;
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++)
    for (let c = bc; c < bc + 3; c++)
      if (grid[r][c] === num) return false;
  return true;
}

function findEmpty(grid: number[][]): [number, number] | null {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (grid[r][c] === 0) return [r, c];
  return null;
}

function fillGrid(grid: number[][]): boolean {
  const cell = findEmpty(grid);
  if (!cell) return true;
  const [row, col] = cell;
  for (const num of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    if (isValid(grid, row, col, num)) {
      grid[row][col] = num;
      if (fillGrid(grid)) return true;
      grid[row][col] = 0;
    }
  }
  return false;
}

// Count solutions up to `limit` (used for uniqueness check)
function countSolutions(grid: number[][], limit: number): number {
  const cell = findEmpty(grid);
  if (!cell) return 1;
  const [row, col] = cell;
  let count = 0;
  for (let num = 1; num <= 9; num++) {
    if (isValid(grid, row, col, num)) {
      grid[row][col] = num;
      count += countSolutions(grid, limit);
      grid[row][col] = 0;
      if (count >= limit) return count;
    }
  }
  return count;
}

export function generatePuzzle(difficulty: Difficulty): {
  puzzle: number[][];
  solution: number[][];
} {
  const solution: number[][] = Array.from({ length: 9 }, () => Array(9).fill(0));
  fillGrid(solution);

  const clues = DIFFICULTY_CLUES[difficulty];
  const toRemove = 81 - clues;
  const puzzle = solution.map(row => [...row]);
  const cells = shuffle(Array.from({ length: 81 }, (_, i) => i));
  let removed = 0;

  for (const idx of cells) {
    if (removed >= toRemove) break;
    const row = Math.floor(idx / 9);
    const col = idx % 9;
    const backup = puzzle[row][col];
    puzzle[row][col] = 0;

    // Check if puzzle still has a unique solution
    const testGrid = puzzle.map(r => [...r]);
    if (countSolutions(testGrid, 2) === 1) {
      removed++;
    } else {
      puzzle[row][col] = backup;
    }
  }

  return { puzzle, solution };
}
