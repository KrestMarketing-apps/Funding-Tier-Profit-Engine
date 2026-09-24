'use client';
import React, { useMemo } from 'react';
import type { ModelInputs, ModelResults } from './types';
import { BRANDS } from './config';
import { runModel } from './simulate';
import { buildSurvivalCurve, legacy } from './backends';
import { ELP_SOFTWARE_FEES } from '../legacyEngine';
import {
  Callout, Field, Info, NumberInput, Panel, Row, T, G,
  fmtMoney, fmtMoney2, fmtNum, fmtPct, td, tdNum, th,
} from './ui';

// ─────────────────────────────────────────────────────────────────────────────
// ELP Accelerated — Elite Legal Practice / Legacy Capital Services Exhibit D
// Option 2 (the "Accelerated" or hybrid payout model), head to head with the
// Residual (billable) model and with a settlement deal paying 8% of debt.
//
//   Accelerated : 90% of the payment for months 1-7, 25% for months 8-24,
//                 nothing after. Terms under 24 months are paid residual.
//   Residual    : months 1-2 pass through, then the tier rate on the service
//                 fee, for up to 48 months.
//
// Exhibit D lets Funding Tier elect both models, so the model carries the
// election as a share of ELP files — like the Consumer Shield buyout — and
// re-runs the whole simulation for each option so the cash lines are the real
// business, not a per-deal toy.
// ─────────────────────────────────────────────────────────────────────────────

type Scenario = { key: string; label: string; share: number; results: ModelResults; tail: number };

/**
 * ELP revenue earned by deals signed inside the horizon but remitted after it.
 * The residual keeps paying for up to 48 months; cutting it off at the horizon
 * would flatter the accelerated model.
 */
function elpTail(inputs: ModelInputs, results: ModelResults): number {
  const horizon = results.months.length;
  const debt = inputs.volume.avgDebt.LEGACY;
  const lag = inputs.remittanceLag.LEGACY;
  const term = legacy.getMaxTerm(debt, inputs.legacy);
  const surv = buildSurvivalCurve(inputs.survivalCurves.LEGACY, Math.max(term, 2) + 2);
  let tail = 0;
  results.months.forEach((row) => {
    const deals = row.dealsByBackend.LEGACY ?? 0;
    if (deals <= 0) return;
    for (let dm = 1; dm <= term; dm++) {
      const paidIn = row.month + dm - 1 + lag;
      if (paidIn <= horizon) continue;
      tail += deals * (surv[dm] ?? 0) * legacy.revenueForDealMonth(debt, dm, inputs.legacy);
    }
  });
  return tail;
}

function withShare(inputs: ModelInputs, share: number): ModelInputs {
  return { ...inputs, legacy: { ...inputs.legacy, acceleratedSharePct: share } };
}

const elpRev = (r: ModelResults, upTo?: number) =>
  r.months.slice(0, upTo ?? r.months.length)
    .reduce((s, m) => s + (m.partners.find((p) => p.key === 'LEGACY')?.revenue ?? 0), 0);

