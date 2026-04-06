"use client";

import { useEffect } from "react";
import { setRoomInUrl } from "./useJoinParam";
import type { P2PPhase } from "../lib/p2p";

/**
 * Syncs the room code to `?room=CODE` in the URL bar whenever the
 * connection phase reaches "connected" or "reconnecting".
 * Clears it when the player goes back to "ready" (manual disconnect / back to lobby).
 */
export function useRoomUrl(roomCode: string | null, phase: P2PPhase) {
  useEffect(() => {
    if (roomCode) {
      setRoomInUrl(roomCode);
    } else if (phase === "ready" || phase === "disconnected") {
      setRoomInUrl(null);
    }
  }, [roomCode, phase]);
}
