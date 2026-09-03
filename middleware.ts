import { NextFetchEvent, NextRequest, NextResponse } from "next/server";
import { COOKIE, readSession, type Role } from "./lib/session";
import { url } from "./lib/paths";
import { logAccess } from "./lib/audit";

/**
 * Profit Engine holds the cost and margin model, so it is admin-only.
 * Sub-account Users (agents) are sent to /no-access instead.
 */
const ALLOWED_ROLES: Role[] = ["admin"];

// Reachable without a session. /login carries its script inline and needs no
// JS bundle, which is why /_next/* can stay gated and the app's compiled code
// stays private.
const OPEN = ["/login", "/ghl", "/api/ghl-sso", "/no-access"];
const OPEN_FILES = [
  "/favicon.ico",
  "/favicon-32x32.png",
  "/apple-touch-icon.png",
  "/android-chrome-192x192.png",
];

function redirect(req: NextRequest, path: string, search = "") {
  const res = NextResponse.redirect(url(req.nextUrl.origin, path, search), 307);
  res.headers.set("x-robots-tag", "noindex, nofollow");
  return res;
}

export async function middleware(req: NextRequest, event: NextFetchEvent) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return new NextResponse("This site is not configured for access yet.", { status: 503 });
  }

  // Next strips basePath before middleware sees it, so these stay unprefixed.
  const { pathname } = req.nextUrl;
  if (OPEN.some((o) => pathname === o || pathname.startsWith(o + "/")) || OPEN_FILES.includes(pathname)) {
    return NextResponse.next();
  }

  const session = await readSession(req.cookies.get(COOKIE)?.value, secret);

  if (session && ALLOWED_ROLES.includes(session.role)) {
    // Forwarded on the REQUEST so server components can read the role via
    // next/headers — a response header never reaches them. Pages use this to
    // drive ToolShell's mode instead of hardcoding it per page.
    const forwarded = new Headers(req.headers);
    forwarded.set("x-ft-user", session.email);
    forwarded.set("x-ft-role", session.role);

    const res = NextResponse.next({ request: { headers: forwarded } });
    // Also on the response, for support questions ("who was this?").
    res.headers.set("x-ft-user", session.email);
    res.headers.set("x-ft-role", session.role);
    return res;
  }

  // Assets: 404 rather than redirect, so a browser never parses an HTML
  // redirect as JavaScript or CSS.
  if (pathname.startsWith("/_next") || /\.[a-z0-9]+$/i.test(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  if (session) {
    // Signed in, wrong level. Worth recording: someone reaching for a tool
    // above their role is exactly what an access log is for.
    event.waitUntil(
      Promise.resolve(
        logAccess({
          event: "denied_role",
          email: session.email,
          role: session.role,
          location: session.loc,
          path: pathname,
          ip: req.headers.get("x-forwarded-for") ?? undefined,
        })
      )
    );
    return redirect(req, "/no-access");
  }
  return redirect(req, "/login", pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`);
}

