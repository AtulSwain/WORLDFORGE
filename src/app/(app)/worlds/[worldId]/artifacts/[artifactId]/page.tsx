import { EntityDetailPage } from "@/components/entities/entity-detail-page";
import { entityMetadata } from "@/server/page-metadata";

export async function generateMetadata(props: PageProps<"/worlds/[worldId]/artifacts/[artifactId]">) {
  const { worldId, artifactId } = await props.params;
  return entityMetadata(worldId, artifactId);
}

export default async function Page(props: PageProps<"/worlds/[worldId]/artifacts/[artifactId]">) {
  const { worldId, artifactId } = await props.params;
  return <EntityDetailPage worldId={worldId} entityId={artifactId} expected={"ARTIFACT"} searchParams={await props.searchParams} />;
}
