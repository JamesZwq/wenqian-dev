import { eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/is-admin";
import { getDb } from "@/db/client";
import {
  user as userTable,
  session as sessionTable,
  account as accountTable,
  verification as verificationTable,
} from "@/db/schema/auth";
import { track } from "@/lib/analytics";

/**
 * Anonymises the requester's account.
 *  - Refuses if requester is the configured admin (would leave site without one).
 *  - Requires a confirmUsername in the JSON body matching the user's
 *    displayUsername (or username if displayUsername is null).
 *  - Deletes the R2 avatar object if any.
 *  - Anonymises the user row (PII fields cleared, unique-keyed email replaced
 *    with a tombstone-unique value to keep the row intact for foreign-key
 *    integrity in future feature schemas).
 *  - Hard-deletes session/account/verification rows.
 */
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  if (isAdmin(session)) {
    return new Response("Admin cannot self-delete", { status: 409 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* empty body */
  }
  const u = session.user as typeof session.user & {
    username?: string | null;
    displayUsername?: string | null;
  };
  const expected = u.displayUsername ?? u.username ?? "";
  const submitted = (body as { confirmUsername?: unknown }).confirmUsername;
  if (typeof submitted !== "string" || submitted !== expected) {
    return new Response("Confirmation mismatch", { status: 400 });
  }

  const e = env();
  const db = getDb();

  // Delete avatar object if present.
  if (u.image) {
    const m = u.image.match(/avatars\/[^?#]+/);
    if (m) await e.BUCKET.delete(m[0]).catch(() => {});
  }

  // Anonymise the user row. We keep the row (not hard delete) so any future
  // schema's `ON DELETE SET NULL` foreign keys still find a tombstone target,
  // and so re-using the email later doesn't collide.
  await db
    .update(userTable)
    .set({
      email: `deleted-${u.id}@deleted.local`,
      name: "[deleted]",
      image: null,
      username: null,
      displayUsername: null,
      emailVerified: false,
    })
    .where(eq(userTable.id, u.id));

  // Destroy all credentials / pending verifications / sessions.
  await db.delete(sessionTable).where(eq(sessionTable.userId, u.id));
  await db.delete(accountTable).where(eq(accountTable.userId, u.id));
  await db.delete(verificationTable).where(eq(verificationTable.identifier, u.email));

  track({ name: "user.deleted" });
  return new Response(null, { status: 204 });
}
