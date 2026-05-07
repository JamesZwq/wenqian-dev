import { describe, it, expect } from "vitest";
import { canonicalizeUsername, validateUsername } from "@/lib/username";

describe("canonicalizeUsername", () => {
  it("lowercases the input", () => {
    expect(canonicalizeUsername("Wenqian")).toBe("wenqian");
    expect(canonicalizeUsername("WeN-Qian_42")).toBe("wen-qian_42");
  });
});

describe("validateUsername", () => {
  it("accepts valid usernames", () => {
    expect(validateUsername("wenqian").ok).toBe(true);
    expect(validateUsername("wen-qian_42").ok).toBe(true);
    expect(validateUsername("a1b").ok).toBe(true);
    expect(validateUsername("Wenqian").ok).toBe(true);
  });

  it("rejects too short", () => {
    expect(validateUsername("ab").ok).toBe(false);
    const r = validateUsername("ab");
    if (!r.ok) expect(r.reason).toContain("3");
  });

  it("rejects too long", () => {
    expect(validateUsername("a".repeat(21)).ok).toBe(false);
  });

  it("rejects illegal chars", () => {
    expect(validateUsername("wen.qian").ok).toBe(false);
    expect(validateUsername("wenqian!").ok).toBe(false);
    expect(validateUsername("wen qian").ok).toBe(false);
    expect(validateUsername("wen中qian").ok).toBe(false);
  });

  it("rejects reserved words (case-insensitive)", () => {
    expect(validateUsername("admin").ok).toBe(false);
    expect(validateUsername("ADMIN").ok).toBe(false);
    expect(validateUsername("root").ok).toBe(false);
    expect(validateUsername("api").ok).toBe(false);
    expect(validateUsername("auth").ok).toBe(false);
    expect(validateUsername("wenqian-dev").ok).toBe(false);
    expect(validateUsername("sign-in").ok).toBe(false);
    expect(validateUsername("sign-up").ok).toBe(false);
    expect(validateUsername("settings").ok).toBe(false);
    expect(validateUsername("profile").ok).toBe(false);
  });
});
