"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { useRoom, type RoomMember } from "@/features/rooms/hooks/useRoom";
import { useStarPeerConnection } from "@/features/p2p/hooks/useStarPeerConnection";
import { submitMatchBulk } from "@/lib/leaderboards/submit";
import type { GameId } from "@/db/schema/leaderboards";

/**
 * Generic "race" relay. Game-agnostic transport + race-end semantics:
 *   1. Host generates a puzzle (game-specific TPuzzle) and broadcasts it.
 *   2. Guests acknowledge progress via reportProgress(target). Host relays
 *      to other guests so everyone sees N-1 opponent bars.
 *   3. Each player calls reportComplete() locally when they finish. The
 *      message goes to host, who records times. When every member has
 *      reported completion, host broadcasts race_results; every client then
 *      calls submitMatchBulk so the round-robin pairwise ELO update fires.
 *
 * The game-specific page provides only:
 *   - generatePuzzle(): returns a serializable puzzle
 *   - puzzle UI rendering (consumes the puzzle returned by useRoomRaceRelay)
 *   - calls reportProgress/reportComplete at the right moments
 */

type RelayPacket<TPuzzle> =
  | { type: "puzzle_sync"; puzzle: TPuzzle; startedAt: number }
  | { type: "progress"; userId: string; target: number; timestamp: number }
  | { type: "progress_relay"; userId: string; target: number; timestamp: number }
  | { type: "game_complete"; userId: string; timeMs: number; timestamp: number }
  | { type: "race_results"; matchId: string; positions: { userId: string; timeMs: number }[] };

export type RaceStatus = "lobby" | "playing" | "complete" | "race_done";

export interface MemberView extends RoomMember {
  progressPct: number;
  completed: boolean;
  completionMs: number | null;
}

export interface UseRoomRaceRelayApi<TPuzzle> {
  room: ReturnType<typeof useRoom>["room"];
  role: ReturnType<typeof useRoom>["role"];
  isHost: boolean;
  error: string | null;
  leaveRoom: () => Promise<void>;

  status: RaceStatus;
  puzzle: TPuzzle | null;
  startedAt: number | null;
  elapsedMs: number;
  results: { userId: string; timeMs: number }[] | null;
  members: MemberView[];
  myUserId: string | null;

  startRace: () => void;
  reportProgress: (target: number) => void;
  reportComplete: () => void;
}

