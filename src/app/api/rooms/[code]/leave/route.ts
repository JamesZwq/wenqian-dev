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
    reason:
      body.reason === "voluntary" || body.reason === "disconnect" || body.reason === "host_gone"
        ? body.reason
        : "voluntary",
  });
  return new Response(null, { status: 204 });
}
