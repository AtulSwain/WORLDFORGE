import Link from "next/link";
import { redirect } from "next/navigation";
import { getWorldContext, guard } from "@/server/page-context";
import { getEvent } from "@/server/services/events";
import { PageHeader } from "@/components/ui/misc";
import { EventForm } from "@/components/events/event-form";
import { eventFormData } from "@/components/events/event-form-data";
import type { DatePrecision } from "@/domain/chronology";
import { eventMetadata } from "@/server/page-metadata";

export async function generateMetadata(props: PageProps<"/worlds/[worldId]/events/[eventId]/edit">) {
  const { worldId, eventId } = await props.params;
  return eventMetadata(worldId, eventId, "Edit");
}

export default async function EditEventPage(props: PageProps<"/worlds/[worldId]/events/[eventId]/edit">) {
  const { worldId, eventId } = await props.params;
  const ctx = await getWorldContext(worldId);
  if (!ctx.can("content:write")) redirect(`/worlds/${worldId}/events/${eventId}`);
  const [{ event: e }, data] = await Promise.all([guard(() => getEvent(ctx.user.id, worldId, eventId)), eventFormData(ctx.user.id, worldId)]);
  const s = (n: number | null) => (n == null ? "" : String(n));
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader eyebrow={<Link href={`/worlds/${worldId}/events/${e.id}`} className="hover:text-text">← Back to event</Link>} title={`Edit “${e.title}”`} description={`Version ${e.version}. Every save is kept in revision history.`} />
      <div className="mt-6">
        <EventForm
          worldId={worldId}
          calendar={ctx.calendar}
          {...data}
          events={data.events.filter((x) => x.id !== e.id)}
          initial={{
            id: e.id, version: e.version, title: e.title, description: e.description, eventType: e.eventType, precision: e.precision as DatePrecision,
            startYear: s(e.startYear), startMonth: s(e.startMonth), startDay: s(e.startDay), endYear: s(e.endYear), endMonth: s(e.endMonth), endDay: s(e.endDay),
            displayDate: e.displayDate ?? "", importance: e.importance, locationId: e.locationId, canonStatus: e.canonStatus,
            participants: e.participants.map((p) => ({ entityId: p.entityId, role: p.role })),
          }}
        />
      </div>
    </div>
  );
}