export function useRoomRaceRelay<TPuzzle>(opts: {
  game: GameId;
  roomCode: string;
  generatePuzzle: () => TPuzzle;
  /** Number of "progress units" in this puzzle (e.g., 25 cells for 5x5 Schulte).
   *  Used for the progress bar UI calculation. */
  totalUnits: number;
}): UseRoomRaceRelayApi<TPuzzle> {
  const { game, roomCode, generatePuzzle, totalUnits } = opts;
  const { data: session } = useSession();
  const myUserId = session?.user?.id ?? null;

  const myPeerId = useMemo(
    () => `wq-${game}-${roomCode}-${Math.random().toString(36).slice(2, 10)}`,
    [game, roomCode],
  );
  const room = useRoom({ game, myPeerId });

  // Auto-attach on mount.
  const attemptedRef = useRef(false);
  useEffect(() => {
    if (!myUserId || attemptedRef.current) return;
    if (room.room) return;
    attemptedRef.current = true;
    room.attachRoom(roomCode);
  }, [myUserId, room, roomCode]);

  const isHost = room.role === "host";
  const hostPeerId = room.room?.hostPeerId ?? null;

  // Game state
  const [status, setStatus] = useState<RaceStatus>("lobby");
  const [puzzle, setPuzzle] = useState<TPuzzle | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [progressByUser, setProgressByUser] = useState<Record<string, number>>({});
  const [completionByUser, setCompletionByUser] = useState<Record<string, number>>({});
  const [results, setResults] = useState<{ userId: string; timeMs: number }[] | null>(null);

  const statusRef = useRef(status);
  const startedAtRef = useRef<number | null>(null);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { startedAtRef.current = startedAt; }, [startedAt]);

  // Star peer connection
  const peerEnabled = !!room.room && (room.role === "host" || !!hostPeerId);

  const sendToRef = useRef<((peerId: string, p: RelayPacket<TPuzzle>) => void) | null>(null);

  const handleData = useCallback(
    (payload: RelayPacket<TPuzzle>, fromPeerId: string) => {
      if (!payload?.type) return;
      switch (payload.type) {
        case "puzzle_sync":
          setPuzzle(payload.puzzle);
          setProgressByUser({});
          setCompletionByUser({});
          setResults(null);
          setStartedAt(payload.startedAt);
          setStatus("playing");
          break;
        case "progress":
          if (isHost) {
            setProgressByUser((p) => ({ ...p, [payload.userId]: payload.target }));
            const relay: RelayPacket<TPuzzle> = {
              type: "progress_relay",
              userId: payload.userId,
              target: payload.target,
              timestamp: payload.timestamp,
            };
            for (const m of room.room?.members ?? []) {
              if (m.peerId !== fromPeerId && m.peerId !== myPeerId) {
                sendToRef.current?.(m.peerId, relay);
              }
            }
          }
          break;
        case "progress_relay":
          setProgressByUser((p) => ({ ...p, [payload.userId]: payload.target }));
          break;
        case "game_complete":
          setCompletionByUser((c) => ({ ...c, [payload.userId]: payload.timeMs }));
          break;
        case "race_results":
          setResults(payload.positions);
          setStatus("race_done");
          if (myUserId) {
            void submitMatchBulk({
              matchId: payload.matchId,
              game,
              positions: payload.positions.map((p) => p.userId),
              roomCode,
            });
          }
          break;
      }
    },
    [isHost, myUserId, myPeerId, game, roomCode, room.room],
  );

  const peer = useStarPeerConnection<RelayPacket<TPuzzle>>({
    role: room.role === "host" ? "host" : "guest",
    hostPeerId,
    myPeerId,
    prefix: `wq-${game}-${roomCode}`,
    enabled: peerEnabled,
    onData: handleData,
  });
  useEffect(() => { sendToRef.current = peer.sendTo; }, [peer.sendTo]);

  // Race-end detection (host only)
  useEffect(() => {
    if (!isHost) return;
    if (statusRef.current !== "playing" && statusRef.current !== "complete") return;
    const members = room.room?.members ?? [];
    if (members.length === 0) return;
    const allDone = members.every((m) => completionByUser[m.userId] !== undefined);
    if (!allDone) return;
    const sorted = members
      .map((m) => ({ userId: m.userId, timeMs: completionByUser[m.userId] }))
      .sort((a, b) => a.timeMs - b.timeMs);
    const matchId = `${roomCode}:race-${Date.now()}`;
    peer.broadcast({ type: "race_results", matchId, positions: sorted });
    setResults(sorted);
    setStatus("race_done");
    if (myUserId) {
      void submitMatchBulk({
        matchId,
        game,
        positions: sorted.map((s) => s.userId),
        roomCode,
      });
    }
  }, [isHost, completionByUser, room.room, peer, roomCode, myUserId, game]);

  // Display timer
  useEffect(() => {
    if (status !== "playing") return;
    const id = setInterval(() => {
      const now = Date.now();
      setElapsedMs(now - (startedAtRef.current ?? now));
    }, 100);
    return () => clearInterval(id);
  }, [status]);

  // ─── Actions ───

  const startRace = useCallback(() => {
    if (!isHost) return;
    const p = generatePuzzle();
    const start = Date.now();
    peer.broadcast({ type: "puzzle_sync", puzzle: p, startedAt: start });
    setPuzzle(p);
    setProgressByUser({});
    setCompletionByUser({});
    setResults(null);
    setStartedAt(start);
    setStatus("playing");
  }, [isHost, peer, generatePuzzle]);

  const reportProgress = useCallback(
    (target: number) => {
      if (!myUserId || statusRef.current !== "playing") return;
      if (isHost) {
        setProgressByUser((p) => ({ ...p, [myUserId]: target }));
        peer.broadcast({
          type: "progress_relay",
          userId: myUserId,
          target,
          timestamp: Date.now(),
        });
      } else {
        peer.broadcast({ type: "progress", userId: myUserId, target, timestamp: Date.now() });
      }
    },
    [isHost, myUserId, peer],
  );

  const reportComplete = useCallback(() => {
    if (!myUserId || statusRef.current !== "playing") return;
    const now = Date.now();
    const timeMs = now - (startedAtRef.current ?? now);
    setElapsedMs(timeMs);
    setStatus("complete");
    setCompletionByUser((c) => ({ ...c, [myUserId]: timeMs }));
    peer.broadcast({
      type: "game_complete",
      userId: myUserId,
      timeMs,
      timestamp: now,
    });
  }, [myUserId, peer]);

  // Members view
  const members: MemberView[] = useMemo(() => {
    const list = room.room?.members ?? [];
    return list.map((m) => {
      const target = progressByUser[m.userId] ?? 1;
      const completed = completionByUser[m.userId] !== undefined;
      const completionMs = completionByUser[m.userId] ?? null;
      return {
        ...m,
        progressPct: completed ? 100 : Math.min(100, ((target - 1) / totalUnits) * 100),
        completed,
        completionMs,
      };
    });
  }, [room.room, progressByUser, completionByUser, totalUnits]);

  return {
    room: room.room,
    role: room.role,
    isHost,
    error: room.error,
    leaveRoom: room.leaveRoom,
    status,
    puzzle,
    startedAt,
    elapsedMs,
    results,
    members,
    myUserId,
    startRace,
    reportProgress,
    reportComplete,
  };
}
