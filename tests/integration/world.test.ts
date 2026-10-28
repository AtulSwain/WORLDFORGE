import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import type { AppError } from "@/server/errors";
import { toFailure } from "@/server/action-utils";
import { instantiateSampleUniverse } from "@/sample/instantiate";
import { registerUser } from "@/server/services/users";
import { acceptInvitation, createInvitation, deleteUniverse, getUniverse, updateUniverseRules } from "@/server/services/universes";
import { createEntity, restoreEntityRevision, updateEntity } from "@/server/services/entities";
import { addDependency, createEvent, getEvent, updateEvent } from "@/server/services/events";
import { createRelationship } from "@/server/services/relationships";
import { createLore, getLore, updateLore } from "@/server/services/lore";
import { createBranch } from "@/server/services/timelines";
import { listRevisions } from "@/server/services/revisions";
import { loadSnapshot, mainTimeline } from "@/server/services/snapshot";
import { analyzeProposal, commitProposal, createProposal, reviewAll, reviewItem } from "@/server/services/proposals";
import { listChanges, revertChange } from "@/server/services/changes";
import { buildExport, importUniverse } from "@/server/services/transfer";
import { suggestForCharacter } from "@/server/ai/service";

/**
 * Service-level integration tests. They need a disposable PostgreSQL database:
 * set DATABASE_URL_TEST (it replaces DATABASE_URL for the test run) and apply migrations to it.
 * Without it the suite is skipped so a plain `npm test` never touches development data.
 */
const enabled = !!process.env.DATABASE_URL_TEST;

/** Asserts the failure code the user would see (schema errors are reported as VALIDATION). */
async function expectCode(p: Promise<unknown>, code: AppError["code"]) {
  await expect(p).rejects.toSatisfy((e: unknown) => toFailure(e).code === code);
}

