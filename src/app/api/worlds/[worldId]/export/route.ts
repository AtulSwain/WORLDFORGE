import { requireApiUser } from "@/server/auth/api";
import { toFailure } from "@/server/action-utils";
import { HTTP_STATUS } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";
import { buildExport, buildExportZip } from "@/server/services/transfer";
import { slugify } from "@/lib/slug";

/** Downloads a universe as `universe.json` (?format=json) or a zip bundle (default). */
export async function GET(req: Request, ctx: RouteContext<"/api/worlds/[worldId]/export">) {
  try {
    const user = await requireApiUser();
    rateLimit(`export:${user.id}`, 30, 60 * 60 * 1000);
    const { worldId } = await ctx.params;
    const format = new URL(req.url).searchParams.get("format");
    if (format === "json") {
      const data = await buildExport(user.id, worldId);
      return new Response(JSON.stringify(data, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${slugify(data.universe.name) || "universe"}.worldforge.json"`,
          "Cache-Control": "no-store",
        },
      });
    }
    const { filename, bytes } = await buildExportZip(user.id, worldId);
    return new Response(bytes as BodyInit, {
      headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" },
    });
  } catch (e) {
    const f = toFailure(e);
    const status = f.code && f.code in HTTP_STATUS ? HTTP_STATUS[f.code as keyof typeof HTTP_STATUS] : 500;
    return Response.json({ error: f.error }, { status });
  }
}
