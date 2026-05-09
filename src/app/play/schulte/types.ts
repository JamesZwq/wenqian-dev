import type { GridSize } from "@/app/schulte/types";

export interface RoomMemberInfo {
  userId: string;
  peerId: string;
  displayUsername: string | null;
}

export type SchulteRoomPacket =
  | { type: "members_sync"; members: RoomMemberInfo[]; hostUserId: string }
  | { type: "puzzle_sync"; numbers: number[]; size: GridSize; startedAt: number }
  | { type: "progress"; userId: string; target: number; timestamp: number }
  | { type: "progress_relay"; userId: string; target: number; timestamp: number }
  | { type: "game_complete"; userId: string; timeMs: number; timestamp: number }
  | { type: "race_results"; matchId: string; positions: { userId: string; timeMs: number }[] };

export const ROOM_GRID_SIZE: GridSize = 5; // canonical room size
