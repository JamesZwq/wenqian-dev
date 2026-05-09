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
