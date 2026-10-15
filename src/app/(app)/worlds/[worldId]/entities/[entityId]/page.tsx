import { EntityDetailPage } from "@/components/entities/entity-detail-page";
import { entityMetadata } from "@/server/page-metadata";

export async function generateMetadata(props: PageProps<"/worlds/[worldId]/entities/[entityId]">) {
  const { worldId, entityId } = await props.params;
  return entityMetadata(worldId, entityId);
}

export default async function Page(props: PageProps<"/worlds/[worldId]/entities/[entityId]">) {
  const { worldId, entityId } = await props.params;
  return <EntityDetailPage worldId={worldId} entityId={entityId} expected={null} searchParams={await props.searchParams} />;
}
