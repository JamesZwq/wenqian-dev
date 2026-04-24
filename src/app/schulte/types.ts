export type GridSize = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type GameMode = "menu" | "solo" | "p2p";
export type GameStatus = "idle" | "playing" | "complete";

export const GRID_SIZES: GridSize[] = [3, 4, 5, 6, 7, 8, 9, 10];

export type SchultePacket =
  | { type: "puzzle_sync"; numbers: number[]; size: GridSize; timestamp: number }
  | { type: "progress"; target: number; timestamp: number }
  | { type: "game_complete"; time: number; timestamp: number }
  | { type: "new_game"; timestamp: number };
