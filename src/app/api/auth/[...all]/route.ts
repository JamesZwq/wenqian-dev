import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Defer toNextJsHandler(auth()) until request time. Calling auth() at module
// top level fails Next.js's build-time "collecting page data" step because
// getCloudflareContext() has no context at build time.

let _handler: ReturnType<typeof toNextJsHandler> | null = null;
function getHandler() {
  if (!_handler) _handler = toNextJsHandler(auth());
  return _handler;
}

export async function GET(req: Request) {
  return getHandler().GET(req);
}

export async function POST(req: Request) {
  return getHandler().POST(req);
}
