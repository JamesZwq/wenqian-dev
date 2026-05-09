"use client";
import { motion } from "framer-motion";
import { InitialsAvatar } from "@/components/auth/InitialsAvatar";
import type { RoomMember } from "@/features/rooms/hooks/useRoom";

export function RoomMembersBar({
  members,
  hostUserId,
  capacity,
}: {
  members: RoomMember[];
  hostUserId: string;
  capacity: number;
}) {
  const slots = Array.from({ length: capacity }, (_, i) => members[i] ?? null);
  return (
    <div
      className="flex items-center gap-2 p-2 rounded-xl border-2"
      style={{ background: "var(--pixel-card-bg)", borderColor: "var(--pixel-border)" }}
    >
      {slots.map((m, i) =>
        m === null ? (
          <div
            key={`empty-${i}`}
            className="w-7 h-7 rounded-full border-2 border-dashed"
            style={{ borderColor: "var(--pixel-muted)" }}
          />
        ) : (
          <motion.div
            key={m.userId}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: i * 0.05 }}
            className="relative"
            title={m.displayUsername ?? m.userId}
          >
            <InitialsAvatar name={m.displayUsername ?? m.userId} size={28} />
            {m.userId === hostUserId && (
              <span
                className="absolute -top-1 -right-1 text-[8px] font-bold rounded-full px-1"
                style={{
                  background: "var(--pixel-accent)",
                  color: "var(--pixel-bg)",
                }}
              >
                H
              </span>
            )}
          </motion.div>
        ),
      )}
    </div>
  );
}
