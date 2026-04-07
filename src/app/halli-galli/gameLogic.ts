import type { Fruit, FruitEntry, HalliCard, FullHalliState, HalliView } from "./types";

const FRUITS: Fruit[] = ["strawberry", "banana", "lemon", "plum"];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createDeck(): HalliCard[] {
  const cards: HalliCard[] = [];

  // Single-fruit cards: counts 1–5, 2 copies each → 40 cards
  for (const fruit of FRUITS) {
    for (let count = 1; count <= 5; count++) {
      const entry: FruitEntry = { fruit, count };
      cards.push({ fruits: [entry] });
      cards.push({ fruits: [entry] });
    }
  }

  // Mixed 2-fruit cards → 16 cards
  const pairs: [Fruit, Fruit][] = [
    ["strawberry", "banana"],
    ["strawberry", "lemon"],
    ["banana", "plum"],
    ["lemon", "plum"],
  ];
  for (const [f1, f2] of pairs) {
    cards.push({ fruits: [{ fruit: f1, count: 1 }, { fruit: f2, count: 2 }] });
    cards.push({ fruits: [{ fruit: f1, count: 2 }, { fruit: f2, count: 1 }] });
    cards.push({ fruits: [{ fruit: f1, count: 3 }, { fruit: f2, count: 1 }] });
    cards.push({ fruits: [{ fruit: f1, count: 1 }, { fruit: f2, count: 3 }] });
  }

  // Total: 56 cards → 28 per player
  return shuffle(cards);
}

export function createInitialState(targetScore = 50): FullHalliState {
  const deck = createDeck();
  return {
    deck0: deck.slice(0, 28),
    deck1: deck.slice(28),
    discard0: [],
    discard1: [],
    score0: 0,
    score1: 0,
    targetScore,
    nextFlipAt: Date.now() + 3000 + Math.floor(Math.random() * 2001),
    phase: "playing",
    winner: null,
    lastBell: null,
  };
}

// Last 2 cards from a discard pile: [slot1=older, slot2=newer]
function getSlots(discard: HalliCard[]): [HalliCard | null, HalliCard | null] {
  return [discard.at(-2) ?? null, discard.at(-1) ?? null];
}

// All currently visible cards (up to 4)
function visibleCards(state: FullHalliState): HalliCard[] {
  return [
    ...getSlots(state.discard0),
    ...getSlots(state.discard1),
  ].filter(Boolean) as HalliCard[];
}

export function isBellValid(state: FullHalliState): boolean {
  const cards = visibleCards(state);
  if (cards.length === 0) return false;

  const totals: Partial<Record<Fruit, number>> = {};
  for (const card of cards) {
    for (const { fruit, count } of card.fruits) {
      totals[fruit] = (totals[fruit] ?? 0) + count;
    }
  }
  return Object.values(totals).some(v => v === 5);
}

function recycleDeck(deck: HalliCard[], discard: HalliCard[]): { deck: HalliCard[]; discard: HalliCard[] } {
  if (deck.length > 0) return { deck, discard };
  // Reshuffle all discard except the last 2 visible cards back into deck
  if (discard.length <= 2) return { deck, discard };
  const keep = discard.slice(-2);
  const recycled = shuffle(discard.slice(0, -2));
  return { deck: recycled, discard: keep };
}

export function applyAutoFlip(state: FullHalliState): FullHalliState {
  if (state.phase !== "playing") return state;

  let { deck0, discard0, deck1, discard1 } = state;

  // Recycle if needed
  const r0 = recycleDeck([...deck0], [...discard0]);
  deck0 = r0.deck; discard0 = r0.discard;
  const r1 = recycleDeck([...deck1], [...discard1]);
  deck1 = r1.deck; discard1 = r1.discard;

  // Flip one card each (if available)
  if (deck0.length > 0) {
    const card = deck0.shift()!;
    discard0 = [...discard0, card];
  }
  if (deck1.length > 0) {
    const card = deck1.shift()!;
    discard1 = [...discard1, card];
  }

  return {
    ...state,
    deck0, discard0, deck1, discard1,
    nextFlipAt: Date.now() + 3000 + Math.floor(Math.random() * 2001),
    lastBell: null,
  };
}

export function applyBell(state: FullHalliState, ringer: 0 | 1): FullHalliState {
  if (state.phase !== "playing") return state;
  const valid = isBellValid(state);
  const cards = visibleCards(state);
  const points = cards.length;

  let { score0, score1 } = state;

  if (valid) {
    // Correct bell: ringer scores
    if (ringer === 0) score0 += points; else score1 += points;
  } else {
    // Invalid bell: OPPONENT scores (penalty to ringer)
    const opp = (1 - ringer) as 0 | 1;
    if (opp === 0) score0 += points; else score1 += points;
  }

  // Clear discards after bell
  const isOver = score0 >= state.targetScore || score1 >= state.targetScore;
  const winner = isOver ? (score0 >= state.targetScore ? 0 : 1) : null;

  return {
    ...state,
    score0, score1,
    discard0: [],
    discard1: [],
    phase: isOver ? "game_over" : "playing",
    winner,
    lastBell: { valid, ringer },
  };
}

export function createView(state: FullHalliState, playerIndex: 0 | 1): HalliView {
  const iAm0 = playerIndex === 0;
  const [my1, my2] = getSlots(iAm0 ? state.discard0 : state.discard1);
  const [opp1, opp2] = getSlots(iAm0 ? state.discard1 : state.discard0);

  return {
    mySlot1: my1,
    mySlot2: my2,
    myDeckCount: iAm0 ? state.deck0.length : state.deck1.length,
    oppSlot1: opp1,
    oppSlot2: opp2,
    oppDeckCount: iAm0 ? state.deck1.length : state.deck0.length,
    myScore: iAm0 ? state.score0 : state.score1,
    oppScore: iAm0 ? state.score1 : state.score0,
    targetScore: state.targetScore,
    nextFlipAt: state.nextFlipAt,
    phase: state.phase,
    iWon: state.winner === null ? null : state.winner === playerIndex,
    lastBell: state.lastBell === null ? null : {
      valid: state.lastBell.valid,
      iWon: state.lastBell.ringer === playerIndex,
    },
  };
}

