"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { AvatarPicker } from "@/components/auth/AvatarPicker";
import { PasswordField } from "@/components/auth/PasswordField";
import { UsernameField } from "@/components/auth/UsernameField";
import { EmailField } from "@/components/auth/EmailField";
import { canonicalizeUsername, validateUsername } from "@/lib/username";

export interface SettingsUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  username: string | null;
  displayUsername: string | null;
}

export function SettingsClient({ user }: { user: SettingsUser }) {
  const [name, setName] = useState(user.name);
  const [usernameInput, setUsernameInput] = useState(user.displayUsername ?? user.username ?? "");
  const [email, setEmail] = useState(user.email);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setBusy(true);
    const v = validateUsername(usernameInput);
    if (!v.ok) {
      setError(v.reason);
      setBusy(false);
      return;
    }
    // 1) update name
    const r1 = await authClient.updateUser({ name });
    if (r1.error) {
      setError(r1.error.message ?? "Save name failed");
      setBusy(false);
      return;
    }
    // 2) update username if changed
    const newCanonical = canonicalizeUsername(usernameInput);
    if (newCanonical !== user.username) {
      const r2 = await authClient.updateUser({
        username: newCanonical,
        displayUsername: usernameInput,
      } as Parameters<typeof authClient.updateUser>[0]);
      if (r2.error) {
        setError(r2.error.message ?? "Username change failed");
        setBusy(false);
        return;
      }
    }
    setOk("Saved.");
    setBusy(false);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setBusy(true);
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      setBusy(false);
      return;
    }
    const res = await authClient.changePassword({
      currentPassword: oldPassword,
      newPassword,
    });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? "Password change failed");
      return;
    }
    setOk("Password changed.");
    setOldPassword("");
    setNewPassword("");
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setBusy(true);
    const res = await authClient.changeEmail({ newEmail: email });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? "Email change failed");
      return;
    }
    setOk("Verification sent to your new address.");
  }

  async function deleteAccount() {
    setError(null);
    const expected = user.displayUsername ?? user.username ?? "";
    if (deleteConfirm !== expected) {
      setError("Type your username exactly to confirm");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmUsername: deleteConfirm }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(`Delete failed: ${res.status}`);
      return;
    }
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen px-4 py-12 flex justify-center">
      <div className="w-full max-w-md space-y-6">
        <h1 className="font-sans text-2xl font-bold" style={{ color: "var(--pixel-text)" }}>
          Settings
        </h1>

        {error && (
          <p className="font-mono text-xs" style={{ color: "#ef4444" }}>
            {error}
          </p>
        )}
        {ok && (
          <p className="font-mono text-xs" style={{ color: "var(--pixel-accent)" }}>
            {ok}
          </p>
        )}

        <Section title="Avatar">
          <AvatarPicker currentUrl={user.image} onChanged={() => window.location.reload()} />
        </Section>

        <Section title="Profile">
          <form onSubmit={saveProfile} className="space-y-4">
            <label className="block">
              <span
                className="font-mono text-[10px] tracking-widest"
                style={{ color: "var(--pixel-muted)" }}
              >
                DISPLAY NAME
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={64}
                className="mt-1 w-full rounded-xl border-2 px-3 py-2 font-mono text-sm"
                style={{
                  background: "var(--pixel-bg-alt)",
                  borderColor: "var(--pixel-border)",
                  color: "var(--pixel-text)",
                }}
              />
            </label>
            <UsernameField value={usernameInput} onChange={setUsernameInput} />
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl border-2 px-4 py-2 font-sans text-xs font-semibold disabled:opacity-60"
              style={{
                background: "var(--pixel-accent)",
                borderColor: "var(--pixel-accent)",
                color: "var(--pixel-bg)",
              }}
            >
              SAVE PROFILE
            </button>
          </form>
        </Section>

        <Section title="Email">
          <form onSubmit={changeEmail} className="space-y-4">
            <EmailField value={email} onChange={setEmail} />
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl border-2 px-4 py-2 font-sans text-xs font-semibold disabled:opacity-60"
              style={{
                background: "var(--pixel-accent)",
                borderColor: "var(--pixel-accent)",
                color: "var(--pixel-bg)",
              }}
            >
              CHANGE EMAIL
            </button>
          </form>
        </Section>

        <Section title="Password">
          <form onSubmit={changePassword} className="space-y-4">
            <PasswordField
              value={oldPassword}
              onChange={setOldPassword}
              label="Current password"
              autoComplete="current-password"
            />
            <PasswordField
              value={newPassword}
              onChange={setNewPassword}
              label="New password"
              autoComplete="new-password"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl border-2 px-4 py-2 font-sans text-xs font-semibold disabled:opacity-60"
              style={{
                background: "var(--pixel-accent)",
                borderColor: "var(--pixel-accent)",
                color: "var(--pixel-bg)",
              }}
            >
              CHANGE PASSWORD
            </button>
          </form>
        </Section>

        <Section title="Danger zone">
          <p className="font-mono text-xs mb-3" style={{ color: "var(--pixel-muted)" }}>
            Type your username (
            <code>{user.displayUsername ?? user.username ?? ""}</code>) to confirm.
          </p>
          <input
            type="text"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="confirm username"
            className="w-full rounded-xl border-2 px-3 py-2 font-mono text-sm"
            style={{
              background: "var(--pixel-bg-alt)",
              borderColor: "var(--pixel-border)",
              color: "var(--pixel-text)",
            }}
          />
          <button
            type="button"
            disabled={busy || deleteConfirm !== (user.displayUsername ?? user.username ?? "")}
            onClick={deleteAccount}
            className="mt-3 rounded-xl border-2 px-4 py-2 font-sans text-xs font-semibold disabled:opacity-50"
            style={{ background: "transparent", borderColor: "#ef4444", color: "#ef4444" }}
          >
            DELETE MY ACCOUNT
          </button>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-2xl border-2 p-6"
      style={{ background: "var(--pixel-card-bg)", borderColor: "var(--pixel-border)" }}
    >
      <h2
        className="font-sans text-sm font-semibold mb-4 tracking-widest"
        style={{ color: "var(--pixel-accent)" }}
      >
        {title.toUpperCase()}
      </h2>
      {children}
    </section>
  );
}
