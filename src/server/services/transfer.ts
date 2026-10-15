import "server-only";
import { randomUUID } from "node:crypto";
import { strToU8, zipSync } from "fflate";
import type { Genre } from "@/generated/prisma/client";
import { eventOrdinals, formatEventDate } from "@/domain/chronology";
import { calendarSchema, parseSettings } from "@/domain/schemas";
import { relationshipMeta } from "@/domain/catalog";
import {
  EXPORT_FORMAT,
  EXPORT_VERSION,
  declaredIds,
  remapIds,
  toCsv,
  validateExport,
  type ImportIssue,
  type UniverseExport,
} from "@/domain/transfer";
import { slugify } from "@/lib/slug";
import { db } from "../db";
import { requireAccess } from "./access";
import { audit, recordActivity } from "./activity";
import { toJson } from "./revisions";
import { DEFAULT_MAP, uniqueUniverseSlug } from "./universes";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** Builds the canonical JSON export (format version 1). Requires the export capability. */
export async function buildExport(userId: string, universeId: string): Promise<UniverseExport> {
  await requireAccess(userId, universeId, "export");
  const where = { universeId };
  const [u, timelines, relTypes, entities, relationships, events, dependencies, changes, lore, maps, assets] = await Promise.all([
    db.universe.findUniqueOrThrow({ where: { id: universeId } }),
    db.timeline.findMany({ where, orderBy: [{ isMain: "desc" }, { createdAt: "asc" }] }),
    db.relationshipTypeDef.findMany({ where, orderBy: { key: "asc" } }),
    db.entity.findMany({ where, orderBy: [{ type: "asc" }, { name: "asc" }] }),
    db.relationship.findMany({ where, orderBy: { createdAt: "asc" } }),
    db.historicalEvent.findMany({ where, orderBy: { startOrdinal: "asc" }, include: { participants: { orderBy: { createdAt: "asc" } } } }),
    db.eventDependency.findMany({ where, orderBy: { createdAt: "asc" } }),
    // Only live overlays define alternate-timeline state; applied or reverted changes are history.
    db.timelineChange.findMany({ where: { universeId, appliedToBase: false, status: "ACCEPTED" }, orderBy: { createdAt: "asc" } }),
    db.loreDocument.findMany({ where, orderBy: { title: "asc" }, include: { links: true } }),
    db.worldMap.findMany({ where, orderBy: { createdAt: "asc" }, include: { placements: true, routes: true, regions: true } }),
    db.mediaAsset.findMany({ where: { universeId, archivedAt: null }, orderBy: { createdAt: "asc" } }),
  ]);

  const recordIds = { ENTITY: new Set(entities.map((e) => e.id)), EVENT: new Set(events.map((e) => e.id)), RELATIONSHIP: new Set(relationships.map((r) => r.id)) };
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    universe: {
      name: u.name,
      description: u.description,
      genre: u.genre,
      customGenre: u.customGenre,
      tone: u.tone,
      mainConflict: u.mainConflict,
      timePeriod: u.timePeriod,
      coreRules: u.coreRules,
      currentEra: u.currentEra,
      calendar: u.calendar,
      settings: u.settings,
      defaultTimelineId: u.defaultTimelineId,
    },
    timelines: timelines.map((t) => ({ id: t.id, name: t.name, description: t.description, isMain: t.isMain, parentId: t.parentId, branchEventId: t.branchEventId, status: t.status })),
    relationshipTypes: relTypes.map((t) => ({ key: t.key, label: t.label, inverse: t.inverse })),
    entities: entities.map((e) => ({
      id: e.id, timelineId: e.timelineId, type: e.type, customTypeLabel: e.customTypeLabel, name: e.name, slug: e.slug, summary: e.summary,
      description: e.description, status: e.status, beginYear: e.beginYear, endYear: e.endYear,
      // Portraits served from this instance's asset store cannot travel with the file.
      portrait: e.portrait?.startsWith("/api/assets/") ? null : e.portrait,
      attributes: (e.attributes ?? {}) as Record<string, unknown>, canonStatus: e.canonStatus, archivedAt: iso(e.archivedAt),
    })),
    relationships: relationships.map((r) => ({
      id: r.id, timelineId: r.timelineId, sourceId: r.sourceId, targetId: r.targetId, type: r.type, description: r.description,
      validFromYear: r.validFromYear, validToYear: r.validToYear, originEventId: r.originEventId, endEventId: r.endEventId,
      canonStatus: r.canonStatus, archivedAt: iso(r.archivedAt),
    })),
    events: events.map((e) => ({
      id: e.id, timelineId: e.timelineId, title: e.title, slug: e.slug, description: e.description, eventType: e.eventType,
      startYear: e.startYear, startMonth: e.startMonth, startDay: e.startDay, endYear: e.endYear, endMonth: e.endMonth, endDay: e.endDay,
      precision: e.precision, displayDate: e.displayDate, importance: e.importance, locationId: e.locationId, canonStatus: e.canonStatus,
      archivedAt: iso(e.archivedAt), participants: e.participants.map((p) => ({ entityId: p.entityId, role: p.role, note: p.note })),
    })),
    dependencies: dependencies.map((d) => ({ id: d.id, timelineId: d.timelineId, sourceId: d.sourceId, targetId: d.targetId, type: d.type, note: d.note })),
    changes: changes
      .filter((c) => recordIds[c.targetType].has(c.targetId))
      .map((c) => ({
        id: c.id, timelineId: c.timelineId, targetType: c.targetType, targetId: c.targetId, changeType: c.changeType,
        previousState: c.previousState, proposedState: c.proposedState,
        sourceEventId: c.sourceEventId && recordIds.EVENT.has(c.sourceEventId) ? c.sourceEventId : null, reason: c.reason,
      })),
    lore: lore.map((d) => ({
      id: d.id, title: d.title, slug: d.slug, body: d.body, category: d.category, tags: d.tags, canonStatus: d.canonStatus,
      archivedAt: iso(d.archivedAt), links: d.links.map((l) => ({ entityId: l.entityId, eventId: l.eventId })),
    })),
    maps: maps.map((m) => ({
      id: m.id, title: m.title, mapType: m.mapType, coordinateSystem: m.coordinateSystem, imageSource: m.imageSource,
      width: m.width, height: m.height, layerConfig: m.layerConfig, defaultViewport: m.defaultViewport, isDefault: m.isDefault,
      placements: m.placements.map((p) => ({ entityId: p.entityId, x: p.x, y: p.y })),
      routes: m.routes.map((r) => ({ name: r.name, kind: r.kind, points: r.points as [number, number][] })),
      regions: m.regions.map((r) => ({ name: r.name, factionId: r.factionId, color: r.color, polygon: r.polygon as [number, number][] })),
    })),
    assets: assets.map((a) => ({ id: a.id, kind: a.kind, filename: a.filename, mimeType: a.mimeType, sizeBytes: a.sizeBytes, altText: a.altText })),
  };
}

