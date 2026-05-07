"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { AuthCard } from "@/components/auth/AuthCard";
import { EmailField } from "@/components/auth/EmailField";
import { PasswordField } from "@/components/auth/PasswordField";
import { UsernameField } from "@/components/auth/UsernameField";
import { canonicalizeUsername, validateUsername } from "@/lib/username";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const v = validateUsername(usernameInput);
    if (!v.ok) {
      setError(v.reason);
      return;
    }
    if (!name.trim()) {
      setError("Display name is required");
      return;
    }

    setSubmitting(true);
    const res = await authClient.signUp.email({
      email,
      password,
      name: name.trim(),
      username: canonicalizeUsername(usernameInput),
      // Better-Auth's username plugin extends signUp with displayUsername.
      // The client SDK's types don't always surface plugin extensions cleanly.
      displayUsername: usernameInput,
    } as Parameters<typeof authClient.signUp.email>[0]);
    setSubmitting(false);
    if (res.error) {
      setError(res.error.message ?? "Sign-up failed");
      return;
    }
    router.push("/verify-email");
  }

  return (
    <AuthCard
      title="Create account"
      subtitle="Welcome to wenqian.dev — pick a username, drop your email."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <UsernameField value={usernameInput} onChange={setUsernameInput} />

        <label className="block">
          <span
            className="font-mono text-[10px] tracking-widest"
            style={{ color: "var(--pixel-muted)" }}
          >
            DISPLAY NAME
          </span>
          <input
            type="text"
            required
            maxLength={64}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border-2 px-3 py-2 font-mono text-sm outline-none transition-colors focus:border-[var(--pixel-accent)]"
            style={{
              background: "var(--pixel-bg-alt)",
              borderColor: "var(--pixel-border)",
              color: "var(--pixel-text)",
            }}
          />
        </label>

        <EmailField value={email} onChange={setEmail} />

        <PasswordField
          value={password}
          onChange={setPassword}
          label="Password (8–100, letters + digits)"
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
          className="w-full rounded-xl border-2 px-4 py-3 font-sans font-semibold text-sm transition-transform hover:scale-[1.02] disabled:opacity-60"
          style={{
            background: "var(--pixel-accent)",
            borderColor: "var(--pixel-accent)",
            color: "var(--pixel-bg)",
          }}
        >
          {submitting ? "CREATING…" : "SIGN UP"}
        </button>

        <p className="text-center font-mono text-xs" style={{ color: "var(--pixel-muted)" }}>
          Already have an account?{" "}
          <Link href="/sign-in" style={{ color: "var(--pixel-accent)" }}>
            Sign in
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
