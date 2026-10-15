import { EntityEditPage } from "@/components/entities/entity-edit-pages";
import { entityMetadata } from "@/server/page-metadata";

export async function generateMetadata(props: PageProps<"/worlds/[worldId]/locations/[locationId]/edit">) {
  const { worldId, locationId } = await props.params;
  return entityMetadata(worldId, locationId, "Edit");
}

export default async function Page(props: PageProps<"/worlds/[worldId]/locations/[locationId]/edit">) {
  const { worldId, locationId } = await props.params;
  return <EntityEditPage worldId={worldId} entityId={locationId} />;
}
