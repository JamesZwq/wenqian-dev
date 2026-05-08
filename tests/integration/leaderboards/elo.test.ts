import { describe, it, expect } from "vitest";
import { computeElo, K_NEW, K_VETERAN } from "@/lib/leaderboards/elo";

describe("computeElo", () => {
  it("equal-rated win: ±16 with K=32", () => {
    const r = computeElo({
      winnerElo: 1200, loserElo: 1200,
      winnerMatches: 0, loserMatches: 0,
      wasTie: false,
    });
    expect(r.winnerDelta).toBe(16);
    expect(r.loserDelta).toBe(-16);
  });

  it("favourite beats long-shot: small swing", () => {
    const r = computeElo({
      winnerElo: 1500, loserElo: 1200,
      winnerMatches: 50, loserMatches: 50,
      wasTie: false,
    });
    expect(r.winnerDelta).toBeGreaterThan(0);
    expect(r.winnerDelta).toBeLessThan(8);
    expect(r.loserDelta).toBe(-r.winnerDelta);
  });

  it("upset: long-shot beats favourite — big swing", () => {
    const r = computeElo({
      winnerElo: 1200, loserElo: 1500,
      winnerMatches: 50, loserMatches: 50,
      wasTie: false,
    });
    expect(r.winnerDelta).toBeGreaterThan(10);
    expect(r.loserDelta).toBe(-r.winnerDelta);
  });

  it("uses K=32 for first 30 matches per side", () => {
    expect(K_NEW).toBe(32);
    expect(K_VETERAN).toBe(16);
    const newcomer = computeElo({
      winnerElo: 1200, loserElo: 1200,
      winnerMatches: 0, loserMatches: 100,
      wasTie: false,
    });
    expect(newcomer.winnerDelta).toBe(16);
    expect(newcomer.loserDelta).toBe(-16);
  });

  it("tie — higher-rated side loses, lower-rated gains", () => {
    const r = computeElo({
      winnerElo: 1500, loserElo: 1200,
      winnerMatches: 50, loserMatches: 50,
      wasTie: true,
    });
    expect(r.winnerDelta).toBeLessThan(0);
    expect(r.loserDelta).toBeGreaterThan(0);
  });

  it("zero-sum (non-tie): winnerDelta + loserDelta = 0", () => {
    for (const winnerElo of [1000, 1200, 1500, 1800]) {
      for (const loserElo of [1000, 1200, 1500, 1800]) {
        const r = computeElo({
          winnerElo, loserElo,
          winnerMatches: 50, loserMatches: 50,
          wasTie: false,
        });
        expect(r.winnerDelta + r.loserDelta).toBe(0);
      }
    }
  });
});