function Tile({ label, value, sub, tooltip, tone }: {
  label: string; value: string; sub?: string; tooltip: string; tone?: 'good' | 'bad' | 'brand';
}) {
  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 11, padding: '11px 13px', background: G.tile }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.muted, display: 'flex', alignItems: 'center' }}>
        {label}<Info text={tooltip} />
      </div>
      <div style={{
        fontSize: 19, fontWeight: 800, marginTop: 5, fontFamily: T.mono,
        color: tone === 'bad' ? T.bad : tone === 'good' ? T.good : tone === 'brand' ? BRANDS.LEGACY.accent : T.ink,
      }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: T.faint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/** Cumulative lines on one axis — plain SVG, no chart library. */
function CumulativeChart({ series, horizon, xLabel = 'mo', ariaLabel }: {
  series: { label: string; color: string; values: number[]; dash?: string }[];
  horizon: number; xLabel?: string; ariaLabel: string;
}) {
  const W = 760, H = 220, pl = 64, pr = 12, pt = 12, pb = 26;
  const all = series.flatMap((s) => s.values);
  const max = Math.max(1, ...all);
  const min = Math.min(0, ...all);
  const x = (i: number) => pl + (i / Math.max(1, horizon - 1)) * (W - pl - pr);
  const y = (v: number) => pt + (1 - (v - min) / (max - min || 1)) * (H - pt - pb);
  const ticks = 4;
  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 480, height: 'auto', display: 'block' }} role="img" aria-label={ariaLabel}>
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const v = min + ((max - min) * i) / ticks;
          return (
            <g key={i}>
              <line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} stroke={T.lineSoft} />
              <text x={pl - 6} y={y(v) + 3} fontSize="10" textAnchor="end" fill={T.faint} fontFamily={T.mono}>{fmtMoney(v)}</text>
            </g>
          );
        })}
        {min < 0 && <line x1={pl} x2={W - pr} y1={y(0)} y2={y(0)} stroke={T.muted} strokeDasharray="3 3" />}
        {Array.from({ length: horizon }, (_, i) => i).filter((i) => i === 0 || (i + 1) % 6 === 0).map((i) => (
          <text key={i} x={x(i)} y={H - 8} fontSize="10" textAnchor="middle" fill={T.faint}>{xLabel} {i + 1}</text>
        ))}
        {series.map((s) => (
          <polyline key={s.label} fill="none" stroke={s.color} strokeWidth={2.2} strokeDasharray={s.dash}
            points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
        ))}
      </svg>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: T.body, marginTop: 4 }}>
        {series.map((s) => (
          <span key={s.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 16, height: 0, borderTop: `2.5px ${s.dash ? 'dashed' : 'solid'} ${s.color}` }} />{s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ElpAccelerated({ inputs, patch }: {
  inputs: ModelInputs; patch: (p: Partial<ModelInputs>) => void;
}) {
  const L = inputs.legacy;
  const a = legacy.acceleratedTerms(L);
  const share = L.acceleratedSharePct ?? 0;
  const setLegacy = (p: Partial<typeof L>) => patch({ legacy: { ...L, ...p } });
  const setAccel = (p: Partial<typeof a>) => setLegacy({ accelerated: { ...a, ...p } });

  // ── Scenarios: every ELP file residual, the live mix, every file accelerated.
  const scenarios: Scenario[] = useMemo(() => {
    const make = (key: string, label: string, s: number): Scenario => {
      const i = withShare(inputs, s);
      const r = runModel(i);
      return { key, label, share: s, results: r, tail: elpTail(i, r) };
    };
    const out = [make('res', 'All residual', 0)];
    if (share > 0 && share < 100) out.push(make('mix', `Your mix · ${fmtNum(share, 0)}% accelerated`, share));
    out.push(make('acc', 'All accelerated', 100));
    return out;
  }, [inputs, share]);

  const horizon = scenarios[0].results.months.length;
  const settleRate = inputs.levelDebt.revenueSharePct;
  const debt = inputs.volume.avgDebt.LEGACY;
  const term = legacy.getMaxTerm(debt, L);
  const eligible = legacy.acceleratedEligible(debt, L);
  const base = legacy.acceleratedBase(debt, L);
  const surv = useMemo(() => buildSurvivalCurve(inputs.survivalCurves.LEGACY, 64), [inputs.survivalCurves.LEGACY]);
  const s1 = surv[1] || 1;

  const accFull = legacy.fullTerm(debt, L, 'accelerated');
  const resFull = legacy.fullTerm(debt, L, 'residual');
  const accExp = legacy.expected(debt, L, surv, 'accelerated');
  const resExp = legacy.expected(debt, L, surv, 'residual');
  const acc7 = legacy.cumulativeAt(debt, L, a.frontMonths, 'accelerated');
  const res7 = legacy.cumulativeAt(debt, L, a.frontMonths, 'residual');
  const catchUp = legacy.residualCatchUpMonth(debt, L);
  const reachCatch = catchUp ? ((surv[catchUp] ?? 0) / s1) * 100 : 0;
  const settle = debt * settleRate;
  const commission = legacy.agentCommission(debt, L);
  const pctOf = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);
  const lag = inputs.remittanceLag.LEGACY;

  // Per-deal cumulative curves, month 1..term.
  const perDealMonths = Math.max(term, 1);
  const cum = (model: 'residual' | 'accelerated', weighted: boolean) => {
    let acc = 0;
    return Array.from({ length: perDealMonths }, (_, i) => {
      const m = i + 1;
      const r = model === 'accelerated'
        ? legacy.acceleratedRevenueForDealMonth(debt, m, L)
        : legacy.residualRevenueForDealMonth(debt, m, L);
      acc += (weighted ? (surv[m] ?? 0) / s1 : 1) * r;
      return acc;
    });
  };

  const rows: { label: string; help: string; get: (s: Scenario) => string; better?: 'high' | 'low'; num: (s: Scenario) => number; month?: boolean }[] = [
    { label: 'Total revenue (all partners)', help: `Everything remitted inside the ${horizon}-month horizon.`, num: (s) => s.results.totals.revenue, get: (s) => fmtMoney(s.results.totals.revenue), better: 'high' },
    { label: `${BRANDS.LEGACY.name} revenue`, help: 'ELP revenue remitted inside the horizon.', num: (s) => elpRev(s.results), get: (s) => fmtMoney(elpRev(s.results)), better: 'high' },
    { label: 'ELP revenue by month 6', help: 'How fast ELP cash arrives.', num: (s) => elpRev(s.results, 6), get: (s) => fmtMoney(elpRev(s.results, 6)), better: 'high' },
    { label: 'ELP revenue by month 12', help: 'How fast ELP cash arrives.', num: (s) => elpRev(s.results, 12), get: (s) => fmtMoney(elpRev(s.results, 12)), better: 'high' },
    { label: 'ELP still to collect after horizon', help: 'Expected ELP income already earned by deals signed inside the horizon but remitted after it (survival-weighted). The accelerated model stops at month 24, so its tail is shorter.', num: (s) => s.tail, get: (s) => fmtMoney(s.tail) },
    { label: 'ELP lifetime value of these deals', help: 'Revenue inside the horizon plus the expected tail — the fair profitability comparison.', num: (s) => elpRev(s.results) + s.tail, get: (s) => fmtMoney(elpRev(s.results) + s.tail), better: 'high' },
    { label: `Final cash (mo ${horizon})`, help: 'Cash on hand after every cost, commission, override and bonus.', num: (s) => s.results.totals.finalCash, get: (s) => fmtMoney(s.results.totals.finalCash), better: 'high' },
    { label: 'Peak capital required', help: 'The deepest the cash position goes before revenue catches up.', num: (s) => s.results.totals.peakCapitalRequired, get: (s) => fmtMoney(s.results.totals.peakCapitalRequired), better: 'low' },
    { month: true, label: 'First cash-positive month', help: 'First month cumulative cash crosses zero.', num: (s) => s.results.totals.firstCashPositiveMonth ?? 9999, get: (s) => (s.results.totals.firstCashPositiveMonth ? `Month ${s.results.totals.firstCashPositiveMonth}` : 'Never'), better: 'low' },
    { month: true, label: 'Reserve target first met', help: 'First month cash covers the reserve target.', num: (s) => s.results.totals.reserveTargetFirstMet ?? 9999, get: (s) => (s.results.totals.reserveTargetFirstMet ? `Month ${s.results.totals.reserveTargetFirstMet}` : 'Not met'), better: 'low' },
  ];

  const colors = [BRANDS.LEGACY.accent, '#7c3aed', T.brand];
  const presets = [
    { label: 'All residual', v: 0 }, { label: '25%', v: 25 }, { label: '50%', v: 50 }, { label: '75%', v: 75 }, { label: 'All accelerated', v: 100 },
  ];
  const debtPoints = [6000, 8000, 10000, 15000, 20000, 25000, 30000, 40000, 50000, 75000];

  return (
    <>
      <Panel title="3c · Elite Legal Practice — Accelerated vs Residual payout"
        tooltip="Legacy Capital Services Exhibit D (Payout Model Election) offers two ways to be paid on the same file. Funding Tier elected both, so the model takes the Accelerated model as a share of ELP files.">
        <Callout>
          <strong>How the Accelerated model pays.</strong> {fmtPct(a.frontRate * 100, 0)} of the Active Lead&rsquo;s payment each month for the
          first {a.frontMonths} months, then {fmtPct(a.backRate * 100, 0)} for the following {a.backMonths} months — a {a.frontMonths + a.backMonths}-month
          maximum, nothing after. Leads written under {a.minTerm} months cannot take it and are paid on the Residual model.
          {' '}<strong>The Residual model</strong> passes months 1–2 through less the draft fee, then pays {fmtPct(L.tier1Rate * 100, 0)} ({fmtPct(L.tier2Rate * 100, 0)} at
          {' '}{L.tier2FileThreshold}+ files a month) of the service fee, for up to {legacy.residualMaxMonths} months.
          Both are chargeable back until two full MMPs clear.
        </Callout>

        <div style={{ marginTop: 12, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.muted }}>
          Share of ELP files enrolled under the Accelerated model — drives every other section
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
          {presets.map((p) => (
            <button key={p.v} type="button" onClick={() => setLegacy({ acceleratedSharePct: p.v })}
              style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${share === p.v ? BRANDS.LEGACY.accent : T.line}`,
                background: share === p.v ? BRANDS.LEGACY.accentSoft : '#fff',
                color: share === p.v ? BRANDS.LEGACY.accent : T.body,
              }}>{p.label}</button>
          ))}
          <div style={{ width: 110 }}>
            <NumberInput value={share} min={0} max={100} step={5} suffix="%"
              onChange={(v) => setLegacy({ acceleratedSharePct: Math.min(100, Math.max(0, v)) })} />
          </div>
        </div>

        <Row cols={6} gap={12} style={{ marginTop: 14 }}>
          <Field label="Front rate" tooltip="Share of the payment paid in each of the front months. Exhibit D: 90%.">
            <NumberInput value={a.frontRate * 100} min={0} max={100} step={1} suffix="%" onChange={(v) => setAccel({ frontRate: v / 100 })} />
          </Field>
          <Field label="Front months" tooltip="Months paid at the front rate. Exhibit D: 7.">
            <NumberInput value={a.frontMonths} min={0} max={36} step={1} suffix="mo" onChange={(v) => setAccel({ frontMonths: Math.max(0, Math.round(v)) })} />
          </Field>
          <Field label="Back rate" tooltip="Share of the payment paid after the front months. Exhibit D: 25%.">
            <NumberInput value={a.backRate * 100} min={0} max={100} step={1} suffix="%" onChange={(v) => setAccel({ backRate: v / 100 })} />
          </Field>
          <Field label="Back months" tooltip="Months paid at the back rate. Exhibit D: 17 (24 in total).">
            <NumberInput value={a.backMonths} min={0} max={48} step={1} suffix="mo" onChange={(v) => setAccel({ backMonths: Math.max(0, Math.round(v)) })} />
          </Field>
          <Field label="Minimum term" tooltip="Leads written shorter than this are paid on the Residual model. Exhibit D: 24 months.">
            <NumberInput value={a.minTerm} min={1} max={60} step={1} suffix="mo" onChange={(v) => setAccel({ minTerm: Math.max(1, Math.round(v)) })} />
          </Field>
          <Field label="Paid on" tooltip="Exhibit D's Service Fee is calculated on the payment less the monthly maintenance fee and less processing, draft and software fees — that is 'Net'. Option 2 itself only says 'the Active Lead's payment', so 'Payment − draft fee' keeps maintenance in the base. Use Net until LCS confirms otherwise.">
            <div style={{ display: 'flex', gap: 4 }}>
              {([['net', 'Net'], ['draft', 'Pmt − draft fee']] as const).map(([v, lbl]) => (
                <button key={v} type="button" onClick={() => setAccel({ base: v })}
                  style={{
                    flex: 1, padding: '6px 6px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    border: `1px solid ${a.base === v ? BRANDS.LEGACY.accent : T.line}`,
                    background: a.base === v ? BRANDS.LEGACY.accentSoft : '#fff',
                    color: a.base === v ? BRANDS.LEGACY.accent : T.body,
                  }}>{lbl}</button>
              ))}
            </div>
          </Field>
        </Row>
        {!eligible && (
          <Callout tone="warn">
            The modelled ELP deal is written at <strong>{term} months</strong>, under the {a.minTerm}-month minimum, so it cannot take the
            Accelerated model — every scenario below pays it on the Residual model. Lengthen the target term in Backend Terms, or raise the
            modelled debt in Deal Volume, to see the difference.
          </Callout>
        )}
      </Panel>

      <Panel title={`Per file — your modelled ${fmtMoney(debt)} ELP deal (${fmtPct(L.feeRate * 100, 0)} fee · ${term} months · ${fmtMoney2(legacy.getScheduledPayment(debt, L))}/mo)`}
        tooltip="What one file whose first payment cleared is worth under each model, and as a share of enrolled debt — the same basis a settlement deal pays on.">
        <Row cols="repeat(auto-fit, minmax(170px, 1fr))" gap={10}>
          <Tile label={`Accelerated — first ${a.frontMonths} mo`} tone="brand" value={fmtMoney(acc7)}
            sub={`vs ${fmtMoney(res7)} residual · ${acc7 >= res7 ? '+' : ''}${fmtMoney(acc7 - res7)}`}
            tooltip={eligible
              ? `${fmtPct(a.frontRate * 100, 0)} × ${fmtMoney2(base)} × ${a.frontMonths}. The residual earns ${fmtMoney(res7)} over the same months (2 pass-through months, then ${fmtPct(L.tier1Rate * 100, 0)}).`
              : 'Term under the accelerated minimum — both columns are the residual model.'} />
          <Tile label="Accelerated — expected" value={fmtMoney(accExp)}
            sub={`${fmtPct(pctOf(accExp, debt), 2)} of debt · over ${Math.min(term, a.frontMonths + a.backMonths)} mo`}
            tooltip={`Survival-weighted on the ${BRANDS.LEGACY.name} curve in Risk & Attrition (${fmtPct(inputs.survivalCurves.LEGACY.steadyStateMonthlyCancelPct, 0)} steady-state monthly cancel).`} />
          <Tile label="Residual — expected" value={fmtMoney(resExp)}
            sub={`${fmtPct(pctOf(resExp, debt), 2)} of debt · over ${Math.min(term, legacy.residualMaxMonths)} mo`}
            tooltip="Survival-weighted residual income for the same file." />
          <Tile label="If the file never cancels" value={`${fmtMoney(accFull)} / ${fmtMoney(resFull)}`}
            sub="accelerated / residual · best case"
            tooltip="Every payment for the full term. The ceiling of each model — real files cancel." />
          <Tile label="Residual overtakes after" value={catchUp ? `${catchUp} payments` : eligible ? 'Never' : '—'}
            tone={catchUp && reachCatch < 50 ? 'good' : undefined}
            sub={catchUp ? `${fmtPct(reachCatch, 0)} of first-paid files get there` : eligible ? 'Accelerated always ahead' : 'Not eligible'}
            tooltip="How many payments a residual file must make before its cumulative income passes the accelerated election for good, and what share of first-paid files survive that long on your curve. Under 50% means the accelerated model wins on the typical file." />
          <Tile label={`Settlement at ${fmtPct(settleRate * 100, 0)}`} value={fmtMoney(settle)}
            sub={`Same ${fmtMoney(debt)} as a ${BRANDS.LEVEL.name} deal`}
            tooltip={`${fmtMoney(debt)} × ${fmtPct(settleRate * 100, 0)}, paid once after the first payment clears.`} />
        </Row>
        <Callout tone={accExp >= resExp ? 'good' : 'warn'}>
          {!eligible
            ? <>This file is under the {a.minTerm}-month minimum, so the election makes no difference to it.</>
            : accExp >= resExp
              ? <>On your survival curve the Accelerated model is expected to pay <strong>{fmtMoney(accExp - resExp)} more per file</strong>, and most of it in the first {a.frontMonths} months. Rep commission ({fmtMoney(commission)}) is the same under either model.</>
              : <>On your survival curve the Residual model is expected to pay <strong>{fmtMoney(resExp - accExp)} more per file</strong> — but over up to {Math.min(term, legacy.residualMaxMonths)} months and only while the client keeps paying. The Accelerated model pays {fmtMoney(acc7 - res7)} more in the first {a.frontMonths} months, which is cash you can put back into transfers and payroll. Rep commission ({fmtMoney(commission)}) is the same under either model.</>}
        </Callout>

        <div style={{ marginTop: 14, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.muted }}>
          Cumulative income on one file — by deal month
        </div>
        <CumulativeChart horizon={perDealMonths} xLabel="pmt" ariaLabel="Cumulative income per ELP file by payout model"
          series={[
            { label: 'Accelerated — never cancels', color: BRANDS.LEGACY.accent, values: cum('accelerated', false) },
            { label: 'Residual — never cancels', color: '#7c3aed', values: cum('residual', false), dash: '5 4' },
            { label: 'Accelerated — expected', color: BRANDS.LEGACY.accent, values: cum('accelerated', true), dash: '2 3' },
            { label: 'Residual — expected', color: '#7c3aed', values: cum('residual', true), dash: '2 3' },
          ]} />
      </Panel>

      <Panel title={`The business under each option — full ${horizon}-month simulation`}
        tooltip="The whole model re-run with every ELP file residual, your current mix, and every ELP file accelerated. Staffing, costs, commission and the other partners are identical — only the ELP payout changes.">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left' }}>Measure</th>
                {scenarios.map((s) => <th key={s.key} style={{ ...th, textAlign: 'right' }}>{s.label}</th>)}
                <th style={{ ...th, textAlign: 'right' }}>Accelerated vs residual</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const vals = scenarios.map(r.num);
                const bestIdx = r.better ? vals.indexOf(r.better === 'high' ? Math.max(...vals) : Math.min(...vals)) : -1;
                const resV = r.num(scenarios[0]);
                const accV = r.num(scenarios[scenarios.length - 1]);
                const diff = accV - resV;
                return (
                  <tr key={r.label}>
                    <td style={{ ...td, whiteSpace: 'normal' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>{r.label}<Info text={r.help} /></span>
                    </td>
                    {scenarios.map((s, i) => (
                      <td key={s.key} style={{ ...tdNum, fontWeight: i === bestIdx ? 800 : 500, color: i === bestIdx ? T.good : T.body }}>{r.get(s)}</td>
                    ))}
                    <td style={{ ...tdNum, color: diff === 0 ? T.faint : T.ink }}>
                      {r.month
                        ? (resV >= 9999 || accV >= 9999 ? '—' : diff === 0 ? 'same' : `${diff > 0 ? '+' : ''}${diff} mo`)
                        : `${diff > 0 ? '+' : ''}${fmtMoney(diff)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 16, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.muted }}>
          Cumulative cash position
        </div>
        <CumulativeChart horizon={horizon} ariaLabel="Cumulative cash by ELP payout model"
          series={scenarios.map((s, i) => ({
            label: s.label, color: colors[i % colors.length], dash: s.key === 'res' ? '5 4' : undefined,
            values: s.results.months.map((m) => m.cashPosition),
          }))} />

        <div style={{ marginTop: 16, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.muted }}>
          Cumulative {BRANDS.LEGACY.name} revenue
        </div>
        <CumulativeChart horizon={horizon} ariaLabel="Cumulative ELP revenue by payout model"
          series={scenarios.map((s, i) => {
            let acc = 0;
            return {
              label: s.label, color: colors[i % colors.length], dash: s.key === 'res' ? '5 4' : undefined,
              values: s.results.months.map((m) => (acc += m.partners.find((p) => p.key === 'LEGACY')?.revenue ?? 0)),
            };
          })} />
      </Panel>

      <Panel title="Across the debt range — which model to elect"
        tooltip={`Per file whose first payment cleared, at your ${fmtPct(L.feeRate * 100, 0)} fee rate, ${L.targetTerm}-month target term and ${fmtMoney(L.maintenanceFee)} maintenance. Terms are clamped by the $250 draft floor, so small files get short terms and may fall under the accelerated minimum.`}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
            <thead>
              <tr>
                {['Enrolled debt', 'Term', 'Draft', `Accel. first ${a.frontMonths} mo`, `Residual first ${a.frontMonths} mo`, 'Accel. expected', 'Residual expected', 'Accel. full', 'Residual full', 'Residual overtakes', `Settlement ${fmtPct(settleRate * 100, 0)}`, 'Better expected'].map((h, i) => (
                  <th key={h} style={{ ...th, textAlign: i < 1 ? 'left' : 'right', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {debtPoints.map((d) => {
                const tm = legacy.getMaxTerm(d, L);
                const el = legacy.acceleratedEligible(d, L);
                const ae = legacy.expected(d, L, surv, 'accelerated');
                const re = legacy.expected(d, L, surv, 'residual');
                const cu = legacy.residualCatchUpMonth(d, L);
                const live = Math.abs(d - debt) < 1;
                return (
                  <tr key={d} style={{ background: live ? BRANDS.LEGACY.accentSoft : undefined }}>
                    <td style={{ ...td, fontWeight: 800 }}>{fmtMoney(d)}{live ? ' ◂' : ''}</td>
                    <td style={tdNum}>{tm} mo{!el ? ' *' : ''}</td>
                    <td style={tdNum}>{fmtMoney2(legacy.getScheduledPayment(d, L))}</td>
                    <td style={{ ...tdNum, fontWeight: 700, color: BRANDS.LEGACY.accent }}>{fmtMoney(legacy.cumulativeAt(d, L, a.frontMonths, 'accelerated'))}</td>
                    <td style={tdNum}>{fmtMoney(legacy.cumulativeAt(d, L, a.frontMonths, 'residual'))}</td>
                    <td style={tdNum}>{fmtMoney(ae)}</td>
                    <td style={tdNum}>{fmtMoney(re)}</td>
                    <td style={{ ...tdNum, color: T.faint }}>{fmtMoney(legacy.fullTerm(d, L, 'accelerated'))}</td>
                    <td style={{ ...tdNum, color: T.faint }}>{fmtMoney(legacy.fullTerm(d, L, 'residual'))}</td>
                    <td style={tdNum}>{!el ? '—' : cu ? `${cu} pmts` : 'never'}</td>
                    <td style={tdNum}>{fmtMoney(d * settleRate)}</td>
                    <td style={{ ...tdNum, fontWeight: 800, color: !el ? T.faint : ae >= re ? BRANDS.LEGACY.accent : '#7c3aed' }}>
                      {!el ? 'Residual only' : ae >= re ? 'Accelerated' : 'Residual'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Callout>
          <strong>Reading the table.</strong> * = the term the $250 draft floor allows is under {a.minTerm} months, so the file can only be paid
          residual. &ldquo;Expected&rdquo; weights every payment by the share of first-paid ELP files still paying that month on your survival curve —
          tighten or loosen it in Risk &amp; Attrition and the recommendation moves. Rep commission is the same flat band under either model.
        </Callout>
        <Callout tone="warn">
          <strong>Open points in Exhibit D to confirm with Legacy Capital Services:</strong> (1) Option 2 says &ldquo;the Active Lead&rsquo;s payment&rdquo;
          while the Service Fee definition deducts maintenance and fees first — the <em>Paid on</em> switch above shows both readings.
          (2) The Option 1 narrative says Tier 1 is 55% while the tier table says 60%; the model uses 60%. (3) Software fees — credit pulls
          at {fmtMoney2(ELP_SOFTWARE_FEES.creditPull)} and seats at $25/$50/$100 per user — are deducted from Service Fees; they are charged in the
          Cost Stack under either model. (4) Seat fees name &ldquo;over 50&rdquo; and &ldquo;1 to 49&rdquo; files, leaving exactly 50 unpriced; the model
          charges $50 at 50. Remittance lag is {lag} month{lag === 1 ? '' : 's'} under both models.
        </Callout>
      </Panel>
    </>
  );
}
