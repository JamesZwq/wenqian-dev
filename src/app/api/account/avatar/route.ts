import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { requireVerifiedSession } from "@/lib/require-verified";
import { rateLimit } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";
import { track } from "@/lib/analytics";

const ALLOWED_MIME = ["image/webp", "image/jpeg", "image/png"];
const MAX_BYTES = 100 * 1024;

function magicMatchesMime(buf: Uint8Array, mime: string): boolean {
  if (mime === "image/png") {
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  }
  if (mime === "image/jpeg") {
    return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (mime === "image/webp") {
    // RIFF....WEBP
    return (
      buf.byteLength >= 12 &&
      buf[0] === 0x52 &&
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x46 &&
      buf[8] === 0x57 &&
      buf[9] === 0x45 &&
      buf[10] === 0x42 &&
      buf[11] === 0x50
    );
  }
  return false;
}

function r2KeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/avatars\/[^?#]+/);
  return m ? m[0] : null;
}

export async function POST(req: Request) {
  const session = await getSession();
  const userOrResp = await requireVerifiedSession(session);
  if (userOrResp instanceof Response) return userOrResp;
  const user = userOrResp;

  const e = env();
  const limit = await rateLimit(e.CACHE, {
    key: `avatar:${user.id}`,
    limit: 20,
    windowSec: 86400,
  });
  if (!limit.ok) return new Response("Rate limit", { status: 429 });

  const cl = Number(req.headers.get("content-length") || "0");
  if (cl > MAX_BYTES * 2) return new Response("Payload too large", { status: 413 });

  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) return new Response("Missing file", { status: 400 });
  if (file.size > MAX_BYTES) return new Response("File too large", { status: 413 });
  if (!ALLOWED_MIME.includes(file.type)) return new Response("Bad MIME", { status: 415 });

  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf.byteLength < 12 || !magicMatchesMime(buf, file.type)) {
    return new Response("Magic bytes mismatch", { status: 415 });
  }

  // Look up existing avatar so we can clean it up after we replace.
  const sessNow = await auth().api.getSession({ headers: req.headers });
  const prevImage = sessNow?.user?.image ?? null;

  const ext = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "webp";
  const key = `avatars/${user.id}/${crypto.randomUUID()}.${ext}`;
  await e.BUCKET.put(key, buf, {
    httpMetadata: { contentType: file.type },
  });

  if (prevImage && prevImage !== `/static-avatar/${key}`) {
    const oldKey = r2KeyFromUrl(prevImage);
    if (oldKey) await e.BUCKET.delete(oldKey).catch(() => {});
  }

  const publicUrl = `/static-avatar/${key}`;
  await auth().api.updateUser({
    headers: req.headers,
    body: { image: publicUrl },
  });

  track({ name: "user.avatar_set" });
  return Response.json({ url: publicUrl });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  const userOrResp = await requireVerifiedSession(session);
  if (userOrResp instanceof Response) return userOrResp;

  const sessNow = await auth().api.getSession({ headers: req.headers });
  const prevImage = sessNow?.user?.image ?? null;
  const oldKey = r2KeyFromUrl(prevImage);
  if (oldKey) await env().BUCKET.delete(oldKey).catch(() => {});

  await auth().api.updateUser({ headers: req.headers, body: { image: null } });
  track({ name: "user.avatar_removed" });
  return new Response(null, { status: 204 });
}
