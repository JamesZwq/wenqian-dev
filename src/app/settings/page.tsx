import { getSession } from "@/lib/session";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const session = (await getSession())!; // guaranteed non-null by layout
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
