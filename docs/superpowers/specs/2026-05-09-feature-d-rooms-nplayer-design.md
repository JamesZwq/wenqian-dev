# Feature D' — Rooms + N-Player Games

**Status:** Draft (approved 2026-05-09)
**Author:** Wenqian Zhang
**Builds on:** Feature E (user system), Feature B (leaderboards)

---

## 1. Goals + non-goals

### Goals

- Players sign in, click **Create Room** / **Join Room** or pick from a public lobby instead of pasting URLs.
- Up to **6 players** in one game (Gomoku and Pulse Duel stay at 2 by mechanic; everything else can grow to 6).
- **Star topology:** one host, ≤5 guests. Auto-promotion if the host drops (race + halli-galli) or void-and-recover (poker).
- **Round-robin pairwise ELO** so existing leaderboards work for N-player without schema changes.
- **Both** private (code-share) and public (lobby browser) rooms.
- **Trust:** private = host-only reporting; public = N-way cooperative agreement.

### Non-goals (deferred)

- Cross-device sync (Feature A) — separate cycle.
- Admin dashboard (Feature C) — separate cycle.
- Skill-based matchmaking — public lobby is just a list of open rooms.
- Spectating, replays, persistent chat history.
- Tournaments, brackets.
- Server-relay (Cloudflare Durable Objects) — star-topology peer connections only, no paid CF feature.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Cloudflare Worker                       │
│  POST /api/rooms              ←  host creates room       │
│  GET  /api/rooms?game=…       ←  list public rooms       │
│  POST /api/rooms/:code/join   ←  guest claims slot       │
│  POST /api/rooms/:code/heartbeat                         │
│  POST /api/rooms/:code/leave                             │
│  POST /api/rooms/:code/promote ←  auto-promote new host  │
│  POST /api/matches/bulk       ←  N-player results        │
│                                                           │
│  KV: room:<code>  → JSON room state (TTL 30m)            │
│  KV: lobby:<game> → set of public room codes             │
│  KV: banned:<userId> → flag (no expiry)                  │
└─────────────────────────────────────────────────────────┘
       ▲                         ▲
       │ HTTPS                   │ HTTPS
   ┌───┴────┐               ┌────┴────┐
   │  Host  │ ── PeerJS ──▶ │ Guest 1 │
   │  (PC)  │ ◀── star ───  │  ...    │
   │        │ ──────────▶   │ Guest 5 │
   └────────┘               └─────────┘
