import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/ui/misc";
import { PasswordForm, PreferencesForm, SessionsPanel, SettingsTabs } from "@/components/settings/account-forms";
import { requireUser } from "@/server/auth/session";
import { getPreferences } from "@/server/services/users";
import { db } from "@/server/db";

export const metadata = { title: "Account & preferences" };

export default async function AccountPage() {
  const user = await requireUser();
  const [prefs, sessions] = await Promise.all([
    getPreferences(user.id),
    db.session.count({ where: { userId: user.id, expiresAt: { gt: new Date() } } }),
  ]);
  return (
    <AppShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
        <PageHeader eyebrow="Settings" title="Account & preferences" />
        <SettingsTabs />
        <section className="wf-panel p-6">
          <h2 className="mb-4 font-serif text-xl font-semibold">Preferences</h2>
          <PreferencesForm initial={{ reducedMotion: prefs.reducedMotion, directoryView: prefs.directoryView === "list" ? "list" : "grid" }} />
        </section>
        <section className="wf-panel p-6">
          <h2 className="mb-4 font-serif text-xl font-semibold">Password</h2>
          <PasswordForm />
        </section>
        <section className="wf-panel p-6">
          <h2 className="mb-4 font-serif text-xl font-semibold">Sessions</h2>
          <SessionsPanel count={sessions} />
        </section>
      </div>
    </AppShell>
  );
}
