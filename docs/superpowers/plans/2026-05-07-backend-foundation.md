# Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `wenqian.dev` from Cloudflare Pages auto-detection to Cloudflare Workers + `@opennextjs/cloudflare`, then provision and wire D1, Workers KV, R2, Better-Auth (email + Google + GitHub OAuth), Resend (email), Sentry (errors), Workers Analytics Engine (business events), Vitest with workers-pool integration tests, Playwright E2E, GitHub Actions CI/CD with per-PR preview Workers, and a nightly D1 → R2 backup via Cron Trigger. End state: foundation in place for the five user-facing features (E user system, B leaderboards, A cross-device sync, C admin, D' lightweight rooms), zero monthly hosting cost.

**Architecture:** Single Cloudflare Worker hosts the entire Next.js 16 App Router app via `@opennextjs/cloudflare`. Bindings (D1, KV, R2, Analytics Engine) live in `wrangler.jsonc` and are version-controlled. Three environments: local (miniflare), preview (per-PR Worker on `*.workers.dev`), production (`wenqian.dev`). Auth library wired but no user-facing UI yet (UI ships with feature E spec). Realtime stays as WebRTC P2P; D' will layer D1 metadata later.

**Tech Stack:** Next.js 16, React 19, `@opennextjs/cloudflare`, Wrangler, Cloudflare D1, Drizzle ORM + drizzle-kit, Better-Auth (Drizzle + D1 adapter), Zod, Resend, Workers KV, R2, Workers Analytics Engine, Sentry (`@sentry/nextjs` + `@sentry/cloudflare`), Vitest + `@cloudflare/vitest-pool-workers`, Playwright, GitHub Actions.

**Spec:** [`docs/superpowers/specs/2026-05-07-backend-foundation-design.md`](../specs/2026-05-07-backend-foundation-design.md)

---

## Manual prerequisites (USER ACTIONS — collect these before Task 1)

These cannot be automated. The plan calls for them at specific tasks; gather them first so execution doesn't stall.

| # | Action | Why |
|---|---|---|
| M1 | Create / sign in to a **Cloudflare account**, note your **Account ID** (Dashboard → Workers & Pages → right sidebar) | Required by wrangler |
| M2 | Create a **Cloudflare API Token** with permissions: Workers Scripts:Edit, D1:Edit, Workers KV Storage:Edit, R2:Edit, Account:Read, User Details:Read. Save in 1Password / similar | Required for `wrangler` and CI |
| M3 | Create a **Resend account** at resend.com, add `wenqian.dev` domain, configure DKIM/SPF DNS records, get API key | Email sending |
| M4 | Create a **Sentry account** at sentry.io, create two projects: `wenqian-dev-frontend` (platform: Next.js) and `wenqian-dev-worker` (platform: Cloudflare Worker). Copy DSNs and an Auth Token (Settings → Auth Tokens, scope: project:read + project:releases) | Error monitoring |
| M5 | Create a **Google OAuth Client** at console.cloud.google.com → APIs & Services → Credentials. Two clients: one for preview (`https://*.workers.dev` redirect) and one for production (`https://wenqian.dev` redirect). Each with `/api/auth/callback/google` redirect URI | Google login |
| M6 | Create a **GitHub OAuth App** at github.com/settings/developers. Two apps: preview and production. Callback: `https://<worker-domain>/api/auth/callback/github` | GitHub login |
| M7 | Have **`wrangler` CLI authenticated** locally: `npx wrangler login` (will open browser) | Local dev/deploy |

Until M1, M2, M7 are done, Task 0 cannot be verified.

---

## Phase 0 — Pre-flight & risk gate

### Task 0: Verify `@opennextjs/cloudflare` supports Next.js 16

**Why:** Spec section 15 risk #1 — if the adapter doesn't support Next.js 16, the entire migration is blocked. Must verify first in an isolated test, NOT in the real repo.

**Files:** none (sandbox folder, deleted after)

- [ ] **Step 1: Create a throwaway test directory**

```bash
mkdir -p /tmp/onx-compat-check && cd /tmp/onx-compat-check
```

- [ ] **Step 2: Initialize a Next.js 16 minimal app**

```bash
npx create-next-app@16 . --ts --app --no-tailwind --no-eslint --src-dir --import-alias "@/*" --no-turbopack --use-npm
```

- [ ] **Step 3: Install opennextjs-cloudflare**

```bash
npm install --save-dev @opennextjs/cloudflare wrangler
```

- [ ] **Step 4: Add minimal `wrangler.jsonc`**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "onx-compat-test",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-04-01",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": { "binding": "ASSETS", "directory": ".open-next/assets" }
}
```

- [ ] **Step 5: Add `open-next.config.ts`**

```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
```

- [ ] **Step 6: Try a build and local run**

```bash
npx opennextjs-cloudflare build && npx wrangler dev --port 8787
```

Open `http://localhost:8787` in a browser. Expected: default Next.js landing page renders.

- [ ] **Step 7: Decision gate**

If the page loads and there are no fatal errors in the wrangler dev output: PROCEED to Task 1.

If the build fails or the page errors: STOP. Report the error to the user. Do NOT continue with the migration. The likely paths forward are:
- Wait for the next `@opennextjs/cloudflare` release (check GitHub releases & their Next 16 support tracker)
- Pin Next.js to 15.x as a fallback (large rollback in the main repo — discuss with user)

- [ ] **Step 8: Clean up**

```bash
rm -rf /tmp/onx-compat-check
```

No commit — this was a sandbox check.

---

## Phase 1 — Workers runtime base (no bindings yet)

### Task 1: Install `@opennextjs/cloudflare` + `wrangler` in the real repo

**Files:**
- Modify: `package.json` (deps)
- Create: `package-lock.json` updates

- [ ] **Step 1: Install deps**

```bash
cd /Users/zhangwenqian/my-web
npm install --save-dev @opennextjs/cloudflare wrangler
```

- [ ] **Step 2: Verify versions in `package.json`**

```bash
grep -E "opennextjs|wrangler" package.json
```

