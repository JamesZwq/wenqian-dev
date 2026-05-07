"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

interface Props {
  email: string;
}

/**
 * Persistent banner shown when the signed-in user has not verified email.
 * Not dismissible — every write endpoint is locked behind verification.
 */
export function VerifyEmailBanner({ email }: Props) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function resend() {
    setState("sending");
    setErrMsg(null);
    try {
      const res = await authClient.sendVerificationEmail({ email });
      if (res.error) {
        setErrMsg(res.error.message ?? "send failed");
        setState("error");
      } else {
        setState("sent");
      }
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "send failed");
      setState("error");
    }
  }

  return (
    <div
      role="status"
      className="w-full px-4 py-2 flex items-center justify-center gap-3 font-mono text-xs"
      style={{
        background: "color-mix(in oklab, #f59e0b 22%, var(--pixel-bg))",
        color: "var(--pixel-text)",
      }}
    >
      <span>⚠ Please verify your email ({email}) to unlock all features.</span>
      <button
        type="button"
        onClick={resend}
        disabled={state === "sending" || state === "sent"}
        className="rounded-md border px-2 py-0.5 font-semibold tracking-widest disabled:opacity-60"
        style={{ borderColor: "var(--pixel-border)", color: "var(--pixel-text)" }}
      >
        {state === "sent" ? "SENT" : state === "sending" ? "SENDING…" : "RESEND"}
      </button>
      {errMsg && <span style={{ color: "#ef4444" }}>{errMsg}</span>}
    </div>
  );
}
