import { describe, it, expect } from "vitest";
import { withinBounds } from "@/lib/leaderboards/bounds";

describe("withinBounds", () => {
  it("rejects sub-3-second schulte", () => {
    expect(withinBounds("schulte", "time_ms", 2999)).toBe(false);
    expect(withinBounds("schulte", "time_ms", 3000)).toBe(true);
  });

  it("rejects schulte > 10 minutes", () => {
    expect(withinBounds("schulte", "time_ms", 600001)).toBe(false);
    expect(withinBounds("schulte", "time_ms", 600000)).toBe(true);
  });

  it("rejects sub-100-ms reaction (anticipation)", () => {
    expect(withinBounds("reaction", "time_ms", 99)).toBe(false);
    expect(withinBounds("reaction", "time_ms", 100)).toBe(true);
  });

  it("rejects math sprint over 500", () => {
    expect(withinBounds("math", "score", 501)).toBe(false);
    expect(withinBounds("math", "score", 500)).toBe(true);
  });

  it("rejects negative or wrong-typed values", () => {
    expect(withinBounds("schulte", "time_ms", -1)).toBe(false);
    expect(withinBounds("schulte", "time_ms", Number.NaN)).toBe(false);
    expect(withinBounds("schulte", "time_ms", Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("returns false for unknown game", () => {
    // @ts-expect-error testing invalid game name
    expect(withinBounds("nonexistent", "time_ms", 1000)).toBe(false);
  });
});