function frontMatter(fields: Record<string, unknown>): string {
  const lines = Object.entries(fields)
    .filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  return `---\n${lines.join("\n")}\n---\n\n`;
}

function safeName(s: string, fallback: string) {
  return (slugify(s) || fallback).slice(0, 80);
}

/**
 * Builds the zip bundle: the canonical universe.json plus human-friendly projections
 * (Markdown lore and character sheets, timeline CSV/JSON, relationship CSV, asset manifest).
 */
export async function buildExportZip(userId: string, universeId: string): Promise<{ filename: string; bytes: Uint8Array }> {
  const data = await buildExport(userId, universeId);
  const calendar = calendarSchema.parse(data.universe.calendar ?? {});
  const main = data.timelines.find((t) => t.isMain)!;
  const entityName = new Map((data.entities ?? []).map((e) => [e.id, e.name]));
  const files: Record<string, Uint8Array> = {};
  const put = (path: string, content: string) => (files[path] = strToU8(content));

  put("universe.json", JSON.stringify(data, null, 2));
  put(
    "README.md",
    `# ${data.universe.name}\n\nExported from WorldForge on ${data.exportedAt}.\n\n` +
      `- \`universe.json\` — the complete universe (format \`${EXPORT_FORMAT}\`, version ${EXPORT_VERSION}). Import this file to recreate the universe.\n` +
      `- \`lore/\` — lore documents as Markdown.\n- \`characters/\` — character sheets as Markdown.\n` +
      `- \`timeline.csv\`, \`timeline.json\` — canon events in chronological order.\n- \`relationships.csv\` — canon relationships.\n` +
      `- \`assets/manifest.json\` — uploaded files (binary contents are not included; re-upload them after import).\n`,
  );

  const usedNames = new Set<string>();
  const unique = (base: string) => {
    let n = base, i = 2;
    while (usedNames.has(n)) n = `${base}-${i++}`;
    usedNames.add(n);
    return n;
  };
  for (const d of data.lore ?? []) {
    if (d.archivedAt) continue;
    put(`lore/${unique(`lore/${safeName(d.slug, d.id)}`).slice(5)}.md`, frontMatter({ title: d.title, category: d.category, tags: d.tags, canon: d.canonStatus }) + `# ${d.title}\n\n${d.body ?? ""}\n`);
  }
  for (const c of (data.entities ?? []).filter((e) => e.type === "CHARACTER" && !e.archivedAt && e.timelineId === main.id)) {
    const rels = (data.relationships ?? []).filter((r) => !r.archivedAt && r.timelineId === main.id && (r.sourceId === c.id || r.targetId === c.id));
    const attrs = Object.entries(c.attributes ?? {}).filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0));
    const body =
      `# ${c.name}\n\n${c.summary ? `_${c.summary}_\n\n` : ""}` +
      (attrs.length ? `## Details\n\n${attrs.map(([k, v]) => `- **${k}:** ${Array.isArray(v) ? v.join(", ") : String(v)}`).join("\n")}\n\n` : "") +
      (c.description ? `## Biography\n\n${c.description}\n\n` : "") +
      (rels.length
        ? `## Relationships\n\n${rels.map((r) => `- ${relationshipMeta(r.type).label}: ${entityName.get(r.sourceId === c.id ? r.targetId : r.sourceId) ?? "?"}${r.sourceId === c.id ? "" : " (inverse)"}`).join("\n")}\n`
        : "");
    put(`characters/${unique(`characters/${safeName(c.slug, c.id)}`).slice(11)}.md`, frontMatter({ name: c.name, status: c.status, born: c.beginYear, died: c.endYear, canon: c.canonStatus }) + body);
  }

  const canonEvents = (data.events ?? []).filter((e) => !e.archivedAt && e.timelineId === main.id);
  const withDates = canonEvents.map((e) => ({
    ...e,
    date: formatEventDate({ startYear: e.startYear, startMonth: e.startMonth ?? null, startDay: e.startDay ?? null, endYear: e.endYear ?? null, endMonth: e.endMonth ?? null, endDay: e.endDay ?? null, precision: e.precision ?? "YEAR", displayDate: e.displayDate ?? null }, calendar),
  }));
  put(
    "timeline.csv",
    toCsv(
      ["id", "title", "date", "start_year", "start_month", "start_day", "end_year", "precision", "type", "importance", "location", "participants", "canon_status"],
      withDates.map((e) => [
        e.id, e.title, e.date, e.startYear, e.startMonth, e.startDay, e.endYear, e.precision, e.eventType, e.importance,
        e.locationId ? entityName.get(e.locationId) : "", (e.participants ?? []).map((p) => entityName.get(p.entityId)).join("; "), e.canonStatus,
      ]),
    ),
  );
  put(
    "timeline.json",
    JSON.stringify(
      withDates.map((e) => ({ id: e.id, title: e.title, date: e.date, startYear: e.startYear, endYear: e.endYear ?? null, type: e.eventType, location: e.locationId ? entityName.get(e.locationId) : null, participants: (e.participants ?? []).map((p) => ({ name: entityName.get(p.entityId), role: p.role })) })),
      null,
      2,
    ),
  );
  put(
    "relationships.csv",
    toCsv(
      ["id", "source", "type", "target", "valid_from", "valid_to", "description", "canon_status"],
      (data.relationships ?? [])
        .filter((r) => !r.archivedAt && r.timelineId === main.id)
        .map((r) => [r.id, entityName.get(r.sourceId), relationshipMeta(r.type).label, entityName.get(r.targetId), r.validFromYear, r.validToYear, r.description, r.canonStatus]),
    ),
  );
  put("assets/manifest.json", JSON.stringify(data.assets ?? [], null, 2));

  const bytes = zipSync(files, { level: 6, mtime: new Date() });
  return { filename: `${safeName(data.universe.name, "universe")}-worldforge.zip`, bytes };
}

