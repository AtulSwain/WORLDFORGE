import { EntityEditPage } from "@/components/entities/entity-edit-pages";

export default async function Page(props: PageProps<"/worlds/[worldId]/characters/[characterId]/edit">) {
  const { worldId, characterId } = await props.params;
  return <EntityEditPage worldId={worldId} entityId={characterId} />;
}
