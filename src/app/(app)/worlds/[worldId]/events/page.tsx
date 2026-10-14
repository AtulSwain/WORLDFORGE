import { redirect } from "next/navigation";

export default async function EventsIndex(props: PageProps<"/worlds/[worldId]/events">) {
  const { worldId } = await props.params;
  redirect(`/worlds/${worldId}/timeline`);
}
