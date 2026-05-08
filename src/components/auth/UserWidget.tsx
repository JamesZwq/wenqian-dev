"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { authClient, useSession } from "@/lib/auth-client";
import { InitialsAvatar } from "./InitialsAvatar";
import { dropdownVariants, dropdownItemVariants } from "./animation-variants";

interface Props {
  /** Server-evaluated isAdmin flag (this is a client component, can't read env). */
  isAdmin: boolean;
}

export function UserWidget({ isAdmin }: Props) {
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const [open, setOpen] = useState(false);

  // Mobile (≤md): only render on home page (game pages already have crowded
  // top-right corners). Desktop: always render.
  const onHome = pathname === "/";
  const visibilityClass = onHome ? "block" : "hidden md:block";

  if (isPending) {
    return null;
  }

  if (!session?.user) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        className={`fixed top-4 right-4 z-[140] md:top-6 md:right-6 ${visibilityClass}`}
      >
        <Link
          href={`/sign-in?next=${encodeURIComponent(pathname || "/")}`}
          className="rounded-xl border-2 px-3 py-2 font-sans font-semibold text-[11px] tracking-tight backdrop-blur-md"
          style={{
            background: "var(--pixel-card-bg)",
            borderColor: "var(--pixel-accent)",
            color: "var(--pixel-accent)",
          }}
        >
          SIGN IN
        </Link>
      </motion.div>
    );
  }

  const u = session.user as typeof session.user & {
    displayUsername?: string | null;
    username?: string | null;
  };
  const display = u.displayUsername || u.name || u.email;
  const verified = !!u.emailVerified;

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      className={`fixed right-4 top-4 z-50 md:right-6 md:top-6 ${visibilityClass}`}
    >
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative rounded-full border-2 transition-transform hover:scale-105"
        style={{ borderColor: "var(--pixel-border)", background: "var(--pixel-card-bg)" }}
      >
        {u.image ? (
          <Image
            src={u.image}
            alt={display ?? u.email}
            width={40}
            height={40}
            className="rounded-full block"
          />
        ) : (
          <InitialsAvatar name={display ?? u.email} size={40} />
        )}
        {!verified && (
          <span
            aria-label="Email not verified"
            className="absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full border-2 text-[8px] font-bold"
            style={{ background: "#f59e0b", borderColor: "var(--pixel-bg)", color: "#1f2937" }}
          >
            !
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute right-0 mt-2 w-56 rounded-xl border-2 p-2 shadow-xl backdrop-blur-md"
            style={{
              background: "var(--pixel-card-bg)",
              borderColor: "var(--pixel-border)",
              boxShadow: "0 12px 40px var(--pixel-glow)",
            }}
            role="menu"
          >
            <motion.div variants={dropdownItemVariants} className="px-2 py-2">
              <div
                className="font-sans text-sm font-semibold truncate"
                style={{ color: "var(--pixel-text)" }}
              >
                {display}
              </div>
              <div
                className="font-mono text-[10px] truncate"
                style={{ color: "var(--pixel-muted)" }}
              >
                @{u.username ?? "—"}
              </div>
            </motion.div>
            <div className="my-1 h-px" style={{ background: "var(--pixel-border)" }} />
            <DropdownLink href="/profile" onSelect={() => setOpen(false)}>
              Profile
            </DropdownLink>
            <DropdownLink href="/settings" onSelect={() => setOpen(false)}>
              Settings
            </DropdownLink>
            {isAdmin && (
              <DropdownLink href="/admin" onSelect={() => setOpen(false)}>
                Admin
              </DropdownLink>
            )}
            <div className="my-1 h-px" style={{ background: "var(--pixel-border)" }} />
            <motion.button
              variants={dropdownItemVariants}
              type="button"
              onClick={async () => {
                await authClient.signOut();
                window.location.href = "/";
              }}
              className="w-full rounded-md px-2 py-2 text-left font-mono text-xs hover:bg-[var(--pixel-bg-alt)]"
              style={{ color: "#ef4444" }}
              role="menuitem"
            >
              Sign out
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DropdownLink({
  href,
  onSelect,
  children,
}: {
  href: string;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div variants={dropdownItemVariants}>
      <Link
        href={href}
        onClick={onSelect}
        // prefetch=false: dropdown links lead to authed routes whose RSC
        // prefetch trips Better-Auth ("No request state found"). The user
        // will only navigate when they click anyway — prefetch is overhead
        // here, not value.
        prefetch={false}
        className="block rounded-md px-2 py-2 font-mono text-xs hover:bg-[var(--pixel-bg-alt)]"
        style={{ color: "var(--pixel-text)" }}
        role="menuitem"
      >
        {children}
      </Link>
    </motion.div>
  );
}
