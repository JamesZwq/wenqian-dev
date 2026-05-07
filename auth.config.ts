// Stub auth config used ONLY by `better-auth generate` to compute the Drizzle
// schema. Never imported by runtime code — that uses src/lib/auth.ts.
//
// The CLI only reads provider/plugin config to figure out which tables and
// columns to emit. None of these stub values are ever used.

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export const auth = betterAuth({
  database: drizzleAdapter({}, { provider: "sqlite" }),
  secret: "stub-cli-only-do-not-use",
  baseURL: "http://localhost",
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  socialProviders: {
    google: { clientId: "stub", clientSecret: "stub" },
    github: { clientId: "stub", clientSecret: "stub" },
  },
});
