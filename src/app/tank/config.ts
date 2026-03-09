import type { PickupKind, RectBody, Vector2 } from "./types";

export const ARENA_WIDTH = 1600;
export const ARENA_HEIGHT = 900;
export const MAX_HP = 3;
export const PLAYER_RADIUS = 28;
export const BULLET_RADIUS = 6;
export const PLAYER_MOVE_SPEED = 270;
export const BOT_MOVE_SPEED = 230;
export const PLAYER_FIRE_COOLDOWN_MS = 460;
export const BOT_FIRE_COOLDOWN_MS = 760;
export const PLAYER_BULLET_SPEED = 640;
export const BOT_BULLET_SPEED = 540;
export const BULLET_TTL_MS = 1800;
export const PICKUP_SPAWN_INTERVAL_MS = 5000;
export const PICKUP_TTL_MS = 12000;
export const SNAPSHOT_INTERVAL_MS = 50;
export const BOT_COUNT = 4;

export const WALLS: RectBody[] = [
  { x: 250, y: 180, width: 220, height: 40 },
  { x: 1130, y: 180, width: 220, height: 40 },
  { x: 250, y: 680, width: 220, height: 40 },
  { x: 1130, y: 680, width: 220, height: 40 },
  { x: 720, y: 160, width: 160, height: 70 },
  { x: 720, y: 670, width: 160, height: 70 },
  { x: 510, y: 370, width: 120, height: 140 },
  { x: 970, y: 370, width: 120, height: 140 },
  { x: 720, y: 365, width: 160, height: 150 },
];

export const PLAYER_SPAWNS: Record<1 | 2, Vector2> = {
  1: { x: 180, y: 450 },
  2: { x: 1420, y: 450 },
};

export const BOT_SPAWNS: Vector2[] = [
  { x: 1320, y: 220 },
  { x: 1320, y: 680 },
  { x: 980, y: 120 },
  { x: 980, y: 780 },
  { x: 1280, y: 450 },
];

export const PICKUP_KINDS: PickupKind[] = [
  "heal",
  "rapid_fire",
  "damage_boost",
  "bullet_speed",
  "speed_boost",
];

export const PICKUP_COLORS: Record<PickupKind, string> = {
  heal: "#4ade80",
  rapid_fire: "#60a5fa",
  damage_boost: "#f97316",
  bullet_speed: "#a78bfa",
  speed_boost: "#facc15",
};

export const PICKUP_LABELS: Record<PickupKind, string> = {
  heal: "HEAL",
  rapid_fire: "RAPID",
  damage_boost: "DMG",
  bullet_speed: "VELOCITY",
  speed_boost: "BOOST",
};
