import { DirectoryPage } from "@/components/entities/directory-page";

export const metadata = { title: "Characters" };

export default async function Page(props: PageProps<"/worlds/[worldId]/characters">) {
  const { worldId } = await props.params;
  return <DirectoryPage worldId={worldId} type={"CHARACTER"} route="characters" searchParams={await props.searchParams} />;
}
