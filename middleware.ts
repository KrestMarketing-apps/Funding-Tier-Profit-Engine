import { NextRequest, NextResponse } from "next/server";
import { COOKIE, readSession } from "./lib/session";

/**
 * Profit Engine holds the cost and margin model, so it is admin-only.
 * Sub-account Users (agents) are sent to /no-access instead.
 */
const REQUIRED_ROLE = "admin";

// Reachable without a session. /login is a plain server-rendered form and /ghl
// carries its script inline, so neither needs a JS bundle — which is why
// /_next/* can stay gated and the app's compiled code stays private.
const OPEN = ["/login", "/api/login", "/ghl", "/api/ghl-sso", "/no-access"];
const OPEN_FILES = [
  "/favicon.ico",
  "/favicon-32x32.png",
  "/apple-touch-icon.png",
  "/android-chrome-192x192.png",
];

export async function middleware(req: NextRequest) {
  const secret = process.env.SESSION_SECRET || process.env.SITE_PASSWORD;
  if (!secret) {
    return new NextResponse("This site is not configured for access yet.", { status: 503 });
  }

  const { pathname } = req.nextUrl;
  if (OPEN.some((p) => pathname === p || pathname.startsWith(p + "/")) || OPEN_FILES.includes(pathname)) {
    return NextResponse.next();
  }

  const session = await readSession(req.cookies.get(COOKIE)?.value, secret);

  if (session && session.role === REQUIRED_ROLE) {
    const res = NextResponse.next();
    // Handy for server components and for support questions ("who was this?").
    res.headers.set("x-ft-user", session.email);
    res.headers.set("x-ft-role", session.role);
    return res;
  }

  // Assets: 404 rather than redirect, so a browser never parses an HTML
  // redirect as JavaScript or CSS.
  if (pathname.startsWith("/_next") || /\.[a-z0-9]+$/i.test(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  const url = req.nextUrl.clone();
  url.search = "";

  if (session) {
    // Signed in, wrong level. Saying so beats bouncing them to a login form
    // they have no better password for.
    url.pathname = "/no-access";
  } else {
    url.pathname = "/login";
    if (pathname !== "/") url.search = `?next=${encodeURIComponent(pathname)}`;
  }

  const res = NextResponse.redirect(url);
  res.headers.set("x-robots-tag", "noindex, nofollow");
  return res;
}

export const config = { matcher: ["/(.*)"] };