describe.skipIf(!enabled)("world services (integration)", () => {
  const tag = randomUUID().slice(0, 8);
  let owner: { id: string; email: string };
  let viewer: { id: string; email: string };
  let stranger: { id: string; email: string };
  let universeId: string;
  let mainId: string;
  const created: string[] = [];

  const eventBySlug = (slug: string) => db.historicalEvent.findFirstOrThrow({ where: { universeId, slug } });
  const entityBySlug = (slug: string) => db.entity.findFirstOrThrow({ where: { universeId, slug } });

  beforeAll(async () => {
    const mk = (n: string) => registerUser({ name: n, email: `${n}-${tag}@test.worldforge.dev`, password: "correct-horse-battery" });
    [owner, viewer, stranger] = await Promise.all([mk("owner"), mk("viewer"), mk("stranger")]);
    universeId = await instantiateSampleUniverse(db, owner.id, { isSample: true });
    created.push(universeId);
    mainId = (await mainTimeline(universeId)).id;
    const { token } = await createInvitation(owner.id, universeId, { email: viewer.email, role: "VIEWER" });
    await acceptInvitation(viewer.id, viewer.email, token);
  });

  afterAll(async () => {
    if (!enabled) return;
    for (const id of created) await deleteUniverse(owner.id, id, (await db.universe.findUniqueOrThrow({ where: { id } })).name).catch(() => undefined);
    await db.user.deleteMany({ where: { email: { endsWith: `-${tag}@test.worldforge.dev` } } });
    await db.$disconnect();
  });

  describe("ownership and roles", () => {
    it("hides universes from non-members as not found", async () => {
      await expectCode(getUniverse(stranger.id, universeId), "NOT_FOUND");
      await expectCode(buildExport(stranger.id, universeId), "NOT_FOUND");
    });

    it("lets viewers read but not write, export or change settings", async () => {
      await expect(getUniverse(viewer.id, universeId)).resolves.toMatchObject({ role: "VIEWER" });
      await expectCode(createEntity(viewer.id, universeId, { type: "CHARACTER", name: "Intruder" }), "FORBIDDEN");
      await expectCode(buildExport(viewer.id, universeId), "FORBIDDEN");
      await expectCode(updateUniverseRules(viewer.id, universeId, { rules: {} }), "FORBIDDEN");
    });

    it("rejects an invitation used by a different account", async () => {
      const { token } = await createInvitation(owner.id, universeId, { email: `someone-${tag}@test.worldforge.dev`, role: "EDITOR" });
      await expectCode(acceptInvitation(stranger.id, stranger.email, token), "FORBIDDEN");
    });
  });

  describe("settings", () => {
    it("saves a partial rule set", async () => {
      await updateUniverseRules(owner.id, universeId, { rules: { TRAVEL_CONFLICT: false }, minTravelDays: 2, aiEnabled: false });
      const u = await db.universe.findUniqueOrThrow({ where: { id: universeId } });
      expect(u.settings).toMatchObject({ rules: { TRAVEL_CONFLICT: false }, minTravelDays: 2, aiEnabled: false });
      await updateUniverseRules(owner.id, universeId, {});
    });
  });

  describe("content", () => {
    it("creates and edits entities with revision history, and restores a prior revision", async () => {
      const e = await createEntity(owner.id, universeId, { type: "CHARACTER", name: `Wren ${tag}`, summary: "Original", beginYear: 820 });
      const edited = await updateEntity(owner.id, universeId, e.id, { type: "CHARACTER", name: `Wren ${tag}`, summary: "Rewritten", beginYear: 821 }, e.version);
      expect(edited.version).toBe(e.version + 1);
      const revisions = await listRevisions(universeId, "ENTITY", e.id);
      expect(revisions.length).toBeGreaterThanOrEqual(2);
      const first = revisions.find((r) => r.version === e.version)!;
      const restored = await restoreEntityRevision(owner.id, universeId, e.id, first.id);
      expect(restored.summary).toBe("Original");
      expect(restored.beginYear).toBe(820);
    });

    it("persists relationships and validates them", async () => {
      const [a, b] = await Promise.all([
        createEntity(owner.id, universeId, { type: "CHARACTER", name: `Ash ${tag}` }),
        createEntity(owner.id, universeId, { type: "FACTION", name: `Guild ${tag}` }),
      ]);
      const rel = await createRelationship(owner.id, universeId, { sourceId: a.id, targetId: b.id, type: "MEMBER_OF", validFromYear: 830 });
      expect(await db.relationship.findUnique({ where: { id: rel.id } })).toMatchObject({ sourceId: a.id, targetId: b.id, type: "MEMBER_OF" });
      await expectCode(createRelationship(owner.id, universeId, { sourceId: a.id, targetId: a.id, type: "ALLY_OF" }), "VALIDATION");
      await expectCode(createRelationship(owner.id, universeId, { sourceId: a.id, targetId: b.id, type: "NOT_A_TYPE" }), "VALIDATION");
    });

    it("creates and edits events, and refuses dependency cycles", async () => {
      const ch = await createEntity(owner.id, universeId, { type: "CHARACTER", name: `Pell ${tag}` });
      const first = await createEvent(owner.id, universeId, { title: `Raid ${tag}`, startYear: 900, participants: [{ entityId: ch.id, role: "COMMANDER" }] });
      const second = await createEvent(owner.id, universeId, { title: `Reprisal ${tag}`, startYear: 901 });
      const loaded = await getEvent(owner.id, universeId, first.id);
      expect(loaded.event.participants.map((p) => p.entityId)).toEqual([ch.id]);
      const edited = await updateEvent(owner.id, universeId, first.id, { title: `Raid ${tag}`, startYear: 899, participants: [{ entityId: ch.id, role: "COMMANDER" }] }, first.version);
      expect(edited.startOrdinal).toBe(899_000);
      await addDependency(owner.id, universeId, { sourceId: first.id, targetId: second.id, type: "CAUSES" });
      await expectCode(addDependency(owner.id, universeId, { sourceId: second.id, targetId: first.id, type: "CAUSES" }), "VALIDATION");
      await expectCode(createEvent(owner.id, universeId, { title: "Backwards", startYear: 10, endYear: 5 }), "VALIDATION");
    });

    it("saves lore documents with links and version checks", async () => {
      const seren = await entityBySlug("seren-vale");
      const doc = await createLore(owner.id, universeId, { title: `Annal ${tag}`, body: "# Draft", entityIds: [seren.id] });
      const saved = await updateLore(owner.id, universeId, doc.id, { title: `Annal ${tag}`, body: "# Final", entityIds: [seren.id] }, doc.version);
      expect(saved.version).toBe(doc.version + 1);
      const loaded = await getLore(owner.id, universeId, doc.id);
      expect(loaded.doc.body).toBe("# Final");
      expect(loaded.doc.links.map((l) => l.entityId)).toEqual([seren.id]);
      await expectCode(updateLore(owner.id, universeId, doc.id, { title: "Stale", body: "x" }, doc.version), "CONFLICT");
    });

    it("refuses references to records in another universe", async () => {
      const otherUniverse = await instantiateSampleUniverse(db, stranger.id, { name: `Other ${tag}` });
      created.push(otherUniverse);
      const foreign = await db.entity.findFirstOrThrow({ where: { universeId: otherUniverse } });
      const mine = await entityBySlug("seren-vale");
      await expectCode(createRelationship(owner.id, universeId, { sourceId: mine.id, targetId: foreign.id, type: "ALLY_OF" }), "VALIDATION");
      await expectCode(getEvent(owner.id, universeId, "00000000-0000-0000-0000-000000000000"), "NOT_FOUND");
    });
  });

  describe("optimistic concurrency", () => {
    it("rejects a save based on a stale version", async () => {
      const seren = await entityBySlug("seren-vale");
      const input = { type: "CHARACTER" as const, name: seren.name, summary: "First edit", attributes: seren.attributes as Record<string, unknown> };
      await updateEntity(owner.id, universeId, seren.id, input, seren.version);
      await expectCode(updateEntity(owner.id, universeId, seren.id, { ...input, summary: "Stale edit" }, seren.version), "CONFLICT");
      expect((await entityBySlug("seren-vale")).summary).toBe("First edit");
    });
  });

  describe("Living World Engine", () => {
    it("commits an alternate history to a new branch without touching canon", async () => {
      const murder = await eventBySlug("assassination-of-king-aldren");
      const proposal = await createProposal(owner.id, universeId, {
        timelineId: mainId, sourceEventId: murder.id, title: "Aldren dies young", patch: { startYear: 835, startMonth: 3, startDay: 1 },
      });
      await analyzeProposal(owner.id, universeId, proposal.id);
      const items = await db.impactItem.findMany({ where: { proposalId: proposal.id } });
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((i) => i.basis && i.strength)).toBe(true);

      await reviewAll(owner.id, universeId, proposal.id, "ACCEPTED");
      const { timelineId: branchId, changes } = await commitProposal(owner.id, universeId, proposal.id, { target: "NEW_BRANCH", branchName: `Test branch ${tag}` });
      expect(changes).toBeGreaterThan(0);

      // Canon is untouched.
      expect((await eventBySlug("assassination-of-king-aldren")).startYear).toBe(851);
      const canon = await loadSnapshot(universeId, mainId);
      expect(canon.events.find((e) => e.id === murder.id)!.startYear).toBe(851);
      // The branch sees the new history through overlays.
      const branch = await loadSnapshot(universeId, branchId);
      expect(branch.events.find((e) => e.id === murder.id)!.startYear).toBe(835);
      const overlays = await db.timelineChange.findMany({ where: { timelineId: branchId } });
      expect(overlays.length).toBe(changes);
      expect(overlays.every((o) => !o.appliedToBase)).toBe(true);

      // A proposal cannot be committed twice.
      await expectCode(commitProposal(owner.id, universeId, proposal.id, { target: "NEW_BRANCH" }), "VALIDATION");

      // Undo restores the branch for that record.
      const primary = overlays.find((o) => o.targetId === murder.id)!;
      const later = overlays.filter((o) => o.targetId === murder.id && o.createdAt > primary.createdAt);
      if (!later.length) {
        await revertChange(owner.id, universeId, primary.id);
        const reverted = await loadSnapshot(universeId, branchId);
        expect(reverted.events.find((e) => e.id === murder.id)!.startYear).toBe(851);
        const log = await listChanges(owner.id, universeId, branchId);
        expect(JSON.stringify(log)).toContain("REVERTED");
      }
    });

    it("refuses to commit an analysis that went stale", async () => {
      const treaty = await eventBySlug("treaty-of-greyford");
      const proposal = await createProposal(owner.id, universeId, { timelineId: mainId, sourceEventId: treaty.id, title: "The treaty fails", patch: { cancelled: true } });
      await analyzeProposal(owner.id, universeId, proposal.id);
      await reviewAll(owner.id, universeId, proposal.id, "ACCEPTED");
      // Someone edits canon after the analysis ran.
      const road = await eventBySlug("reopening-of-the-ember-road");
      await updateEvent(owner.id, universeId, road.id, { title: road.title, startYear: road.startYear, precision: road.precision, eventType: road.eventType, description: "Edited meanwhile", importance: road.importance, locationId: road.locationId }, road.version);
      await expectCode(commitProposal(owner.id, universeId, proposal.id, { target: "CURRENT" }), "CONFLICT");
      expect((await eventBySlug("treaty-of-greyford")).archivedAt).toBeNull();
    });

    it("creates branches and lets reviewers reject suggested changes", async () => {
      const branch = await createBranch(owner.id, universeId, { name: `Manual ${tag}`, parentId: mainId });
      expect(branch.parentId).toBe(mainId);
      const war = await eventBySlug("the-salt-war");
      const proposal = await createProposal(owner.id, universeId, { timelineId: branch.id, sourceEventId: war.id, title: "The war never starts", patch: { cancelled: true } });
      await analyzeProposal(owner.id, universeId, proposal.id);
      const items = await db.impactItem.findMany({ where: { proposalId: proposal.id } });
      const primary = items.find((i) => i.basis === "PRIMARY_CHANGE")!;
      await expectCode(reviewItem(owner.id, universeId, primary.id, { status: "REJECTED" }), "VALIDATION");
      await reviewAll(owner.id, universeId, proposal.id, "REJECTED");
      const { changes } = await commitProposal(owner.id, universeId, proposal.id, { target: "CURRENT" });
      // Only the primary change is applied; rejected suggestions are not.
      expect(changes).toBe(1);
      expect((await loadSnapshot(universeId, branch.id)).events.some((e) => e.id === war.id)).toBe(false);
      expect((await loadSnapshot(universeId, mainId)).events.some((e) => e.id === war.id)).toBe(true);
    });

    it("rejects proposals from viewers", async () => {
      const treaty = await eventBySlug("treaty-of-greyford");
      await expectCode(createProposal(viewer.id, universeId, { timelineId: mainId, sourceEventId: treaty.id, title: "Viewer meddling", patch: { startYear: 1 } }), "FORBIDDEN");
    });
  });

  describe("AI assistance (demo provider, no network)", () => {
    it("stores suggestions for review without touching canon, and honours the universe switch", async () => {
      const prev = process.env.AI_PROVIDER;
      process.env.AI_PROVIDER = "demo";
      try {
        const seren = await entityBySlug("seren-vale");
        const suggestion = await suggestForCharacter(owner.id, universeId, seren.id, "CHARACTER_BACKSTORY");
        expect(suggestion).toMatchObject({ status: "PENDING", isDemo: true, targetId: seren.id });
        const after = await entityBySlug("seren-vale");
        expect(after.version).toBe(seren.version);
        expect(after.description).toBe(seren.description);
        await expectCode(suggestForCharacter(viewer.id, universeId, seren.id, "CHARACTER_BACKSTORY"), "FORBIDDEN");
        await updateUniverseRules(owner.id, universeId, { aiEnabled: false });
        await expectCode(suggestForCharacter(owner.id, universeId, seren.id, "CHARACTER_BACKSTORY"), "FORBIDDEN");
      } finally {
        await updateUniverseRules(owner.id, universeId, {});
        if (prev === undefined) delete process.env.AI_PROVIDER;
        else process.env.AI_PROVIDER = prev;
      }
    });
  });

  describe("export and import", () => {
    it("round-trips a universe, including alternate timelines", async () => {
      const exported = await buildExport(owner.id, universeId);
      const result = await importUniverse(stranger.id, JSON.parse(JSON.stringify(exported)), { name: `Imported ${tag}` });
      if (!result.ok) throw new Error(JSON.stringify(result.issues));
      created.push(result.universeId);
      const [entities, events, timelines] = await Promise.all([
        db.entity.count({ where: { universeId: result.universeId } }),
        db.historicalEvent.count({ where: { universeId: result.universeId } }),
        db.timeline.findMany({ where: { universeId: result.universeId } }),
      ]);
      expect(entities).toBe(exported.entities.length);
      expect(events).toBe(exported.events.length);
      expect(timelines).toHaveLength(exported.timelines.length);
      // The importer owns the copy; no IDs are shared with the source.
      await expect(getUniverse(stranger.id, result.universeId)).resolves.toMatchObject({ role: "OWNER" });
      const ids = new Set((await db.entity.findMany({ where: { universeId: result.universeId }, select: { id: true } })).map((e) => e.id));
      expect(exported.entities.some((e) => ids.has(e.id))).toBe(false);
      // Branch overlays still resolve in the copy.
      const branch = timelines.find((t) => !t.isMain && t.parentId)!;
      const snap = await loadSnapshot(result.universeId, branch.id);
      expect(snap.overridden.size).toBeGreaterThan(0);
    });

    it("rejects a corrupted file and writes nothing", async () => {
      const exported = await buildExport(owner.id, universeId);
      exported.relationships[0]!.sourceId = "missing";
      const before = await db.universe.count();
      const result = await importUniverse(stranger.id, exported);
      expect(result.ok).toBe(false);
      expect(await db.universe.count()).toBe(before);
    });
  });
});
