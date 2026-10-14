import { EntityNewPage } from "@/components/entities/entity-edit-pages";

export default async function Page(props: PageProps<"/worlds/[worldId]/artifacts/new">) {
  const { worldId } = await props.params;
  const sp = await props.searchParams;
  return <EntityNewPage worldId={worldId} type={"ARTIFACT"} typeParam={typeof sp.type === "string" ? sp.type : undefined} />;
}
