import { EntityDetailPage } from "@/components/entities/entity-detail-page";

export default async function Page(props: PageProps<"/worlds/[worldId]/locations/[locationId]">) {
  const { worldId, locationId } = await props.params;
  return <EntityDetailPage worldId={worldId} entityId={locationId} expected={"LOCATION"} searchParams={await props.searchParams} />;
}
