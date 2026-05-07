# Feature E — User System — Design Spec

**Date:** 2026-05-07
**Status:** Draft, awaiting user review
**Builds on:** [`docs/superpowers/specs/2026-05-07-backend-foundation-design.md`](./2026-05-07-backend-foundation-design.md)

## 1. Why this slice exists

Foundation laid down the auth backend (Better-Auth + D1 user/session/account/verification tables, /api/auth/[...all] catch-all, Resend, BETTER_AUTH_URL) but no user-facing UI. Feature E adds the UI + a few small backend additions so a real visitor can sign up, sign in, manage their account, and become identifiable. This unlocks every subsequent feature: B (leaderboards) needs identity to attach scores to, A (cross-device sync) needs identity to sync against, C (admin) needs the admin role concept, D' (rooms) needs identity for match history.

## 2. Goals

1. Visitors can create an account on `wenqian.dev` via a public sign-up page (email + password + username + display name) and verify ownership of the email via a Resend-delivered link.
2. Returning visitors sign in with **email or username** + password.
3. Visitors who forget their password can reset it via a Resend-delivered link.
4. Signed-in users see a top-right widget on desktop showing their avatar/name, with a dropdown to Profile / Settings / Admin (if admin) / Sign out. On mobile, the same widget appears only on the home page (game pages stay clutter-free).
5. Signed-in users can view their own profile at `/profile` (avatar, username, name, masked email, signup date) and edit it at `/settings` (name, username, avatar, email, password, delete account).
6. Avatars are uploaded with **client-side WebP compression to ≤ 50 KB**, validated server-side, and stored in R2 at `avatars/<userId>/<uuid>.webp`. Default avatar is a client-side-generated initials SVG; zero storage cost for users who never upload.
7. Account deletion **anonymises** the user row (PII fields cleared, sessions destroyed, R2 avatar deleted) instead of hard-deleting — keeps foreign-key integrity for future leaderboards / match history without coupling deletion semantics to those features.
8. Exactly one admin: the user whose email matches `ADMIN_EMAIL` (Worker secret). All admin gating uses this single check; no role table.
9. Every new page uses framer-motion entry/exit animations and the project's existing `--pixel-*` design tokens; the user system feels native to the rest of the site, not bolted on.
10. Unverified-email users can sign in and browse, but **all write endpoints reject** their requests with 403 until they verify. Front-end nudges them.

The slice is "done" when:
- A new visitor signs up via UI, gets a verification email from `noreply@wenqian.dev`, clicks the link, lands signed-in on `/profile`.
- They edit their name + upload an avatar from Settings; both persist + display.
- They sign out, sign back in, are recognised.
- They request a password reset, follow the email, set a new password, sign in with it.
- They delete their account; subsequent sign-in attempts fail; their R2 avatar is gone.
- The user with `email === ADMIN_EMAIL` sees an "Admin" item in the user widget dropdown; everyone else does not.

## 3. Non-goals

- **OAuth providers (Google, GitHub).** Out of scope; the foundation already wires them defensively (auto-skip if creds absent), so adding them later is purely "set the secret + add the button". Not part of v1.
- **Public profile pages** (others viewing your profile). YAGNI — only own-profile in v1. Likely surfaced as part of Feature B (leaderboards) when it's natural.
- **Multi-admin / admin invites.** Single admin = email match. If we ever need a second admin, swap to a `users.role` column + manual SQL update; ~15 minutes of work then.
- **Two-factor / TOTP / passkey.** Better-Auth supports passkeys via plugin; deferred unless a concrete threat justifies the UX cost.
- **Session per-device management UI.** Better-Auth has `/api/auth/sessions` underneath; we don't expose a UI to view/revoke individual sessions in v1.
- **Account merging** across providers. Not needed since OAuth is out of scope.
- **Email change without re-verification.** v1 forces re-verification on email change.
- **Username history / handle squatting protection.** v1 frees old usernames as soon as they're released; no reservation period.
- **Rate-limit dashboard.** We use the foundation's `rateLimit()` helper but don't expose limits in any UI.

