'use client';
import React, { useMemo } from 'react';
import type { ModelInputs, ModelResults } from './types';
import { BRANDS } from './config';
import { runModel } from './simulate';
import { buildSurvivalCurve, shield } from './backends';
import {
  Callout, Field, Info, NumberInput, Panel, Row, T, G,
  fmtMoney, fmtNum, fmtPct, td, tdNum, th,
} from './ui';

// ─────────────────────────────────────────────────────────────────────────────
// Shield Buyout — the Consumer Shield Enrollment File Buyout, head to head with
// the monthly perpetuity and with a debt settlement deal paying 8% of enrolled
// debt.
//
// The buyout is an election made file by file (buyout files go through their
// own Consumer Shield login), so the model carries it as a share of Shield files
// rather than a switch. Everything here re-runs the full simulation — staffing,
// costs, commission, reserve — so the cash lines are the real business, not a
// per-deal toy.
// ─────────────────────────────────────────────────────────────────────────────

type Scenario = { key: string; label: string; share: number; results: ModelResults; tail: number };

/**
 * Shield revenue already earned by deals signed inside the horizon but still to
 * be remitted after it. A perpetuity keeps paying past month N; cutting it off
 * at the horizon would flatter the buyout.
 */
function shieldTail(inputs: ModelInputs, results: ModelResults): number {
  const horizon = results.months.length;
  const debt = inputs.volume.avgDebt.CS;
  const lag = inputs.remittanceLag.CS;
  const term = shield.getProgram(debt, inputs.consumerShield)?.term ?? 0;
  const surv = buildSurvivalCurve(inputs.survivalCurves.CS, Math.max(term, 2) + 2);
  let tail = 0;
  results.months.forEach((row) => {
    const deals = row.dealsByBackend.CS ?? 0;
    if (deals <= 0) return;
    for (let dm = 1; dm <= term; dm++) {
      const paidIn = row.month + dm - 1 + lag;
      if (paidIn <= horizon) continue;
      tail += deals * (surv[dm] ?? 0) * shield.revenueForDealMonth(debt, dm, inputs.consumerShield);
    }
  });
  return tail;
}

function withShare(inputs: ModelInputs, share: number): ModelInputs {
  return { ...inputs, consumerShield: { ...inputs.consumerShield, buyoutSharePct: share } };
}

const shieldRev = (r: ModelResults, upTo?: number) =>
  r.months.slice(0, upTo ?? r.months.length)
    .reduce((s, m) => s + (m.partners.find((p) => p.key === 'CS')?.revenue ?? 0), 0);

