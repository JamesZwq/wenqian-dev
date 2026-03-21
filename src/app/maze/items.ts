import type { Maze } from "./mazeGenerator";

export type ItemType =
  | "SPEED_BOOST"
  | "SLOW_TRAP"
  | "FOG"
  | "X_RAY"
  | "BOMB"
  | "FREEZE";

export type ItemFrequency = "low" | "medium" | "high";

export type MazeItem = {
  id: string;
  type: ItemType;
  row: number;
  col: number;
};

export type ActiveEffect = {
  type: ItemType;
  targetPlayer: 1 | 2;
  expiresAt: number;
};

export type InventorySlot = {
  type: ItemType;
} | null;

export const ITEM_META: Record<
  ItemType,
  { label: string; emoji: string; color: string; duration: number }
> = {
  SPEED_BOOST: { label: "Speed", emoji: "\u26A1", color: "#FFD700", duration: 3000 },
  SLOW_TRAP: { label: "Slow", emoji: "\uD83D\uDC0C", color: "#FF6B6B", duration: 3000 },
  FOG: { label: "Fog", emoji: "\uD83C\uDF2B\uFE0F", color: "#8B8BAE", duration: 5000 },
  X_RAY: { label: "X-Ray", emoji: "\uD83D\uDC41", color: "#00CED1", duration: 2000 },
  BOMB: { label: "Bomb", emoji: "\uD83D\uDCA3", color: "#FF4500", duration: 0 },
  FREEZE: { label: "Freeze", emoji: "\u2744\uFE0F", color: "#00BFFF", duration: 2000 },
};

const ALL_ITEM_TYPES: ItemType[] = [
  "SPEED_BOOST",
  "SLOW_TRAP",
  "FOG",
  "X_RAY",
  "BOMB",
  "FREEZE",
];

const FREQUENCY_INTERVAL: Record<ItemFrequency, [number, number]> = {
  low: [7000, 9000],
  medium: [5000, 8000],
  high: [3000, 5000],
};

export const MAX_FIELD_ITEMS = 3;
export const MAX_INVENTORY = 2;

let itemIdCounter = 0;

export function nextSpawnDelay(freq: ItemFrequency): number {
  const [min, max] = FREQUENCY_INTERVAL[freq];
  return min + Math.random() * (max - min);
}

export function spawnItem(
  maze: Maze,
  existingItems: MazeItem[],
  p1: { row: number; col: number },
  p2: { row: number; col: number } | null
): MazeItem | null {
  if (existingItems.length >= MAX_FIELD_ITEMS) return null;

  const rows = maze.length;
  const cols = maze[0].length;
  const occupied = new Set<string>();

  for (const item of existingItems) {
    occupied.add(`${item.row}-${item.col}`);
  }
  occupied.add(`${p1.row}-${p1.col}`);
  if (p2) occupied.add(`${p2.row}-${p2.col}`);
  // Don't spawn on start or end
  occupied.add("0-0");
  occupied.add(`${rows - 1}-${cols - 1}`);

  const candidates: { row: number; col: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!occupied.has(`${r}-${c}`)) {
        candidates.push({ row: r, col: c });
      }
    }
  }

  if (candidates.length === 0) return null;

  const pos = candidates[Math.floor(Math.random() * candidates.length)];
  const type = ALL_ITEM_TYPES[Math.floor(Math.random() * ALL_ITEM_TYPES.length)];

  return {
    id: `item-${itemIdCounter++}`,
    type,
    row: pos.row,
    col: pos.col,
  };
}

export function bfsShortestPath(
  maze: Maze,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): { row: number; col: number }[] {
  const rows = maze.length;
  const cols = maze[0].length;
  const visited = new Set<string>();
  const parent = new Map<string, string>();
  const queue: { row: number; col: number }[] = [{ row: startRow, col: startCol }];
  const startKey = `${startRow}-${startCol}`;
  const endKey = `${endRow}-${endCol}`;
  visited.add(startKey);

  const dirs: Array<{
    dr: number;
    dc: number;
    wall: "top" | "bottom" | "left" | "right";
  }> = [
    { dr: -1, dc: 0, wall: "top" },
    { dr: 1, dc: 0, wall: "bottom" },
    { dr: 0, dc: -1, wall: "left" },
    { dr: 0, dc: 1, wall: "right" },
  ];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curKey = `${cur.row}-${cur.col}`;

    if (curKey === endKey) {
      // Reconstruct path
      const path: { row: number; col: number }[] = [];
      let k: string | undefined = endKey;
      while (k && k !== startKey) {
        const [r, c] = k.split("-").map(Number);
        path.unshift({ row: r, col: c });
        k = parent.get(k);
      }
      path.unshift({ row: startRow, col: startCol });
      return path;
    }

    for (const d of dirs) {
      if (maze[cur.row][cur.col].walls[d.wall]) continue;
      const nr = cur.row + d.dr;
      const nc = cur.col + d.dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const nk = `${nr}-${nc}`;
      if (visited.has(nk)) continue;
      visited.add(nk);
      parent.set(nk, curKey);
      queue.push({ row: nr, col: nc });
    }
  }

  return [];
}
