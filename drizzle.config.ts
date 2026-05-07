import type { Config } from "drizzle-kit";

// drizzle-kit talks to D1 via the HTTP API for `generate`/`push` from your dev
// machine. The Worker itself uses the binding (different code path).
//
// CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN must be
// set when running drizzle-kit commands. We don't actually use this for
// migrations (we use `wrangler d1 migrations apply` for that — it reads
// migrations_dir from wrangler.jsonc), but drizzle-kit `generate` still needs
// dialect/dbCredentials to satisfy the config schema.

export default {
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
    databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID ?? "",
    token: process.env.CLOUDFLARE_API_TOKEN ?? "",
  },
} satisfies Config;
