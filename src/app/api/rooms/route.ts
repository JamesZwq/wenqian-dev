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
