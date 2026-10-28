import { getCurrentUser } from "@/server/auth/session";
import { AppError, HTTP_STATUS } from "@/server/errors";
import { readAsset } from "@/server/services/assets";
import { storage } from "@/server/storage";

/** Serves an asset only to members of its universe. */
export async function GET(req: Request, ctx: RouteContext<"/api/assets/[assetId]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not found", { status: 404 });
  const { assetId } = await ctx.params;
  try {
    const thumb = new URL(req.url).searchParams.get("thumb") === "1";
    const { asset, key, mime } = await readAsset(user.id, assetId, thumb);
    const s = storage();
    if (s.signedUrl) return Response.redirect(await s.signedUrl(key, 300), 302);
    const body = await s.get(key);
    if (!body) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": mime,
        "Content-Length": String(body.length),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        "Content-Disposition": `${mime === "application/pdf" || mime.startsWith("image/") ? "inline" : "attachment"}; filename="${asset.filename.replace(/"/g, "")}"`,
      },
    });
  } catch (e) {
    if (e instanceof AppError) return new Response(e.message, { status: e.code === "FORBIDDEN" ? 404 : HTTP_STATUS[e.code] });
    console.error("[worldforge] asset read failed", e);
    return new Response("Error", { status: 500 });
  }
}
