'use client';
import React, { useMemo, useState } from 'react';
import type { BackendKey, ModelInputs } from './types';
import { BRANDS } from './config';
import { buildSurvivalCurve, legacy, shield } from './backends';
import { Info, PartnerMark, T, fmtMoney, fmtPct, td, tdNum, th } from './ui';

// ─────────────────────────────────────────────────────────────────────────────
// Backend Terms, explained — kept deliberately small.
//
// Three questions only, for the same enrolled debt at every partner:
//   1. How much does Funding Tier earn, and in what shape (once vs monthly)?
//   2. When does the money land, and when are we clear of liability?
//   3. How long does a monthly perpetuity take to earn what a one-time payout
//      (Level Debt settlement, Shield file buyout) pays up front?
// Every number comes from the engine in backends.ts, so this can never
// disagree with the simulation.
// ─────────────────────────────────────────────────────────────────────────────

type ColId = 'LEVEL' | 'CSBUY' | 'CS' | 'LEGACY';
const COLS: ColId[] = ['LEVEL', 'CSBUY', 'CS', 'LEGACY'];
const brandOf = (id: ColId): BackendKey => (id === 'CSBUY' ? 'CS' : id);

interface Deal {
  id: ColId;
  name: string;
  option: string;
  oneTime: boolean;
  eligible: boolean;
  minDebt: number;
  howPaid: string;
  /** Funding Tier revenue landing in each cash month (index = month, 1-based). */
  cash: number[];
  total: number;
  firstCash: number;
  lastCash: number;
  clear: string;
  /** Share of clients still paying in each deal-month, of those who made payment 1. */
  stillPaying: number[];
}

function buildDeal(id: ColId, inputs: ModelInputs, debt: number): Deal {
  const key = brandOf(id);
  const lag = inputs.remittanceLag[key];
  const cash: number[] = [];
  const add = (dealMonth: number, v: number) => {
    const m = dealMonth + lag;
    cash[m] = (cash[m] ?? 0) + v;
  };
  const surv = (term: number) => {
    const s = buildSurvivalCurve(inputs.survivalCurves[key], Math.max(term, 2) + 2);
    return s.map((v) => (s[1] > 0 ? v / s[1] : 0));
  };

  if (id === 'LEVEL') {
    const t = inputs.levelDebt;
    const pay = debt * t.revenueSharePct;
    add(t.revenueRecognizedMonth, pay);
    return {
      id, name: BRANDS.LEVEL.name, option: 'Settlement', oneTime: true,
      eligible: debt >= t.minDebt, minDebt: t.minDebt,
      howPaid: `One payment: ${fmtPct(t.revenueSharePct * 100, 0)} of enrolled debt, after the client’s first payment clears`,
      cash, total: pay, firstCash: t.revenueRecognizedMonth + lag, lastCash: t.revenueRecognizedMonth + lag,
      clear: `Month ${t.chargebackClearMonths} — once payment ${t.chargebackClearMonths} clears, the fee can no longer be charged back`,
      stillPaying: surv(t.revenueRecognizedMonth),
    };
  }

  if (id === 'CSBUY') {
    const t = inputs.consumerShield;
    const p = shield.getProgram(debt, t);
    const pay = shield.buyoutPayout(debt, t);
    const rate = shield.buyoutRate(debt, t);
    add(t.buyout.triggerDealMonth, pay);
    return {
      id, name: BRANDS.CS.name, option: 'File buyout', oneTime: true,
      eligible: !!p && debt >= t.minDebt, minDebt: t.minDebt,
      howPaid: p
        ? `One payment: (${fmtMoney(p.payment)} − ${fmtMoney(t.servicingDeductionPerPayment)}) × ${fmtPct(rate * 100, 0)} × ${t.buyout.months} months, after the first payment clears`
        : '—',
      cash, total: pay, firstCash: t.buyout.triggerDealMonth + lag, lastCash: t.buyout.triggerDealMonth + lag,
      clear: 'Not yet confirmed — the buyout’s clawback terms still need to be checked with Consumer Shield',
      stillPaying: surv(1),
    };
  }

  if (id === 'CS') {
    const t = inputs.consumerShield;
    const p = shield.getProgram(debt, t);
    const term = p?.term ?? 0;
    for (let m = 1; m <= term; m++) add(m, shield.perpetualRevenueForDealMonth(debt, m, t));
    const net = (p?.payment ?? 0) - t.servicingDeductionPerPayment;
    return {
      id, name: BRANDS.CS.name, option: 'Perpetuity', oneTime: false,
      eligible: !!p && debt >= t.minDebt, minDebt: t.minDebt,
      howPaid: p
        ? `Monthly for ${term} months: ${fmtMoney(net * t.frontCaptureRate)} a month for months 1–${t.frontMonths}, then ${fmtMoney(net * t.backendCaptureRate)} (program ${p.code}, ${fmtMoney(p.payment)}/mo)`
        : '—',
      cash, total: shield.perpetualFullTerm(debt, t), firstCash: 1 + lag, lastCash: term + lag,
      clear: 'From the first payment — each monthly share is final once paid; a cancellation only stops future months',
      stillPaying: surv(term),
    };
  }

  const L = inputs.legacy;
  const ok = debt >= L.minDebt;
  const term = ok ? legacy.getMaxTerm(debt, L) : 0;
  for (let m = 1; m <= term; m++) add(m, legacy.revenueForDealMonth(debt, m, L));
  const early = legacy.revenueForDealMonth(debt, 1, L);
  const late = legacy.revenueForDealMonth(debt, 3, L);
  return {
    id, name: BRANDS.LEGACY.name, option: 'Perpetuity', oneTime: false,
    eligible: ok, minDebt: L.minDebt,
    howPaid: `Monthly for ${term} months: ${fmtMoney(early)} a month for months 1–2, then ${fmtMoney(late)} (${fmtPct(L.feeRate * 100, 0)} fee on the debt, spread over the term)`,
    cash, total: cash.reduce((a, v) => a + (v ?? 0), 0), firstCash: 1 + lag, lastCash: term + lag,
    clear: 'From the first payment — each monthly share is final once paid; a cancellation only stops future months',
    stillPaying: surv(term),
  };
}

