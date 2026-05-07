"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { AuthCard } from "@/components/auth/AuthCard";
import { PasswordField } from "@/components/auth/PasswordField";

export default function SignInPage() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/profile";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    // Better-Auth's username plugin lets sign-in accept email or username via
    // distinct endpoints. Pick by presence of "@".
    const isEmail = identifier.includes("@");
    const res = isEmail
      ? await authClient.signIn.email({
          email: identifier,
          password,
          rememberMe: remember,
        })
      : await authClient.signIn.username({
          username: identifier.toLowerCase(),
          password,
          rememberMe: remember,
        } as Parameters<typeof authClient.signIn.username>[0]);

    setSubmitting(false);
    if (res.error) {
      setError(res.error.message ?? "Sign-in failed");
      return;
    }
    router.push(next);
  }

  return (
    <AuthCard title="Welcome back" subtitle="Sign in with your email or username.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span
            className="font-mono text-[10px] tracking-widest"
            style={{ color: "var(--pixel-muted)" }}
          >
            EMAIL OR USERNAME
          </span>
          <input
            type="text"
            required
            autoFocus
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="mt-1 w-full rounded-xl border-2 px-3 py-2 font-mono text-sm outline-none transition-colors focus:border-[var(--pixel-accent)]"
            style={{
              background: "var(--pixel-bg-alt)",
              borderColor: "var(--pixel-border)",
              color: "var(--pixel-text)",
            }}
          />
        </label>

        <PasswordField value={password} onChange={setPassword} />

        <label
          className="flex items-center gap-2 font-mono text-xs"
          style={{ color: "var(--pixel-muted)" }}
        >
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Remember me (30 days)
        </label>

        {error && (
          <p className="font-mono text-xs" style={{ color: "#ef4444" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl border-2 px-4 py-3 font-sans font-semibold text-sm transition-transform hover:scale-[1.02] disabled:opacity-60"
          style={{
            background: "var(--pixel-accent)",
            borderColor: "var(--pixel-accent)",
            color: "var(--pixel-bg)",
          }}
        >
          {submitting ? "SIGNING IN…" : "SIGN IN"}
        </button>

        <div
          className="flex items-center justify-between text-xs font-mono"
          style={{ color: "var(--pixel-muted)" }}
        >
          <Link href="/forgot-password" style={{ color: "var(--pixel-accent)" }}>
            Forgot password?
          </Link>
          <Link href="/sign-up" style={{ color: "var(--pixel-accent)" }}>
            Create account
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}
