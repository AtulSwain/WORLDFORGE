import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { calendarSchema, parseSettings } from "@/domain/schemas";
import type { CalendarConfig } from "@/domain/chronology";
import { can, type Capability, type Role } from "@/domain/permissions";
import { db } from "./db";
import { AppError } from "./errors";
import { requireUser, type SessionUser } from "./auth/session";

export interface WorldContext {
  user: SessionUser;
  role: Role;
  universe: {
    id: string;
    name: string;
    slug: string;
    genre: string;
    customGenre: string | null;
    description: string;
    coverImage: string | null;
    currentEra: string | null;
    defaultTimelineId: string | null;
    isSample: boolean;
    archivedAt: Date | null;
  };
  calendar: CalendarConfig;
  settings: ReturnType<typeof parseSettings>;
  timelines: { id: string; name: string; isMain: boolean; parentId: string | null; status: string; branchEventId: string | null }[];
  can: (c: Capability) => boolean;
}

/** Loads the current user + universe membership once per request. Non-members get a 404. */
export const getWorldContext = cache(async (worldId: string): Promise<WorldContext> => {
  const user = await requireUser();
  const member = await db.universeMember.findUnique({
    where: { universeId_userId: { universeId: worldId, userId: user.id } },
    include: {
      universe: {
        include: {
          timelines: {
            select: { id: true, name: true, isMain: true, parentId: true, status: true, branchEventId: true },
            orderBy: [{ isMain: "desc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });
  if (!member) notFound();
  const { timelines, calendar, settings, ...universe } = member.universe;
  return {
    user,
    role: member.role,
    universe,
    calendar: calendarSchema.parse(calendar ?? {}),
    settings: parseSettings(settings),
    timelines,
    can: (c) => can(member.role, c),
  };
});

/** Converts service errors into the right page response. */
export async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AppError) {
      if (e.code === "NOT_FOUND") notFound();
      if (e.code === "UNAUTHENTICATED") redirect("/login");
      if (e.code === "FORBIDDEN") redirect("/dashboard");
    }
    throw e;
  }
}

/** Resolves `?tl=` against the universe's timelines. */
export function pickTimeline(ctx: WorldContext, requested: unknown) {
  const byId = typeof requested === "string" ? ctx.timelines.find((t) => t.id === requested) : undefined;
  return byId ?? ctx.timelines.find((t) => t.id === ctx.universe.defaultTimelineId) ?? ctx.timelines.find((t) => t.isMain) ?? ctx.timelines[0]!;
}
