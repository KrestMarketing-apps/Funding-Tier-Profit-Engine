import { query } from './db';
import { reconcile, creditedAgent } from './recon';
import { evaluateCloserPay, PAY_RULES, type CloserPayVerdict, type SeparationType } from './closerPay';
import { fileKeyFor } from './imports';
import { ghlConfigs, ghlFetch } from './ghl';
import type { DealPayment, PaymentSchedule } from './vesting';
import type { Agent, BackendFile, BackendKey, Enrollment } from './types';
import {
  CONSUMER_SHIELD, DEFAULT_ASSUMPTIONS, LEGACY_CAPITAL, levelDebtCommission,
} from '../../components/fundingTierEngine';

/**
 * Rebuild ao_closer_pay: every enrolled deal, who is credited, what the
 * commission is, and where it stands against the pay rules.
 *
 * Inputs are all things that change underneath us — new drafts from a report
 * upload, a backend payout, a pay run recorded, a closer leaving — so the whole
 * table is recomputed rather than patched. It is small (one row per deal) and
 * the computation is pure, so this is cheap and always consistent.
 *
 * Runs after every sync, import, pay run and override.
 */

const CANCELLED = /cancel|refund|chargeback|void|dropped|withdraw/i;

/** Commission on one deal, from the same engine the simulators use. */
export function commissionFor(
  backend: BackendKey, debt: number, closerLevelVolumeThisMonth: number,
): { amount: number; basis: string } {
  const a = DEFAULT_ASSUMPTIONS;
  if (!debt || debt <= 0) return { amount: 0, basis: 'No enrolled debt on the file yet.' };
  if (backend === 'LEVEL') {
    const { amount, rate } = levelDebtCommission(debt, closerLevelVolumeThisMonth, a);
    return { amount, basis: `${(rate * 100).toFixed(2)}% of $${debt.toLocaleString('en-US')} enrolled (tier on $${Math.round(closerLevelVolumeThisMonth).toLocaleString('en-US')} Level volume that month)` };
  }
  if (backend === 'CS') {
    const prog = CONSUMER_SHIELD.getProgram(debt, a);
    return { amount: prog ? prog.commission : 0, basis: prog ? `Shield program ${prog.code} flat commission` : 'Below the Shield minimum.' };
  }
  if (backend === 'LEGACY') {
    const amount = LEGACY_CAPITAL.agentCommission(debt, a.legacy.feeRate, a);
    return { amount, basis: amount ? 'ELP band flat commission' : 'Below the ELP minimum band.' };
  }
  return { amount: 0, basis: 'No backend set on the deal.' };
}

const STATE_LABEL: Record<string, string> = {
  held: 'Pay held - plan type unconfirmed',
  awaiting_first_payment: 'Waiting on 1st payment',
  awaiting_backend: 'Waiting on backend payout',
  scheduled: 'Commission scheduled',
  due: 'Commission due',
  paid_at_risk: 'Paid - chargeback window',
  paid: 'Paid',
  clawback: 'Clawback owed',
  cancelled: 'Cancelled - no commission',
  forfeited: 'Forfeited',
  unmatched: 'No backend file yet',
};
export const payStateLabel = (s: string) => STATE_LABEL[s] ?? s;

