import Link from "next/link";
import Image from "next/image";
import { getSession } from "@/lib/session";
import { InitialsAvatar } from "@/components/auth/InitialsAvatar";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 1) return `${local}***@${domain}`;
  return `${local[0]}${"*".repeat(Math.min(local.length - 1, 3))}@${domain}`;
}

export default async function ProfilePage() {
  const session = (await getSession())!; // guaranteed non-null by layout guard
  const u = session.user as typeof session.user & {
    username?: string | null;
    displayUsername?: string | null;
  };
  const display = u.displayUsername || u.name;
  const memberSince = new Date(u.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="min-h-screen px-4 py-12 flex justify-center">
      <div
        className="w-full max-w-md rounded-2xl border-2 p-8 shadow-xl h-fit"
        style={{
          background: "var(--pixel-card-bg)",
          borderColor: "var(--pixel-border)",
          boxShadow: "0 12px 40px var(--pixel-glow)",
        }}
      >
        <div className="flex flex-col items-center gap-3">
          {u.image ? (
            <Image
              src={u.image}
              alt={display ?? u.email}
              width={96}
              height={96}
              className="rounded-full"
            />
          ) : (
            <InitialsAvatar name={display ?? u.email} size={96} />
          )}
          <div className="text-center">
            <div
              className="font-sans text-2xl font-bold"
              style={{ color: "var(--pixel-text)" }}
            >
              @{u.username ?? "—"}
            </div>
            <div
              className="font-mono text-sm mt-1"
              style={{ color: "var(--pixel-muted)" }}
            >
              {display}
            </div>
          </div>
        </div>

        <dl className="mt-8 space-y-3 font-mono text-sm">
          <Row label="EMAIL" value={maskEmail(u.email)} />
          <Row label="VERIFIED" value={u.emailVerified ? "✓ yes" : "⚠ pending"} />
          <Row label="MEMBER SINCE" value={memberSince} />
        </dl>

        <Link
          href="/settings"
          className="mt-8 block w-full rounded-xl border-2 px-4 py-3 text-center font-sans font-semibold text-sm transition-transform hover:scale-[1.02]"
          style={{ borderColor: "var(--pixel-accent)", color: "var(--pixel-accent)" }}
        >
          EDIT IN SETTINGS
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-baseline justify-between gap-4 border-b py-2"
      style={{ borderColor: "var(--pixel-border)" }}
    >
      <dt className="text-[10px] tracking-widest" style={{ color: "var(--pixel-muted)" }}>
        {label}
      </dt>
      <dd style={{ color: "var(--pixel-text)" }}>{value}</dd>
    </div>
  );
}
