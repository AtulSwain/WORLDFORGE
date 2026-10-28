import "server-only";
import { unauthenticated } from "../errors";
import { getCurrentUser, type SessionUser } from "./session";

/** Route-handler variant of requireUser: throws instead of redirecting. */
export async function requireApiUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthenticated();
  return user;
}
