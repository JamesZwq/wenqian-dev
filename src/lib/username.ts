// Username validation + canonicalisation + reserved list.
// Used both server-side (Better-Auth username plugin custom validator) and
// client-side (UsernameField inline feedback).

const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;
const MIN = 3;
const MAX = 20;

const RESERVED = new Set([
  "admin", "root", "api", "auth", "wenqian-dev",
  "sign-in", "sign-up", "settings", "profile",
]);

export function canonicalizeUsername(input: string): string {
  return input.toLowerCase();
}

export type ValidateResult =
  | { ok: true; canonical: string }
  | { ok: false; reason: string };

export function validateUsername(input: string): ValidateResult {
  if (typeof input !== "string") return { ok: false, reason: "must be a string" };
  if (input.length < MIN) return { ok: false, reason: `must be at least ${MIN} characters` };
  if (input.length > MAX) return { ok: false, reason: `must be at most ${MAX} characters` };
  if (!USERNAME_REGEX.test(input)) {
    return { ok: false, reason: "may only contain a-z, A-Z, 0-9, _ and -" };
  }
  const canonical = canonicalizeUsername(input);
  if (RESERVED.has(canonical)) return { ok: false, reason: "this username is reserved" };
  return { ok: true, canonical };
}
