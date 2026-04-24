import type {
  DuelAction,
  DuelPlayerState,
  DuelView,
  FullDuelState,
  RoundOutcome,
} from "./types";

export const PLAN_DURATION_MS = 2200;
export const REVEAL_DURATION_MS = 1300;
export const FAST_REVEAL_MS = 420;
const STARTING_HP = 4;
const STARTING_STAMINA = 2;
const MAX_STAMINA = 5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function canUseAction(player: DuelPlayerState, action: DuelAction): boolean {
  if (action === "idle" || action === "charge") return true;
  if (action === "strike") return player.stamina >= 2;
  return player.stamina >= 1;
}

function applyStaminaDelta(player: DuelPlayerState, action: DuelAction, maxStamina: number): DuelPlayerState {
  if (action === "charge") {
    return { ...player, stamina: clamp(player.stamina + 1, 0, maxStamina) };
  }

  if (action === "strike") {
    return { ...player, stamina: clamp(player.stamina - 2, 0, maxStamina) };
  }

  if (action === "guard" || action === "break") {
    return { ...player, stamina: clamp(player.stamina - 1, 0, maxStamina) };
  }

  return player;
}

function computeRoundOutcome(
  roundNumber: number,
  action0: DuelAction,
  action1: DuelAction,
): RoundOutcome {
  let damageTo0 = 0;
  let damageTo1 = 0;

  if (action0 === "strike" && (action1 === "charge" || action1 === "idle" || action1 === "break")) {
    damageTo1 += 1;
  }
  if (action1 === "strike" && (action0 === "charge" || action0 === "idle" || action0 === "break")) {
    damageTo0 += 1;
  }
  if (action0 === "break" && action1 === "guard") {
    damageTo1 += 1;
  }
  if (action1 === "break" && action0 === "guard") {
    damageTo0 += 1;
  }

  return { roundNumber, action0, action1, damageTo0, damageTo1 };
}

function describePerspective(
  myAction: DuelAction,
  oppAction: DuelAction,
  damageTaken: number,
  damageDealt: number,
): string {
  if (damageDealt > 0 && damageTaken > 0) return "Both blades landed.";
  if (damageDealt > 0) {
    if (myAction === "strike") return "Your strike connected.";
    if (myAction === "break") return "Your break cracked the guard.";
    return "You found the opening.";
  }
  if (damageTaken > 0) {
    if (oppAction === "strike") return "Their strike caught you.";
    if (oppAction === "break") return "Their break punished your guard.";
    return "You lost the exchange.";
  }
  if (myAction === "strike" && oppAction === "strike") return "Blades clashed in the center.";
  if (myAction === "guard" && oppAction === "strike") return "You absorbed the strike.";
  if (myAction === "strike" && oppAction === "guard") return "Your strike hit the guard.";
  if (myAction === "break" && oppAction !== "guard") return "Your break whiffed.";
  if (myAction === "charge" && oppAction === "charge") return "Both sides powered up.";
  if (myAction === "idle" && oppAction === "idle") return "Both sides waited.";
  return "No clean opening this beat.";
}

function expediteRoundIfReady(state: FullDuelState, hostNow: number): FullDuelState {
  if (!state.selectedAction0 || !state.selectedAction1) return state;
  if (state.roundEndsAt <= hostNow + FAST_REVEAL_MS) return state;

  return {
    ...state,
    roundEndsAt: hostNow + FAST_REVEAL_MS,
  };
}

export function createInitialState(startAt: number): FullDuelState {
  return {
    players: [
      { hp: STARTING_HP, stamina: STARTING_STAMINA },
      { hp: STARTING_HP, stamina: STARTING_STAMINA },
    ],
    targetHp: STARTING_HP,
    maxStamina: MAX_STAMINA,
    roundNumber: 1,
    phase: "planning",
    roundStartsAt: startAt,
    roundEndsAt: startAt + PLAN_DURATION_MS,
    revealEndsAt: 0,
    selectedAction0: null,
    selectedAction1: null,
    winner: null,
    lastRound: null,
  };
}

