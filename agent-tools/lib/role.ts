import { headers } from "next/headers";
import type { Role } from "./session";

/**
 * The signed-in role, as edge middleware resolved it from the GoHighLevel
 * session (ACCOUNT-ADMIN / AGENCY-ADMIN -> "admin", ACCOUNT-USER -> "agent").
 *
 * This app admits both, so the value genuinely varies here — unlike the Profit
 * Engine, where middleware only ever lets admins through.
 *
 * Falls back to "agent", the lower privilege, if the header is ever missing.
 */
export function getRole(): Role {
  return headers().get("x-ft-role") === "admin" ? "admin" : "agent";
}
