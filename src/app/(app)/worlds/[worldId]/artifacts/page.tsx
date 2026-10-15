import { DirectoryPage } from "@/components/entities/directory-page";

export const metadata = { title: "Artifacts" };

export default async function Page(props: PageProps<"/worlds/[worldId]/artifacts">) {
  const { worldId } = await props.params;
  return <DirectoryPage worldId={worldId} type={"ARTIFACT"} route="artifacts" searchParams={await props.searchParams} />;
}
