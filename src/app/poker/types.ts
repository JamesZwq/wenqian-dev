export type Suit = "h" | "d" | "c" | "s";
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export interface Card { rank: Rank; suit: Suit }

export type Phase = "waiting" | "preflop" | "flop" | "turn" | "river" | "showdown";
export type ActionType = "fold" | "check" | "call" | "raise" | "allin";
export type GameMode = "menu" | "p2p";

export interface PlayerState {
  chips: number;
  bet: number;
  cards: Card[];
  folded: boolean;
  allIn: boolean;
}

export interface FullGameState {
  phase: Phase;
  players: [PlayerState, PlayerState];
  community: Card[];
  pot: number;
  dealerIndex: 0 | 1;
  activeIndex: 0 | 1;
  handNumber: number;
  deck: Card[];
  lastAction?: { playerIndex: 0 | 1; action: ActionType; amount: number };
  result?: { winnerIndex: 0 | 1 | -1; winnerHand: string; hands: [string, string]; bestCards: [Card[], Card[]] };
  hasActedThisRound: [boolean, boolean];
}

export interface PlayerView {
  phase: Phase;
  myCards: Card[];
  opponentCards: Card[] | null;
  community: Card[];
  pot: number;
  myChips: number;
  opponentChips: number;
  myBet: number;
  opponentBet: number;
  myFolded: boolean;
  opponentFolded: boolean;
  myAllIn: boolean;
  opponentAllIn: boolean;
  isMyTurn: boolean;
  amDealer: boolean;
  handNumber: number;
  smallBlind: number;
  bigBlind: number;
  lastAction?: { isMe: boolean; action: ActionType; amount: number };
  result?: {
    iWon: boolean | null;
    winnerHand: string;
    myHandDesc: string;
    opponentHandDesc: string;
    myBestCards: Card[];
    opponentBestCards: Card[];
  };
}

export type PokerPacket =
  | { type: "sync"; view: PlayerView; timestamp: number }
  | { type: "action"; action: ActionType; amount: number; timestamp: number }
  | { type: "next_hand"; timestamp: number }
  | { type: "rematch"; timestamp: number }
  | { type: "ping"; sentAt: number }
  | { type: "pong"; sentAt: number };
