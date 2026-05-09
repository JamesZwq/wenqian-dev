import { describe, it, expect } from "vitest";
import { generateRoomCode, ROOM_CODE_LENGTH, ROOM_CODE_ALPHABET } from "@/lib/rooms/codes";

describe("generateRoomCode", () => {
  it("returns a 6-character string", () => {
    expect(ROOM_CODE_LENGTH).toBe(6);
    const code = generateRoomCode();
    expect(code).toHaveLength(6);
  });

  it("uses only the allowed alphabet (no ambiguous chars)", () => {
    for (let i = 0; i < 1000; i++) {
      const code = generateRoomCode();
      for (const ch of code) {
        expect(ROOM_CODE_ALPHABET.includes(ch)).toBe(true);
      }
    }
  });

  it("excludes 0/O/1/I/L for visual unambiguity", () => {
    expect(ROOM_CODE_ALPHABET.includes("0")).toBe(false);
    expect(ROOM_CODE_ALPHABET.includes("O")).toBe(false);
    expect(ROOM_CODE_ALPHABET.includes("1")).toBe(false);
    expect(ROOM_CODE_ALPHABET.includes("I")).toBe(false);
    expect(ROOM_CODE_ALPHABET.includes("L")).toBe(false);
  });

  it("collision rate is acceptable across 10k generations", () => {
    const seen = new Set<string>();
    let collisions = 0;
    for (let i = 0; i < 10000; i++) {
      const code = generateRoomCode();
      if (seen.has(code)) collisions++;
      seen.add(code);
    }
    expect(collisions).toBeLessThan(5);
  });
});
