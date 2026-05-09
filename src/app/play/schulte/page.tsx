"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { SchulteGrid } from "@/app/schulte/components/SchulteGrid";
import { useSchulteRoomGame } from "./useSchulteRoomGame";
import { RoomMembersBar } from "@/features/rooms/components/RoomMembersBar";
import { InitialsAvatar } from "@/components/auth/InitialsAvatar";

function fmtTime(ms: number): string {
  const totalSec = ms / 1000;
  const m = Math.floor(totalSec / 60);
  const s = (totalSec - m * 60).toFixed(1);
  return m > 0 ? `${m}:${s.padStart(4, "0")}` : `${s}s`;
}

export default function SchultePlayPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    const c = params.get("room");
    if (!c) {
      router.replace("/rooms/schulte");
      return;
    }
    setCode(c);
  }, [params, router]);

  if (!code) return null;
  return <Play code={code} />;
}

function Play({ code }: { code: string }) {
  const game = useSchulteRoomGame(code);

  return (
    <div className="min-h-screen px-4 py-8 flex flex-col items-center">
      <div className="w-full max-w-3xl mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-sans text-xl font-bold" style={{ color: "var(--pixel-text)" }}>
            Schulte —{" "}
            <span className="font-mono tracking-widest text-base" style={{ color: "var(--pixel-accent)" }}>
              {code}
            </span>
          </h1>
          <p className="font-mono text-[10px]" style={{ color: "var(--pixel-muted)" }}>
            {game.role === "host" ? "Host" : game.role === "guest" ? "Guest" : "Connecting…"}
            {" · "}{game.members.length} player{game.members.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          onClick={async () => {
            await game.leaveRoom();
            window.location.href = "/rooms/schulte";
          }}
          className="rounded-xl border-2 px-3 py-1.5 font-mono text-xs"
          style={{ borderColor: "var(--pixel-border)", color: "var(--pixel-text)" }}
        >
          LEAVE
        </button>
      </div>

      {game.room && (
        <div className="w-full max-w-3xl mb-4">
          <RoomMembersBar
            members={game.room.members}
            hostUserId={game.room.hostUserId}
            capacity={game.room.capacity}
          />
        </div>
      )}

      {game.error && (
        <p className="font-mono text-xs mb-4" style={{ color: "#ef4444" }}>
          {game.error}
        </p>
      )}

      {/* Lobby: waiting to start */}
      {game.status === "lobby" && (
        <div className="w-full max-w-3xl rounded-xl border-2 p-6 text-center"
          style={{ background: "var(--pixel-card-bg)", borderColor: "var(--pixel-border)" }}
        >
          <p className="font-mono text-xs mb-4" style={{ color: "var(--pixel-muted)" }}>
            5×5 race. First to clear all 25 numbers wins.
          </p>
          {game.isHost ? (
            <button
              onClick={game.startRace}
              disabled={game.members.length < 2}
              className="rounded-xl border-2 px-6 py-3 font-mono text-sm font-bold disabled:opacity-50"
              style={{
                background: "var(--pixel-accent)",
                color: "var(--pixel-bg)",
                borderColor: "var(--pixel-accent)",
              }}
            >
              {game.members.length < 2 ? "WAITING FOR PLAYERS" : "START RACE"}
            </button>
          ) : (
            <p className="font-mono text-xs" style={{ color: "var(--pixel-text)" }}>
              Waiting for host to start…
            </p>
          )}
        </div>
      )}

      {/* Playing */}
      {(game.status === "playing" || game.status === "complete") && (
        <div className="w-full max-w-3xl flex flex-col items-center gap-4">
          <div className="font-mono text-lg" style={{ color: "var(--pixel-accent)" }}>
            {fmtTime(game.elapsedMs)}
            <span className="ml-3 text-xs" style={{ color: "var(--pixel-muted)" }}>
              next: {game.currentTarget}
            </span>
          </div>

          {/* Opponent progress strip */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
            {game.members
              .filter((m) => m.userId !== game.myUserId)
              .map((m) => (
                <div
                  key={m.userId}
                  className="flex items-center gap-2 rounded-xl border-2 p-2"
                  style={{ background: "var(--pixel-card-bg)", borderColor: "var(--pixel-border)" }}
                >
                  <InitialsAvatar name={m.displayUsername ?? m.userId} size={24} />
                  <div className="flex-1">
                    <div className="font-mono text-[10px] truncate" style={{ color: "var(--pixel-text)" }}>
                      {m.displayUsername ?? "anonymous"}
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--pixel-bg-alt)" }}>
                      <motion.div
                        animate={{ width: `${m.progressPct}%` }}
                        transition={{ duration: 0.2 }}
                        className="h-full"
                        style={{
                          background: m.completed ? "var(--pixel-accent-2, var(--pixel-accent))" : "var(--pixel-accent)",
                        }}
                      />
                    </div>
                  </div>
                  {m.completed && (
                    <span className="font-mono text-[10px]" style={{ color: "var(--pixel-accent-2, var(--pixel-accent))" }}>
                      {fmtTime(m.completionMs ?? 0)}
                    </span>
                  )}
                </div>
              ))}
          </div>

          <SchulteGrid
            numbers={game.numbers}
            size={game.size}
            currentTarget={game.currentTarget}
            wrongClickIndex={game.wrongClickIndex}
            onCellClick={game.handleCellClick}
            disabled={game.status !== "playing"}
          />

          {game.status === "complete" && (
            <p className="font-mono text-sm" style={{ color: "var(--pixel-accent)" }}>
              Done in {fmtTime(game.elapsedMs)} — waiting for everyone else…
            </p>
          )}
        </div>
      )}

      {/* Results */}
      {game.status === "race_done" && game.results && (
        <div className="w-full max-w-3xl rounded-xl border-2 p-6"
          style={{ background: "var(--pixel-card-bg)", borderColor: "var(--pixel-border)" }}
        >
          <h2 className="font-sans text-lg font-bold mb-4" style={{ color: "var(--pixel-text)" }}>
            Results
          </h2>
          <ol className="space-y-1">
            {game.results.map((r, i) => {
              const member = game.members.find((m) => m.userId === r.userId);
              const display = member?.displayUsername ?? "anonymous";
              const isMe = r.userId === game.myUserId;
              return (
                <li
                  key={r.userId}
                  className="flex items-center gap-3 rounded-lg px-3 py-2"
                  style={{
                    background: isMe
                      ? "color-mix(in oklab, var(--pixel-accent) 14%, transparent)"
                      : "transparent",
                    border: isMe ? "1px solid var(--pixel-accent)" : "1px solid transparent",
                  }}
                >
                  <span className="w-8 text-right font-mono text-xs"
                    style={{ color: i < 3 ? "var(--pixel-accent)" : "var(--pixel-muted)" }}
                  >
                    #{i + 1}
                  </span>
                  <InitialsAvatar name={display} size={28} />
                  <span className="flex-1 font-sans text-sm truncate" style={{ color: "var(--pixel-text)" }}>
                    {display}
                  </span>
                  <span className="font-mono text-sm font-semibold" style={{ color: "var(--pixel-text)" }}>
                    {fmtTime(r.timeMs)}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 flex gap-2">
            {game.isHost && (
              <button
                onClick={game.startRace}
                className="rounded-xl border-2 px-3 py-2 font-mono text-xs font-bold"
                style={{
                  background: "var(--pixel-accent)",
                  color: "var(--pixel-bg)",
                  borderColor: "var(--pixel-accent)",
                }}
              >
                NEW RACE
              </button>
            )}
            <button
              onClick={async () => {
                await game.leaveRoom();
                window.location.href = "/rooms/schulte";
              }}
              className="rounded-xl border-2 px-3 py-2 font-mono text-xs"
              style={{ borderColor: "var(--pixel-border)", color: "var(--pixel-text)" }}
            >
              BACK TO LOBBY
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
