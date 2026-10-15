import { EntityEditPage } from "@/components/entities/entity-edit-pages";
import { entityMetadata } from "@/server/page-metadata";

export async function generateMetadata(props: PageProps<"/worlds/[worldId]/characters/[characterId]/edit">) {
  const { worldId, characterId } = await props.params;
  return entityMetadata(worldId, characterId, "Edit");
}

export default async function Page(props: PageProps<"/worlds/[worldId]/characters/[characterId]/edit">) {
  const { worldId, characterId } = await props.params;
  return <EntityEditPage worldId={worldId} entityId={characterId} />;
}
