import { EntityEditPage } from "@/components/entities/entity-edit-pages";

export default async function Page(props: PageProps<"/worlds/[worldId]/factions/[factionId]/edit">) {
  const { worldId, factionId } = await props.params;
  return <EntityEditPage worldId={worldId} entityId={factionId} />;
}
