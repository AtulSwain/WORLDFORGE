import { EntityEditPage } from "@/components/entities/entity-edit-pages";

export default async function Page(props: PageProps<"/worlds/[worldId]/entities/[entityId]/edit">) {
  const { worldId, entityId } = await props.params;
  return <EntityEditPage worldId={worldId} entityId={entityId} />;
}
