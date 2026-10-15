import { EntityDetailPage } from "@/components/entities/entity-detail-page";
import { entityMetadata } from "@/server/page-metadata";

export async function generateMetadata(props: PageProps<"/worlds/[worldId]/characters/[characterId]">) {
  const { worldId, characterId } = await props.params;
  return entityMetadata(worldId, characterId);
}

export default async function Page(props: PageProps<"/worlds/[worldId]/characters/[characterId]">) {
  const { worldId, characterId } = await props.params;
  return <EntityDetailPage worldId={worldId} entityId={characterId} expected={"CHARACTER"} searchParams={await props.searchParams} />;
}
