import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// IMPORTANT: defineCloudflareConfig() ignores buildCommand (only accepts the
// six cloudflare-specific override fields). buildCommand is a TOP-LEVEL
// OpenNextConfig option that the AWS-side build runner reads via
// `config.buildCommand`. We must spread the cloudflare config and add
// buildCommand at the top level for it to take effect.
//
// Why this matters: package.json `build` script is `opennextjs-cloudflare
// build`. The default buildCommand is `npm run build`, which would recurse
// back into opennextjs-cloudflare → infinite spawn → memory blowup.
// Forcing `next build` here breaks the cycle: opennextjs spawns next build
// directly, no npm script lookup.

export default {
  ...defineCloudflareConfig({}),
  buildCommand: "next build",
};
