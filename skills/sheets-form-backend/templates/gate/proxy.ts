// Pre-launch gate. Next.js 16 calls this file proxy.ts (export `proxy`); on Next 15 and older
// name it middleware.ts and export `middleware` instead. Delete it to open the site.
//
// Visitors without the access cookie see the gate page at whatever URL they asked for.
// A blank or missing SITE_PASSWORD keeps the site locked (fail closed).

import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, accessToken } from "@/lib/access";

const GATE = "/coming-soon";
// Routes that stay reachable while locked: the gate itself and the form endpoints it uses.
const PUBLIC = [GATE, "/api/submit"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();

  const password = process.env.SITE_PASSWORD;
  const cookie = request.cookies.get(ACCESS_COOKIE)?.value;
  if (password && cookie === (await accessToken(password))) return NextResponse.next();

  return NextResponse.rewrite(new URL(GATE, request.url));
}

export const config = {
  // Everything except build assets and files with an extension (images, robots.txt, ...).
  matcher: ["/((?!_next/static|_next/image|.*\\.\\w+$).*)"],
};
