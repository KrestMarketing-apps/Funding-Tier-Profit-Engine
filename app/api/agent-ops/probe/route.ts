import { NextResponse } from 'next/server';
import { ghlConfigs, probe } from '../../../../lib/agentOps/ghl';
import { requireAdmin } from '../../../../lib/agentOps/guard';

/**
 * "Does this token actually work, and what shape does this account return?"
 * Run once after setting the environment variables, before trusting a sync.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = requireAdmin();
  if (admin.ok === false) return NextResponse.json({ error: admin.error }, { status: 403 });

  const configs = ghlConfigs();
  if (configs.length === 0) {
    return NextResponse.json({
      error: 'No GoHighLevel configuration found. Set GHL_TOKENS and GHL_LOCATION_IDS.',
    }, { status: 400 });
  }
  const results = await Promise.all(configs.map(async (cfg) => ({
    locationId: cfg.locationId,
    checks: await probe(cfg),
  })));
  return NextResponse.json({ ok: true, results });
}
