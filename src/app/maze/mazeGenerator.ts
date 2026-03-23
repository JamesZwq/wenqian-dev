export type Cell = {
  row: number;
  col: number;
  walls: {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
  };
  visited: boolean;
};

export type Maze = Cell[][];

export type Difficulty = "easy" | "normal" | "hard";

// Minimum path length (as fraction of total cells) by difficulty
const MIN_PATH_FRACTION: Record<Difficulty, number> = {
  easy: 0.45,
  normal: 0.60,
  hard: 0.75,
};

// How many extra random walls to add back (reduces dead-ends, increases difficulty)
const EXTRA_WALL_FRACTION: Record<Difficulty, number> = {
  easy: 0.0,
  normal: 0.0,
  hard: 0.0,
};

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// BFS from (sr, sc) — returns distance map
function bfsDistances(
  maze: Maze,
  sr: number,
  sc: number
): number[][] {
  const rows = maze.length;
  const cols = maze[0].length;
  const dist: number[][] = Array.from({ length: rows }, () =>
    new Array(cols).fill(-1)
  );
  dist[sr][sc] = 0;
  const queue: [number, number][] = [[sr, sc]];
  const DIRS: [number, number, "top" | "bottom" | "left" | "right"][] = [
    [-1, 0, "top"],
    [1, 0, "bottom"],
    [0, -1, "left"],
    [0, 1, "right"],
  ];
  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    for (const [dr, dc, wall] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (maze[r][c].walls[wall]) continue;
      if (dist[nr][nc] !== -1) continue;
      dist[nr][nc] = dist[r][c] + 1;
      queue.push([nr, nc]);
    }
  }
  return dist;
}

export function generateMaze(
  rows: number,
  cols: number,
  difficulty: Difficulty = "normal"
): Maze {
  // ── Step 1: init all walls ──────────────────────────────────────────────
  const maze: Maze = [];
  for (let r = 0; r < rows; r++) {
    maze[r] = [];
    for (let c = 0; c < cols; c++) {
      maze[r][c] = {
        row: r,
        col: c,
        walls: { top: true, right: true, bottom: true, left: true },
        visited: false,
      };
    }
  }

  // ── Step 2: Randomized DFS (recursive backtracker) ──────────────────────
  // Produces a perfect maze (exactly one path between any two cells).
  // Much more varied than Eller's — long winding corridors in all directions.
  const DIRS: [number, number, "top" | "bottom" | "left" | "right", "top" | "bottom" | "left" | "right"][] = [
    [-1, 0, "top", "bottom"],
    [1, 0, "bottom", "top"],
    [0, -1, "left", "right"],
    [0, 1, "right", "left"],
  ];

  function carve(r: number, c: number) {
    maze[r][c].visited = true;
    const dirs = shuffle([...DIRS]);
    for (const [dr, dc, wall, opposite] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (maze[nr][nc].visited) continue;
      maze[r][c].walls[wall] = false;
      maze[nr][nc].walls[opposite] = false;
      carve(nr, nc);
    }
  }

  // Start from a random cell to avoid top-left bias
  const startR = Math.floor(Math.random() * rows);
  const startC = Math.floor(Math.random() * cols);
  carve(startR, startC);

  // ── Step 3: Add loops (extra passages) to reduce dead-ends on hard+ ─────
  // On normal/hard we punch a few extra holes to create multiple paths,
  // making navigation less obvious.
  const loopCount = Math.floor(
    rows * cols * EXTRA_WALL_FRACTION[difficulty]
  );
  for (let i = 0; i < loopCount; i++) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    const [dr, dc, wall, opposite] = DIRS[Math.floor(Math.random() * 4)];
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
      maze[r][c].walls[wall] = false;
      maze[nr][nc].walls[opposite] = false;
    }
  }

  return maze;
}

// Pick a goal cell that is far from (0,0) — minimum path fraction enforced.
// Returns the goal position. Retries with a lower threshold if no cell qualifies.
export function generateGoal(
  maze: Maze,
  difficulty: Difficulty
): { row: number; col: number } {
  const rows = maze.length;
  const cols = maze[0].length;
  const totalCells = rows * cols;
  const minFraction = MIN_PATH_FRACTION[difficulty];

  const dist = bfsDistances(maze, 0, 0);
  const maxDist = Math.max(...dist.flat());

  // Collect all cells that are at least minFraction * maxDist away from start,
  // and also not too close to the center (avoid trivially reachable center goals).
  let threshold = Math.floor(maxDist * minFraction);

  let candidates: { row: number; col: number }[] = [];
  while (threshold > 0 && candidates.length === 0) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (dist[r][c] >= threshold) {
          // Exclude (0,0) and cells too close to start
          if (r === 0 && c === 0) continue;
          candidates.push({ row: r, col: c });
        }
      }
    }
    if (candidates.length === 0) threshold = Math.floor(threshold * 0.85);
  }

  // Prefer cells near edges/corners for visual clarity
  const edgeCandidates = candidates.filter(
    ({ row, col }) =>
      row === 0 || row === rows - 1 || col === 0 || col === cols - 1
  );
  const pool = edgeCandidates.length > 0 ? edgeCandidates : candidates;

  // Pick the cell with max distance among the top candidates (with some randomness)
  pool.sort((a, b) => dist[b.row][b.col] - dist[a.row][a.col]);
  const topN = Math.max(1, Math.floor(pool.length * 0.25));
  const pick = pool[Math.floor(Math.random() * topN)];

  // Fallback: bottom-right corner
  return pick ?? { row: rows - 1, col: cols - 1 };
}

export function canMove(
  maze: Maze,
  fromRow: number,
  fromCol: number,
  direction: "up" | "down" | "left" | "right"
): boolean {
  const cell = maze[fromRow][fromCol];
  switch (direction) {
    case "up":    return !cell.walls.top;
    case "down":  return !cell.walls.bottom;
    case "left":  return !cell.walls.left;
    case "right": return !cell.walls.right;
    default:      return false;
  }
}
