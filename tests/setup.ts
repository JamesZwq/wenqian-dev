// Global test setup. Runs once before each test worker starts.

import { env } from "cloudflare:test";

// Force a deterministic ADMIN_EMAIL in tests so admin-related assertions
// don't depend on .dev.vars values (which use the real owner's email).
(env as unknown as { ADMIN_EMAIL: string }).ADMIN_EMAIL = "admin@test.local";
