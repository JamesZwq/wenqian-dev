"use client";
import { motion } from "framer-motion";
import { RoomMembersBar } from "@/features/rooms/components/RoomMembersBar";
import { InitialsAvatar } from "@/components/auth/InitialsAvatar";
import type { GameId } from "@/db/schema/leaderboards";
import type { UseRoomRaceRelayApi } from "@/features/rooms/hooks/useRoomRaceRelay";

function fmtTime(ms: number): string {
  const totalSec = ms / 1000;
  const m = Math.floor(totalSec / 60);
  const s = (totalSec - m * 60).toFixed(1);
  return m > 0 ? `${m}:${s.padStart(4, "0")}` : `${s}s`;
}

/**
 * Shared room shell: header + members bar + opponent progress strip + results.
 * Each game provides the gameplay UI as children when status === "playing" || "complete".
 */
export function RoomRaceShell<TPuzzle>({
  game,
  title,
  code,
  api,
  children,
  lobbyHint,
}: {
  game: GameId;
  title: string;
  code: string;
  api: UseRoomRaceRelayApi<TPuzzle>;
  /** Gameplay UI rendered during "playing" + "complete" states. */
  children: React.ReactNode;
  /** Single-line hint shown in the lobby card (e.g. "5×5 race. First to clear all 25 numbers wins."). */
  lobbyHint: string;
}) {
  return (
    <div className="min-h-screen px-4 py-8 flex flex-col items-center">
      {/* Header */}
      <div className="w-full max-w-3xl mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-sans text-xl font-bold" style={{ color: "var(--pixel-text)" }}>
            {title} —{" "}
            <span className="font-mono tracking-widest text-base" style={{ color: "var(--pixel-accent)" }}>
              {code}
            </span>
          </h1>
          <p className="font-mono text-[10px]" style={{ color: "var(--pixel-muted)" }}>
            {api.role === "host" ? "Host" : api.role === "guest" ? "Guest" : "Connecting…"}
            {" · "}
            {api.members.length} player{api.members.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          onClick={async () => {
            await api.leaveRoom();
            window.location.href = `/rooms/${game}`;
          }}
          className="rounded-xl border-2 px-3 py-1.5 font-mono text-xs"
          style={{ borderColor: "var(--pixel-border)", color: "var(--pixel-text)" }}
        >
          LEAVE
        </button>
      </div>

      {/* Members bar */}
      {api.room && (
        <div className="w-full max-w-3xl mb-4">
          <RoomMembersBar
            members={api.room.members}
            hostUserId={api.room.hostUserId}
            capacity={api.room.capacity}
          />
        </div>
      )}

      {api.error && (
        <p className="font-mono text-xs mb-4" style={{ color: "#ef4444" }}>
          {api.error}
        </p>
      )}

      {/* Lobby */}
      {api.status === "lobby" && (
        <div
          className="w-full max-w-3xl rounded-xl border-2 p-6 text-center"
          style={{ background: "var(--pixel-card-bg)", borderColor: "var(--pixel-border)" }}
        >
          <p className="font-mono text-xs mb-4" style={{ color: "var(--pixel-muted)" }}>
            {lobbyHint}
          </p>
          {api.isHost ? (
            <button
              onClick={api.startRace}
              disabled={api.members.length < 2}
              className="rounded-xl border-2 px-6 py-3 font-mono text-sm font-bold disabled:opacity-50"
              style={{
                background: "var(--pixel-accent)",
                color: "var(--pixel-bg)",
                borderColor: "var(--pixel-accent)",
              }}
            >
              {api.members.length < 2 ? "WAITING FOR PLAYERS" : "START RACE"}
            </button>
          ) : (
            <p className="font-mono text-xs" style={{ color: "var(--pixel-text)" }}>
              Waiting for host to start…
            </p>
          )}
        </div>
      )}

      {/* Playing + Complete: timer, opponents, gameplay UI */}
      {(api.status === "playing" || api.status === "complete") && (
        <div className="w-full max-w-3xl flex flex-col items-center gap-4">
          <div className="font-mono text-lg" style={{ color: "var(--pixel-accent)" }}>
            {fmtTime(api.elapsedMs)}
          </div>

          {/* Opponent progress strip */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
            {api.members
              .filter((m) => m.userId !== api.myUserId)
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
                          background: m.completed
                            ? "var(--pixel-accent-2, var(--pixel-accent))"
                            : "var(--pixel-accent)",
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

          {children}

          {api.status === "complete" && (
            <p className="font-mono text-sm" style={{ color: "var(--pixel-accent)" }}>
              Done in {fmtTime(api.elapsedMs)} — waiting for everyone else…
            </p>
          )}
        </div>
      )}

      {/* Results */}
      {api.status === "race_done" && api.results && (
        <div
          className="w-full max-w-3xl rounded-xl border-2 p-6"
          style={{ background: "var(--pixel-card-bg)", borderColor: "var(--pixel-border)" }}
        >
          <h2 className="font-sans text-lg font-bold mb-4" style={{ color: "var(--pixel-text)" }}>
            Results
          </h2>
          <ol className="space-y-1">
            {api.results.map((r, i) => {
              const member = api.members.find((m) => m.userId === r.userId);
              const display = member?.displayUsername ?? "anonymous";
              const isMe = r.userId === api.myUserId;
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
                  <span
                    className="w-8 text-right font-mono text-xs"
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
            {api.isHost && (
              <button
                onClick={api.startRace}
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
                await api.leaveRoom();
                window.location.href = `/rooms/${game}`;
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
