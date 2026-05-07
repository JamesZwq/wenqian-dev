import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  // Already signed in? Bounce to profile.
  if (session?.user) redirect("/profile");

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "var(--pixel-bg)" }}
    >
      <div className="w-full flex justify-center">
        {/*
          Suspense boundary required because /sign-in, /reset-password and
          /verify-email use useSearchParams(). Without it Next.js bails the
          whole page to client-side rendering — observed symptom: card briefly
          flashes then disappears, only the password input remains.
        */}
        <Suspense fallback={null}>{children}</Suspense>
      </div>
    </div>
  );
}