export type ImportResult =
  | { ok: true; universeId: string; counts: Record<string, number>; warnings: string[] }
  | { ok: false; issues: ImportIssue[] };

/**
 * Imports an export file as a brand-new universe owned by the caller. The file is fully
 * validated first; nothing is written unless every check passes, and the write is atomic.
 */
export async function importUniverse(userId: string, raw: unknown, opts: { name?: string } = {}): Promise<ImportResult> {
  const v = validateExport(raw);
  if (!v.ok) return { ok: false, issues: v.issues };
  const src: UniverseExport = v.data;
  const ids = new Map(declaredIds(src).map((id) => [id, randomUUID()]));
  const d = remapIds(src, ids);
  const warnings: string[] = [];
  if (d.assets.length) warnings.push(`${d.assets.length} uploaded file(s) are listed in the manifest but not included; re-upload them in the asset library.`);

  const name = (opts.name?.trim() || d.universe.name).slice(0, 120);
  const slug = await uniqueUniverseSlug(name);
  const universeId = randomUUID();
  const calendar = calendarSchema.safeParse(d.universe.calendar ?? {});
  if (!calendar.success) warnings.push("The calendar settings were invalid and have been reset to defaults.");

  await db.$transaction(
    async (tx) => {
      await tx.universe.create({
        data: {
          id: universeId, ownerId: userId, name, slug, description: d.universe.description, genre: d.universe.genre as Genre,
          customGenre: d.universe.customGenre, tone: d.universe.tone, mainConflict: d.universe.mainConflict, timePeriod: d.universe.timePeriod,
          coreRules: d.universe.coreRules, currentEra: d.universe.currentEra,
          calendar: toJson(calendar.success ? calendar.data : calendarSchema.parse({})),
          settings: toJson(parseSettings(d.universe.settings)),
          members: { create: { userId, role: "OWNER" } },
        },
      });
      // Timelines first without links (parents and branch points are wired after their targets exist).
      await tx.timeline.createMany({
        data: d.timelines.map((t) => ({ id: t.id, universeId, name: t.name, description: t.description, isMain: t.isMain, status: t.status })),
      });
      for (const t of d.timelines) if (t.parentId) await tx.timeline.update({ where: { id: t.id }, data: { parentId: t.parentId } });
      if (d.relationshipTypes.length) {
        await tx.relationshipTypeDef.createMany({ data: d.relationshipTypes.map((t) => ({ universeId, key: t.key, label: t.label, inverse: t.inverse })) });
      }
      await tx.entity.createMany({
        data: d.entities.map((e) => ({
          id: e.id, universeId, timelineId: e.timelineId, type: e.type, customTypeLabel: e.customTypeLabel, name: e.name, slug: e.slug,
          summary: e.summary, description: e.description, status: e.status, beginYear: e.beginYear, endYear: e.endYear,
          portrait: e.portrait, attributes: toJson(e.attributes), canonStatus: e.canonStatus, createdById: userId,
          archivedAt: e.archivedAt ? new Date(e.archivedAt) : null,
        })),
      });
      await tx.historicalEvent.createMany({
        data: d.events.map((e) => ({
          id: e.id, universeId, timelineId: e.timelineId, title: e.title, slug: e.slug, description: e.description, eventType: e.eventType,
          startYear: e.startYear, startMonth: e.startMonth, startDay: e.startDay, endYear: e.endYear, endMonth: e.endMonth, endDay: e.endDay,
          ...eventOrdinals(e), precision: e.precision, displayDate: e.displayDate, importance: e.importance, locationId: e.locationId,
          canonStatus: e.canonStatus, createdById: userId, archivedAt: e.archivedAt ? new Date(e.archivedAt) : null,
        })),
      });
      // Participants: de-duplicate (event, entity, role) so a hand-edited file cannot trip the unique index.
      const seen = new Set<string>();
      const participants = d.events.flatMap((e) =>
        e.participants
          .filter((p) => {
            const k = `${e.id}|${p.entityId}|${p.role}`;
            return seen.has(k) ? false : (seen.add(k), true);
          })
          .map((p) => ({ eventId: e.id, entityId: p.entityId, role: p.role, note: p.note })),
      );
      if (participants.length) await tx.eventParticipant.createMany({ data: participants });
      for (const t of d.timelines) if (t.branchEventId) await tx.timeline.update({ where: { id: t.id }, data: { branchEventId: t.branchEventId } });
      if (d.relationships.length) {
        await tx.relationship.createMany({
          data: d.relationships.map((r) => ({
            id: r.id, universeId, timelineId: r.timelineId, sourceId: r.sourceId, targetId: r.targetId, type: r.type, description: r.description,
            validFromYear: r.validFromYear, validToYear: r.validToYear, originEventId: r.originEventId, endEventId: r.endEventId,
            canonStatus: r.canonStatus, createdById: userId, archivedAt: r.archivedAt ? new Date(r.archivedAt) : null,
          })),
        });
      }
      if (d.dependencies.length) {
        await tx.eventDependency.createMany({
          data: d.dependencies.map((x) => ({ id: x.id, universeId, timelineId: x.timelineId, sourceId: x.sourceId, targetId: x.targetId, type: x.type, note: x.note })),
          skipDuplicates: true,
        });
      }
      if (d.changes.length) {
        await tx.timelineChange.createMany({
          data: d.changes.map((c) => ({
            id: c.id, universeId, timelineId: c.timelineId, targetType: c.targetType, targetId: c.targetId, changeType: c.changeType,
            previousState: c.previousState == null ? undefined : toJson(c.previousState),
            proposedState: c.proposedState == null ? undefined : toJson(c.proposedState),
            appliedToBase: false, status: "ACCEPTED", sourceEventId: c.sourceEventId, reason: c.reason, authorId: userId,
          })),
        });
      }
      for (const doc of d.lore) {
        await tx.loreDocument.create({
          data: {
            id: doc.id, universeId, title: doc.title, slug: doc.slug, body: doc.body, category: doc.category, tags: doc.tags,
            canonStatus: doc.canonStatus, authorId: userId, archivedAt: doc.archivedAt ? new Date(doc.archivedAt) : null,
            links: { createMany: { data: doc.links.map((l) => ({ entityId: l.entityId, eventId: l.eventId })), skipDuplicates: true } },
          },
        });
      }
      const maps = d.maps.length ? d.maps : [{ id: randomUUID(), ...DEFAULT_MAP, mapType: "IMAGE", coordinateSystem: "IMAGE_PIXELS", layerConfig: {}, defaultViewport: {}, isDefault: true, placements: [], routes: [], regions: [] }];
      for (const m of maps) {
        // Only bundled artwork can be referenced across installations.
        const portable = m.imageSource.startsWith("/maps/") || m.imageSource.startsWith("/art/");
        if (!portable) warnings.push(`Map “${m.title}” used an uploaded image; it now shows the default parchment until you choose a new image.`);
        await tx.worldMap.create({
          data: {
            id: m.id, universeId, title: m.title, mapType: m.mapType, coordinateSystem: m.coordinateSystem,
            imageSource: portable ? m.imageSource : DEFAULT_MAP.imageSource, width: m.width, height: m.height,
            layerConfig: toJson(m.layerConfig ?? {}), defaultViewport: toJson(m.defaultViewport ?? {}), isDefault: m.isDefault,
            placements: { createMany: { data: m.placements.map((p) => ({ entityId: p.entityId, x: p.x, y: p.y })), skipDuplicates: true } },
            routes: { createMany: { data: m.routes.map((r) => ({ name: r.name, kind: r.kind, points: toJson(r.points) })) } },
            regions: { createMany: { data: m.regions.map((r) => ({ name: r.name, factionId: r.factionId, color: r.color, polygon: toJson(r.polygon) })) } },
          },
        });
      }
      const mainId = d.timelines.find((t) => t.isMain)!.id;
      await tx.universe.update({ where: { id: universeId }, data: { defaultTimelineId: d.universe.defaultTimelineId ?? mainId } });
      await recordActivity(tx, { universeId, actorId: userId, action: "universe.imported", targetType: "UNIVERSE", targetId: universeId, summary: `Imported “${name}”` });
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
  await audit({ userId, universeId, action: "universe.import", metadata: { entities: d.entities.length, events: d.events.length } });
  return {
    ok: true,
    universeId,
    counts: {
      timelines: d.timelines.length, entities: d.entities.length, relationships: d.relationships.length, events: d.events.length,
      dependencies: d.dependencies.length, lore: d.lore.length, maps: d.maps.length,
    },
    warnings,
  };
}
