import { requireUser } from "@/server/auth/session";
import { getPreferences } from "@/server/services/users";
import { ReducedMotionPreference } from "@/components/motion-provider";

/** Every route in this group requires a signed-in user (verified against the session table). */
export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const prefs = await getPreferences(user.id);
  return <ReducedMotionPreference enabled={prefs.reducedMotion}>{children}</ReducedMotionPreference>;
}
