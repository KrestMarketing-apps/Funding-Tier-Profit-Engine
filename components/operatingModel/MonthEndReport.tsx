'use client';
import React from 'react';
import type { ModelInputs, ModelResults, MonthRow } from './types';
import { BACKEND_KEYS } from './types';
import { BRANDS } from './config';
import {
  Btn, Callout, G, Info, Panel, PartnerName, T,
  fmtMoney, fmtMoney2, fmtNum, fmtPct, td, tdNum, th,
} from './ui';

// ── CSV ──────────────────────────────────────────────────────────────────────
const esc = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows: (string | number)[][]) => rows.map((r) => r.map(esc).join(',')).join('\n');

function download(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function monthCsv(inputs: ModelInputs, r: MonthRow): string {
  const rows: (string | number)[][] = [
    ['Funding Tier — Month-End Statement'],
    ['Month', r.month],
    [],
    ['REVENUE', 'Deals', 'Active paying deals', 'Amount'],
    ...r.partners.map((p) => [BRANDS[p.key].name, p.dealsSubmitted, Math.round(p.activeDeals), p.revenue.toFixed(2)]),
    ['Total revenue', r.deals, '', r.revenue.toFixed(2)],
    [],
    ['COMPENSATION', '', '', 'Amount'],
    ...r.partners.map((p) => [`Rep commission — ${BRANDS[p.key].name}`, '', '', (-p.repCommission).toFixed(2)]),
    ['Manager / owner overrides', '', '', (-r.managerOverride).toFixed(2)],
    ...r.bonuses.lines.map((b) => [b.label, b.detail, b.formula, (-b.amount).toFixed(2)]),
    ['Bonus holdback (provisional)', '', '', r.bonuses.heldBack.toFixed(2)],
    ['Total compensation', '', '', (-(r.repCommission + r.managerOverride + r.bonusPaid)).toFixed(2)],
    [],
    ['OPERATING COSTS', 'Detail', 'Formula', 'Amount'],
    ...r.costs.groups.flatMap((g) => [
      ...g.lines.map((l) => [l.label, l.detail, l.formula, (-l.amount).toFixed(2)]),
      [`${g.label} — subtotal`, '', '', (-g.subtotal).toFixed(2)],
    ]),
    ['Total overhead', '', '', (-r.overhead).toFixed(2)],
    [],
    ['TRANSFER FUNNEL', 'Raw', 'Duds', 'Billed'],
    ...r.funnel.buffers.map((b) => [b.label, Math.round(b.rawTransfers), Math.round(b.duds), Math.round(b.billedTransfers)]),
    ['Total', Math.round(r.funnel.rawTransfers), Math.round(r.funnel.duds), Math.round(r.funnel.billedTransfers)],
    ['Pass rate %', r.funnel.blendedPassRatePct.toFixed(1)],
    ['Close rate on all %', r.funnel.closeRateOnAllPct.toFixed(1)],
    ['Close rate on billed %', r.funnel.closeRateOnBilledPct.toFixed(1)],
    ['Cost per closed deal', r.funnel.costPerClosedDeal.toFixed(2)],
    [],
    ['CASH RECONCILIATION', '', '', 'Amount'],
    ['Revenue', '', '', r.revenue.toFixed(2)],
    ['Less rep commission', '', '', (-r.repCommission).toFixed(2)],
    ['Less overrides', '', '', (-r.managerOverride).toFixed(2)],
    ['Less bonuses paid', '', '', (-r.bonusPaid).toFixed(2)],
    ['Less overhead', '', '', (-r.overhead).toFixed(2)],
    ['Net cash flow', '', '', r.netCashFlow.toFixed(2)],
    ['Opening cash', '', '', (r.cashPosition - r.netCashFlow).toFixed(2)],
    ['Closing cash', '', '', r.cashPosition.toFixed(2)],
    ['Reserve target', '', '', r.reserveTarget.toFixed(2)],
    ['Reserve met', '', '', r.reserveMet ? 'Yes' : 'No'],
  ];
  return toCsv(rows);
}

function allMonthsCsv(results: ModelResults): string {
  const head = [
    'Month', 'Deals', 'Revenue', 'Rep commission', 'Manager override', 'Bonuses paid',
    'Bonus held back', 'Labor', 'Transfer cost', 'Overhead total', 'Net cash flow',
    'Cash position', 'Reserve target', 'Reserve met', 'Headcount', 'Utilization %',
    'Raw transfers', 'Duds', 'Billed transfers', 'Pass rate %', 'Close on all %',
    'Close on billed %', 'Cost per closed deal',
  ];
  const rows = results.months.map((r) => [
    r.month, r.deals, r.revenue.toFixed(2), r.repCommission.toFixed(2),
    r.managerOverride.toFixed(2), r.bonusPaid.toFixed(2), r.bonuses.heldBack.toFixed(2),
    r.laborCost.toFixed(2), r.transferCost.toFixed(2), r.overhead.toFixed(2),
    r.netCashFlow.toFixed(2), r.cashPosition.toFixed(2), r.reserveTarget.toFixed(2),
    r.reserveMet ? 'Yes' : 'No', r.seats, r.utilizationPct.toFixed(1),
    Math.round(r.funnel.rawTransfers), Math.round(r.funnel.duds), Math.round(r.funnel.billedTransfers),
    r.funnel.blendedPassRatePct.toFixed(1), r.funnel.closeRateOnAllPct.toFixed(1),
    r.funnel.closeRateOnBilledPct.toFixed(1), r.funnel.costPerClosedDeal.toFixed(2),
  ]);
  return toCsv([head, ...rows]);
}

// ── Report ───────────────────────────────────────────────────────────────────
function Line({ label, detail, amount, indent = 0, bold, rule, negative }: {
  label: string; detail?: string; amount: number; indent?: number;
  bold?: boolean; rule?: boolean; negative?: boolean;
}) {
  return (
    <tr>
      <td style={{
        ...td, paddingLeft: 12 + indent * 18, whiteSpace: 'normal',
        fontWeight: bold ? 800 : 400, color: bold ? T.ink : T.body,
        borderTop: rule ? `2px solid ${T.ink}` : undefined,
        borderBottom: bold ? 'none' : `1px solid ${T.lineSoft}`,
      }}>
        {label}
        {detail && <div style={{ fontSize: 10, color: T.faint, marginTop: 1 }}>{detail}</div>}
      </td>
      <td style={{
        ...tdNum, fontWeight: bold ? 800 : 500,
        color: negative ? T.bad : bold ? T.ink : T.body,
        borderTop: rule ? `2px solid ${T.ink}` : undefined,
        borderBottom: bold ? 'none' : `1px solid ${T.lineSoft}`,
        fontSize: bold ? 13.5 : 12,
      }}>
        {negative ? `(${fmtMoney(Math.abs(amount))})` : fmtMoney(amount)}
      </td>
    </tr>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={2} style={{
        ...td, background: T.panel, fontWeight: 800, fontSize: 10.5,
        letterSpacing: 0.5, textTransform: 'uppercase', color: T.ink,
      }}>{children}</td>
    </tr>
  );
}

export function MonthEndReport({ inputs, results, month, setMonth }: {
  inputs: ModelInputs; results: ModelResults; month: number; setMonth: (m: number) => void;
}) {
  const r = results.months[Math.min(month, results.months.length) - 1];
  if (!r) return null;
  const totalComp = r.repCommission + r.managerOverride + r.bonusPaid;
  const f = r.funnel;

  return (
    <Panel
      title="Month-End Accounting Statement"
      accent={T.brand}
      subtitle={`Month ${r.month} · ${r.costs.headcount} on payroll · ${fmtNum(r.deals, 0)} deals submitted`}
      tooltip="A complete accounting of one month: what came in, what was paid out to people, what it cost to operate, and how cash moved. Every line traces to the same figures used everywhere else in the tool."
      right={
        <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="number" min={1} max={results.months.length} value={month}
            onChange={(e) => setMonth(Math.min(results.months.length, Math.max(1, Number(e.target.value))))}
            style={{
              width: 62, padding: '5px 7px', border: `1px solid ${T.line}`,
              borderRadius: 7, fontFamily: T.mono, fontSize: 13, fontWeight: 700,
            }}
          />
          <Btn size="sm" onClick={() => download(`funding-tier-month-${r.month}.csv`, monthCsv(inputs, r))}>
            CSV — this month
          </Btn>
          <Btn size="sm" onClick={() => download('funding-tier-all-months.csv', allMonthsCsv(results))}>
            CSV — all months
          </Btn>
        </span>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        {/* ── Money in / money out ── */}
        <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'hidden', background: G.tile }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              <SectionHead>Revenue received</SectionHead>
              {r.partners.map((p) => (
                <tr key={p.key}>
                  <td style={{ ...td, paddingLeft: 12 }}>
                    <PartnerName k={p.key} size={16} />
                    <div style={{ fontSize: 10, color: T.faint, marginTop: 1 }}>
                      {fmtNum(p.dealsSubmitted, 0)} new · {fmtNum(p.activeDeals, 0)} still paying
                    </div>
                  </td>
                  <td style={tdNum}>{fmtMoney(p.revenue)}</td>
                </tr>
              ))}
              <Line label="Total revenue" amount={r.revenue} bold />

              <SectionHead>Compensation paid out</SectionHead>
              {r.partners.filter((p) => p.repCommission > 0).map((p) => (
                <Line key={p.key} label={`Rep commission — ${BRANDS[p.key].name}`} amount={p.repCommission} indent={1} negative />
              ))}
              {r.repCommission === 0 && (
                <Line label="Rep commission" detail="None due this month" amount={0} indent={1} />
              )}
              {r.managerOverride > 0 && (
                <Line
                  label="Manager / owner overrides"
                  detail={`On team ${inputs.overridePolicy.base === 'enrolledVolume' ? 'enrolled debt volume'
                    : inputs.overridePolicy.base === 'repCommission' ? 'rep commission' : 'Funding Tier revenue'}`}
                  amount={r.managerOverride} indent={1} negative
                />
              )}
              {r.bonuses.lines.filter((b) => b.amount > 0).map((b) => (
                <Line key={b.id} label={b.label} detail={b.detail} amount={b.amount} indent={1} negative />
              ))}
              {r.bonuses.heldBack > 0 && (
                <Line label="Less provisional holdback" detail="Withheld pending clawback / chargeback clearance" amount={-r.bonuses.heldBack} indent={1} />
              )}
              <Line label="Total compensation" amount={totalComp} bold negative />

              <SectionHead>Operating costs</SectionHead>
              {r.costs.groups.map((g) => (
                <Line key={g.id} label={g.label} detail={g.note} amount={g.subtotal} indent={1} negative />
              ))}
              <Line label="Total overhead" amount={r.overhead} bold negative />

              <SectionHead>Cash</SectionHead>
              <Line label="Opening cash" amount={r.cashPosition - r.netCashFlow} indent={1} />
              <Line label="Net cash flow" detail="Revenue − compensation − overhead" amount={r.netCashFlow} indent={1} />
              <Line label="Closing cash" amount={r.cashPosition} bold rule />
              <Line label="Reserve target" detail={`${inputs.reservePolicy.targetMonthsOfOverhead} months of overhead + chargeback buffer`} amount={r.reserveTarget} indent={1} />
            </tbody>
          </table>
        </div>

        {/* ── Funnel + bonus detail ── */}
        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'hidden', background: G.tile }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={th}>Transfer funnel<Info text="Raw transfers are every call routed to you. A transfer that disconnects before the buffer elapses is a dud and is never invoiced. Only billed transfers cost money — which is exactly what a longer, more expensive buffer buys you." /></th>
                  <th style={{ ...th, textAlign: 'right' }}>Raw</th>
                  <th style={{ ...th, textAlign: 'right' }}>Duds</th>
                  <th style={{ ...th, textAlign: 'right' }}>Billed</th>
                  <th style={{ ...th, textAlign: 'right' }}>Cost</th>
                  <th style={{ ...th, textAlign: 'right' }}>Per deal</th>
                </tr>
              </thead>
              <tbody>
                {f.buffers.filter((b) => b.mixPct > 0).map((b) => (
                  <tr key={b.key}>
                    <td style={td}>
                      {b.label}
                      <div style={{ fontSize: 10, color: T.faint }}>
                        {fmtMoney(b.price)} · {b.mixPct}% mix · {b.passRatePct}% pass
                      </div>
                    </td>
                    <td style={tdNum}>{fmtNum(b.rawTransfers, 0)}</td>
                    <td style={{ ...tdNum, color: T.faint }}>{fmtNum(b.duds, 0)}</td>
                    <td style={tdNum}>{fmtNum(b.billedTransfers, 0)}</td>
                    <td style={tdNum}>{fmtMoney(b.cost)}</td>
                    <td style={{ ...tdNum, fontWeight: 700 }}>{b.deals > 0 ? fmtMoney(b.costPerDeal) : '—'}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ ...td, borderTop: `2px solid ${T.ink}`, fontWeight: 800, color: T.ink }}>Total</td>
                  <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 800 }}>{fmtNum(f.rawTransfers, 0)}</td>
                  <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 800, color: T.faint }}>{fmtNum(f.duds, 0)}</td>
                  <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 800 }}>{fmtNum(f.billedTransfers, 0)}</td>
                  <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 800 }}>{fmtMoney(f.totalCost)}</td>
                  <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 800 }}>{fmtMoney(f.costPerClosedDeal)}</td>
                </tr>
              </tbody>
            </table>
            <div style={{ padding: '9px 12px', borderTop: `1px solid ${T.lineSoft}`, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}>
              {[
                ['Dud rate', fmtPct(f.dudRatePct), 'Share of transfers that dropped before the buffer and were never invoiced.'],
                ['Pass rate', fmtPct(f.blendedPassRatePct), 'Share of raw transfers that survived the buffer and were billed.'],
                ['Close — all', fmtPct(f.closeRateOnAllPct), 'Deals ÷ every transfer taken, duds included.'],
                ['Close — billed', fmtPct(f.closeRateOnBilledPct), 'Deals ÷ transfers you were actually invoiced for.'],
              ].map(([k, v, tip]) => (
                <div key={k}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: T.muted, display: 'flex', alignItems: 'center' }}>
                    {k}<Info text={tip} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, fontFamily: T.mono }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'hidden', background: G.tile }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={th}>Bonuses &amp; spiffs<Info text="Daily and monthly incentive programs on top of base commission. Daily thresholds are inferred from monthly volume using the deal-concentration setting, because deals arrive in clumps rather than evenly." /></th>
                  <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {r.bonuses.lines.map((b) => (
                  <tr key={b.id}>
                    <td style={{ ...td, whiteSpace: 'normal', color: b.amount > 0 ? T.body : T.faint }}>
                      {b.label}
                      <div style={{ fontSize: 10, color: T.faint, marginTop: 1 }}>{b.detail}</div>
                    </td>
                    <td style={{ ...tdNum, fontWeight: b.amount > 0 ? 700 : 400, color: b.amount > 0 ? T.ink : T.faint }}>
                      {b.amount > 0 ? fmtMoney(b.amount) : '—'}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td style={{ ...td, borderTop: `2px solid ${T.ink}`, fontWeight: 800, color: T.ink }}>Total accrued</td>
                  <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 800 }}>{fmtMoney(r.bonuses.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Callout>
        <strong>Bonus policy.</strong> All bonus payouts are subject to Funding Tier clawback and chargeback policy.
        Chargeback liability is enforced daily and an open risk period can delay or reverse a payout, so accounting
        should treat these amounts as provisional until the related files have cleared the applicable windows. Set a
        holdback percentage in the bonus panel to model that lag in cash rather than in accrual.
      </Callout>
    </Panel>
  );
}
