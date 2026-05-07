# Backend Foundation — Design Spec

**Date:** 2026-05-07
**Status:** Draft, awaiting user review
**Scope:** Infrastructure / foundation slice ONLY. The five user-facing features (B leaderboards, C admin/CMS, A cross-device sync, E user system, D' lightweight multiplayer rooms) each get their own spec on top of this foundation.

## 1. Why this slice exists

The site (`wenqian.dev`) currently has no backend, no database, and no user identity. To unlock the five planned features, we need a one-time foundation: runtime, DB, ORM, auth, storage, email, observability, CI/CD, secrets, and multi-environment setup.

This spec exists to make those decisions **once**, document the rationale, and be deliberate about what stays out of scope. Each subsequent feature spec will assume — and not re-litigate — these choices.

The user accepted a serial delivery model: ship this foundation, then E (user system), then B (leaderboards), then A (sync), then C (admin), then D' (lightweight rooms). Each gets its own spec → plan → ship cycle. This spec covers only the foundation.

## 2. Goals

1. Migrate from Cloudflare Pages auto-detection to Cloudflare Workers + `@opennextjs/cloudflare`, with zero data loss and minimal downtime on `wenqian.dev`.
2. Provision and bind D1, Workers KV, and R2 across local / preview / production environments, version-controlled in `wrangler.jsonc`.
3. Establish a working Drizzle + drizzle-kit migration workflow against D1, with `npm run db:*` scripts.
4. Wire Better-Auth with the Drizzle + D1 adapter, supporting:
   - Email + password (magic-link variant configurable later)
   - Google OAuth
   - GitHub OAuth
   - Email transactional sending via Resend
   - Email verification + password reset flows scaffolded but not yet exposed in UI (UI lands with feature E spec)
5. Wire Sentry (errors) and Workers Analytics Engine (business events) with a tiny shared logging helper used by both client and server code.
6. Add GitHub Actions CI: lint, typecheck, test (Vitest + `@cloudflare/vitest-pool-workers`), Playwright E2E smoke, and deploy-on-merge with per-PR preview Workers.
7. Add a nightly Cron Trigger that exports D1 to R2 and applies a 30-day lifecycle policy.
8. Document the developer workflow (local setup, common commands, how to run tests against real D1) in `docs/backend-dev.md`.

The foundation is "done" when:
- `wenqian.dev` serves from Workers (not Pages), with all existing routes working identically.
- A new contributor can clone, run `npm install && npm run setup && npm run dev`, and have a working local environment with seeded D1.
- A PR triggers preview deploy, runs CI, and opens with a clickable preview URL.
- A merge to `main` deploys to production automatically.
- Auth library is wired but no user-facing auth UI exists yet (that ships with feature E).

## 3. Non-goals

- Implementing any of the five user-facing features (B/A/C/E/D'). Each gets its own spec.
- Apple Sign In. Rejected: requires $99/year Apple Developer Program, and `@privaterelay.appleid.com` complicates email-based account merging.
- Durable Objects. Rejected: requires Workers Paid plan ($5/month). D' will be P2P + D1 metadata instead.
- Server-side image processing. The user explicitly asked that image work happen client-side; Workers CPU is too tight for it.
- Full-text search, pgvector, or analytics warehousing. None of the planned features need them. If a future feature does, that feature's spec will introduce a separate service (likely Neon for Postgres + pgvector) — not retrofit it into the main DB.
- Self-hosted PeerJS broker. Possible later as part of D' spec; out of scope here.
- Multi-region replication. D1 has read replicas now in beta but the user is in a single region; latency budget is fine.

## 4. Architecture overview

```
┌────────────────────────────────────────────────────────────────────┐
│  wenqian.dev  →  Cloudflare Workers (single Worker, opennextjs)    │
│                                                                    │
│  Next.js 16 App Router                                             │
│  ├─ Server Components (Edge / Workers runtime)                     │
│  ├─ Client Components                                              │
│  ├─ Route Handlers (/api/*)                                        │
│  └─ /api/auth/[...all]  ← Better-Auth catch-all                    │
│                                                                    │
│  Bindings (declared in wrangler.jsonc):                            │
│  ├─ DB    : D1   (SQLite)         — relational data                │
│  ├─ KV    : Workers KV            — sessions cache, rate limits    │
│  ├─ R2    : R2 bucket             — avatars, D1 backups            │
│  ├─ ANALYTICS : Analytics Engine  — business events                │
│  └─ Cron  : "0 3 * * *"           — nightly D1 → R2 backup         │
│                                                                    │
│  Secrets (wrangler secret put):                                    │
│  ├─ BETTER_AUTH_SECRET                                             │
│  ├─ RESEND_API_KEY                                                 │
│  ├─ GOOGLE_CLIENT_SECRET                                           │
│  ├─ GITHUB_CLIENT_SECRET                                           │
│  └─ SENTRY_DSN_SERVER                                              │
└────────────────────────────────────────────────────────────────────┘
                           │                          │
                           ▼                          ▼
              ┌─────────────────┐         ┌────────────────────┐
              │   Resend (SMTP) │         │  Sentry (errors)   │
              └─────────────────┘         └────────────────────┘

WebRTC P2P (existing) stays as-is for poker / halli-galli / pattern.
D' will later sit a thin D1 metadata layer in front of it (separate spec).
```

## 5. Technology choices (with rationale)

| Layer | Choice | Why | Alternatives rejected and why |
|---|---|---|---|
| Runtime | Cloudflare Workers + `@opennextjs/cloudflare` | Cloudflare's official supported path for Next.js 15+; full Node.js compat; bindings in version control; needed for Cron + future DO if ever upgraded | Pages auto-detect (uses legacy `next-on-pages`, Edge-only, bindings in dashboard, future-uncertain); `next-on-pages` directly (legacy maintenance mode) |
| DB | Cloudflare D1 | Native binding, free tier covers projected usage by 50×, Drizzle support is first-class, no external service to fail | Neon Postgres (overkill for current needs, adds a network hop); Turso (good but no native binding); Supabase (bundled auth conflicts with Better-Auth choice) |
| ORM / migrations | Drizzle + drizzle-kit | TS-first, schema-as-code, reviewable migrations, supported by Better-Auth's adapter | Prisma (heavy code-gen, edge support patchy); raw SQL (no migration story) |
| Validation | Zod | De-facto standard; `drizzle-zod` derives schemas from tables; Better-Auth uses Zod internally | Valibot (smaller but ecosystem support is weaker for our deps) |
| Auth | Better-Auth | Self-hosted (data stays in our D1), official Drizzle + D1 adapter, Workers-compatible, active maintenance, Zod-based, supports email + Google + GitHub OAuth out of the box | Auth.js / NextAuth (long-running edge compat issues, session model heavy); Clerk (paid, vendor-locks user data); Lucia (project transitioning, not stable target) |
| Realtime | WebRTC P2P (existing PeerJS) | Already working, zero server cost, low latency | Workers + WebSocket without DO (impossible — isolates can't share state); Pusher / Ably (free tier limits, external dep); paid Durable Objects (rejected on cost) |
| Object storage | R2 | Native binding, zero egress, generous free tier | Cloudflare Images (paid); S3 (egress fees, external) |
| Cache / sessions / rate-limit counters | Workers KV | Native, fast reads, fits sessions and counters; 1k writes/day is enough because Better-Auth sessions are mostly read | Upstash Redis (external, free tier limits); D1 (slower for hot reads) |
| Email | Resend | Cloudflare-friendly DX, 3000/month free, good DKIM/SPF setup story | Postmark (no free tier); SendGrid (heavy, dated); SES (AWS account overhead) |
| Errors | Sentry | Free 5k errors/month, frontend + backend in one place, Workers integration documented | LogRocket (paid for backend), Better Stack (smaller free tier) |
| Business events / metrics | Workers Analytics Engine | 10M events/month free, queryable via SQL in dashboard, native binding | PostHog (heavier, frontend-focused), self-hosted Plausible (server to run) |
| CI/CD | GitHub Actions + Wrangler | Universal, free for public repos, Cloudflare provides official action | CircleCI (paid for usefulness), self-hosted runners (overhead) |
| Testing | Vitest + `@cloudflare/vitest-pool-workers` + Playwright | Workers pool runs tests against real D1 / KV / R2 (isolated), avoids mock/prod divergence; Playwright is the standard for E2E | Jest (slower, no Workers integration); manual mocks of bindings (mock/prod divergence risk) |
| Backups | Workers Cron + `wrangler d1 export` → R2 | Free, scheduled, retention via R2 lifecycle policy | Manual exports (forgettable), paid backup services |
| Rate limiting | Cloudflare Rate Limiting Rules (edge) + KV counters (per-user, application-level) | Edge layer free for basic patterns; KV gives per-user granularity | Cloudflare Turnstile (CAPTCHA, different problem); Upstash rate limiting (external) |

## 6. Project layout

```
my-web/
├─ wrangler.jsonc                  ← runtime config, bindings, env
├─ open-next.config.ts             ← @opennextjs/cloudflare config
├─ .dev.vars                       ← LOCAL secrets (gitignored)
├─ .dev.vars.example               ← committed template
├─ src/
│  ├─ app/                         ← (existing Next.js app)
│  │  └─ api/auth/[...all]/route.ts ← Better-Auth catch-all
│  ├─ db/
│  │  ├─ schema/                   ← one file per table group
│  │  │  ├─ auth.ts                ← users, accounts, sessions, verification
│  │  │  └─ index.ts               ← re-exports
│  │  ├─ client.ts                 ← getDb(env) → DrizzleD1Database
│  │  └─ migrations/               ← generated by drizzle-kit
│  ├─ lib/
│  │  ├─ auth.ts                   ← Better-Auth server config
│  │  ├─ auth-client.ts            ← Better-Auth client SDK setup
│  │  ├─ env.ts                    ← typed env binding accessor
│  │  ├─ analytics.ts              ← writeDataPoint() helper
│  │  ├─ logger.ts                 ← Sentry-aware logger
│  │  └─ rate-limit.ts             ← KV-backed rate limiter
│  └─ ...
├─ scripts/
│  └─ backup-d1.ts                 ← invoked by Cron Trigger
├─ tests/
│  ├─ integration/                 ← uses vitest-pool-workers
│  └─ e2e/                         ← Playwright
├─ drizzle.config.ts
├─ vitest.config.ts
├─ playwright.config.ts
├─ docs/
│  └─ backend-dev.md               ← workflow handbook (NEW)
└─ .github/
   └─ workflows/
      ├─ ci.yml                    ← lint + typecheck + test on PR
      ├─ deploy-preview.yml        ← preview Worker per PR
      └─ deploy-production.yml     ← deploy on merge to main
```

## 7. Multi-environment strategy

`wrangler.jsonc` declares three named environments:

| Env | Worker name | DB | KV namespace | R2 bucket | Domain |
|---|---|---|---|---|---|
| local | (miniflare in `wrangler dev`) | local D1 (sqlite file) | local namespace | local bucket | `localhost:3000` |
| preview | `wenqian-dev-preview-<pr>` | `wenqian-dev-preview` D1 (one shared, reset weekly) | preview namespace | preview bucket | `<pr>-wenqian-dev.workers.dev` |
| production | `wenqian-dev` | `wenqian-dev` D1 | production namespace | `wenqian-dev` bucket | `wenqian.dev` |

Each environment has its own secrets set via `wrangler secret put --env <env>`. Preview and production OAuth apps are separate (different client IDs / redirect URIs).

## 8. Schema (foundation only — features add their own tables)

Better-Auth's Drizzle adapter generates these. We commit the migration so it's reviewable:

```ts
// src/db/schema/auth.ts (sketch — exact columns from Better-Auth adapter)
users        (id PK, email UNIQUE, emailVerified, name, image, createdAt, updatedAt)
accounts     (id PK, userId FK, providerId, providerAccountId, accessToken, ...)
sessions     (id PK, userId FK, expiresAt, token UNIQUE, ipAddress, userAgent)
verification (id PK, identifier, value, expiresAt)
```

Future feature specs add tables like `leaderboards`, `match_history`, `papers`, `lobby_presence` — each in its own `schema/<feature>.ts` file.

## 9. Avatar handling

Per user direction, all image work is client-side. Server's job is to validate and store.

**Client (browser):**
1. User picks file via `<input type="file" accept="image/*">`. Hard-cap at 5 MB pre-resize.
2. Read into `<canvas>`, resize to fit 256×256 (preserving aspect, center-crop).
3. `canvas.toBlob('image/webp', 0.85)`.
4. Verify resulting blob ≤ 50 KB; if larger (rare), retry at 0.7 quality.
5. POST to `/api/profile/avatar` (authenticated).

**Server (Worker):**
- Reject if `Content-Length > 100 KB` (double-check, not trust client).
- Verify MIME ∈ {image/webp, image/jpeg, image/png} via header.
- Verify file's magic bytes match the claimed MIME.
- Rate limit: 20 uploads / user / day (KV counter).
- Write to R2 at `avatars/<userId>/<uuid>.webp`.
- Update `users.image` with the R2 public URL.
- Old avatar (if any) is deleted from R2 in the same handler.

**Default avatar (no upload):**
- Initials-based SVG generated client-side from user's display name. Stored as `null` in DB; UI renders the SVG inline. Zero R2 storage for users who never upload.

## 10. Security & abuse mitigation (foundation level)

- All write endpoints require auth, except register/login.
- CSRF: Better-Auth handles via SameSite cookies + CSRF token where applicable.
- Rate limits (KV-backed):
  - Login attempts: 5 / IP / 5 min
  - Registration: 5 / IP / hour
  - Password reset request: 3 / email / hour
  - Avatar upload: 20 / user / day
  - Generic write: 60 / user / minute (per-feature specs may tighten)
- Cloudflare's edge rate limiting handles raw flood (configured via dashboard, version-controlled via Terraform later if needed — NOT in this slice).
- Secrets never in repo. `.dev.vars` is `.gitignore`d. CI uses GitHub Actions encrypted secrets.
- Account deletion: a `DELETE /api/account` route purges D1 rows + R2 avatar. Required for E spec; foundation just ensures the data model supports cascade deletes.

## 11. Observability

Two axes:

**Errors → Sentry:**
- Frontend: `@sentry/nextjs` integration; DSN public-safe.
- Backend (Workers): `@sentry/cloudflare` (or `toucan-js` if `@sentry/cloudflare` doesn't yet support opennextjs cleanly); secret DSN.
- Source maps uploaded by CI on production deploys.

**Business events → Workers Analytics Engine:**
- Single helper `track(event, fields)` writes a data point.
- Used for: signups, logins, OAuth provider mix, game starts, leaderboard submits, error tags etc. Each feature spec will list its events.
- Queried via SQL in Cloudflare Dashboard ("how many people played poker last week").

No OpenTelemetry, no distributed tracing. Overkill for this site.

## 12. CI/CD

`.github/workflows/ci.yml` (runs on every PR):
1. Install deps (`npm ci`)
2. Lint (`npm run lint`)
3. Typecheck (`npx tsc --noEmit`)
4. Unit + integration tests (`npm test` — Vitest with workers pool)
5. Playwright E2E (against a temp `wrangler dev`)

`.github/workflows/deploy-preview.yml` (runs on PR open/update):
- Deploy to a unique `wenqian-dev-preview-pr<N>.workers.dev` URL
- Bot-comment the URL on the PR

`.github/workflows/deploy-production.yml` (runs on merge to main):
- Deploy to production Worker bound to `wenqian.dev`
- Run drizzle-kit migrate against production D1 (with explicit approval gate via `environment: production` requiring manual approval)
- Upload Sentry source maps

GitHub Actions secrets needed:
- `CLOUDFLARE_API_TOKEN` (scoped: Workers Edit, D1 Edit, R2 Edit, KV Edit)
- `CLOUDFLARE_ACCOUNT_ID`
- `SENTRY_AUTH_TOKEN` (for source map upload)

## 13. Backups

`scripts/backup-d1.ts` is a Worker invoked by Cron Trigger nightly at 03:00 UTC:
1. `D1.exportDump()` → SQL text
2. Write to R2 at `backups/d1/<YYYY-MM-DD>.sql.gz` (gzip in-Worker, fits in CPU budget for the data size we'll have).
3. R2 lifecycle policy deletes objects under `backups/` after 30 days.

Restore procedure documented in `docs/backend-dev.md`. Tested manually in preview environment as part of foundation acceptance.

## 14. Migration plan: Pages → Workers

Goal: minimal downtime. The plan, in order:

1. Install `@opennextjs/cloudflare`, `wrangler`, drizzle, etc. Verify local build works.
2. Write `wrangler.jsonc` with **no bindings yet** — just the Worker entry. Deploy to a `*.workers.dev` URL.
3. Manual verification: every existing page and `/api/*` route works on the `*.workers.dev` URL.
4. Add D1, KV, R2 bindings (preview env first). Re-deploy preview. Verify health endpoint.
5. Provision production D1, KV, R2. Push initial schema migration to production D1.
6. Set production secrets (`wrangler secret put --env production`).
7. Deploy production Worker. Verify on `*.workers.dev`.
8. **Domain switch:** in Cloudflare dashboard, remove `wenqian.dev` custom domain from Pages project, add it to the Worker. Propagation < 1 min.
9. Watch for 5 minutes. If broken: re-add to Pages (instant rollback).
10. Once stable for 24h: archive the Pages project (do not delete — keep as DR for 30 days).

If rollback needed mid-deployment: domain back to Pages is one click. Worse case, manual edit of CNAME.

## 15. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `@opennextjs/cloudflare` doesn't fully support Next.js 16 yet | Medium | High (blocks the whole slice) | Verify with a hello-world Next.js 16 + opennextjs build BEFORE migration. If broken, hold migration until adapter catches up; this slice pauses (do not proceed to feature specs on Pages). |
| D1 query latency over what's expected | Low | Medium | D1 is in same region as Worker; benchmarks show < 5 ms. Mitigated by KV cache for hot reads. |
| Better-Auth has a Drizzle + D1 adapter bug or missing feature | Low | Medium | We commit to use Better-Auth ≥ stable version; if blocked, fork-and-fix is feasible (it's open source) or fall back to Auth.js with Edge-compat workarounds. |
| Apple-style users complain we don't have Apple Sign In | Low | Low | Decision documented; revisit if/when Apple Developer cost is justifiable. |
| GitHub Actions free tier exhausted on a public repo | Very low | Low | Public repos have effectively unlimited minutes. |
| Frontend image compression bypassed (malicious upload) | Low | Medium | Server enforces 100 KB hard limit + magic-byte check + per-user rate limit. |
| Sentry free tier exhausted by a runaway error | Low | Low | Sentry's quota guard drops samples cleanly; we set `tracesSampleRate: 0.1`. |
| D1 backup script CPU budget exceeded as data grows | Low | Medium | Acceptable as long as data is small (< 50 MB); larger data means switching to streaming + chunked R2 writes — revisit when D1 hits 10 MB. |

## 16. Cost (monthly)

| Item | Cost |
|---|---|
| Cloudflare Workers, D1, KV, R2, Analytics Engine, Cron | $0 (free tier) |
| Resend (≤ 3000 emails/month) | $0 |
| Sentry (≤ 5000 errors/month) | $0 |
| GitHub Actions (public repo) | $0 |
| Apple Sign In | rejected |
| Durable Objects (D' uses P2P instead) | $0 |
| **Foundation total** | **$0/month** |

## 17. Open questions (none currently blocking)

None — all decisions taken in brainstorming. New questions surfaced during implementation get raised back to user.

## 18. What ships next, after this foundation

In order: **E (user system)** → **B (leaderboards)** → **A (cross-device sync)** → **C (admin)** → **D' (lightweight rooms)**. Each gets its own brainstorm → spec → plan cycle, building strictly on what this foundation provides.