function Tile({ label, value, sub, tooltip, tone }: {
  label: string; value: string; sub?: string; tooltip: string; tone?: 'good' | 'bad' | 'brand';
}) {
  return (
    <div style={{
      border: `1px solid ${T.line}`, borderRadius: 11, padding: '11px 13px', background: G.tile,
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.muted, display: 'flex', alignItems: 'center' }}>
        {label}<Info text={tooltip} />
      </div>
      <div style={{
        fontSize: 19, fontWeight: 800, marginTop: 5, fontFamily: T.mono,
        color: tone === 'bad' ? T.bad : tone === 'good' ? T.good : tone === 'brand' ? BRANDS.CS.accent : T.ink,
      }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: T.faint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/** Two cumulative lines on one axis — plain SVG, no chart library. */
function CumulativeChart({ series, horizon }: {
  series: { label: string; color: string; values: number[]; dash?: string }[]; horizon: number;
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
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 480, height: 'auto', display: 'block' }} role="img"
        aria-label="Cumulative cash by payout option">
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
          <text key={i} x={x(i)} y={H - 8} fontSize="10" textAnchor="middle" fill={T.faint}>mo {i + 1}</text>
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

export function ShieldBuyout({ inputs, patch }: {
  inputs: ModelInputs; patch: (p: Partial<ModelInputs>) => void;
}) {
  const t = inputs.consumerShield;
  const share = t.buyoutSharePct ?? 0;
  const setShield = (p: Partial<typeof t>) => patch({ consumerShield: { ...t, ...p } });
  const setBuyout = (p: Partial<typeof t.buyout>) => setShield({ buyout: { ...t.buyout, ...p } });

  // ── Scenarios: every Shield file perpetual, the live mix, every file bought out.
  const scenarios: Scenario[] = useMemo(() => {
    const make = (key: string, label: string, s: number): Scenario => {
      const i = withShare(inputs, s);
      const r = runModel(i);
      return { key, label, share: s, results: r, tail: shieldTail(i, r) };
    };
    const out = [make('perp', 'All perpetual', 0)];
    if (share > 0 && share < 100) out.push(make('mix', `Your mix · ${fmtNum(share, 0)}% buyout`, share));
    out.push(make('buy', 'All buyout', 100));
    return out;
  }, [inputs, share]);

  const horizon = scenarios[0].results.months.length;
  const settleRate = inputs.levelDebt.revenueSharePct;
  const debt = inputs.volume.avgDebt.CS;
  const program = shield.getProgram(debt, t);
  const surv = useMemo(() => buildSurvivalCurve(inputs.survivalCurves.CS, 40), [inputs.survivalCurves.CS]);
  const buyout = shield.buyoutPayout(debt, t);
  const perpExp = shield.perpetualExpected(debt, t, surv);
  const perpFull = shield.perpetualFullTerm(debt, t);
  const settle = debt * settleRate;
  const commission = program?.commission ?? 0;
  const pctOf = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);
  const be = shield.breakEvenPayments(debt, t);
  const s1 = surv[1] || 1;
  const reachBe = be ? (surv[be] ?? 0) / s1 * 100 : 0;

  const rows: { label: string; help: string; get: (s: Scenario) => string; better?: 'high' | 'low'; num: (s: Scenario) => number; month?: boolean }[] = [
    { label: 'Total revenue (all partners)', help: `Everything remitted inside the ${horizon}-month horizon.`, num: (s) => s.results.totals.revenue, get: (s) => fmtMoney(s.results.totals.revenue), better: 'high' },
    { label: `${BRANDS.CS.name} revenue`, help: 'Shield revenue remitted inside the horizon.', num: (s) => shieldRev(s.results), get: (s) => fmtMoney(shieldRev(s.results)), better: 'high' },
    { label: 'Shield revenue by month 6', help: 'How fast Shield cash arrives.', num: (s) => shieldRev(s.results, 6), get: (s) => fmtMoney(shieldRev(s.results, 6)), better: 'high' },
    { label: 'Shield revenue by month 12', help: 'How fast Shield cash arrives.', num: (s) => shieldRev(s.results, 12), get: (s) => fmtMoney(shieldRev(s.results, 12)), better: 'high' },
    { label: 'Shield still to collect after horizon', help: 'Expected perpetuity income already earned by deals signed inside the horizon but remitted after it (survival-weighted). A bought-out file has none — it was paid up front.', num: (s) => s.tail, get: (s) => fmtMoney(s.tail) },
    { label: 'Shield lifetime value of these deals', help: 'Revenue inside the horizon plus the expected tail. This is the fair profitability comparison — it does not cut the perpetuity off at the horizon.', num: (s) => shieldRev(s.results) + s.tail, get: (s) => fmtMoney(shieldRev(s.results) + s.tail), better: 'high' },
    { label: `Final cash (mo ${horizon})`, help: 'Cash on hand after every cost, commission, override and bonus.', num: (s) => s.results.totals.finalCash, get: (s) => fmtMoney(s.results.totals.finalCash), better: 'high' },
    { label: 'Peak capital required', help: 'The deepest the cash position goes before revenue catches up.', num: (s) => s.results.totals.peakCapitalRequired, get: (s) => fmtMoney(s.results.totals.peakCapitalRequired), better: 'low' },
    { month: true, label: 'First cash-positive month', help: 'First month cumulative cash crosses zero.', num: (s) => s.results.totals.firstCashPositiveMonth ?? 9999, get: (s) => (s.results.totals.firstCashPositiveMonth ? `Month ${s.results.totals.firstCashPositiveMonth}` : 'Never'), better: 'low' },
    { month: true, label: 'Reserve target first met', help: 'First month cash covers the reserve target.', num: (s) => s.results.totals.reserveTargetFirstMet ?? 9999, get: (s) => (s.results.totals.reserveTargetFirstMet ? `Month ${s.results.totals.reserveTargetFirstMet}` : 'Not met'), better: 'low' },
  ];

  const colors = [BRANDS.CS.accent, '#7c3aed', T.brand];

  const presets: { label: string; v: number }[] = [
    { label: 'All perpetual', v: 0 }, { label: '25%', v: 25 }, { label: '50%', v: 50 }, { label: '75%', v: 75 }, { label: 'All buyout', v: 100 },
  ];

  return (
    <>
      <Panel title="3b · Consumer Shield Enrollment File Buyout"
        tooltip="Consumer Shield will buy a file out with one advance fee once its first month's payment (or both halves of a split first month) has fully cleared. The buyout replaces every perpetuity payment on that file.">
        <Callout>
          <strong>How the buyout pays.</strong> After the first month&rsquo;s payment (or 2 split payments) fully clears, Consumer Shield buys the file
          with one advance: <strong>standard deals</strong> (payment − ${t.servicingDeductionPerPayment}) × {fmtPct(t.buyout.standardRate * 100, 0)} × {t.buyout.months};
          {' '}<strong>{fmtMoney(t.buyout.highDebtMinDebt)}+ deals</strong> (payment − ${t.servicingDeductionPerPayment}) × {fmtPct(t.buyout.highDebtRate * 100, 0)} × {t.buyout.months}.
          It is an election made file by file — buyout files are submitted through their own Consumer Shield login — so the model takes it as a share of Shield files.
        </Callout>

        <div style={{ marginTop: 12, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.muted }}>
          Share of Shield files sold through the buyout — drives every other section
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
          {presets.map((p) => (
            <button key={p.v} type="button" onClick={() => setShield({ buyoutSharePct: p.v })}
              style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${share === p.v ? BRANDS.CS.accent : T.line}`,
                background: share === p.v ? BRANDS.CS.accentSoft : '#fff',
                color: share === p.v ? BRANDS.CS.accent : T.body,
              }}>{p.label}</button>
          ))}
          <div style={{ width: 110 }}>
            <NumberInput value={share} min={0} max={100} step={5} suffix="%"
              onChange={(v) => setShield({ buyoutSharePct: Math.min(100, Math.max(0, v)) })} />
          </div>
        </div>

        <Row cols={5} gap={12} style={{ marginTop: 14 }}>
          <Field label="Standard buyout rate" tooltip="Share of (payment − servicing deduction) paid per month of the buyout on deals under the high-debt threshold. Contract: 65%.">
            <NumberInput value={t.buyout.standardRate * 100} min={0} max={100} step={1} suffix="%" onChange={(v) => setBuyout({ standardRate: v / 100 })} />
          </Field>
          <Field label="High-debt buyout rate" tooltip="Rate on deals at or above the high-debt threshold. Contract: 100%.">
            <NumberInput value={t.buyout.highDebtRate * 100} min={0} max={100} step={1} suffix="%" onChange={(v) => setBuyout({ highDebtRate: v / 100 })} />
          </Field>
          <Field label="High-debt threshold" tooltip="Enrolled debt at or above which the high-debt rate applies. Contract: $20,000.">
            <NumberInput value={t.buyout.highDebtMinDebt} min={0} step={1000} prefix="$" onChange={(v) => setBuyout({ highDebtMinDebt: v })} />
          </Field>
          <Field label="Months bought out" tooltip="Months of net payment the advance is sized on. Contract: 6.">
            <NumberInput value={t.buyout.months} min={1} max={36} step={1} suffix="mo" onChange={(v) => setBuyout({ months: Math.max(1, Math.round(v)) })} />
          </Field>
          <Field label="Paid after" tooltip="The buyout is triggered once this deal-month's payment has fully cleared, and remitted with the usual Consumer Shield remittance lag.">
            <div style={{ padding: '7px 9px', border: `1px solid ${T.line}`, borderRadius: 7, background: T.panel, fontWeight: 700, fontSize: 12.5 }}>
              Payment {t.buyout.triggerDealMonth} clears · cash mo {t.buyout.triggerDealMonth + inputs.remittanceLag.CS}
            </div>
          </Field>
        </Row>
      </Panel>

      <Panel title={`Per file — your modelled ${fmtMoney(debt)} Shield deal (program ${program?.code ?? '—'} · ${fmtMoney(program?.payment ?? 0)}/mo)`}
        tooltip="What one file whose first payment cleared is worth under each option, and as a share of enrolled debt — the same basis a settlement deal pays on. Change the modelled debt in Deal Volume.">
        <Row cols="repeat(auto-fit, minmax(170px, 1fr))" gap={10}>
          <Tile label="Buyout advance" tone="brand" value={fmtMoney(buyout)}
            sub={`${fmtPct(pctOf(buyout, debt), 2)} of debt · paid mo ${t.buyout.triggerDealMonth + inputs.remittanceLag.CS}`}
            tooltip={`(${fmtMoney(program?.payment ?? 0)} − ${fmtMoney(t.servicingDeductionPerPayment)}) × ${fmtPct(shield.buyoutRate(debt, t) * 100, 0)} × ${t.buyout.months}. One payment, no further collection risk on the file.`} />
          <Tile label="Perpetual — expected" value={fmtMoney(perpExp)}
            sub={`${fmtPct(pctOf(perpExp, debt), 2)} of debt · over ${program?.term ?? '—'} mo`}
            tooltip={`Survival-weighted: every perpetuity payment × the share of first-paid files still paying that month, from the ${BRANDS.CS.name} survival curve in Risk & Attrition (${fmtPct(inputs.survivalCurves.CS.steadyStateMonthlyCancelPct, 0)} steady-state monthly cancel).`} />
          <Tile label="Perpetual — if never cancels" value={fmtMoney(perpFull)}
            sub={`${fmtPct(pctOf(perpFull, debt), 2)} of debt · best case`}
            tooltip="Every payment for the full program term. The ceiling of the perpetuity — real files cancel." />
          <Tile label={`Settlement at ${fmtPct(settleRate * 100, 0)}`} value={fmtMoney(settle)}
            sub={`Same ${fmtMoney(debt)} as a ${BRANDS.LEVEL.name} deal`}
            tooltip={`${fmtMoney(debt)} × ${fmtPct(settleRate * 100, 0)}, paid once after the first payment clears — the ${BRANDS.LEVEL.name} term.`} />
          <Tile label="Break-even for perpetual" value={be ? `${be} payments` : 'Never'}
            tone={be && reachBe < 50 ? 'good' : undefined}
            sub={be ? `${fmtPct(reachBe, 0)} of first-paid files get there` : 'Perpetuity never reaches the buyout'}
            tooltip="How many payments a perpetuity file must make before it out-earns the buyout, and what share of first-paid files survive that long on your curve. Under 50% means the buyout wins on the typical file." />
          <Tile label="Buyout net of rep pay" value={fmtMoney(buyout - commission)}
            sub={`${fmtMoney(commission)} flat Shield commission`}
            tooltip="Rep commission is unchanged by the payout option — the same flat band commission is paid either way." />
        </Row>
        <Callout tone={buyout >= perpExp ? 'good' : 'warn'}>
          {buyout >= perpExp
            ? <>On your survival curve the buyout pays <strong>{fmtMoney(buyout - perpExp)} more per file</strong> than the expected perpetuity, and pays it up front. It earns {fmtPct(pctOf(buyout, debt), 2)} of enrolled debt against {fmtPct(settleRate * 100, 0)} on a settlement deal.</>
            : <>On your survival curve the perpetuity is expected to pay <strong>{fmtMoney(perpExp - buyout)} more per file</strong> than the buyout — but over {program?.term} months and only if the file keeps paying. The buyout is {fmtPct(pctOf(buyout, debt), 2)} of enrolled debt against {fmtPct(settleRate * 100, 0)} on a settlement deal.</>}
        </Callout>
      </Panel>

      <Panel title={`The business under each option — full ${horizon}-month simulation`}
        tooltip="The whole model re-run with every Shield file perpetual, your current mix, and every Shield file bought out. Staffing, costs, commission and the other partners are identical — only the Shield payout changes.">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left' }}>Measure</th>
                {scenarios.map((s) => <th key={s.key} style={{ ...th, textAlign: 'right' }}>{s.label}</th>)}
                <th style={{ ...th, textAlign: 'right' }}>Buyout vs perpetual</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const vals = scenarios.map(r.num);
                const bestIdx = r.better ? vals.indexOf(r.better === 'high' ? Math.max(...vals) : Math.min(...vals)) : -1;
                const perpV = r.num(scenarios[0]);
                const buyV = r.num(scenarios[scenarios.length - 1]);
                const isMonth = !!r.month;
                const diff = buyV - perpV;
                return (
                  <tr key={r.label}>
                    <td style={{ ...td, whiteSpace: 'normal' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>{r.label}<Info text={r.help} /></span>
                    </td>
                    {scenarios.map((s, i) => (
                      <td key={s.key} style={{ ...tdNum, fontWeight: i === bestIdx ? 800 : 500, color: i === bestIdx ? T.good : T.body }}>{r.get(s)}</td>
                    ))}
                    <td style={{ ...tdNum, color: diff === 0 ? T.faint : T.ink }}>
                      {isMonth
                        ? (perpV >= 9999 || buyV >= 9999 ? '—' : diff === 0 ? 'same' : `${diff > 0 ? '+' : ''}${diff} mo`)
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
        <CumulativeChart horizon={horizon}
          series={scenarios.map((s, i) => ({
            label: s.label, color: colors[i % colors.length], dash: s.key === 'perp' ? '5 4' : undefined,
            values: s.results.months.map((m) => m.cashPosition),
          }))} />

        <div style={{ marginTop: 16, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.muted }}>
          Cumulative {BRANDS.CS.name} revenue
        </div>
        <CumulativeChart horizon={horizon}
          series={scenarios.map((s, i) => {
            let acc = 0;
            return {
              label: s.label, color: colors[i % colors.length], dash: s.key === 'perp' ? '5 4' : undefined,
              values: s.results.months.map((m) => (acc += m.partners.find((p) => p.key === 'CS')?.revenue ?? 0)),
            };
          })} />
      </Panel>

      <Panel title={`Every program band — buyout vs perpetual vs ${fmtPct(settleRate * 100, 0)} settlement`}
        tooltip="Per file whose first payment cleared. % of debt is shown across the band's debt range, because the payment is flat inside a band while the debt is not.">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
            <thead>
              <tr>
                {['Band', 'Enrolled debt', 'Payment', 'Buyout', 'Buyout $', 'Buyout % of debt', 'Perpetual expected', 'Perp. % of debt', 'Perpetual full term', `Settlement ${fmtPct(settleRate * 100, 0)}`, 'Break-even', 'Rep pay'].map((h, i) => (
                  <th key={h} style={{ ...th, textAlign: i < 2 ? 'left' : 'right', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.programs.map((p) => {
                const lo = p.min;
                const hi = Number.isFinite(p.max) ? p.max : null;
                const b = shield.buyoutPayout(lo, t);
                const rate = shield.buyoutRate(lo, t);
                const pe = shield.perpetualExpected(lo, t, surv);
                const pf = shield.perpetualFullTerm(lo, t);
                const bk = shield.breakEvenPayments(lo, t);
                const range = (n: number) => hi
                  ? `${fmtPct(pctOf(n, hi), 1)}–${fmtPct(pctOf(n, lo), 1)}`
                  : `≤ ${fmtPct(pctOf(n, lo), 1)}`;
                const live = program?.code === p.code;
                return (
                  <tr key={p.code} style={{ background: live ? BRANDS.CS.accentSoft : undefined }}>
                    <td style={{ ...td, fontWeight: 800 }}>{p.code}{live ? ' ◂' : ''}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtMoney(lo)}{hi ? `–${fmtMoney(Math.ceil(hi))}` : '+'}</td>
                    <td style={tdNum}>{fmtMoney(p.payment)} × {p.term}</td>
                    <td style={tdNum}>{fmtPct(rate * 100, 0)} × {t.buyout.months}</td>
                    <td style={{ ...tdNum, fontWeight: 800, color: BRANDS.CS.accent }}>{fmtMoney(b)}</td>
                    <td style={tdNum}>{range(b)}</td>
                    <td style={tdNum}>{fmtMoney(pe)}</td>
                    <td style={tdNum}>{range(pe)}</td>
                    <td style={{ ...tdNum, color: T.faint }}>{fmtMoney(pf)}</td>
                    <td style={tdNum}>{fmtMoney(lo * settleRate)}{hi ? `–${fmtMoney(hi * settleRate)}` : '+'}</td>
                    <td style={tdNum}>{bk ? `${bk} pmts` : 'never'}</td>
                    <td style={tdNum}>{fmtMoney(p.commission)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Callout>
          <strong>Reading the table.</strong> A settlement deal pays a flat {fmtPct(settleRate * 100, 0)} of enrolled debt. The buyout pays a flat dollar
          amount per band, so its % of debt is highest at the bottom of each band and lowest at the top. The $20k+ bands jump because the buyout rate
          steps from {fmtPct(t.buyout.standardRate * 100, 0)} to {fmtPct(t.buyout.highDebtRate * 100, 0)}. &ldquo;Perpetual expected&rdquo; uses your
          {' '}{BRANDS.CS.name} survival curve — tighten or loosen it in Risk &amp; Attrition and this column moves. Break-even is how many payments a
          perpetuity file must make before it out-earns the buyout.
        </Callout>
        <Callout tone="warn">
          <strong>Not in the payout schedule:</strong> whether Consumer Shield claws back any of the advance if a bought-out client cancels or disputes.
          The model treats the advance as earned once the first payment clears. Confirm the clawback terms before routing volume on the buyout.
        </Callout>
      </Panel>
    </>
  );
}
