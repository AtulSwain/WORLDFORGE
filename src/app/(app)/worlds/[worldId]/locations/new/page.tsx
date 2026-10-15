import { EntityNewPage } from "@/components/entities/entity-edit-pages";
import { newEntityMetadata } from "@/server/page-metadata";

export const metadata = newEntityMetadata("LOCATION");

export default async function Page(props: PageProps<"/worlds/[worldId]/locations/new">) {
  const { worldId } = await props.params;
  const sp = await props.searchParams;
  return <EntityNewPage worldId={worldId} type={"LOCATION"} typeParam={typeof sp.type === "string" ? sp.type : undefined} />;
}
