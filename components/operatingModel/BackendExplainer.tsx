'use client';
import React, { useMemo, useState } from 'react';
import type { BackendKey, ModelInputs } from './types';
import { BRANDS } from './config';
import { legacy, shield } from './backends';
import { Info, PartnerMark, T, fmtMoney, fmtPct, td, tdNum, th } from './ui';

// ─────────────────────────────────────────────────────────────────────────────
// Backend Terms, explained — kept deliberately small.
//
// The same enrolled debt at every partner: how Funding Tier is paid, how much
// (in dollars and as a share of the debt) and when the cash lands. Break-even
// against the 8% settlement and the file buyout lives in the Profit Engine's
// Backend Comparison, so it is linked from here rather than repeated.
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
}

function buildDeal(id: ColId, inputs: ModelInputs, debt: number): Deal {
  const key = brandOf(id);
  const lag = inputs.remittanceLag[key];
  const cash: number[] = [];
  const add = (dealMonth: number, v: number) => {
    const m = dealMonth + lag;
    cash[m] = (cash[m] ?? 0) + v;
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
  };
}

const colColor = (id: ColId) => BRANDS[brandOf(id)].accent;

const DEFAULT_DEBT = 15000;
const PRESETS = [10000, 15000, 20000, 30000];

export function BackendExplainer({ inputs }: { inputs: ModelInputs; levelMonthlyVolume?: number }) {
  const [debt, setDebt] = useState(DEFAULT_DEBT);
  const [draft, setDraft] = useState(String(DEFAULT_DEBT));
  const deals = useMemo(() => COLS.map((id) => buildDeal(id, inputs, debt)), [inputs, debt]);
  const commit = (v: number) => { const n = Math.max(0, Math.round(v)); setDebt(n); setDraft(String(n)); };
  const band = shield.getProgram(debt, inputs.consumerShield);

  const rows: { label: string; tip?: string; get: (d: Deal) => React.ReactNode; num?: boolean }[] = [
    { label: 'How we are paid', get: (d) => d.howPaid },
    { label: 'Funding Tier revenue', num: true, tip: 'Total Funding Tier is paid on this one deal if the client never cancels, and that total as a share of enrolled debt.', get: (d) => (
      <><span style={{ fontSize: 15 }}>{fmtMoney(d.total)}</span><span style={{ fontSize: 10.5, color: T.muted, fontFamily: T.sans, fontWeight: 600, marginLeft: 6 }}>{fmtPct(debt > 0 ? (d.total / debt) * 100 : 0, 2)} of debt · {d.oneTime ? 'once' : `over ${d.lastCash - d.firstCash + 1} months`}</span></>
    ) },
    { label: 'When the cash lands', get: (d) => d.oneTime ? `Month ${d.firstCash}, all at once` : `Month ${d.firstCash} through month ${d.lastCash}` },
  ];


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

      <div style={{ fontSize: 12, color: T.body, lineHeight: 1.6, marginTop: 10, background: T.panel, border: `1px solid ${T.line}`, borderRadius: 8, padding: '9px 11px' }}>
        {band && <>Shield prices by debt range, not exact debt: {fmtMoney(debt)} is program {band.code} ({fmtMoney(band.min)}–{band.max === Infinity ? 'up' : fmtMoney(Math.floor(band.max))}), so any debt in that range pays the same. </>}
        How long each perpetuity takes to earn the settlement’s 8% or the buyout’s share, and when each option is clear of liability,
        is charted in the <a href="/profit-engine" style={{ color: T.brandDark, fontWeight: 700 }}>Profit Engine → Backend Comparison</a>.
      </div>
    </>
  );
}

export default BackendExplainer;
