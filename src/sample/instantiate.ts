import { randomUUID } from "node:crypto";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import { eventOrdinals } from "@/domain/chronology";
import { universeSettingsSchema, ATTRIBUTE_SCHEMAS } from "@/domain/schemas";
import { slugify, uniqueSlug } from "@/lib/slug";
import { BRANCH, CALENDAR, DEPENDENCIES, ENTITIES, EVENTS, LORE, MAP, PROPOSAL, RELATIONSHIPS, UNIVERSE } from "./ashen-crown";

/**
 * Writes a complete copy of The Ashen Crown for `ownerId` in one transaction.
 * Deliberately free of `server-only` imports so the seed script and tests can use it.
 */
export async function instantiateSampleUniverse(
  client: PrismaClient,
  ownerId: string,
  opts: { name?: string; isSample?: boolean } = {},
): Promise<string> {
  const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
  const ids = new Map<string, string>();
  const idOf = (key: string) => {
    let id = ids.get(key);
    if (!id) {
      id = randomUUID();
      ids.set(key, id);
    }
    return id;
  };
  const need = (key: string) => {
    if (!ids.has(key)) throw new Error(`Sample data references unknown key “${key}”.`);
    return ids.get(key)!;
  };

  const universeId = randomUUID();
  const mainId = randomUUID();
  const branchId = randomUUID();
  const name = opts.name ?? UNIVERSE.name;
  const baseSlug = slugify(name);
  const taken = await client.universe.findMany({ where: { slug: { startsWith: baseSlug } }, select: { slug: true } });
  const slug = uniqueSlug(baseSlug, taken.map((t) => t.slug));

  for (const e of ENTITIES) idOf(e.key);
  for (const e of EVENTS) idOf(e.key);

  await client.$transaction(
    async (tx) => {
      await tx.universe.create({
        data: {
          id: universeId,
          ownerId,
          name,
          slug,
          description: UNIVERSE.description,
          genre: UNIVERSE.genre,
          tone: UNIVERSE.tone,
          mainConflict: UNIVERSE.mainConflict,
          timePeriod: UNIVERSE.timePeriod,
          coreRules: UNIVERSE.coreRules,
          currentEra: UNIVERSE.currentEra,
          coverImage: "/art/ashen-crown-cover.svg",
          calendar: json(CALENDAR),
          settings: json(universeSettingsSchema.parse({ minTravelDays: 3 })),
          isSample: opts.isSample ?? false,
          members: { create: { userId: ownerId, role: "OWNER" } },
        },
      });
      await tx.timeline.create({
        data: { id: mainId, universeId, name: "Prime Canon", description: "The authoritative history of the Western Reaches.", isMain: true, version: 1 },
      });
      await tx.universe.update({ where: { id: universeId }, data: { defaultTimelineId: mainId } });

      // Entities
      const usedSlugs: string[] = [];
      const entityRows = ENTITIES.map((e) => {
        const s = uniqueSlug(slugify(e.name), usedSlugs);
        usedSlugs.push(s);
        return {
          id: need(e.key),
          universeId,
          timelineId: mainId,
          type: e.type,
          name: e.name,
          slug: s,
          summary: e.summary,
          description: e.description ?? "",
          status: e.status,
          beginYear: e.beginYear ?? null,
          endYear: e.endYear ?? null,
          attributes: json(ATTRIBUTE_SCHEMAS[e.type].parse(e.attributes ?? {})),
          createdById: ownerId,
        };
      });
      await tx.entity.createMany({ data: entityRows });

      // Events
      const eventSlugs: string[] = [];
      const eventRows = EVENTS.map((e) => {
        const [sy, sm, sd] = e.start;
        const [ey, em, ed] = e.end ?? [];
        const dates = { startYear: sy, startMonth: sm ?? null, startDay: sd ?? null, endYear: ey ?? null, endMonth: em ?? null, endDay: ed ?? null };
        const s = uniqueSlug(slugify(e.title), eventSlugs);
        eventSlugs.push(s);
        return {
          id: need(e.key),
          universeId,
          timelineId: mainId,
          title: e.title,
          slug: s,
          description: e.description,
          eventType: e.eventType,
          ...dates,
          ...eventOrdinals(dates),
          precision: e.precision,
          importance: e.importance,
          locationId: e.location ? need(e.location) : null,
          createdById: ownerId,
        };
      });
      await tx.historicalEvent.createMany({ data: eventRows });
      await tx.eventParticipant.createMany({
        data: EVENTS.flatMap((e) =>
          (e.participants ?? []).map(([key, role]) => ({ eventId: need(e.key), entityId: need(key), role: role as never })),
        ),
      });
      await tx.eventDependency.createMany({
        data: DEPENDENCIES.map(([s, type, t]) => ({ universeId, timelineId: mainId, sourceId: need(s), targetId: need(t), type })),
      });

      // Relationships
      const relIds = new Map<string, string>();
      const relRows = RELATIONSHIPS.map((r) => {
        const id = randomUUID();
        relIds.set(`${r.source}:${r.type}:${r.target}`, id);
        return {
          id,
          universeId,
          timelineId: mainId,
          sourceId: need(r.source),
          targetId: need(r.target),
          type: r.type,
          description: r.description ?? "",
          validFromYear: r.from ?? null,
          validToYear: r.to ?? null,
          originEventId: r.origin ? need(r.origin) : null,
          endEventId: r.end ? need(r.end) : null,
          createdById: ownerId,
        };
      });
      await tx.relationship.createMany({ data: relRows });

      // Revisions (version 1 snapshot for every seeded record)
      await tx.revision.createMany({
        data: [
          ...entityRows.map((e) => ({ universeId, recordType: "ENTITY", recordId: e.id, version: 1, snapshot: json(e), summary: "Created from template", authorId: ownerId, timelineId: mainId })),
          ...eventRows.map((e) => ({ universeId, recordType: "EVENT", recordId: e.id, version: 1, snapshot: json(e), summary: "Created from template", authorId: ownerId, timelineId: mainId })),
        ],
      });

      // Lore
      for (const doc of LORE) {
        const docId = randomUUID();
        await tx.loreDocument.create({
          data: {
            id: docId,
            universeId,
            title: doc.title,
            slug: slugify(doc.title),
            body: doc.body,
            category: doc.category,
            tags: doc.tags,
            authorId: ownerId,
            links: {
              create: [
                ...doc.entities.map((k) => ({ entityId: need(k) })),
                ...doc.events.map((k) => ({ eventId: need(k) })),
              ],
            },
          },
        });
        await tx.revision.create({
          data: { universeId, recordType: "LORE", recordId: docId, version: 1, snapshot: json({ title: doc.title, body: doc.body, category: doc.category, tags: doc.tags, canonStatus: "CANON" }), summary: "Created from template", authorId: ownerId },
        });
      }

      // Atlas
      const mapId = randomUUID();
      await tx.worldMap.create({
        data: {
          id: mapId,
          universeId,
          title: MAP.title,
          imageSource: MAP.imageSource,
          width: MAP.width,
          height: MAP.height,
          isDefault: true,
          layerConfig: { markers: true, routes: true, regions: true, labels: true },
          defaultViewport: { x: MAP.width / 2, y: MAP.height / 2, zoom: 0.55 },
          placements: { create: ENTITIES.filter((e) => e.map).map((e) => ({ entityId: need(e.key), x: e.map![0], y: e.map![1] })) },
          routes: { create: MAP.routes.map((r) => ({ name: r.name, kind: r.kind, points: r.points })) },
          regions: { create: MAP.regions.map((r) => ({ name: r.name, factionId: need(r.faction), color: r.color, polygon: r.polygon })) },
        },
      });

      // Alternate timeline: The Red Thaw — overlays only, the canon rows are untouched.
      await tx.timeline.create({
        data: { id: branchId, universeId, name: BRANCH.name, description: BRANCH.description, parentId: mainId, branchEventId: need(BRANCH.branchEvent), version: 1 },
      });
      const rel = (k: string) => {
        const id = relIds.get(k);
        if (!id) throw new Error(`Unknown sample relationship ${k}`);
        return id;
      };
      const overlays: { targetType: "EVENT" | "ENTITY" | "RELATIONSHIP"; targetId: string; changeType: "UPDATE" | "DELETE"; prev: object; next: object | null; reason: string }[] = [
        { targetType: "EVENT", targetId: need("assassination"), changeType: "UPDATE", prev: { startYear: 851, startMonth: 11, startDay: 3 }, next: { startYear: 835, startMonth: 3, startDay: 1 }, reason: "Point of divergence: Aldren is murdered as a boy-prince." },
        { targetType: "ENTITY", targetId: need("aldren"), changeType: "UPDATE", prev: { status: "DECEASED", endYear: 851 }, next: { status: "DECEASED", endYear: 835 }, reason: "Victim of the assassination." },
        { targetType: "EVENT", targetId: need("thornwall_battle"), changeType: "UPDATE", prev: { canonStatus: "CANON" }, next: { canonStatus: "DISPUTED" }, reason: "Aldren cannot fight at Thornwall." },
        { targetType: "EVENT", targetId: need("treaty"), changeType: "UPDATE", prev: { canonStatus: "CANON", description: EVENTS.find((e) => e.key === "treaty")!.description }, next: { canonStatus: "DISPUTED", description: "With Aldren dead, King Oswin sends Ysolde, aged twenty-one, to sign the Concord. Whether Maren accepts a princess's seal is still debated." }, reason: "Aldren cannot sign the treaty." },
        { targetType: "EVENT", targetId: need("aldren_coronation"), changeType: "DELETE", prev: { title: "Coronation of Aldren Caldris" }, next: null, reason: "Aldren never reigns." },
        { targetType: "EVENT", targetId: need("royal_wedding"), changeType: "DELETE", prev: { title: "Marriage of Aldren and Lirien" }, next: null, reason: "The marriage never happens." },
        { targetType: "RELATIONSHIP", targetId: rel("aldren:RULES:veyr"), changeType: "DELETE", prev: { validFromYear: 846, validToYear: 851 }, next: null, reason: "Aldren never reigns." },
        { targetType: "RELATIONSHIP", targetId: rel("aldren:MARRIED_TO:lirien"), changeType: "DELETE", prev: { validFromYear: 843, validToYear: 851 }, next: null, reason: "The marriage never happens." },
        { targetType: "RELATIONSHIP", targetId: rel("ysolde:SUCCESSOR_OF:aldren"), changeType: "DELETE", prev: {}, next: null, reason: "Ysolde succeeds her father directly." },
        { targetType: "EVENT", targetId: need("ysolde_coronation"), changeType: "UPDATE", prev: { startYear: 852, startMonth: 4, startDay: 12 }, next: { startYear: 846, startMonth: 3, startDay: 3 }, reason: "Ysolde is crowned on Oswin's death." },
        { targetType: "RELATIONSHIP", targetId: rel("ysolde:RULES:veyr"), changeType: "UPDATE", prev: { validFromYear: 852 }, next: { validFromYear: 846 }, reason: "Ysolde reigns from 846." },
      ];
      let t = Date.now() - 60_000;
      for (const o of overlays) {
        await tx.timelineChange.create({
          data: {
            universeId,
            timelineId: branchId,
            targetType: o.targetType,
            targetId: o.targetId,
            changeType: o.changeType,
            previousState: json(o.prev),
            proposedState: o.next ? json(o.next) : undefined,
            appliedToBase: false,
            sourceEventId: need("assassination"),
            reason: o.reason,
            status: "ACCEPTED",
            authorId: ownerId,
            createdAt: new Date((t += 1000)),
          },
        });
      }
      // Records that exist only in the branch.
      const heirEventId = randomUUID();
      const heirDates = { startYear: 835, startMonth: 9, startDay: null, endYear: null, endMonth: null, endDay: null };
      await tx.historicalEvent.create({
        data: {
          id: heirEventId,
          universeId,
          timelineId: branchId,
          title: "Ysolde Named Heir of Veyr",
          slug: "ysolde-named-heir-of-veyr",
          description: "Months after Aldren's murder, King Oswin names his fourteen-year-old daughter heir and places her under Edda Thorne's protection.",
          eventType: "SUCCESSION",
          ...heirDates,
          ...eventOrdinals(heirDates),
          precision: "MONTH",
          importance: 4,
          locationId: need("highmarch"),
          createdById: ownerId,
          participants: { create: [{ entityId: need("ysolde"), role: "PROTAGONIST" }, { entityId: need("oswin"), role: "INSTIGATOR" }, { entityId: need("edda"), role: "ALLY" }] },
        },
      });
      await tx.eventDependency.create({ data: { universeId, timelineId: branchId, sourceId: need("assassination"), targetId: heirEventId, type: "CAUSES" } });
      await tx.relationship.create({
        data: { universeId, timelineId: branchId, sourceId: need("ysolde"), targetId: need("oswin"), type: "SUCCESSOR_OF", validFromYear: 846, createdById: ownerId },
      });

      // A ready-to-analyze Living World Engine proposal on the canon timeline.
      await tx.changeProposal.create({
        data: {
          universeId,
          timelineId: mainId,
          sourceEventId: need(PROPOSAL.event),
          title: PROPOSAL.title,
          rationale: PROPOSAL.rationale,
          patch: json(PROPOSAL.patch),
          status: "DRAFT",
          createdById: ownerId,
        },
      });

      await tx.universeActivity.createMany({
        data: [
          { universeId, actorId: ownerId, action: "universe.created", targetType: "UNIVERSE", targetId: universeId, summary: `Founded ${name} from the sample template`, createdAt: new Date(t - 30_000) },
          { universeId, actorId: ownerId, action: "timeline.branched", targetType: "TIMELINE", targetId: branchId, summary: `Branched “${BRANCH.name}” from the assassination of King Aldren`, createdAt: new Date(t + 1000) },
        ],
      });
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
  return universeId;
}
