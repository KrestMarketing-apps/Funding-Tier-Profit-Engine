// Signed, role-bearing session token.
//
// Format: <base64url(json)>.<base64url(hmac-sha256)>
// Verified in middleware (edge runtime), so this file must stay on Web Crypto
// only — no node:crypto, no dependencies.

export type Role = "admin" | "agent";

export type Session = {
  /** Who they are, for display and audit. */
  email: string;
  name?: string;
  /** What they may reach. */
  role: Role;
  /** GHL sub-account they were in when they signed in. */
  loc?: string;
  /** Expiry, epoch ms. */
  exp: number;
};

const te = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
}

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    te.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, te.encode(payload));
  return b64url(new Uint8Array(sig));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function signSession(
  session: Omit<Session, "exp">,
  secret: string,
  maxAgeSeconds: number
): Promise<string> {
  const full: Session = { ...session, exp: Date.now() + maxAgeSeconds * 1000 };
  const payload = b64url(te.encode(JSON.stringify(full)));
  return `${payload}.${await hmac(payload, secret)}`;
}

export async function readSession(
  token: string | undefined,
  secret: string
): Promise<Session | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (!safeEqual(sig, await hmac(payload, secret))) return null;
  try {
    const session = JSON.parse(b64urlDecode(payload)) as Session;
    if (!session?.exp || session.exp < Date.now()) return null;
    if (session.role !== "admin" && session.role !== "agent") return null;
    return session;
  } catch {
    return null;
  }
}

/** Cookie name and lifetime, shared by the login route and the SSO route. */
export const COOKIE = "ft_session";
export const MAX_AGE_S = 60 * 60 * 12; // 12h — a work shift, then re-auth

/**
 * The session cookie has to survive being read inside GoHighLevel's iframe,
 * which is a cross-site context, so SameSite=None is required. Secure is
 * mandatory alongside it, and frame-ancestors (next.config.js) is what keeps
 * some other site from framing the app and riding the cookie.
 */
export const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "none" as const,
  path: "/",
  maxAge: MAX_AGE_S,
};
