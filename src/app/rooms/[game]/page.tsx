"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GAMES } from "@/lib/leaderboards/games";
import type { GameId } from "@/db/schema/leaderboards";
import { useRoom } from "@/features/rooms/hooks/useRoom";
import { RoomLobby } from "@/features/rooms/components/RoomLobby";
import { JoinByCodeInput } from "@/features/rooms/components/JoinByCodeInput";
import { CreateRoomModal } from "@/features/rooms/components/CreateRoomModal";

const MAX_CAPACITY: Record<GameId, number> = {
  schulte: 6, reaction: 6, math: 6, "flash-count": 6,
  trail: 6, pattern: 6, sudoku: 6, maze: 6,
  poker: 6, "halli-galli": 6,
  gomoku: 2, "pulse-duel": 2,
};

export default function RoomsPage({ params }: { params: Promise<{ game: string }> }) {
  const router = useRouter();
  const [game, setGame] = useState<GameId | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  // Stable per-mount peerId — used as the host's peerId on creation, or as
  // the guest's peerId when joining.
  const myPeerId = useMemo(
    () => `wq-pending-${Math.random().toString(36).slice(2, 10)}`,
    [],
  );
  const room = useRoom({ game: game ?? "schulte", myPeerId });

  useEffect(() => {
    params.then(({ game: g }) => {
      if (!(g in GAMES)) { router.replace("/leaderboards"); return; }
      setGame(g as GameId);
    });
  }, [params, router]);

  if (!game) return null;
  const meta = GAMES[game];
  const max = MAX_CAPACITY[game];

  const handleJoin = async (code: string) => {
    const ok = await room.joinRoom(code);
    if (ok) router.push(`/play/${game}?room=${code}`);
  };

  return (
    <div className="min-h-screen px-4 py-12 flex justify-center">
      <div className="w-full max-w-3xl">
        <h1 className="font-sans text-3xl font-bold mb-1" style={{ color: "var(--pixel-text)" }}>
          {meta.label} Rooms
        </h1>
        <p className="font-mono text-xs mb-6" style={{ color: "var(--pixel-muted)" }}>
          Up to {max} players. Code-share or pick from the public list.
        </p>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-xl border-2 px-3 py-2 font-mono text-xs font-bold"
            style={{
              background: "var(--pixel-accent)",
              color: "var(--pixel-bg)",
              borderColor: "var(--pixel-accent)",
            }}
          >
            CREATE ROOM
          </button>
          <JoinByCodeInput onSubmit={handleJoin} />
        </div>

        <h2
          className="font-sans text-sm font-semibold tracking-widest mb-3"
          style={{ color: "var(--pixel-accent)" }}
        >
          PUBLIC ROOMS
        </h2>
        <RoomLobby game={game} onJoin={handleJoin} />

        <CreateRoomModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          maxCapacity={max}
          onCreate={async (opts) => {
            const code = await room.createRoom(opts);
            setShowCreate(false);
            if (code) router.push(`/play/${game}?room=${code}`);
          }}
        />

        {room.error && (
          <p className="font-mono text-xs mt-4" style={{ color: "#ef4444" }}>
            {room.error}
          </p>
        )}
      </div>
    </div>
  );
}