export async function recomputeCloserPay(opts: { asOf?: string; pushToGhl?: boolean } = {}): Promise<{
  deals: number; byState: Record<string, number>; pushed: number; errors: string[];
}> {
  const [agentRows, enrollmentRows, fileRows, draftRows, ledgerRows, prevRows] = await Promise.all([
    query<any>(`select * from ao_agents`),
    query<any>(`select * from ao_enrollments where is_enrolled`),
    query<any>(`select * from ao_backend_files`),
    query<any>(`select * from ao_backend_drafts`),
    query<any>(`select deal_id, kind, sum(amount)::float as total from ao_comp_ledger
                 where kind in ('commission_paid', 'clawback_recovered') group by deal_id, kind`),
    query<any>(`select deal_id, ghl_pushed_status from ao_closer_pay`),
  ]);

  const agents: Agent[] = agentRows.map((r) => ({
    id: r.id, locationId: r.location_id, name: r.name ?? r.id, email: r.email, role: r.role,
    employmentType: r.employment_type, hourlyRate: null, scheduledHoursPerWeek: null, team: r.team, active: r.active !== false,
  }));
  const agentRow = new Map(agentRows.map((r) => [r.id, r]));

  const enrollments: Enrollment[] = enrollmentRows.map((r) => ({
    id: r.id, locationId: r.location_id, agentId: r.agent_id, closerId: r.closer_agent_id, closerSource: r.closer_source,
    isEnrolled: true, firstEnrolledAt: r.first_enrolled_at ? new Date(r.first_enrolled_at).toISOString() : null,
    backendFileRef: r.backend_file_ref, contactId: r.contact_id, clientName: r.client_name, clientPhone: r.client_phone,
    clientEmail: r.client_email, backend: r.backend, pipeline: r.pipeline, stage: r.stage, status: r.status,
    enrolledDebt: r.enrolled_debt == null ? null : Number(r.enrolled_debt),
    enrolledAt: r.enrolled_at ? new Date(r.enrolled_at).toISOString() : null,
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
  }));
  const overrideCommission = new Map(enrollmentRows.filter((r) => r.commission_override != null)
    .map((r) => [r.id, Number(r.commission_override)]));

  const d10 = (v: any) => (v ? (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10) : null);
  const files: (BackendFile & { declared: PaymentSchedule | null; cancelledAt: string | null })[] = fileRows.map((r) => ({
    id: Number(r.id), backend: r.backend, externalId: r.external_id, clientName: r.client_name, clientPhone: r.client_phone,
    clientLast4: r.client_last4, repName: r.rep_name, fileStatus: r.file_status,
    enrolledDebt: r.enrolled_debt == null ? null : Number(r.enrolled_debt), enrolledAt: d10(r.enrolled_at),
    firstPaymentAt: d10(r.first_payment_at), payoutAmount: r.payout_amount == null ? null : Number(r.payout_amount),
    payoutAt: d10(r.payout_at), period: r.period, batchId: r.batch_id ? Number(r.batch_id) : null,
    declared: (r.declared_schedule as PaymentSchedule) ?? null, cancelledAt: d10(r.cancelled_at),
  }));
  const fileById = new Map(files.map((f) => [f.id, f]));

  const draftsByFile = new Map<string, DealPayment[]>();
  for (const r of draftRows) {
    const k = `${r.backend}|${r.file_key}`;
    const list = draftsByFile.get(k) ?? draftsByFile.set(k, []).get(k)!;
    list.push({
      paymentNumber: r.draft_number ?? list.length + 1, dueAt: d10(r.due_at), clearedAt: d10(r.cleared_at),
      amount: r.amount == null ? null : Number(r.amount), status: r.status, source: r.source,
    });
  }
  const draftsFor = (f: BackendFile) => [
    ...(draftsByFile.get(`${f.backend}|${fileKeyFor(f.externalId, null)}`) ?? []),
    ...(f.externalId ? [] : draftsByFile.get(`${f.backend}|${fileKeyFor(null, f.clientName)}`) ?? []),
  ];

  const ledger = new Map<string, { paid: number; recovered: number }>();
  for (const r of ledgerRows) {
    const e = ledger.get(r.deal_id) ?? { paid: 0, recovered: 0 };
    if (r.kind === 'commission_paid') e.paid += Number(r.total);
    else e.recovered += Number(r.total);   // stored positive; a voided run adds a negative reversal
    ledger.set(r.deal_id, e);
  }
  const prevPushed = new Map(prevRows.map((r) => [r.deal_id, r.ghl_pushed_status]));

  // Primary match per enrollment — re-enrollment files never create a second commission.
  const recon = reconcile({ enrollments, files, agents });
  const primary = new Map<string, number>();
  for (const r of recon) {
    if (r.enrollmentId && r.backendFileId && r.method !== 'reenrollment' && !primary.has(r.enrollmentId)) {
      primary.set(r.enrollmentId, r.backendFileId);
    }
  }

  // Level commission tier: the closer's Level enrolled volume in the deal's month.
  const monthOf = (e: Enrollment) => (e.firstEnrolledAt ?? e.enrolledAt ?? '').slice(0, 7);
  const levelVolume = new Map<string, number>();
  for (const e of enrollments) {
    if (e.backend !== 'LEVEL') continue;
    const k = `${creditedAgent(e)}|${monthOf(e)}`;
    levelVolume.set(k, (levelVolume.get(k) ?? 0) + (e.enrolledDebt ?? 0));
  }

  const out: any[][] = [];
  const byState: Record<string, number> = {};
  const toPush: Array<{ e: Enrollment; label: string }> = [];

  for (const e of enrollments) {
    const agentId = creditedAgent(e);
    const a = agentId ? agentRow.get(agentId) : null;
    // Only US-based fully commissioned closers are paid by these rules.
    // pay_plan null = commissioned (every closer today); anything else is skipped.
    if (a?.pay_plan && a.pay_plan !== 'us_commission') continue;

    const fileId = primary.get(e.id) ?? null;
    const file = fileId != null ? fileById.get(fileId) ?? null : null;
    const backend: BackendKey = file?.backend ?? e.backend;
    const debt = file?.enrolledDebt ?? e.enrolledDebt ?? 0;
    const comp = overrideCommission.has(e.id)
      ? { amount: overrideCommission.get(e.id)!, basis: 'Set by an admin (override logged)' }
      : commissionFor(backend, debt, levelVolume.get(`${agentId}|${monthOf(e)}`) ?? 0);
    const led = ledger.get(e.id) ?? { paid: 0, recovered: 0 };

    let v: CloserPayVerdict;
    let state: string;
    if (!file) {
      state = 'unmatched';
      v = {
        state: 'awaiting_first_payment', schedule: 'unknown', programPaymentsCleared: 0, draftsCleared: 0,
        commission: comp.amount, owedAmount: 0, paidAmount: led.paid, clawbackAmount: 0, nextPayDate: null,
        chargebackFreeAt: null, installments: [],
        reason: 'No backend file has been matched to this deal yet. Once the backend reports it, its payments are tracked here.',
      };
    } else {
      const cancelledAt = file.cancelledAt ?? (CANCELLED.test(file.fileStatus ?? '') ? new Date().toISOString().slice(0, 10) : null);
      v = evaluateCloserPay({
        dealId: e.id, backend, commission: comp.amount, drafts: draftsFor(file),
        declaredSchedule: file.declared, cancelledAt, backendPaidAt: file.payoutAt,
        separation: a?.separated_at && a?.separation_type
          ? { at: d10(a.separated_at)!, type: a.separation_type as SeparationType } : null,
        paidAmount: led.paid, recoveredAmount: led.recovered, asOf: opts.asOf,
      });
      state = v.state;
    }
    byState[state] = (byState[state] ?? 0) + 1;

    out.push([
      e.id, agentId, a?.email ?? null, e.clientName ?? file?.clientName ?? null, backend, fileId,
      (e.firstEnrolledAt ?? e.enrolledAt)?.slice(0, 10) ?? null, debt || null, comp.amount, comp.basis,
      state, v.schedule, v.programPaymentsCleared, v.draftsCleared, v.owedAmount, v.paidAmount, v.clawbackAmount,
      v.nextPayDate, v.chargebackFreeAt, file?.payoutAt ?? null, v.reason, JSON.stringify(v.installments),
    ]);

    const label = pushLabel(state, v.nextPayDate);
    if (prevPushed.get(e.id) !== label) toPush.push({ e, label });
  }

  await query(`delete from ao_closer_pay`);
  for (let i = 0; i < out.length; i += 100) {
    const chunk = out.slice(i, i + 100);
    const params: any[] = [];
    const values = chunk.map((row) => `(${row.map((v) => { params.push(v); return `$${params.length}`; }).join(',')})`).join(',');
    await query(
      `insert into ao_closer_pay (deal_id, agent_id, agent_email, client_name, backend, backend_file_id, enrolled_at,
         enrolled_debt, commission, commission_basis, state, schedule, program_payments, drafts_cleared, owed, paid,
         clawback, next_pay_date, chargeback_free_at, backend_paid_at, reason, installments)
       values ${values}`,
      params,
    );
  }
  // Keep what was last pushed to GHL, so an unchanged status is not re-sent.
  for (const [dealId, pushed] of Array.from(prevPushed.entries())) {
    if (pushed) await query(`update ao_closer_pay set ghl_pushed_status = $2 where deal_id = $1`, [dealId, pushed]);
  }

  const errors: string[] = [];
  let pushed = 0;
  if (opts.pushToGhl !== false && process.env.AO_FIELD_PAY_STATUS && toPush.length) {
    const cfgs = ghlConfigs();
    for (const { e, label } of toPush) {
      const cfg = cfgs.find((c) => c.locationId === e.locationId);
      if (!cfg) continue;
      try {
        await ghlFetch(cfg, `/opportunities/${e.id}`, {
          method: 'PUT',
          body: { customFields: [{ id: process.env.AO_FIELD_PAY_STATUS, field_value: label }] },
        });
        await query(`update ao_closer_pay set ghl_pushed_status = $2 where deal_id = $1`, [e.id, label]);
        pushed += 1;
      } catch (err: any) {
        errors.push(`${e.id}: ${err?.message ?? String(err)}`);
        if (errors.length > 20) break;
      }
    }
  }

  return { deals: out.length, byState, pushed, errors };
}