const cumulative = (cash: number[], upTo: number) => {
  const out: number[] = [0];
  for (let m = 1; m <= upTo; m++) out[m] = out[m - 1] + (cash[m] ?? 0);
  return out;
};

/** First cash month in which a perpetuity's running total reaches a target. */
function catchUp(d: Deal, target: number): number | null {
  const cum = cumulative(d.cash, d.lastCash);
  for (let m = 1; m <= d.lastCash; m++) if (cum[m] >= target - 0.005) return m;
  return null;
}

const colColor = (id: ColId) => BRANDS[brandOf(id)].accent;

function CatchUpChart({ deals }: { deals: Deal[] }) {
  const perps = deals.filter((d) => !d.oneTime && d.eligible);
  const lumps = deals.filter((d) => d.oneTime && d.eligible);
  const crosses = perps.flatMap((p) => lumps.map((l) => catchUp(p, l.total) ?? 0));
  const horizon = Math.max(12, Math.min(48, Math.max(...crosses, 0) + 4));
  const series = perps.map((p) => ({ d: p, cum: cumulative(p.cash, horizon) }));
  const max = Math.max(1, ...lumps.map((l) => l.total), ...series.map((s) => s.cum[horizon])) * 1.08;

  const W = 760, H = 230, padL = 50, padR = 150, padT = 10, padB = 26;
  const x = (m: number) => padL + ((m - 1) / (horizon - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const ticks = Array.from({ length: horizon }, (_, i) => i + 1).filter((m) => m === 1 || m % (horizon > 24 ? 6 : 3) === 0);

  // Right-edge labels, pushed apart so lines that end close together stay readable.
  const labels = [
    ...lumps.map((l) => ({ id: l.id, text: `${l.id === 'LEVEL' ? 'Settlement' : 'File buyout'} ${fmtMoney(l.total)}`, y: y(l.total) + 3 })),
    ...series.map(({ d, cum }) => ({ id: d.id, text: `${d.name} ${fmtMoney(cum[horizon])}`, y: y(cum[horizon]) + 3 })),
  ].sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 12) labels[i].y = labels[i - 1].y + 12;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Running total of perpetuity revenue against one-time payouts" style={{ display: 'block' }}>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={padL} x2={W - padR} y1={y(max * f)} y2={y(max * f)} stroke={T.lineSoft} />
          <text x={padL - 6} y={y(max * f) + 3} fontSize={9} textAnchor="end" fill={T.faint} fontFamily="ui-monospace, monospace">{fmtMoney(max * f)}</text>
        </g>
      ))}
      {ticks.map((m) => <text key={m} x={x(m)} y={H - 8} fontSize={9} textAnchor="middle" fill={T.muted}>{`Mo ${m}`}</text>)}

      {lumps.map((l) => (
        <line key={l.id} x1={padL} x2={W - padR} y1={y(l.total)} y2={y(l.total)} stroke={colColor(l.id)} strokeDasharray="6 4" strokeWidth={1.5} />
      ))}
      {series.map(({ d, cum }) => {
        let path = '';
        for (let m = 1; m <= horizon; m++) path += `${m === 1 ? 'M' : 'L'}${x(m).toFixed(1)},${y(cum[m]).toFixed(1)}`;
        return (
          <g key={d.id}>
            <path d={path} fill="none" stroke={colColor(d.id)} strokeWidth={2.4} />
            {lumps.map((l) => {
              const m = catchUp(d, l.total);
              if (m == null || m > horizon) return null;
              return <circle key={l.id} cx={x(m)} cy={y(cum[m])} r={4} fill="#fff" stroke={colColor(d.id)} strokeWidth={2} />;
            })}
          </g>
        );
      })}
      {labels.map((lb) => (
        <text key={lb.id} x={W - padR + 6} y={lb.y} fontSize={10} fontWeight={700} fill={colColor(lb.id)}>{lb.text}</text>
      ))}
      <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} stroke={T.line} />
    </svg>
  );
}

