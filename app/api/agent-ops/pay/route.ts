import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../../lib/agentOps/db';
import { requireAdmin } from '../../../../lib/agentOps/guard';
import { recomputeCloserPay, payPayload } from '../../../../lib/agentOps/closerPayJob';

/**
 * Closer pay — what every closer is owed, and the record of what we paid.
 *
 *   GET                         deals, pay runs with their lines, per-closer reconciliation
 *   POST { action: 'record' }   record a payment actually made to a closer
 *   POST { action: 'void' }     void a recorded payment (reversed in the ledger, never deleted)
 *   POST { action: 'recompute' }
 *
 * A payment's lines must add up to its amount. Commission lines are positive;
 * a clawback recovered out of the same payment is its own line. The ledger is
 * append-only, so voiding writes reversing lines rather than erasing history.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET() {
  const admin = requireAdmin();
  if (admin.ok === false) return NextResponse.json({ error: admin.error }, { status: 403 });
  return NextResponse.json(await payPayload());
}

export async function POST(req: NextRequest) {
  const admin = requireAdmin();
  if (admin.ok === false) return NextResponse.json({ error: admin.error }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Send JSON.' }, { status: 400 });

  try {
    if (body.action === 'recompute') {
      return NextResponse.json({ ok: true, result: await recomputeCloserPay() });
    }

    if (body.action === 'void') {
      const runId = Number(body.runId);
      if (!String(body.reason ?? '').trim()) throw new Error('Voiding a payment needs a reason.');
      const run = (await query<any>(`select * from ao_pay_runs where id = $1 and voided_at is null`, [runId]))[0];
      if (!run) throw new Error('No such payment, or it is already voided.');
      await query(`update ao_pay_runs set voided_at = now(), voided_by = $2, note = coalesce(note || ' · ', '') || $3 where id = $1`,
        [runId, admin.email, `VOID: ${String(body.reason).trim()}`]);
      await query(
        `insert into ao_comp_ledger (deal_id, agent_id, kind, amount, basis, period, created_by, note, run_id)
         select deal_id, agent_id, kind, -amount, basis, period, $2, 'void of run ' || $1::text, run_id
           from ao_comp_ledger where run_id = $1 and coalesce(note, '') not like 'void%'`,
        [runId, admin.email],
      );
      return NextResponse.json({ ok: true, voided: runId, result: await recomputeCloserPay() });
    }

    if (body.action === 'record') {
      const agentId = String(body.agentId ?? '');
      const payDate = String(body.payDate ?? '');
      const amount = Number(body.amount);
      const lines: Array<{ dealId: string; amount: number; kind?: string }> = Array.isArray(body.lines) ? body.lines : [];
      if (!agentId || !/^\d{4}-\d{2}-\d{2}$/.test(payDate)) throw new Error('Closer and pay date are required.');
      if (!Number.isFinite(amount) || amount < 0) throw new Error('Amount must be a number.');
      if (!lines.length) throw new Error('Pick the deals this payment covers — every dollar paid is tied to a deal.');
      const net = lines.reduce((s, l) => s + (l.kind === 'clawback_recovered' ? -Math.abs(l.amount) : Number(l.amount)), 0);
      if (Math.abs(net - amount) >= 0.01) {
        throw new Error(`The deal lines add up to $${net.toFixed(2)} but the payment is $${amount.toFixed(2)}. They must match.`);
      }
      const known = await query<any>(`select deal_id from ao_closer_pay where agent_id = $1 and deal_id = any($2)`,
        [agentId, lines.map((l) => l.dealId)]);
      const knownIds = new Set(known.map((k) => k.deal_id));
      const stray = lines.filter((l) => !knownIds.has(l.dealId));
      if (stray.length) throw new Error(`These deals are not credited to this closer: ${stray.map((l) => l.dealId).join(', ')}`);

      const run = (await query<any>(
        `insert into ao_pay_runs (agent_id, pay_date, amount, method, reference, note, recorded_by)
         values ($1,$2,$3,$4,$5,$6,$7) returning id`,
        [agentId, payDate, amount, body.method ?? null, body.reference ?? null, body.note ?? null, admin.email],
      ))[0];
      for (const l of lines) {
        const kind = l.kind === 'clawback_recovered' ? 'clawback_recovered' : 'commission_paid';
        await query(
          `insert into ao_comp_ledger (deal_id, agent_id, kind, amount, basis, period, created_by, note, run_id)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [l.dealId, agentId, kind, Math.abs(Number(l.amount)), kind === 'commission_paid' ? 'commission' : 'clawback',
            payDate, admin.email, body.reference ?? null, run.id],
        );
      }
      return NextResponse.json({ ok: true, runId: run.id, result: await recomputeCloserPay() });
    }

    throw new Error('Unknown action.');
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 400 });
  }
}
