// Sentry initialization for the browser. Auto-loaded by Next.js for every
// page navigation.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://2151224b4b2a8dcd012f6f091c102512@o4511347139084288.ingest.us.sentry.io/4511347144130560",

  // 10% trace sampling — same rationale as the server config.
  tracesSampleRate: 0.1,

  // No PII by default until we publish a privacy policy.
  sendDefaultPii: false,

  // Replay disabled. Free tier has a 50 replays/month quota and replay
  // bundles are sizeable. Re-enable selectively if a specific bug needs it.
  // integrations: [Sentry.replayIntegration()],
  // replaysSessionSampleRate: 0,
  // replaysOnErrorSampleRate: 0,

  // Keep Sentry quiet in local dev.
  enabled: process.env.NODE_ENV === "production",
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
