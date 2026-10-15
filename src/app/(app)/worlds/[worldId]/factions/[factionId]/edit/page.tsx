import { EntityEditPage } from "@/components/entities/entity-edit-pages";
import { entityMetadata } from "@/server/page-metadata";

export async function generateMetadata(props: PageProps<"/worlds/[worldId]/factions/[factionId]/edit">) {
  const { worldId, factionId } = await props.params;
  return entityMetadata(worldId, factionId, "Edit");
}

export default async function Page(props: PageProps<"/worlds/[worldId]/factions/[factionId]/edit">) {
  const { worldId, factionId } = await props.params;
  return <EntityEditPage worldId={worldId} entityId={factionId} />;
}
