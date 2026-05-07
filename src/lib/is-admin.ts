import { env } from "@/lib/env";

interface SessionLike {
  user?: { email?: string | null } | null;
}

/**
 * True iff the session belongs to the single configured admin.
 * Returns false in every other case, including when ADMIN_EMAIL is not
 * configured (fail-closed).
 */
export function isAdmin(session: SessionLike | null | undefined): boolean {
  const adminEmail = (env() as unknown as { ADMIN_EMAIL?: string }).ADMIN_EMAIL;
  if (!adminEmail) return false;
  if (!session?.user?.email) return false;
  return session.user.email === adminEmail;
}
