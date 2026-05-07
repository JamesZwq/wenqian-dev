import { describe, it, expect } from "vitest";
import { requireVerifiedSession } from "@/lib/require-verified";

describe("requireVerifiedSession", () => {
  it("returns 401 Response when session is null", async () => {
    const result = await requireVerifiedSession(null);
    expect(result instanceof Response).toBe(true);
    expect((result as Response).status).toBe(401);
  });

  it("returns 403 Response when emailVerified is false", async () => {
    const session = {
      user: { id: "u1", email: "x@y.com", emailVerified: false },
    };
    const result = await requireVerifiedSession(session);
    expect(result instanceof Response).toBe(true);
    expect((result as Response).status).toBe(403);
  });

  it("returns the user when verified", async () => {
    const session = {
      user: { id: "u1", email: "x@y.com", emailVerified: true },
    };
    const result = await requireVerifiedSession(session);
    expect(result).toEqual(session.user);
  });
});
