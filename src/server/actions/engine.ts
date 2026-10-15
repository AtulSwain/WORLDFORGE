"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "../auth/session";
import { runAction } from "../action-utils";
import { rateLimit } from "../rate-limit";
import * as P from "../services/proposals";
import * as C from "../services/changes";

const id = z.string().min(1).max(64);

export async function createAndAnalyzeProposalAction(worldId: string, input: unknown) {
  return runAction(async () => {
    const user = await requireUser();
    rateLimit(`analyze:${user.id}`, 60, 60_000);
    const proposal = await P.createProposal(user.id, worldId, input);
    await P.analyzeProposal(user.id, worldId, proposal.id);
    revalidatePath(`/worlds/${worldId}/simulator`);
    return { id: proposal.id };
  });
}

export async function analyzeProposalAction(worldId: string, proposalId: string) {
  return runAction(async () => {
    const user = await requireUser();
    rateLimit(`analyze:${user.id}`, 60, 60_000);
    await P.analyzeProposal(user.id, worldId, id.parse(proposalId));
    revalidatePath(`/worlds/${worldId}/simulator`);
    return null;
  });
}

export async function reviewItemAction(worldId: string, itemId: string, input: unknown) {
  return runAction(async () => {
    const user = await requireUser();
    await P.reviewItem(user.id, worldId, id.parse(itemId), input);
    revalidatePath(`/worlds/${worldId}/simulator`);
    return null;
  });
}

export async function reviewAllAction(worldId: string, proposalId: string, status: "ACCEPTED" | "REJECTED") {
  return runAction(async () => {
    const user = await requireUser();
    await P.reviewAll(user.id, worldId, id.parse(proposalId), z.enum(["ACCEPTED", "REJECTED"]).parse(status));
    revalidatePath(`/worlds/${worldId}/simulator`);
    return null;
  });
}

export async function addAiPossibilitiesAction(worldId: string, proposalId: string) {
  return runAction(async () => {
    const user = await requireUser();
    const n = await P.addAiPossibilities(user.id, worldId, id.parse(proposalId));
    revalidatePath(`/worlds/${worldId}/simulator`);
    return { count: n };
  });
}

export async function commitProposalAction(worldId: string, proposalId: string, input: unknown) {
  return runAction(async () => {
    const user = await requireUser();
    const r = await P.commitProposal(user.id, worldId, id.parse(proposalId), input);
    revalidatePath(`/worlds/${worldId}`, "layout");
    return r;
  });
}

export async function discardProposalAction(worldId: string, proposalId: string) {
  return runAction(async () => {
    const user = await requireUser();
    await P.discardProposal(user.id, worldId, id.parse(proposalId));
    revalidatePath(`/worlds/${worldId}/simulator`);
    return null;
  });
}

export async function revertChangeAction(worldId: string, changeId: string) {
  return runAction(async () => {
    const user = await requireUser();
    await C.revertChange(user.id, worldId, id.parse(changeId));
    revalidatePath(`/worlds/${worldId}`, "layout");
    return null;
  });
}

export async function revertTimelineToAction(worldId: string, changeId: string) {
  return runAction(async () => {
    const user = await requireUser();
    const n = await C.revertTimelineTo(user.id, worldId, id.parse(changeId));
    revalidatePath(`/worlds/${worldId}`, "layout");
    return { reverted: n };
  });
}

export async function promoteChangeAction(worldId: string, changeId: string) {
  return runAction(async () => {
    const user = await requireUser();
    await C.promoteChange(user.id, worldId, id.parse(changeId));
    revalidatePath(`/worlds/${worldId}`, "layout");
    return null;
  });
}

export async function promoteRecordAction(worldId: string, timelineId: string, type: "EVENT" | "ENTITY" | "RELATIONSHIP", recordId: string) {
  return runAction(async () => {
    const user = await requireUser();
    await C.promoteRecord(user.id, worldId, id.parse(timelineId), z.enum(["EVENT", "ENTITY", "RELATIONSHIP"]).parse(type), id.parse(recordId));
    revalidatePath(`/worlds/${worldId}`, "layout");
    return null;
  });
}
