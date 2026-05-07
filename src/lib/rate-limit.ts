import type { KVNamespace } from "@cloudflare/workers-types";

export interface RateLimitOpts {
  /** Logical bucket key, e.g. "login:1.2.3.4" or "signup:user-abc". */
  key: string;
  /** Max events permitted within the window. */
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Unix seconds when the current window expires. */
  resetAt: number;
}

/**
 * KV-backed fixed-window rate limiter.
 *
 * Eventually-consistent — under high contention this can over-permit by one
 * or two events. Acceptable for per-user / per-IP application limits where
 * the goal is abuse mitigation, not strict security.
 */
export async function rateLimit(
  kv: KVNamespace,
  opts: RateLimitOpts,
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const fullKey = `rl:${opts.key}`;
  const raw = await kv.get(fullKey);
  const state = raw ? (JSON.parse(raw) as { count: number; resetAt: number }) : null;

  // Window expired (or never started) — reset.
  if (!state || state.resetAt <= now) {
    const resetAt = now + opts.windowSec;
    await kv.put(fullKey, JSON.stringify({ count: 1, resetAt }), {
      expirationTtl: opts.windowSec,
    });
    return { ok: true, remaining: opts.limit - 1, resetAt };
  }

  // Limit reached.
  if (state.count >= opts.limit) {
    return { ok: false, remaining: 0, resetAt: state.resetAt };
  }

  // Increment.
  const newCount = state.count + 1;
  await kv.put(fullKey, JSON.stringify({ count: newCount, resetAt: state.resetAt }), {
    expirationTtl: Math.max(1, state.resetAt - now),
  });
  return { ok: true, remaining: opts.limit - newCount, resetAt: state.resetAt };
}
