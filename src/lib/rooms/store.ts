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

const ROOM_TTL_SEC = 30 * 60;
const STALE_HEARTBEAT_MS = 90_000;

export const PUBLIC_ROOMS_PER_GAME_CAP = 20;

function roomKey(code: string): string { return `room:${code}`; }
function lobbyKey(game: string): string { return `lobby:${game}`; }
function banKey(userId: string): string { return `banned:${userId}`; }

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

async function listLobbyCodes(kv: KVNamespace, game: string): Promise<string[]> {
  const raw = await kv.get(lobbyKey(game));
  return raw ? (JSON.parse(raw) as string[]) : [];
}

export async function publicRoomCountForGame(kv: KVNamespace, game: string): Promise<number> {
  return (await listLobbyCodes(kv, game)).length;
}

export async function createRoom(
  kv: KVNamespace,
  init: {
    code: string;
    game: string;
    visibility: "public" | "private";
    capacity: number;
    hostUserId: string;
    hostPeerId: string;
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
