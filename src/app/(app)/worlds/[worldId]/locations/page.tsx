import { DirectoryPage } from "@/components/entities/directory-page";

export const metadata = { title: "Locations" };

export default async function Page(props: PageProps<"/worlds/[worldId]/locations">) {
  const { worldId } = await props.params;
  return <DirectoryPage worldId={worldId} type={"LOCATION"} route="locations" searchParams={await props.searchParams} />;
}
