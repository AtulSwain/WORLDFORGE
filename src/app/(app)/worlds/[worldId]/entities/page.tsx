import { DirectoryPage } from "@/components/entities/directory-page";

export const metadata = { title: "Other entities" };

export default async function Page(props: PageProps<"/worlds/[worldId]/entities">) {
  const { worldId } = await props.params;
  return <DirectoryPage worldId={worldId} type={null} route="entities" searchParams={await props.searchParams} />;
}
