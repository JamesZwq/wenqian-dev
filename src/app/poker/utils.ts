import type { Card, Rank, Suit, FullGameState, PlayerView, PlayerState } from "./types";

// ── Deck ──

export function createDeck(): Card[] {
  const suits: Suit[] = ["h", "d", "c", "s"];
  const ranks: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  const deck: Card[] = [];
  for (const suit of suits) for (const rank of ranks) deck.push({ rank, suit });
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// ── Hand evaluation ──

type HandValue = number[];

function evaluate5(cards: Card[]): { value: HandValue; name: string } {
  const ranks = cards.map(c => c.rank).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const isFlush = suits.every(s => s === suits[0]);

  let isStraight = false, straightHigh = 0;
  if (ranks[0] - ranks[4] === 4 && new Set(ranks).size === 5) {
    isStraight = true; straightHigh = ranks[0];
  }
  if (ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2) {
    isStraight = true; straightHigh = 5;
  }

  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) || 0) + 1);
  const groups = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const pat = groups.map(g => g[1]);

  if (isStraight && isFlush) return { value: [8, straightHigh], name: straightHigh === 14 ? "Royal Flush" : "Straight Flush" };
  if (pat[0] === 4) return { value: [7, groups[0][0], groups[1][0]], name: "Four of a Kind" };
  if (pat[0] === 3 && pat[1] === 2) return { value: [6, groups[0][0], groups[1][0]], name: "Full House" };
  if (isFlush) return { value: [5, ...ranks], name: "Flush" };
  if (isStraight) return { value: [4, straightHigh], name: "Straight" };
  if (pat[0] === 3) return { value: [3, groups[0][0], groups[1][0], groups[2][0]], name: "Three of a Kind" };
  if (pat[0] === 2 && pat[1] === 2) {
    const hi = Math.max(groups[0][0], groups[1][0]), lo = Math.min(groups[0][0], groups[1][0]);
    return { value: [2, hi, lo, groups[2][0]], name: "Two Pair" };
  }
  if (pat[0] === 2) return { value: [1, groups[0][0], groups[1][0], groups[2][0], groups[3][0]], name: "One Pair" };
  return { value: [0, ...ranks], name: "High Card" };
}

export function evaluateHand(hole: Card[], community: Card[]): { value: HandValue; name: string; bestCards: Card[] } {
  const all = [...hole, ...community];
  let best: { value: HandValue; name: string; bestCards: Card[] } | null = null;
  const n = all.length;
  for (let i = 0; i < n - 4; i++)
    for (let j = i + 1; j < n - 3; j++)
      for (let k = j + 1; k < n - 2; k++)
        for (let l = k + 1; l < n - 1; l++)
          for (let m = l + 1; m < n; m++) {
            const combo = [all[i], all[j], all[k], all[l], all[m]];
            const r = evaluate5(combo);
            if (!best || compareHands(r.value, best.value) > 0) best = { ...r, bestCards: combo };
          }
  return best!;
}

export function cardEq(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

export function isInBestHand(card: Card, bestCards: Card[]): boolean {
  return bestCards.some(bc => cardEq(bc, card));
}

export function compareHands(a: HandValue, b: HandValue): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
  }
  return 0;
}

// ── Blind level ──

export function getBlindLevel(handNumber: number): number {
  return Math.pow(2, Math.floor((handNumber - 1) / 5));
}

// ── Display helpers ──

export function rankStr(r: Rank): string {
  if (r === 14) return "A"; if (r === 13) return "K"; if (r === 12) return "Q"; if (r === 11) return "J";
  return String(r);
}
export function suitSymbol(s: Suit): string {
  return s === "h" ? "♥" : s === "d" ? "♦" : s === "c" ? "♣" : "♠";
}
export function suitColor(s: Suit): string {
  return s === "h" || s === "d" ? "#ef4444" : "#1e293b";
}
export function cardStr(c: Card): string { return `${rankStr(c.rank)}${suitSymbol(c.suit)}`; }

// ── Game state management ──

