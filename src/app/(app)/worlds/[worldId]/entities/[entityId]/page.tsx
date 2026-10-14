import { EntityDetailPage } from "@/components/entities/entity-detail-page";

export default async function Page(props: PageProps<"/worlds/[worldId]/entities/[entityId]">) {
  const { worldId, entityId } = await props.params;
  return <EntityDetailPage worldId={worldId} entityId={entityId} expected={null} searchParams={await props.searchParams} />;
}
