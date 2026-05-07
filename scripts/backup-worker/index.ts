// Standalone Cloudflare Worker — separate from the main Next.js Worker.
// Triggered by a daily Cron event; dumps every D1 table as INSERT statements
// and writes the file to R2 under `backups/d1/YYYY-MM-DD.sql`.
//
// Shares the production D1 + R2 bindings with the main Worker by referencing
// the same database_id / bucket_name in the cron Worker's wrangler config.

import type {
  D1Database,
  ExecutionContext,
  R2Bucket,
  ScheduledEvent,
} from "@cloudflare/workers-types";

interface CronEnv {
  DB: D1Database;
  BUCKET: R2Bucket;
}

export default {
  async scheduled(_event: ScheduledEvent, env: CronEnv, ctx: ExecutionContext) {
    ctx.waitUntil(runBackup(env));
  },

  // Manual-trigger fallback. Useful for one-off invocations and CI smoke tests.
  // Guarded by a shared secret header so anyone hitting the URL can't trigger
  // a backup write.
  async fetch(req: Request, env: CronEnv & { CRON_SECRET: string }) {
    if (req.headers.get("x-cron-secret") !== env.CRON_SECRET) {
      return new Response("Forbidden", { status: 403 });
    }
    const result = await runBackup(env);
    return Response.json(result);
  },
};

async function runBackup(env: CronEnv) {
  const date = new Date().toISOString().slice(0, 10);
  const tablesQ = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations' ORDER BY name",
  ).all<{ name: string }>();

  const chunks: string[] = [
    `-- D1 backup ${date} for wenqian-dev\n`,
    `-- Tables: ${tablesQ.results.map((r) => r.name).join(", ")}\n\n`,
  ];

  for (const { name } of tablesQ.results) {
    chunks.push(`-- ── ${name} ──\n`);
    const rowsQ = await env.DB.prepare(`SELECT * FROM "${name}"`).all<Record<string, unknown>>();
    for (const row of rowsQ.results) {
      const cols = Object.keys(row).map((k) => `"${k}"`).join(",");
      const vals = Object.values(row)
        .map((v) =>
          v === null
            ? "NULL"
            : typeof v === "number"
              ? String(v)
              : typeof v === "boolean"
                ? (v ? "1" : "0")
                : `'${String(v).replace(/'/g, "''")}'`,
        )
        .join(",");
      chunks.push(`INSERT INTO "${name}" (${cols}) VALUES (${vals});\n`);
    }
    chunks.push("\n");
  }

  const dump = chunks.join("");
  const key = `backups/d1/${date}.sql`;
  await env.BUCKET.put(key, dump, {
    httpMetadata: { contentType: "application/sql" },
  });

  return {
    ok: true,
    date,
    key,
    bytes: dump.length,
    tables: tablesQ.results.length,
  };
}
