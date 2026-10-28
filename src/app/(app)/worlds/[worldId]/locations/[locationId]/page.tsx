import { EntityDetailPage } from "@/components/entities/entity-detail-page";
import { entityMetadata } from "@/server/page-metadata";

export async function generateMetadata(props: PageProps<"/worlds/[worldId]/locations/[locationId]">) {
  const { worldId, locationId } = await props.params;
  return entityMetadata(worldId, locationId);
}

export default async function Page(props: PageProps<"/worlds/[worldId]/locations/[locationId]">) {
  const { worldId, locationId } = await props.params;
  return <EntityDetailPage worldId={worldId} entityId={locationId} expected={"LOCATION"} searchParams={await props.searchParams} />;
}
