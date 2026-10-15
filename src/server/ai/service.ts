import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { formatEventDate, type CalendarConfig } from "@/domain/chronology";
import { calendarSchema, parseSettings, readAttributes } from "@/domain/schemas";
import { BUILTIN_RELATIONSHIP_KEYS } from "@/domain/catalog";
import { db } from "../db";
import { AppError, invalid, notFound } from "../errors";
import { rateLimit } from "../rate-limit";
import { requireAccess } from "../services/access";
import { recordActivity } from "../services/activity";
import { toJson } from "../services/revisions";
import { getAiConfig } from "./config";
import { createProvider } from "./providers";
import { SCHEMA_BY_KIND, type AiKind, type AiOutput } from "./schemas";

/**
 * AI service layer. Every operation:
 *  1. checks membership/capability, universe AI setting, rate and daily token limits;
 *  2. assembles bounded context from approved canon (entity, neighbours, events, lore, rules);
 *  3. calls the configured provider with a schema and validates the output;
 *  4. stores the result as a PENDING AiSuggestion — never as canon.
 * Applying a suggestion is a separate, explicit, permission-checked step.
 */

const SYSTEM = `You are a worldbuilding assistant inside WorldForge. You help a creator develop their own fictional universe.
Rules:
- Ground every suggestion in the canon provided. Do not contradict established facts; if you notice a contradiction, say so.
- Never invent record ids. Only reference ids that appear in the context as [id:...].
- Keep the creator's tone and genre. Be specific and concise.
- Your output is a suggestion for the creator to review; it is not canon.`;

function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

async function universeHeader(universeId: string) {
  const u = await db.universe.findUniqueOrThrow({
    where: { id: universeId },
    select: { name: true, description: true, genre: true, customGenre: true, tone: true, mainConflict: true, coreRules: true, timePeriod: true, calendar: true, settings: true },
  });
  const header = [
    `UNIVERSE: ${u.name} (${u.genre === "CUSTOM" ? u.customGenre : u.genre.toLowerCase().replace("_", " ")})`,
    u.description && `Premise: ${clip(u.description, 1200)}`,
    u.tone && `Tone: ${u.tone}`,
    u.timePeriod && `Period: ${u.timePeriod}`,
    u.mainConflict && `Main conflict: ${u.mainConflict}`,
    u.coreRules && `World rules (must be respected):\n${clip(u.coreRules, 1500)}`,
  ]
    .filter(Boolean)
    .join("\n");
  return { header, calendar: calendarSchema.parse(u.calendar ?? {}) as CalendarConfig, settings: parseSettings(u.settings) };
}

/** Bounded context around one entity: itself, its relationships, events and linked lore. */
async function entityContext(universeId: string, entityId: string, maxChars: number) {
  const { header, calendar } = await universeHeader(universeId);
  const e = await db.entity.findFirst({
    where: { id: entityId, universeId },
    include: {
      outgoing: { where: { archivedAt: null }, take: 30, include: { target: { select: { id: true, name: true, type: true } } } },
      incoming: { where: { archivedAt: null }, take: 30, include: { source: { select: { id: true, name: true, type: true } } } },
      participation: { take: 25, include: { event: true }, orderBy: { event: { startOrdinal: "asc" } } },
      loreLinks: { take: 6, include: { document: { select: { title: true, body: true, archivedAt: true } } } },
    },
  });
  if (!e) throw notFound("Entity");
  const attrs = JSON.stringify(e.attributes);
  const lines = [
    header,
    "",
    `SUBJECT [id:${e.id}] ${e.name} — ${e.type.toLowerCase()}, status ${e.status.toLowerCase()}${e.beginYear != null ? `, from ${e.beginYear}` : ""}${e.endYear != null ? ` to ${e.endYear}` : ""}`,
    `Summary: ${e.summary}`,
    e.description && `Description: ${clip(e.description, 2000)}`,
    `Structured attributes: ${clip(attrs, 3000)}`,
    "",
    "RELATIONSHIPS:",
    ...e.outgoing.map((r) => `- ${e.name} ${r.type} [id:${r.target.id}] ${r.target.name} (${r.target.type.toLowerCase()})${r.validFromYear != null ? ` from ${r.validFromYear}` : ""}${r.validToYear != null ? ` to ${r.validToYear}` : ""}`),
    ...e.incoming.map((r) => `- [id:${r.source.id}] ${r.source.name} (${r.source.type.toLowerCase()}) ${r.type} ${e.name}`),
    "",
    "EVENTS:",
    ...e.participation.map((p) => `- ${formatEventDate(p.event, calendar)}: ${p.event.title} (as ${p.role.toLowerCase()}) — ${clip(p.event.description, 200)}`),
    "",
    "LORE:",
    ...e.loreLinks.filter((l) => !l.document.archivedAt).map((l) => `## ${l.document.title}\n${clip(l.document.body, 900)}`),
  ]
    .filter((x): x is string => typeof x === "string")
    .join("\n");
  return { text: clip(lines, maxChars), entity: e };
}

