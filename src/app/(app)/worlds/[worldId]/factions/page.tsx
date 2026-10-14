import { DirectoryPage } from "@/components/entities/directory-page";

export const metadata = { title: "Factions" };

export default async function Page(props: PageProps<"/worlds/[worldId]/factions">) {
  const { worldId } = await props.params;
  return <DirectoryPage worldId={worldId} type={"FACTION"} route="factions" searchParams={await props.searchParams} />;
}