/** The one-line status written onto the opportunity in GHL. */
function pushLabel(state: string, nextPayDate: string | null): string {
  const base = payStateLabel(state);
  return nextPayDate && ['scheduled', 'due', 'awaiting_backend'].includes(state) ? `${base} - ${nextPayDate}` : base;
}

export const PAY_TIMING = Object.fromEntries(
  Object.entries(PAY_RULES).map(([k, r]) => [k, { label: r.label, timing: r.timing, chargebackFreeAfter: r.chargebackFreeAfter }]),
);

/** Everything the Closer Pay admin tab shows, in one read. */
export async function payPayload() {
  const [deals, runs, lines, agents] = await Promise.all([
    query<any>(`select * from ao_closer_pay order by next_pay_date nulls last, enrolled_at desc`),
    query<any>(`select * from ao_pay_runs order by pay_date desc, id desc limit 500`),
    query<any>(`select l.*, p.client_name from ao_comp_ledger l left join ao_closer_pay p on p.deal_id = l.deal_id
                 where l.run_id is not null order by l.id`),
    query<any>(`select id, name, email, pay_plan, separated_at, separation_type, active from ao_agents order by name`),
  ]);

  const linesByRun = new Map<number, any[]>();
  lines.forEach((l) => {
    const k = Number(l.run_id);
    (linesByRun.get(k) ?? linesByRun.set(k, []).get(k)!).push(l);
  });
  const payRuns = runs.map((r) => {
    const ls = (linesByRun.get(Number(r.id)) ?? []).filter((l) => !String(l.note ?? '').startsWith('void'));
    const net = ls.reduce((s, l) => s + (l.kind === 'clawback_recovered' ? -Number(l.amount) : Number(l.amount)), 0);
    return { ...r, lines: ls, linesNet: Math.round(net * 100) / 100, balanced: Math.abs(net - Number(r.amount)) < 0.01 };
  });

  // Reconciliation per closer: what the rules say vs what the ledger says.
  const recon = agents.map((a) => {
    const mine = deals.filter((d) => d.agent_id === a.id);
    const sum = (f: (d: any) => number) => Math.round(mine.reduce((s, d) => s + f(d), 0) * 100) / 100;
    const overpaid = mine.filter((d) => Number(d.paid) > Number(d.commission) + 0.01);
    return {
      agentId: a.id, name: a.name, email: a.email,
      due: sum((d) => (d.state === 'due' ? Number(d.owed) : 0)),
      scheduled: sum((d) => (d.state === 'scheduled' ? Number(d.owed) : 0)),
      awaitingBackend: sum((d) => (d.state === 'awaiting_backend' ? Number(d.commission) : 0)),
      paid: sum((d) => Number(d.paid)),
      atRisk: sum((d) => (d.state === 'paid_at_risk' ? Number(d.paid) : 0)),
      clawbackOwed: sum((d) => Number(d.clawback)),
      overpaidDeals: overpaid.map((d) => d.deal_id),
      unbalancedRuns: payRuns.filter((r) => r.agent_id === a.id && !r.voided_at && !r.balanced).map((r) => r.id),
    };
  }).filter((r) => deals.some((d) => d.agent_id === r.agentId) || payRuns.some((p) => p.agent_id === r.agentId));

  return { ok: true, deals, payRuns, recon, agents, timing: PAY_TIMING };
}

