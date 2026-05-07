"use client";
import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { AuthCard } from "@/components/auth/AuthCard";
import { EmailField } from "@/components/auth/EmailField";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    setSubmitting(false);
    if (res.error) {
      setError(res.error.message ?? "Failed to send reset email");
      return;
    }
    setDone(true);
  }

  return (
    <AuthCard title="Forgot password?" subtitle="We'll email a reset link to you.">
      {done ? (
        <p className="font-mono text-sm" style={{ color: "var(--pixel-text)" }}>
          ✓ Check your inbox (including spam) for a reset link from{" "}
          <code>noreply@wenqian.dev</code>. The link expires in 1 hour.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <EmailField value={email} onChange={setEmail} autoFocus />
          {error && (
            <p className="font-mono text-xs" style={{ color: "#ef4444" }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl border-2 px-4 py-3 font-sans font-semibold text-sm disabled:opacity-60"
            style={{
              background: "var(--pixel-accent)",
              borderColor: "var(--pixel-accent)",
              color: "var(--pixel-bg)",
            }}
          >
            {submitting ? "SENDING…" : "SEND RESET LINK"}
          </button>
          <p
            className="text-center font-mono text-xs"
            style={{ color: "var(--pixel-muted)" }}
          >
            <Link href="/sign-in" style={{ color: "var(--pixel-accent)" }}>
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthCard>
  );
}
