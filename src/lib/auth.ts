import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Resend } from "resend";
import { getDb } from "@/db/client";
import { env } from "@/lib/env";

interface AuthEnv {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  RESEND_API_KEY: string;
  RESEND_FROM?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}

// Better-Auth instance is created lazily and memoised per Worker isolate.
// We can't create at module load because env() requires a request context.
// The wrapper is needed so ReturnType infers Auth<the-actual-options>; if we
// inline `betterAuth(...)` and try to cache as ReturnType<typeof betterAuth>,
// TS complains because betterAuth's default generic doesn't match ours.
let _instance: ReturnType<typeof createAuth> | null = null;

function createAuth() {
  const e = env() as unknown as AuthEnv;
  if (!e.BETTER_AUTH_SECRET) throw new Error("BETTER_AUTH_SECRET is not set");
  if (!e.BETTER_AUTH_URL) throw new Error("BETTER_AUTH_URL is not set");

  const resend = e.RESEND_API_KEY ? new Resend(e.RESEND_API_KEY) : null;
  const fromAddress = e.RESEND_FROM ?? "onboarding@resend.dev";

  // OAuth providers are only enabled when their credentials are present in
  // the env. This lets local dev work without configuring every provider, and
  // lets us roll out OAuth providers one at a time per environment.
  const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};
  if (e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET };
  }
  if (e.GITHUB_CLIENT_ID && e.GITHUB_CLIENT_SECRET) {
    socialProviders.github = { clientId: e.GITHUB_CLIENT_ID, clientSecret: e.GITHUB_CLIENT_SECRET };
  }

  return betterAuth({
    database: drizzleAdapter(getDb(), { provider: "sqlite" }),
    secret: e.BETTER_AUTH_SECRET,
    baseURL: e.BETTER_AUTH_URL,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        if (!resend) {
          console.warn("[auth] RESEND_API_KEY not set — skipping verification email send");
          return;
        }
        const result = await resend.emails.send({
          from: `wenqian.dev <${fromAddress}>`,
          to: user.email,
          subject: "Verify your email",
          html: `<p>Welcome! Click to verify your email:</p>
<p><a href="${url}">${url}</a></p>
<p>If you didn't sign up, ignore this message.</p>`,
        });
        // Resend SDK does NOT throw on API errors — it returns { data, error }.
        // Surface the failure so signups don't silently land without an email.
        if (result.error) {
          console.error("[auth] Resend send failed:", result.error);
          throw new Error(`Resend error: ${result.error.message ?? result.error.name ?? "unknown"}`);
        }
        console.info(`[auth] verification email sent to ${user.email}, id=${result.data?.id}`);
      },
    },
    socialProviders,
  });
}

export function auth() {
  if (!_instance) _instance = createAuth();
  return _instance;
}
