import { EntityNewPage } from "@/components/entities/entity-edit-pages";
import { newEntityMetadata } from "@/server/page-metadata";

export const metadata = newEntityMetadata("FACTION");

export default async function Page(props: PageProps<"/worlds/[worldId]/factions/new">) {
  const { worldId } = await props.params;
  const sp = await props.searchParams;
  return <EntityNewPage worldId={worldId} type={"FACTION"} typeParam={typeof sp.type === "string" ? sp.type : undefined} />;
}
