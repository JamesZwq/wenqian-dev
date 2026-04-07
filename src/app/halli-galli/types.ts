export type Fruit = "strawberry" | "banana" | "lemon" | "plum";

export const FRUIT_EMOJI: Record<Fruit, string> = {
  strawberry: "🍓",
  banana: "🍌",
  lemon: "🍋",
  plum: "🍇",
};

export const FRUIT_COLOR: Record<Fruit, string> = {
  strawberry: "#ef4444",
  banana: "#eab308",
  lemon: "#84cc16",
  plum: "#a855f7",
};

export interface FruitEntry {
  fruit: Fruit;
  count: number;
}

// A card can show 1–3 different fruit types
export interface HalliCard {
  fruits: FruitEntry[];
}

export type GameMode = "menu" | "p2p";
export type GamePhase = "playing" | "game_over";

// Host's internal state
export interface FullHalliState {
  deck0: HalliCard[];
  deck1: HalliCard[];
  // Full flip history; last 2 from each are visible (slot1=older, slot2=newer)
  discard0: HalliCard[];
  discard1: HalliCard[];
  score0: number;
  score1: number;
  targetScore: number;
  nextFlipAt: number; // host clock timestamp for next auto-flip
  nextFlipper: 0 | 1; // whose card gets flipped next
  phase: GamePhase;
  winner: 0 | 1 | null;
  lastBell: { valid: boolean; ringer: 0 | 1 } | null;
}

// Perspective-relative view sent to each player
export interface HalliView {
  mySlot1: HalliCard | null;   // older visible card (position 1)
  mySlot2: HalliCard | null;   // newer visible card (position 2)
  myDeckCount: number;
  oppSlot1: HalliCard | null;
  oppSlot2: HalliCard | null;
  oppDeckCount: number;
  myScore: number;
  oppScore: number;
  targetScore: number;
  nextFlipAt: number;
  phase: GamePhase;
  iWon: boolean | null;
  lastBell: { valid: boolean; iWon: boolean } | null;
}

export type HalliPacket =
  | { type: "sync"; view: HalliView; timestamp: number }
  | { type: "bell"; sentAt: number }
  | { type: "rematch"; sentAt: number }
  | { type: "settings"; targetScore: number; sentAt: number }
  | { type: "ping"; sentAt: number }
  | { type: "pong"; sentAt: number };
