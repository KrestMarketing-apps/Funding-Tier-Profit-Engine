import { NextResponse } from "next/server";

const COOKIE = "ft_gate";
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

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

export async function POST(req: Request) {
  const secret = process.env.SITE_PASSWORD;
  const origin = new URL(req.url).origin;
  if (!secret) return new NextResponse("Not configured", { status: 503 });

  const form = await req.formData();
  const password = String(form.get("password") || "");
  const nextPath = String(form.get("next") || "/");
  const dest = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";

  const len = Math.max(password.length, secret.length);
  if (!safeEqual(password.padEnd(len, "\0"), secret.padEnd(len, "\0"))) {
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.redirect(
      `${origin}/login?e=1${dest !== "/" ? `&next=${encodeURIComponent(dest)}` : ""}`,
      { status: 303 }
    );
  }

  const exp = String(Date.now() + MAX_AGE_S * 1000);
  const res = NextResponse.redirect(`${origin}${dest}`, { status: 303 });
  res.cookies.set(COOKIE, `${exp}.${await sign(exp, secret)}`, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: MAX_AGE_S,
  });
  return res;
}
