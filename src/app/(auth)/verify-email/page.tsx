"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";

/**
 * Two cases handled here:
 *  1. Arrived from sign-up but not yet clicked the email link → splash with
 *     "check your inbox" copy.
 *  2. Arrived from the verification email's link with ?token=… → call
 *     Better-Auth's verify endpoint, then route to /profile on success.
 *
 * Reads token from window.location.search on mount instead of useSearchParams()
 * to avoid Suspense/SSR-bailout issue.
 */
export default function VerifyEmailPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const t = sp.get("token");
    setToken(t);
    if (t) setStatus("verifying");
    setTokenChecked(true);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      // Better-Auth's verify-email is a GET to /api/auth/verify-email?token=…
      // Hit the URL directly so we don't depend on the client SDK exposing
      // a wrapper for it (the SDK's verifyEmail signature changes between
      // minor versions).
      const res = await fetch(
        `/api/auth/verify-email?token=${encodeURIComponent(token)}`,
        { method: "GET" },
      );
      if (cancelled) return;
      if (!res.ok) {
        setError(`Verification failed (status ${res.status})`);
        setStatus("error");
        return;
      }
      setStatus("success");
      setTimeout(() => router.push("/profile"), 1500);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  // Until we've inspected window.location.search on mount we don't know
  // which view to show. Render the splash card optimistically — if a token
  // turns out to be present the JSX below replaces it.
  if (tokenChecked && token) {
    return (
      <AuthCard title="Verifying email…">
        {status === "verifying" && (
          <p className="font-mono text-sm" style={{ color: "var(--pixel-muted)" }}>
            One moment…
          </p>
        )}
        {status === "success" && (
          <p className="font-mono text-sm" style={{ color: "var(--pixel-text)" }}>
            ✓ Verified. Taking you to your profile…
          </p>
        )}
        {status === "error" && (
          <>
            <p className="font-mono text-sm" style={{ color: "#ef4444" }}>
              {error}
            </p>
            <Link
              href="/sign-in"
              className="font-mono text-xs"
              style={{ color: "var(--pixel-accent)" }}
            >
              Back to sign in
            </Link>
          </>
        )}
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Check your email"
      subtitle="We sent a verification link to your address."
    >
      <p className="font-mono text-sm" style={{ color: "var(--pixel-text)" }}>
        Click the link from <code>noreply@wenqian.dev</code> to finish.
      </p>
      <p className="mt-4 font-mono text-xs" style={{ color: "var(--pixel-muted)" }}>
        Didn&apos;t get it? Sign in (you can still browse) and use the{" "}
        <em>Resend</em> button in the verification banner.
      </p>
      <Link
        href="/sign-in"
        className="mt-6 inline-block rounded-xl border-2 px-4 py-2 font-sans font-semibold text-xs"
        style={{ borderColor: "var(--pixel-border)", color: "var(--pixel-text)" }}
      >
        BACK TO SIGN IN
      </Link>
    </AuthCard>
  );
}
