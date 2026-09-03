import { headers } from "next/headers";
import type { Role } from "./session";

/**
 * The signed-in role, as edge middleware resolved it from the GoHighLevel
 * session (ACCOUNT-ADMIN / AGENCY-ADMIN -> "admin", ACCOUNT-USER -> "agent").
 *
 * Middleware forwards it on the request, so this is the single source of truth
 * for ToolShell's `mode` — no page hardcodes its own audience.
 *
 * Falls back to "agent", the lower privilege, if the header is ever missing.
 * On this app that cannot happen for a gated page (middleware admits admins
 * only), but a default that widens access on failure is the wrong default.
 */
export function getRole(): Role {
  return headers().get("x-ft-role") === "admin" ? "admin" : "agent";
}
