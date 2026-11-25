import { NextResponse, type NextRequest } from "next/server";
import { parseRole, redirectFor, ROLE_COOKIE } from "@/lib/roleRoutes";

// The one place that sends each role to its own pages (rules in lib/roleRoutes.ts). Reads only the role cookie,
// no API call. Only routing: the backend's guards decide what anyone gets
export function proxy(request: NextRequest) {
  const to = redirectFor(request.nextUrl.pathname, parseRole(request.cookies.get(ROLE_COOKIE)?.value));
  return to ? NextResponse.redirect(new URL(to, request.url)) : NextResponse.next();
}

// Pages only: not the /api rewrite, Next's own files or anything with an extension (icons, sw.js, manifest)
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
