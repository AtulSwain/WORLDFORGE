import { EntityEditPage } from "@/components/entities/entity-edit-pages";

export default async function Page(props: PageProps<"/worlds/[worldId]/locations/[locationId]/edit">) {
  const { worldId, locationId } = await props.params;
  return <EntityEditPage worldId={worldId} entityId={locationId} />;
}
