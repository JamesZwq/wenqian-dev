interface SessionUser {
  id: string;
  email: string;
  emailVerified: boolean | null | undefined;
  [key: string]: unknown;
}

interface SessionLike {
  user?: SessionUser | null;
}

/**
 * Gate for write endpoints. Returns the user object if authed AND verified.
 * Returns a Response (which the route handler should return as-is) otherwise.
 */
export async function requireVerifiedSession(
  session: SessionLike | null | undefined,
): Promise<SessionUser | Response> {
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!session.user.emailVerified) {
    return new Response("Email not verified", { status: 403 });
  }
  return session.user;
}
