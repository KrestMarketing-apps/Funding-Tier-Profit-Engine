import { NextResponse } from "next/server";
import { COOKIE, COOKIE_OPTS, MAX_AGE_S, signSession } from "../../../lib/session";

export const runtime = "nodejs";

/**
 * Password fallback for use outside GoHighLevel — break-glass, and useful
 * while the menu link is being set up. Everyday access should come through
 * /ghl, which carries the person's real identity and role.
 */
export async function POST(req: Request) {
  const password = process.env.SITE_PASSWORD;
  const secret = process.env.SESSION_SECRET || process.env.SITE_PASSWORD;
  const origin = new URL(req.url).origin;
  if (!password || !secret) return new NextResponse("Not configured", { status: 503 });

  const form = await req.formData();
  const submitted = String(form.get("password") || "");
  const nextPath = String(form.get("next") || "/");
  const dest = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";

  const len = Math.max(submitted.length, password.length);
  const a = submitted.padEnd(len, "\0");
  const b = password.padEnd(len, "\0");
  let diff = 0;
  for (let i = 0; i < len; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);

  if (diff !== 0) {
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.redirect(
      `${origin}/login?e=1${dest !== "/" ? `&next=${encodeURIComponent(dest)}` : ""}`,
      { status: 303 }
    );
  }

  const token = await signSession(
    { email: "password-login@fundingtier.com", name: "Password login", role: "admin" },
    secret,
    MAX_AGE_S
  );

  const res = NextResponse.redirect(`${origin}${dest}`, { status: 303 });
  res.cookies.set(COOKIE, token, COOKIE_OPTS);
  return res;
}