```

**Core idea:** rooms live in KV as soft state (TTL 30 min, refreshed every 60s by the host's heartbeat). The Worker is a directory + slot-reservation system; gameplay traffic is still PeerJS WebRTC. The host's peerId is what guests dial.

**Why star, not full-mesh:** browser memory + battery. With 6 peers, full-mesh = 15 WebRTC connections per client (n²/2). Star = 5 connections on host, 1 per guest. Existing PeerJS code is already host-anchored.

**Room lifecycle:**

1. Host `POST /api/rooms { game, visibility, capacity }` → server generates 6-char code, writes `room:<code>` to KV with `slots: [{ userId: host.id, peerId: host.peerId }]`, returns code.
2. Guest enters code OR clicks lobby entry → `POST /api/rooms/<code>/join { peerId }` → server appends slot if room not full, returns `{ hostPeerId }`.
3. Guest's PeerJS dials `hostPeerId`. Existing per-game `id_exchange` packet broadcasts each player's userId to everyone.
4. Host runs the game; sync packets fan out to all guests.
5. Every 60s host heartbeats `POST /api/rooms/<code>/heartbeat` → KV TTL refresh.
6. Match end → reporting (§5).

---

## 3. Components

### Server (new)

| File | Responsibility |
|---|---|
| `src/lib/rooms/codes.ts` | 6-char room-code generator (nanoid alphabet, no ambiguous chars) |
| `src/lib/rooms/store.ts` | KV CRUD: `createRoom`, `getRoom`, `joinRoom`, `leaveRoom`, `heartbeatRoom`, `promoteRoom`, `listPublicRooms` |
| `src/lib/rooms/election.ts` | Pure: deterministic election (lowest userId) given member array |
| `src/lib/leaderboards/pairwise.ts` | Pure: position list → `[{winnerId, loserId, wasTie}]` pair list |
| `src/app/api/rooms/route.ts` | `POST` (create) + `GET ?game=<id>` (lobby) |
| `src/app/api/rooms/[code]/route.ts` | `GET` (status), `DELETE` (host closes) |
| `src/app/api/rooms/[code]/join/route.ts` | `POST` slot reservation |
| `src/app/api/rooms/[code]/heartbeat/route.ts` | `POST` TTL refresh (host only) |
| `src/app/api/rooms/[code]/leave/route.ts` | `POST` vacate slot |
| `src/app/api/rooms/[code]/promote/route.ts` | `POST` CAS-update `hostPeerId` |
| `src/app/api/matches/bulk/route.ts` | `POST` N-way results, batched D1 transaction |

### Client (new)

| File | Responsibility |
|---|---|
| `src/features/rooms/hooks/useRoom.ts` | Top-level: create / join / leave; exposes `{ room, members, hostPeerId, isHost }` |
| `src/features/rooms/components/RoomLobby.tsx` | List of open public rooms; "Create" + "Join by code" |
| `src/features/rooms/components/CreateRoomModal.tsx` | Private-vs-public + capacity picker |
| `src/features/rooms/components/JoinByCodeInput.tsx` | 6-character paste-friendly input |
| `src/features/rooms/components/RoomMembersBar.tsx` | Avatar strip with ready / playing state |

### Per-game integration (modify the 12 existing hooks)

Each `useXxxGame.ts`:

- Replaces direct `usePeerConnection` with a `useRoom`-aware variant. Host dials nobody; guests dial `room.hostPeerId`.
- N-way `id_exchange`: host broadcasts the full `(userId, peerId, displayUsername)[]` table whenever the slot list changes.
- Game-state sync packets fan out to all guests (existing code is already broadcast-shaped for `sync` packets).

### Pages (new)

| Path | What it shows |
|---|---|
| `/rooms/<game>` | Public lobby for that game + Create/Join controls |
| `/play/<game>?room=<code>` | The game itself, rendered inside the room shell |

Existing `/<game>` entry points get a "Play with friends" button that links to `/rooms/<game>`. Solo modes still launch directly from `/<game>` as today.

---

## 4. Data flow examples

### Flow A — host creates a private poker room, friend joins by code

1. Host opens `/rooms/poker`, clicks **Create Private**. Frontend: `POST /api/rooms { game: "poker", visibility: "private", capacity: 6 }`.
2. Worker validates session + emailVerified, generates code `K7B2WX`, writes `room:K7B2WX` to KV with TTL 30m. Returns `{ code: "K7B2WX", role: "host" }`.
3. Host's PeerJS initialises with peerId `wq-poker-K7B2WX`; frontend updates `room:K7B2WX` in KV with `hostPeerId`.
4. Host shares the code out-of-band.
5. Friend opens `/rooms/poker`, clicks **Join by code**, enters `K7B2WX`. Frontend: `POST /api/rooms/K7B2WX/join { peerId }`.
6. Worker validates: room exists, not full, caller not banned. Appends `{ userId, peerId }` to slots. Returns `{ hostPeerId }`.
7. Friend dials `hostPeerId` via PeerJS. WebRTC handshake → DataChannel open.
8. Host sends `{ type: "members_sync", members: [{userId, peerId, displayUsername}, ...] }` to all peers. Same packet whenever slots change.
9. When everyone is ready, host clicks **Start** → existing poker flow with N-player extensions (§6).

### Flow B — joining a public sudoku race from the lobby

1. Visit `/rooms/sudoku` (no auth required to *view*). Frontend: `GET /api/rooms?game=sudoku&visibility=public`.
2. Worker reads `lobby:sudoku`, fetches each `room:<code>`, filters out full / dead rooms, returns `{ rooms: [{code, hostDisplayName, slotsTaken, capacity, createdAt}, ...] }`.
3. Lobby renders cards. Click → must be signed-in + emailVerified → continues at Flow A step 5.

### Flow C — match end, reporting

**Private room:**

- Host computes round-robin pairwise results: `[{winnerId, loserId}, …]` — `N*(N-1)/2` rows.
- Host alone calls `POST /api/matches/bulk { matchId, game, results }`. Server batches the writes in one D1 transaction.

**Public room:**

- Each player computes the same results from their local view (race: position list; halli-galli: bust-out order; poker: settled hand pots).
- Each posts. Server's KV-backed N-way join window (`room:<code>:report:<matchId>`, 60s TTL) holds the first report; subsequent reports must match.
- Server commits only when all N reports agree on `{matchId, results}`. Mismatch → drop, `match.bulk_dropped reason="mismatch"`. Timeout → drop, `reason="timeout"`.

---

## 5. Trust model + abuse mitigations

### Auth gates

| Action | Required |
|---|---|
| View public lobby | none (public read) |
| Create room | signed-in + emailVerified |
| Join room | signed-in + emailVerified |
| Bulk-report match | signed-in + emailVerified + member of the match |

### Reporting (§4 Flow C, recap)

- **Private** → host-only. Trust = the people you invited.
- **Public** → all N must agree (KV join window).

### Rate limits (existing `rateLimit` KV helper)

| Bucket | Limit |
|---|---|
| Room creation per user | 10 / hour |
| Join attempts per user | 30 / hour |
| Bulk-report per user per game | 30 / hour |

### Public-room safeguards (v1, before Feature C admin)

1. **Global cap:** `lobby:<game>` capped at 20 active rooms per game; further attempts force private.
2. **No display-name override:** public rooms always show host's `displayUsername`. Bad actors are doxed against their own profile.
3. **One public room per host at a time** — second create returns 409.
4. **Banned-user list:** `banned:<userId>` flag in KV (no expiry). Banned users get 403 on create/join. Until Feature C ships, you set the flag manually with `wrangler kv key put`.
5. **Cheating reports:** out of scope for v1. If it happens, you ban manually.

### Hidden-info caveat — poker only

Host knows everyone's hole cards (authoritative state). A malicious public-room host could see future cards, etc.

- **v1 mitigation:** none. UI labels public poker rooms with "Played on host's word."
- A real fix (commit-reveal hole cards / mental poker / server-side dealer) is out of scope.

---

## 6. Per-game changes

### Race games (sudoku, maze, schulte, reaction, math, flash-count, trail, pattern — 8 games)

- Reuse existing `progress` and `game_complete` packets; add `userId` so guests can identify which opponent is which.
- Host fan-outs progress packets received from guests to all other guests (relay).
- Game ends when all players are either `complete` or have hit the timeout. Host computes finishing order and broadcasts `{ type: "race_results"; positions: [{userId, timeMs, position}, …] }`.
- UI: replace single "opponent" bar with a stacked list of N–1 opponent rows (avatar + display name + progress %).
- ELO: round-robin pairwise from the position list (§7).

### Halli Galli — boxed-game N-player rules

- N decks, 56 cards total: `floor(56/N)` per player, drop the remainder.
- Turn order counter-clockwise; existing `nextFlipper` generalises to `(current + 1) % N`.
- Bell logic: existing `applyBell` already counts across visible piles — extend to count across all N piles.
- Wrong bell penalty: give one card to each other player (boxed-game rule).
- Win: last player with cards. `phase: "game_over"` carries `finishOrder: [userId, …]` (last bust-out first).
- ELO: round-robin pairwise on `finishOrder`.
- UI: existing 2-pile layout becomes N piles arranged in a circle. Bell button stays large at centre.

### Poker — Texas Hold'em N-player ("6-max")

- **Blinds rotate:** dealer button moves clockwise; SB = next; BB = next-next.
- **Betting rounds:** action goes clockwise from first-to-act; ends when all non-folded players have matched the largest bet or are all-in.
- **Side pots:** when a player goes all-in for less than the current bet, build a side pot so others can keep betting beyond their stack. Implemented as a rewrite of `processAction`.
- **Showdown:** for 3+ active players, evaluate every active player's best 5; settle main pot to highest, side pots to their respective contestors. Existing hand evaluator already returns ranks.
- **Bust-out:** mark `eliminated`; continue. Game ends when only one active.
- **Auto-promote caveat:** if host disconnects mid-hand, void the hand (refund chips to pre-hand stacks stored in `lastSettled`); auto-promote, redeal at next hand boundary.
- **ELO:** **per-hand pairwise** — winner of each hand "beats" all non-fold losers of that hand. (Most poker sessions never reach single-winner game-end; per-hand updates feel right.)
- UI: oval table with 6 seat positions, dealer / SB / BB chip overlays. Folded seats greyed.

### Gomoku, Pulse Duel — no change

Stay 2-player (capacity = 2). They live in the new room shell; existing logic untouched.

---

## 7. ELO + auto-promote details

### Bulk-match endpoint

```ts
POST /api/matches/bulk
{
  matchId: string,
  game: GameId,
  results: [
    { winnerId: string, loserId: string, wasTie?: boolean },
    ...
  ]
}
```

Handler:

1. Validate caller is in `results` (member of the match).
2. Validate `results.length === N*(N-1)/2` for the match's player count, where N is inferred from distinct user ids in `results`.
3. For each pair, run existing `computeElo()` and write a `matches` row + update both `ratings` rows.
4. Wrap all writes in a D1 `db.batch([…])` so the bulk is atomic. Any sanity failure (user not email-verified, banned, etc.) aborts the whole bulk and returns 400.

**Race-game position → pairwise.** Positions `[u1, u2, u3, u4]` produce pairs `[(u1,u2), (u1,u3), (u1,u4), (u2,u3), (u2,u4), (u3,u4)]` — 6 inserts + 4 ratings updates for a 4-player race. Cheap.

**Halli Galli bust-out → pairwise.** Sort by `finishOrder` (last standing = 1st place), generate pairs same way.

**Poker per-hand → pairwise.** Winner "beats" each non-fold loser of that hand. 6-max with 4 to showdown = 3 pairs per hand. Typical 30-hand session ≈ 90 rows. Still cheap.

**Ties:** for split pots in poker (or rare ms-precision ties in races), write `wasTie: true` for that pair; ELO uses the existing tie branch.

### Auto-promote algorithm (race + halli-galli)

**Detection:** all guests' DataChannels see the host's connection close. Each guest:

1. Waits 2s grace (handles transient blips).
2. Runs election (pure, deterministic): lowest `userId` still online wins.
3. **If the elected guest is *me*:**
   a. Request a fresh peerId with prefix `wq-<game>-<code>-promoted-<n>`.
   b. CAS-update `room:<code>` via `POST /api/rooms/<code>/promote { newHostPeerId, expectedOldHostPeerId }`. Server only writes if `room.hostPeerId === expectedOldHostPeerId`.
   c. Wait for guests to reconnect (they poll `room:<code>` for the new `hostPeerId` every 1s while in `host-down` state).
4. **If not elected:** poll `room:<code>` for the new `hostPeerId`; dial it; resume.

**State snapshot.** Every guest holds the latest broadcast game state (race progress / halli-galli decks/scores). The new host adopts its own most recent locally-held state and resumes broadcasting `sync` packets.

**Poker variant.** Void the in-progress hand (refund all bets to pre-hand stacks from `lastSettled`), run the race/halli-galli flow, redeal at next hand from the new host.

**Failure modes:**

- Concurrent promotions → KV CAS ensures one wins; loser falls back to the winner's peerId.
- Election deadlock if the elected guest also drops → re-run on next grace expiry, exclude already-failed peerIds.

---

## 8. Visual / observability / cost / risks / test plan

### Visual constraints

- All new UI uses existing `--pixel-*` CSS tokens.
- `RoomMembersBar`: 28 px avatar circles, framer-motion entry stagger (0.05s/member), mirrors `LeaderboardTable` row pattern.
- `RoomLobby`: card grid identical to `/leaderboards` overview — `border-2`, `rounded-xl`, `--pixel-card-bg`, hover scale-1.02.
- `JoinByCodeInput`: 6 monospaced character boxes, accent cursor, paste-friendly (auto-fills if 6 chars).
- `CreateRoomModal`: same `motion.div` slide-in pattern as Feature E auth modals.
- New routes inherit global `UserWidget` + `ThemeToggle` from root layout.

### Observability — extend `AnalyticsEvent` union

```ts
| { name: "room.created"; game: string; visibility: "public" | "private" }
| { name: "room.joined"; game: string }
| { name: "room.left"; game: string; reason: "voluntary" | "disconnect" | "host_gone" }
| { name: "room.host_promoted"; game: string }
| { name: "room.match_complete"; game: string; n: number }
| { name: "match.bulk_dropped"; game: string; reason: "mismatch" | "timeout" | "size" }
```

### Cost ($0/month constraint)

| Resource | Per-room cost | Free-tier cap |
|---|---|---|
| KV reads (lobby fetch) | ~5 reads / visitor | 100k/day |
| KV writes (heartbeat 1/min × 30m) | ~30 writes / room | 1k/day |
| KV storage | ~1 KB / room | 1 GB |
| D1 inserts (bulk match) | N(N–1)/2 rows | 100k/day |
| Workers requests | proportional | 100k/day |
| Durable Objects | **none** | — |
| Paid services | **none added** | $0/mo |

Free-tier headroom holds for ≥1k matches/day.

### Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | Auto-promote picks two hosts | Med | KV CAS on `hostPeerId`; loser dials winner |
| 2 | Public-room abuse (bots, spam) | Med | Per-user rate limit, 20-room global cap, banned KV flag |
| 3 | Cooperative-report timeout | Med | 60s window same as existing 2-player; lengthen if traffic shows issues |
| 4 | Poker mid-hand desync after promote | High → mitigated | Void hand, refund stacks, redeal — never resume mid-hand |
| 5 | Lobby ghosts (host crashed silently) | Low | TTL 30m + 60s heartbeat; lobby filters `lastHeartbeat > 90s` |
| 6 | PeerJS broker outage | Low | Same as today; out of scope (project-wide dependency) |
| 7 | Bulk D1 batch fails halfway | Low | `db.batch([…])` is atomic |
| 8 | Halli-galli card count not divisible by N | Cosmetic | Drop remainder cards |

### Test plan

**Unit (vitest pure helpers):**

- `src/lib/rooms/codes.ts` — collision rate at 6 chars across 10k generations.
- `src/lib/rooms/election.ts` — deterministic election from arbitrary member arrays.
- `src/lib/leaderboards/pairwise.ts` — position → pair-list converter; halli-galli bust-order → pair-list; verify N(N–1)/2 outputs.
- Existing ELO `computeElo` regressions still pass.

**Integration (KV-backed, miniflare):**

- Create → join → leave flow via simulated KV.
- Bulk-match 6-player insert produces 15 `matches` rows + 6 `ratings` updates.

**E2E (Playwright):**

- `/rooms/sudoku` lobby renders empty state, then a public room appears, then post-fill the card disappears.
- Join-by-code happy path + bad-code 404.
- Stats and `/u/<username>` after a 4-player race show correct `wins / plays`.

---

## 9. Pages summary

| Path | Auth | Purpose |
|---|---|---|
| `/rooms/<game>` | view: none, action: required | Public lobby + create/join controls |
| `/play/<game>?room=<code>` | required | Game shell with N-player UI |
| `/<game>` (existing) | unchanged | Solo modes; gains "Play with friends" → `/rooms/<game>` |

---

## 10. What ships next (after D' is live)

- **Feature A — cross-device sync** (per-user game state across devices) — biggest scope, leverages identity from Feature E.
- **Feature C — admin dashboard** (`/admin/*`) — moderation surface; promotes the `banned:<userId>` flag from §5 to a real UI.
