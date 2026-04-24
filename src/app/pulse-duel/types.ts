export type GameMode = "menu" | "p2p";
export type DuelPhase = "planning" | "revealing" | "game_over";
export type DuelAction = "idle" | "charge" | "strike" | "guard" | "break";
export type DuelWinner = 0 | 1 | "draw" | null;

export interface DuelPlayerState {
  hp: number;
  stamina: number;
}

export interface RoundOutcome {
  roundNumber: number;
  action0: DuelAction;
  action1: DuelAction;
  damageTo0: number;
  damageTo1: number;
}

export interface FullDuelState {
  players: [DuelPlayerState, DuelPlayerState];
  targetHp: number;
  maxStamina: number;
  roundNumber: number;
  phase: DuelPhase;
  roundStartsAt: number;
  roundEndsAt: number;
  revealEndsAt: number;
  selectedAction0: DuelAction | null;
  selectedAction1: DuelAction | null;
  winner: DuelWinner;
  lastRound: RoundOutcome | null;
}

export interface DuelView {
  myHp: number;
  oppHp: number;
  myStamina: number;
  oppStamina: number;
  targetHp: number;
  maxStamina: number;
  roundNumber: number;
  phase: DuelPhase;
  roundStartsAt: number;
  roundEndsAt: number;
  revealEndsAt: number;
  myLockedAction: DuelAction | null;
  oppLockedIn: boolean;
  lastRound: {
    myAction: DuelAction;
    oppAction: DuelAction;
    damageDealt: number;
    damageTaken: number;
    summary: string;
  } | null;
  result: "win" | "lose" | "draw" | null;
}

export type DuelPacket =
  | { type: "sync"; view: DuelView; hostSentAt: number }
  | {
      type: "action";
      roundNumber: number;
      action: DuelAction;
      claimedHostPressAt: number;
      sentAt: number;
    }
  | { type: "rematch"; sentAt: number }
  | { type: "ping"; sentAt: number; senderNow: number }
  | { type: "pong"; echoSentAt: number; responderNow: number };

export const ACTION_LABEL: Record<DuelAction, string> = {
  idle: "IDLE",
  charge: "CHARGE",
  strike: "STRIKE",
  guard: "GUARD",
  break: "BREAK",
};

export const ACTION_COST: Record<DuelAction, number> = {
  idle: 0,
  charge: 0,
  strike: 2,
  guard: 1,
  break: 1,
};

export const ACTION_DESCRIPTION: Record<Exclude<DuelAction, "idle">, string> = {
  charge: "+1 stamina. Open to strikes.",
  strike: "2 stamina. Cuts through charge and break.",
  guard: "1 stamina. Stops a strike.",
  break: "1 stamina. Punishes guard.",
};

export const ACTION_ACCENT: Record<DuelAction, string> = {
  idle: "#94a3b8",
  charge: "#22c55e",
  strike: "#ef4444",
  guard: "#06b6d4",
  break: "#f59e0b",
};
