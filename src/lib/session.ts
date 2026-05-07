import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * Retrieve the current session from a server component / route handler.
 * Returns null if not authenticated.
 */
export async function getSession() {
  const h = await headers();
  return auth().api.getSession({ headers: h });
}

export type ServerSession = Awaited<ReturnType<typeof getSession>>;