export function lockAction(
  state: FullDuelState,
  playerIndex: 0 | 1,
  action: DuelAction,
  hostNow = Date.now(),
): FullDuelState {
  if (state.phase !== "planning") return state;
  if (hostNow < state.roundStartsAt) return state;
  if (hostNow > state.roundEndsAt) return state;

  const player = state.players[playerIndex];
  if (!canUseAction(player, action)) return state;

  if (playerIndex === 0) {
    if (state.selectedAction0) return state;
    return expediteRoundIfReady({ ...state, selectedAction0: action }, hostNow);
  }

  if (state.selectedAction1) return state;
  return expediteRoundIfReady({ ...state, selectedAction1: action }, hostNow);
}

export function resolveRound(state: FullDuelState, resolvedAt = Date.now()): FullDuelState {
  if (state.phase !== "planning") return state;

  const action0 = state.selectedAction0 ?? "idle";
  const action1 = state.selectedAction1 ?? "idle";
  const outcome = computeRoundOutcome(state.roundNumber, action0, action1);

  const nextPlayers: [DuelPlayerState, DuelPlayerState] = [
    applyStaminaDelta(state.players[0], action0, state.maxStamina),
    applyStaminaDelta(state.players[1], action1, state.maxStamina),
  ];

  nextPlayers[0] = {
    ...nextPlayers[0],
    hp: clamp(nextPlayers[0].hp - outcome.damageTo0, 0, state.targetHp),
  };
  nextPlayers[1] = {
    ...nextPlayers[1],
    hp: clamp(nextPlayers[1].hp - outcome.damageTo1, 0, state.targetHp),
  };

  let winner: FullDuelState["winner"] = null;
  if (nextPlayers[0].hp <= 0 && nextPlayers[1].hp <= 0) {
    winner = "draw";
  } else if (nextPlayers[0].hp <= 0) {
    winner = 1;
  } else if (nextPlayers[1].hp <= 0) {
    winner = 0;
  }

  return {
    ...state,
    players: nextPlayers,
    phase: winner ? "game_over" : "revealing",
    revealEndsAt: resolvedAt + REVEAL_DURATION_MS,
    selectedAction0: null,
    selectedAction1: null,
    winner,
    lastRound: outcome,
  };
}

export function startNextRound(state: FullDuelState, startAt = Date.now()): FullDuelState {
  if (state.phase === "game_over") return state;

  return {
    ...state,
    roundNumber: state.roundNumber + 1,
    phase: "planning",
    roundStartsAt: startAt,
    roundEndsAt: startAt + PLAN_DURATION_MS,
    revealEndsAt: 0,
    selectedAction0: null,
    selectedAction1: null,
  };
}

export function createView(state: FullDuelState, playerIndex: 0 | 1): DuelView {
  const my = state.players[playerIndex];
  const opp = state.players[(1 - playerIndex) as 0 | 1];
  const myAction = playerIndex === 0 ? state.selectedAction0 : state.selectedAction1;
  const oppLockedIn = playerIndex === 0 ? state.selectedAction1 !== null : state.selectedAction0 !== null;

  let lastRound: DuelView["lastRound"] = null;

  if (state.lastRound) {
    const resolvedMyAction = playerIndex === 0 ? state.lastRound.action0 : state.lastRound.action1;
    const resolvedOppAction = playerIndex === 0 ? state.lastRound.action1 : state.lastRound.action0;
    const damageTaken = playerIndex === 0 ? state.lastRound.damageTo0 : state.lastRound.damageTo1;
    const damageDealt = playerIndex === 0 ? state.lastRound.damageTo1 : state.lastRound.damageTo0;

    lastRound = {
      myAction: resolvedMyAction,
      oppAction: resolvedOppAction,
      damageDealt,
      damageTaken,
      summary: describePerspective(resolvedMyAction, resolvedOppAction, damageTaken, damageDealt),
    };
  }

  let result: DuelView["result"] = null;
  if (state.winner === "draw") {
    result = "draw";
  } else if (state.winner !== null) {
    result = state.winner === playerIndex ? "win" : "lose";
  }

  return {
    myHp: my.hp,
    oppHp: opp.hp,
    myStamina: my.stamina,
    oppStamina: opp.stamina,
    targetHp: state.targetHp,
    maxStamina: state.maxStamina,
    roundNumber: state.roundNumber,
    phase: state.phase,
    roundStartsAt: state.roundStartsAt,
    roundEndsAt: state.roundEndsAt,
    revealEndsAt: state.revealEndsAt,
    myLockedAction: myAction,
    oppLockedIn,
    lastRound,
    result,
  };
}
