import { describe, it, expect } from "vitest";
import { sliceStart, type TimeSlice } from "@/lib/leaderboards/time-slice";

describe("sliceStart", () => {
  const NOW = new Date("2026-05-08T10:30:00+10:00").getTime();

  it("today: midnight in Australia/Sydney", () => {
    const r = sliceStart("today", NOW);
    // Sydney midnight = 14:00 UTC of previous day in May (AEST = UTC+10).
    expect(new Date(r).toISOString()).toBe("2026-05-07T14:00:00.000Z");
  });

  it("week: 7 days back exactly", () => {
    const r = sliceStart("week", NOW);
    expect(NOW - r).toBe(7 * 86400_000);
  });

  it("month: 30 days back exactly", () => {
    const r = sliceStart("month", NOW);
    expect(NOW - r).toBe(30 * 86400_000);
  });

  it("all: 0", () => {
    expect(sliceStart("all", NOW)).toBe(0);
  });

  it("rejects unknown slice", () => {
    expect(() => sliceStart("forever" as TimeSlice, NOW)).toThrow();
  });
});
