import { requireApiUser } from "@/server/auth/api";
import { handleJson } from "@/server/action-utils";
import { graphNeighborhood } from "@/server/services/graph";
import { rateLimit } from "@/server/rate-limit";

export async function GET(req: Request, ctx: RouteContext<"/api/worlds/[worldId]/graph">) {
  return handleJson(async () => {
    const user = await requireApiUser();
    rateLimit(`graph:${user.id}`, 240, 60_000);
    const { worldId } = await ctx.params;
    const sp = new URL(req.url).searchParams;
    const list = (k: string) => (sp.get(k) ? sp.get(k)!.split(",").filter(Boolean) : []);
    return graphNeighborhood(user.id, worldId, {
      timelineId: sp.get("tl"),
      focus: list("focus"),
      depth: Number(sp.get("depth") ?? 2),
      types: list("types") as never,
      rels: list("rels"),
      events: sp.get("events") === "1",
      limit: Number(sp.get("limit") ?? 120),
    });
  });
}