async function candidateEntities(universeId: string, excludeId: string) {
  return db.entity.findMany({
    where: { universeId, archivedAt: null, id: { not: excludeId } },
    select: { id: true, name: true, type: true, summary: true },
    orderBy: { updatedAt: "desc" },
    take: 60,
  });
}

async function enforceLimits(userId: string, universeId: string) {
  const cfg = getAiConfig();
  if (!cfg.available) throw new AppError("AI is not configured on this server. Everything else keeps working without it.", "UNAVAILABLE");
  const { settings } = await universeHeader(universeId);
  if (!settings.aiEnabled) throw new AppError("AI assistance is turned off for this universe in its settings.", "FORBIDDEN");
  rateLimit(`ai:${userId}`, 20, 60 * 60 * 1000);
  const since = new Date(Date.now() - 86_400_000);
  const used = await db.aiSuggestion.aggregate({ where: { userId, createdAt: { gte: since } }, _sum: { inputTokens: true, outputTokens: true } });
  const total = (used._sum.inputTokens ?? 0) + (used._sum.outputTokens ?? 0);
  if (total >= cfg.dailyTokenLimit) throw new AppError("You have reached today's AI usage allowance. It resets within 24 hours.", "RATE_LIMITED");
  return cfg;
}

async function run<K extends AiKind>(
  userId: string,
  universeId: string,
  kind: K,
  prompt: string,
  target: { type: string; id: string } | null,
  input: Prisma.InputJsonValue,
) {
  const cfg = await enforceLimits(userId, universeId);
  const provider = createProvider(cfg);
  try {
    const result = await provider.generate({ kind, system: SYSTEM, prompt, schema: SCHEMA_BY_KIND[kind] as never });
    return db.aiSuggestion.create({
      data: {
        universeId, userId, kind, targetType: target?.type ?? null, targetId: target?.id ?? null, input,
        output: toJson(result.data), status: "PENDING", provider: cfg.provider, model: result.model, isDemo: cfg.demo,
        inputTokens: result.inputTokens, outputTokens: result.outputTokens,
      },
    });
  } catch (e) {
    await db.aiSuggestion.create({
      data: {
        universeId, userId, kind, targetType: target?.type ?? null, targetId: target?.id ?? null, input,
        status: "FAILED", error: e instanceof Error ? e.message.slice(0, 500) : "Unknown error", provider: cfg.provider, model: cfg.model, isDemo: cfg.demo,
      },
    });
    throw e;
  }
}

const CHARACTER_TASKS: Record<Exclude<AiKind, "WORLD_OUTLINE" | "IMPACT_SUGGESTIONS">, string> = {
  CHARACTER_TRAITS: "Suggest personality traits for the SUBJECT: a personality description and lists of strengths, flaws, values and fears consistent with their history.",
  CHARACTER_BACKSTORY: "Expand the SUBJECT's backstory into 2–4 paragraphs that fit every recorded relationship and event. Do not change recorded dates.",
  CHARACTER_MOTIVATIONS: "Suggest the SUBJECT's core motivations (short phrases) and a paragraph describing their current goals.",
  CHARACTER_CONTRADICTIONS: "Identify contradictions or tensions between the SUBJECT's description, attributes, relationships and events. Cite the ids involved in `references`.",
  CHARACTER_RELATIONSHIPS: "Suggest up to 5 new relationships between the SUBJECT and the CANDIDATES. Use only candidate ids. `type` must be one of the listed relationship types.",
};

export async function suggestForCharacter(userId: string, universeId: string, entityId: string, kind: keyof typeof CHARACTER_TASKS) {
  await requireAccess(userId, universeId, "ai:use");
  const cfg = getAiConfig();
  const { text } = await entityContext(universeId, entityId, cfg.maxContextChars);
  let prompt = `${text}\n\nTASK: ${CHARACTER_TASKS[kind]}`;
  if (kind === "CHARACTER_RELATIONSHIPS") {
    const cands = await candidateEntities(universeId, entityId);
    prompt += `\n\nCANDIDATES:\n${cands.map((c) => `[id:${c.id}] ${c.name} (${c.type.toLowerCase()}) — ${clip(c.summary, 120)}`).join("\n")}\n\nRELATIONSHIP TYPES: ${BUILTIN_RELATIONSHIP_KEYS.join(", ")}`;
  }
  return run(userId, universeId, kind, prompt, { type: "ENTITY", id: entityId }, { entityId, kind });
}

