export type Player = "black" | "white";
export type CellState = Player | null;
export type GameStatus = "waiting" | "playing" | "won" | "draw";
export type GameMode = "menu" | "ai" | "p2p";
export type AIDifficulty = "easy" | "medium" | "hard";

export type GamePacket =
  | { type: "move"; row: number; col: number; timestamp: number }
  | { type: "reset"; timestamp: number }
  | { type: "ping"; sentAt: number }
  | { type: "pong"; sentAt: number };

export type GameState = {
  board: CellState[][];
  currentPlayer: Player;
  status: GameStatus;
  winner: Player | null;
  winningLine: number[][];
};

export type Stats = {
  blackWins: number;
  whiteWins: number;
  draws: number;
};

export const BOARD_SIZE = 15;
export const STAR_POINTS = [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]];
export const BOARD_PADDING = 10;

export function createEmptyBoard(): CellState[][] {
  return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
}
