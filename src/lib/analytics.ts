import { env } from "@/lib/env";

// Workers Analytics Engine: 25 tags + 20 doubles + 1 blob (text) per data point.
// Free tier: 10M events/month. Queryable via SQL in Cloudflare Dashboard.
// https://developers.cloudflare.com/analytics/analytics-engine/
//
// Each event below pre-declares its shape. New event names go in this union.
// Each feature spec adds its own events here.

export type AnalyticsEvent =
  | { name: "auth.signup"; provider: "email" | "google" | "github" }
  | { name: "auth.login"; provider: "email" | "google" | "github" }
  | { name: "auth.logout" }
  | { name: "auth.email_verified" }
  | { name: "game.start"; game: string }
  | { name: "game.end"; game: string; durationMs: number };

/**
 * Fire-and-forget event tracker. Never throws — analytics failures must not
 * affect the request that triggered them.
 *
 * The `name` is the only indexed dimension; other string fields go to
 * `blobs` (text columns) and number fields to `doubles`. Use the
 * Cloudflare Dashboard SQL console (FROM wenqian_dev_events) to query.
 */
export function track(event: AnalyticsEvent): void {
  try {
    const blobs: string[] = [event.name];
    const doubles: number[] = [];
    for (const [key, value] of Object.entries(event)) {
      if (key === "name") continue;
      if (typeof value === "string") blobs.push(value);
      else if (typeof value === "number") doubles.push(value);
    }
    env().ANALYTICS.writeDataPoint({
      indexes: [event.name],
      blobs,
      doubles,
    });
  } catch {
    // Swallow: analytics is non-critical infrastructure.
  }
}
