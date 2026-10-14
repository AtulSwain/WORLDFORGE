import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db, type DbOrTx } from "../db";

export async function recordActivity(
  client: DbOrTx,
  data: { universeId: string; actorId: string | null; action: string; targetType?: string; targetId?: string; summary: string },
) {
  await client.universeActivity.create({ data });
}

export async function audit(
  data: { userId?: string | null; universeId?: string | null; action: string; metadata?: Prisma.InputJsonValue; ip?: string | null },
  client: DbOrTx = db,
) {
  await client.auditLog.create({
    data: { userId: data.userId ?? null, universeId: data.universeId ?? null, action: data.action, metadata: data.metadata ?? {}, ip: data.ip ?? null },
  });
}
