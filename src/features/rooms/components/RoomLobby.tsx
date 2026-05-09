"use client";
import { useEffect, useState } from "react";
import type { GameId } from "@/db/schema/leaderboards";

export interface PublicRoomCard {
  code: string;
  game: GameId;
  capacity: number;
  slotsTaken: number;
  hostDisplayName: string | null;
  createdAt: number;
}

export function RoomLobby({
  game,
  onJoin,
  refreshKey,
}: {
  game: GameId;
  onJoin: (code: string) => void;
  refreshKey?: number;
}) {
  const [rooms, setRooms] = useState<PublicRoomCard[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/rooms?game=${game}`);
        if (!r.ok) return;
        const j = (await r.json()) as { rooms: PublicRoomCard[] };
        if (!cancelled) setRooms(j.rooms);
      } catch { /* network */ }
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [game, refreshKey]);

  if (rooms === null) {
    return (
      <p className="font-mono text-xs" style={{ color: "var(--pixel-muted)" }}>
        Loading lobby…
      </p>
    );
  }
  if (rooms.length === 0) {
    return (
      <p className="font-mono text-xs" style={{ color: "var(--pixel-muted)" }}>
        No public rooms open. Be the first.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {rooms.map((r) => (
        <li key={r.code}>
          <button
            onClick={() => onJoin(r.code)}
            className="block w-full text-left rounded-xl border-2 p-3 transition-transform hover:scale-[1.02]"
            style={{ background: "var(--pixel-card-bg)", borderColor: "var(--pixel-border)" }}
          >
            <div className="flex items-baseline justify-between">
              <span className="font-mono tracking-widest text-sm" style={{ color: "var(--pixel-accent)" }}>
                {r.code}
              </span>
              <span className="font-mono text-[10px]" style={{ color: "var(--pixel-muted)" }}>
                {r.slotsTaken} / {r.capacity}
              </span>
            </div>
            <div className="mt-1 font-sans text-xs truncate" style={{ color: "var(--pixel-text)" }}>
              {r.hostDisplayName ?? "anonymous"}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
