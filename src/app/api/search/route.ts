import { requireApiUser } from "@/server/auth/api";
import { handleJson } from "@/server/action-utils";
import { search } from "@/server/services/search";
import { rateLimit } from "@/server/rate-limit";

export async function GET(req: Request) {
  return handleJson(async () => {
    const user = await requireApiUser();
    rateLimit(`search:${user.id}`, 120, 60_000);
    const url = new URL(req.url);
    const hits = await search(user.id, url.searchParams.get("q") ?? "", url.searchParams.get("worldId"));
    return { hits };
  });
}
