import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * Retrieve the current session from a server component / route handler.
 * Returns null if not authenticated OR if Better-Auth's API errors out
 * (e.g., when called from an RSC prefetch context where 'request state'
 * isn't established — observed under Next.js 16 + Better-Auth 1.6).
 *
 * Callers should ALWAYS treat null as 'no session' rather than relying on
 * exceptions; this keeps server components renderable instead of bubbling
 * up to global-error.tsx.
 */
export async function getSession() {
  try {
    const h = await headers();
    return await auth().api.getSession({ headers: h });
  } catch (err) {
    // Better-Auth occasionally throws "No request state found" during RSC
    // prefetch. Swallow → treat as unauthed; the layout's redirect path
    // handles the user-visible flow correctly.
    console.warn("[session] getSession() error:", err);
    return null;
  }
}

export type ServerSession = Awaited<ReturnType<typeof getSession>>;
