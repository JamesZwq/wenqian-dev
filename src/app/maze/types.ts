import type { GameSettings } from "./SettingsPanel";
import type { ActiveEffect, ItemType, MazeItem } from "./items";
import type { Maze } from "./mazeGenerator";

export type Position = { row: number; col: number };
export type Trail = { row: number; col: number; timestamp: number; playerId: number };
export type RevealCell = { row: number; col: number; delay: number };
export type Direction = "up" | "down" | "left" | "right";

export type QueueMove = {
  playerId: 1 | 2;
  direction: Direction;
  source: "local" | "remote";
};

export type GameMode = "menu" | "single" | "local" | "remote";

export type MazePacket =
  | { type: "maze_sync"; maze: Maze; settings: GameSettings; goalPos: Position; timestamp: number }
  | { type: "bomb"; row: number; col: number; direction: Direction; timestamp: number }
  | { type: "move"; playerId: 1 | 2; direction: Direction; timestamp: number }
  | { type: "game_over"; winner: 1 | 2; elapsedTime: number; timestamp: number }
  | { type: "ping"; sentAt: number }
  | { type: "pong"; sentAt: number }
  | { type: "menu_exit"; timestamp: number }
  | { type: "item_spawn"; item: MazeItem; timestamp: number }
  | { type: "item_pickup"; itemId: string; playerId: 1 | 2; timestamp: number }
  | { type: "item_use"; playerId: 1 | 2; itemType: ItemType; timestamp: number }
  | { type: "item_effect"; effect: ActiveEffect; timestamp: number };

export const MOVE_DURATION = 0.07;
export const MOVE_UNLOCK_MS = 50;
export const INPUT_QUEUE_LIMIT = 12;

export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const milliseconds = Math.floor((ms % 1000) / 10);
  return `${seconds}.${milliseconds.toString().padStart(2, "0")}s`;
}
