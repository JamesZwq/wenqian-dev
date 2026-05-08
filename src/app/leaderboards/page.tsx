import Link from "next/link";
import { GAMES } from "@/lib/leaderboards/games";

export default function LeaderboardsPage() {
  const games = Object.values(GAMES);
  return (
    <div className="min-h-screen px-4 py-12 flex justify-center">
      <div className="w-full max-w-3xl">
        <h1 className="font-sans text-3xl font-bold mb-1" style={{ color: "var(--pixel-text)" }}>
          Leaderboards
        </h1>
        <p className="font-mono text-xs mb-6" style={{ color: "var(--pixel-muted)" }}>
          Pick a game to see its top 100.
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {games.map((g) => (
            <li key={g.id}>
              <Link
                href={`/leaderboards/${g.id}`}
                prefetch={false}
                className="block rounded-xl border-2 p-4 transition-transform hover:scale-[1.02]"
                style={{ background: "var(--pixel-card-bg)", borderColor: "var(--pixel-border)" }}
              >
                <div className="font-sans text-base font-semibold" style={{ color: "var(--pixel-text)" }}>
                  {g.label}
                </div>
                <div className="font-mono text-[10px] mt-1" style={{ color: "var(--pixel-muted)" }}>
                  {g.p2pOnly ? "P2P · ELO" : g.hybrid ? "SOLO + P2P" : "SOLO"}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
