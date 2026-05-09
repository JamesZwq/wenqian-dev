# Feature D' — Rooms + N-Player Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add room-based multiplayer (private code-share + public lobby) and N-player game support (up to 6 players) with star topology, round-robin pairwise ELO, and auto-promotion on host disconnect.

**Architecture:** Three layers: (1) Worker-side KV-only room directory + slot reservation, (2) client `useStarPeerConnection` that fans-out / fans-in over PeerJS DataChannels (host = N–1 channels, guest = 1 channel to host), (3) per-game logic extended for N players. Existing 2-player code stays as the N=2 special case.

**Tech Stack:** Cloudflare Workers + KV + D1 (existing bindings), PeerJS over WebRTC, Drizzle ORM, framer-motion, no new external services or paid CF features.

**Spec:** [`docs/superpowers/specs/2026-05-09-feature-d-rooms-nplayer-design.md`](../specs/2026-05-09-feature-d-rooms-nplayer-design.md)

---

## File structure

```
src/
├─ lib/
│  └─ rooms/
│     ├─ codes.ts                   ← NEW: 6-char generator (no ambiguous chars)
│     ├─ election.ts                ← NEW: pure deterministic host election
│     └─ store.ts                   ← NEW: KV CRUD for rooms + lobby + bans
│  └─ leaderboards/
│     └─ pairwise.ts                ← NEW: position list → pair list
├─ app/
│  ├─ api/
│  │  ├─ rooms/route.ts             ← NEW: POST create + GET lobby
│  │  ├─ rooms/[code]/
│  │  │  ├─ route.ts                ← NEW: GET status + DELETE close
│  │  │  ├─ join/route.ts           ← NEW: POST claim slot
│  │  │  ├─ heartbeat/route.ts      ← NEW: POST refresh TTL
│  │  │  ├─ leave/route.ts          ← NEW: POST vacate
│  │  │  └─ promote/route.ts        ← NEW: POST CAS-update host peer
│  │  └─ matches/bulk/route.ts      ← NEW: POST round-robin pairwise results
│  ├─ rooms/
│  │  └─ [game]/page.tsx            ← NEW: lobby page per game
│  └─ <game>/page.tsx               ← MODIFY (×12): "Play with friends" → /rooms/<game>
├─ features/
│  ├─ p2p/hooks/
│  │  └─ useStarPeerConnection.ts   ← NEW: multi-channel host / single-channel guest
│  └─ rooms/
│     ├─ hooks/useRoom.ts           ← NEW: orchestrator (create/join/heartbeat/leave)
│     └─ components/
│        ├─ RoomLobby.tsx           ← NEW: public room list + create/join controls
│        ├─ CreateRoomModal.tsx     ← NEW: visibility + capacity picker
│        ├─ JoinByCodeInput.tsx     ← NEW: 6-char paste-friendly input
│        └─ RoomMembersBar.tsx      ← NEW: avatar strip with ready / playing state
└─ app/<game>/hooks/use<Game>Game.ts  ← MODIFY (×12): swap to useStarPeerConnection
                                       ←  + N-way id_exchange + N-player game logic

tests/
├─ integration/rooms/
│  ├─ codes.test.ts                 ← NEW: 6-char collision sanity
│  ├─ election.test.ts              ← NEW: deterministic election
│  └─ store.test.ts                 ← NEW: KV CRUD round-trip
├─ integration/leaderboards/
│  └─ pairwise.test.ts              ← NEW: position → pair-list converter
└─ e2e/rooms.spec.ts                ← NEW: lobby + create/join + race E2E
```

Each lib file has one focused responsibility. Game-page modifications follow the same uniform pattern as Feature B (single integration point per game).

---

## Phase 0 — Pure helpers (TDD)

### Task 1: 6-char room code generator

**Files:**
- Create: `src/lib/rooms/codes.ts`
- Create: `tests/integration/rooms/codes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/integration/rooms/codes.test.ts
import { describe, it, expect } from "vitest";
import { generateRoomCode, ROOM_CODE_LENGTH, ROOM_CODE_ALPHABET } from "@/lib/rooms/codes";

describe("generateRoomCode", () => {
  it("returns a 6-character string", () => {
    expect(ROOM_CODE_LENGTH).toBe(6);
    const code = generateRoomCode();
    expect(code).toHaveLength(6);
  });

  it("uses only the allowed alphabet (no ambiguous chars)", () => {
    for (let i = 0; i < 1000; i++) {
      const code = generateRoomCode();
      for (const ch of code) {
        expect(ROOM_CODE_ALPHABET.includes(ch)).toBe(true);
      }
    }
  });

  it("excludes 0/O/1/I/L for visual unambiguity", () => {
    expect(ROOM_CODE_ALPHABET.includes("0")).toBe(false);
    expect(ROOM_CODE_ALPHABET.includes("O")).toBe(false);
    expect(ROOM_CODE_ALPHABET.includes("1")).toBe(false);
    expect(ROOM_CODE_ALPHABET.includes("I")).toBe(false);
    expect(ROOM_CODE_ALPHABET.includes("L")).toBe(false);
  });

  it("collision rate is acceptable across 10k generations", () => {
    const seen = new Set<string>();
    let collisions = 0;
    for (let i = 0; i < 10000; i++) {
      const code = generateRoomCode();
      if (seen.has(code)) collisions++;
      seen.add(code);
    }
    // 30^6 = ~7.3e8 keyspace, 10k draws → expected collisions ≈ 0.07
    expect(collisions).toBeLessThan(5);
  });
});
```

- [ ] **Step 2: Run — should fail**

Run: `npm test -- tests/integration/rooms/codes.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// src/lib/rooms/codes.ts
// Excludes visually ambiguous characters (0/O, 1/I/L) for readability.
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 30 chars
export const ROOM_CODE_LENGTH = 6;

export function generateRoomCode(): string {
  let out = "";
  // crypto.getRandomValues exists in Workers runtime + browsers + node 20+
  const buf = new Uint32Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(buf);
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    out += ROOM_CODE_ALPHABET[buf[i] % ROOM_CODE_ALPHABET.length];
  }
  return out;
}
```

- [ ] **Step 4: Run — should pass**

Run: `npm test -- tests/integration/rooms/codes.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rooms/codes.ts tests/integration/rooms/codes.test.ts
git commit -m "feat(rooms): 6-char room code generator (no ambiguous chars)"
```

### Task 2: Deterministic host election

**Files:**
- Create: `src/lib/rooms/election.ts`
- Create: `tests/integration/rooms/election.test.ts`

- [ ] **Step 1: Failing tests**

```ts
// tests/integration/rooms/election.test.ts
import { describe, it, expect } from "vitest";
import { electHost, type Member } from "@/lib/rooms/election";

const m = (userId: string, online = true): Member => ({ userId, peerId: `peer-${userId}`, online });

describe("electHost", () => {
  it("returns the lowest userId among online members", () => {
    expect(electHost([m("zoe"), m("alice"), m("bob")])).toEqual(m("alice"));
  });

  it("ignores offline members", () => {
    expect(electHost([m("alice", false), m("bob"), m("zoe")])).toEqual(m("bob"));
  });

  it("returns null when no members are online", () => {
    expect(electHost([m("alice", false), m("bob", false)])).toBeNull();
  });

  it("returns null on empty member list", () => {
    expect(electHost([])).toBeNull();
  });

  it("is stable: same input → same output", () => {
    const list = [m("c"), m("a"), m("b")];
    const a = electHost(list);
    const b = electHost(list);
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Run — should fail**

Run: `npm test -- tests/integration/rooms/election.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// src/lib/rooms/election.ts

export interface Member {
  userId: string;
  peerId: string;
  online: boolean;
}

/** Lowest userId among online members. Pure, deterministic. */
export function electHost(members: Member[]): Member | null {
  const online = members.filter((m) => m.online);
  if (online.length === 0) return null;
  let best = online[0];
  for (let i = 1; i < online.length; i++) {
    if (online[i].userId < best.userId) best = online[i];
  }
  return best;
}
```

- [ ] **Step 4: Run + commit**

```bash
npm test -- tests/integration/rooms/election.test.ts
git add src/lib/rooms/election.ts tests/integration/rooms/election.test.ts
git commit -m "feat(rooms): deterministic host election (lowest online userId)"
```

### Task 3: Position list → pair list converter

**Files:**
- Create: `src/lib/leaderboards/pairwise.ts`
- Create: `tests/integration/leaderboards/pairwise.test.ts`

- [ ] **Step 1: Failing tests**

```ts
// tests/integration/leaderboards/pairwise.test.ts
import { describe, it, expect } from "vitest";
import { positionsToPairs } from "@/lib/leaderboards/pairwise";

