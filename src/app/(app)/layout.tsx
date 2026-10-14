import { requireUser } from "@/server/auth/session";

/** Every route in this group requires a signed-in user (verified against the session table). */
export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <>{children}</>;
}