function cloneState(s: FullGameState): FullGameState {
  return {
    ...s,
    players: [{ ...s.players[0], cards: [...s.players[0].cards] }, { ...s.players[1], cards: [...s.players[1].cards] }],
    community: [...s.community],
    deck: [...s.deck],
    hasActedThisRound: [...s.hasActedThisRound] as [boolean, boolean],
  };
}

function advancePhase(s: FullGameState): void {
  s.pot += s.players[0].bet + s.players[1].bet;
  s.players[0].bet = 0;
  s.players[1].bet = 0;
  s.hasActedThisRound = [false, false];

  if (s.players[0].allIn || s.players[1].allIn) {
    while (s.community.length < 5) s.community.push(s.deck.pop()!);
    resolveShowdown(s);
    return;
  }

  const nd = (1 - s.dealerIndex) as 0 | 1;
  switch (s.phase) {
    case "preflop":
      s.phase = "flop";
      s.community.push(s.deck.pop()!, s.deck.pop()!, s.deck.pop()!);
      s.activeIndex = nd;
      break;
    case "flop":
      s.phase = "turn";
      s.community.push(s.deck.pop()!);
      s.activeIndex = nd;
      break;
    case "turn":
      s.phase = "river";
      s.community.push(s.deck.pop()!);
      s.activeIndex = nd;
      break;
    case "river":
      resolveShowdown(s);
      break;
  }
}

function resolveShowdown(s: FullGameState): void {
  s.phase = "showdown";
  const h0 = evaluateHand(s.players[0].cards, s.community);
  const h1 = evaluateHand(s.players[1].cards, s.community);
  const cmp = compareHands(h0.value, h1.value);
  const bc: [Card[], Card[]] = [h0.bestCards, h1.bestCards];

  if (cmp > 0) {
    s.players[0].chips += s.pot;
    s.result = { winnerIndex: 0, winnerHand: h0.name, hands: [h0.name, h1.name], bestCards: bc };
  } else if (cmp < 0) {
    s.players[1].chips += s.pot;
    s.result = { winnerIndex: 1, winnerHand: h1.name, hands: [h0.name, h1.name], bestCards: bc };
  } else {
    const half = Math.floor(s.pot / 2);
    s.players[0].chips += half;
    s.players[1].chips += s.pot - half;
    s.result = { winnerIndex: -1, winnerHand: h0.name, hands: [h0.name, h1.name], bestCards: bc };
  }
  s.pot = 0;
}

export function createNewHand(handNumber: number, dealerIndex: 0 | 1, chips: [number, number]): FullGameState {
  const deck = shuffleDeck(createDeck());
  const sb = getBlindLevel(handNumber);
  const bb = sb * 2;
  const nd = (1 - dealerIndex) as 0 | 1;

  const players: [PlayerState, PlayerState] = [
    { chips: chips[0], bet: 0, cards: [], folded: false, allIn: false },
    { chips: chips[1], bet: 0, cards: [], folded: false, allIn: false },
  ];

  // Post blinds
  const sbAmt = Math.min(sb, players[dealerIndex].chips);
  players[dealerIndex].chips -= sbAmt;
  players[dealerIndex].bet = sbAmt;
  if (players[dealerIndex].chips === 0) players[dealerIndex].allIn = true;

  const bbAmt = Math.min(bb, players[nd].chips);
  players[nd].chips -= bbAmt;
  players[nd].bet = bbAmt;
  if (players[nd].chips === 0) players[nd].allIn = true;

  // Deal hole cards
  players[0].cards = [deck.pop()!, deck.pop()!];
  players[1].cards = [deck.pop()!, deck.pop()!];

  const state: FullGameState = {
    phase: "preflop",
    players,
    community: [],
    pot: 0,
    dealerIndex,
    activeIndex: dealerIndex, // heads-up: dealer/SB acts first preflop
    handNumber,
    deck,
    hasActedThisRound: [false, false],
  };

  // Handle all-in from blinds
  if (players[0].allIn && players[1].allIn) {
    state.community = [deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!];
    state.pot = players[0].bet + players[1].bet;
    players[0].bet = 0;
    players[1].bet = 0;
    resolveShowdown(state);
  } else if (players[state.activeIndex].allIn) {
    state.activeIndex = (1 - state.activeIndex) as 0 | 1;
  }

  return state;
}

