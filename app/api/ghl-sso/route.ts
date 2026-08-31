import { NextResponse } from "next/server";
import { decryptUserContext, resolveRole, tenantAllowed } from "../../../lib/ghl";
import { COOKIE, COOKIE_OPTS, MAX_AGE_S, signSession } from "../../../lib/session";

// node:crypto (MD5 key derivation) is not available on the edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ssoKey = process.env.GHL_APP_SSO_KEY;
  const secret = process.env.SESSION_SECRET || process.env.SITE_PASSWORD;
  if (!ssoKey || !secret) {
    return NextResponse.json({ error: "sso_not_configured" }, { status: 503 });
  }

  let key: string | undefined;
  try {
    key = (await req.json())?.key;
  } catch {
    /* fall through to the 400 below */
  }
  if (!key || typeof key !== "string") {
    return NextResponse.json({ error: "missing_key" }, { status: 400 });
  }

  let user;
  try {
    user = decryptUserContext(key, ssoKey);
  } catch {
    // Wrong shared secret, or a payload that did not come from GoHighLevel.
    return NextResponse.json({ error: "bad_payload" }, { status: 401 });
  }

  // First-run helper: until GHL_COMPANY_ID is set there is nothing to compare
  // against, so hand back the IDs to paste into Vercel. Only someone holding
  // the shared secret can get this far, so it reveals nothing new.
  if (!process.env.GHL_COMPANY_ID?.trim()) {
    return NextResponse.json(
      {
        error: "tenant_not_configured",
        hint: "Set GHL_COMPANY_ID (and optionally GHL_ALLOWED_LOCATIONS) in Vercel to these values.",
        companyId: user.companyId,
        activeLocation: user.activeLocation,
      },
      { status: 503 }
    );
  }

  if (!tenantAllowed(user)) {
    return NextResponse.json({ error: "wrong_tenant" }, { status: 403 });
  }

  const role = resolveRole(user);
  if (!role || !user.email) {
    return NextResponse.json({ error: "no_role" }, { status: 403 });
  }

  const token = await signSession(
    { email: user.email, name: user.userName, role, loc: user.activeLocation },
    secret,
    MAX_AGE_S
  );

  const res = NextResponse.json({ ok: true, role, email: user.email, name: user.userName });
  res.cookies.set(COOKIE, token, COOKIE_OPTS);
  return res;
}
