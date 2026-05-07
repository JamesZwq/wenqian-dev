import { env } from "@/lib/env";

/**
 * Public R2-backed avatar serving endpoint. Avatar uploads are written to
 * R2 at avatars/<userId>/<uuid>.{ext}; user.image stores the path
 * /static-avatar/avatars/<userId>/<uuid>.{ext} which routes here.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params;
  const path = key.join("/");
  // Hard-cap to avatars/ prefix so this route can't be used to fetch
  // arbitrary R2 objects (e.g., backup dumps).
  if (!path.startsWith("avatars/")) return new Response("Not found", { status: 404 });

  const obj = await env().BUCKET.get(path);
  if (!obj) return new Response("Not found", { status: 404 });

  // R2's ReadableStream type from @cloudflare/workers-types differs from the
  // global lib's, so cast at the boundary.
  return new Response(obj.body as unknown as BodyInit, {
    headers: {
      "content-type": obj.httpMetadata?.contentType ?? "application/octet-stream",
      // 5-min browser cache; 1-day shared (Cloudflare CDN). Avatars rarely
      // change, but when they do the URL changes (new uuid), so 1-day s-maxage
      // is safe.
      "cache-control": "public, max-age=300, s-maxage=86400",
    },
  });
}
