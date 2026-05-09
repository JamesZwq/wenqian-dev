import { describe, it, expect } from "vitest";
import { positionsToPairs } from "@/lib/leaderboards/pairwise";

describe("positionsToPairs", () => {
  it("2-player: produces a single pair", () => {
    expect(positionsToPairs(["a", "b"])).toEqual([
      { winnerId: "a", loserId: "b", wasTie: false },
    ]);
  });

  it("3-player: produces 3 pairs", () => {
    expect(positionsToPairs(["a", "b", "c"])).toEqual([
      { winnerId: "a", loserId: "b", wasTie: false },
      { winnerId: "a", loserId: "c", wasTie: false },
      { winnerId: "b", loserId: "c", wasTie: false },
    ]);
  });

  it("4-player produces 6 pairs", () => {
    expect(positionsToPairs(["a", "b", "c", "d"]).length).toBe(6);
  });

  it("6-player produces 15 pairs", () => {
    expect(positionsToPairs(["a", "b", "c", "d", "e", "f"]).length).toBe(15);
  });

  it("position determines win: earlier index wins", () => {
    const pairs = positionsToPairs(["winner", "second", "third"]);
    expect(pairs[0]).toEqual({ winnerId: "winner", loserId: "second", wasTie: false });
    expect(pairs[1]).toEqual({ winnerId: "winner", loserId: "third", wasTie: false });
    expect(pairs[2]).toEqual({ winnerId: "second", loserId: "third", wasTie: false });
  });

  it("returns empty array for 0 or 1 player", () => {
    expect(positionsToPairs([])).toEqual([]);
    expect(positionsToPairs(["solo"])).toEqual([]);
  });
});
