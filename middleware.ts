import { NextRequest, NextResponse } from "next/server";

const COOKIE = "ft_gate";

// Reachable without a session. The login page is a server-rendered plain form
// with no client JS, so /_next/* can stay fully gated — otherwise the app's
// JS bundles (and anything compiled into them) would be publicly downloadable.
const OPEN = ["/login", "/api/login"];
const OPEN_FILES = ["/favicon.ico", "/favicon-32x32.png", "/apple-touch-icon.png", "/android-chrome-192x192.png"];

function b64url(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return b64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function verify(token: string | undefined, secret: string) {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await sign(exp, secret));
}

export async function middleware(req: NextRequest) {
  const secret = process.env.SITE_PASSWORD;
  if (!secret) {
    return new NextResponse("This site is not configured for access yet.", { status: 503 });
  }

  const { pathname } = req.nextUrl;
  if (OPEN.some((p) => pathname.startsWith(p)) || OPEN_FILES.includes(pathname)) {
    return NextResponse.next();
  }

  if (await verify(req.cookies.get(COOKIE)?.value, secret)) return NextResponse.next();

  // Assets: 404 rather than redirect, so a browser never parses an HTML
  // redirect as JavaScript or CSS.
  if (pathname.startsWith("/_next") || /\.[a-z0-9]+$/i.test(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
  const res = NextResponse.redirect(url);
  res.headers.set("x-robots-tag", "noindex, nofollow");
  return res;
}

export const config = { matcher: ["/(.*)"] };
