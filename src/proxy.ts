import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic redirect for signed-out visitors. This only checks for the presence of the
 * session cookie — real authentication and authorization happen on the server for every
 * page, action and route handler.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("wf_session");
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/worlds/:path*", "/settings/:path*"],
};
