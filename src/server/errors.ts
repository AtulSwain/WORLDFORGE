/** Typed domain errors. Their messages are safe to show to users; anything else is logged and masked. */

export class AppError extends Error {
  constructor(
    message: string,
    readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "RATE_LIMITED" | "UNAVAILABLE",
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthenticated = () => new AppError("Please sign in to continue.", "UNAUTHENTICATED");
export const forbidden = (msg = "You do not have permission to do that.") => new AppError(msg, "FORBIDDEN");
export const notFound = (what = "Record") => new AppError(`${what} not found.`, "NOT_FOUND");
export const invalid = (msg: string, fieldErrors?: Record<string, string[]>) => new AppError(msg, "VALIDATION", fieldErrors);
export const conflict = (msg: string) => new AppError(msg, "CONFLICT");

export const HTTP_STATUS: Record<AppError["code"], number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  UNAVAILABLE: 503,
};