Expected: both present in `devDependencies`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add @opennextjs/cloudflare + wrangler"
```

### Task 2: Create `open-next.config.ts`

**Files:**
- Create: `open-next.config.ts`

- [ ] **Step 1: Create the file**

```ts
// open-next.config.ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Use D1 + KV-based caching once we wire them; default for now.
});
```

- [ ] **Step 2: Commit**

```bash
git add open-next.config.ts
git commit -m "build: add open-next.config.ts"
```

### Task 3: Create `wrangler.jsonc` with three environments, no bindings yet

**Files:**
- Create: `wrangler.jsonc`

- [ ] **Step 1: Create the file**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "wenqian-dev",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-04-01",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": {
    "binding": "ASSETS",
    "directory": ".open-next/assets"
  },
  "observability": { "enabled": true },
  "env": {
    "preview": {
      "name": "wenqian-dev-preview"
    },
    "production": {
      "name": "wenqian-dev",
      "routes": [
        { "pattern": "wenqian.dev", "custom_domain": true },
        { "pattern": "www.wenqian.dev", "custom_domain": true }
      ]
    }
  }
}
```

> Note: `wenqian.dev` route binding is declared here but does NOT take effect until Task 47 (production cutover). Cloudflare won't switch the domain just because the field exists.

- [ ] **Step 2: Commit**

```bash
git add wrangler.jsonc
git commit -m "build: add wrangler.jsonc with preview/production environments"
```

### Task 4: Add npm scripts

**Files:**
- Modify: `package.json` (scripts section)

- [ ] **Step 1: Edit `package.json` scripts to**

```json
"scripts": {
  "dev": "next dev",
  "dev:worker": "opennextjs-cloudflare build && wrangler dev",
  "build": "next build",
  "build:worker": "opennextjs-cloudflare build",
  "start": "next start",
  "deploy:preview": "opennextjs-cloudflare build && wrangler deploy --env preview",
  "deploy:production": "opennextjs-cloudflare build && wrangler deploy --env production",
  "lint": "eslint",
  "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 2: Verify scripts list**

```bash
npm run
```

Expected output lists all scripts above.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "build: add Worker dev/build/deploy scripts"
```

### Task 5: First successful local Worker run

**Files:** none

- [ ] **Step 1: Build for Workers**

```bash
npm run build:worker
```

Expected: builds without error; `.open-next/` directory created.

- [ ] **Step 2: Run wrangler dev**

```bash
npx wrangler dev
```

- [ ] **Step 3: Smoke-test in browser**

Open `http://localhost:8787`. Expected: home page renders. Click into `/poker`, `/halli-galli`, `/transcribe` — expected: they all render.

If any route 500s: STOP, debug. Common issues:
- Missing `nodejs_compat` flag (already set)
- A page imports a Node-only module not in the compat layer; identify the offending import via stack trace

- [ ] **Step 4: Stop dev server (Ctrl+C)**

- [ ] **Step 5: Add `.open-next/` and `.wrangler/` to `.gitignore`**

```bash
grep -qxF ".open-next/" .gitignore || echo ".open-next/" >> .gitignore
grep -qxF ".wrangler/" .gitignore || echo ".wrangler/" >> .gitignore
```

- [ ] **Step 6: Commit**

```bash
git add .gitignore
git commit -m "build: ignore Worker build artifacts"
```

### Task 6: First deploy to a `*.workers.dev` URL (preview env)

**Prereq:** M1, M2, M7 done.

- [ ] **Step 1: Confirm wrangler is logged in**

```bash
npx wrangler whoami
```

Expected: shows your email + account ID. If not, run `npx wrangler login`.

- [ ] **Step 2: Deploy preview**

```bash
npm run deploy:preview
```

Expected: outputs a URL like `https://wenqian-dev-preview.<account>.workers.dev`. Save this URL.

- [ ] **Step 3: Smoke-test the deployed Worker**

Open the URL in a browser. Verify home page + `/poker` + `/transcribe` all load.

- [ ] **Step 4: No commit needed (no file changes from this step)**

---

## Phase 2 — D1 + Drizzle skeleton

### Task 7: Provision D1 databases (preview + production)

**Files:**
- Modify: `wrangler.jsonc`

- [ ] **Step 1: Create the preview D1 database**

```bash
npx wrangler d1 create wenqian-dev-preview
```

Expected: outputs a `database_id` UUID. Copy it.

- [ ] **Step 2: Create the production D1 database**

```bash
npx wrangler d1 create wenqian-dev
```

Expected: outputs a different `database_id`. Copy it.

- [ ] **Step 3: Add D1 binding to `wrangler.jsonc`**

Edit so the file has (additions in `env.preview` and `env.production`):

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "wenqian-dev",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-04-01",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": { "binding": "ASSETS", "directory": ".open-next/assets" },
  "observability": { "enabled": true },
  "env": {
    "preview": {
      "name": "wenqian-dev-preview",
      "d1_databases": [
        {
          "binding": "DB",
          "database_name": "wenqian-dev-preview",
          "database_id": "<PASTE-PREVIEW-ID-FROM-STEP-1>"
        }
      ]
    },
    "production": {
      "name": "wenqian-dev",
      "routes": [
        { "pattern": "wenqian.dev", "custom_domain": true },
        { "pattern": "www.wenqian.dev", "custom_domain": true }
      ],
      "d1_databases": [
        {
          "binding": "DB",
          "database_name": "wenqian-dev",
          "database_id": "<PASTE-PROD-ID-FROM-STEP-2>"
        }
      ]
    }
  }
}
```

- [ ] **Step 4: Verify**

```bash
npx wrangler d1 list
```

Expected: both databases listed.

- [ ] **Step 5: Commit**

```bash
git add wrangler.jsonc
git commit -m "build(d1): provision preview + production databases"
```

### Task 8: Install Drizzle ORM + drizzle-kit + drizzle-zod

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
npm install drizzle-orm
npm install --save-dev drizzle-kit drizzle-zod zod
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add drizzle-orm, drizzle-kit, drizzle-zod, zod"
```

### Task 9: Create `drizzle.config.ts`

**Files:**
- Create: `drizzle.config.ts`

- [ ] **Step 1: Create the file**

```ts
// drizzle.config.ts
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID!,
    token: process.env.CLOUDFLARE_API_TOKEN!,
  },
} satisfies Config;
```

> drizzle-kit talks to D1 via the HTTP API for `push`/`migrate` from your dev machine. The Worker itself uses the binding (different code path).

- [ ] **Step 2: Commit**

```bash
git add drizzle.config.ts
git commit -m "build(drizzle): config pointing at D1 over HTTP"
```

### Task 10: Create the DB schema directory + index file

**Files:**
- Create: `src/db/schema/index.ts`

