import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function StatsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in?next=/stats");
  return <>{children}</>;
}
