export type PlayerId = 1 | 2;
export type GameMode = "menu" | "single" | "remote";
export type Direction = "up" | "down" | "left" | "right";
export type PickupKind = "heal" | "rapid_fire" | "damage_boost" | "bullet_speed" | "speed_boost";

export type Vector2 = {
  x: number;
  y: number;
};

export type RectBody = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BuffInstance = {
  kind: PickupKind;
  expiresAt: number;
};

export type TankState = {
  id: string;
  playerId: PlayerId | 0;
  x: number;
  y: number;
  angle: number;
  turretAngle: number;
  hp: number;
  maxHp: number;
  radius: number;
  baseMoveSpeed: number;
  fireCooldownMs: number;
  fireCooldownRemaining: number;
  bulletSpeed: number;
  bulletDamage: number;
  speedMultiplier: number;
  alive: boolean;
  respawnInvulnerableMs: number;
  activeBuffs: BuffInstance[];
  damageBoostShotsLeft: number;
  team: "player" | "enemy";
};

export type BulletState = {
  id: string;
  ownerId: string;
  ownerPlayerId: PlayerId | 0;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  ttlMs: number;
};

export type PickupState = {
  id: string;
  kind: PickupKind;
  x: number;
  y: number;
  radius: number;
  ttlMs: number;
  pulse: number;
};

export type ExplosionState = {
  id: string;
  x: number;
  y: number;
  ttlMs: number;
  maxTtlMs: number;
  kind: "hit" | "pickup" | "blast";
};

export type GameInput = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
};

export type ArenaSnapshot = {
  tanks: TankState[];
  bullets: BulletState[];
  pickups: PickupState[];
  explosions: ExplosionState[];
  winner: PlayerId | null;
  elapsedMs: number;
  startedAt: number | null;
};

export type TankPacket =
  | { type: "match_start"; seed: number; snapshot: ArenaSnapshot; timestamp: number }
  | { type: "input"; playerId: PlayerId; input: GameInput; timestamp: number }
  | { type: "state"; snapshot: ArenaSnapshot; timestamp: number }
  | { type: "game_over"; winner: PlayerId; elapsedMs: number; timestamp: number }
  | { type: "ping"; sentAt: number }
  | { type: "pong"; sentAt: number }
  | { type: "menu_exit"; timestamp: number };
