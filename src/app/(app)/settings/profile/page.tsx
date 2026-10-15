import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/ui/misc";
import { ProfileForm, SettingsTabs } from "@/components/settings/account-forms";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const session = await requireUser();
  const user = await db.user.findUniqueOrThrow({ where: { id: session.id }, select: { name: true, email: true, bio: true } });
  return (
    <AppShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
        <PageHeader eyebrow="Settings" title="Profile" />
        <SettingsTabs />
        <ProfileForm email={user.email} initial={{ name: user.name, bio: user.bio ?? "" }} />
      </div>
    </AppShell>
  );
}
