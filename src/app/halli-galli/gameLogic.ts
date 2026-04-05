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

export function createInitialState(): FullHalliState {
  const deck = createDeck();
  return {
    deck0: deck.slice(0, 28),
    deck1: deck.slice(28),
    discard0: [],
    discard1: [],
    activePlayer: 0,
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

function autoSkip(state: FullHalliState): FullHalliState {
  const active = state.activePlayer;
  const activeDeck = active === 0 ? state.deck0 : state.deck1;
  if (activeDeck.length > 0) return state;
  const otherDeck = active === 0 ? state.deck1 : state.deck0;
  if (otherDeck.length > 0) return { ...state, activePlayer: (1 - active) as 0 | 1 };
  return state;
}

export function applyFlip(state: FullHalliState, player: 0 | 1): FullHalliState {
  if (state.phase !== "playing" || state.activePlayer !== player) return state;
  const deckKey = player === 0 ? "deck0" : "deck1";
  const discardKey = player === 0 ? "discard0" : "discard1";
  const deck = [...state[deckKey]];
  if (deck.length === 0) return state;

  const card = deck.shift()!;
  return autoSkip({
    ...state,
    [deckKey]: deck,
    [discardKey]: [...state[discardKey], card],
    activePlayer: (1 - player) as 0 | 1,
    lastBell: null,
  });
}

export function applyBell(state: FullHalliState, ringer: 0 | 1): FullHalliState {
  if (state.phase !== "playing") return state;
  const valid = isBellValid(state);

  if (valid) {
    const won = shuffle([...state.discard0, ...state.discard1]);
    const newDeck0 = ringer === 0 ? [...state.deck0, ...won] : [...state.deck0];
    const newDeck1 = ringer === 1 ? [...state.deck1, ...won] : [...state.deck1];
    const loserEmpty = ringer === 0 ? newDeck1.length === 0 : newDeck0.length === 0;

    return autoSkip({
      ...state,
      deck0: newDeck0,
      deck1: newDeck1,
      discard0: [],
      discard1: [],
      activePlayer: ringer,
      phase: loserEmpty ? "game_over" : "playing",
      winner: loserEmpty ? ringer : null,
      lastBell: { valid: true, ringer },
    });
  } else {
    // Wrong bell: opponent wins all discard pile cards (same reward as correct bell)
    const opp = (1 - ringer) as 0 | 1;
    const won = shuffle([...state.discard0, ...state.discard1]);
    const newDeck0 = opp === 0 ? [...state.deck0, ...won] : [...state.deck0];
    const newDeck1 = opp === 1 ? [...state.deck1, ...won] : [...state.deck1];
    const ringerEmpty = ringer === 0 ? newDeck0.length === 0 : newDeck1.length === 0;

    return autoSkip({
      ...state,
      deck0: newDeck0,
      deck1: newDeck1,
      discard0: [],
      discard1: [],
      activePlayer: opp,
      phase: ringerEmpty ? "game_over" : "playing",
      winner: ringerEmpty ? opp : null,
      lastBell: { valid: false, ringer },
    });
  }
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
    isMyTurn: state.activePlayer === playerIndex,
    phase: state.phase,
    iWon: state.winner === null ? null : state.winner === playerIndex,
    lastBell: state.lastBell === null ? null : {
      valid: state.lastBell.valid,
      iWon: state.lastBell.ringer === playerIndex,
    },
  };
}

