import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db, type DbOrTx } from "../db";

export type RevisionRecordType = "ENTITY" | "EVENT" | "RELATIONSHIP" | "LORE";

export async function createRevision(
  client: DbOrTx,
  data: {
    universeId: string;
    recordType: RevisionRecordType;
    recordId: string;
    version: number;
    snapshot: object;
    summary: string;
    authorId: string | null;
    timelineId?: string | null;
  },
) {
  await client.revision.create({
    data: { ...data, snapshot: toJson(data.snapshot), timelineId: data.timelineId ?? null },
  });
}

export function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function listRevisions(universeId: string, recordType: RevisionRecordType, recordId: string) {
  return db.revision.findMany({
    where: { universeId, recordType, recordId },
    orderBy: { version: "desc" },
    take: 50,
    include: { author: { select: { name: true } } },
  });
}

/** Strips volatile columns so snapshots are comparable and restorable. */
export function entitySnapshot(e: {
  type: string; name: string; summary: string; description: string; status: string; beginYear: number | null;
  endYear: number | null; portrait: string | null; attributes: unknown; canonStatus: string; customTypeLabel: string | null;
}) {
  return {
    type: e.type, name: e.name, summary: e.summary, description: e.description, status: e.status,
    beginYear: e.beginYear, endYear: e.endYear, portrait: e.portrait, attributes: e.attributes,
    canonStatus: e.canonStatus, customTypeLabel: e.customTypeLabel,
  };
}

export function eventSnapshot(e: {
  title: string; description: string; eventType: string; startYear: number; startMonth: number | null; startDay: number | null;
  endYear: number | null; endMonth: number | null; endDay: number | null; precision: string; displayDate: string | null;
  importance: number; locationId: string | null; canonStatus: string;
}) {
  return {
    title: e.title, description: e.description, eventType: e.eventType, startYear: e.startYear, startMonth: e.startMonth,
    startDay: e.startDay, endYear: e.endYear, endMonth: e.endMonth, endDay: e.endDay, precision: e.precision,
    displayDate: e.displayDate, importance: e.importance, locationId: e.locationId, canonStatus: e.canonStatus,
  };
}

export function relationshipSnapshot(r: {
  sourceId: string; targetId: string; type: string; description: string; validFromYear: number | null; validToYear: number | null;
  originEventId: string | null; endEventId: string | null; canonStatus: string;
}) {
  return {
    sourceId: r.sourceId, targetId: r.targetId, type: r.type, description: r.description, validFromYear: r.validFromYear,
    validToYear: r.validToYear, originEventId: r.originEventId, endEventId: r.endEventId, canonStatus: r.canonStatus,
  };
}

export function loreSnapshot(d: { title: string; body: string; category: string; tags: string[]; canonStatus: string }) {
  return { title: d.title, body: d.body, category: d.category, tags: d.tags, canonStatus: d.canonStatus };
}
