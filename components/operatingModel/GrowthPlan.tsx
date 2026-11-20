import React from 'react';
import type { BackendKey, Employee, ModelInputs, ModelResults } from './types';
import { BACKEND_KEYS } from './types';
import { Callout, Field, NumberInput, Panel, Row, T, fmtMoney, fmtMoney2, fmtNum, fmtPct, td, tdNum, th, PartnerName } from './ui';
import { makeEmployee } from './config';
import { runModel } from './simulate';
import { computeEmployeeCost } from './labor';
import ElectionPlanner from './ElectionPlanner';
import {
  agentCommissionForDeal, buildSurvivalCurve, maxRevenueMonth, revenueForDealMonth,
} from './backends';

/**
 * Growth Plan — one screen that answers "on safe assumptions, are we profitable?"
 *
 *   Team           → who is on the phones (owner, US closers, BPO openers)
 *   Three methods  → transfers, direct mail, paid social, side by side, each
 *                    with a budget and its own close rate / debt load
 *   Occupancy      → do the calls fit the closers (no unanswered surplus,
 *                    no idle seats)
 *   Program mix    → where enrollments go and what each one earns after the rep
 *   Bottom line    → mature monthly P&L, capital needed, cash-positive month
 *
 * Everything writes straight into the model inputs, so every other section
 * (cash flow, month-end statement, partner detail) follows this plan.
 */

const MATURE_HORIZON = 48;
const PROGRAM_LABEL: Record<BackendKey, string> = {
  LEVEL: 'Debt Settlement (LD) — 8% of debt once',
  CS: 'Debt Validation (SS) — 36-month perpetuity',
  LEGACY: 'Debt Resolution (ELP) — residual to 48 months',
};
const TAIL = 6;

const isOwner = (e: Employee) => e.type === 'owner';
const isUs = (e: Employee) => (e.type === 'inhouse' || e.type === 'manager') && e.role !== 'opener';
const isOffshore = (e: Employee) => e.type === 'bpo' && e.role !== 'opener';
const isOpener = (e: Employee) => e.type === 'bpo' && e.role === 'opener';

function countTeam(roster: Employee[]) {
  const rate = (pick: (e: Employee) => boolean, fallback: number) => {
    const g = roster.filter(pick); return g.length ? g[0].hourlyRate : fallback;
  };
  return {
    owner: roster.filter(isOwner).length,
    us: roster.filter(isUs).length,
    offshore: roster.filter(isOffshore).length,
    bpo: roster.filter(isOpener).length,
    usRate: rate(isUs, 18),
    offshoreRate: rate(isOffshore, 7),
    bpoRate: rate(isOpener, 5),
  };
}

const OFFICE_LINES: { label: string; amount: number }[] = [
  { label: 'Office Rent', amount: 2500 },
  { label: 'Office Internet', amount: 150 },
  { label: 'Office Utilities', amount: 300 },
  { label: 'Team Lunch (weekly) + Water/Coffee', amount: 400 },
];
const isOfficeLine = (label: string) => /office|team lunch|rent/i.test(label);

/** Keep existing people where possible; add or drop at the end of each group. */
function resizeGroup(roster: Employee[], pick: (e: Employee) => boolean, n: number, make: (i: number) => Employee): Employee[] {
  const have = roster.filter(pick);
  const others = roster.filter((e) => !pick(e));
  const kept = have.slice(0, n);
  const added = Array.from({ length: Math.max(0, n - have.length) }, (_, i) => make(have.length + i + 1));
  return [...others, ...kept, ...added];
}

