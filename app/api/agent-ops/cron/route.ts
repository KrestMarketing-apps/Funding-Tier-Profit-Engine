import { NextRequest, NextResponse } from 'next/server';
import { runSync } from '../../../../lib/agentOps/sync';

/**
 * Scheduled sync entry point.
 *
 * Open to middleware (there is no session on a cron request) and closed by a
 * shared secret instead: CRON_SECRET must arrive as a Bearer token or in
 * x-cron-key. Without the secret configured the route refuses outright rather
 * than running unauthenticated.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });
  }
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  const key = req.headers.get('x-cron-key')?.trim();
  if (bearer !== secret && key !== secret) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 });
  }

  const hours = Number(req.nextUrl.searchParams.get('hours') || '') || undefined;
  try {
    const result = await runSync({ sinceHours: hours });
    return NextResponse.json({ ok: result.errors.length === 0, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
