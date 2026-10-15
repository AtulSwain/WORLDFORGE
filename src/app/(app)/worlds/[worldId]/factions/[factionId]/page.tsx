import { EntityDetailPage } from "@/components/entities/entity-detail-page";
import { entityMetadata } from "@/server/page-metadata";

export async function generateMetadata(props: PageProps<"/worlds/[worldId]/factions/[factionId]">) {
  const { worldId, factionId } = await props.params;
  return entityMetadata(worldId, factionId);
}

export default async function Page(props: PageProps<"/worlds/[worldId]/factions/[factionId]">) {
  const { worldId, factionId } = await props.params;
  return <EntityDetailPage worldId={worldId} entityId={factionId} expected={"FACTION"} searchParams={await props.searchParams} />;
}
