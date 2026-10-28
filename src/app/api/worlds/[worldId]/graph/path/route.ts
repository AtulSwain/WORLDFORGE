import { requireApiUser } from "@/server/auth/api";
import { handleJson } from "@/server/action-utils";
import { graphPath } from "@/server/services/graph";
import { invalid } from "@/server/errors";

export async function GET(req: Request, ctx: RouteContext<"/api/worlds/[worldId]/graph/path">) {
  return handleJson(async () => {
    const user = await requireApiUser();
    const { worldId } = await ctx.params;
    const sp = new URL(req.url).searchParams;
    const from = sp.get("from");
    const to = sp.get("to");
    if (!from || !to) throw invalid("Both “from” and “to” are required.");
    return graphPath(user.id, worldId, from, to, sp.get("tl"));
  });
}