- [ ] **Step 1: Create directory and empty index**

```bash
mkdir -p src/db/schema src/db/migrations
```

```ts
// src/db/schema/index.ts
// Auth tables are populated by Better-Auth in Phase 3.
// Each feature spec adds its own schema/<feature>.ts file and re-exports here.
export * from "./auth";
```

(The `./auth` file is created in Task 14.)

- [ ] **Step 2: Commit**

Will commit together with Task 14 — skip standalone commit. The file references `./auth` which doesn't exist yet; that's intentional and resolved when Better-Auth generates it.

### Task 11: Create the DB client helper

**Files:**
- Create: `src/db/client.ts`
- Create: `src/lib/env.ts`

- [ ] **Step 1: Create `src/lib/env.ts`**

```ts
// src/lib/env.ts
// Typed accessor for Cloudflare bindings inside Next.js routes/server components.
// @opennextjs/cloudflare exposes the env via a getter.
import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  // KV, R2, ANALYTICS added in later tasks
}

export function env(): Env {
  return getCloudflareContext().env as Env;
}
```

- [ ] **Step 2: Create `src/db/client.ts`**

```ts
// src/db/client.ts
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { env } from "@/lib/env";

export function getDb() {
  return drizzle(env().DB, { schema });
}

export type Db = ReturnType<typeof getDb>;
```

- [ ] **Step 3: Commit (deferred until Task 14 — files reference yet-to-exist auth schema)**

### Task 12: Add db npm scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add to scripts**

```json
"db:generate": "drizzle-kit generate",
"db:migrate:local": "wrangler d1 migrations apply wenqian-dev-preview --local",
"db:migrate:preview": "wrangler d1 migrations apply wenqian-dev-preview --remote",
"db:migrate:production": "wrangler d1 migrations apply wenqian-dev --remote",
"db:studio": "drizzle-kit studio"
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "build(db): add drizzle-kit + wrangler d1 npm scripts"
```

> Note: `wrangler d1 migrations apply` reads from `./src/db/migrations` (configured via Task 13).

### Task 13: Tell wrangler where the migrations live

**Files:**
- Modify: `wrangler.jsonc`

- [ ] **Step 1: Add `migrations_dir` to each D1 binding in `wrangler.jsonc`**

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "wenqian-dev-preview",
    "database_id": "...",
    "migrations_dir": "src/db/migrations"
  }
]
```

(Apply same to production binding.)

- [ ] **Step 2: Commit**

```bash
git add wrangler.jsonc
git commit -m "build(d1): point wrangler at src/db/migrations"
```

---

## Phase 3 — Better-Auth + Resend

### Task 14: Install Better-Auth + Resend SDKs

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
npm install better-auth resend
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add better-auth + resend"
```

### Task 15: Configure Better-Auth server (`src/lib/auth.ts`)

**Files:**
- Create: `src/lib/auth.ts`

- [ ] **Step 1: Create the file**

```ts
// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Resend } from "resend";
import { getDb } from "@/db/client";
import { env } from "@/lib/env";

let _instance: ReturnType<typeof betterAuth> | null = null;

export function auth() {
  if (_instance) return _instance;

  const e = env() as unknown as {
    BETTER_AUTH_SECRET: string;
    RESEND_API_KEY: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
    BETTER_AUTH_URL: string;
  };

  const resend = new Resend(e.RESEND_API_KEY);

  _instance = betterAuth({
    database: drizzleAdapter(getDb(), { provider: "sqlite" }),
    secret: e.BETTER_AUTH_SECRET,
    baseURL: e.BETTER_AUTH_URL,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await resend.emails.send({
          from: "wenqian.dev <noreply@wenqian.dev>",
          to: user.email,
          subject: "Verify your email",
          html: `<p>Click to verify: <a href="${url}">${url}</a></p>`,
        });
      },
    },
    socialProviders: {
      google: { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET },
      github: { clientId: e.GITHUB_CLIENT_ID, clientSecret: e.GITHUB_CLIENT_SECRET },
    },
  });

  return _instance;
}
```

- [ ] **Step 2: Verify file compiles (no auth schema exists yet, but adapter is import-typed)**

```bash
npx tsc --noEmit
```

Expected: no errors related to `src/lib/auth.ts`. There may be errors in `src/db/schema/index.ts` re: the missing `./auth` file — that's resolved by Task 16.

### Task 16: Generate Better-Auth schema with the CLI

- [ ] **Step 1: Run the Better-Auth schema generator**

Per Better-Auth docs (https://better-auth.com/docs/concepts/database — verify exact command at execution time, the SDK changes):

```bash
npx @better-auth/cli generate --output src/db/schema/auth.ts
```

This reads `src/lib/auth.ts`, sees `drizzleAdapter` with `provider: "sqlite"`, and writes a Drizzle schema file.

If the CLI command differs in your installed version, fall back to writing the schema manually using the table shapes documented in Better-Auth's "Drizzle adapter" docs (users, accounts, sessions, verification tables).

- [ ] **Step 2: Inspect the generated file**

```bash
cat src/db/schema/auth.ts
```

Expected: defines tables `user`, `account`, `session`, `verification` (Better-Auth uses singular names).

- [ ] **Step 3: Run typecheck again**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Generate the SQL migration via drizzle-kit**

```bash
npm run db:generate
```

Expected: outputs `src/db/migrations/0000_<random-name>.sql` with `CREATE TABLE` statements.

- [ ] **Step 5: Apply migration to local D1**

```bash
npm run db:migrate:local
```

Expected: prints "Applied migrations". Tables now exist in the local miniflare D1.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema src/db/migrations src/db/client.ts src/lib/env.ts
git commit -m "feat(auth): generate Better-Auth schema + initial Drizzle migration"
```

### Task 17: Create the `/api/auth/[...all]` catch-all route

**Files:**
- Create: `src/app/api/auth/[...all]/route.ts`

- [ ] **Step 1: Create the file**

```ts
// src/app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const runtime = "edge"; // opennextjs serves this on the Worker

const handler = toNextJsHandler(auth());

export const GET = handler.GET;
export const POST = handler.POST;
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/auth
git commit -m "feat(auth): add Better-Auth catch-all route"
```

### Task 18: Create the auth client helper

**Files:**
- Create: `src/lib/auth-client.ts`

- [ ] **Step 1: Create the file**

```ts
// src/lib/auth-client.ts
"use client";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // baseURL inferred from window.location in browser
});

