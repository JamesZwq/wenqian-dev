export type GridSize = 3 | 4 | 5;
export type GameMode = "menu" | "solo" | "p2p";
export type GameStatus = "idle" | "playing" | "complete";

// A cell is either a number or a letter, encoded as a string in the shuffled array
// e.g., ["1","A","2","B","3","C",...] before shuffling
export type CellValue = string;

export const GRID_SIZES: GridSize[] = [3, 4, 5];

// Generate the full ordered target sequence for a grid size.
// 3x3 → ["1","A","2","B","3","C","4","D","5"]
// 4x4 → ["1","A","2","B","3","C","4","D","5","E","6","F","7","G","8","H"]
// 5x5 → ["1","A","2","B",...,"12","L","13"]
export function targetSequence(size: GridSize): string[] {
  const N = size * size;
  const numCount = Math.ceil(N / 2);
  const letterCount = N - numCount;
  const seq: string[] = [];
  for (let i = 0; i < numCount; i++) {
    seq.push(String(i + 1));
    if (i < letterCount) seq.push(String.fromCharCode(65 + i));
  }
  return seq;
}

export type TrailPacket =
  | { type: "puzzle_sync"; cells: string[]; size: GridSize; timestamp: number }
  | { type: "progress"; targetIndex: number; timestamp: number }
  | { type: "game_complete"; time: number; timestamp: number }
  | { type: "new_game"; timestamp: number };
