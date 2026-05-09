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
