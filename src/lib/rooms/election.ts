export interface Member {
  userId: string;
  peerId: string;
  online: boolean;
}

/** Lowest userId among online members. Pure, deterministic. */
export function electHost(members: Member[]): Member | null {
  const online = members.filter((m) => m.online);
  if (online.length === 0) return null;
  let best = online[0];
  for (let i = 1; i < online.length; i++) {
    if (online[i].userId < best.userId) best = online[i];
  }
  return best;
}
