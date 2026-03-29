import type { Operation, Question } from "./mathEngine";

export type GameMode = "menu" | "solo" | "p2p";

export type MathPacket =
  | { type: "config"; operations: Operation[]; totalQuestions: number; questions: Question[]; timestamp: number }
  | { type: "progress"; completed: number; timestamp: number }
  | { type: "finished"; totalTime: number; timestamp: number }
  | { type: "rematch"; timestamp: number };

export type GameResult = {
  totalTime: number;
  speed: number;
  totalQuestions: number;
};

export const ALL_OPS: { op: Operation; label: string }[] = [
  { op: "add", label: "+" },
  { op: "sub", label: "−" },
  { op: "mul", label: "×" },
  { op: "div", label: "÷" },
  { op: "mod", label: "%" },
];

export const OP_LABEL_MAP: Record<Operation, string> = {
  add: "+", sub: "−", mul: "×", div: "÷", mod: "%",
};

export const QUESTION_COUNTS = [10, 20, 50];

export function formatTime(ms: number): string {
  const secs = Math.floor(ms / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function opsLabel(ops: Operation[]): string {
  return ops.map(o => OP_LABEL_MAP[o]).join(" ");
}