export async function suggestWorldOutline(userId: string, universeId: string) {
  await requireAccess(userId, universeId, "ai:use");
  const { header } = await universeHeader(universeId);
  const prompt = `${header}\n\nTASK: Draft an initial outline for this universe: a short summary, 3–5 factions, 5–8 characters (with their faction), 3–6 locations and 5–8 historical events with years. Everything must be original.`;
  return run(userId, universeId, "WORLD_OUTLINE", prompt, { type: "UNIVERSE", id: universeId }, { universeId });
}

export async function suggestImpacts(userId: string, universeId: string, proposalId: string) {
  await requireAccess(userId, universeId, "ai:use");
  const cfg = getAiConfig();
  const proposal = await db.changeProposal.findFirst({ where: { id: proposalId, universeId }, include: { sourceEvent: true, items: { select: { title: true } } } });
  if (!proposal) throw notFound("Proposal");
  if (proposal.status !== "ANALYZED") throw invalid("Run the deterministic analysis before asking for AI possibilities.");
  const { header, calendar } = await universeHeader(universeId);
  const ev = proposal.sourceEvent;
  const parts = await db.eventParticipant.findMany({ where: { eventId: ev.id }, include: { entity: { select: { id: true, name: true, type: true, summary: true } } } });
  const prompt = clip(
    [
      header,
      "",
      `EVENT [id:${ev.id}] ${ev.title} (${formatEventDate(ev, calendar)}): ${clip(ev.description, 800)}`,
      `PROPOSED CHANGE: ${JSON.stringify(proposal.patch)} — ${proposal.rationale}`,
      "PARTICIPANTS:",
      ...parts.map((p) => `- [id:${p.entity.id}] ${p.entity.name} (${p.entity.type.toLowerCase()}, ${p.role.toLowerCase()}): ${clip(p.entity.summary, 160)}`),
      "ALREADY IDENTIFIED BY DETERMINISTIC ANALYSIS (do not repeat):",
      ...proposal.items.slice(0, 40).map((i) => `- ${i.title}`),
      "",
      "TASK: Suggest up to 6 additional plausible narrative consequences that the explicit structure does not capture. Reference only ids listed above in `affectedIds`.",
    ].join("\n"),
    cfg.maxContextChars,
  );
  return run(userId, universeId, "IMPACT_SUGGESTIONS", prompt, { type: "PROPOSAL", id: proposalId }, { proposalId });
}

// ── Review ──

export async function rejectSuggestion(userId: string, universeId: string, suggestionId: string) {
  await requireAccess(userId, universeId, "content:write");
  const r = await db.aiSuggestion.updateMany({ where: { id: suggestionId, universeId, status: "PENDING" }, data: { status: "REJECTED", decidedAt: new Date() } });
  if (!r.count) throw notFound("Pending suggestion");
}

/** Marks a suggestion accepted after its (possibly edited) content was applied by a validated write path. */
export async function markAccepted(universeId: string, suggestionId: string, finalOutput: unknown) {
  const r = await db.aiSuggestion.updateMany({
    where: { id: suggestionId, universeId, status: "PENDING" },
    data: { status: "ACCEPTED", decidedAt: new Date(), output: toJson(finalOutput) },
  });
  if (!r.count) throw notFound("Pending suggestion");
}

export async function getPendingSuggestion<K extends AiKind>(universeId: string, suggestionId: string, kind: K) {
  const s = await db.aiSuggestion.findFirst({ where: { id: suggestionId, universeId, kind, status: "PENDING" } });
  if (!s) throw notFound("Pending suggestion");
  return { ...s, output: SCHEMA_BY_KIND[kind].parse(s.output) as AiOutput<K> };
}

/** Filters model-generated ids to those that exist in the universe. */
export async function existingEntityIds(universeId: string, ids: string[]): Promise<Set<string>> {
  const rows = await db.entity.findMany({ where: { universeId, id: { in: [...new Set(ids)].slice(0, 200) }, archivedAt: null }, select: { id: true } });
  return new Set(rows.map((r) => r.id));
}

export async function logAiActivity(universeId: string, userId: string, summary: string) {
  await recordActivity(db, { universeId, actorId: userId, action: "ai.accepted", summary });
}

export { readAttributes };
