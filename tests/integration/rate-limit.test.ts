// Test runner not yet wired (Vitest workers-pool lands in Phase 6 / Task 30).
// This file is committed up-front so Phase 6 has assertions to run.
//
// To run: `npm test` (after Phase 6 setup).

import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(async () => {
    const list = await env.CACHE.list({ prefix: "rl:" });
    await Promise.all(list.keys.map((k) => env.CACHE.delete(k.name)));
  });

  it("permits up to the limit, then denies", async () => {
    const opts = { key: "test:user-1", limit: 3, windowSec: 60 };
    expect((await rateLimit(env.CACHE, opts)).ok).toBe(true);
    expect((await rateLimit(env.CACHE, opts)).ok).toBe(true);
    expect((await rateLimit(env.CACHE, opts)).ok).toBe(true);
    expect((await rateLimit(env.CACHE, opts)).ok).toBe(false);
  });

  it("isolates different keys", async () => {
    const a = { key: "a", limit: 1, windowSec: 60 };
    const b = { key: "b", limit: 1, windowSec: 60 };
    expect((await rateLimit(env.CACHE, a)).ok).toBe(true);
    expect((await rateLimit(env.CACHE, b)).ok).toBe(true);
    expect((await rateLimit(env.CACHE, a)).ok).toBe(false);
  });

  it("reports remaining count correctly", async () => {
    const opts = { key: "remaining", limit: 5, windowSec: 60 };
    expect((await rateLimit(env.CACHE, opts)).remaining).toBe(4);
    expect((await rateLimit(env.CACHE, opts)).remaining).toBe(3);
    const r = await rateLimit(env.CACHE, opts);
    expect(r.remaining).toBe(2);
    expect(r.resetAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});
