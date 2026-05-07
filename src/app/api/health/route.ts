import { env } from "@/lib/env";

export async function GET() {
  const e = env();
  const checks: Record<string, "ok" | string> = {};

  // D1
  try {
    await e.DB.prepare("SELECT 1").first();
    checks.db = "ok";
  } catch (err) {
    checks.db = `err: ${err instanceof Error ? err.message : String(err)}`;
  }

  // KV
  try {
    const probeKey = "health:probe";
    await e.CACHE.put(probeKey, "1", { expirationTtl: 60 });
    const v = await e.CACHE.get(probeKey);
    checks.kv = v === "1" ? "ok" : `mismatch: got ${v}`;
  } catch (err) {
    checks.kv = `err: ${err instanceof Error ? err.message : String(err)}`;
  }

  // R2 — head() returns null for missing keys, throws only on transport/auth
  // failure. Either response means the binding is reachable.
  try {
    await e.BUCKET.head("__health_probe__");
    checks.r2 = "ok";
  } catch (err) {
    checks.r2 = `err: ${err instanceof Error ? err.message : String(err)}`;
  }

  const allOk = Object.values(checks).every((v) => v === "ok");
  return Response.json(
    { ok: allOk, checks },
    { status: allOk ? 200 : 503 },
  );
}
