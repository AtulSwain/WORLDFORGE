import { EntityDetailPage } from "@/components/entities/entity-detail-page";

export default async function Page(props: PageProps<"/worlds/[worldId]/characters/[characterId]">) {
  const { worldId, characterId } = await props.params;
  return <EntityDetailPage worldId={worldId} entityId={characterId} expected={"CHARACTER"} searchParams={await props.searchParams} />;
}
