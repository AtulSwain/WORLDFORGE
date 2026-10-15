import { EntityEditPage } from "@/components/entities/entity-edit-pages";
import { entityMetadata } from "@/server/page-metadata";

export async function generateMetadata(props: PageProps<"/worlds/[worldId]/entities/[entityId]/edit">) {
  const { worldId, entityId } = await props.params;
  return entityMetadata(worldId, entityId, "Edit");
}

export default async function Page(props: PageProps<"/worlds/[worldId]/entities/[entityId]/edit">) {
  const { worldId, entityId } = await props.params;
  return <EntityEditPage worldId={worldId} entityId={entityId} />;
}
