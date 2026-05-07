import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session?.user) redirect("/profile");

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "var(--pixel-bg)" }}
    >
      <div className="w-full flex justify-center">{children}</div>
    </div>
  );
}
