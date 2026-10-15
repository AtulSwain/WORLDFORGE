import { redirect } from "next/navigation";
import { getWorldContext, pickTimeline } from "@/server/page-context";
import { PageHeader } from "@/components/ui/misc";
import { EventForm } from "@/components/events/event-form";
import { eventFormData } from "@/components/events/event-form-data";

export const metadata = { title: "New event" };

export default async function NewEventPage(props: PageProps<"/worlds/[worldId]/events/new">) {
  const { worldId } = await props.params;
  const sp = await props.searchParams;
  const ctx = await getWorldContext(worldId);
  if (!ctx.can("content:write")) redirect(`/worlds/${worldId}/timeline`);
  const timeline = pickTimeline(ctx, sp.tl);
  const data = await eventFormData(ctx.user.id, worldId);
  const year = typeof sp.year === "string" ? sp.year : "";
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow={ctx.universe.name}
        title="Record a historical event"
        description={timeline.isMain ? "Events are added to the Prime Canon timeline." : `This event will exist only in the branch “${timeline.name}”.`}
      />
      <div className="mt-6">
        <EventForm worldId={worldId} calendar={ctx.calendar} timelineId={timeline.id} defaults={{ startYear: year }} {...data} />
      </div>
    </div>
  );
}
