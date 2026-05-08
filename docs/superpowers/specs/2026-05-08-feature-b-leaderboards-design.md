# Feature B — Leaderboards & Player Stats — Design Spec

**Date:** 2026-05-08
**Status:** Draft, awaiting user review
**Builds on:** Foundation slice + Feature E (user system)

## 1. Why this slice exists

Feature E gave every visitor a stable identity and an avatar. Feature B turns that identity into competition and stats: a public top-100 leaderboard for each of the site's 12 games (4 time slices: today / week / month / all-time), ELO rankings for the 4 P2P games (with both-clients-must-agree result reporting), a public profile page that lets you click any leaderboard name to see their full record, and a personal `/stats` dashboard combining best scores, ELO, and recent activity. The work is deliberately bundled because the data model (scores + matches + ratings) and game-end hook integration are shared infrastructure — splitting it across multiple specs would force the same plumbing through review three times.

## 2. Goals

1. Each game's results land in D1 via a uniform hook called from the existing game-over code path. Game pages need only one ~5-line addition each.
2. Public leaderboards at `/leaderboards` (overview) and `/leaderboards/<game>` (single-game deep dive). Each shows top 100, four time tabs (today / week / month / all-time), with the signed-in viewer's own row appended at the bottom if they're outside the top 100.
3. The 8 single-player scoreable games each get a "score" leaderboard (sort by score desc or time_ms asc depending on game).
4. The 4 P2P games each get an ELO leaderboard. Sudoku and Maze (mixed solo/P2P) get **both** a solo leaderboard and a P2P-ELO leaderboard, queryable independently.
5. P2P matches use cooperative reporting: both clients POST to `/api/matches`, the server holds the first submission for 30 s and counts the match only if the opposite-side report agrees on (winner, loser, game). Mismatched / single-sided / late submissions silently drop (don't penalise either player; just don't count).
6. Both players in a P2P match must have `emailVerified=true` for the match to count toward ELO. Unverified players can still play; the result simply doesn't update ratings.
7. Clicking any username on a leaderboard opens `/u/<username>` — a public profile showing avatar, display name, username, member-since, and a per-game stat list (best score / ELO / rank).
8. Signed-in users get `/stats` showing the same per-game breakdown for their own account plus a list of their last 10 matches.
9. Sanity-bound submissions: `submitScore` rejects values that are physically impossible (e.g., schulte time < 3 s, math sprint > 300 questions/min). Rate-limited to 3 submissions / user / minute / game.
10. ELO uses `K=32` for the user's first 30 ranked matches, `K=16` after, starting rating 1200, draws applied with rating-difference-based partial swings.

The slice is "done" when:
- A signed-in, verified user can play any of the 8 single-player games, complete a session, and see their score on the corresponding leaderboard within ≤ 60 s.
- Two signed-in, verified users can complete a P2P match in any of the 4 ELO games; both ratings update; the winner climbs and the loser drops within ≤ 60 s.
- Sudoku played in solo mode goes to the solo leaderboard; played in P2P mode goes to the P2P-ELO leaderboard.
- Public profiles render for any user with at least one tracked result.
- Anonymised (deleted) users' historical entries display as `anonymous` rather than vanishing.

## 3. Non-goals

