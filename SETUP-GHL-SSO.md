# Signing in with Krest Marketing App (GoHighLevel) accounts

The two Funding Tier tools no longer need their own shared passwords. A person
who is already signed in to the Krest Marketing App clicks the tool in the
sidebar and lands inside it, carrying their real identity and role.

| Krest Marketing App role | Profit Engine | Agent Tools |
| --- | --- | --- |
| AGENCY-ADMIN | yes | yes |
| ACCOUNT-ADMIN | yes | yes |
| ACCOUNT-USER | no — sees "Admin access only" | yes |
| AGENCY-USER | no | yes |

Role comes from the account, so adding, removing or demoting someone in the
Krest Marketing App changes their access to these tools immediately. There is
no separate user list to maintain.

## How it works

GoHighLevel loads the tool in an iframe. The page asks the parent window for
the signed-in user, GHL answers with an AES-encrypted blob, and the tool
decrypts it server-side using a shared secret only the two of them know. What
comes back is the user's email, role, agency ID and sub-account ID. The tool
then issues its own short-lived signed cookie (12 hours) so every later request
is cheap to check.

The encrypted blob is the whole security story, so two things matter: the
shared secret never goes near the browser, and the agency ID is checked on
every sign-in. Without that second check, anyone who installed the same app in
their own GoHighLevel agency would hold a payload that decrypts cleanly.

## Setup

### 1. Create a private Marketplace app (once, agency level)

1. Go to the GoHighLevel Marketplace developer area and create a new app.
2. Keep it **private / unlisted** — this is internal, it should never be listed.
3. Distribution type: Sub-Account (add Agency too if agency users need it).
4. Under **Advanced Settings → Auth**, click **Generate** under *Shared Secret*.
   Copy the value. This is `GHL_APP_SSO_KEY`.
5. Add a **Custom Page** module pointing at
   `https://funding-tier-profit-engine.vercel.app/ghl`
6. Install the app on the Funding Tier sub-account.

### 2. Set the environment variables (both Vercel projects)

| Variable | Value |
| --- | --- |
| `GHL_APP_SSO_KEY` | the shared secret from step 1 |
| `SESSION_SECRET` | a fresh random string, 32+ chars — `openssl rand -hex 32`. Falls back to `SITE_PASSWORD` if unset, so deploying before you finish setup does not lock anyone out. |
| `GHL_COMPANY_ID` | the agency ID (see below) |
| `GHL_ALLOWED_LOCATIONS` | optional, comma-separated sub-account IDs |
| `GHL_FRAME_ANCESTORS` | optional, the white-label domain if the default list misses it |
| `SITE_PASSWORD` | keep — password fallback for use outside the app |

Use the **same** `SESSION_SECRET` in both projects only if you want one sign-in
to cover both; different values mean each tool signs people in separately.
Either is fine.

**Finding the agency ID:** leave `GHL_COMPANY_ID` unset, open the tool from the
sidebar once, and the page prints the `companyId` and sub-account ID it just
received. Paste them in and redeploy. (That message only appears to someone
whose payload decrypted correctly, so it is not a leak.)

### 3. Add the menu links (agency level → Custom Menu Links)

**Profit Engine**
- URL: `https://funding-tier-profit-engine.vercel.app/ghl`
- Open as: **Embedded Page (iFrame)**
- Show to: **Admin** only
- Sub-account sidebar

**Agent Tools**
- URL: `https://<agent-tools-project>.vercel.app/ghl`
- Open as: **Embedded Page (iFrame)**
- Show to: **All**
- Sub-account sidebar

Role visibility on the menu link is presentation only — it hides the icon. The
real enforcement is in `middleware.ts`, which checks the signed cookie on every
request. Both are set, deliberately: agents should not see a link they cannot
open.

To deep-link a specific page, append `?next=`, e.g.
`/ghl?next=%2Foperating-model`.

## Testing it

1. Sign in as an ACCOUNT-USER (e.g. `enrollmentft01@fundingtier.com`). Agent
   Tools should open. Visiting the Profit Engine URL directly should land on
   "Admin access only".
2. Sign in as an ACCOUNT-ADMIN (e.g. `daniel@fundingtier.com`). Both open.
3. Open a tool URL in a normal browser tab, outside the app. It should say
   "Open this from the sidebar", or fall through to the password form.

## The password fallback

`/login` still works with `SITE_PASSWORD`, for use outside GoHighLevel and as
break-glass if the app is ever uninstalled. The Profit Engine password grants
admin; the Agent Tools password grants agent. Once the menu links are live you
can remove `SITE_PASSWORD` from either project to switch the fallback off — the
app then returns a 503 on `/login` and the sidebar becomes the only way in.

## Reusing this on the other Funding Tier projects

`lib/session.ts`, `lib/ghl.ts`, `app/ghl/page.tsx` and `app/api/ghl-sso/route.ts`
are self-contained and dependency-free. Copy those four files into another
Next.js project, copy the middleware, set the same env vars, and set
`REQUIRED_ROLE` (or `ALLOWED_ROLES`) for that tool.

Note that `lib/ghl.ts` uses `node:crypto`, so any route importing it must
declare `export const runtime = "nodejs"`. Middleware stays on the edge runtime
because it only verifies the app's own cookie.
