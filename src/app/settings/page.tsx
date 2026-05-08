import { getSession } from "@/lib/session";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  // Layout already guards unauthed access via redirect, but Next.js may render
  // layout and page in parallel — handle null defensively here too.
  const session = await getSession();
  if (!session?.user) {
    return null;
  }
  return (
    <SettingsClient
      user={{
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image ?? null,
        username: (session.user as { username?: string | null }).username ?? null,
        displayUsername:
          (session.user as { displayUsername?: string | null }).displayUsername ?? null,
      }}
    />
  );
}
