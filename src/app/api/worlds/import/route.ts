import { unzipSync } from "fflate";
import { requireApiUser } from "@/server/auth/api";
import { assertSameOrigin, toFailure } from "@/server/action-utils";
import { HTTP_STATUS, invalid } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";
import { importUniverse } from "@/server/services/transfer";

const MAX_FILE = 25 * 1024 * 1024;
const MAX_JSON = 60 * 1024 * 1024;

function readJson(bytes: Uint8Array, filename: string): unknown {
  let jsonBytes = bytes;
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (isZip) {
    let tooBig = false;
    const files = unzipSync(bytes, {
      // Only extract the canonical file, and refuse anything that would inflate past the limit.
      filter: (f) => {
        if (f.name !== "universe.json" && !f.name.endsWith("/universe.json")) return false;
        if (f.originalSize > MAX_JSON) tooBig = true;
        return !tooBig;
      },
    });
    if (tooBig) throw invalid("universe.json inside the zip is too large.");
    const entry = Object.values(files)[0];
    if (!entry) throw invalid("The zip does not contain a universe.json file.");
    jsonBytes = entry;
  } else if (!filename.toLowerCase().endsWith(".json")) {
    throw invalid("Upload a WorldForge .json export or .zip bundle.");
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(jsonBytes));
  } catch {
    throw invalid("The file is not valid JSON.");
  }
}

/** Imports an export as a new universe. Returns a validation report (422) when the file is rejected. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireApiUser();
    rateLimit(`import:${user.id}`, 10, 60 * 60 * 1000);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw invalid("Attach an export file.");
    if (file.size > MAX_FILE) throw invalid("The file is larger than 25 MB.");
    const raw = readJson(new Uint8Array(await file.arrayBuffer()), file.name);
    const name = form.get("name");
    const result = await importUniverse(user.id, raw, { name: typeof name === "string" ? name : undefined });
    if (!result.ok) return Response.json({ error: "The file did not pass validation. Nothing was imported.", issues: result.issues }, { status: 422 });
    return Response.json(result);
  } catch (e) {
    const f = toFailure(e);
    const status = f.code && f.code in HTTP_STATUS ? HTTP_STATUS[f.code as keyof typeof HTTP_STATUS] : 500;
    return Response.json({ error: f.error }, { status });
  }
}
