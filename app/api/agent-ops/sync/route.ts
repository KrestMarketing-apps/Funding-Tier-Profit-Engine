import { NextRequest, NextResponse } from 'next/server';
import { runSync } from '../../../../lib/agentOps/sync';
import { requireAdmin } from '../../../../lib/agentOps/guard';

/** Manual "sync now", from the dashboard. Session-gated like every other page. */
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const admin = requireAdmin();
  if (admin.ok === false) return NextResponse.json({ error: admin.error }, { status: 403 });

  const body = await req.json().catch(() => ({} as any));
  try {
    const result = await runSync({ sinceHours: Number(body?.hours) || undefined });
    return NextResponse.json({ ok: result.errors.length === 0, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