export default function GrowthPlan({ inputs, setInputs, children }: {
  inputs: ModelInputs;
  setInputs: (i: ModelInputs) => void;
  children?: React.ReactNode; // advanced panels
}) {
  const ops = inputs.operations;
  const mk = inputs.marketing;
  const team = countTeam(inputs.roster);

  // ── setters ──────────────────────────────────────────────────────────────
  const setRoster = (roster: Employee[]) => setInputs({ ...inputs, roster });
  const setOwner = (n: number) => setRoster(resizeGroup(inputs.roster, (e) => e.type === 'owner', n,
    (i) => makeEmployee({ name: i === 1 ? 'Owner Operator' : `Owner / Partner ${i}`, type: 'owner', role: 'closer', teamId: 'team-a' })));
  const setUs = (n: number) => setRoster(resizeGroup(inputs.roster, (e) => (e.type === 'inhouse' || e.type === 'manager') && e.role !== 'opener', n,
    (i) => makeEmployee({ name: `Closer ${i} — In-House`, type: 'inhouse', role: 'closer', teamId: 'team-a' })));
  const setOffshore = (n: number) => setRoster(resizeGroup(inputs.roster, isOffshore, n,
    (i) => makeEmployee({ name: `Closer ${i} — Offshore`, type: 'bpo', role: 'closer', hourlyRate: team.offshoreRate, teamId: 'team-a' })));
  const setBpo = (n: number) => setRoster(resizeGroup(inputs.roster, isOpener, n,
    (i) => makeEmployee({ name: `Opener ${i} — BPO`, type: 'bpo', role: 'opener', hourlyRate: team.bpoRate, teamId: 'team-a' })));
  const setRate = (pick: (e: Employee) => boolean, v: number) =>
    setRoster(inputs.roster.map((e) => (pick(e) ? { ...e, hourlyRate: v } : e)));
  const applyStaffing = (owner: number, us: number, offshore: number, bpo: number) => {
    let r = resizeGroup(inputs.roster, isOwner, owner, (i) => makeEmployee({ name: i === 1 ? 'Owner Operator' : `Owner / Partner ${i}`, type: 'owner', role: 'closer', teamId: 'team-a' }));
    r = resizeGroup(r, isUs, us, (i) => makeEmployee({ name: `Closer ${i} — In-House`, type: 'inhouse', role: 'closer', teamId: 'team-a' }));
    r = resizeGroup(r, isOffshore, offshore, (i) => makeEmployee({ name: `Closer ${i} — Offshore`, type: 'bpo', role: 'closer', hourlyRate: team.offshoreRate, teamId: 'team-a' }));
    r = resizeGroup(r, isOpener, bpo, (i) => makeEmployee({ name: `Opener ${i} — BPO`, type: 'bpo', role: 'opener', hourlyRate: team.bpoRate, teamId: 'team-a' }));
    setRoster(r);
  };

  // Operating mode: virtual (no office lines) or office (rent + utilities).
  const officeOn = inputs.costs.fixedCosts.some((c) => isOfficeLine(c.label) && c.amount > 0);
  const rentLine = inputs.costs.fixedCosts.find((c) => /rent/i.test(c.label));
  const setOffice = (on: boolean) => {
    const base = inputs.costs.fixedCosts.filter((c) => !isOfficeLine(c.label));
    const lines = on ? [...base, ...OFFICE_LINES.map((l, i) => ({ id: `office-${i}`, label: l.label, amount: l.amount }))] : base;
    setInputs({ ...inputs, costs: { ...inputs.costs, fixedCosts: lines } });
  };
  const setRent = (v: number) => setInputs({ ...inputs, costs: { ...inputs.costs, fixedCosts: inputs.costs.fixedCosts.map((c) => (/rent/i.test(c.label) ? { ...c, amount: v } : c)) } });
  const setPayMode = (mode: 'contract' | 'draw') => setInputs({ ...inputs, repPay: { ...inputs.repPay, mode } });
  const setCapital = (v: number) => setInputs({ ...inputs, startingCash: v });

  // Program knobs: buyout / accelerated share, first-pay and monthly cancel per program.
  const taxIn = inputs.taxResolution ?? { enabled: false, attachPct: 5, phase1Fee: 500, phase1SharePct: 50, phase1LagMonths: 1, phase2ConversionPct: 50, phase2Fee: 5000, phase2SharePct: 40, phase2LagMonths: 2, phase2InstallmentMonths: 3, refundPct: 5, repCommissionPct: 35 };
  const setTax = (p: Partial<typeof taxIn>) => setInputs({ ...inputs, taxResolution: { ...taxIn, ...p } });
  const taxPerDebtDeal = (taxIn.attachPct / 100) * (1 - taxIn.refundPct / 100) * (
    taxIn.phase1Fee * (taxIn.phase1SharePct / 100) + (taxIn.phase2ConversionPct / 100) * taxIn.phase2Fee * (taxIn.phase2SharePct / 100));
  const taxNetPerDebtDeal = taxPerDebtDeal * (1 - taxIn.repCommissionPct / 100);
  const setBuyout = (v: number) => setInputs({ ...inputs, consumerShield: { ...inputs.consumerShield, buyoutSharePct: v } });
  const setAccel = (v: number) => setInputs({ ...inputs, legacy: { ...inputs.legacy, acceleratedSharePct: v } });
  const setSurvival = (k: BackendKey, firstPay: number, cancel: number) => setInputs({
    ...inputs,
    survivalCurves: { ...inputs.survivalCurves, [k]: { firstPayPct: firstPay, cancelPctByMonth: [cancel], steadyStateMonthlyCancelPct: cancel } },
  });

  const setOps = (p: Partial<typeof ops>) => setInputs({ ...inputs, operations: { ...ops, ...p } });
  const setTransferClose = (v: number) => setOps({ closeRatePct: v, buffers: ops.buffers.map((b) => ({ ...b, closeRatePct: v })) });
  const setTransferDebt = (v: number) => setInputs({ ...inputs, volume: { ...inputs.volume, avgDebt: { LEVEL: v, CS: v, LEGACY: v } } });
  const setMail = (p: Partial<typeof mk.directMail>) => setInputs({ ...inputs, marketing: { ...mk, directMail: { ...mk.directMail, ...p } } });
  const setSocial = (p: Partial<typeof mk.paidSocial>) => setInputs({ ...inputs, marketing: { ...mk, paidSocial: { ...mk.paidSocial, ...p } } });
  const setMix = (k: BackendKey, v: number) => setInputs({ ...inputs, volume: { ...inputs.volume, mixPct: { ...inputs.volume.mixPct, [k]: v } }, marketing: { ...mk, mixPct: { ...(mk.mixPct ?? inputs.volume.mixPct), [k]: v } } });

  const mailBudget = mk.directMail.enabled ? Math.round(mk.directMail.piecesPerMonth * mk.directMail.costPerPiece + mk.directMail.dataCostPerMonth) : 0;
  const setMailBudget = (b: number) => {
    const dm = mk.directMail;
    if (b <= 0) { setMail({ enabled: false }); return; }
    // Budget covers the data first, the rest buys pieces. Exact, no rounding,
    // so the field shows what was typed.
    const pieces = Math.max(0, (b - dm.dataCostPerMonth) / Math.max(0.01, dm.costPerPiece));
    setMail({ enabled: true, piecesPerMonth: Math.round(pieces), startMonth: 1 });
  };
  const socialBudget = mk.paidSocial.enabled ? mk.paidSocial.spendPerMonth : 0;
  const setSocialBudget = (b: number) => setSocial({ enabled: b > 0, spendPerMonth: Math.max(0, b), startMonth: 1 });

  const mixTotal = BACKEND_KEYS.reduce((a, k) => a + inputs.volume.mixPct[k], 0);
  const mixTotalMk = BACKEND_KEYS.reduce((a, k) => a + (mk.mixPct ?? inputs.volume.mixPct)[k], 0);
  const blendedPrice = ops.buffers.reduce((s, b) => s + b.price * b.mixPct, 0) / (ops.buffers.reduce((s, b) => s + b.mixPct, 0) || 100);
  const transferDebt = BACKEND_KEYS.reduce((a, k) => a + inputs.volume.avgDebt[k] * inputs.volume.mixPct[k], 0) / (mixTotal || 100);

  // ── runs ─────────────────────────────────────────────────────────────────
  const mature: ModelResults = React.useMemo(
    () => runModel({ ...inputs, ramp: { ...inputs.ramp, horizonMonths: Math.max(inputs.ramp.horizonMonths, MATURE_HORIZON) } }),
    [inputs],
  );
  const months = mature.months;
  const tail = months.slice(-TAIL);
  const avg = (f: (r: ModelResults['months'][number]) => number) => tail.reduce((a, r) => a + f(r), 0) / Math.max(1, tail.length);
  const year1 = months.slice(0, 12);

  const m = {
    revenue: avg((r) => r.revenue),
    commission: avg((r) => r.repCommission),
    bonuses: avg((r) => r.bonusPaid + r.managerOverride),
    labor: avg((r) => r.laborCost),
    transfers: avg((r) => r.transferCost),
    marketing: avg((r) => r.marketingCost),
    overhead: avg((r) => r.overhead),
    net: avg((r) => r.netCashFlow),
    deals: avg((r) => r.deals),
    mkDeals: avg((r) => r.marketing.deals),
    mailDeals: avg((r) => r.marketing.channels.find((c) => c.key === 'mail')?.deals ?? 0),
    socialDeals: avg((r) => r.marketing.channels.find((c) => c.key === 'social')?.deals ?? 0),
    mailCalls: avg((r) => r.marketing.channels.find((c) => c.key === 'mail')?.handledCalls ?? 0),
    socialCalls: avg((r) => r.marketing.channels.find((c) => c.key === 'social')?.handledCalls ?? 0),
    mailPieces: avg((r) => r.marketing.channels.find((c) => c.key === 'mail')?.units ?? 0),
    socialLeads: avg((r) => r.marketing.channels.find((c) => c.key === 'social')?.units ?? 0),
    unanswered: avg((r) => r.marketing.unansweredCalls),
    transfersBought: avg((r) => r.capacity.purchasedTransfers),
    transfersOpener: avg((r) => r.capacity.openerSuppliedTransfers),
    transferDeals: avg((r) => Math.max(0, r.deals - r.marketing.deals)),
    utilization: avg((r) => r.utilizationPct),
    availableMin: avg((r) => r.capacity.availableCallMinutes),
    transferMin: avg((r) => r.capacity.totalTransfers * ops.avgHandleMinutes),
    mkMin: avg((r) => r.marketing.callMinutes),
    closerHours: avg((r) => r.capacity.closerHours),
    openerHours: avg((r) => r.capacity.openerHours),
    budgetBinding: tail.some((r) => r.capacity.bindingConstraint === 'budget'),
    taxRevenue: avg((r) => r.tax.revenue),
    taxCommission: avg((r) => r.tax.repCommission),
    taxP1: avg((r) => r.tax.phase1Deals),
    taxP2: avg((r) => r.tax.phase2Deals),
  };
  const other = Math.max(0, m.overhead - m.labor - m.transfers - m.marketing);
  const idleMin = Math.max(0, m.availableMin - m.transferMin - m.mkMin);
  const year1Net = year1.reduce((a, r) => a + r.netCashFlow, 0);
  const enrolled = avg((r) => Math.max(0, r.deals - r.marketing.deals) * transferDebt + r.marketing.enrolledVolume);

  // ── per-program economics after the rep ──────────────────────────────────
  const blendedDebt = m.deals > 0 ? enrolled / m.deals : transferDebt;
  const monthlyVolume = enrolled;
  const programRows = BACKEND_KEYS.map((k) => {
    const term = maxRevenueMonth(k, blendedDebt, inputs);
    const surv = buildSurvivalCurve(inputs.survivalCurves[k], Math.max(term, 48));
    let full = 0, exp = 0;
    for (let d = 1; d <= term; d++) { const r = revenueForDealMonth(k, blendedDebt, d, inputs); full += r; exp += r * (surv[d] ?? 0); }
    const comm = agentCommissionForDeal(k, blendedDebt, monthlyVolume, inputs);
    const payM = k === 'LEVEL' ? inputs.levelDebt.agentPayoutMonth : k === 'CS' ? inputs.consumerShield.agentPayoutMonth : inputs.legacy.agentPayoutMonth;
    const expComm = comm * (surv[payM] ?? 0);
    return { k, pct: inputs.volume.mixPct[k], full, comm, exp, expComm, net: exp - expComm };
  });
  const blendedNet = programRows.reduce((a, r) => a + r.net * r.pct, 0) / (mixTotal || 100);
  const blendedExp = programRows.reduce((a, r) => a + r.exp * r.pct, 0) / (mixTotal || 100);

  const costPerDeal = {
    transfers: m.transferDeals > 0 ? m.transfers / m.transferDeals : 0,
    mail: m.mailDeals > 0 ? mailBudget / m.mailDeals : 0,
    social: m.socialDeals > 0 ? socialBudget / m.socialDeals : 0,
  };

  const profitable = m.net > 0;
  const cashPos = mature.totals.firstCashPositiveMonth;
  const cashOut = mature.totals.cashOutMonth;
  const sc = inputs.survivalCurves.CS;
  const startingCash = inputs.startingCash ?? 0;

  // What one more closer costs per month (the hiring trigger's yardstick).
  const seatCost = React.useMemo(() => {
    const tpl = team.us > 0 || team.offshore === 0
      ? makeEmployee({ name: 'probe', type: 'inhouse', role: 'closer', hourlyRate: team.usRate })
      : makeEmployee({ name: 'probe', type: 'bpo', role: 'closer', hourlyRate: team.offshoreRate });
    return computeEmployeeCost(tpl, inputs.laborPolicy).monthlyCost;
  }, [inputs.laborPolicy, team.us, team.offshore, team.usRate, team.offshoreRate]);
  const cheapestOwnedCostPerDeal = Math.min(...[costPerDeal.mail, costPerDeal.social].filter((v) => v > 0), Infinity);
  const ownedChannelPays = Number.isFinite(cheapestOwnedCostPerDeal) && cheapestOwnedCostPerDeal < blendedNet;
  const growthStep = Math.max(15000, m.marketing); // one more tier of spend

  // Month-by-month with hire / invest signals.
  const [showAll, setShowAll] = React.useState(false);
  const monthRows = months.slice(0, showAll ? months.length : 24).map((r, i, arr) => {
    const prev = arr[i - 1];
    const bank = r.cashPosition;
    const busy = r.utilizationPct >= 90 && (prev ? prev.utilizationPct >= 90 : false);
    const canAfford = bank >= r.reserveTarget + 3 * seatCost;
    const signal = bank < 0 ? 'out-of-cash'
      : busy && canAfford ? 'hire'
      : ownedChannelPays && bank >= r.reserveTarget + 2 * growthStep ? 'invest'
      : r.reserveMet ? 'reserve-met'
      : 'build-reserve';
    return { r, bank, signal };
  });
  const firstHire = monthRows.find((x) => x.signal === 'hire')?.r.month ?? null;
  const firstInvest = monthRows.find((x) => x.signal === 'invest')?.r.month ?? null;

  // ── render helpers ───────────────────────────────────────────────────────
  const tile = (label: string, value: React.ReactNode, sub?: React.ReactNode, tone?: 'good' | 'bad') => (
    <div style={{ background: '#fff', border: `1px solid ${T.line}`, borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, fontFamily: T.mono, color: tone === 'bad' ? T.bad : tone === 'good' ? T.good : T.ink }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.muted }}>{sub}</div>}
    </div>
  );
  const out = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '3px 0', borderTop: `1px dashed ${T.lineSoft}` }}>
      <span style={{ color: T.muted }}>{label}</span><span style={{ fontFamily: T.mono, fontWeight: 700 }}>{value}</span>
    </div>
  );
  const card: React.CSSProperties = { border: `1px solid ${T.line}`, borderRadius: 10, padding: 12, background: '#fff', display: 'flex', flexDirection: 'column' };
  const cardHead = (title: string, budget: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
      <div style={{ fontWeight: 800, fontSize: 14 }}>{title}</div>
      <div style={{ fontSize: 11.5, color: T.muted }}>{budget}</div>
    </div>
  );

  return (
    <>
      {/* ── Verdict ── */}
      <div style={{
        border: `1px solid ${profitable ? '#86efac' : '#fca5a5'}`, background: profitable ? T.goodBg : T.badBg,
        borderRadius: T.radius, padding: '14px 16px', marginBottom: 14,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: profitable ? T.good : T.bad }}>
              {profitable ? 'Profitable on these assumptions' : 'Not profitable on these assumptions'}
            </div>
            <div style={{ fontSize: 13.5, color: T.ink, marginTop: 2 }}>
              At maturity this plan makes <strong style={{ color: profitable ? T.good : T.bad }}>{fmtMoney(m.net)}</strong> a month after every rep, seat, transfer, mail piece and bill is paid
              ({fmtPct(m.revenue > 0 ? (m.net / m.revenue) * 100 : 0, 0)} margin on {fmtMoney(m.revenue)} revenue).
              {cashPos ? <> Cumulative cash turns positive in <strong>month {cashPos}</strong>; the plan needs <strong>{fmtMoney(mature.totals.peakCapitalRequired)}</strong> of capital against <strong>{fmtMoney(startingCash)}</strong> in the bank</>
                : <> Cumulative cash never turns positive inside {MATURE_HORIZON} months; the plan needs <strong>{fmtMoney(mature.totals.peakCapitalRequired)}</strong> against <strong>{fmtMoney(startingCash)}</strong> in the bank</>}
              {cashOut ? <>, and <strong style={{ color: T.bad }}>runs out of money in month {cashOut}</strong> (lowest balance {fmtMoney(mature.totals.lowestCash)}).</> : <>; the balance never goes below <strong>{fmtMoney(mature.totals.lowestCash)}</strong>.</>}
              {' '}Year 1 nets <strong style={{ color: year1Net < 0 ? T.bad : T.good }}>{fmtMoney(year1Net)}</strong>.
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: T.muted, maxWidth: 420 }}>
            Safe assumptions in force: {sc.firstPayPct}% first payment clears, {sc.steadyStateMonthlyCancelPct}% of active files cancel each month, {ops.avgHandleMinutes}-minute calls, {inputs.volume.dealsPer8CloserHours} deals per 8 closer hours. Change them in Risk &amp; Attrition / Operations and this page follows.
          </div>
        </div>
      </div>

      {/* ── Capital & setup ── */}
      <Panel title="1 · Capital and setup — how we operate" accent={T.accent}
        tooltip="Starting cash is the investor capital in the bank on day one. Virtual removes rent, utilities and office extras from the cost stack; Office adds them back. Pay basis switches W-2 closers between hourly plus commission and a draw recovered from commission.">
        <Row cols={4} gap={12}>
          <Field label="Starting capital in the bank"><NumberInput value={startingCash} min={0} step={5000} prefix="$" onChange={setCapital} /></Field>
          <Field label="Operating mode">
            <div style={{ display: 'flex', gap: 6 }}>
              {[['Virtual — no office', false], ['Office', true]].map(([l, v]) => (
                <button key={String(l)} onClick={() => setOffice(v as boolean)} style={{
                  flex: 1, padding: '7px 8px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  border: `1px solid ${officeOn === v ? T.brand : T.line}`, background: officeOn === v ? T.brandSoft : '#fff', color: officeOn === v ? T.brandDeep : T.ink,
                }}>{l as string}</button>
              ))}
            </div>
          </Field>
          <Field label={officeOn ? 'Office rent / month' : 'Office rent / month (off)'}>
            <NumberInput value={officeOn ? (rentLine?.amount ?? 0) : 0} min={0} step={250} prefix="$" onChange={(v) => { if (!officeOn) setOffice(true); setRent(v); }} />
          </Field>
          <Field label="Pay basis for W-2 closers">
            <div style={{ display: 'flex', gap: 6 }}>
              {[['Hourly + commission', 'contract'], ['Draw against commission', 'draw']].map(([l, v]) => (
                <button key={v} onClick={() => setPayMode(v as 'contract' | 'draw')} style={{
                  flex: 1, padding: '7px 8px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  border: `1px solid ${inputs.repPay.mode === v ? T.brand : T.line}`, background: inputs.repPay.mode === v ? T.brandSoft : '#fff', color: inputs.repPay.mode === v ? T.brandDeep : T.ink,
                }}>{l}</button>
              ))}
            </div>
          </Field>
        </Row>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>
          Fixed overhead now: {fmtMoney(inputs.costs.fixedCosts.reduce((a, c) => a + c.amount, 0))} / month ({inputs.costs.fixedCosts.filter((c) => c.amount > 0).map((c) => c.label).join(', ')}). Per-seat software and telecom are added per agent automatically.
        </div>
      </Panel>

      {/* ── Team ── */}
      <Panel title="2 · Team — who is on the phones, and what each seat costs" accent={T.accent}
        tooltip="Owner-operators close on commission only. US closers are W-2 at the hourly rate with California overtime rules. Offshore closers (Egypt) are hourly contractors with no overtime. BPO openers generate transfers at the opener rate instead of buying them.">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10, fontSize: 12.5 }}>
          <span style={{ color: T.muted, fontWeight: 700 }}>Launch options:</span>
          {[
            ['Owner + 1 US closer', [1, 1, 0, 0]],
            ['Owner + 3 offshore closers', [1, 0, 3, 0]],
            ['Owner + 1 US + 2 BPO openers', [1, 1, 0, 2]],
            ['Owner only', [1, 0, 0, 0]],
          ].map(([l, c]) => {
            const [o, u, f, b] = c as number[];
            const active = team.owner === o && team.us === u && team.offshore === f && team.bpo === b;
            return (
              <button key={l as string} onClick={() => applyStaffing(o, u, f, b)} style={{
                padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${active ? T.brand : T.line}`, background: active ? T.brandSoft : '#fff', color: active ? T.brandDeep : T.ink,
              }}>{l as string}</button>
            );
          })}
        </div>
        <Row cols={4} gap={12}>
          <div style={card}>
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>Owner-operators / partners</div>
            <Field label="Count (commission only)"><NumberInput value={team.owner} min={0} max={10} onChange={setOwner} /></Field>
          </div>
          <div style={card}>
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>US-based closers (W-2)</div>
            <Row cols={2}>
              <Field label="Count"><NumberInput value={team.us} min={0} max={60} onChange={setUs} /></Field>
              <Field label="Hourly rate"><NumberInput value={team.usRate} min={0} step={0.5} prefix="$" onChange={(v) => setRate(isUs, v)} /></Field>
            </Row>
          </div>
          <div style={card}>
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>Offshore closers (Egypt, hourly)</div>
            <Row cols={2}>
              <Field label="Count (min 3 to run)"><NumberInput value={team.offshore} min={0} max={60} onChange={setOffshore} /></Field>
              <Field label="Hourly rate"><NumberInput value={team.offshoreRate} min={0} step={0.5} prefix="$" onChange={(v) => setRate(isOffshore, v)} /></Field>
            </Row>
          </div>
          <div style={card}>
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>BPO openers (make transfers)</div>
            <Row cols={2}>
              <Field label="Count"><NumberInput value={team.bpo} min={0} max={60} onChange={setBpo} /></Field>
              <Field label="Hourly rate"><NumberInput value={team.bpoRate} min={0} step={0.5} prefix="$" onChange={(v) => setRate(isOpener, v)} /></Field>
            </Row>
          </div>
        </Row>
        <Row cols={4} gap={10} style={{ marginTop: 10 }}>
          {tile('Closer talk time / month', `${fmtNum(m.closerHours)} hrs`, `${fmtNum(m.openerHours)} opener hrs`)}
          {tile('Labor / month', fmtMoney(m.labor), inputs.repPay.mode === 'draw' ? 'draw, recovered from commission' : 'hourly, plus commission')}
          {tile('Next closer seat costs', `${fmtMoney(seatCost)} / mo`, team.us > 0 || team.offshore === 0 ? 'US closer at the rate above' : 'offshore closer at the rate above')}
          {tile('Calls needed to keep them busy', fmtNum(m.availableMin / Math.max(1, ops.avgHandleMinutes)), `${ops.avgHandleMinutes}-minute handle time`)}
        </Row>
        {team.offshore > 0 && team.offshore < 3 && <Callout tone="warn">Offshore closers run as a team of three or more (coverage, QA, attrition); {team.offshore} on the roster is below the minimum you set.</Callout>}
      </Panel>

      {/* ── Three methods side by side ── */}
      <Panel title="3 · Where the calls come from — three methods, each with its own budget" accent={T.accent}
        tooltip="Inbound mail and social calls are answered first (higher intent, bigger files); purchased transfers fill the closer time left, up to the transfer budget. Outputs are the mature monthly run-rate.">
        <Row cols={3} gap={14}>
          {/* Transfers */}
          <div style={card}>
            {cardHead('Call transfers', <>blended {fmtMoney2(blendedPrice)} per billed transfer</>)}
            <Field label="Budget / month (0 = buy to fill closers)"><NumberInput value={ops.transferBudgetPerMonth ?? 0} min={0} step={500} prefix="$" onChange={(v) => setOps({ transferBudgetPerMonth: v })} /></Field>
            <Row cols={2}>
              <Field label="Close rate"><NumberInput value={ops.closeRatePct} min={0} max={100} step={0.5} suffix="%" onChange={setTransferClose} /></Field>
              <Field label="Avg enrolled debt"><NumberInput value={Math.round(transferDebt)} min={0} step={500} prefix="$" onChange={setTransferDebt} /></Field>
            </Row>
            <div style={{ marginTop: 'auto', paddingTop: 8 }}>
              {out('Transfers bought', fmtNum(m.transfersBought))}
              {m.transfersOpener > 0.5 && out('From BPO openers', fmtNum(m.transfersOpener))}
              {out('Spend', fmtMoney(m.transfers))}
              {out('Deals / month', fmtNum(m.transferDeals, 1))}
              {out('Cost per deal', fmtMoney(costPerDeal.transfers))}
            </div>
          </div>

          {/* Mail */}
          <div style={card}>
            {cardHead('Direct mail + prescreen data', <>{fmtNum(m.mailPieces)} pieces / month</>)}
            <Field label="Budget / month (pieces + data)"><NumberInput value={Math.round(mailBudget)} min={0} step={1000} prefix="$" onChange={setMailBudget} /></Field>
            <Row cols={2}>
              <Field label="Cost per piece" tooltip="Print, postage, mail house, tracking number."><NumberInput value={mk.directMail.costPerPiece} min={0} step={0.05} prefix="$" onChange={(v) => setMail({ costPerPiece: v })} /></Field>
              <Field label="Data / month" tooltip="Prescreen list (Altair CreditReady, CRS LeadsIQ, Deluxe) — excludes bankruptcies, sets the debt floor."><NumberInput value={mk.directMail.dataCostPerMonth} min={0} step={250} prefix="$" onChange={(v) => setMail({ dataCostPerMonth: v })} /></Field>
              <Field label="Response rate" tooltip="Pieces that produce a call. 0.75%–2% on prescreened high-utilization households."><NumberInput value={mk.directMail.responsePct} min={0} max={20} step={0.05} suffix="%" onChange={(v) => setMail({ responsePct: v })} /></Field>
              <Field label="Qualified share" tooltip="The list already excludes bankruptcies and sets the debt floor. What is left to lose: wrong party or duplicate, state program exclusions, callers who cannot show an ability to pay. 70% planning figure."><NumberInput value={mk.directMail.qualifiedPct} min={0} max={100} step={1} suffix="%" onChange={(v) => setMail({ qualifiedPct: v })} /></Field>
              <Field label="Close rate"><NumberInput value={mk.directMail.closeRatePct} min={0} max={100} step={0.5} suffix="%" onChange={(v) => setMail({ closeRatePct: v })} /></Field>
              <Field label="Avg enrolled debt"><NumberInput value={mk.directMail.avgDebt} min={0} step={500} prefix="$" onChange={(v) => setMail({ avgDebt: v })} /></Field>
            </Row>
            <div style={{ marginTop: 'auto', paddingTop: 8 }}>
              {out('Qualified calls', fmtNum(m.mailCalls))}
              {out('Deals / month', fmtNum(m.mailDeals, 1))}
              {out('Cost per deal', fmtMoney(costPerDeal.mail))}
            </div>
          </div>

          {/* Social */}
          <div style={card}>
            {cardHead('Paid social', <>{fmtNum(m.socialLeads)} leads / month</>)}
            <Field label="Budget / month"><NumberInput value={Math.round(socialBudget)} min={0} step={500} prefix="$" onChange={setSocialBudget} /></Field>
            <Row cols={2}>
              <Field label="Cost per lead"><NumberInput value={mk.paidSocial.costPerLead} min={1} step={1} prefix="$" onChange={(v) => setSocial({ costPerLead: v })} /></Field>
              <Field label="Lead → qualified call"><NumberInput value={mk.paidSocial.qualifiedPct} min={0} max={100} step={1} suffix="%" onChange={(v) => setSocial({ qualifiedPct: v })} /></Field>
              <Field label="Close rate"><NumberInput value={mk.paidSocial.closeRatePct} min={0} max={100} step={0.5} suffix="%" onChange={(v) => setSocial({ closeRatePct: v })} /></Field>
              <Field label="Avg enrolled debt"><NumberInput value={mk.paidSocial.avgDebt} min={0} step={500} prefix="$" onChange={(v) => setSocial({ avgDebt: v })} /></Field>
            </Row>
            <div style={{ marginTop: 'auto', paddingTop: 8 }}>
              {out('Qualified calls', fmtNum(m.socialCalls))}
              {out('Deals / month', fmtNum(m.socialDeals, 1))}
              {out('Cost per deal', fmtMoney(costPerDeal.social))}
            </div>
          </div>
        </Row>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 8 }}>
          Creative, landing pages, tracking numbers and compliance review: {fmtMoney(mk.creativeAndTrackingPerMonth)} / month while any owned channel is on (set in Advanced).
        </div>

        {/* Occupancy */}
        <div style={{ marginTop: 12, border: `1px solid ${T.line}`, borderRadius: 10, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 13 }}>
            <span>Occupancy — do the calls fit the closers?</span>
            <span style={{ fontFamily: T.mono }}>{fmtNum(m.utilization)}% of {fmtNum(m.closerHours)} closer hours</span>
          </div>
          <div style={{ display: 'flex', height: 18, borderRadius: 6, overflow: 'hidden', marginTop: 8, background: T.lineSoft }}>
            {[
              { v: m.transferMin, c: T.brand, l: 'Transfers' },
              { v: m.mkMin * (m.mailCalls / Math.max(1, m.mailCalls + m.socialCalls)), c: '#1a6ed8', l: 'Mail' },
              { v: m.mkMin * (m.socialCalls / Math.max(1, m.mailCalls + m.socialCalls)), c: '#d97706', l: 'Social' },
              { v: idleMin, c: '#e2e8f0', l: 'Idle' },
            ].map((s) => (
              <div key={s.l} title={`${s.l}: ${fmtNum(s.v / 60)} hrs`} style={{ width: `${(s.v / Math.max(1, m.availableMin)) * 100}%`, background: s.c }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: T.muted, marginTop: 4, flexWrap: 'wrap' }}>
            <span><i style={{ display: 'inline-block', width: 10, height: 10, background: T.brand, borderRadius: 2, marginRight: 4 }} />Transfers {fmtNum(m.transferMin / 60)} hrs</span>
            <span><i style={{ display: 'inline-block', width: 10, height: 10, background: '#1a6ed8', borderRadius: 2, marginRight: 4 }} />Mail {fmtNum((m.mkMin * (m.mailCalls / Math.max(1, m.mailCalls + m.socialCalls))) / 60)} hrs</span>
            <span><i style={{ display: 'inline-block', width: 10, height: 10, background: '#d97706', borderRadius: 2, marginRight: 4 }} />Social {fmtNum((m.mkMin * (m.socialCalls / Math.max(1, m.mailCalls + m.socialCalls))) / 60)} hrs</span>
            <span><i style={{ display: 'inline-block', width: 10, height: 10, background: '#e2e8f0', borderRadius: 2, marginRight: 4 }} />Idle {fmtNum(idleMin / 60)} hrs</span>
          </div>
          {m.unanswered > 0.5 && (
            <Callout tone="bad">{fmtNum(m.unanswered)} qualified inbound calls a month go unanswered — the closers are full. Add US closers or cut the mail / social budget; paying for calls nobody takes is the one thing this plan must never do.</Callout>
          )}
          {m.unanswered <= 0.5 && idleMin / 60 > 40 && (
            <Callout tone="warn">About {fmtNum(idleMin / 60)} closer hours a month are idle{m.budgetBinding ? ' because the transfer budget is capping purchases' : ''}. Raise the transfer budget, add mail / social, or trim the team.</Callout>
          )}
        </div>
      </Panel>

      {/* ── Program mix ── */}
      <Panel title="4 · Where enrollments go — file type, buyout vs perpetual, attrition — and what each one earns after the rep" accent={T.accent}
        tooltip="Share of enrollments by program. Revenue per deal is the contract (full term) and what the model expects after first-pay and cancellation; the rep is paid only on files whose first payment clears.">
        <Row cols={3} gap={12}>
          {BACKEND_KEYS.map((k) => (
            <Field key={k} label={PROGRAM_LABEL[k]}>
              <NumberInput value={inputs.volume.mixPct[k]} min={0} max={100} step={5} suffix="%" onChange={(v) => setMix(k, v)} />
            </Field>
          ))}
        </Row>
        {(Math.abs(mixTotal - 100) > 0.5 || Math.abs(mixTotalMk - 100) > 0.5) && <Callout tone="bad">Program mix totals {mixTotal.toFixed(0)}% — it must total 100%.</Callout>}

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>Short-term cash vs long-term book — and when the chargeback risk ends</div>
          <Row cols={3} gap={12}>
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>Debt Settlement (LD)</div>
              <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 6 }}>8% of debt paid once at month 2. Liability ends after the 2nd client payment. No perpetuity.</div>
              <Row cols={2}>
                <Field label="First payment clears"><NumberInput value={inputs.survivalCurves.LEVEL.firstPayPct} min={0} max={100} step={1} suffix="%" onChange={(v) => setSurvival('LEVEL', v, inputs.survivalCurves.LEVEL.steadyStateMonthlyCancelPct)} /></Field>
                <Field label="Cancel before 2nd payment"><NumberInput value={inputs.survivalCurves.LEVEL.steadyStateMonthlyCancelPct} min={0} max={100} step={1} suffix="%" onChange={(v) => setSurvival('LEVEL', inputs.survivalCurves.LEVEL.firstPayPct, v)} /></Field>
              </Row>
            </div>
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>Debt Validation (SS)</div>
              <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 6 }}>File buyout: one lump sum once the first payment clears — (payment − $40) × 65% × 6 (× 100% × 6 on $20k+) — exposure ends there. Perpetual: 100% of net for payments 1–4, then 35% to month 36, month-by-month risk.</div>
              <Row cols={3}>
                <Field label="Files sold as buyout"><NumberInput value={inputs.consumerShield.buyoutSharePct} min={0} max={100} step={5} suffix="%" onChange={setBuyout} /></Field>
                <Field label="First payment clears"><NumberInput value={inputs.survivalCurves.CS.firstPayPct} min={0} max={100} step={1} suffix="%" onChange={(v) => setSurvival('CS', v, inputs.survivalCurves.CS.steadyStateMonthlyCancelPct)} /></Field>
                <Field label="Cancel / month"><NumberInput value={inputs.survivalCurves.CS.steadyStateMonthlyCancelPct} min={0} max={100} step={0.5} suffix="%" onChange={(v) => setSurvival('CS', inputs.survivalCurves.CS.firstPayPct, v)} /></Field>
              </Row>
            </div>
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>Debt Resolution (ELP)</div>
              <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 6 }}>Accelerated (Exhibit D Option 2): 90% of net for months 1–7, then 25% to month 24; under-24-month files fall back to residual. Residual: 60% of the net draft monthly to 48 months.</div>
              <Row cols={3}>
                <Field label="Files on accelerated"><NumberInput value={inputs.legacy.acceleratedSharePct ?? 0} min={0} max={100} step={5} suffix="%" onChange={setAccel} /></Field>
                <Field label="First payment clears"><NumberInput value={inputs.survivalCurves.LEGACY.firstPayPct} min={0} max={100} step={1} suffix="%" onChange={(v) => setSurvival('LEGACY', v, inputs.survivalCurves.LEGACY.steadyStateMonthlyCancelPct)} /></Field>
                <Field label="Cancel / month"><NumberInput value={inputs.survivalCurves.LEGACY.steadyStateMonthlyCancelPct} min={0} max={100} step={0.5} suffix="%" onChange={(v) => setSurvival('LEGACY', inputs.survivalCurves.LEGACY.firstPayPct, v)} /></Field>
              </Row>
            </div>
          </Row>
          <div style={{ ...card, marginTop: 10, borderLeft: `4px solid ${taxIn.enabled ? '#7c3aed' : T.line}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 13 }}>Tax resolution (Milestone) — sold on the same calls</div>
                <div style={{ fontSize: 11.5, color: T.muted }}>Phase 1 investigation fee, then Phase 2 resolution. Funding Tier is paid a share of each as the client's payments clear; the rate locks at funding; ~15-day refund window. Reps are paid a share of what Funding Tier earns.</div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700 }}>
                <input type="checkbox" checked={taxIn.enabled} onChange={(e) => setTax({ enabled: e.target.checked })} /> On
              </label>
            </div>
            <Row cols={6} gap={10} style={{ marginTop: 8 }}>
              <Field label="Debt deals that buy Phase 1" tooltip="Conservative 5%; Milestone's target is 10%."><NumberInput value={taxIn.attachPct} min={0} max={100} step={1} suffix="%" onChange={(v) => setTax({ attachPct: v })} /></Field>
              <Field label="Phase 1 fee" tooltip="$500 standard; up to $1,500 depending on the case."><NumberInput value={taxIn.phase1Fee} min={0} step={50} prefix="$" onChange={(v) => setTax({ phase1Fee: v })} /></Field>
              <Field label="Our share of Phase 1"><NumberInput value={taxIn.phase1SharePct} min={0} max={100} step={5} suffix="%" onChange={(v) => setTax({ phase1SharePct: v })} /></Field>
              <Field label="Phase 1 → Phase 2" tooltip="Conservative 50%; Milestone reports 70%."><NumberInput value={taxIn.phase2ConversionPct} min={0} max={100} step={5} suffix="%" onChange={(v) => setTax({ phase2ConversionPct: v })} /></Field>
              <Field label="Phase 2 average case"><NumberInput value={taxIn.phase2Fee} min={0} step={250} prefix="$" onChange={(v) => setTax({ phase2Fee: v })} /></Field>
              <Field label="Our share of Phase 2" tooltip="40% / 50% / 60% by monthly volume tier."><NumberInput value={taxIn.phase2SharePct} min={0} max={100} step={5} suffix="%" onChange={(v) => setTax({ phase2SharePct: v })} /></Field>
            </Row>
            <Row cols={6} gap={10} style={{ marginTop: 6 }}>
              <Field label="Phase 2 paid over (months)"><NumberInput value={taxIn.phase2InstallmentMonths} min={1} max={24} step={1} onChange={(v) => setTax({ phase2InstallmentMonths: v })} /></Field>
              <Field label="Refunds / chargebacks"><NumberInput value={taxIn.refundPct} min={0} max={100} step={1} suffix="%" onChange={(v) => setTax({ refundPct: v })} /></Field>
              <Field label="Rep share of our tax earnings"><NumberInput value={taxIn.repCommissionPct} min={0} max={100} step={5} suffix="%" onChange={(v) => setTax({ repCommissionPct: v })} /></Field>
              <div style={{ gridColumn: 'span 3', fontSize: 12.5, paddingTop: 18 }}>
                Adds <strong>{fmtMoney(taxNetPerDebtDeal)}</strong> net per debt deal after the rep ({fmtMoney(taxPerDebtDeal)} before).
                {taxIn.enabled && <> At maturity: {fmtNum(m.taxP1, 1)} Phase 1 and {fmtNum(m.taxP2, 1)} Phase 2 cases a month, <strong>{fmtMoney(m.taxRevenue)}</strong> revenue, {fmtMoney(m.taxCommission)} rep commission.</>}
              </div>
            </Row>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginTop: 8 }}>
          <thead><tr>
            <th style={th}>Program</th><th style={{ ...th, textAlign: 'right' }}>Share</th>
            <th style={{ ...th, textAlign: 'right' }}>Full-term revenue / deal</th><th style={{ ...th, textAlign: 'right' }}>Rep commission</th>
            <th style={{ ...th, textAlign: 'right' }}>Expected revenue / deal</th><th style={{ ...th, textAlign: 'right' }}>Expected commission</th>
            <th style={{ ...th, textAlign: 'right' }}>Net to Funding Tier / deal</th>
          </tr></thead>
          <tbody>
            {programRows.map((r) => (
              <tr key={r.k}>
                <td style={td}><PartnerName k={r.k} size={16} /></td>
                <td style={tdNum}>{fmtNum(r.pct)}%</td>
                <td style={tdNum}>{fmtMoney(r.full)}</td>
                <td style={tdNum}>{fmtMoney(r.comm)}</td>
                <td style={tdNum}>{fmtMoney(r.exp)}</td>
                <td style={tdNum}>{fmtMoney(r.expComm)}</td>
                <td style={{ ...tdNum, fontWeight: 800 }}>{fmtMoney(r.net)}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 800, background: T.panel }}>
              <td style={td}>Blended at {fmtMoney(blendedDebt)} avg debt</td><td style={tdNum}>100%</td><td style={tdNum} /><td style={tdNum} />
              <td style={tdNum}>{fmtMoney(blendedExp)}</td><td style={tdNum} /><td style={tdNum}>{fmtMoney(blendedNet)}</td>
            </tr>
          </tbody>
        </table>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>
          A deal is worth {fmtMoney(blendedNet)} to Funding Tier after the rep. It costs {fmtMoney(costPerDeal.transfers)} by transfer{costPerDeal.mail > 0 ? `, ${fmtMoney(costPerDeal.mail)} by mail` : ''}{costPerDeal.social > 0 ? `, ${fmtMoney(costPerDeal.social)} by social` : ''} to acquire. Every method whose cost per deal is below {fmtMoney(blendedNet)} adds profit; above it, it does not.
        </div>
      </Panel>

      <ElectionPlanner inputs={inputs} />

      {/* ── Bottom line ── */}
      <Panel title="5 · The bottom line — mature month, every cost paid" accent={T.accent}
        tooltip="Average of the last six months of a 48-month run, so every cohort that can be stacked is stacked and Shield / ELP residuals are counted. Capital needed is the deepest the cash position goes.">
        <Row cols={7} gap={10}>
          {tile('Deals / month', fmtNum(m.deals, 1), `${fmtMoney(enrolled)} enrolled debt`)}
          {tile('Revenue', fmtMoney(m.revenue), m.taxRevenue > 0 ? `${fmtMoney(m.taxRevenue)} from tax resolution` : undefined)}
          {tile('Rep commission + bonuses', `−${fmtMoney(m.commission + m.bonuses)}`)}
          {tile('Labor', `−${fmtMoney(m.labor)}`)}
          {tile('Transfers + marketing', `−${fmtMoney(m.transfers + m.marketing)}`, `${fmtMoney(m.transfers)} transfers · ${fmtMoney(m.marketing)} mail/social`)}
          {tile('Other overhead', `−${fmtMoney(other)}`, 'telecom, software, credit pulls, fixed')}
          {tile('Net profit / month', fmtMoney(m.net), `${fmtPct(m.revenue > 0 ? (m.net / m.revenue) * 100 : 0, 0)} margin`, profitable ? 'good' : 'bad')}
        </Row>
        <Row cols={4} gap={10} style={{ marginTop: 10 }}>
          {tile('Year 1 net cash', fmtMoney(year1Net), undefined, year1Net < 0 ? 'bad' : 'good')}
          {tile('Capital needed', fmtMoney(mature.totals.peakCapitalRequired), 'deepest point of the cash position')}
          {tile('Cash-positive month', cashPos ?? 'not within 48', cashPos ? 'cumulative cash back above zero' : undefined, cashPos ? 'good' : 'bad')}
          {tile('Cash at month 48', fmtMoney(mature.totals.finalCash), undefined, mature.totals.finalCash < 0 ? 'bad' : 'good')}
        </Row>
      </Panel>

      {/* ── KPI targets ── */}
      <Panel title="6 · The numbers to watch — when to hire, when to invest" accent={T.accent}
        tooltip="The triggers the month-by-month table applies. Each is a measurable KPI in app.krestmarketing.com and the pay engine.">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, tableLayout: 'fixed' }}>
          <colgroup><col style={{ width: '14%' }} /><col style={{ width: '26%' }} /><col style={{ width: '30%' }} /><col style={{ width: '30%' }} /></colgroup>
          <thead><tr><th style={th}>Decision</th><th style={th}>KPI</th><th style={th}>Target</th><th style={th}>Where it stands in this plan</th></tr></thead>
          <tbody>
            <tr><td style={{ ...td, fontWeight: 700, whiteSpace: 'normal' }}>Hire the next closer</td><td style={{ ...td, whiteSpace: 'normal' }}>Closer occupancy two months running, and bank balance after reserve</td><td style={{ ...td, whiteSpace: 'normal' }}>≥ 90% occupancy for 2 months and bank ≥ reserve + 3 × {fmtMoney(seatCost)} (three months of the new seat)</td><td style={{ ...td, whiteSpace: 'normal' }}>{firstHire ? <>First met in <strong>month {firstHire}</strong></> : 'Not met in the months shown'}; mature occupancy {fmtNum(m.utilization)}%</td></tr>
            <tr><td style={{ ...td, fontWeight: 700, whiteSpace: 'normal' }}>Invest in growth marketing</td><td style={{ ...td, whiteSpace: 'normal' }}>Cost per deal of the owned channel vs what a deal earns after the rep</td><td style={{ ...td, whiteSpace: 'normal' }}>Cost per deal &lt; {fmtMoney(blendedNet)} and bank ≥ reserve + 2 × {fmtMoney(growthStep)} (two months of the next spend step)</td><td style={{ ...td, whiteSpace: 'normal' }}>{Number.isFinite(cheapestOwnedCostPerDeal) ? <>Best owned channel {fmtMoney(cheapestOwnedCostPerDeal)} / deal — {ownedChannelPays ? 'pays' : 'does not pay yet'}</> : 'No owned channel on'}{firstInvest ? <>; first affordable in <strong>month {firstInvest}</strong></> : ''}</td></tr>
            <tr><td style={{ ...td, fontWeight: 700, whiteSpace: 'normal' }}>Keep the lights on</td><td style={{ ...td, whiteSpace: 'normal' }}>Bank balance vs reserve target ({inputs.reservePolicy.targetMonthsOfOverhead} months of overhead + chargeback buffer)</td><td style={{ ...td, whiteSpace: 'normal' }}>Balance never below zero; reserve met before any expansion</td><td style={{ ...td, whiteSpace: 'normal' }}>{cashOut ? <strong style={{ color: T.bad }}>Runs out in month {cashOut}</strong> : <>Lowest balance {fmtMoney(mature.totals.lowestCash)}</>}; reserve first met {mature.totals.reserveTargetFirstMet ? `month ${mature.totals.reserveTargetFirstMet}` : 'not within the horizon'}</td></tr>
            <tr><td style={{ ...td, fontWeight: 700, whiteSpace: 'normal' }}>File quality</td><td style={{ ...td, whiteSpace: 'normal' }}>First-payment clear rate; monthly cancellation by program</td><td style={{ ...td, whiteSpace: 'normal' }}>First pay ≥ {sc.firstPayPct}% and rising with qualification + AI call QC; cancel at or below the rate modeled</td><td style={{ ...td, whiteSpace: 'normal' }}>Modeled: LD {inputs.survivalCurves.LEVEL.firstPayPct}% / {inputs.survivalCurves.LEVEL.steadyStateMonthlyCancelPct}%, SS {sc.firstPayPct}% / {sc.steadyStateMonthlyCancelPct}%, ELP {inputs.survivalCurves.LEGACY.firstPayPct}% / {inputs.survivalCurves.LEGACY.steadyStateMonthlyCancelPct}%</td></tr>
            <tr><td style={{ ...td, fontWeight: 700, whiteSpace: 'normal' }}>Channel health</td><td style={{ ...td, whiteSpace: 'normal' }}>Transfer close rate; mail response and qualified share; social CPL</td><td style={{ ...td, whiteSpace: 'normal' }}>Transfers ≥ {ops.closeRatePct}% close; mail ≥ {mk.directMail.responsePct}% response at ≥ {mk.directMail.qualifiedPct}% qualified; social ≤ {fmtMoney(mk.paidSocial.costPerLead)} CPL</td><td style={{ ...td, whiteSpace: 'normal' }}>Measured per campaign code in app.krestmarketing.com; replace these assumptions with the first drop's numbers</td></tr>
          </tbody>
        </table>
      </Panel>

      {/* ── Month by month ── */}
      <Panel title="7 · Month by month — cash, occupancy and the signal to act" accent={T.accent}
        right={<button onClick={() => setShowAll(!showAll)} style={{ padding: '4px 10px', borderRadius: 8, border: `1px solid ${T.line}`, background: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{showAll ? 'Show 24 months' : `Show all ${months.length}`}</button>}
        tooltip="Bank balance starts at the capital above. Signal applies the triggers in section 6 to each month: out of cash, hire a closer, invest in growth, reserve met, or build reserve.">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1100 }}>
            <thead><tr>
              <th style={th}>Mo</th><th style={{ ...th, textAlign: 'right' }}>Seats</th><th style={{ ...th, textAlign: 'right' }}>Deals</th>
              <th style={{ ...th, textAlign: 'right' }}>Revenue</th><th style={{ ...th, textAlign: 'right' }}>Labor</th><th style={{ ...th, textAlign: 'right' }}>Transfers + mkt</th>
              <th style={{ ...th, textAlign: 'right' }}>Comm. + bonus</th><th style={{ ...th, textAlign: 'right' }}>Other</th><th style={{ ...th, textAlign: 'right' }}>Net</th>
              <th style={{ ...th, textAlign: 'right' }}>Bank</th><th style={{ ...th, textAlign: 'right' }}>Reserve target</th><th style={{ ...th, textAlign: 'right' }}>Occupancy</th><th style={{ ...th, textAlign: 'right' }}>Unanswered</th><th style={th}>Signal</th>
            </tr></thead>
            <tbody>
              {monthRows.map(({ r, bank, signal }) => {
                const otherM = Math.max(0, r.overhead - r.laborCost - r.transferCost - r.marketingCost);
                const sig = {
                  'out-of-cash': { l: 'Out of cash', c: T.bad, bg: T.badBg },
                  'hire': { l: 'Hire a closer', c: T.good, bg: T.goodBg },
                  'invest': { l: 'Invest in growth', c: '#1a6ed8', bg: '#eaf2fd' },
                  'reserve-met': { l: 'Reserve met', c: T.good, bg: '#fff' },
                  'build-reserve': { l: 'Build reserve', c: T.muted, bg: '#fff' },
                }[signal];
                return (
                  <tr key={r.month} style={{ background: bank < 0 ? T.badBg : undefined }}>
                    <td style={{ ...td, fontWeight: 700 }}>{r.month}</td>
                    <td style={tdNum}>{r.seats}</td>
                    <td style={tdNum}>{fmtNum(r.deals, 1)}</td>
                    <td style={tdNum}>{fmtMoney(r.revenue)}</td>
                    <td style={tdNum}>{fmtMoney(r.laborCost)}</td>
                    <td style={tdNum}>{fmtMoney(r.transferCost + r.marketingCost)}</td>
                    <td style={tdNum}>{fmtMoney(r.repCommission + r.bonusPaid + r.managerOverride)}</td>
                    <td style={tdNum}>{fmtMoney(otherM)}</td>
                    <td style={{ ...tdNum, fontWeight: 700, color: r.netCashFlow < 0 ? T.bad : T.good }}>{fmtMoney(r.netCashFlow)}</td>
                    <td style={{ ...tdNum, fontWeight: 800, color: bank < 0 ? T.bad : T.ink }}>{fmtMoney(bank)}</td>
                    <td style={tdNum}>{fmtMoney(r.reserveTarget)}</td>
                    <td style={tdNum}>{fmtNum(r.utilizationPct)}%</td>
                    <td style={tdNum}>{fmtNum(r.marketing.unansweredCalls)}</td>
                    <td style={td}><span style={{ fontSize: 11, fontWeight: 800, color: sig.c, background: sig.bg, border: `1px solid ${sig.c}33`, borderRadius: 6, padding: '2px 7px', whiteSpace: 'nowrap' }}>{sig.l}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11.5, color: T.muted, marginTop: 6 }}>
          Revenue arrives behind the deals (Level Debt pays at month 2; Shield and ELP build month over month), so early months run negative even in a plan that is clearly profitable at maturity — that gap is what the capital is for.
        </div>
      </Panel>

      {children && (
        <Panel title="Advanced — channel detail, scale planner, ROI tracking" collapsible defaultOpen={false}>
          {children}
        </Panel>
      )}
    </>
  );
}
