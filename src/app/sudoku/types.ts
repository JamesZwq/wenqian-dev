export type Difficulty = "easy" | "medium" | "hard";
export type GameMode = "menu" | "solo" | "p2p";
export type GameStatus = "idle" | "playing" | "complete";

export type SudokuPacket =
  | { type: "puzzle_sync"; puzzle: number[][]; solution: number[][]; difficulty: Difficulty; timestamp: number }
  | { type: "progress"; correct: number; timestamp: number }
  | { type: "game_complete"; time: number; timestamp: number }
  | { type: "new_game"; timestamp: number };

export type CellPos = { row: number; col: number };

// Number of given cells (clues) per difficulty
export const DIFFICULTY_CLUES: Record<Difficulty, number> = {
  easy: 40,
  medium: 32,
  hard: 25,
};