export function processAction(
  prev: FullGameState, playerIndex: 0 | 1, action: string, amount: number,
): FullGameState {
  if (prev.activeIndex !== playerIndex || prev.phase === "waiting" || prev.phase === "showdown") return prev;

  const s = cloneState(prev);
  const pi = playerIndex, oi = (1 - pi) as 0 | 1;
  const me = s.players[pi], opp = s.players[oi];

  switch (action) {
    case "fold": {
      me.folded = true;
      const total = s.pot + me.bet + opp.bet;
      opp.chips += total;
      s.pot = 0; me.bet = 0; opp.bet = 0;
      s.phase = "showdown";
      s.result = { winnerIndex: oi, winnerHand: "Fold", hands: ["", ""], bestCards: [[], []] };
      break;
    }
    case "check": {
      if (opp.bet > me.bet) return prev;
      s.hasActedThisRound[pi] = true;
      if (s.hasActedThisRound[oi]) advancePhase(s);
      else s.activeIndex = oi;
      break;
    }
    case "call": {
      const toCall = opp.bet - me.bet;
      if (toCall <= 0) return prev;
      const actual = Math.min(toCall, me.chips);
      me.chips -= actual; me.bet += actual;
      if (me.chips === 0) me.allIn = true;
      s.hasActedThisRound[pi] = true;
      if (s.hasActedThisRound[oi] || opp.allIn) advancePhase(s);
      else s.activeIndex = oi;
      break;
    }
    case "raise": {
      const additional = amount - me.bet;
      if (additional <= 0 || additional > me.chips) return prev;
      me.chips -= additional; me.bet = amount;
      if (me.chips === 0) me.allIn = true;
      s.hasActedThisRound[pi] = true;
      s.hasActedThisRound[oi] = false;
      s.activeIndex = oi;
      break;
    }
    case "allin": {
      const allIn = me.chips;
      me.bet += allIn; me.chips = 0; me.allIn = true;
      s.hasActedThisRound[pi] = true;
      if (me.bet > opp.bet && !opp.allIn) {
        s.hasActedThisRound[oi] = false;
        s.activeIndex = oi;
      } else {
        if (s.hasActedThisRound[oi] || opp.allIn) advancePhase(s);
        else s.activeIndex = oi;
      }
      break;
    }
    default: return prev;
  }

  s.lastAction = { playerIndex: pi, action: action as NonNullable<FullGameState["lastAction"]>["action"], amount };
  return s;
}

// ── Player view ──

export function createPlayerView(state: FullGameState, playerIndex: 0 | 1): PlayerView {
  const oi = (1 - playerIndex) as 0 | 1;
  const me = state.players[playerIndex], opp = state.players[oi];
  const sb = getBlindLevel(state.handNumber);
  const showCards = state.phase === "showdown" && !me.folded && !opp.folded;

  const view: PlayerView = {
    phase: state.phase,
    myCards: me.cards,
    opponentCards: showCards ? opp.cards : null,
    community: state.community,
    pot: state.pot,
    myChips: me.chips,
    opponentChips: opp.chips,
    myBet: me.bet,
    opponentBet: opp.bet,
    myFolded: me.folded,
    opponentFolded: opp.folded,
    myAllIn: me.allIn,
    opponentAllIn: opp.allIn,
    isMyTurn: state.activeIndex === playerIndex && state.phase !== "showdown" && state.phase !== "waiting",
    amDealer: state.dealerIndex === playerIndex,
    handNumber: state.handNumber,
    smallBlind: sb,
    bigBlind: sb * 2,
  };

  if (state.lastAction) {
    view.lastAction = { isMe: state.lastAction.playerIndex === playerIndex, action: state.lastAction.action, amount: state.lastAction.amount };
  }

  if (state.result) {
    const myH = me.cards.length >= 2 && state.community.length >= 3 ? evaluateHand(me.cards, state.community) : null;
    const oppH = opp.cards.length >= 2 && state.community.length >= 3 ? evaluateHand(opp.cards, state.community) : null;
    view.result = {
      iWon: state.result.winnerIndex === -1 ? null : state.result.winnerIndex === playerIndex,
      winnerHand: state.result.winnerHand,
      myHandDesc: myH?.name ?? "",
      opponentHandDesc: oppH?.name ?? "",
      myBestCards: state.result.bestCards ? state.result.bestCards[playerIndex] : [],
      opponentBestCards: state.result.bestCards ? state.result.bestCards[oi] : [],
    };
  }

  return view;
}

