import { calcEquity, type EquityResult } from "./equity";
import type { Card } from "./types";

export type EquityWorkerRequest = {
  id: "quick" | "full";
  myCards: Card[];
  community: Card[];
};

export type EquityWorkerResponse =
  | { id: "quick"; winPct: number }
  | { id: "full"; result: EquityResult };

self.onmessage = (e: MessageEvent<EquityWorkerRequest>) => {
  const { id, myCards, community } = e.data;
  const result = calcEquity(myCards, community);
  if (id === "quick") {
    self.postMessage({ id: "quick", winPct: result.winPct } satisfies EquityWorkerResponse);
  } else {
    self.postMessage({ id: "full", result } satisfies EquityWorkerResponse);
  }
};
