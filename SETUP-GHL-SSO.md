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
5. Add two **Custom Page** modules:
   - Funding Tier Agent Tools -> `https://ai.fundingtier.com/agent-tools`
   - Funding Tier Profit Engine -> `https://ai.fundingtier.com/profit-engine`
   Leave microphone and camera permissions off.
6. Install the app on the Funding Tier sub-account.

### 2. Set the environment variables (both Vercel projects)

| Variable | Value |
| --- | --- |
| `GHL_APP_SSO_KEY` | the shared secret from step 1 |
| `SESSION_SECRET` | a fresh random string, 32+ chars — `openssl rand -hex 32`. Required: with it unset the tools return 503 rather than letting anyone in unidentified. |
| `GHL_COMPANY_ID` | the agency ID (see below) |
| `GHL_ALLOWED_LOCATIONS` | optional, comma-separated sub-account IDs |
| `PUBLIC_ORIGIN` | `https://ai.fundingtier.com` — required, see below |
| `GHL_FRAME_ANCESTORS` | optional, the white-label domain if the default list misses it |
| `DATABASE_URL` | set for you when you add Postgres from the Vercel dashboard — see Access log |

Use the **same** `SESSION_SECRET` in both projects. Both tools are served from
`ai.fundingtier.com`, so they share one cookie on one domain — different
secrets would make each app reject the other's cookie and bounce people back
through sign-in repeatedly.

**`PUBLIC_ORIGIN` is not optional here.** A Vercel rewrite to another project is
a proxy: the request reaches the deployment carrying its own `*.vercel.app`
hostname, so any redirect built from the incoming URL would drop the user off
the branded domain mid-login. Middleware cannot use a relative `Location`
either — Next parses it as an absolute URL and throws. Stating the public
origin is what keeps sign-in on `ai.fundingtier.com`.

**Finding the agency ID:** leave `GHL_COMPANY_ID` unset, open the tool from the
sidebar once, and the page prints the `companyId` and sub-account ID it just
received. Paste them in and redeploy. (That message only appears to someone
whose payload decrypted correctly, so it is not a leak.)

### 3. Serving under ai.fundingtier.com

Both tools are separate Vercel projects proxied through the
`funding-tier-ai-router` project, which owns `ai.fundingtier.com`. Its
`vercel.json` carries the rewrites, and its `X-Frame-Options: SAMEORIGIN`
header is scoped to exclude `/profit-engine` and `/agent-tools` — left on
`/(.*)`, it would have stopped GoHighLevel framing either tool.

Each app is built with a matching `basePath`, so its own routes and assets
already carry the prefix and the rewrite passes the path through unchanged.
Anything written by hand — `<img src>`, `<link href>`, `fetch()` targets, form
actions, redirect `Location` headers — goes through `lib/paths.ts`, because
Next does not prefix those.

Custom page role visibility, if the marketplace offers it, is presentation
only. The real enforcement is `middleware.ts` checking the signed cookie on
every request.

Any URL in either tool works as an entry point. `/login` runs the GoHighLevel
handshake when it is inside an iframe and shows the password form when it is
not, so someone opening `/profit-engine/operating-model` is signed in and
forwarded to the page they asked for. `/ghl` is kept as an alias to `/login`
for anything already pointing at it.

## Testing it

1. Sign in as an ACCOUNT-USER (e.g. `enrollmentft01@fundingtier.com`). Agent
   Tools should open. Visiting the Profit Engine URL directly should land on
   "Admin access only".
2. Sign in as an ACCOUNT-ADMIN (e.g. `daniel@fundingtier.com`). Both open.
3. Open a tool URL in a normal browser tab, outside the app. It should say
   "Open this from the sidebar" — there is no password to fall back to.
4. Watch the address bar through a sign-in. It must stay on
   `ai.fundingtier.com` throughout — a jump to `*.vercel.app` means
   `PUBLIC_ORIGIN` is unset on that project.

## Access log

There is no shared password. The only way in is a Krest Marketing App account,
so every session carries a real person — which is what makes the log worth
keeping.

Events are written to a Postgres table. Vercel keeps runtime logs for **one day**
on Pro, which is fine for debugging and useless as an audit trail, so the
console line is only a fallback if the database write fails.

### Setting it up

1. Vercel dashboard → **Storage** → add **Neon** (Postgres) from the Marketplace.
2. Connect it to **both** projects. Vercel injects `DATABASE_URL` automatically.
3. Nothing else. The table is created on the first write —
   `create table if not exists` runs once per cold start, so there is no
   migration step to forget.

### Reading it

`https://ai.fundingtier.com/profit-engine/access-log` — admin-only, because it
sits behind the same middleware as the rest of the Profit Engine. Filter by
email, event type and date range. Both tools write to the same table, so it is
one view across both.

| event | meaning |
| --- | --- |
| `signin` | someone opened a tool and was let in |
| `denied_role` | an agent reached for something admin-only, with the path they tried |
| `denied_tenant` | a payload from an agency that is not yours |
| `denied_norole` | a GHL user whose role maps to no access here |

Each row records time, email, name, GHL role, tool, sub-account, path and IP.

Sign-ins are logged, not page views. Sessions last 12 hours, so the log answers
"who opened which tool, and when" rather than every click. If you ever want
per-page detail, that is a change to `middleware.ts` — but it is a database
write on every request, for detail you would rarely read.

A failed database write never blocks or slows a sign-in; the event still
reaches the runtime log.

## No password fallback

Deliberately. If the Marketplace app is ever uninstalled or the shared secret
is rotated wrongly, nobody can open the tools until it is fixed — including
you. That is the trade for knowing who did what. To restore access in an
emergency, fix the app in the marketplace; the tools recover on the next page
load with no redeploy.

## Reusing this on the other Funding Tier projects

`lib/session.ts`, `lib/ghl.ts`, `app/ghl/page.tsx` and `app/api/ghl-sso/route.ts`
are self-contained and dependency-free. Copy those four files into another
Next.js project, copy the middleware and `lib/paths.ts`, set the same env vars, and set
`REQUIRED_ROLE` (or `ALLOWED_ROLES`) for that tool.

Note that `lib/ghl.ts` uses `node:crypto`, so any route importing it must
declare `export const runtime = "nodejs"`. Middleware stays on the edge runtime
because it only verifies the app's own cookie.