export const { signIn, signOut, signUp, useSession } = authClient;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/auth-client.ts
git commit -m "feat(auth): add Better-Auth React client helper"
```

### Task 19: Add `.dev.vars` template + actual local secrets

**Files:**
- Create: `.dev.vars.example`
- Create: `.dev.vars` (gitignored)
- Modify: `.gitignore`

- [ ] **Step 1: Create `.dev.vars.example`** (committed)

```
# Copy to .dev.vars and fill in real values for local dev.
BETTER_AUTH_SECRET=replace-with-32-byte-random
BETTER_AUTH_URL=http://localhost:8787
RESEND_API_KEY=re_xxx
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
SENTRY_DSN_SERVER=
```

- [ ] **Step 2: Add `.dev.vars` to `.gitignore`**

```bash
grep -qxF ".dev.vars" .gitignore || echo ".dev.vars" >> .gitignore
```

- [ ] **Step 3: Create `.dev.vars` locally (NOT committed)**

```bash
cp .dev.vars.example .dev.vars
```

Generate a real BETTER_AUTH_SECRET:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste into `.dev.vars`. Fill in Resend (M3) + Google (M5) + GitHub (M6) values from prerequisites.

- [ ] **Step 4: Commit (only example + gitignore)**

```bash
git add .dev.vars.example .gitignore
git commit -m "build(env): add .dev.vars.example template + ignore .dev.vars"
```

### Task 20: Smoke-test sign-up flow locally

- [ ] **Step 1: Run the worker dev server**

```bash
npm run dev:worker
```

- [ ] **Step 2: Sign up via curl**

```bash
curl -X POST http://localhost:8787/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@wenqian.dev","password":"test12345","name":"Test"}'
```

Expected: 200 response, JSON body with user info. Email verification is sent via Resend (verify in Resend dashboard logs).

- [ ] **Step 3: Verify the row landed in D1**

```bash
npx wrangler d1 execute wenqian-dev-preview --local --command "SELECT id, email, emailVerified FROM user"
```

Expected: one row with the email.

- [ ] **Step 4: Tear down dev server**

If the smoke test fails, debug. Common issues:
- `BETTER_AUTH_SECRET` mismatch between local and config
- Resend domain not verified yet (signup will succeed but email won't send)

---

## Phase 4 — KV + R2 bindings

### Task 21: Provision Workers KV namespaces

**Files:**
- Modify: `wrangler.jsonc`

- [ ] **Step 1: Create namespaces**

```bash
npx wrangler kv namespace create CACHE --env preview
npx wrangler kv namespace create CACHE --env production
```

Each command outputs an `id`. Copy both.

- [ ] **Step 2: Add binding to `wrangler.jsonc`** (each env)

```jsonc
"kv_namespaces": [
  { "binding": "CACHE", "id": "<paste-id>" }
]
```

- [ ] **Step 3: Update `src/lib/env.ts`**

```ts
export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  CACHE: KVNamespace;
}
```

- [ ] **Step 4: Commit**

```bash
git add wrangler.jsonc src/lib/env.ts
git commit -m "build(kv): bind CACHE namespace for preview + production"
```

### Task 22: Provision R2 bucket

**Files:**
- Modify: `wrangler.jsonc`

- [ ] **Step 1: Create buckets**

```bash
npx wrangler r2 bucket create wenqian-dev-preview
npx wrangler r2 bucket create wenqian-dev
```

- [ ] **Step 2: Add binding to `wrangler.jsonc`** (each env)

```jsonc
"r2_buckets": [
  { "binding": "BUCKET", "bucket_name": "wenqian-dev-preview" }
]
```

(Production uses `wenqian-dev`.)

- [ ] **Step 3: Update `src/lib/env.ts`**

```ts
export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  CACHE: KVNamespace;
  BUCKET: R2Bucket;
}
```

- [ ] **Step 4: Commit**

```bash
git add wrangler.jsonc src/lib/env.ts
git commit -m "build(r2): bind BUCKET for preview + production"
```

### Task 23: Create the rate-limit helper

**Files:**
- Create: `src/lib/rate-limit.ts`
- Create: `tests/integration/rate-limit.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/integration/rate-limit.test.ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(async () => {
    // List + delete CACHE keys between tests
    const list = await env.CACHE.list();
    await Promise.all(list.keys.map(k => env.CACHE.delete(k.name)));
  });

  it("permits up to the limit, then denies", async () => {
    const opts = { key: "test:user-1", limit: 3, windowSec: 60 };
    expect(await rateLimit(env.CACHE, opts)).toEqual({ ok: true, remaining: 2 });
    expect(await rateLimit(env.CACHE, opts)).toEqual({ ok: true, remaining: 1 });
    expect(await rateLimit(env.CACHE, opts)).toEqual({ ok: true, remaining: 0 });
    const fourth = await rateLimit(env.CACHE, opts);
    expect(fourth.ok).toBe(false);
  });

  it("isolates different keys", async () => {
    const a = { key: "a", limit: 1, windowSec: 60 };
    const b = { key: "b", limit: 1, windowSec: 60 };
    expect((await rateLimit(env.CACHE, a)).ok).toBe(true);
    expect((await rateLimit(env.CACHE, b)).ok).toBe(true);
    expect((await rateLimit(env.CACHE, a)).ok).toBe(false);
  });
});
```

(Vitest setup happens in Task 28; this test won't run yet but is committed for that task.)

- [ ] **Step 2: Implement `src/lib/rate-limit.ts`**

```ts
// src/lib/rate-limit.ts
export interface RateLimitOpts {
  key: string;
  limit: number;
  windowSec: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export async function rateLimit(
  kv: KVNamespace,
  opts: RateLimitOpts,
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const fullKey = `rl:${opts.key}`;
  const raw = await kv.get(fullKey);
  const state = raw ? JSON.parse(raw) as { count: number; resetAt: number } : null;

  if (!state || state.resetAt <= now) {
    const resetAt = now + opts.windowSec;
    await kv.put(fullKey, JSON.stringify({ count: 1, resetAt }), {
      expirationTtl: opts.windowSec,
    });
    return { ok: true, remaining: opts.limit - 1, resetAt };
  }

  if (state.count >= opts.limit) {
    return { ok: false, remaining: 0, resetAt: state.resetAt };
  }

  const newCount = state.count + 1;
  await kv.put(fullKey, JSON.stringify({ count: newCount, resetAt: state.resetAt }), {
    expirationTtl: state.resetAt - now,
  });
  return { ok: true, remaining: opts.limit - newCount, resetAt: state.resetAt };
}
```

> Race condition note: KV is eventually consistent, so under high contention this can over-permit by one or two. Acceptable for our use case (per-user limits, not security-critical). Document this in the function's comment if needed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/rate-limit.ts tests/integration/rate-limit.test.ts
git commit -m "feat(lib): add KV-backed rateLimit() helper + tests (not yet wired to runner)"
```

### Task 24: Add a health-check endpoint

**Files:**
- Create: `src/app/api/health/route.ts`

- [ ] **Step 1: Create the file**

```ts
// src/app/api/health/route.ts
import { env } from "@/lib/env";

export const runtime = "edge";

export async function GET() {
  const e = env();
  const checks: Record<string, "ok" | string> = {};

  // D1
  try {
    await e.DB.prepare("SELECT 1").first();
    checks.db = "ok";
  } catch (err) { checks.db = String(err); }

  // KV
  try {
    await e.CACHE.put("health:probe", "1", { expirationTtl: 60 });
    const v = await e.CACHE.get("health:probe");
    checks.kv = v === "1" ? "ok" : "mismatch";
  } catch (err) { checks.kv = String(err); }

  // R2
  try {
    await e.BUCKET.head("non-existent-key");
    checks.r2 = "ok";
  } catch (err) {
    // R2 head() returns null for missing, throws for auth errors
    checks.r2 = "ok"; // any reachable response counts
  }

  const allOk = Object.values(checks).every(v => v === "ok");
  return Response.json({ ok: allOk, checks }, { status: allOk ? 200 : 503 });
}
```

- [ ] **Step 2: Smoke-test locally**

```bash
npm run dev:worker
```

```bash
curl http://localhost:8787/api/health
```

Expected: `{"ok":true,"checks":{"db":"ok","kv":"ok","r2":"ok"}}`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/health
git commit -m "feat(api): add /api/health probing D1 + KV + R2"
```

---

## Phase 5 — Observability

### Task 25: Install Sentry

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
npm install @sentry/nextjs @sentry/cloudflare
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add @sentry/nextjs + @sentry/cloudflare"
```

### Task 26: Configure Sentry frontend

**Files:**
- Create: `sentry.client.config.ts`
- Create: `sentry.server.config.ts`
- Create: `sentry.edge.config.ts`
- Modify: `next.config.ts`

- [ ] **Step 1: Run the Sentry wizard or write configs manually**

Per `@sentry/nextjs` docs (https://docs.sentry.io/platforms/javascript/guides/nextjs/), run:

```bash
npx @sentry/wizard@latest -i nextjs --saas --org <your-org> --project wenqian-dev-frontend
```

Or (manual fallback):

```ts
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
});
```

(Repeat similarly for server / edge configs.)

- [ ] **Step 2: Add `NEXT_PUBLIC_SENTRY_DSN` to `.dev.vars.example`**

- [ ] **Step 3: Commit**

```bash
git add sentry.*.config.ts next.config.ts .dev.vars.example
git commit -m "feat(observability): wire Sentry frontend"
```

### Task 27: Wrap the Worker with Sentry

**Files:**
- Modify: `open-next.config.ts` OR create `src/instrumentation.ts`

- [ ] **Step 1: Create `src/instrumentation.ts`** (Next.js native hook)

```ts
// src/instrumentation.ts
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN_SERVER,
      tracesSampleRate: 0.1,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
```

- [ ] **Step 2: Commit**

```bash
git add src/instrumentation.ts
git commit -m "feat(observability): wire Sentry on the Worker"
```

### Task 28: Add Workers Analytics Engine binding + helper

**Files:**
- Modify: `wrangler.jsonc`
- Modify: `src/lib/env.ts`
- Create: `src/lib/analytics.ts`

- [ ] **Step 1: Add binding to each env in `wrangler.jsonc`**

```jsonc
"analytics_engine_datasets": [
  { "binding": "ANALYTICS", "dataset": "wenqian_dev_events" }
]
```

- [ ] **Step 2: Update `src/lib/env.ts`**

```ts
export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  CACHE: KVNamespace;
  BUCKET: R2Bucket;
  ANALYTICS: AnalyticsEngineDataset;
}
```

- [ ] **Step 3: Create `src/lib/analytics.ts`**

```ts
// src/lib/analytics.ts
import { env } from "@/lib/env";

export type Event =
  | { name: "auth.signup"; provider: "email" | "google" | "github" }
  | { name: "auth.login"; provider: "email" | "google" | "github" }
  | { name: "auth.logout" }
  | { name: "game.start"; game: string }
  | { name: "game.end"; game: string; durationMs: number };

export function track(event: Event) {
  try {
    env().ANALYTICS.writeDataPoint({
      blobs: [event.name, ...Object.values(event).filter(v => typeof v === "string") as string[]],
      doubles: Object.values(event).filter(v => typeof v === "number") as number[],
      indexes: [event.name],
    });
  } catch {
    // Never let analytics break a request
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add wrangler.jsonc src/lib/env.ts src/lib/analytics.ts
git commit -m "feat(observability): bind Analytics Engine + track() helper"
```

---

## Phase 6 — Testing

### Task 29: Install Vitest + workers pool + Playwright

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
npm install --save-dev vitest @cloudflare/vitest-pool-workers @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "build(test): add vitest + workers-pool + Playwright"
```

### Task 30: Configure `vitest.config.ts`

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
// vitest.config.ts
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc", environment: "preview" },
        miniflare: {
          compatibilityFlags: ["nodejs_compat", "global_fetch_strictly_public"],
        },
      },
    },
    setupFiles: ["./tests/setup.ts"],
  },
});
```

- [ ] **Step 2: Create `tests/setup.ts`** (empty starter)

```ts
// Hook for global test bootstrap. Empty for now.
```

- [ ] **Step 3: Add `npm test` script to `package.json`**

```json
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test"
```

- [ ] **Step 4: Run the existing rate-limit test**

```bash
npm test
```

Expected: `tests/integration/rate-limit.test.ts` passes.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts tests/setup.ts package.json
git commit -m "build(test): vitest config with workers pool"
```

### Task 31: Configure Playwright

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/smoke.spec.ts`

- [ ] **Step 1: Create `playwright.config.ts`**

```ts
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8787",
    trace: "on-first-retry",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : { command: "npm run dev:worker", url: "http://localhost:8787", reuseExistingServer: true },
});
```

- [ ] **Step 2: Create `tests/e2e/smoke.spec.ts`**

```ts
// tests/e2e/smoke.spec.ts
import { test, expect } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
});

test("health endpoint returns ok", async ({ page }) => {
  const res = await page.request.get("/api/health");
  expect(res.ok()).toBe(true);
  const json = await res.json();
  expect(json.ok).toBe(true);
});
```

- [ ] **Step 3: Run E2E**

```bash
npm run test:e2e
```

Expected: both tests pass.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts tests/e2e
git commit -m "test(e2e): Playwright smoke tests for home + health"
```

---

## Phase 7 — CI/CD

### Task 32: Create CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the file**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  lint-typecheck-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build:worker
      - run: npm run test:e2e
        env:
          PLAYWRIGHT_BASE_URL: ""
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add lint + typecheck + test + e2e workflow"
```

### Task 33: Create preview deploy workflow

**Files:**
- Create: `.github/workflows/deploy-preview.yml`

- [ ] **Step 1: Create the file**

```yaml
# .github/workflows/deploy-preview.yml
name: Deploy Preview

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  deploy-preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build:worker
      - name: Deploy to preview Worker
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy --env preview
      - name: Comment preview URL on PR
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: 'Preview: https://wenqian-dev-preview.<account>.workers.dev'
            })
```

> Replace `<account>` with the actual subdomain shown in `npx wrangler deploy --env preview` output.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy-preview.yml
git commit -m "ci: deploy each PR to preview Worker"
```

### Task 34: Create production deploy workflow

**Files:**
- Create: `.github/workflows/deploy-production.yml`

- [ ] **Step 1: Create the file**

```yaml
# .github/workflows/deploy-production.yml
name: Deploy Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production  # gate: requires manual approval if configured in repo settings
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: Apply pending migrations to production D1
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: d1 migrations apply wenqian-dev --remote
      - run: npm run build:worker
      - name: Deploy production Worker
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy --env production
      # Sentry source map upload happens via @sentry/nextjs build hooks
```

- [ ] **Step 2: USER ACTION — Configure GitHub repo settings**

Go to GitHub → Settings → Environments → New environment "production" → check "Required reviewers" → add yourself. This forces a manual click before each prod deploy (until you remove it).

- [ ] **Step 3: USER ACTION — Add GitHub Actions secrets**

GitHub → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value source |
|---|---|
| `CLOUDFLARE_API_TOKEN` | M2 |
| `CLOUDFLARE_ACCOUNT_ID` | M1 |
| `SENTRY_AUTH_TOKEN` | M4 |

- [ ] **Step 4: Set Worker secrets for preview env**

```bash
echo "<value>" | npx wrangler secret put BETTER_AUTH_SECRET --env preview
echo "<value>" | npx wrangler secret put RESEND_API_KEY --env preview
echo "<value>" | npx wrangler secret put GOOGLE_CLIENT_ID --env preview
echo "<value>" | npx wrangler secret put GOOGLE_CLIENT_SECRET --env preview
echo "<value>" | npx wrangler secret put GITHUB_CLIENT_ID --env preview
echo "<value>" | npx wrangler secret put GITHUB_CLIENT_SECRET --env preview
echo "<value>" | npx wrangler secret put SENTRY_DSN_SERVER --env preview
echo "https://wenqian-dev-preview.<account>.workers.dev" | npx wrangler secret put BETTER_AUTH_URL --env preview
```

(Repeat with `--env production` once production OAuth credentials and final domain URL are ready, in Task 47.)

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy-production.yml
git commit -m "ci: deploy main to production Worker, gated on manual approval"
```

### Task 35: Open a test PR to verify CI + preview deploy work

- [ ] **Step 1: Create a throwaway change on a branch**

```bash
git checkout -b test/ci-pipeline
echo "<!-- ci test -->" >> README.md
git add README.md
git commit -m "test: trigger CI"
git push -u origin test/ci-pipeline
```

- [ ] **Step 2: Open PR via web or `gh pr create`**

(Install `gh`: `brew install gh && gh auth login`.)

- [ ] **Step 3: Verify in GitHub PR view**

- CI workflow runs and passes (lint + typecheck + test + e2e).
- Preview deploy workflow runs and posts a preview URL comment.
- Open preview URL: app loads, `/api/health` returns ok.

- [ ] **Step 4: If everything passes — merge the PR**

The merge triggers `deploy-production.yml`, which is gated on manual approval. **Do NOT approve yet** — production migration to Workers happens in Phase 9.

If production approval auto-triggers anyway (e.g., gate not configured), the deploy will succeed but the domain `wenqian.dev` is still on Pages, so users won't see the new Worker. Safe.

- [ ] **Step 5: Clean up**

```bash
git checkout main && git pull
git branch -D test/ci-pipeline
```

---

## Phase 8 — Backups

### Task 36: Create the backup script (Worker entry point)

**Files:**
- Create: `src/app/api/internal/backup/route.ts`

> The Cron Trigger calls a Worker route. opennextjs's Worker is the same one that hosts the app, so we expose an internal route guarded by a shared-secret header.

- [ ] **Step 1: Create the file**

```ts
// src/app/api/internal/backup/route.ts
import { env } from "@/lib/env";

export const runtime = "edge";

export async function POST(req: Request) {
  // Cron Trigger uses the configured CRON_SECRET header
  const e = env() as unknown as Env & { CRON_SECRET: string };
  if (req.headers.get("x-cron-secret") !== e.CRON_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }

  const date = new Date().toISOString().slice(0, 10);
  const key = `backups/d1/${date}.sql`;

  // D1 dump via the binding's exportDump (if available) or via SQL SELECTs
  // Fallback: dump each table as INSERT statements (simple, works for our small DB)
  const tables = await e.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'"
  ).all<{ name: string }>();

  const chunks: string[] = [`-- D1 backup ${date}\n`];
  for (const { name } of tables.results) {
    const rows = await e.DB.prepare(`SELECT * FROM "${name}"`).all();
    chunks.push(`-- Table: ${name}\n`);
    for (const row of rows.results) {
      const cols = Object.keys(row).map(k => `"${k}"`).join(",");
      const vals = Object.values(row).map(v =>
        v === null ? "NULL" :
        typeof v === "number" ? String(v) :
        `'${String(v).replace(/'/g, "''")}'`
      ).join(",");
      chunks.push(`INSERT INTO "${name}" (${cols}) VALUES (${vals});\n`);
    }
  }

  const dump = chunks.join("");
  await e.BUCKET.put(key, dump, { httpMetadata: { contentType: "application/sql" } });
  return Response.json({ ok: true, key, bytes: dump.length });
}
```

> If your data grows past ~10 MB, switch to the streaming/chunked version (revisit per Section 15 risk).

- [ ] **Step 2: Add `CRON_SECRET` to `.dev.vars.example` and set as a secret**

```bash
echo "$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")" | tee /tmp/cron-secret
cat /tmp/cron-secret | npx wrangler secret put CRON_SECRET --env preview
cat /tmp/cron-secret | npx wrangler secret put CRON_SECRET --env production
rm /tmp/cron-secret
```

(Add `CRON_SECRET=` to `.dev.vars.example`; do not put the actual value there.)

- [ ] **Step 3: Add Cron Trigger to `wrangler.jsonc`** (each env)

```jsonc
"triggers": {
  "crons": ["0 3 * * *"]
}
```

- [ ] **Step 4: Add a `scheduled()` handler**

opennextjs needs to wire the `scheduled` event to your route. Edit `open-next.config.ts`:

```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Forward scheduled events to /api/internal/backup
  // (verify exact API at execution time — opennextjs docs evolve)
});
```

If opennextjs doesn't expose a hook for `scheduled()` in your version, the alternative is to deploy the cron handler as a **separate** small Worker (without opennextjs) sharing the D1 + R2 bindings. Document this fallback at execution time if needed.

- [ ] **Step 5: Manual smoke test**

```bash
curl -X POST http://localhost:8787/api/internal/backup -H "x-cron-secret: $(cat .dev.vars | grep CRON_SECRET | cut -d= -f2)"
```

Expected: `{"ok":true,"key":"backups/d1/<date>.sql","bytes":<n>}`

- [ ] **Step 6: Verify the object in R2**

```bash
npx wrangler r2 object get wenqian-dev-preview/backups/d1/<date>.sql --file /tmp/dump.sql
head /tmp/dump.sql
```

Expected: SQL statements you wrote.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/internal/backup wrangler.jsonc open-next.config.ts .dev.vars.example
git commit -m "feat(ops): nightly D1 → R2 backup via Cron Trigger"
```

