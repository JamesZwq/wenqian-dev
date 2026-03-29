import type { BlockPuzzle, Difficulty } from "./flashCountEngine";

export type GameMode = "menu" | "solo" | "p2p";
export type GamePhase = "flash" | "answer" | "reveal" | "done";

export type FlashPacket =
  | { type: "config"; difficulty: Difficulty; totalQuestions: number; puzzles: BlockPuzzle[]; timestamp: number }
  | { type: "answer"; questionIndex: number; value: number; timestamp: number }
  | { type: "question_result"; questionIndex: number; p1Answer: number; p2Answer: number; correct: number; timestamp: number }
  | { type: "rematch"; timestamp: number }
  | { type: "settings_preview"; difficulty: Difficulty; totalQuestions: number; timestamp: number };

export type QuestionResult = {
  myAnswer: number;
  opponentAnswer: number;
  correct: number;
  myCorrect: boolean;
  opponentCorrect: boolean;
};

export type GameResult = {
  myScore: number;
  opponentScore: number;
  totalQuestions: number;
};

export type SoloResult = {
  totalTime: number;
  speed: number;
  totalQuestions: number;
};

export const DIFFICULTIES: { key: Difficulty; label: string }[] = [
  { key: "easy", label: "EASY" },
  { key: "medium", label: "MEDIUM" },
  { key: "hard", label: "HARD" },
];

export const QUESTION_COUNTS = [10, 20, 50];
export const TILE_W = 40;
export const TILE_H = 20;

export function formatTime(ms: number): string {
  const secs = Math.floor(ms / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