- **Server-authoritative game logic.** Game state stays in the browser. The site is friend-grade competition; the cost of porting four P2P games to Durable Objects is unjustified, and DO requires Workers Paid which the user explicitly rejected.
- **Anti-collusion detection.** Two-player collusion (A loses to B intentionally to inflate B's ELO) is undetectable with cooperative reporting alone. Acknowledged as a known limitation; admin can manually adjust via SQL if abuse appears.
- **Skill-based matchmaking.** P2P games still rely on existing PeerJS / room-code flow. The leaderboard ranks; it doesn't broker matches.
- **Achievements / badges.** YAGNI for v1. Easy to layer on later if the data is rich enough.
- **Per-game replay storage.** Beyond the score row + match row, no game state persists.
- **Real-time leaderboard updates.** Leaderboard pages cache 60 s at the CDN; the viewer's own latest result is fetched fresh by `WHERE user_id = me`.
- **Friends list / private leaderboards.** All leaderboards are global. No social graph.
- **Score editing / dispute flow.** If a result is wrong, the user contacts the admin (the site owner). No in-product appeal.

## 4. Architecture overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Client (game page)                                                       │
│   game-over reached →                                                    │
│     submitScore({ game, mode, score?, time_ms?, ... })  ← solo + P2P-rec │
│     submitMatch({ game, opponent_id, result, ... })     ← P2P only       │
│   POST /api/scores or /api/matches                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Worker                                                                   │
│   /api/scores      POST   sanity + rate-limit + INSERT into `scores`     │
│   /api/matches     POST   join window in KV; on agreement INSERT into    │
│                           `matches` + UPDATE `ratings` (ELO)             │
│   /api/leaderboard GET    /<game>?slice=today|week|month|all             │
│   /api/u/<u>       GET    public stats for username `u`                  │
│   /api/stats       GET    requester's own stats (auth required)          │
│                                                                          │
│ Bindings: DB + CACHE (rate limits + match join window)                   │
│ No new bindings.                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Pages                                                                    │
│   /leaderboards                  overview — featured top-3 per game     │
│   /leaderboards/<game>           full top-100 with 4 time tabs           │
│   /u/<username>                  public profile + per-game stats        │
│   /stats                         private stats page (auth required)     │
└─────────────────────────────────────────────────────────────────────────┘
```

## 5. Schema (3 new tables)

Generated via Drizzle migration committed under `src/db/migrations/0002_*.sql`. Each table re-exported from `src/db/schema/leaderboards.ts`.

### `scores` (solo + P2P-derived per-game results)

| col | type | notes |
|---|---|---|
| id | text PK | uuid |
| user_id | text FK → user.id (ON DELETE SET NULL) | nullable so deleted users' rows persist as `anonymous` |
| game | text NOT NULL | enum-ish: 'schulte', 'reaction', 'math', 'flash-count', 'trail', 'pattern', 'sudoku', 'maze', 'poker', 'halli-galli', 'gomoku', 'pulse-duel' |
| mode | text NOT NULL | 'solo' or 'p2p' |
| metric | text NOT NULL | 'time_ms' or 'score' — drives sort direction |
| value | integer NOT NULL | metric value (lower-is-better for time_ms; higher-is-better for score) |
| played_at | integer NOT NULL | timestamp_ms |

Indexes:
- `(game, mode, metric, value)` for top-N queries (ASC for time_ms, DESC for score; queries pick correctly)
- `(game, mode, played_at)` for time-sliced queries
- `(user_id, game)` for personal stats
- `(played_at)` for global "today / this week" scans

### `matches` (P2P confirmed results)

| col | type | notes |
|---|---|---|
| id | text PK | uuid |
| game | text NOT NULL | one of poker/halli-galli/gomoku/pulse-duel/sudoku/maze (only the 4 P2P + 2 mixed) |
| winner_id | text FK → user.id (SET NULL) | nullable for ties |
| loser_id | text FK → user.id (SET NULL) | nullable for ties |
| was_tie | integer NOT NULL DEFAULT 0 | boolean |
| winner_elo_delta | integer NOT NULL | rating change applied to winner |
| loser_elo_delta | integer NOT NULL | applied to loser (negative for normal loss) |
| played_at | integer NOT NULL | timestamp_ms |

Indexes: `(game, played_at)`, `(winner_id, game)`, `(loser_id, game)`.

### `ratings` (per-user × per-game ELO state)

| col | type | notes |
|---|---|---|
| user_id | text NOT NULL FK → user.id (ON DELETE CASCADE) | composite PK with game |
| game | text NOT NULL | composite PK |
| elo | integer NOT NULL DEFAULT 1200 |
| matches_played | integer NOT NULL DEFAULT 0 |
| wins | integer NOT NULL DEFAULT 0 |
| losses | integer NOT NULL DEFAULT 0 |
| ties | integer NOT NULL DEFAULT 0 |
| last_match_at | integer | nullable until first match |

PK: `(user_id, game)`.
Index: `(game, elo DESC)` for ELO leaderboard queries.

## 6. ELO algorithm

Standard chess-style:

```
expected_winner = 1 / (1 + 10^((loser_elo - winner_elo) / 400))
expected_loser  = 1 - expected_winner
K = (matches_played < 30) ? 32 : 16   // per-user, looked up from ratings table
delta_winner = round(K * (1 - expected_winner))
delta_loser  = -delta_winner          // zero-sum

// Tie:
delta_winner = round(K * (0.5 - expected_winner))   // higher-rated player loses small
delta_loser  = -delta_winner
```

K is computed per-side (so a veteran beating a new player swings the new player by 32 but only swings the veteran by 16). All math integer-rounded; total ELO across the system stays approximately conserved.

## 7. P2P match cooperative-reporting protocol

Both clients POST the same payload (modulo viewpoint perspective):

```
POST /api/matches
body: {
  matchId: string,        // shared identifier; see "matchId derivation" below
  game: string,
  playerAId: string,      // canonical-order: smaller-uuid first
  playerBId: string,      // canonical-order: larger-uuid second
  wasTie: boolean,
  winnerId: string | null // required when wasTie === false; null when tie
}

Server:
  Look up KV key `match:<matchId>`.
  If absent: store the report with TTL=30s, return { status: "pending" }.
  If present, compare incoming vs stored on (game, playerAId, playerBId, wasTie, winnerId):
    All match → confirmed. Delete KV key. Insert matches row (with winner/loser
      derived from winnerId or both nulls on tie). Update both ratings rows.
      Emit match.confirmed analytics. Return { status: "confirmed", eloDelta }.
    Mismatch → drop both. Delete KV key. Return { status: "dropped",
      reason: "mismatch" }. Log to Workers logs.

If 30s passes without a counterpart submission:
  KV TTL expires. Match never recorded. No penalty.

Both submissions must come from authenticated, email-verified users; otherwise
return 403 with reason: "verified email required to rank".
```

**Canonical player ordering**: clients sort the two user IDs lexicographically and assign smaller→playerAId / larger→playerBId before submitting. Removes "did A or B submit first" as a source of mismatch.

**matchId derivation** (each P2P game has a pre-existing concept of "one competitive event"; the client uses that):
- **Poker**: `${roomCode}:hand-${handNumber}` (one matchId per dealt hand)
- **Halli Galli**: `${roomCode}:game-${gameNumber}` (one per full game session)
- **Gomoku**: `${roomCode}:game-${gameNumber}`
- **Pulse Duel**: `${roomCode}:duel-${duelNumber}`
- **Sudoku P2P / Maze P2P**: `${roomCode}:race-${raceNumber}`

Both clients independently arrive at the same matchId because both observe the same room state. Server treats matchId as an opaque string and expects exact equality.

## 8. Game-end integration ("the hook")

Each of the 12 games today has logic that detects "the player finished a session" — a state transition like `phase === "showdown"` (poker) or `solved` (sudoku) or `gameOver` (math sprint). The plan introduces `src/lib/leaderboards/submit.ts`:

```ts
export async function submitScore(input: SubmitScoreInput): Promise<void>;
export async function submitMatch(input: SubmitMatchInput): Promise<void>;
```

Each game's existing game-over branch adds **exactly one call** at the same place where the celebration / confetti fires. The functions:
- Are no-ops if the user is not signed in.
- Catch + log errors silently (leaderboard failure must never break the game UX).
- Use AbortController + 5 s timeout (game UX moves on if server is slow).
- Validate score against per-game sanity bounds locally before sending.

Sanity bounds (`src/lib/leaderboards/bounds.ts`):

| game | metric | min | max | reason |
|---|---|---|---|---|
| schulte | time_ms | 3000 | 600000 | sub-3-s impossible, 10 min = abandoned |
| reaction | time_ms | 100 | 5000 | < 100 ms = anticipation cheat, > 5 s = afk |
| math | score | 0 | 500 | 500 questions / 60 s = 8/s, clearly impossible |
| flash-count | score | 0 | 100 | 100 rounds = 30 min run, plausible upper bound |
| trail | time_ms | 5000 | 600000 | similar to schulte |
| pattern | score | 1 | 30 | 30-step recall is a world-record-class outlier |
| sudoku | time_ms | 30000 | 7200000 | sub-30-s impossible; 2-h game = abandoned |
| maze | time_ms | 5000 | 1800000 | similar |

Out-of-bounds → 400 from server, no INSERT, no rate-limit hit.

## 9. Pages + components

```
src/app/
├─ leaderboards/
│  ├─ page.tsx                       — overview (12 games × top 3)
│  └─ [game]/page.tsx                — full top-100 with 4 time tabs
├─ u/
│  └─ [username]/page.tsx            — public profile
├─ stats/
│  ├─ layout.tsx                     — auth-required
│  └─ page.tsx                       — own stats + last 10 matches
└─ api/
   ├─ scores/route.ts                — POST submit a score
   ├─ matches/route.ts               — POST cooperative-report a match
   ├─ leaderboard/[game]/route.ts    — GET top 100 + caller's row
   ├─ u/[username]/route.ts          — GET public profile data
   └─ stats/route.ts                 — GET own stats (auth)

src/components/leaderboards/
├─ LeaderboardTable.tsx              — table with avatar+name+score, accent on viewer's row
├─ TimeTabs.tsx                      — today / week / month / all-time switcher
├─ GameStatsCard.tsx                 — per-game card used on /u and /stats
├─ MatchHistoryRow.tsx               — single-row match summary

src/lib/leaderboards/
├─ submit.ts                         — submitScore / submitMatch hooks
├─ elo.ts                            — pure ELO math
├─ bounds.ts                         — sanity bounds map
├─ window.ts                         — match join window helpers (KV)
└─ time-slice.ts                     — { now, weekAgo, monthAgo, dayAgo } utilities
```

## 10. Time slicing

All 4 slices computed from the same `played_at` timestamp:

- **today**: `played_at >= startOfDay(now, "Australia/Sydney")` (user is in AU; pin to a single TZ for consistent "today" rollover)
- **week**: `played_at >= now - 7 * 86400_000`
- **month**: `played_at >= now - 30 * 86400_000`
- **all-time**: no filter

Default tab on `/leaderboards/<game>`: **week**. (Most active sense of "who's hot right now" without the daily volatility.)

## 11. Public profile (`/u/<username>`)

| Section | Content |
|---|---|
| Header | Avatar (image or InitialsAvatar) + display name + `@username` + member-since |
| Stats grid | Per-game cards. Each card: game name, best score (or ELO), all-time rank, total plays |
| Recent matches | Last 10 matches across all P2P games (game, opponent username, result, ELO delta, when) |

If the username doesn't exist or refers to an anonymised user → 404. (Keeps anonymised users private.)

## 12. /stats (own dashboard)

Requires auth (layout guard). Shows the same data as `/u/<username>` but for the requester, plus:
- Compact "you have played X matches across Y games"
- Currently-leading badge if user is #1 in any game's all-time leaderboard

No different data than the public profile — just the convenience of a "yours" link.

## 13. Visual / animation constraints

Same constraints as Feature E: framer-motion for entry/exit, `--pixel-*` tokens, JetBrains Mono / Inter fonts. Concretely:

- LeaderboardTable rows fade in with a 30 ms stagger.
- Caller's own row gets a subtle glow border (`box-shadow: 0 0 0 1px var(--pixel-accent)`).
- Time tabs share the existing pill-style switch pattern from poker's PhaseFlash.
- ELO numbers display with a `motion.span` count-up from current to new on rating change (only on /stats refresh after a recent match).

## 14. Submit + read latency targets

- `POST /api/scores` < 250 ms p95 (D1 insert + rate-limit check)
- `POST /api/matches` first-side < 150 ms (KV write); second-side < 300 ms (KV read + D1 inserts + ratings update)
- `GET /api/leaderboard/<game>` < 100 ms p95 (single indexed query, 60 s CDN cache)
- `GET /u/<username>` < 200 ms p95 (1-2 queries; consider future inlining if slow)

## 15. Observability

`src/lib/analytics.ts` extended:

```
| { name: "score.submit"; game: string; mode: "solo" | "p2p" }
| { name: "match.confirmed"; game: string }
| { name: "match.dropped"; game: string; reason: "mismatch" | "timeout" }
| { name: "leaderboard.view"; game: string; slice: "today" | "week" | "month" | "all" }
```

Sentry catches client errors. Bounds violations + dropped matches go to Workers Logs (queryable via `wrangler tail` and Cloudflare dashboard).

## 16. Cost (recap)

Zero recurring infra cost added on top of the foundation:
- Three new D1 tables; well under 5 GB free tier even at 100k matches.
- ~3 KV writes per match (one per side + cleanup); under the 1 K/day free limit at this site's scale.
- No new bindings, no new external services.

## 17. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Two players collude to farm ELO | Medium | Medium-low | Acknowledged as known limit. If admin sees a 1500-elo gain in a week with all matches against same opponent, manual SQL adjustment + warning. |
| Single client games (e.g., schulte) get cheated by direct API call | Medium | Low | Sanity bounds reject impossible values + per-user rate limit. Score-leaderboards are bragging-rights, not financial. |
| KV match-join-window misses one side due to network drop | Medium | Low | Match silently doesn't count. No penalty for either player. |
| Anonymised users break leaderboard rendering | Low | Medium | `ON DELETE SET NULL` on user_id; UI displays "anonymous" when null. Tested. |
| Rating math overflow / weird drift over many matches | Low | Low | Integer rounding + zero-sum design keeps total ELO conserved. K-factor reduction at 30 matches stops new accounts from extreme swings. |
| Worker bundle grows past 3 MiB cap | Low | High | Adding scores + leaderboards adds ~30-50 KB gzipped (mostly server logic + small UI); we have ~830 KB headroom. Re-check after each commit. |
| Leaderboard CDN cache stale data right after user submits | Medium | Low | Caller's own row queried fresh by user_id (not cached). Rest of top-100 may be ~60 s stale; acceptable for "your friend just beat you". |
| `time_ms` games cannot be ordered alongside `score` games on overview page | Low | Low | Overview shows top-3 per game, each card sorts by its own metric independently. No cross-game super-ranking. |

## 18. Test plan

**Vitest unit tests** (`tests/integration/leaderboards/*.test.ts`):
- `elo.ts`: standard expected/delta computations, K-factor switch at 30 matches, tie partial-swing, total conservation across many simulated matches.
- `bounds.ts`: each game's bounds reject the obvious impossible values.
- `time-slice.ts`: today / week / month boundaries handle TZ correctly.

**Playwright E2E** (`tests/e2e/leaderboards.spec.ts`):
- Happy path: signed-in user plays Schulte (mock the game-end), score appears on leaderboard.
- /u/<username> renders for the seeded user.
- /stats requires auth; redirects to sign-in if not.
- Ranked match across two browser contexts (cooperative reporting): both submit, both ELO updates verify.

## 19. What ships next, after B

**Feature A (cross-device sync)** — already partially solved by Feature E (signing in on a new device shares profile + avatar). Remaining: per-game in-progress state sync (resume schulte on a different device, sync poker hand state across browsers). Likely 1 week after B is stable.