### Task 37: Set R2 lifecycle policy (30-day retention for backups/)

> R2 lifecycle is configured via the dashboard or `wrangler r2 bucket lifecycle add`. CLI may differ by wrangler version.

- [ ] **Step 1: USER ACTION**

Cloudflare Dashboard → R2 → `wenqian-dev` (and `wenqian-dev-preview`) → Settings → Object lifecycle rules → Add rule:

- Prefix: `backups/`
- Action: Delete after 30 days

- [ ] **Step 2: Test restore procedure once (preview env only)**

Document in `docs/backend-dev.md` (Task 39):

```bash
# Restore from a backup
npx wrangler r2 object get wenqian-dev-preview/backups/d1/<date>.sql --file ./restore.sql
npx wrangler d1 execute wenqian-dev-preview --remote --file ./restore.sql
```

Run this against preview as a one-time exercise to confirm restore actually works.

- [ ] **Step 3: No commit needed (no file changes; manual step + verified procedure)**

---

## Phase 9 — Production cutover

> **STOP** before this phase if any earlier phase is incomplete or unstable.

### Task 38: Deploy production Worker (without switching the domain)

- [ ] **Step 1: USER ACTION — Set production Worker secrets**

```bash
# Generate a separate BETTER_AUTH_SECRET for production
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" | npx wrangler secret put BETTER_AUTH_SECRET --env production

# Production OAuth credentials (M5, M6 — production set)
echo "<prod-google-client-id>"     | npx wrangler secret put GOOGLE_CLIENT_ID     --env production
echo "<prod-google-client-secret>" | npx wrangler secret put GOOGLE_CLIENT_SECRET --env production
echo "<prod-github-client-id>"     | npx wrangler secret put GITHUB_CLIENT_ID     --env production
echo "<prod-github-client-secret>" | npx wrangler secret put GITHUB_CLIENT_SECRET --env production

# Resend
echo "<resend-api-key>" | npx wrangler secret put RESEND_API_KEY --env production

# Sentry server DSN (different project from frontend if you set it up that way)
echo "<sentry-server-dsn>" | npx wrangler secret put SENTRY_DSN_SERVER --env production

# Cron
echo "<same-or-different-cron-secret>" | npx wrangler secret put CRON_SECRET --env production

# Auth URL — must match the *eventual* production domain
echo "https://wenqian.dev" | npx wrangler secret put BETTER_AUTH_URL --env production
```

