import { redirect } from "next/navigation";
import { getWorldContext } from "@/server/page-context";
import { NewLoreForm } from "@/components/codex/new-lore-form";
import { PageHeader } from "@/components/ui/misc";

export const metadata = { title: "New lore document" };

export default async function NewLorePage(props: PageProps<"/worlds/[worldId]/codex/new">) {
  const { worldId } = await props.params;
  const ctx = await getWorldContext(worldId);
  if (!ctx.can("content:write")) redirect(`/worlds/${worldId}/codex`);
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader eyebrow="Lore Codex" title="New document" description="Give it a title and category; you'll continue in the editor, which saves automatically." />
      <div className="mt-6"><NewLoreForm worldId={worldId} /></div>
    </div>
  );
}
