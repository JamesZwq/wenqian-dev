"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { AuthCard } from "@/components/auth/AuthCard";
import { PasswordField } from "@/components/auth/PasswordField";

export default function ResetPasswordPage() {
  const router = useRouter();
  // Read ?token=… on mount (avoids Suspense/SSR-bailout issue with useSearchParams).
  const [token, setToken] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      setToken(sp.get("token") || "");
    }
  }, []);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Reset link is invalid or expired. Request a new one.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }

    setSubmitting(true);
    const res = await authClient.resetPassword({ token, newPassword: password });
    setSubmitting(false);
    if (res.error) {
      setError(res.error.message ?? "Reset failed");
      return;
    }
    router.push("/sign-in");
  }

  return (
    <AuthCard title="Reset password" subtitle="Pick a new password.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordField
          value={password}
          onChange={setPassword}
          label="New password"
          autoComplete="new-password"
        />
        <PasswordField
          value={confirm}
          onChange={setConfirm}
          label="Confirm new password"
          autoComplete="new-password"
        />
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
          {submitting ? "RESETTING…" : "SET NEW PASSWORD"}
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
    </AuthCard>
  );
}