- [ ] **Step 2: Apply migrations to production D1**

```bash
npm run db:migrate:production
```

Expected: applies the auth migration. Production D1 now has empty `user`, `account`, `session`, `verification` tables.

- [ ] **Step 3: Deploy the production Worker**

```bash
npm run deploy:production
```

Expected: outputs a `https://wenqian-dev.<account>.workers.dev` URL. Note: domain still resolves Pages, this URL is reachable directly.

- [ ] **Step 4: Smoke-test the production Worker URL**

Open `https://wenqian-dev.<account>.workers.dev`:
- Home page loads
- `/api/health` returns ok (`db`, `kv`, `r2` all "ok")
- `/poker`, `/halli-galli`, `/transcribe` all load
- Sign-up via curl on the Worker URL works (creates a row in production D1 — you may want to delete the test row after)

If anything fails: STOP. Do not switch the domain. Debug and re-deploy.

- [ ] **Step 5: No commit needed**

### Task 39: Domain switch — `wenqian.dev` from Pages to Workers

> **High-risk step.** Brief downtime (< 1 minute) is possible. Have rollback plan ready.

- [ ] **Step 1: USER ACTION — Open Cloudflare Dashboard in two tabs**

Tab A: `wenqian.dev` Pages project → Custom domains
Tab B: `wenqian-dev` Worker (production) → Settings → Triggers → Custom domains

