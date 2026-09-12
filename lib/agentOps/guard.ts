import { headers } from 'next/headers';

/**
 * Route-level admin check.
 *
 * Middleware already admits admins only, so this is belt and braces — but an
 * override writes to the record with a name attached, and that name has to
 * come from the session rather than from the request body.
 */
export function requireAdmin(): { ok: true; email: string } | { ok: false; error: string } {
  const h = headers();
  const role = h.get('x-ft-role');
  const email = h.get('x-ft-user');
  if (role !== 'admin' || !email) {
    return { ok: false, error: 'Admin session required.' };
  }
  return { ok: true, email };
}
