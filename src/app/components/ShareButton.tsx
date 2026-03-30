"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ShareButtonProps {
  title: string;
  text: string;
  /** Override share URL; defaults to window.location.href */
  url?: string;
  /** OG image URL for preview; defaults to /api/og?title=... */
  ogImage?: string;
  /** Extra Tailwind classes for the wrapper div */
  className?: string;
}

// ── Platform definitions ──────────────────────────────────────────────────────

const PLATFORMS = [
  {
    id: "x",
    name: "X",
    color: "var(--pixel-text)",
    lightBg: "rgba(0,0,0,0.06)",
    darkBg: "rgba(255,255,255,0.10)",
    getUrl: (url: string, text: string) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    id: "facebook",
    name: "Facebook",
    color: "#1877f2",
    lightBg: "rgba(24,119,242,0.10)",
    darkBg: "rgba(24,119,242,0.16)",
    getUrl: (url: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    color: "#0a66c2",
    lightBg: "rgba(10,102,194,0.10)",
    darkBg: "rgba(10,102,194,0.16)",
    getUrl: (url: string, text: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&summary=${encodeURIComponent(text)}`,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    color: "#25d366",
    lightBg: "rgba(37,211,102,0.10)",
    darkBg: "rgba(37,211,102,0.14)",
    getUrl: (url: string, text: string) =>
      `https://wa.me/?text=${encodeURIComponent(text + "\n" + url)}`,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
      </svg>
    ),
  },
] as const;

// ── Share icon (upload-style arrow) ──────────────────────────────────────────

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="15"
      height="15"
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ShareButton({ title, text, url, ogImage, className = "" }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Detect native share API on mount
  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  const getShareUrl = useCallback(() => {
    return url ?? (typeof window !== "undefined" ? window.location.href : "");
  }, [url]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current?.contains(e.target as Node) ||
        buttonRef.current?.contains(e.target as Node)
      )
        return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handlePlatformClick = useCallback(
    (getUrl: (url: string, text: string) => string) => {
      const shareUrl = getShareUrl();
      window.open(getUrl(shareUrl, text), "_blank", "noopener,noreferrer,width=600,height=520");
      setOpen(false);
    },
    [getShareUrl, text]
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select input
    }
  }, [getShareUrl]);

  const handleNativeShare = useCallback(async () => {
    try {
      await navigator.share({ title, text, url: getShareUrl() });
      setOpen(false);
    } catch {
      // user cancelled or API unavailable
    }
  }, [title, text, getShareUrl]);

  return (
    <div className={`relative ${className}`}>
      {/* Trigger button */}
      <motion.button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Share this page"
        className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-3 py-2 font-sans font-semibold text-[10px] tracking-tight text-[var(--pixel-accent)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-md transition-colors hover:bg-[var(--pixel-bg-alt)] md:text-xs"
      >
        <ShareIcon />
        <span className="hidden sm:inline">SHARE</span>
      </motion.button>

      {/* Popover */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, scale: 0.92, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -8 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className="absolute right-0 top-full z-[200] mt-2 w-72 origin-top-right rounded-2xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] shadow-2xl shadow-[var(--pixel-glow)] backdrop-blur-xl overflow-hidden"
          >
            {/* Header */}
            <div className="border-b border-[var(--pixel-border)] bg-[var(--pixel-bg-alt)] px-4 py-2.5 flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold tracking-widest text-[var(--pixel-accent)]">
                SHARE
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[var(--pixel-muted)] transition-colors hover:text-[var(--pixel-text)] leading-none text-sm"
              >
                ✕
              </button>
            </div>

            {/* OG preview card */}
            <div className="px-3 pt-3">
              <div className="overflow-hidden rounded-lg border border-[var(--pixel-border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ogImage ?? `/api/og?title=${encodeURIComponent(title)}`}
                  alt="Share preview"
                  className="block w-full"
                  style={{ aspectRatio: "1200/630" }}
                />
                <div className="bg-[var(--pixel-bg)] px-2.5 py-2">
                  <p className="font-sans text-[10px] font-semibold text-[var(--pixel-text)] leading-tight truncate">
                    {title}
                  </p>
                  <p className="mt-0.5 font-mono text-[8px] text-[var(--pixel-muted)] truncate">
                    {typeof window !== "undefined" ? window.location.host : ""}
                  </p>
                </div>
              </div>
            </div>

            {/* Platform buttons */}
            <div className="p-3 grid grid-cols-4 gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePlatformClick(p.getUrl)}
                  className="group flex flex-col items-center gap-1.5 rounded-xl p-2.5 transition-all hover:scale-[1.07] active:scale-95"
                  style={{
                    background: `var(--platform-bg-${p.id}, ${p.lightBg})`,
                  }}
                  title={`Share on ${p.name}`}
                >
                  <span
                    className="transition-transform group-hover:scale-110"
                    style={{ color: p.color }}
                  >
                    {p.icon}
                  </span>
                  <span
                    className="font-mono text-[8px] font-semibold tracking-tight leading-none"
                    style={{ color: p.color }}
                  >
                    {p.name}
                  </span>
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="mx-3 border-t border-[var(--pixel-border)]" />

            {/* Copy link */}
            <div className="p-3 flex gap-2">
              <input
                readOnly
                value={getShareUrl()}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="min-w-0 flex-1 rounded-lg border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-2.5 py-1.5 font-mono text-[9px] text-[var(--pixel-muted)] focus:outline-none cursor-pointer select-all"
              />
              <motion.button
                type="button"
                onClick={handleCopy}
                whileTap={{ scale: 0.95 }}
                className={`flex items-center gap-1 shrink-0 rounded-lg border px-2.5 py-1.5 font-sans font-semibold text-[9px] tracking-tight transition-all ${
                  copied
                    ? "border-[#22c55e] bg-[color-mix(in_oklab,#22c55e_12%,transparent)] text-[#22c55e]"
                    : "border-[var(--pixel-accent)] text-[var(--pixel-accent)] hover:bg-[color-mix(in_oklab,var(--pixel-accent)_10%,transparent)]"
                }`}
              >
                {copied ? (
                  <>
                    <CheckIcon />
                    COPIED
                  </>
                ) : (
                  "COPY"
                )}
              </motion.button>
            </div>

            {/* Native share button (mobile) */}
            {canNativeShare && (
              <div className="px-3 pb-3">
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-bg-alt)] py-2 font-sans font-semibold text-[9px] tracking-widest text-[var(--pixel-muted)] transition-colors hover:border-[var(--pixel-accent)] hover:text-[var(--pixel-accent)]"
                >
                  MORE OPTIONS (incl. Instagram)
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
