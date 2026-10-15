import Link from "next/link";
import { Sigil } from "@/components/brand/logo";
import { getCurrentUser } from "@/server/auth/session";
import { listUniverses } from "@/server/services/universes";
import { AccountMenu } from "./account-menu";
import { CommandPalette } from "./command-palette";
import { PrimaryNav, ToolRail, MobileWorldNav } from "./world-nav";
import { UniverseSwitcher } from "./universe-switcher";

export async function AppShell({
  world,
  children,
}: {
  world?: { id: string; name: string; canWrite: boolean };
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const universes = user ? (await listUniverses(user.id)).map((u) => ({ id: u.id, name: u.name, role: u.role })) : [];
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:rounded focus:bg-gold focus:px-3 focus:py-1 focus:text-bg">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-bg-2/95 px-2 backdrop-blur sm:px-3">
        {world ? <MobileWorldNav worldId={world.id} /> : null}
        <Link href="/dashboard" className="flex items-center gap-2 rounded-md px-1.5 py-1 text-gold hover:bg-surface-2" aria-label="All worlds">
          <Sigil className="size-6" />
          <span className="hidden font-serif text-lg font-semibold text-text xl:inline">WorldForge</span>
        </Link>
        <span className="text-border-strong" aria-hidden="true">/</span>
        <UniverseSwitcher current={world ? { id: world.id, name: world.name } : null} universes={universes} />
        {world ? <PrimaryNav worldId={world.id} /> : <div className="flex-1" />}
        <CommandPalette worldId={world?.id ?? null} canWrite={world?.canWrite ?? false} universes={universes} />
        {user ? <AccountMenu name={user.name} email={user.email} /> : null}
      </header>
      <div className="flex min-h-0 flex-1">
        {world ? <ToolRail worldId={world.id} /> : null}
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
