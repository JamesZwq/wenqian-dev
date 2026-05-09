import { describe, it, expect } from "vitest";
import { electHost, type Member } from "@/lib/rooms/election";

const m = (userId: string, online = true): Member => ({ userId, peerId: `peer-${userId}`, online });

describe("electHost", () => {
  it("returns the lowest userId among online members", () => {
    expect(electHost([m("zoe"), m("alice"), m("bob")])).toEqual(m("alice"));
  });

  it("ignores offline members", () => {
    expect(electHost([m("alice", false), m("bob"), m("zoe")])).toEqual(m("bob"));
  });

  it("returns null when no members are online", () => {
    expect(electHost([m("alice", false), m("bob", false)])).toBeNull();
  });

  it("returns null on empty member list", () => {
    expect(electHost([])).toBeNull();
  });

  it("is stable: same input → same output", () => {
    const list = [m("c"), m("a"), m("b")];
    const a = electHost(list);
    const b = electHost(list);
    expect(a).toEqual(b);
  });
});