const DEFAULT_DEBT = 15000;
const PRESETS = [10000, 15000, 20000, 30000];

export function BackendExplainer({ inputs }: { inputs: ModelInputs; levelMonthlyVolume?: number }) {
  const [debt, setDebt] = useState(DEFAULT_DEBT);
  const [draft, setDraft] = useState(String(DEFAULT_DEBT));
  const deals = useMemo(() => COLS.map((id) => buildDeal(id, inputs, debt)), [inputs, debt]);
  const commit = (v: number) => { const n = Math.max(0, Math.round(v)); setDebt(n); setDraft(String(n)); };
  const byId = (id: ColId) => deals.find((d) => d.id === id)!;
  const lumps = deals.filter((d) => d.oneTime);
  const band = shield.getProgram(debt, inputs.consumerShield);

  const rows: { label: string; tip?: string; get: (d: Deal) => React.ReactNode; num?: boolean }[] = [
    { label: 'How we are paid', get: (d) => d.howPaid },
    { label: 'Funding Tier revenue', num: true, tip: 'Total Funding Tier is paid on this one deal if the client never cancels.', get: (d) => (
      <><span style={{ fontSize: 15 }}>{fmtMoney(d.total)}</span><span style={{ fontSize: 10.5, color: T.muted, fontFamily: T.sans, fontWeight: 600, marginLeft: 6 }}>{d.oneTime ? 'once' : `over ${d.lastCash - d.firstCash + 1} months`}</span></>
    ) },
    { label: 'When the cash lands', get: (d) => d.oneTime ? `Month ${d.firstCash}, all at once` : `Month ${d.firstCash} through month ${d.lastCash}` },
    { label: 'Clear of liability', get: (d) => d.clear },
    ...lumps.map((l) => ({
      label: `Months to earn the ${l.id === 'LEVEL' ? 'settlement' : 'buyout'} (${fmtMoney(l.total)})`,
      tip: `How long the monthly perpetuity takes to pay Funding Tier as much as the ${l.id === 'LEVEL' ? 'Level Debt settlement' : 'Shield file buyout'} pays in one payment — and the share of clients still paying at that point under the Risk & Attrition assumptions.`,
      get: (d: Deal) => {
        if (d.oneTime) return <span style={{ color: T.faint }}>{d.id === l.id ? `Paid in full, month ${d.firstCash}` : '—'}</span>;
        const m = catchUp(d, l.total);
        if (m == null) return <span style={{ color: T.faint }}>Never within the program</span>;
        const dm = m - (d.firstCash - 1);
        return (
          <span>
            <strong style={{ fontFamily: T.mono, fontSize: 13 }}>Month {m}</strong>
            <span style={{ color: T.muted }}> · {dm} payment{dm === 1 ? '' : 's'} · {fmtPct((d.stillPaying[dm] ?? 0) * 100, 0)} of clients still paying</span>
          </span>
        );
      },
    })),
  ];

  const cs = byId('CS'); const lv = byId('LEVEL'); const buy = byId('CSBUY'); const elp = byId('LEGACY');
  const csVsBuy = catchUp(cs, buy.total), csVsLv = catchUp(cs, lv.total), elpVsLv = catchUp(elp, lv.total);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12.5, color: T.body, lineHeight: 1.5, marginRight: 'auto', maxWidth: 640 }}>
          The same client at each partner. <strong>Level Debt</strong> and the <strong>Shield file buyout</strong> pay once, up front.
          The <strong>Shield</strong> and <strong>Elite Legal</strong> perpetuities pay a share of every monthly payment — more in total,
          but only while the client keeps paying.
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: T.body }}>
          Enrolled debt
          <span style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${T.brand}`, borderRadius: 8, background: '#fff', padding: '0 8px' }}>
            <span style={{ color: T.muted, fontFamily: T.mono }}>$</span>
            <input type="number" min={0} step={500} value={draft}
              onChange={(e) => { setDraft(e.target.value); const n = Number(e.target.value); if (Number.isFinite(n)) setDebt(Math.max(0, n)); }}
              onBlur={() => commit(Number(draft) || 0)}
              style={{ width: 84, border: 0, outline: 'none', padding: '7px 4px', fontFamily: T.mono, fontSize: 14, fontWeight: 800, color: T.ink, background: 'transparent' }} />
          </span>
        </label>
        <div style={{ display: 'flex', gap: 5 }}>
          {PRESETS.map((p) => (
            <button key={p} onClick={() => commit(p)} style={{
              padding: '5px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: T.mono,
              border: `1px solid ${debt === p ? T.brand : T.line}`, background: debt === p ? T.brand : '#fff', color: debt === p ? '#fff' : T.body,
            }}>{`$${p / 1000}k`}</button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820, tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: '17%' }} />
              {deals.map((d) => (
                <th key={d.id} style={{ ...th, textAlign: 'left', borderTop: `3px ${d.id === 'CSBUY' ? 'dashed' : 'solid'} ${colColor(d.id)}` }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><PartnerMark k={brandOf(d.id)} size={15} />{d.name}</span>
                  <div style={{ fontSize: 9, marginTop: 2, color: d.oneTime ? T.warn : T.good }}>{d.option} · {d.oneTime ? 'one payment' : 'monthly'}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r.label}>
                <td style={{ ...td, fontSize: 11, color: T.muted, whiteSpace: 'normal', verticalAlign: 'top' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>{r.label}{r.tip && <Info text={r.tip} />}</span>
                </td>
                {deals.map((d) => (
                  <td key={d.id} style={{
                    ...(r.num ? tdNum : td), textAlign: 'left', whiteSpace: 'normal', verticalAlign: 'top', lineHeight: 1.45,
                    fontSize: r.num ? 13 : 11.5, fontWeight: r.num ? 800 : 500, color: r.num ? T.brandDark : T.ink,
                  }}>
                    {d.eligible ? r.get(d) : (ri === 0 ? <span style={{ color: T.faint, fontStyle: 'italic' }}>Not eligible — minimum {fmtMoney(d.minDebt)}</span> : '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: T.muted, display: 'flex', alignItems: 'center' }}>
        How long a perpetuity takes to match a one-time payout
        <Info text="Solid lines: the running total Funding Tier has been paid by each perpetuity, month by month, if the client keeps paying. Dashed lines: what the one-time payouts pay up front. The circle is the month the perpetuity catches up." />
      </div>
      <CatchUpChart deals={deals} />

      <div style={{ fontSize: 12, color: T.body, lineHeight: 1.6, marginTop: 6, background: T.panel, border: `1px solid ${T.line}`, borderRadius: 8, padding: '9px 11px' }}>
        <strong style={{ color: T.ink }}>At {fmtMoney(debt)}:</strong>{' '}
        {cs.eligible && buy.eligible && csVsBuy != null && <>a Shield perpetuity file passes the {fmtMoney(buy.total)} buyout in <strong>month {csVsBuy}</strong>. </>}
        {cs.eligible && lv.eligible && csVsLv != null && <>It passes the {fmtMoney(lv.total)} Level Debt settlement in <strong>month {csVsLv}</strong>. </>}
        {elp.eligible && lv.eligible && elpVsLv != null && <>Elite Legal passes the settlement in <strong>month {elpVsLv}</strong>. </>}
        After that, every further month is revenue the one-time payouts never earn — but only if the client is still paying.
        {band && <> Shield prices by debt range, not exact debt: {fmtMoney(debt)} is program {band.code} ({fmtMoney(band.min)}–{band.max === Infinity ? 'up' : fmtMoney(Math.floor(band.max))}), so any debt in that range pays the same.</>}
      </div>
    </>
  );
}

export default BackendExplainer;