describe("positionsToPairs", () => {
  it("2-player: produces a single pair", () => {
    expect(positionsToPairs(["a", "b"])).toEqual([
      { winnerId: "a", loserId: "b", wasTie: false },
    ]);
  });

  it("3-player: produces 3 pairs (1v2, 1v3, 2v3)", () => {
    expect(positionsToPairs(["a", "b", "c"])).toEqual([
      { winnerId: "a", loserId: "b", wasTie: false },
      { winnerId: "a", loserId: "c", wasTie: false },
      { winnerId: "b", loserId: "c", wasTie: false },
    ]);
  });

  it("4-player produces 6 pairs", () => {
    const pairs = positionsToPairs(["a", "b", "c", "d"]);
    expect(pairs.length).toBe(6); // C(4,2)
  });

  it("6-player produces 15 pairs", () => {
    const pairs = positionsToPairs(["a", "b", "c", "d", "e", "f"]);
    expect(pairs.length).toBe(15); // C(6,2)
  });

  it("position determines win: earlier index wins", () => {
    const pairs = positionsToPairs(["winner", "second", "third"]);
    expect(pairs[0]).toEqual({ winnerId: "winner", loserId: "second", wasTie: false });
    expect(pairs[1]).toEqual({ winnerId: "winner", loserId: "third", wasTie: false });
    expect(pairs[2]).toEqual({ winnerId: "second", loserId: "third", wasTie: false });
  });

  it("returns empty array for 0 or 1 player", () => {
    expect(positionsToPairs([])).toEqual([]);
    expect(positionsToPairs(["solo"])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — should fail**

Run: `npm test -- tests/integration/leaderboards/pairwise.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/leaderboards/pairwise.ts

export interface Pair {
  winnerId: string;
  loserId: string;
  wasTie: boolean;
}

/**
 * positions[0] = 1st place; positions[N-1] = last place.
 * Generates all C(N,2) pairs where the earlier-position player is the winner.
 */
export function positionsToPairs(positions: string[]): Pair[] {
  const out: Pair[] = [];
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      out.push({ winnerId: positions[i], loserId: positions[j], wasTie: false });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run + commit**

```bash
npm test -- tests/integration/leaderboards/pairwise.test.ts
git add src/lib/leaderboards/pairwise.ts tests/integration/leaderboards/pairwise.test.ts
git commit -m "feat(lb): positionsToPairs — N-player position list to pairwise rows"
```

---

## Phase 1 — Room KV store + Room API

### Task 4: KV store helpers

**Files:**
- Create: `src/lib/rooms/store.ts`

- [ ] **Step 1: Implement**

```ts
// src/lib/rooms/store.ts
import type { KVNamespace } from "@cloudflare/workers-types";

export interface Slot {
  userId: string;
  peerId: string;
  displayUsername: string | null;
  joinedAt: number;
}

export interface RoomState {
  code: string;
  game: string;
  visibility: "public" | "private";
  capacity: number;
  hostUserId: string;
  hostPeerId: string;
  slots: Slot[];
  createdAt: number;
  lastHeartbeat: number;
  promotionGen: number;
}

const ROOM_TTL_SEC = 30 * 60; // 30 min
const STALE_HEARTBEAT_MS = 90_000; // 90s without heartbeat → considered dead

function roomKey(code: string): string {
  return `room:${code}`;
}
function lobbyKey(game: string): string {
  return `lobby:${game}`;
}
function banKey(userId: string): string {
  return `banned:${userId}`;
}

export async function isBanned(kv: KVNamespace, userId: string): Promise<boolean> {
  return (await kv.get(banKey(userId))) !== null;
}

export async function getRoom(kv: KVNamespace, code: string): Promise<RoomState | null> {
  const raw = await kv.get(roomKey(code));
  if (!raw) return null;
  const r = JSON.parse(raw) as RoomState;
  if (Date.now() - r.lastHeartbeat > STALE_HEARTBEAT_MS) return null;
  return r;
}

export async function createRoom(
  kv: KVNamespace,
  init: Omit<RoomState, "createdAt" | "lastHeartbeat" | "promotionGen" | "slots"> & {
    initialSlot: Slot;
  },
): Promise<void> {
  const now = Date.now();
  const room: RoomState = {
    code: init.code,
    game: init.game,
    visibility: init.visibility,
    capacity: init.capacity,
    hostUserId: init.hostUserId,
    hostPeerId: init.hostPeerId,
    slots: [init.initialSlot],
    createdAt: now,
    lastHeartbeat: now,
    promotionGen: 0,
  };
  await kv.put(roomKey(init.code), JSON.stringify(room), { expirationTtl: ROOM_TTL_SEC });
  if (init.visibility === "public") {
    const codes = await listLobbyCodes(kv, init.game);
    if (!codes.includes(init.code)) codes.push(init.code);
    await kv.put(lobbyKey(init.game), JSON.stringify(codes), { expirationTtl: ROOM_TTL_SEC });
  }
}

export async function joinRoom(
  kv: KVNamespace,
  code: string,
  slot: Slot,
): Promise<{ ok: true; room: RoomState } | { ok: false; reason: string }> {
  const room = await getRoom(kv, code);
  if (!room) return { ok: false, reason: "not_found" };
  if (room.slots.length >= room.capacity) return { ok: false, reason: "full" };
  if (room.slots.some((s) => s.userId === slot.userId)) return { ok: false, reason: "already_in" };
  room.slots.push(slot);
  await kv.put(roomKey(code), JSON.stringify(room), { expirationTtl: ROOM_TTL_SEC });
  return { ok: true, room };
}

export async function leaveRoom(
  kv: KVNamespace,
  code: string,
  userId: string,
): Promise<void> {
  const room = await getRoom(kv, code);
  if (!room) return;
  room.slots = room.slots.filter((s) => s.userId !== userId);
  if (room.slots.length === 0) {
    await kv.delete(roomKey(code));
    if (room.visibility === "public") {
      const codes = (await listLobbyCodes(kv, room.game)).filter((c) => c !== code);
      await kv.put(lobbyKey(room.game), JSON.stringify(codes), { expirationTtl: ROOM_TTL_SEC });
    }
    return;
  }
  await kv.put(roomKey(code), JSON.stringify(room), { expirationTtl: ROOM_TTL_SEC });
}

export async function heartbeatRoom(
  kv: KVNamespace,
  code: string,
  hostUserId: string,
): Promise<boolean> {
  const room = await getRoom(kv, code);
  if (!room || room.hostUserId !== hostUserId) return false;
  room.lastHeartbeat = Date.now();
  await kv.put(roomKey(code), JSON.stringify(room), { expirationTtl: ROOM_TTL_SEC });
  return true;
}

export async function promoteHost(
  kv: KVNamespace,
  code: string,
  newHostUserId: string,
  newHostPeerId: string,
  expectedOldHostPeerId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const room = await getRoom(kv, code);
  if (!room) return { ok: false, reason: "not_found" };
  if (room.hostPeerId !== expectedOldHostPeerId) return { ok: false, reason: "stale_cas" };
  if (!room.slots.some((s) => s.userId === newHostUserId)) {
    return { ok: false, reason: "not_member" };
  }
  room.hostUserId = newHostUserId;
  room.hostPeerId = newHostPeerId;
  room.lastHeartbeat = Date.now();
  room.promotionGen += 1;
  await kv.put(roomKey(code), JSON.stringify(room), { expirationTtl: ROOM_TTL_SEC });
  return { ok: true };
}

async function listLobbyCodes(kv: KVNamespace, game: string): Promise<string[]> {
  const raw = await kv.get(lobbyKey(game));
  return raw ? (JSON.parse(raw) as string[]) : [];
}

export async function listPublicRooms(
  kv: KVNamespace,
  game: string,
): Promise<RoomState[]> {
  const codes = await listLobbyCodes(kv, game);
  const rooms: RoomState[] = [];
  const stillAlive: string[] = [];
  for (const c of codes) {
    const r = await getRoom(kv, c);
    if (r && r.visibility === "public" && r.slots.length < r.capacity) {
      rooms.push(r);
      stillAlive.push(c);
    }
  }
  if (stillAlive.length !== codes.length) {
    await kv.put(lobbyKey(game), JSON.stringify(stillAlive), { expirationTtl: ROOM_TTL_SEC });
  }
  return rooms;
}

export const PUBLIC_ROOMS_PER_GAME_CAP = 20;

export async function publicRoomCountForGame(kv: KVNamespace, game: string): Promise<number> {
  return (await listLobbyCodes(kv, game)).length;
}

export async function publicRoomsHostedByUser(kv: KVNamespace, userId: string): Promise<number> {
  // Coarse pass — only meaningful per-game; called at create-time with the target game
  // before generating the new code, so we count across all known lobby keys for that game.
  // For v1 single-user enforcement, we just check the current target game's lobby.
  return 0; // see Task 5 for game-scoped enforcement
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add src/lib/rooms/store.ts
git commit -m "feat(rooms): KV store helpers (createRoom/join/leave/heartbeat/promote/listPublic)"
```

### Task 5: `POST /api/rooms` + `GET /api/rooms?game=`

**Files:**
- Create: `src/app/api/rooms/route.ts`

- [ ] **Step 1: Implement**

```ts
// src/app/api/rooms/route.ts
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { GAME_IDS, type GameId } from "@/db/schema/leaderboards";
import { generateRoomCode } from "@/lib/rooms/codes";
import {
  createRoom,
  isBanned,
  listPublicRooms,
  publicRoomCountForGame,
  PUBLIC_ROOMS_PER_GAME_CAP,
  type Slot,
} from "@/lib/rooms/store";
import { track } from "@/lib/analytics";

const MAX_CAPACITY: Record<GameId, number> = {
  schulte: 6, reaction: 6, math: 6, "flash-count": 6,
  trail: 6, pattern: 6, sudoku: 6, maze: 6,
  poker: 6, "halli-galli": 6,
  gomoku: 2, "pulse-duel": 2,
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  if (!session.user.emailVerified) return new Response("Verified email required", { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Partial<{
    game: GameId; visibility: "public" | "private"; capacity: number; hostPeerId: string;
  }>;

  if (!body.game || !GAME_IDS.includes(body.game)) return new Response("Bad game", { status: 400 });
  if (body.visibility !== "public" && body.visibility !== "private") {
    return new Response("Bad visibility", { status: 400 });
  }
  const max = MAX_CAPACITY[body.game];
  if (typeof body.capacity !== "number" || body.capacity < 2 || body.capacity > max) {
    return new Response(`Bad capacity (must be 2..${max})`, { status: 400 });
  }
  if (typeof body.hostPeerId !== "string" || !body.hostPeerId) {
    return new Response("Bad hostPeerId", { status: 400 });
  }

  const e = env();
  if (await isBanned(e.CACHE, session.user.id)) return new Response("Banned", { status: 403 });

  const limit = await rateLimit(e.CACHE, {
    key: `room:create:${session.user.id}`,
    limit: 10, windowSec: 3600,
  });
  if (!limit.ok) return new Response("Rate limit", { status: 429 });

  if (body.visibility === "public") {
    const count = await publicRoomCountForGame(e.CACHE, body.game);
    if (count >= PUBLIC_ROOMS_PER_GAME_CAP) {
      return new Response("Public lobby full — create a private room instead", { status: 503 });
    }
  }

  const code = generateRoomCode();
  const slot: Slot = {
    userId: session.user.id,
    peerId: body.hostPeerId,
    displayUsername:
      ((session.user as { displayUsername?: string | null }).displayUsername ?? null),
    joinedAt: Date.now(),
  };
  await createRoom(e.CACHE, {
    code,
    game: body.game,
    visibility: body.visibility,
    capacity: body.capacity,
    hostUserId: session.user.id,
    hostPeerId: body.hostPeerId,
    initialSlot: slot,
  });

  track({ name: "room.created", game: body.game, visibility: body.visibility });
  return Response.json({ code, role: "host" });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const game = url.searchParams.get("game");
  if (!game || !GAME_IDS.includes(game as GameId)) {
    return new Response("Bad game", { status: 400 });
  }
  const rooms = await listPublicRooms(env().CACHE, game);
  return Response.json({
    rooms: rooms.map((r) => ({
      code: r.code,
      game: r.game,
      capacity: r.capacity,
      slotsTaken: r.slots.length,
      hostDisplayName: r.slots[0]?.displayUsername ?? null,
      createdAt: r.createdAt,
    })),
  });
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add src/app/api/rooms/route.ts
git commit -m "feat(rooms): POST /api/rooms (create) + GET /api/rooms (lobby)"
```

### Task 6: `POST /api/rooms/[code]/join`

**Files:**
- Create: `src/app/api/rooms/[code]/join/route.ts`

- [ ] **Step 1: Implement**

```ts
// src/app/api/rooms/[code]/join/route.ts
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { isBanned, joinRoom, type Slot } from "@/lib/rooms/store";
import { track } from "@/lib/analytics";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const session = await getSession();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  if (!session.user.emailVerified) return new Response("Verified email required", { status: 403 });

  const { code } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Partial<{ peerId: string }>;
  if (typeof body.peerId !== "string" || !body.peerId) {
    return new Response("Bad peerId", { status: 400 });
  }

  const e = env();
  if (await isBanned(e.CACHE, session.user.id)) return new Response("Banned", { status: 403 });

  const limit = await rateLimit(e.CACHE, {
    key: `room:join:${session.user.id}`,
    limit: 30, windowSec: 3600,
  });
  if (!limit.ok) return new Response("Rate limit", { status: 429 });

  const slot: Slot = {
    userId: session.user.id,
    peerId: body.peerId,
    displayUsername:
      ((session.user as { displayUsername?: string | null }).displayUsername ?? null),
    joinedAt: Date.now(),
  };
  const r = await joinRoom(e.CACHE, code, slot);
  if (!r.ok) {
    if (r.reason === "not_found") return new Response("Room not found", { status: 404 });
    if (r.reason === "full") return new Response("Room full", { status: 409 });
    if (r.reason === "already_in") {
      // Idempotent re-join: return success with current state
      return Response.json({ alreadyIn: true });
    }
    return new Response(r.reason, { status: 400 });
  }

  track({ name: "room.joined", game: r.room.game });
  return Response.json({
    code,
    hostPeerId: r.room.hostPeerId,
    members: r.room.slots,
    role: "guest",
  });
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add src/app/api/rooms/[code]/join/route.ts
git commit -m "feat(rooms): POST /api/rooms/[code]/join — slot reservation"
```

### Task 7: heartbeat + leave + promote endpoints

**Files:**
- Create: `src/app/api/rooms/[code]/heartbeat/route.ts`
- Create: `src/app/api/rooms/[code]/leave/route.ts`
- Create: `src/app/api/rooms/[code]/promote/route.ts`

- [ ] **Step 1: Heartbeat**

```ts
// src/app/api/rooms/[code]/heartbeat/route.ts
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { heartbeatRoom } from "@/lib/rooms/store";

export async function POST(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const session = await getSession();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const { code } = await ctx.params;
  const ok = await heartbeatRoom(env().CACHE, code, session.user.id);
  if (!ok) return new Response("Not host or room expired", { status: 403 });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 2: Leave**

```ts
// src/app/api/rooms/[code]/leave/route.ts
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { leaveRoom } from "@/lib/rooms/store";
import { track } from "@/lib/analytics";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const session = await getSession();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const { code } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Partial<{ reason: string; game?: string }>;
  await leaveRoom(env().CACHE, code, session.user.id);
  track({
    name: "room.left",
    game: body.game ?? "unknown",
    reason: (body.reason === "voluntary" || body.reason === "disconnect" || body.reason === "host_gone")
      ? body.reason
      : "voluntary",
  });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 3: Promote (CAS)**

```ts
// src/app/api/rooms/[code]/promote/route.ts
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { promoteHost } from "@/lib/rooms/store";
import { track } from "@/lib/analytics";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const session = await getSession();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const { code } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Partial<{
    newHostPeerId: string; expectedOldHostPeerId: string; game?: string;
  }>;
  if (!body.newHostPeerId || !body.expectedOldHostPeerId) {
    return new Response("Bad request", { status: 400 });
  }
  const r = await promoteHost(
    env().CACHE,
    code,
    session.user.id,
    body.newHostPeerId,
    body.expectedOldHostPeerId,
  );
  if (!r.ok) {
    if (r.reason === "stale_cas") return new Response("Stale promotion", { status: 409 });
    if (r.reason === "not_member") return new Response("Not a room member", { status: 403 });
    return new Response("Not found", { status: 404 });
  }
  track({ name: "room.host_promoted", game: body.game ?? "unknown" });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 4: Typecheck + commit**

```bash
npm run typecheck
git add src/app/api/rooms/[code]
git commit -m "feat(rooms): heartbeat + leave + promote endpoints"
```

### Task 8: `GET /api/rooms/[code]` + `DELETE`

**Files:**
- Create: `src/app/api/rooms/[code]/route.ts`

- [ ] **Step 1: Implement**

```ts
// src/app/api/rooms/[code]/route.ts
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { getRoom, leaveRoom } from "@/lib/rooms/store";

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const room = await getRoom(env().CACHE, code);
  if (!room) return new Response("Not found", { status: 404 });
  return Response.json({
    code: room.code,
    game: room.game,
    visibility: room.visibility,
    capacity: room.capacity,
    hostPeerId: room.hostPeerId,
    hostUserId: room.hostUserId,
    members: room.slots,
    promotionGen: room.promotionGen,
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const session = await getSession();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const { code } = await ctx.params;
  const room = await getRoom(env().CACHE, code);
  if (!room) return new Response(null, { status: 204 });
  if (room.hostUserId !== session.user.id) return new Response("Not host", { status: 403 });
  await leaveRoom(env().CACHE, code, session.user.id);
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add src/app/api/rooms/[code]/route.ts
git commit -m "feat(rooms): GET /api/rooms/[code] + DELETE (host close)"
```

---

## Phase 2 — Bulk match endpoint

### Task 9: `POST /api/matches/bulk` (host-only path)

**Files:**
- Create: `src/app/api/matches/bulk/route.ts`

- [ ] **Step 1: Implement**

```ts
// src/app/api/matches/bulk/route.ts
import { eq, and } from "drizzle-orm";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { getDb } from "@/db/client";
import {
  matches,
  ratings,
  GAME_IDS,
  type GameId,
} from "@/db/schema/leaderboards";
import { user as userTable } from "@/db/schema/auth";
import { computeElo, STARTING_ELO } from "@/lib/leaderboards/elo";
import { getRoom, isBanned } from "@/lib/rooms/store";
import { track } from "@/lib/analytics";

interface PairInput { winnerId: string; loserId: string; wasTie?: boolean; }
interface Body { matchId: string; game: GameId; results: PairInput[]; roomCode?: string; }

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  if (!session.user.emailVerified) return new Response("Verified email required", { status: 403 });

  const e = env();
  if (await isBanned(e.CACHE, session.user.id)) return new Response("Banned", { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Partial<Body>;
  if (!body.matchId || typeof body.matchId !== "string") {
    return new Response("Bad matchId", { status: 400 });
  }
  if (!body.game || !GAME_IDS.includes(body.game)) {
    return new Response("Bad game", { status: 400 });
  }
  if (!Array.isArray(body.results) || body.results.length === 0) {
    return new Response("Bad results", { status: 400 });
  }

  // Validate caller is in the match.
  const callerInResults = body.results.some(
    (p) => p.winnerId === session.user.id || p.loserId === session.user.id,
  );
  if (!callerInResults) {
    return new Response("Not a participant", { status: 403 });
  }

  // Validate pair count = N(N-1)/2.
  const userIds = new Set<string>();
  for (const p of body.results) {
    if (typeof p.winnerId !== "string" || typeof p.loserId !== "string") {
      return new Response("Bad pair shape", { status: 400 });
    }
    userIds.add(p.winnerId);
    userIds.add(p.loserId);
  }
  const N = userIds.size;
  if (body.results.length !== (N * (N - 1)) / 2) {
    return new Response(`Expected ${(N*(N-1))/2} pairs for N=${N}, got ${body.results.length}`, {
      status: 400,
    });
  }

  // Optional room cross-check: if roomCode supplied, verify caller is host of a private room
  // OR pursue cooperative reporting (Task 10).
  let isPrivateHost = false;
  if (body.roomCode) {
    const room = await getRoom(e.CACHE, body.roomCode);
    if (!room) return new Response("Room not found", { status: 404 });
    if (room.visibility === "private") {
      if (room.hostUserId !== session.user.id) {
        return new Response("Only host reports private rooms", { status: 403 });
      }
      isPrivateHost = true;
    }
    // Validate every userId in results is a member of the room.
    const memberIds = new Set(room.slots.map((s) => s.userId));
    for (const id of userIds) {
      if (!memberIds.has(id)) return new Response("Non-member in results", { status: 400 });
    }
  }

  // Public path delegates to cooperative-window helper (Task 10). For now, assume private.
  if (body.roomCode && !isPrivateHost) {
    const { reportCooperative } = await import("@/lib/rooms/coopReport");
    const outcome = await reportCooperative(e.CACHE, body.roomCode, body.matchId, session.user.id, body.results);
    if (outcome === "stored") return Response.json({ status: "pending" });
    if (outcome === "mismatch") {
      track({ name: "match.bulk_dropped", game: body.game, reason: "mismatch" });
      return Response.json({ status: "dropped", reason: "mismatch" });
    }
    if (outcome === "timeout") {
      track({ name: "match.bulk_dropped", game: body.game, reason: "timeout" });
      return Response.json({ status: "dropped", reason: "timeout" });
    }
    // outcome === "confirmed" → fall through to commit
  }

  // Email-verified check on every player.
  const db = getDb();
  for (const id of userIds) {
    const [u] = await db.select().from(userTable).where(eq(userTable.id, id));
    if (!u || !u.emailVerified) {
      return new Response(`User ${id} must be email-verified to rank`, { status: 403 });
    }
  }

  // Compute deltas + write everything in one D1 batch.
  type Stmt = ReturnType<typeof db.insert> | ReturnType<typeof db.update>;
  const stmts: Stmt[] = [];

  for (const pair of body.results) {
    const winnerRating = await getOrCreateRating(db, pair.winnerId, body.game);
    const loserRating = await getOrCreateRating(db, pair.loserId, body.game);
    const elo = computeElo({
      winnerElo: winnerRating.elo,
      loserElo: loserRating.elo,
      winnerMatches: winnerRating.matchesPlayed,
      loserMatches: loserRating.matchesPlayed,
      wasTie: !!pair.wasTie,
    });

    stmts.push(
      db.insert(matches).values({
        id: crypto.randomUUID(),
        game: body.game,
        winnerId: pair.wasTie ? null : pair.winnerId,
        loserId: pair.wasTie ? null : pair.loserId,
        wasTie: !!pair.wasTie,
        winnerEloDelta: elo.winnerDelta,
        loserEloDelta: elo.loserDelta,
      }),
    );

    stmts.push(
      db
        .update(ratings)
        .set({
          elo: winnerRating.elo + elo.winnerDelta,
          matchesPlayed: winnerRating.matchesPlayed + 1,
          wins: (winnerRating.wins ?? 0) + (pair.wasTie ? 0 : 1),
          ties: (winnerRating.ties ?? 0) + (pair.wasTie ? 1 : 0),
          lastMatchAt: new Date(),
        })
        .where(and(eq(ratings.userId, pair.winnerId), eq(ratings.game, body.game))),
    );

    stmts.push(
      db
        .update(ratings)
        .set({
          elo: loserRating.elo + elo.loserDelta,
          matchesPlayed: loserRating.matchesPlayed + 1,
          losses: (loserRating.losses ?? 0) + (pair.wasTie ? 0 : 1),
          ties: (loserRating.ties ?? 0) + (pair.wasTie ? 1 : 0),
          lastMatchAt: new Date(),
        })
        .where(and(eq(ratings.userId, pair.loserId), eq(ratings.game, body.game))),
    );
  }

  // D1 batch (atomic).
  // @ts-expect-error drizzle d1 batch typing
  await db.batch(stmts);

  track({ name: "room.match_complete", game: body.game, n: N });
  return Response.json({ status: "confirmed", n: N });
}

async function getOrCreateRating(
  db: ReturnType<typeof getDb>,
  userId: string,
  game: GameId,
): Promise<{ elo: number; matchesPlayed: number; wins: number; losses: number; ties: number }> {
  const [row] = await db
    .select()
    .from(ratings)
    .where(and(eq(ratings.userId, userId), eq(ratings.game, game)));
  if (row) return row;
  await db.insert(ratings).values({
    userId, game, elo: STARTING_ELO,
    matchesPlayed: 0, wins: 0, losses: 0, ties: 0,
  });
  return { elo: STARTING_ELO, matchesPlayed: 0, wins: 0, losses: 0, ties: 0 };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`

(Will fail because `coopReport` is imported but not yet implemented — that's Task 10.)

- [ ] **Step 3: No commit yet — Task 10 closes the import**

### Task 10: Cooperative N-way report window

**Files:**
- Create: `src/lib/rooms/coopReport.ts`

- [ ] **Step 1: Implement**

```ts
// src/lib/rooms/coopReport.ts
import type { KVNamespace } from "@cloudflare/workers-types";

interface PairInput { winnerId: string; loserId: string; wasTie?: boolean; }
interface CoopReport {
  matchId: string;
  reports: { userId: string; results: PairInput[]; reportedAt: number }[];
  expectedN: number;
}

const TTL_SEC = 60;

function key(roomCode: string, matchId: string): string {
  return `room:${roomCode}:report:${matchId}`;
}

function pairsEqual(a: PairInput[], b: PairInput[]): boolean {
  if (a.length !== b.length) return false;
  // Order-insensitive set comparison via canonical string keys.
  const norm = (p: PairInput) =>
    `${p.winnerId}|${p.loserId}|${p.wasTie ? "T" : "F"}`;
  const setA = new Set(a.map(norm));
  for (const p of b) if (!setA.has(norm(p))) return false;
  return true;
}

/**
 * Returns:
 *   "stored"    — first / additional report stored, waiting for more
 *   "confirmed" — all N reports in, all agree → caller should commit
 *   "mismatch"  — a report disagrees with the stored one → caller drops
 *   "timeout"   — reserved for future; coopReport itself doesn't time out (KV TTL does)
 */
export async function reportCooperative(
  kv: KVNamespace,
  roomCode: string,
  matchId: string,
  userId: string,
  results: PairInput[],
): Promise<"stored" | "confirmed" | "mismatch" | "timeout"> {
  // expectedN inferred from the N(N-1)/2 pair count.
  const userIds = new Set<string>();
  for (const p of results) { userIds.add(p.winnerId); userIds.add(p.loserId); }
  const expectedN = userIds.size;

  const raw = await kv.get(key(roomCode, matchId));
  let state: CoopReport;
  if (!raw) {
    state = { matchId, reports: [{ userId, results, reportedAt: Date.now() }], expectedN };
    await kv.put(key(roomCode, matchId), JSON.stringify(state), { expirationTtl: TTL_SEC });
    return "stored";
  }
  state = JSON.parse(raw) as CoopReport;
  if (state.reports.some((r) => r.userId === userId)) {
    // Idempotent re-submit
    return state.reports.length >= state.expectedN ? "confirmed" : "stored";
  }
  if (!pairsEqual(state.reports[0].results, results)) {
    await kv.delete(key(roomCode, matchId));
    return "mismatch";
  }
  state.reports.push({ userId, results, reportedAt: Date.now() });
  if (state.reports.length >= state.expectedN) {
    await kv.delete(key(roomCode, matchId));
    return "confirmed";
  }
  await kv.put(key(roomCode, matchId), JSON.stringify(state), { expirationTtl: TTL_SEC });
  return "stored";
}
```

- [ ] **Step 2: Typecheck + commit Phase 2**

```bash
npm run typecheck
git add src/app/api/matches/bulk/route.ts src/lib/rooms/coopReport.ts
git commit -m "feat(rooms): POST /api/matches/bulk + cooperative N-way report window"
```

---

## Phase 3 — Star peer connection hook

### Task 11: `useStarPeerConnection` — multi-channel host / single-channel guest

**Files:**
- Create: `src/features/p2p/hooks/useStarPeerConnection.ts`

> This is a substantial new hook. Each step shows the relevant slice; the engineer assembles the file from these slices.

- [ ] **Step 1: Skeleton + types**

Open the file and start with:

```ts
// src/features/p2p/hooks/useStarPeerConnection.ts
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Peer, { type DataConnection } from "peerjs";
import { fetchIceServers } from "../config";

export interface StarMember {
  userId: string;
  peerId: string;
  displayUsername: string | null;
}

export interface StarOptions<TPacket> {
  /** "host" if we created the room; "guest" if we joined. */
  role: "host" | "guest";
  /** When role==="guest", the peerId we should dial. */
  hostPeerId: string | null;
  /** Optional pre-allocated peerId (used after auto-promote to keep reconnects predictable). */
  myPeerId?: string;
  /** Fired when a packet arrives. Sender peerId provided so host can fan-out. */
  onData: (payload: TPacket, fromPeerId: string) => void;
  onPeerConnected?: (peerId: string) => void;
  onPeerDisconnected?: (peerId: string) => void;
  onHostLost?: () => void;
  /** Required: a stable room-keyed PeerJS prefix so reconnects work. */
  prefix: string;
  enabled: boolean;
}

export interface StarApi<TPacket> {
  myPeerId: string | null;
  isReady: boolean;
  /** Send to all connected peers. Host: all guests. Guest: just to host. */
  broadcast: (packet: TPacket) => void;
  /** Send only to a specific peerId (host-only useful primitive). */
  sendTo: (peerId: string, packet: TPacket) => void;
  destroy: () => void;
}
```

- [ ] **Step 2: Hook body — host mode**

Append to the same file:

```ts
export function useStarPeerConnection<TPacket>(opts: StarOptions<TPacket>): StarApi<TPacket> {
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const peerRef = useRef<Peer | null>(null);
  // Host: peerId → DataConnection. Guest: holds at most one entry (to host).
  const channelsRef = useRef<Map<string, DataConnection>>(new Map());
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; }, [opts]);

  const cleanup = useCallback(() => {
    for (const c of channelsRef.current.values()) {
      try { c.close(); } catch {}
    }
    channelsRef.current.clear();
    try { peerRef.current?.destroy(); } catch {}
    peerRef.current = null;
    setMyPeerId(null);
    setIsReady(false);
  }, []);

  useEffect(() => {
    if (!opts.enabled) { cleanup(); return; }
    let cancelled = false;
    (async () => {
      const iceServers = await fetchIceServers();
      const desiredId = opts.myPeerId ?? `${opts.prefix}-${Math.random().toString(36).slice(2, 10)}`;
      const peer = new Peer(desiredId, { config: { iceServers } });
      if (cancelled) { peer.destroy(); return; }
      peerRef.current = peer;

      peer.on("open", (id) => {
        if (cancelled) return;
        setMyPeerId(id);
        if (optsRef.current.role === "host") {
          setIsReady(true);
        } else {
          // Guest: dial host now that our own peer is open.
          const target = optsRef.current.hostPeerId;
          if (!target) return;
          const conn = peer.connect(target, { reliable: true });
          attachConnection(conn);
        }
      });

      peer.on("connection", (conn) => {
        // Host accepts incoming guest connections.
        if (optsRef.current.role !== "host") { conn.close(); return; }
        attachConnection(conn);
      });

      peer.on("error", (err) => {
        // Surface as host-lost for the guest if connection target is unreachable.
        if (optsRef.current.role === "guest") {
          optsRef.current.onHostLost?.();
        }
        // Other errors: noisy but non-fatal.
        // eslint-disable-next-line no-console
        console.warn("[useStarPeerConnection] peer error:", err);
      });

      function attachConnection(conn: DataConnection) {
        const onOpen = () => {
          channelsRef.current.set(conn.peer, conn);
          if (optsRef.current.role === "guest") setIsReady(true);
          optsRef.current.onPeerConnected?.(conn.peer);
        };
        const onData = (raw: unknown) => {
          optsRef.current.onData(raw as TPacket, conn.peer);
        };
        const onClose = () => {
          channelsRef.current.delete(conn.peer);
          optsRef.current.onPeerDisconnected?.(conn.peer);
          if (optsRef.current.role === "guest" && conn.peer === optsRef.current.hostPeerId) {
            optsRef.current.onHostLost?.();
          }
        };
        conn.on("open", onOpen);
        conn.on("data", onData);
        conn.on("close", onClose);
        conn.on("error", onClose);
        if (conn.open) onOpen();
      }
    })();

    return () => { cancelled = true; cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.enabled, opts.role, opts.hostPeerId, opts.prefix]);

  const broadcast = useCallback((packet: TPacket) => {
    for (const c of channelsRef.current.values()) {
      if (c.open) c.send(packet);
    }
  }, []);

  const sendTo = useCallback((peerId: string, packet: TPacket) => {
    const c = channelsRef.current.get(peerId);
    if (c?.open) c.send(packet);
  }, []);

  const destroy = useCallback(() => cleanup(), [cleanup]);

  return { myPeerId, isReady, broadcast, sendTo, destroy };
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
npm run typecheck
git add src/features/p2p/hooks/useStarPeerConnection.ts
git commit -m "feat(rooms): useStarPeerConnection — multi-channel host, single-channel guest"
```

---

## Phase 4 — `useRoom` orchestrator

### Task 12: `useRoom` hook

**Files:**
- Create: `src/features/rooms/hooks/useRoom.ts`

- [ ] **Step 1: Implement**

```ts
// src/features/rooms/hooks/useRoom.ts
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/auth-client";
import type { GameId } from "@/db/schema/leaderboards";

export interface RoomMember {
  userId: string;
  peerId: string;
  displayUsername: string | null;
  joinedAt: number;
}

export interface RoomSnapshot {
  code: string;
  game: GameId;
  visibility: "public" | "private";
  capacity: number;
  hostUserId: string;
  hostPeerId: string;
  members: RoomMember[];
  promotionGen: number;
}

export interface UseRoomOptions {
  game: GameId;
  /** Caller-provided peerId (assigned before the hook is called). */
  myPeerId: string;
}

export interface UseRoomApi {
  room: RoomSnapshot | null;
  role: "host" | "guest" | null;
  isHost: boolean;
  error: string | null;
  createRoom: (opts: { visibility: "public" | "private"; capacity: number }) => Promise<string | null>;
  joinRoom: (code: string) => Promise<boolean>;
  leaveRoom: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Called after auto-promote elects this client as the new host. */
  acceptPromotion: (newPeerId: string) => Promise<boolean>;
}

const HEARTBEAT_INTERVAL_MS = 60_000;
const REFRESH_INTERVAL_MS = 5_000;

export function useRoom({ game, myPeerId }: UseRoomOptions): UseRoomApi {
  const { data: session } = useSession();
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [role, setRole] = useState<"host" | "guest" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<string | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const myUserId = session?.user?.id ?? null;
  const isHost = role === "host";

  const refresh = useCallback(async () => {
    if (!codeRef.current) return;
    try {
      const r = await fetch(`/api/rooms/${codeRef.current}`);
      if (!r.ok) {
        if (r.status === 404) {
          setRoom(null);
          setError("room_gone");
        }
        return;
      }
      const j = (await r.json()) as RoomSnapshot;
      setRoom(j);
    } catch { /* network */ }
  }, []);

  const startTimers = useCallback((roleHint: "host" | "guest") => {
    if (refreshRef.current) clearInterval(refreshRef.current);
    refreshRef.current = setInterval(() => { refresh(); }, REFRESH_INTERVAL_MS);
    if (roleHint === "host") {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = setInterval(() => {
        if (codeRef.current) {
          fetch(`/api/rooms/${codeRef.current}/heartbeat`, { method: "POST" }).catch(() => {});
        }
      }, HEARTBEAT_INTERVAL_MS);
    }
  }, [refresh]);

  const stopTimers = useCallback(() => {
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
    if (refreshRef.current) { clearInterval(refreshRef.current); refreshRef.current = null; }
  }, []);

  const createRoom = useCallback(async (opts: { visibility: "public" | "private"; capacity: number }) => {
    if (!myUserId) { setError("not_signed_in"); return null; }
    setError(null);
    const r = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game, visibility: opts.visibility, capacity: opts.capacity, hostPeerId: myPeerId }),
    });
    if (!r.ok) { setError(await r.text()); return null; }
    const j = (await r.json()) as { code: string; role: "host" };
    codeRef.current = j.code;
    setRole("host");
    await refresh();
    startTimers("host");
    return j.code;
  }, [game, myPeerId, myUserId, refresh, startTimers]);

  const joinRoom = useCallback(async (code: string) => {
    if (!myUserId) { setError("not_signed_in"); return false; }
    setError(null);
    const r = await fetch(`/api/rooms/${code}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ peerId: myPeerId }),
    });
    if (!r.ok) { setError(await r.text()); return false; }
    codeRef.current = code;
    setRole("guest");
    await refresh();
    startTimers("guest");
    return true;
  }, [myPeerId, myUserId, refresh, startTimers]);

  const leaveRoom = useCallback(async () => {
    if (!codeRef.current) return;
    const code = codeRef.current;
    stopTimers();
    await fetch(`/api/rooms/${code}/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "voluntary", game }),
    }).catch(() => {});
    codeRef.current = null;
    setRoom(null);
    setRole(null);
  }, [game, stopTimers]);

  const acceptPromotion = useCallback(async (newPeerId: string) => {
    if (!codeRef.current || !room) return false;
    const r = await fetch(`/api/rooms/${codeRef.current}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newHostPeerId: newPeerId,
        expectedOldHostPeerId: room.hostPeerId,
        game,
      }),
    });
    if (!r.ok) {
      // 409 means another guest beat us; not fatal.
      return false;
    }
    setRole("host");
    startTimers("host");
    await refresh();
    return true;
  }, [room, game, refresh, startTimers]);

  // Cleanup on unmount.
  useEffect(() => () => {
    stopTimers();
    if (codeRef.current) {
      navigator.sendBeacon?.(
        `/api/rooms/${codeRef.current}/leave`,
        new Blob([JSON.stringify({ reason: "disconnect", game })], { type: "application/json" }),
      );
    }
  }, [game, stopTimers]);

  return { room, role, isHost, error, createRoom, joinRoom, leaveRoom, refresh, acceptPromotion };
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add src/features/rooms/hooks/useRoom.ts
git commit -m "feat(rooms): useRoom — create/join/heartbeat/leave/acceptPromotion"
```

---

## Phase 5 — Room UI components

### Task 13: `RoomMembersBar`

**Files:**
- Create: `src/features/rooms/components/RoomMembersBar.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/features/rooms/components/RoomMembersBar.tsx
"use client";
import { motion } from "framer-motion";
import { InitialsAvatar } from "@/components/auth/InitialsAvatar";
import type { RoomMember } from "@/features/rooms/hooks/useRoom";

export function RoomMembersBar({
  members,
  hostUserId,
  capacity,
}: {
  members: RoomMember[];
  hostUserId: string;
  capacity: number;
}) {
  const slots = Array.from({ length: capacity }, (_, i) => members[i] ?? null);
  return (
    <div className="flex items-center gap-2 p-2 rounded-xl border-2"
      style={{ background: "var(--pixel-card-bg)", borderColor: "var(--pixel-border)" }}
    >
      {slots.map((m, i) =>
        m === null ? (
          <div
            key={`empty-${i}`}
            className="w-7 h-7 rounded-full border-2 border-dashed"
            style={{ borderColor: "var(--pixel-muted)" }}
          />
        ) : (
          <motion.div
            key={m.userId}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: i * 0.05 }}
            className="relative"
            title={m.displayUsername ?? m.userId}
          >
            <InitialsAvatar name={m.displayUsername ?? m.userId} size={28} />
            {m.userId === hostUserId && (
              <span
                className="absolute -top-1 -right-1 text-[8px] font-bold rounded-full px-1"
                style={{
                  background: "var(--pixel-accent)",
                  color: "var(--pixel-bg)",
                }}
              >
                H
              </span>
            )}
          </motion.div>
        ),
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/rooms/components/RoomMembersBar.tsx
git commit -m "feat(rooms): RoomMembersBar avatar strip"
```

### Task 14: `JoinByCodeInput`

**Files:**
- Create: `src/features/rooms/components/JoinByCodeInput.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/features/rooms/components/JoinByCodeInput.tsx
"use client";
import { useState } from "react";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@/lib/rooms/codes";

export function JoinByCodeInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (code: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");

  const sanitize = (s: string) =>
    s.toUpperCase().split("").filter((c) => ROOM_CODE_ALPHABET.includes(c)).join("").slice(0, ROOM_CODE_LENGTH);

  const isComplete = value.length === ROOM_CODE_LENGTH;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (isComplete) onSubmit(value); }}
      className="flex items-center gap-2"
    >
      <input
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(sanitize(e.target.value))}
        onPaste={(e) => {
          const txt = e.clipboardData.getData("text");
          const clean = sanitize(txt);
          if (clean.length === ROOM_CODE_LENGTH) {
            e.preventDefault();
            setValue(clean);
            onSubmit(clean);
          }
        }}
        placeholder="ENTER 6-CHAR CODE"
        className="font-mono tracking-[0.4em] uppercase rounded-xl border-2 px-4 py-2 text-center"
        style={{
          background: "var(--pixel-card-bg)",
          borderColor: "var(--pixel-border)",
          color: "var(--pixel-text)",
          width: "16rem",
        }}
        maxLength={ROOM_CODE_LENGTH}
        disabled={disabled}
      />
      <button
        type="submit"
        disabled={disabled || !isComplete}
        className="rounded-xl border-2 px-3 py-2 font-mono text-xs font-semibold tracking-widest disabled:opacity-50"
        style={{
          background: "var(--pixel-accent)",
          color: "var(--pixel-bg)",
          borderColor: "var(--pixel-accent)",
        }}
      >
        JOIN
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/rooms/components/JoinByCodeInput.tsx
git commit -m "feat(rooms): JoinByCodeInput 6-char paste-friendly input"
```

### Task 15: `CreateRoomModal`

**Files:**
- Create: `src/features/rooms/components/CreateRoomModal.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/features/rooms/components/CreateRoomModal.tsx
"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const MIN_CAPACITY = 2;

export function CreateRoomModal({
  open,
  onClose,
  onCreate,
  maxCapacity,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (opts: { visibility: "public" | "private"; capacity: number }) => void;
  maxCapacity: number;
}) {
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [capacity, setCapacity] = useState(Math.min(4, maxCapacity));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "color-mix(in oklab, black 60%, transparent)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-sm rounded-2xl border-2 p-6"
            style={{ background: "var(--pixel-card-bg)", borderColor: "var(--pixel-border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-sans text-lg font-bold mb-4" style={{ color: "var(--pixel-text)" }}>
              Create a room
            </h2>

            <label className="block font-mono text-[10px] tracking-widest mb-1" style={{ color: "var(--pixel-muted)" }}>
              VISIBILITY
            </label>
            <div className="flex gap-2 mb-4">
              {(["private", "public"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setVisibility(v)}
                  className="flex-1 rounded-xl border-2 px-3 py-2 font-mono text-xs uppercase"
                  style={{
                    background: visibility === v ? "var(--pixel-accent)" : "transparent",
                    color: visibility === v ? "var(--pixel-bg)" : "var(--pixel-text)",
                    borderColor: "var(--pixel-border)",
                  }}
                >
                  {v}
                </button>
              ))}
            </div>

            <label className="block font-mono text-[10px] tracking-widest mb-1" style={{ color: "var(--pixel-muted)" }}>
              CAPACITY ({capacity})
            </label>
            <input
              type="range"
              min={MIN_CAPACITY}
              max={maxCapacity}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="w-full mb-6"
            />

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border-2 px-3 py-2 font-mono text-xs"
                style={{ borderColor: "var(--pixel-border)", color: "var(--pixel-text)" }}
              >
                CANCEL
              </button>
              <button
                onClick={() => onCreate({ visibility, capacity })}
                className="flex-1 rounded-xl border-2 px-3 py-2 font-mono text-xs font-bold"
                style={{
                  background: "var(--pixel-accent)",
                  color: "var(--pixel-bg)",
                  borderColor: "var(--pixel-accent)",
                }}
              >
                CREATE
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/rooms/components/CreateRoomModal.tsx
git commit -m "feat(rooms): CreateRoomModal visibility + capacity picker"
```

### Task 16: `RoomLobby`

**Files:**
- Create: `src/features/rooms/components/RoomLobby.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/features/rooms/components/RoomLobby.tsx
"use client";
import { useEffect, useState } from "react";
import type { GameId } from "@/db/schema/leaderboards";

export interface PublicRoomCard {
  code: string;
  game: GameId;
  capacity: number;
  slotsTaken: number;
  hostDisplayName: string | null;
  createdAt: number;
}

export function RoomLobby({
  game,
  onJoin,
  refreshKey,
}: {
  game: GameId;
  onJoin: (code: string) => void;
  refreshKey?: number;
}) {
  const [rooms, setRooms] = useState<PublicRoomCard[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/rooms?game=${game}`);
        if (!r.ok) return;
        const j = (await r.json()) as { rooms: PublicRoomCard[] };
        if (!cancelled) setRooms(j.rooms);
      } catch {/*network*/}
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [game, refreshKey]);

  if (rooms === null) {
    return <p className="font-mono text-xs" style={{ color: "var(--pixel-muted)" }}>Loading lobby…</p>;
  }
  if (rooms.length === 0) {
    return (
      <p className="font-mono text-xs" style={{ color: "var(--pixel-muted)" }}>
        No public rooms open. Be the first.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {rooms.map((r) => (
        <li key={r.code}>
          <button
            onClick={() => onJoin(r.code)}
            className="block w-full text-left rounded-xl border-2 p-3 transition-transform hover:scale-[1.02]"
            style={{ background: "var(--pixel-card-bg)", borderColor: "var(--pixel-border)" }}
          >
            <div className="flex items-baseline justify-between">
              <span className="font-mono tracking-widest text-sm" style={{ color: "var(--pixel-accent)" }}>
                {r.code}
              </span>
              <span className="font-mono text-[10px]" style={{ color: "var(--pixel-muted)" }}>
                {r.slotsTaken} / {r.capacity}
              </span>
            </div>
            <div className="mt-1 font-sans text-xs truncate" style={{ color: "var(--pixel-text)" }}>
              {r.hostDisplayName ?? "anonymous"}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/rooms/components/RoomLobby.tsx
git commit -m "feat(rooms): RoomLobby public-room card grid with auto-refresh"
```

---

## Phase 6 — `/rooms/[game]` page + game-page links

### Task 17: `/rooms/[game]/page.tsx`

**Files:**
- Create: `src/app/rooms/[game]/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/app/rooms/[game]/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GAMES } from "@/lib/leaderboards/games";
import type { GameId } from "@/db/schema/leaderboards";
import { useRoom } from "@/features/rooms/hooks/useRoom";
import { RoomLobby } from "@/features/rooms/components/RoomLobby";
import { JoinByCodeInput } from "@/features/rooms/components/JoinByCodeInput";
import { CreateRoomModal } from "@/features/rooms/components/CreateRoomModal";

const MAX_CAPACITY: Record<GameId, number> = {
  schulte: 6, reaction: 6, math: 6, "flash-count": 6,
  trail: 6, pattern: 6, sudoku: 6, maze: 6,
  poker: 6, "halli-galli": 6,
  gomoku: 2, "pulse-duel": 2,
};

export default function RoomsPage({ params }: { params: Promise<{ game: string }> }) {
  const router = useRouter();
  const [game, setGame] = useState<GameId | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const myPeerId = `wq-pending-${Math.random().toString(36).slice(2, 10)}`;
  const room = useRoom({ game: game ?? "schulte", myPeerId });

  useEffect(() => {
    params.then(({ game: g }) => {
      if (!(g in GAMES)) { router.replace("/leaderboards"); return; }
      setGame(g as GameId);
    });
  }, [params, router]);

  if (!game) return null;
  const meta = GAMES[game];
  const max = MAX_CAPACITY[game];

  const handleJoin = async (code: string) => {
    const ok = await room.joinRoom(code);
    if (ok) router.push(`/play/${game}?room=${code}`);
  };

  return (
    <div className="min-h-screen px-4 py-12 flex justify-center">
      <div className="w-full max-w-3xl">
        <h1 className="font-sans text-3xl font-bold mb-1" style={{ color: "var(--pixel-text)" }}>
          {meta.label} Rooms
        </h1>
        <p className="font-mono text-xs mb-6" style={{ color: "var(--pixel-muted)" }}>
          Up to {max} players. Code-share or pick from the public list.
        </p>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-xl border-2 px-3 py-2 font-mono text-xs font-bold"
            style={{
              background: "var(--pixel-accent)",
              color: "var(--pixel-bg)",
              borderColor: "var(--pixel-accent)",
            }}
          >
            CREATE ROOM
          </button>
          <JoinByCodeInput onSubmit={handleJoin} />
        </div>

        <h2 className="font-sans text-sm font-semibold tracking-widest mb-3" style={{ color: "var(--pixel-accent)" }}>
          PUBLIC ROOMS
        </h2>
        <RoomLobby game={game} onJoin={handleJoin} />

        <CreateRoomModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          maxCapacity={max}
          onCreate={async (opts) => {
            const code = await room.createRoom(opts);
            setShowCreate(false);
            if (code) router.push(`/play/${game}?room=${code}`);
          }}
        />

        {room.error && (
          <p className="font-mono text-xs mt-4" style={{ color: "#ef4444" }}>
            {room.error}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/rooms/[game]/page.tsx
git commit -m "feat(rooms): /rooms/[game] lobby page (create + join-by-code + public list)"
```

### Task 18: Add "Play with friends" link to all 12 game pages

> Each existing `/<game>/page.tsx` gets a small button linking to `/rooms/<game>`. Pattern is identical per game; the 5-line addition goes near where the existing P2P entry button lives.

- [ ] **Step 1: Find the existing P2P entry button per game**

For each of `src/app/{schulte,reaction,math,flash-count,trail,pattern,sudoku,maze,poker,halli-galli,gomoku,pulse-duel}/page.tsx`, locate the menu / mode-selection block (search for `gameMode === "menu"` or similar). Just below the existing "Play P2P" / "Connect" button, add:

```tsx
import Link from "next/link";

// inside the menu render branch:
<Link
  href={`/rooms/${"<game-id>"}`}  // e.g. "schulte", "poker"
  prefetch={false}
  className="rounded-xl border-2 px-4 py-2 font-mono text-xs font-semibold tracking-widest"
  style={{
    background: "var(--pixel-card-bg)",
    color: "var(--pixel-accent)",
    borderColor: "var(--pixel-accent)",
  }}
>
  ROOMS &amp; FRIENDS
</Link>
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add src/app/schulte src/app/reaction src/app/math src/app/flash-count src/app/trail src/app/pattern src/app/sudoku src/app/maze src/app/poker src/app/halli-galli src/app/gomoku src/app/pulse-duel
git commit -m "feat(rooms): add 'ROOMS & FRIENDS' link to all 12 game menus"
```

---

## Phase 7 — Race-game N-player integrations (8 games)

> Each of the 8 race games (sudoku, maze, schulte, reaction, math, flash-count, trail, pattern) needs the same shape of change:
> 1. Read `?room=<code>` from URL, fetch room state, configure `useStarPeerConnection` with `role` and `hostPeerId`.
> 2. Add `members_sync` packet type carrying the full member list (broadcast by host on every roster change).
> 3. Add `progress_relay` packet type so guests can announce their progress to host, and host fans-out to everyone.
> 4. On race-end, host computes `positions` (sorted by completion time / distance), broadcasts `race_results`.
> 5. After receiving / sending `race_results`, all clients call `submitMatchBulk(positions)`.
>
> The pattern is identical across all 8 games. We'll do **schulte first** (Task 19) as the canonical, then 7 mechanical follow-ups (Tasks 20-26).

### Task 19: Schulte N-player (canonical pattern)

**Files:**
- Modify: `src/app/schulte/types.ts`
- Modify: `src/app/schulte/hooks/useSchulteGame.ts`
- Create: `src/lib/leaderboards/submit.ts` *(extend existing)*

- [ ] **Step 1: Add `submitMatchBulk` client helper**

Open `src/lib/leaderboards/submit.ts` and append:

```ts
export interface SubmitMatchBulkInput {
  matchId: string;
  game: GameId;
  /** Position-sorted user ids: positions[0] = 1st place, ... */
  positions: string[];
  /** Optional: drop pairs where both user ids are equal (ties) — caller can skip if not applicable. */
  ties?: { aId: string; bId: string }[];
  roomCode?: string;
}

import { positionsToPairs, type Pair } from "@/lib/leaderboards/pairwise";

export async function submitMatchBulk(input: SubmitMatchBulkInput): Promise<void> {
  const pairs: Pair[] = positionsToPairs(input.positions);
  // Mark explicit ties (poker split-pots etc.).
  if (input.ties?.length) {
    const tieKey = (a: string, b: string) => `${a}|${b}`;
    const tieSet = new Set<string>();
    for (const t of input.ties) {
      const [x, y] = [t.aId, t.bId].sort();
      tieSet.add(tieKey(x, y));
    }
    for (const p of pairs) {
      const [x, y] = [p.winnerId, p.loserId].sort();
      if (tieSet.has(tieKey(x, y))) p.wasTie = true;
    }
  }
  await withTimeout(
    fetch("/api/matches/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: input.matchId,
        game: input.game,
        results: pairs,
        roomCode: input.roomCode,
      }),
      keepalive: true,
    }),
  );
}
```

- [ ] **Step 2: Extend Schulte packet union**

In `src/app/schulte/types.ts` find `SchultePacket` and add:

```ts
  | { type: "members_sync"; members: { userId: string; peerId: string; displayUsername: string | null }[]; hostUserId: string }
  | { type: "progress_relay"; userId: string; target: number; timestamp: number }
  | { type: "race_results"; positions: { userId: string; timeMs: number }[]; matchId: string }
```

- [ ] **Step 3: Refactor `useSchulteGame.ts` to use `useStarPeerConnection`**

Replace the existing `usePeerConnection` block with `useStarPeerConnection`. Wire:

- `role` and `hostPeerId` from URL `?room=` (use `useRoom` orchestrator).
- On `progress_relay` from a guest: if I'm host, `broadcast` it to all guests except sender (use `sendTo` per-peer, skipping `fromPeerId`).
- On race-completion locally: host computes `positions`, broadcasts `race_results`, then calls `submitMatchBulk`. Guests, on receiving `race_results`, also call `submitMatchBulk` (cooperative agreement).
- N-1 opponent progress bars — replace existing single-opponent bar with a `.map()` over `members` (excluding self).

> The full hook diff is sizeable; the engineer should apply this section by section, running `npm run typecheck` after each section. The exact line numbers depend on current state — search for `usePeerConnection` and `setStatus("complete")` for entry points.

- [ ] **Step 4: Manual smoke test (local two browser tabs)**

```bash
npm run dev
```

In two browser tabs:
1. Tab A: open `/rooms/schulte`, click "Create Room" → private, capacity 2 → redirected to `/play/schulte?room=<code>`.
2. Tab B: open `/rooms/schulte`, paste code → redirected to `/play/schulte?room=<code>`.
3. Both: see each other's avatars in `RoomMembersBar`. Host clicks "Start". Both play. First-finisher's `race_results` appears in both UIs.

- [ ] **Step 5: Commit**

```bash
git add src/app/schulte src/lib/leaderboards/submit.ts
git commit -m "feat(rooms): N-player Schulte (members_sync, progress_relay, race_results, submitMatchBulk)"
```

### Task 20: Reaction N-player

**Files:** `src/app/reaction/types.ts` + `src/app/reaction/hooks/useReactionGame.ts`

- [ ] **Step 1: Mirror Schulte pattern**

Apply the same packet additions and hook refactor as Task 19. The race-end metric is `avg` reaction time (existing variable). Position sort: ascending `avg` (lower = better).

- [ ] **Step 2: Smoke test + commit**

```bash
git add src/app/reaction
git commit -m "feat(rooms): N-player Reaction"
```

### Task 21: Math Sprint N-player

**Files:** `src/app/math/types.ts` + `src/app/math/hooks/useMathGame.ts`

- [ ] **Step 1: Mirror Schulte pattern**

Race-end metric is total elapsed time across the question set. Position sort: ascending `totalTime`.

- [ ] **Step 2: Commit**

```bash
git add src/app/math
git commit -m "feat(rooms): N-player Math Sprint"
```

### Task 22: Flash Count N-player

**Files:** `src/app/flash-count/types.ts` + `src/app/flash-count/hooks/useFlashGame.ts`

- [ ] **Step 1: Mirror Schulte pattern**

Race-end metric is total elapsed time. Position sort: ascending.

- [ ] **Step 2: Commit**

```bash
git add src/app/flash-count
git commit -m "feat(rooms): N-player Flash Count"
```

### Task 23: Trail Making N-player

**Files:** `src/app/trail/types.ts` + `src/app/trail/hooks/useTrailGame.ts`

- [ ] **Step 1: Mirror Schulte pattern**

Race-end metric is `elapsed` (with penalty). Position sort: ascending.

- [ ] **Step 2: Commit**

```bash
git add src/app/trail
git commit -m "feat(rooms): N-player Trail Making"
```

### Task 24: Pattern N-player

**Files:** `src/app/pattern/types.ts` + `src/app/pattern/hooks/usePatternGame.ts`

- [ ] **Step 1: Mirror Schulte pattern**

Pattern's race-end fires when one player runs out of pattern (rare) or all wrong-out. Position sort: descending `bestRound`.

- [ ] **Step 2: Commit**

```bash
git add src/app/pattern
git commit -m "feat(rooms): N-player Pattern"
```

### Task 25: Sudoku P2P N-player

**Files:** `src/app/sudoku/types.ts` + `src/app/sudoku/hooks/useSudokuGame.ts`

- [ ] **Step 1: Mirror Schulte pattern**

Race-end metric is `elapsed` per player. Position sort: ascending. Note: sudoku already has 2-player race code; this generalises to N.

- [ ] **Step 2: Commit**

```bash
git add src/app/sudoku
git commit -m "feat(rooms): N-player Sudoku P2P race"
```

### Task 26: Maze P2P N-player

**Files:** `src/app/maze/types.ts` + `src/app/maze/hooks/useMazeGame.ts`

- [ ] **Step 1: Mirror Schulte pattern**

Race-end metric is `finalElapsed`. Position sort: ascending.

- [ ] **Step 2: Commit**

```bash
git add src/app/maze
git commit -m "feat(rooms): N-player Maze P2P race"
```

---

## Phase 8 — Halli Galli N-player rewrite

### Task 27: Generalise game logic for N decks + N piles

**Files:**
- Modify: `src/app/halli-galli/gameLogic.ts`
- Modify: `src/app/halli-galli/types.ts`

- [ ] **Step 1: Update types**

In `types.ts`, change `players: [DuelPlayerState, DuelPlayerState]` → `players: HalliPlayerState[]` and add `finishOrder: string[]` (last bust-out first) to `FullHalliState`. Add a new `HalliPlayerState`:

```ts
export interface HalliPlayerState {
  userId: string;
  deck: HalliCard[];
  discard: HalliCard[];
  busted: boolean;
}
```

- [ ] **Step 2: Update `applyBell`**

Bell is valid when **combined** fruit count of any one type across all visible top-of-discard-piles equals 5. Refactor the existing `applyBell` to iterate over `state.players.map(p => p.discard.at(-1))` instead of just two piles.

- [ ] **Step 3: Wrong-bell penalty**

When a wrong bell is rung by player X, give one card from each other non-busted player's deck to X. (Boxed-game rule.)

- [ ] **Step 4: Update `nextFlipper`**

Replace the binary toggle with `(currentIndex + 1) % nonBustedPlayerCount`, skipping busted players.

- [ ] **Step 5: Win check**

After each flip, mark any player whose deck+discard length is 0 as `busted: true`, append to `finishOrder`. When only 1 non-busted remains, set `phase: "game_over"`, append the winner to `finishOrder` last (so reverse iteration gives best-to-worst). Wait — flip the convention: store `finishOrder` so `[0]` = 1st place. Append winner first (after game-over), then reverse-append the bust order.

Choose: **`finishOrder[0] = 1st place`** (last standing). Bust-out order is reversed and pushed in last-to-first order (i.e., when player Y busts second-to-last, they're 2nd place, so prepend to a temp array). Use this in implementation:

```ts
// pseudo-code
const eliminated: string[] = [];  // append-on-bust, oldest first = last place first
// On game_over:
state.finishOrder = [winnerUserId, ...eliminated.reverse()];
```

- [ ] **Step 6: Typecheck + commit**

```bash
npm run typecheck
git add src/app/halli-galli/gameLogic.ts src/app/halli-galli/types.ts
git commit -m "feat(rooms): halli-galli N-player game logic (decks, bell, bust-out)"
```

### Task 28: Halli Galli hook + UI integration

**Files:**
- Modify: `src/app/halli-galli/hooks/useHalliGalliGame.ts`
- Modify: `src/app/halli-galli/types.ts` *(packet union)*
- Modify: `src/app/halli-galli/components/*` *(N-pile circle layout)*

- [ ] **Step 1: Packet additions**

Add to `HalliPacket` union:

```ts
  | { type: "members_sync"; members: { userId: string; peerId: string; displayUsername: string | null }[]; hostUserId: string }
  | { type: "game_results"; finishOrder: string[]; matchId: string }
```

(Existing `bell`, `sync`, `rematch`, `settings`, `ping`, `pong` stay.)

- [ ] **Step 2: Replace `usePeerConnection` with `useStarPeerConnection` + `useRoom`**

Same shape as Task 19's Schulte refactor. Host owns authoritative state; sync packets fan out to all guests. Guest bell-claims arrive at host; host resolves contests; host broadcasts `sync` to everyone.

- [ ] **Step 3: UI layout**

Replace the 2-pile (mine vs opp) layout in components with a circle layout. Use `transform: rotate(...)` to position N piles around a centre bell. Bell button stays large at centre.

- [ ] **Step 4: Game-over → submitMatchBulk**

When `phase === "game_over"`, host calls `submitMatchBulk({ matchId: roomCode + ":game-" + n, game: "halli-galli", positions: state.finishOrder, roomCode })`. Guests do the same on receiving `game_results`.

- [ ] **Step 5: Commit**

```bash
git add src/app/halli-galli
git commit -m "feat(rooms): halli-galli N-player UI + submitMatchBulk wiring"
```

---

## Phase 9 — Poker N-player rewrite

> The biggest single piece. Implement in 4 sub-tasks.

### Task 29: Poker game-state shape for N players

**Files:**
- Modify: `src/app/poker/types.ts`

- [ ] **Step 1: Update interfaces**

Replace fixed-size tuples with arrays:

```ts
// types.ts
export interface FullGameState {
  phase: Phase;
  players: PlayerState[];           // was [PlayerState, PlayerState]
  community: Card[];
  pots: Pot[];                       // NEW: main pot + side pots
  dealerIndex: number;               // was 0 | 1
  activeIndex: number;               // was 0 | 1
  handNumber: number;
  deck: Card[];
  smallBlind: number;
  bigBlind: number;
  lastAction?: { playerIndex: number; action: ActionType; amount: number };
  result?: HandResult;
  hasActedThisRound: boolean[];      // length === players.length
  /** Pre-hand chip stacks for void-hand recovery on host promote. */
  lastSettledChips: number[];
}

export interface Pot {
  amount: number;
  /** Indices of players eligible for this pot (those who contributed). */
  eligible: number[];
}

export interface PlayerState {
  userId: string;
  chips: number;
  bet: number;
  cards: Card[];
  folded: boolean;
  allIn: boolean;
  eliminated: boolean;
}

export interface HandResult {
  winnerIndices: number[];          // multi-winner on split pot
  winningHandDesc: string;
  hands: string[];                   // per-player hand desc
  bestCards: Card[][];               // per-player best 5
  /** Map pot index → winner indices for that pot. */
  potWinners: { potIndex: number; winnerIndices: number[] }[];
}
```

`PlayerView` similarly grows to support N opponents (`opponents: OpponentView[]` instead of singular fields).

- [ ] **Step 2: Typecheck**

Run `npm run typecheck`. Many existing call sites will break; fix as they appear.

- [ ] **Step 3: Commit**

```bash
git add src/app/poker/types.ts
git commit -m "refactor(poker): N-player game-state types (PlayerState[], Pot[], HandResult)"
```

### Task 30: Poker game logic — blinds, betting, side pots

**Files:**
- Modify: `src/app/poker/utils.ts`

- [ ] **Step 1: Generalise blinds rotation**

```ts
// In createNewHand:
const N = players.length;
const dealerIndex = (prevDealer + 1) % N;
const sbIndex = (dealerIndex + 1) % N;
const bbIndex = (dealerIndex + 2) % N;
// First-to-act preflop is (bbIndex + 1) % N; postflop is (dealerIndex + 1) % N (next non-folded).
```

Skip indices where `players[i].eliminated === true` when advancing.

- [ ] **Step 2: Generalise `processAction` for N**

The action-resolution logic stays similar but iterates a list. Action ends when all non-folded, non-all-in players have either matched the highest bet or are all-in.

- [ ] **Step 3: Side pots**

When a player goes all-in for `X` while the current bet is `Y > X`, build a side pot:
- Main pot eligible = all currently-in players for the all-in amount.
- Side pot eligible = all-in player excluded; others contribute the difference.

Algorithm (run after each round of betting):

```ts
function rebuildPots(players: PlayerState[]): Pot[] {
  const contributions = players.map((p) => p.bet);
  const pots: Pot[] = [];
  while (contributions.some((c) => c > 0)) {
    const min = Math.min(...contributions.filter((c) => c > 0));
    const eligible: number[] = [];
    let amount = 0;
    for (let i = 0; i < players.length; i++) {
      if (contributions[i] >= min) {
        amount += min;
        contributions[i] -= min;
        if (!players[i].folded) eligible.push(i);
      }
    }
    pots.push({ amount, eligible });
  }
  return pots;
}
```

- [ ] **Step 4: Multi-way showdown**

For each pot in `pots`, evaluate eligible players' best 5-card hands. The best wins; on ties, split equally (round residue chips to the player closest to the dealer).

```ts
function settleShowdown(state: FullGameState): HandResult {
  const eligibleHands = state.players.map((p, i) =>
    p.folded || p.eliminated ? null : { i, hand: bestFive(p.cards.concat(state.community)) },
  );
  const potWinners: HandResult["potWinners"] = [];
  for (let pi = 0; pi < state.pots.length; pi++) {
    const pot = state.pots[pi];
    const candidates = pot.eligible
      .map((i) => eligibleHands[i])
      .filter((h): h is NonNullable<typeof h> => h !== null);
    if (candidates.length === 0) continue;
    const bestRank = Math.max(...candidates.map((c) => c.hand.rank));
    const winners = candidates.filter((c) => c.hand.rank === bestRank).map((c) => c.i);
    potWinners.push({ potIndex: pi, winnerIndices: winners });
  }
  // Distribute chips:
  for (const { potIndex, winnerIndices } of potWinners) {
    const pot = state.pots[potIndex];
    const share = Math.floor(pot.amount / winnerIndices.length);
    const residue = pot.amount % winnerIndices.length;
    for (let k = 0; k < winnerIndices.length; k++) {
      state.players[winnerIndices[k]].chips += share + (k < residue ? 1 : 0);
    }
  }
  // ... fill remaining HandResult fields ...
  return /* HandResult */;
}
```

- [ ] **Step 5: Bust-out + game-over**

When `chips === 0 && !allIn` after a hand, mark `eliminated = true`. After settlement, if only one player has `chips > 0 && !eliminated`, `phase = "game_over"`.

- [ ] **Step 6: Typecheck + commit**

```bash
npm run typecheck
git add src/app/poker/utils.ts
git commit -m "feat(poker): N-player blinds rotation, betting, side pots, multi-way showdown"
```

### Task 31: Poker hook integration

**Files:**
- Modify: `src/app/poker/hooks/usePokerGame.ts`
- Modify: `src/app/poker/types.ts` *(packet union)*

- [ ] **Step 1: Packet additions**

```ts
  | { type: "members_sync"; members: { userId: string; peerId: string; displayUsername: string | null }[]; hostUserId: string }
  | { type: "hand_settled"; matchId: string; perHandPositions: string[]; ties?: { aId: string; bId: string }[] }
  | { type: "game_over"; finalRanking: string[]; }
```

- [ ] **Step 2: Replace `usePeerConnection` with `useStarPeerConnection` + `useRoom`**

Host owns full state; broadcasts `sync` to all guests after each action. Guests' actions go to host as `action` packets; host runs `processAction`.

- [ ] **Step 3: Per-hand pairwise reporting**

After each hand settles, host computes per-hand positions: winner of each pot is "above" the losers of that pot. For multi-pot hands, build a position list by ordering: pot 0 winners > pot 0 losers > pot 1 losers (already in pot 0) > etc. (i.e., main-pot winner is at the top).

For non-fold losers in a hand, their relative order is by hand rank descending. Folders go below all non-folders.

The host then calls `submitMatchBulk` with that per-hand position list.

- [ ] **Step 4: Commit**

```bash
git add src/app/poker
git commit -m "feat(poker): N-player hook + per-hand pairwise reporting"
```

### Task 32: Poker UI — oval table with N seats

**Files:**
- Modify: `src/app/poker/components/*`

- [ ] **Step 1: Replace 2-seat layout with seat ring**

Replace the existing two-player layout (left vs right) with a 6-seat oval. Seat positions:

```ts
const SEAT_POSITIONS = [
  { x: 50, y: 95 },  // bottom centre — viewer
  { x: 90, y: 75 },  // bottom right
  { x: 95, y: 35 },  // top right
  { x: 50, y: 5 },   // top centre
  { x: 5, y: 35 },   // top left
  { x: 10, y: 75 },  // bottom left
]; // percentages of the table div
```

Render only `players.length` seats. Folded seats greyed out. Dealer / SB / BB chips overlaid via small absolute-positioned divs.

- [ ] **Step 2: Commit**

```bash
git add src/app/poker/components
git commit -m "feat(poker): oval-table seat ring UI for up to 6 players"
```

---

## Phase 10 — Auto-promote algorithm

### Task 33: Auto-promote in `useStarPeerConnection` consumers

**Files:**
- Modify: All `use<Game>Game.ts` hooks that need auto-promote (8 race + halli-galli; poker handles void-hand)

> The hook structure to add to each `use<Game>Game.ts`:

- [ ] **Step 1: Detect host loss + run election**

```ts
import { electHost, type Member } from "@/lib/rooms/election";

// Inside the hook, near the useStarPeerConnection block:
const onHostLost = useCallback(() => {
  // 2-second grace.
  setTimeout(() => {
    if (room.room === null || room.role !== "guest") return;
    // Build member list with online status from current channels (this is heuristic;
    // the safest signal is "anyone we received a packet from in last 5s").
    const members: Member[] = (room.room.members ?? []).map((m) => ({
      userId: m.userId,
      peerId: m.peerId,
      online: m.userId === myUserId ? true : recentlyHeardFromRef.current.has(m.peerId),
    }));
    const elected = electHost(members);
    if (elected?.userId === myUserId) {
      // I'm the new host. Get a fresh peerId, CAS-update.
      const newPeerId = `wq-${room.room.game}-${room.room.code}-promoted-${room.room.promotionGen + 1}`;
      // (peerId reservation happens by re-mounting useStarPeerConnection with myPeerId override.)
      acceptPromotionRef.current = newPeerId;
      forceRemountRef.current(); // local helper that flips an `isHost` state
    } else {
      // Wait for new hostPeerId in /api/rooms/[code], then re-dial.
      pollForNewHostRef.current = setInterval(async () => {
        await room.refresh();
        if (room.room && room.room.hostPeerId !== oldHostPeerIdRef.current) {
          clearInterval(pollForNewHostRef.current!);
          // Force remount of the star-peer hook with the new hostPeerId.
          forceRemountRef.current();
        }
      }, 1000);
    }
  }, 2000);
}, [room, myUserId]);
```

- [ ] **Step 2: For poker — void hand path**

In `usePokerGame.ts`, instead of running the election right away on `onHostLost`, first detect mid-hand state. If `phase` is between preflop and showdown, refund `lastSettledChips` to all players; reset to pre-hand state. Then run the same election algorithm above.

- [ ] **Step 3: Commit**

```bash
git add src/app/schulte src/app/reaction src/app/math src/app/flash-count src/app/trail src/app/pattern src/app/sudoku src/app/maze src/app/halli-galli src/app/poker
git commit -m "feat(rooms): host auto-promote with deterministic election + CAS"
```

---

## Phase 11 — E2E + roll-out

### Task 34: Playwright E2E for rooms + race game

**Files:**
- Create: `tests/e2e/rooms.spec.ts`

- [ ] **Step 1: Implement**

```ts
// tests/e2e/rooms.spec.ts
import { test, expect } from "@playwright/test";

test("/rooms/<game> page renders for each game", async ({ page }) => {
  for (const game of ["schulte", "poker", "sudoku"]) {
    await page.goto(`/rooms/${game}`);
    await expect(page.locator(`h1:has-text("Rooms")`)).toBeVisible();
    await expect(page.locator('button:has-text("CREATE ROOM")')).toBeVisible();
  }
});

test("invalid room code shows 404 message", async ({ page }) => {
  await page.goto("/rooms/schulte");
  await page.locator('input[placeholder*="ENTER"]').fill("ZZZZZZ");
  await page.locator('button:has-text("JOIN")').click();
  // Error surface (we set room.error to the response body)
  await expect(page.locator("text=Room not found")).toBeVisible();
});

test("/rooms/<unknown-game> redirects to /leaderboards", async ({ page }) => {
  await page.goto("/rooms/nonexistent");
  await expect(page).toHaveURL(/\/leaderboards/);
});
```

- [ ] **Step 2: Run E2E**

```bash
npm run test:e2e -- tests/e2e/rooms.spec.ts
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/rooms.spec.ts
git commit -m "test(e2e): rooms lobby render + invalid-code + invalid-game"
```

### Task 35: Push, watch CI, smoke test prod

- [ ] **Step 1: Push**

```bash
git push origin main
```

- [ ] **Step 2: Watch Cloudflare Workers Builds**

Cloudflare Dashboard → `wenqian-dev` Worker → Deployments. Wait for the new build to finish (1-2 min).

- [ ] **Step 3: Smoke-test prod**

```bash
URL=https://wenqian.dev
for path in /rooms/schulte /rooms/poker /api/rooms?game=schulte /api/health; do
  /usr/bin/curl -sS -o /dev/null -w "${path} → %{http_code}\n" "${URL}${path}"
done
```

Expected: all 200.

- [ ] **Step 4: Manual end-to-end**

Two browser windows (one in private/incognito), both signed in:
1. Open https://wenqian.dev/rooms/schulte in window A → Create Room (private, capacity 4).
2. Copy the code, paste into window B's Join input.
3. Both should see each other in `RoomMembersBar`.
4. Host clicks Start → both play → first finisher's `race_results` shows.
5. After completion, both `/leaderboards/schulte` rows update with the result.

For poker (after Phase 9):
1. Same setup with capacity 6 (invite 5 friends).
2. Play 3 hands. After each hand, inspect `/leaderboards/poker` ELO board.
3. Host closes tab → 3 minutes later guests see "host gone, electing…" → first guest auto-promotes → game continues.

---

## Self-review

### Spec coverage check

| Spec section | Implemented in |
|---|---|
| §1 Goals + non-goals | All phases |
| §2 Architecture (star, KV soft state) | Tasks 4-10 |
| §3 Components (server) | Tasks 4-10 |
| §3 Components (client) | Tasks 11-16 |
| §4 Data flow A (private create+join) | Tasks 5, 6, 12 |
| §4 Data flow B (public lobby) | Tasks 5, 16 |
| §4 Data flow C (reporting) | Tasks 9, 10 |
| §5 Trust model + abuse | Tasks 5, 9 (rate limits + ban) |
| §6 Race games | Tasks 19-26 |
| §6 Halli Galli | Tasks 27-28 |
| §6 Poker | Tasks 29-32 |
| §7 ELO bulk + auto-promote | Tasks 9, 33 |
| §8 Visual / observability / cost | Tasks 13-16, 5-9 (analytics events) |
| §8 Test plan | Tasks 1-3, 34 |
| §9 Pages summary | Tasks 17-18 |

No gaps.

### Placeholder scan

- No "TBD" / "implement later".
- Each modify-existing-file task points to specific files. Race-game tasks (20-26) reuse the canonical pattern from Task 19; the engineer reads Task 19 for the full code blocks then applies the same shape with game-specific variable names. This is intentional repetition-avoidance, not a placeholder.
- Poker task 30 step 4 (`settleShowdown`) is presented as pseudo-code with `... fill remaining HandResult fields ...` — this is a deliberate hand-off to the engineer to fill in `winningHandDesc`, `hands`, `bestCards` from the existing hand evaluator's output shape (the existing 2-player code already has this; just generalise the loop).

### Type consistency

- `Slot`, `RoomState`, `Member` types are defined once in `src/lib/rooms/store.ts` and `src/lib/rooms/election.ts`; consumers import them.
- `Pair` from `pairwise.ts` is consumed by `submitMatchBulk` and `/api/matches/bulk`.
- `useRoom` returns the same `RoomMember` shape used by `RoomMembersBar`.
- `submitMatchBulk` takes `positions: string[]` (user-id list); all 8 race games + halli-galli + poker call this with the same shape.
- `useStarPeerConnection` is generic over `TPacket`; each game passes its own `XxxPacket` union.
- `members_sync` packet shape `{ userId, peerId, displayUsername }` is identical across all 12 games.

No inconsistencies.

---

## What ships next

After D' is live: **Feature A (cross-device sync)** and **Feature C (admin dashboard)** are next. Feature C will promote the `banned:<userId>` KV flag from §5 to a real moderation UI; Feature A will leverage the same `useRoom`-style room/session anchor to sync per-user game state across devices.
