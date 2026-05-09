export interface Pair {
  winnerId: string;
  loserId: string;
  wasTie: boolean;
}

/**
 * positions[0] = 1st place; positions[N-1] = last.
 * Generates all C(N,2) pairs where the earlier-position player is the winner.
 */
export function positionsToPairs(positions: string[]): Pair[] {
  const out: Pair[] = [];
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      out.push({ winnerId: positions[i], loserId: positions[j], wasTie: false });
    }
  }
  return out;
}
