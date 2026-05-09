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
