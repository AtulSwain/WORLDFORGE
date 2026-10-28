import { AppShell } from "@/components/shell/app-shell";
import { CreateWorldWizard } from "@/components/dashboard/create-world-wizard";
import { requireUser } from "@/server/auth/session";
import { getPreferences } from "@/server/services/users";
import { publicAiStatus } from "@/server/ai/config";

export const metadata = { title: "New universe" };

export default async function NewWorldPage(props: PageProps<"/worlds/new">) {
  const sp = await props.searchParams;
  const user = await requireUser();
  const prefs = await getPreferences(user.id);
  const draft = (prefs.onboardingDraft ?? null) as { step: number; values: Record<string, unknown> } | null;
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
        {sp.welcome ? (
          <p className="mb-6 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-sm text-text-2">
            Welcome to WorldForge, {user.name.split(" ")[0]}. Let&apos;s found your first universe — it takes under a minute, and you can change everything later.
          </p>
        ) : null}
        <CreateWorldWizard draft={draft} ai={publicAiStatus()} />
      </div>
    </AppShell>
  );
}
