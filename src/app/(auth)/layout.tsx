import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session?.user) redirect("/profile");

  // Transparent wrapper — let the site-wide animated background show through.
  // Just centers the card vertically + horizontally inside the viewport.
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full flex justify-center">{children}</div>
    </div>
  );
}
