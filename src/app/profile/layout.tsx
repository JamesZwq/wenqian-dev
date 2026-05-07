import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in?next=/profile");
  return <>{children}</>;
}
