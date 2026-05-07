import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/is-admin";
import { UserWidget } from "./UserWidget";
import { VerifyEmailBanner } from "./VerifyEmailBanner";

/**
 * Server component that resolves the session, then renders the client-side
 * UserWidget + (when applicable) the VerifyEmailBanner. Mounted globally in
 * the root layout so every page gets the widget.
 */
export async function UserWidgetMount() {
  const session = await getSession();
  const admin = isAdmin(session);
  const showBanner = !!(session?.user && !session.user.emailVerified);
  const email = session?.user?.email ?? "";
  return (
    <>
      {showBanner && <VerifyEmailBanner email={email} />}
      <UserWidget isAdmin={admin} />
    </>
  );
}
