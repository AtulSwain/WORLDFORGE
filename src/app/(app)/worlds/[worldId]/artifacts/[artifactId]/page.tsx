import { EntityDetailPage } from "@/components/entities/entity-detail-page";

export default async function Page(props: PageProps<"/worlds/[worldId]/artifacts/[artifactId]">) {
  const { worldId, artifactId } = await props.params;
  return <EntityDetailPage worldId={worldId} entityId={artifactId} expected={"ARTIFACT"} searchParams={await props.searchParams} />;
}
