import { requireApiUser } from "@/server/auth/api";
import { assertSameOrigin, handleJson } from "@/server/action-utils";
import { invalid } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";
import { replaceAsset, uploadAsset } from "@/server/services/assets";

/** Authenticated, server-validated upload (multipart/form-data). */
export async function POST(req: Request, ctx: RouteContext<"/api/worlds/[worldId]/assets">) {
  return handleJson(async () => {
    assertSameOrigin(req);
    const user = await requireApiUser();
    rateLimit(`upload:${user.id}`, 60, 60 * 60 * 1000);
    const { worldId } = await ctx.params;
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw invalid("Attach a file.");
    const replace = form.get("replace");
    if (typeof replace === "string" && replace) {
      await replaceAsset(user.id, worldId, replace, file);
      return { id: replace };
    }
    const asset = await uploadAsset(user.id, worldId, file, { kind: form.get("kind") ?? undefined, altText: form.get("altText") ?? undefined });
    return { id: asset.id, url: `/api/assets/${asset.id}` };
  });
}
