import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { getDb } from "@/db/client";
import { user as userTable } from "@/db/schema/auth";

export default async function StatsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in?next=/stats");

  const db = getDb();
  const [me] = await db.select().from(userTable).where(eq(userTable.id, session.user.id));
  if (!me?.username) redirect("/profile");
  redirect(`/u/${me.username}`);
}