- [ ] **Step 2: USER ACTION — Remove `wenqian.dev` from Pages**

Tab A → click `wenqian.dev` → Remove domain. Confirm.

The site is briefly down (DNS still resolves, but no Worker / Pages claims the route).

- [ ] **Step 3: USER ACTION — Add `wenqian.dev` to Worker**

Tab B → "Add Custom Domain" → enter `wenqian.dev` → Add.

DNS propagation: < 1 min for the Cloudflare-managed name.

Repeat for `www.wenqian.dev` if applicable.

- [ ] **Step 4: USER ACTION — Verify**

Open `https://wenqian.dev` in incognito. Expected: site loads from the Worker. Check `/api/health` for ok.

If broken: rollback by reversing — remove from Worker, re-add to Pages. (Document expected pages-redeploy timing in case it's not instant.)

- [ ] **Step 5: Watch for 30 minutes**

Monitor:
- Sentry for new errors
- Cloudflare Dashboard → Worker analytics for traffic / error rates
- Manual sanity checks on real pages

- [ ] **Step 6: USER ACTION — After 24 hours stable, archive the Pages project**

Cloudflare Dashboard → Pages project → Settings → Pause production deployments. (Don't delete yet — keep as DR for 30 days, then delete.)

- [ ] **Step 7: No commit needed**

---

## Phase 10 — Documentation

### Task 40: Write `docs/backend-dev.md`

**Files:**
- Create: `docs/backend-dev.md`

- [ ] **Step 1: Create the file**

```markdown
# Backend Developer Guide

How to work on `wenqian.dev`'s backend (Cloudflare Workers + D1 + Drizzle + Better-Auth).

## Quick start

```bash
git clone git@github.com:JamesZwq/wenqian-dev.git
cd wenqian-dev
npm install
cp .dev.vars.example .dev.vars   # then fill in real values
npm run db:migrate:local
npm run dev:worker
```

Open `http://localhost:8787`. `/api/health` should return `{"ok":true}`.

## Common commands

| Command | What it does |
|---|---|
| `npm run dev` | Standard Next.js dev server (no bindings — mocked DB will fail) |
| `npm run dev:worker` | Build for Workers + run miniflare on `:8787` (real bindings, real local D1) |
| `npm run build:worker` | Build only |
| `npm run deploy:preview` | Deploy to the shared preview Worker |
| `npm run deploy:production` | Deploy to production (use CI instead) |
| `npm run db:generate` | Generate a migration from schema diffs |
| `npm run db:migrate:local` | Apply migrations to local miniflare D1 |
| `npm run db:migrate:preview` | Apply migrations to preview D1 (remote) |
| `npm run db:migrate:production` | Apply migrations to production D1 (remote) |
| `npm run db:studio` | Open Drizzle Studio at localhost:4983 |
| `npm test` | Vitest (uses `@cloudflare/vitest-pool-workers`) |
| `npm run test:e2e` | Playwright |
| `npm run lint` | ESLint |
| `npm run typecheck` | tsc --noEmit |

## Environments

| Env | Worker | DB | Domain |
|---|---|---|---|
| local | miniflare via `wrangler dev` | local miniflare D1 | `localhost:8787` |
| preview | `wenqian-dev-preview` | `wenqian-dev-preview` | `*.workers.dev` (CI deploys per PR) |
| production | `wenqian-dev` | `wenqian-dev` | `wenqian.dev` |

## Adding a new table

1. Create or edit a file under `src/db/schema/<feature>.ts`. Export tables.
2. Re-export from `src/db/schema/index.ts`.
3. `npm run db:generate` — drizzle-kit writes a SQL file to `src/db/migrations/`.
4. Inspect the SQL — make sure it does what you expect.
5. `npm run db:migrate:local` to apply locally; if it works, commit.
6. CI applies preview migration on PR open; production migration on merge to main.

## Adding a secret

Local: edit `.dev.vars`.
Remote: `npx wrangler secret put <NAME> --env preview` (or `production`).

Never commit `.dev.vars`. Update `.dev.vars.example` to document the new secret name (no value).

## Restoring from a backup

```bash
# Pick a backup
npx wrangler r2 object list wenqian-dev/backups/d1/

# Download
npx wrangler r2 object get wenqian-dev/backups/d1/<date>.sql --file ./restore.sql

# Apply (production — DESTRUCTIVE; consider applying to preview first)
npx wrangler d1 execute wenqian-dev --remote --file ./restore.sql
```

## When something is broken in production

1. Cloudflare Dashboard → Worker → Logs → tail in real time
2. Sentry for stack traces
3. Quick rollback: redeploy the previous Worker version via Cloudflare Dashboard → Worker → Deployments → Rollback to previous

## Testing against real bindings

`@cloudflare/vitest-pool-workers` runs tests inside an isolated miniflare instance. Tests can `import { env } from "cloudflare:test"` and write/read D1 / KV / R2 directly. See `tests/integration/rate-limit.test.ts` for an example.

```

- [ ] **Step 2: Commit**

```bash
git add docs/backend-dev.md
git commit -m "docs: backend developer guide"
```

---

## Self-review checklist

- [ ] All eight Section 2 goals from the spec map to tasks (Task 1–6 = goal 1; Task 7–13 = goal 3; Task 14–20 = goal 4; Task 21–22 = goal 2; Task 25–28 = goal 5; Task 32–35 = goal 6; Task 36–37 = goal 7; Task 40 = goal 8)
- [ ] All Section 3 non-goals respected (no Apple, no DO, no server-side image processing, no pgvector)
- [ ] Section 14 migration plan implemented as Phase 9 with explicit rollback path
- [ ] Section 15 risk #1 addressed by Task 0 (compatibility check before touching the real repo)
- [ ] Section 11 observability covered by Tasks 25–28
- [ ] Section 12 CI/CD covered by Tasks 32–35
- [ ] Section 13 backups covered by Tasks 36–37
- [ ] Manual steps clearly tagged "USER ACTION"
- [ ] Every code step shows actual code, every command step shows actual command, every verify step shows expected output
- [ ] Method/property names are consistent: `getDb()`, `env()`, `auth()`, `track()`, `rateLimit()`

## What ships next

After this foundation lands:
1. Brainstorm + spec **E (user system)** — sign-in/sign-up UI, profile page, account settings, account deletion endpoint, avatar upload UI per Section 9.
2. Then **B (leaderboards)**, **A (sync)**, **C (admin)**, **D' (lightweight rooms)** in that order.

Each gets its own `docs/superpowers/specs/<date>-<feature>-design.md` and `docs/superpowers/plans/<date>-<feature>.md`.
