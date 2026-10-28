import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ZodError, z } from "zod";
import { AppError, HTTP_STATUS } from "./errors";

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> };

/** Maps any thrown error to a safe, user-presentable result. Unexpected errors are logged, never leaked. */
export function toFailure(e: unknown): Extract<ActionResult, { ok: false }> {
  if (e instanceof AppError) return { ok: false, error: e.message, code: e.code, fieldErrors: e.fieldErrors };
  if (e instanceof ZodError) {
    const flat = z.flattenError(e);
    const fieldErrors = flat.fieldErrors as Record<string, string[]>;
    const first = flat.formErrors[0] ?? Object.values(fieldErrors)[0]?.[0] ?? "Some fields are invalid.";
    return { ok: false, error: first, code: "VALIDATION", fieldErrors };
  }
  if (isUniqueViolation(e)) return { ok: false, error: "That record already exists.", code: "CONFLICT" };
  console.error("[worldforge] unexpected error", e);
  return { ok: false, error: "Something went wrong on our side. Your change was not saved — please try again.", code: "INTERNAL" };
}

export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    unstable_rethrow(e);
    return toFailure(e);
  }
}

export function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

/** JSON route-handler wrapper with consistent error mapping. */
export async function handleJson<T>(fn: () => Promise<T>): Promise<Response> {
  try {
    return Response.json(await fn());
  } catch (e) {
    unstable_rethrow(e);
    const f = toFailure(e);
    const status = f.code && f.code in HTTP_STATUS ? HTTP_STATUS[f.code as keyof typeof HTTP_STATUS] : 500;
    return Response.json({ error: f.error, fieldErrors: f.fieldErrors }, { status });
  }
}

/** CSRF defence for cookie-authenticated route handlers that mutate state. */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) throw new AppError("Cross-site request blocked.", "FORBIDDEN");
  try {
    if (new URL(origin).host !== host) throw new Error("mismatch");
  } catch {
    throw new AppError("Cross-site request blocked.", "FORBIDDEN");
  }
}
