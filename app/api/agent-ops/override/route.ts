import { NextRequest, NextResponse } from 'next/server';
import { applyOverride, listOverrides } from '../../../../lib/agentOps/overrides';
import { requireAdmin } from '../../../../lib/agentOps/guard';

/** Admin edits to synced data. Always logged, always attributed, always flagged. */
export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = requireAdmin();
  if (admin.ok === false) return NextResponse.json({ error: admin.error }, { status: 403 });
  return NextResponse.json({ ok: true, overrides: await listOverrides() });
}

export async function POST(req: NextRequest) {
  const admin = requireAdmin();
  if (admin.ok === false) return NextResponse.json({ error: admin.error }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Send JSON.' }, { status: 400 });

  try {
    const record = await applyOverride({
      entity: String(body.entity ?? ''),
      entityId: String(body.entityId ?? ''),
      field: String(body.field ?? ''),
      newValue: body.newValue === null ? null : String(body.newValue),
      reason: String(body.reason ?? ''),
      day: body.day ? String(body.day) : undefined,
      adminEmail: admin.email,
    });
    return NextResponse.json({ ok: true, override: record });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 400 });
  }
}
