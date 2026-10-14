import { EntityDetailPage } from "@/components/entities/entity-detail-page";

export default async function Page(props: PageProps<"/worlds/[worldId]/factions/[factionId]">) {
  const { worldId, factionId } = await props.params;
  return <EntityDetailPage worldId={worldId} entityId={factionId} expected={"FACTION"} searchParams={await props.searchParams} />;
}
