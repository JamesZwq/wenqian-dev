// Server-side Sentry runtime is intentionally disabled — including it pushes
// the Worker bundle past Cloudflare's 3 MiB free-tier size cap. Client-side
// Sentry (src/instrumentation-client.ts) still runs in the browser and
// captures the errors users actually experience. Server errors are surfaced
// via console + `wrangler tail` + Cloudflare Dashboard logs.
//
// If/when we move to Workers Paid ($5/mo, 10 MiB cap), restore the imports
// of sentry.server.config / sentry.edge.config here and re-enable
// `Sentry.captureRequestError`.

import type * as Sentry from "@sentry/nextjs";

export async function register() {
  // No-op on the server.
}

// Required Next.js export — provide a stub matching Sentry's signature.
export const onRequestError: typeof Sentry.captureRequestError = () => {};