## 4. Architecture overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Client                                                                       │
│  ├─ /sign-up          ┐                                                       │
│  ├─ /sign-in          │  All call Better-Auth client SDK from auth-client.ts. │
│  ├─ /forgot-password  │  No custom auth network code on the client beyond     │
│  ├─ /reset-password   │  what better-auth/react provides.                     │
│  ├─ /verify-email     ┘                                                       │
│  ├─ /profile           — read-only view of own user; uses useSession()        │
│  ├─ /settings          — write: PATCH /api/account/* + Better-Auth endpoints  │
│  ├─ <UserWidget>       — top-right; renders Sign In | Avatar+menu             │
│  ├─ <AvatarPicker>     — file picker → canvas resize → upload                 │
│  └─ <RequireAuth>      — server-component guard for protected routes          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ HTTPS
┌─────────────────────────────────────────────────────────────────────────────┐
│ Worker (existing main Worker)                                                │
│  ├─ /api/auth/[...all]            — Better-Auth catch-all (existing)          │
│  ├─ /api/account/avatar  POST     — multipart upload, validate, write R2      │
│  ├─ /api/account/avatar  DELETE   — clear user.image, delete R2 object        │
│  └─ /api/account         DELETE   — anonymize the requester's user row        │
│                                                                              │
│  Bindings used: DB, BUCKET, CACHE (rate limiting), ANALYTICS                  │
│  Secrets used : BETTER_AUTH_SECRET, RESEND_API_KEY, RESEND_FROM,              │
│                 BETTER_AUTH_URL, ADMIN_EMAIL (NEW)                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 5. Schema changes

Better-Auth's `username` plugin adds two columns to the `user` table:

```sql
-- generated by `npx @better-auth/cli generate`
ALTER TABLE user ADD COLUMN username TEXT;
ALTER TABLE user ADD COLUMN displayUsername TEXT;
CREATE UNIQUE INDEX user_username_unique ON user(username);
```

We commit the generated Drizzle migration to `src/db/migrations/`.

`username` stores the **lowercase canonical form** (used for uniqueness + login-by-username). `displayUsername` stores the user's chosen casing for display (e.g., they signed up as "Wenqian" but `username = "wenqian"`).

No new tables in v1.

## 6. Pages

| Route | Purpose | Public? |
|---|---|---|
| `/sign-up` | Email + username + display name + password form | yes (redirect signed-in users to `/profile`) |
| `/sign-in` | Email-or-username + password form | yes (redirect signed-in users to `/profile`) |
| `/forgot-password` | "Enter your email" → triggers reset email | yes |
| `/reset-password?token=…` | New-password form (token from email) | yes |
| `/verify-email?token=…` | Lands here from verification email; on success → `/profile` | yes |
| `/profile` | Read-only view of own data | requires auth (signed-in OR unverified) |
| `/settings` | Edit form; tabs for Account / Avatar / Email / Password / Delete | requires auth + verified email for write submits |
| (existing pages) | Untouched | — |

## 7. Components

```
src/app/
  (auth)/                          ← grouping; not a route segment
    sign-up/page.tsx
    sign-in/page.tsx
    forgot-password/page.tsx
    reset-password/page.tsx
    verify-email/page.tsx
    layout.tsx                     ← shared centered-card layout for auth pages
  profile/page.tsx
  settings/page.tsx
  api/
    account/
      avatar/route.ts              ← POST + DELETE
      route.ts                     ← DELETE (anonymize)

src/components/auth/                ← all shared auth UI lives here
  UserWidget.tsx                   ← header widget; responsive logic inside
  AuthCard.tsx                     ← outer card with pixel/retro framing
  EmailField.tsx, PasswordField.tsx, UsernameField.tsx
  AvatarPicker.tsx                 ← file picker + canvas resize
  InitialsAvatar.tsx               ← SVG fallback (default avatar)
  VerifyEmailBanner.tsx            ← shows on every page when emailVerified === false
  RequireAuth.tsx                  ← server component; redirects if unauthed

src/lib/
  username.ts                      ← validation / canonicalisation / reserved words
  is-admin.ts                      ← session.user.email === env.ADMIN_EMAIL
```

Each file has one clear purpose. `<UserWidget>` decides desktop-vs-mobile internally (CSS media query + `useIsMobile` hook for the home-only branch). `<AuthCard>` is the consistent retro frame for auth pages. `<AvatarPicker>` is reusable in both Settings and (future) onboarding.

## 8. Auth state UI placement

**Desktop (≥md, 768 px):** `<UserWidget>` is rendered in the root layout, fixed top-right (mirroring `FloatingNav` on the left). Visible on every page. States:
- Unauthed: "SIGN IN" button → links to `/sign-in?next=<current-path>`.
- Authed: avatar circle (initials SVG fallback) + dropdown on click. Dropdown items: display name + username (header) → Profile → Settings → Admin (if admin) → Sign out.
- Authed-but-unverified: same widget, plus a tiny ⚠ overlay on the avatar.

**Mobile (<md):** `<UserWidget>` only renders when the current pathname is `/`. Detected via `usePathname()`. On any other route the widget is hidden — game pages keep their existing top-right BACK + ShareButton + (poker) sound mute layout uncluttered.

## 9. Email verification gating

`session.user.emailVerified` is the gate. Implementation:

- **Read endpoints** (own profile, own avatar URL, etc.) — allowed for unverified users.
- **Write endpoints** — every `/api/account/*` (incl. avatar upload, delete account) and every future feature's write endpoint guards: `if (!session.user.emailVerified) return new Response("Email not verified", { status: 403 })`.
- A small server-side helper `requireVerifiedSession(req)` returning `{ user } | Response` keeps this single-line in route handlers.
- On the client, `<VerifyEmailBanner>` renders globally for unverified users — small bar at the very top, not dismissible, with "Resend email" button (rate-limited).

## 10. Avatar handling (concrete spec)

**Client (`<AvatarPicker>`):**
1. `<input type="file" accept="image/*">`. Pre-resize hard-cap: file.size ≤ 5 MB.
2. Read into `<canvas>`; resize to fit 256 × 256 (preserve aspect, center-crop).
3. `canvas.toBlob('image/webp', 0.85)`.
4. If resulting blob > 50 KB, retry at quality 0.7. If still > 50 KB, retry at 0.55. Surface error if even 0.55 fails.
5. POST as multipart to `/api/account/avatar`. Show optimistic preview during upload.
6. On success, server returns `{ url: string }`; client updates session-derived avatar URL.

**Server (`POST /api/account/avatar`):**
1. Reject if not authed → 401. Reject if not verified → 403.
2. `Content-Length > 100 KB` → 413. (Double-check; client may be malicious.)
3. Read multipart; pull the `file` part. Verify Content-Type ∈ `{ image/webp, image/jpeg, image/png }`.
4. Read first 8 bytes; verify magic bytes match the claimed MIME (WebP = `RIFF…WEBP`, JPEG = `FF D8 FF`, PNG = `89 50 4E 47`).
5. Per-user rate limit via `CACHE`: 20 uploads / user / day.
6. Generate `uuid`. Write to R2 at `avatars/<userId>/<uuid>.webp`.
7. If user previously had an avatar, delete the old R2 object (`avatars/<userId>/<oldUuid>.webp`).
8. UPDATE `user.image = <public R2 URL>` via Better-Auth's database adapter.
9. `track("user.avatar_set", {})`.
10. Return `{ url }`.

**Server (`DELETE /api/account/avatar`):**
1. Auth + verify guards.
2. If user.image points to R2, delete the object.
3. UPDATE `user.image = NULL`.
4. Return 204.

**Default avatar (`<InitialsAvatar>`):**
- Pure client-side. Zero R2 storage / network for users who never upload.
- Initials = first 2 letters of `displayUsername` (uppercased).
- Background: HSL hue derived from `cyrb53(username)` mod 360 (deterministic per-user colour); saturation/lightness fixed to fit pixel palette.
- Inline SVG, no font load.

## 11. Account deletion (anonymise)

`DELETE /api/account`:

1. Auth required. Verified-email NOT required (a verified user wanting to delete shouldn't be blocked by an expired verification token edge case). Return 401 if not authed.
2. **Refuse** if `session.user.email === env.ADMIN_EMAIL` — admin cannot self-delete (would leave site without admin).
3. **Two-step confirmation**: client must include `confirmUsername` in the request body matching their current `displayUsername` exactly. Otherwise 400. (Settings page enforces this in UI: type your username to unlock the red Delete button.)
4. Delete R2 avatar object if any.
5. UPDATE `user`:
   - `email = "deleted-" || id || "@deleted.local"` (keeps UNIQUE; lets future feature B's `ON DELETE SET NULL` work via referential integrity)
   - `name = "[deleted]"`
   - `image = NULL`
   - `username = NULL`
   - `displayUsername = NULL`
   - `emailVerified = FALSE`
6. DELETE all `session` rows for this user (logs them out everywhere).
7. DELETE all `account` rows (password hash, OAuth account links).
8. DELETE all `verification` rows.
9. `track("user.deleted", {})`.
10. Return 204; client redirects to `/` and clears local session state.

The "user" row stays as a tombstone for foreign-key integrity. With `username` set to `NULL`, the unique index allows multiple deleted users.

## 12. Admin role

`src/lib/is-admin.ts`:

```ts
export function isAdmin(session: Session | null, env: CloudflareEnv): boolean {
  return Boolean(session?.user?.email && env.ADMIN_EMAIL && session.user.email === env.ADMIN_EMAIL);
}
```

`ADMIN_EMAIL` is added as a Worker secret on production (`zhangwenqian6915@gmail.com`) and preview (same value or different test address). Stored alongside the other auth secrets — no special tier of secret.

`<UserWidget>` calls `isAdmin()` in a server component to conditionally render the "Admin" dropdown item; that item links to `/admin` (which 404s in v1 since Feature C hasn't shipped — that's fine).

## 13. Visual / animation constraints

Every new page must:
- Use only the project's `--pixel-*` CSS variables for colors. No raw hex outside the existing palette.
- Use `JetBrains Mono` for monospace and `Inter` for sans (both already loaded by `src/app/layout.tsx`).
- Use **framer-motion** for any motion. Transitions to mirror existing pages (poker, halli-galli, schulte): default `{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }` for entry, `0.15` for exit.
- Auth-card pages share a single `(auth)/layout.tsx` with a centered `<AuthCard>` that uses a `motion.div` entry: `{ initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }`.
- `<UserWidget>` dropdown opens with the same staggered child variant pattern `FloatingNav` already uses (re-export shared variants from `src/components/auth/animation-variants.ts` so they don't drift).

Light + dark themes both supported (already toggled site-wide; new components must just consume tokens correctly — no `dark:` Tailwind overrides needed if tokens are used).

## 14. Username + password constraints (locked from brainstorm)

| | Constraint |
|---|---|
| Username input length | 3–20 |
| Username input chars | `a–z`, `A–Z`, `0–9`, `_`, `-` |
| Username canonical (`user.username`) | Lowercased copy of input; UNIQUE; used for uniqueness check + login-by-username |
| Username display (`user.displayUsername`) | Input preserved verbatim (e.g., "Wenqian"); shown in UI |
| Reserved usernames | `admin`, `root`, `api`, `auth`, `wenqian-dev`, `sign-in`, `sign-up`, `settings`, `profile` |
| Username change | Allowed in Settings; **30-day cooldown** (CACHE-tracked) |
| Password min length | 8 |
| Password complexity | letters AND digits required |
| Password max length | 100 |

## 15. Email + session policy (locked from brainstorm)

| | Value |
|---|---|
| Verification email subject | `Verify your wenqian.dev email` |
| Verification token TTL | 24 h (Better-Auth default) |
| Resend verification | 1 / minute, 5 / day per user |
| Reset email subject | `Reset your wenqian.dev password` |
| Reset token TTL | 1 h |
| Reset request rate | 3 / email / hour |
| Login failures (per IP) | 5 in 5 min → 15 min lockout |
| Login failures (per user) | 10 in 15 min → 1 h lockout |
| Sign-up rate (per IP) | 5 / hour |
| Avatar upload rate | 20 / user / day |
| Session duration | 30 d default; 1 d if "Remember me" unticked |
| Multi-device sessions | Allowed; new login does not invalidate others |

All rate limits use `src/lib/rate-limit.ts` (foundation) backed by KV.

## 16. Profile + Settings page contents (locked)

**`/profile` (read-only):**
- Avatar (image or InitialsAvatar)
- `@username` prefix-style heading
- Display name (smaller, muted)
- Masked email: `z***@gmail.com`
- "Member since YYYY-MM-DD"
- "Verify email" callout if unverified

**`/settings` (sectioned):**
- Avatar — picker; "Remove avatar" if uploaded
- Display name — text input
- Username — input + cooldown indicator + reserved-list violation feedback
- Email — input; submit triggers Better-Auth's email-change flow (sends verification to NEW address; old address informed)
- Password — old + new + confirm; uses Better-Auth's change-password endpoint
- Delete account — red button → modal → "type your username to confirm" → DELETE /api/account

## 17. Observability

Each user-flow event lands as a `track()` call (Workers Analytics Engine) so admin (Feature C) can later show counts:

- `user.signup` (provider always `"email"` in v1)
- `user.email_verified`
- `user.login` (provider `"email"`)
- `user.logout`
- `user.avatar_set`
- `user.avatar_removed`
- `user.username_changed`
- `user.email_changed`
- `user.password_changed`
- `user.deleted`
- `user.password_reset_requested`
- `user.password_reset_completed`

Errors go to Sentry (client-side; foundation set this up).

## 18. Cost (recap)

Phase E adds zero recurring infra cost:

- D1 reads/writes from auth flows: well under free tier (5 M reads / 100 K writes per day).
- KV writes (rate-limit counters): well under 1 K/day at this site's scale.
- R2 (avatars): 50 KB × N users; 200 users = 10 MB; free tier is 10 GB.
- Resend (verification + reset emails): well under 3 K/month.

## 19. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Better-Auth `username` plugin schema collides with existing schema | Low | Medium | Re-run `npx @better-auth/cli generate` against current `auth.config.ts` + the plugin enabled; review the generated migration before committing. Roll back via the migration's down-direction if D1 schema breaks. |
| Avatar upload bypasses client compression and arrives huge | Low | Medium | Server `Content-Length > 100 KB` reject + magic-byte verify + per-user rate limit. |
| User changes email and gets locked out (typo'd address) | Medium | Medium | Email-change confirmation goes to the NEW address; OLD address gets a "your email was changed; if not you, click here within 24 h to revert" notification. Better-Auth supports both; we wire both. |
| Worker bundle grows past 3 MiB cap when shipping E | Low | High | Auth pages are mostly server components; client components are `<UserWidget>`, `<AvatarPicker>`, sign-in/up forms. Total estimated +20–60 KB gzipped. We're at 2240 KB / 3072 KB; ~830 KB headroom. Should fit. Re-check after each commit. |
| Initial-avatar SVG generation gives ugly colours | Low | Low | Bound saturation + lightness so the palette is consistent. Manual review of 20 random hashes during implementation. |
| Account-deletion bug deletes admin (lockout) | Low | Critical | Hard refuse if `session.user.email === env.ADMIN_EMAIL` at the route handler level. Tested via integration test. |
| Better-Auth default behaviour around session duration / refresh changes between minor versions | Medium | Low | Pin `better-auth` version in package.json; add a CI test that verifies the session cookie has the expected `Max-Age`. |

## 20. Test plan

**Vitest workers-pool integration tests** (`tests/integration/auth/*.test.ts`):
- sign-up creates user row with correct username/displayUsername/email casing.
- duplicate email + duplicate username both rejected with 409.
- reserved usernames rejected.
- sign-in by username works.
- sign-in by email works.
- write endpoint returns 403 when emailVerified=false.
- avatar upload happy path: writes R2, updates user.image.
- avatar upload rejected when content-length > 100 KB.
- avatar upload rejected when MIME magic bytes don't match.
- avatar upload deletes old object when replacing.
- delete-account anonymises (email/name/username cleared, R2 avatar deleted, sessions destroyed) and refuses for admin.
- rate limits: login lockout, signup throttle, reset throttle.

**Playwright E2E** (`tests/e2e/auth.spec.ts`):
- Full register → verify (intercept the email link) → sign-in → upload avatar → sign-out → forgot password → reset → sign-in with new password.
- UserWidget shows correct state across nav.
- Admin user sees Admin dropdown item.

## 21. What ships next, after E

Feature **B (leaderboards)** — requires the user identity that E provides, plus a tiny new schema (`scores` table with `ON DELETE SET NULL` user_id reference so deleted users' scores anonymise gracefully). Track-event `game.start` / `game.end` (already declared in `src/lib/analytics.ts`) gets first real callers, plus a new `game.score_submitted` event. Likely 1 week.