// ── Available actions ──

export function getActions(v: PlayerView) {
  if (!v.isMyTurn) return null;
  const toCall = Math.max(0, v.opponentBet - v.myBet);
  const callAmt = Math.min(toCall, v.myChips);
  const minRaiseTo = v.opponentBet + v.bigBlind;
  const maxRaiseTo = v.myBet + v.myChips;
  return {
    canCheck: toCall === 0,
    canCall: toCall > 0,
    callAmount: callAmt,
    callIsAllIn: toCall > 0 && callAmt >= v.myChips,
    canRaise: v.myChips > toCall && minRaiseTo <= maxRaiseTo,
    minRaiseTo: Math.min(minRaiseTo, maxRaiseTo),
    maxRaiseTo,
  };
}

// ── Monte Carlo equity simulation ──

const HAND_TYPE_LABELS = [
  "High Card", "One Pair", "Two Pair", "Three of a Kind",
  "Straight", "Flush", "Full House", "Four of a Kind", "Straight Flush",
] as const;

export interface EquityResult {
  winPct: number;
  losePct: number;
  tiePct: number;
  handDist: { name: string; pct: number }[];
  samples: number;
}

/** Pick n random elements from arr without replacement (partial Fisher-Yates) */
function pickN(arr: Card[], n: number): Card[] {
  const len = arr.length;
  const idx = new Array<number>(len);
  for (let i = 0; i < len; i++) idx[i] = i;
  const res: Card[] = [];
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (len - i));
    const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp;
    res.push(arr[idx[i]]);
  }
  return res;
}

/**
 * Estimate win/lose/tie equity and hand-type distribution via Monte Carlo.
 * Assumes opponent's hole cards are unknown; deals random opponents from the
 * remaining deck and fills in any missing community cards.
 */
export function simulateEquity(myCards: Card[], community: Card[], samples = 3000): EquityResult {
  const knownSet = new Set([...myCards, ...community].map(c => `${c.rank}.${c.suit}`));
  const remaining = createDeck().filter(c => !knownSet.has(`${c.rank}.${c.suit}`));
  const commNeeded = 5 - community.length;
  const pickCount = 2 + commNeeded; // 2 opponent + remaining community

  let wins = 0, losses = 0, ties = 0;
  const handCounts = new Array(9).fill(0) as number[];

  for (let s = 0; s < samples; s++) {
    const picked = pickN(remaining, pickCount);
    const oppCards = [picked[0], picked[1]];
    const fullComm = commNeeded > 0
      ? [...community, ...picked.slice(2, 2 + commNeeded)]
      : community;

    const myHand = evaluateHand(myCards, fullComm);
    const oppHand = evaluateHand(oppCards, fullComm);

    handCounts[myHand.value[0]]++;

    const cmp = compareHands(myHand.value, oppHand.value);
    if (cmp > 0) wins++;
    else if (cmp < 0) losses++;
    else ties++;
  }

  return {
    winPct: (wins / samples) * 100,
    losePct: (losses / samples) * 100,
    tiePct: (ties / samples) * 100,
    handDist: HAND_TYPE_LABELS.map((name, i) => ({
      name,
      pct: (handCounts[i] / samples) * 100,
    })).reverse(), // best hands first
    samples,
  };
}
