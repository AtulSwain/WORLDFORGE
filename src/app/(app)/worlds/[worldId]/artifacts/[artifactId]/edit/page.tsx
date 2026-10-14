import { EntityEditPage } from "@/components/entities/entity-edit-pages";

export default async function Page(props: PageProps<"/worlds/[worldId]/artifacts/[artifactId]/edit">) {
  const { worldId, artifactId } = await props.params;
  return <EntityEditPage worldId={worldId} entityId={artifactId} />;
}
