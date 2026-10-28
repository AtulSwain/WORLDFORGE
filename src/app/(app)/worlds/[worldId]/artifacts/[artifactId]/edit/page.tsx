import { EntityEditPage } from "@/components/entities/entity-edit-pages";
import { entityMetadata } from "@/server/page-metadata";

export async function generateMetadata(props: PageProps<"/worlds/[worldId]/artifacts/[artifactId]/edit">) {
  const { worldId, artifactId } = await props.params;
  return entityMetadata(worldId, artifactId, "Edit");
}

export default async function Page(props: PageProps<"/worlds/[worldId]/artifacts/[artifactId]/edit">) {
  const { worldId, artifactId } = await props.params;
  return <EntityEditPage worldId={worldId} entityId={artifactId} />;
}
