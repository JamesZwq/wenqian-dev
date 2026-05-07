import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";

// Augment opennextjs's global CloudflareEnv with our project-specific bindings.
// Each phase adds its own bindings here. We `import type` instead of letting
// workers-types pollute the global lib (which conflicts with stricter
// Response.json() etc. from older user code).
declare global {
  interface CloudflareEnv {
    DB: D1Database;
    // CACHE: KVNamespace      (added in Phase 4)
    // BUCKET: R2Bucket         (added in Phase 4)
    // ANALYTICS: AnalyticsEngineDataset  (added in Phase 5)
  }
}

export function env(): CloudflareEnv {
  return getCloudflareContext().env;
}
