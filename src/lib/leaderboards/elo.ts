export const K_NEW = 32;
export const K_VETERAN = 16;
export const STARTING_ELO = 1200;

export interface EloInput {
  winnerElo: number;
  loserElo: number;
  winnerMatches: number;
  loserMatches: number;
  wasTie: boolean;
}

export interface EloResult {
  winnerDelta: number;
  loserDelta: number;
}

function kFactor(matches: number): number {
  return matches < 30 ? K_NEW : K_VETERAN;
}

function expectedScore(myElo: number, theirElo: number): number {
  return 1 / (1 + Math.pow(10, (theirElo - myElo) / 400));
}

export function computeElo(input: EloInput): EloResult {
  const { winnerElo, loserElo, winnerMatches, loserMatches, wasTie } = input;
  const eW = expectedScore(winnerElo, loserElo);
  const eL = 1 - eW;
  const kW = kFactor(winnerMatches);
  const kL = kFactor(loserMatches);
  if (wasTie) {
    // Per-side K with score=0.5. Net is zero only when kW === kL; the asymmetry
    // is the documented price of letting newcomers gain faster on a draw.
    return {
      winnerDelta: Math.round(kW * (0.5 - eW)),
      loserDelta:  Math.round(kL * (0.5 - eL)),
    };
  }
  // Non-tie: zero-sum. Use winner's K to size the swing; loser mirrors.
  // Per-side K on non-ties would let total ELO drift up over time when newbies
  // beat veterans.
  const delta = Math.round(kW * (1 - eW));
  return { winnerDelta: delta, loserDelta: -delta };
}
