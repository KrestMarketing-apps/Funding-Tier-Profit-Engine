import React from 'react';
import type { BackendKey, Employee, ModelInputs, ModelResults } from './types';
import { BACKEND_KEYS } from './types';
import { Callout, Field, NumberInput, Panel, Row, T, fmtMoney, fmtMoney2, fmtNum, fmtPct, td, tdNum, th, PartnerName } from './ui';
import { makeEmployee } from './config';
import { runModel } from './simulate';
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

function countTeam(roster: Employee[]) {
  return {
    owner: roster.filter((e) => e.type === 'owner').length,
    us: roster.filter((e) => (e.type === 'inhouse' || e.type === 'manager') && e.role !== 'opener').length,
    bpo: roster.filter((e) => e.type === 'bpo').length,
  };
}

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
  const setOwner = (n: number) => setRoster(resizeGroup(inputs.roster, (e) => e.type === 'owner', Math.min(1, n),
    () => makeEmployee({ name: 'Owner Operator', type: 'owner', role: 'closer', teamId: 'team-a' })));
  const setUs = (n: number) => setRoster(resizeGroup(inputs.roster, (e) => (e.type === 'inhouse' || e.type === 'manager') && e.role !== 'opener', n,
    (i) => makeEmployee({ name: `Closer ${i} — In-House`, type: 'inhouse', role: 'closer', teamId: 'team-a' })));
  const setBpo = (n: number) => setRoster(resizeGroup(inputs.roster, (e) => e.type === 'bpo', n,
    (i) => makeEmployee({ name: `Opener ${i} — BPO`, type: 'bpo', role: 'opener', teamId: 'team-a' })));

  const setOps = (p: Partial<typeof ops>) => setInputs({ ...inputs, operations: { ...ops, ...p } });
  const setTransferClose = (v: number) => setOps({ closeRatePct: v, buffers: ops.buffers.map((b) => ({ ...b, closeRatePct: v })) });
  const setTransferDebt = (v: number) => setInputs({ ...inputs, volume: { ...inputs.volume, avgDebt: { LEVEL: v, CS: v, LEGACY: v } } });
  const setMail = (p: Partial<typeof mk.directMail>) => setInputs({ ...inputs, marketing: { ...mk, directMail: { ...mk.directMail, ...p } } });
  const setSocial = (p: Partial<typeof mk.paidSocial>) => setInputs({ ...inputs, marketing: { ...mk, paidSocial: { ...mk.paidSocial, ...p } } });
  const setMix = (k: BackendKey, v: number) => setInputs({ ...inputs, volume: { ...inputs.volume, mixPct: { ...inputs.volume.mixPct, [k]: v } }, marketing: { ...mk, mixPct: { ...(mk.mixPct ?? inputs.volume.mixPct), [k]: v } } });

  const mailBudget = mk.directMail.enabled ? mk.directMail.piecesPerMonth * mk.directMail.costPerPiece + mk.directMail.dataCostPerMonth : 0;
  const setMailBudget = (b: number) => {
    const dm = mk.directMail;
    if (b <= 0) { setMail({ enabled: false }); return; }
    const pieces = Math.max(0, Math.floor((b - dm.dataCostPerMonth) / Math.max(0.01, dm.costPerPiece) / 500) * 500);
    setMail({ enabled: pieces > 0, piecesPerMonth: pieces, startMonth: 1 });
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
  const sc = inputs.survivalCurves.CS;

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
              {cashPos ? <> It turns cash-positive in <strong>month {cashPos}</strong> and needs <strong>{fmtMoney(mature.totals.peakCapitalRequired)}</strong> of capital to get there.</>
                : <> It never turns cash-positive inside {MATURE_HORIZON} months; the cash hole reaches <strong>{fmtMoney(mature.totals.peakCapitalRequired)}</strong>.</>}
              {' '}Year 1 nets <strong style={{ color: year1Net < 0 ? T.bad : T.good }}>{fmtMoney(year1Net)}</strong>.
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: T.muted, maxWidth: 420 }}>
            Safe assumptions in force: {sc.firstPayPct}% first payment clears, {sc.steadyStateMonthlyCancelPct}% of active files cancel each month, {ops.avgHandleMinutes}-minute calls, {inputs.volume.dealsPer8CloserHours} deals per 8 closer hours. Change them in Risk &amp; Attrition / Operations and this page follows.
          </div>
        </div>
      </div>

      {/* ── Team ── */}
      <Panel title="1 · Team — who is on the phones" accent={T.accent}
        tooltip="Owner-operator closes on commission only. US closers are W-2 in-house at the labor policy's rate and shifts. BPO openers generate transfers at the opener rate instead of buying them. Edit individuals in Staffing & Labor.">
        <Row cols={5} gap={12}>
          <Field label="Owner-operator (closes)"><NumberInput value={team.owner} min={0} max={1} onChange={setOwner} /></Field>
          <Field label="US-based closers"><NumberInput value={team.us} min={0} max={60} onChange={setUs} /></Field>
          <Field label="BPO openers"><NumberInput value={team.bpo} min={0} max={60} onChange={setBpo} /></Field>
          <Field label="Closer talk time / month"><div style={{ fontFamily: T.mono, fontWeight: 800, fontSize: 16, padding: '7px 0' }}>{fmtNum(m.closerHours)} hrs</div></Field>
          <Field label="Labor / month"><div style={{ fontFamily: T.mono, fontWeight: 800, fontSize: 16, padding: '7px 0' }}>{fmtMoney(m.labor)}</div></Field>
        </Row>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>
          {team.owner + team.us + team.bpo} agents: {fmtPct(((team.owner) / Math.max(1, team.owner + team.us + team.bpo)) * 100, 0)} owner · {fmtPct((team.us / Math.max(1, team.owner + team.us + team.bpo)) * 100, 0)} US closers · {fmtPct((team.bpo / Math.max(1, team.owner + team.us + team.bpo)) * 100, 0)} BPO openers
        </div>
      </Panel>

      {/* ── Three methods side by side ── */}
      <Panel title="2 · Where the calls come from — three methods, each with its own budget" accent={T.accent}
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
      <Panel title="3 · Where enrollments go — and what each one earns after the rep" accent={T.accent}
        tooltip="Share of enrollments by program. Revenue per deal is the contract (full term) and what the model expects after first-pay and cancellation; the rep is paid only on files whose first payment clears.">
        <Row cols={3} gap={12}>
          {BACKEND_KEYS.map((k) => (
            <Field key={k} label={PROGRAM_LABEL[k]}>
              <NumberInput value={inputs.volume.mixPct[k]} min={0} max={100} step={5} suffix="%" onChange={(v) => setMix(k, v)} />
            </Field>
          ))}
        </Row>
        {(Math.abs(mixTotal - 100) > 0.5 || Math.abs(mixTotalMk - 100) > 0.5) && <Callout tone="bad">Program mix totals {mixTotal.toFixed(0)}% — it must total 100%.</Callout>}
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

      {/* ── Bottom line ── */}
      <Panel title="4 · The bottom line — mature month, every cost paid" accent={T.accent}
        tooltip="Average of the last six months of a 48-month run, so every cohort that can be stacked is stacked and Shield / ELP residuals are counted. Capital needed is the deepest the cash position goes.">
        <Row cols={7} gap={10}>
          {tile('Deals / month', fmtNum(m.deals, 1), `${fmtMoney(enrolled)} enrolled debt`)}
          {tile('Revenue', fmtMoney(m.revenue))}
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

      {children && (
        <Panel title="Advanced — channel detail, scale planner, ROI tracking" collapsible defaultOpen={false}>
          {children}
        </Panel>
      )}
    </>
  );
}
