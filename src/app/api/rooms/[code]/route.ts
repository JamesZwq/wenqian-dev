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
