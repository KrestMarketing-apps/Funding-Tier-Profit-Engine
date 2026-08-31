// Decrypts the user context GoHighLevel hands a custom page.
//
// GHL encrypts with CryptoJS's AES passphrase mode, which is OpenSSL's
// "Salted__" envelope: 8 magic bytes, 8 salt bytes, then AES-256-CBC
// ciphertext, with key+IV derived by the legacy EVP_BytesToKey MD5 ladder.
// node:crypto covers all of it, so there is no dependency to add — but it
// means any route importing this file must run on the Node runtime, not edge.

import { createDecipheriv, createHash } from "crypto";
import type { Role } from "./session";

export type GhlUserContext = {
  userId?: string;
  userName?: string;
  email?: string;
  /** "admin" | "user" */
  role?: string;
  /** "agency" | "location" */
  type?: string;
  companyId?: string;
  activeLocation?: string;
  isAgencyOwner?: boolean;
};

export function decryptUserContext(encrypted: string, ssoKey: string): GhlUserContext {
  const KEY_SIZE = 32;
  const IV_SIZE = 16;

  const raw = Buffer.from(encrypted, "base64");
  if (raw.subarray(0, 8).toString("utf8") !== "Salted__") {
    throw new Error("payload is not an OpenSSL salted envelope");
  }
  const salt = raw.subarray(8, 16);
  const cipherText = raw.subarray(16);

  // EVP_BytesToKey(md5, salt, passphrase) — concatenate MD5 rounds until we
  // have enough bytes for the key and the IV.
  let derived = Buffer.alloc(0);
  while (derived.length < KEY_SIZE + IV_SIZE) {
    derived = Buffer.concat([
      derived,
      createHash("md5")
        .update(Buffer.concat([derived.subarray(-IV_SIZE), Buffer.from(ssoKey, "utf8"), salt]))
        .digest(),
    ]);
  }

  const decipher = createDecipheriv(
    "aes-256-cbc",
    derived.subarray(0, KEY_SIZE),
    derived.subarray(KEY_SIZE, KEY_SIZE + IV_SIZE)
  );
  const plain = Buffer.concat([decipher.update(cipherText), decipher.final()]);
  return JSON.parse(plain.toString("utf8"));
}

/**
 * Which tenant is allowed in.
 *
 * Without this, anyone who installed the app in their own GoHighLevel agency
 * would hold a payload that decrypts cleanly and hands them a session. The
 * company ID is the hard gate; the location list is optional and narrows it
 * further to specific sub-accounts.
 */
export function tenantAllowed(user: GhlUserContext): boolean {
  const company = process.env.GHL_COMPANY_ID?.trim();
  if (!company || user.companyId !== company) return false;

  const allowed = (process.env.GHL_ALLOWED_LOCATIONS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Agency-level users have no activeLocation; they are covered by companyId.
  if (allowed.length === 0 || user.type === "agency") return true;
  return !!user.activeLocation && allowed.includes(user.activeLocation);
}

/**
 * GoHighLevel role -> access level.
 *
 *   AGENCY-ADMIN   (type agency,   role admin) -> admin
 *   ACCOUNT-ADMIN  (type location, role admin) -> admin
 *   ACCOUNT-USER   (type location, role user)  -> agent
 *   AGENCY-USER    (type agency,   role user)  -> agent
 *
 * The role field decides, not the agency/location split: an agency-level user
 * who is not an admin is still not an admin here. Anything unrecognised is
 * refused rather than defaulted, so a future GHL role value cannot quietly
 * inherit admin.
 */
export function resolveRole(user: GhlUserContext): Role | null {
  if (user.isAgencyOwner === true) return "admin";
  const role = (user.role || "").toLowerCase();
  if (role === "admin") return "admin";
  if (role === "user") return "agent";
  return null;
}
