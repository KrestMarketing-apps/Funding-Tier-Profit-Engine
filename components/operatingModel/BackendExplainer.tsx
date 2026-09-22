'use client';
import React, { useMemo, useState } from 'react';
import type { BackendKey, ModelInputs } from './types';
import { BACKEND_KEYS } from './types';
import { BRANDS } from './config';
import { buildSurvivalCurve, legacy, levelDebt, shield } from './backends';
import { G, Info, PartnerMark, PartnerName, Row, T, fmtMoney, fmtMoney2, fmtPct, td, tdNum, th } from './ui';

// ─────────────────────────────────────────────────────────────────────────────
// Backend Terms, explained.
//
// The contract-term chips answer "what are the settings". An owner, operator or
// investor needs the question before that: what is Funding Tier actually being
// paid a portion OF, who keeps the rest, when does the money land, and what is
// one deal worth. Everything here is read from the same engine the simulation
// uses (backends.ts) — nothing is re-derived, so the story and the model can
// never disagree.
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  ft: T.brand,          // Funding Tier's share — always teal
  partner: '#cbd5e1',   // what the partner keeps
  fee: '#94a3b8',       // pass-through fees (servicing, maintenance, processing)
  rep: '#d97706',       // rep commission
};

type ColId = BackendKey | 'CSBUY';
const COLS: ColId[] = ['LEVEL', 'CS', 'CSBUY', 'LEGACY'];
const colKey = (id: ColId): BackendKey => (id === 'CSBUY' ? 'CS' : id);
const colName = (id: ColId) => id === 'CSBUY' ? `${BRANDS.CS.name} · buyout` : id === 'CS' ? `${BRANDS.CS.name} · perpetuity` : BRANDS[id].name;

interface MonthPoint { m: number; full: number; expected: number }

interface DealStory {
  k: BackendKey;
  /** Column id — the partner key, or CSBUY for the Consumer Shield file buyout. */
  id?: ColId;
  /** Payout option shown next to the partner name (Perpetuity / File buyout). */
  variant?: string;
  /** Paid once rather than monthly. */
  oneTime?: boolean;
  debt: number;
  /** What the percentage is taken from, in one plain sentence. */
  portionOf: string;
  howPaid: string;
  /** Deal-months that pay Funding Tier (full-term, no cancellations). */
  months: MonthPoint[];
  /** Cash month = deal-month + remittance lag. */
  lag: number;
  term: number;
  repComm: number;
  repMonth: number;
  repExpected: number;
  fullTotal: number;
  expectedTotal: number;
  firstCashMonth: number;
  riskEnds: string;
  splits: { title: string; total: number; parts: { label: string; amount: number; color: string; who: string }[] }[];
  levelRate?: number;
  /** Level Debt: deal-month after which the fee can no longer be charged back. */
  clearMonth?: number;
}

function buildStory(k: BackendKey, inputs: ModelInputs, levelMonthlyVolume: number): DealStory {
  const debt = inputs.volume.avgDebt[k];
  const lag = inputs.remittanceLag[k];

  if (k === 'LEVEL') {
    const t = inputs.levelDebt;
    const surv = buildSurvivalCurve(inputs.survivalCurves.LEVEL, Math.max(t.revenueRecognizedMonth, t.agentPayoutMonth) + 2);
    const share = debt * t.revenueSharePct;
    const rate = levelDebt.commissionRate(levelMonthlyVolume, t);
    const repComm = debt * rate;
    const months: MonthPoint[] = [];
    for (let m = 1; m <= t.revenueRecognizedMonth; m++) {
      const v = levelDebt.revenueForDealMonth(debt, m, t);
      months.push({ m, full: v, expected: v * (surv[m] ?? 0) });
    }
    return {
      k, debt, lag, term: t.revenueRecognizedMonth,
      portionOf: `${fmtPct(t.revenueSharePct * 100, 0)} of the debt the client enrolls — ${fmtMoney(debt)} × ${fmtPct(t.revenueSharePct * 100, 0)} = ${fmtMoney(share)}.`,
      howPaid: `One payment, after the client’s first program payment clears. The client’s monthly payments go into Level Debt’s settlement program; Funding Tier does not take a cut of them.`,
      months, repComm, repMonth: t.agentPayoutMonth, repExpected: repComm * (surv[t.agentPayoutMonth] ?? 0),
      fullTotal: share, expectedTotal: months.reduce((s, p) => s + p.expected, 0),
      firstCashMonth: t.revenueRecognizedMonth + lag,
      riskEnds: `After payment ${t.chargebackClearMonths} — if the client cancels before that, Level Debt can charge the ${fmtMoney(share)} back.`,
      splits: [{
        title: `The client enrolls ${fmtMoney(debt)} of debt`,
        total: debt,
        parts: [
          { label: 'Funding Tier’s fee', amount: share, color: C.ft, who: `Paid once by Level Debt · ${fmtPct(t.revenueSharePct * 100, 0)}` },
          { label: 'Rest of the enrolled debt', amount: debt - share, color: C.partner, who: 'Negotiated by Level Debt with creditors — not Funding Tier revenue' },
        ],
      }],
      levelRate: rate,
      clearMonth: t.chargebackClearMonths,
    };
  }

  if (k === 'CS') {
    const t = inputs.consumerShield;
    const p = shield.getProgram(debt, t);
    const term = p?.term ?? 0;
    const pay = p?.payment ?? 0;
    const net = pay - t.servicingDeductionPerPayment;
    const surv = buildSurvivalCurve(inputs.survivalCurves.CS, Math.max(term, t.agentPayoutMonth) + 2);
    const months: MonthPoint[] = [];
    for (let m = 1; m <= term; m++) {
      const v = shield.perpetualRevenueForDealMonth(debt, m, t);
      months.push({ m, full: v, expected: v * (surv[m] ?? 0) });
    }
    const repComm = shield.agentCommission(debt, t);
    const front = net * t.frontCaptureRate;
    const back = net * t.backendCaptureRate;
    return {
      k, debt, lag, term,
      portionOf: `Each monthly program payment the client makes — ${fmtMoney(pay)}/mo on program ${p?.code ?? '—'} — after Consumer Shield’s ${fmtMoney(t.servicingDeductionPerPayment)} servicing deduction.`,
      howPaid: `Every month for as long as the client stays in the ${term}-month program: ${fmtPct(t.frontCaptureRate * 100, 0)} of the net for the first ${t.frontMonths} months, then ${fmtPct(t.backendCaptureRate * 100, 0)}. Each month’s share arrives ${lag} month${lag === 1 ? '' : 's'} after the client pays.`,
      months, repComm, repMonth: t.agentPayoutMonth, repExpected: repComm * (surv[t.agentPayoutMonth] ?? 0),
      fullTotal: months.reduce((s, p) => s + p.full, 0), expectedTotal: months.reduce((s, p) => s + p.expected, 0),
      firstCashMonth: 1 + lag,
      riskEnds: 'No chargeback on payments already made — a cancellation only stops future months.',
      splits: [
        {
          title: `Months 1–${t.frontMonths} · one ${fmtMoney(pay)} client payment`,
          total: pay,
          parts: [
            { label: 'Servicing deduction', amount: t.servicingDeductionPerPayment, color: C.fee, who: 'Kept by Consumer Shield' },
            ...(net - front > 0.005 ? [{ label: 'Consumer Shield share', amount: net - front, color: C.partner, who: 'Kept by Consumer Shield' }] : []),
            { label: 'Funding Tier’s share', amount: front, color: C.ft, who: `${fmtPct(t.frontCaptureRate * 100, 0)} of the ${fmtMoney(net)} net` },
          ],
        },
        {
          title: `Month ${t.frontMonths + 1} to ${term} · the same ${fmtMoney(pay)} payment`,
          total: pay,
          parts: [
            { label: 'Servicing deduction', amount: t.servicingDeductionPerPayment, color: C.fee, who: 'Kept by Consumer Shield' },
            { label: 'Consumer Shield share', amount: net - back, color: C.partner, who: `${fmtPct((1 - t.backendCaptureRate) * 100, 0)} of the net` },
            { label: 'Funding Tier’s share', amount: back, color: C.ft, who: `${fmtPct(t.backendCaptureRate * 100, 0)} of the ${fmtMoney(net)} net` },
          ],
        },
      ],
    };
  }

  // Elite Legal Practice / Legacy Capital
  const L = inputs.legacy;
  const term = legacy.getMaxTerm(debt, L);
  const fee = legacy.totalFee(debt, L);
  const pay = legacy.getScheduledPayment(debt, L);
  const draftFee = legacy.draftFeePerMonth(L);
  const early = legacy.revenueForDealMonth(debt, 1, L);
  const late = legacy.revenueForDealMonth(debt, 3, L);
  const surv = buildSurvivalCurve(inputs.survivalCurves.LEGACY, Math.max(term, L.agentPayoutMonth) + 2);
  const months: MonthPoint[] = [];
  for (let m = 1; m <= term; m++) {
    const v = legacy.revenueForDealMonth(debt, m, L);
    months.push({ m, full: v, expected: v * (surv[m] ?? 0) });
  }
  const repComm = legacy.agentCommission(debt, L);
  const elpKeeps = pay - L.maintenanceFee - draftFee - late;
  return {
    k: 'LEGACY', debt, lag, term,
    portionOf: `The client’s monthly draft. The program fee is ${fmtPct(L.feeRate * 100, 0)} of enrolled debt (${fmtMoney(debt)} → ${fmtMoney2(fee)}), spread over ${term} monthly drafts of ${fmtMoney2(pay)}.`,
    howPaid: `Months 1–2: nearly the whole draft passes to Funding Tier (${fmtMoney2(early)}). Month 3 on: after the ${fmtMoney(L.maintenanceFee)} maintenance and ${fmtMoney(draftFee)} processing come off, Funding Tier keeps ${fmtPct(L.tier1Rate * 100, 0)} of what is left (${fmtMoney2(late)}). Each month arrives ${lag} month${lag === 1 ? '' : 's'} after the draft.`,
    months, repComm, repMonth: L.agentPayoutMonth, repExpected: repComm * (surv[L.agentPayoutMonth] ?? 0),
    fullTotal: months.reduce((s, p) => s + p.full, 0), expectedTotal: months.reduce((s, p) => s + p.expected, 0),
    firstCashMonth: 1 + lag,
    riskEnds: 'No chargeback on drafts already cleared — a cancellation only stops future months.',
    splits: [
      {
        title: `Drafts 1–2 · one ${fmtMoney2(pay)} client draft`,
        total: pay,
        parts: [
          { label: 'Processing fee', amount: draftFee, color: C.fee, who: 'Payment processor' },
          { label: 'Funding Tier’s share', amount: early, color: C.ft, who: 'Everything else passes through' },
        ],
      },
      {
        title: `Draft 3 to ${term} · the same ${fmtMoney2(pay)} draft`,
        total: pay,
        parts: [
          { label: 'Processing fee', amount: draftFee, color: C.fee, who: 'Payment processor' },
          { label: 'Maintenance fee', amount: L.maintenanceFee, color: '#b6c2d1', who: 'Kept by Elite Legal Practice' },
          { label: 'Elite Legal Practice share', amount: elpKeeps, color: C.partner, who: `${fmtPct((1 - L.tier1Rate) * 100, 0)} of the service fee` },
          { label: 'Funding Tier’s share', amount: late, color: C.ft, who: `${fmtPct(L.tier1Rate * 100, 0)} of the service fee` },
        ],
      },
    ],
  };
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function FlowStep({ n, title, body, tone }: { n: number; title: string; body: string; tone?: 'ft' | 'rep' }) {
  const color = tone === 'ft' ? T.brand : tone === 'rep' ? C.rep : T.ink;
  return (
    <div style={{
      flex: '1 1 170px', minWidth: 0, border: `1px solid ${tone === 'ft' ? T.brandLine : T.line}`,
      background: tone === 'ft' ? T.brandSoft : '#fff', borderRadius: 10, padding: '10px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{
          width: 18, height: 18, borderRadius: 9, background: color, color: '#fff', fontSize: 10.5,
          fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto',
        }}>{n}</span>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: T.ink }}>{title}</span>
      </div>
      <div style={{ fontSize: 11.5, color: T.body, lineHeight: 1.5, marginTop: 5 }}>{body}</div>
    </div>
  );
}

const Arrow = () => (
  <div aria-hidden style={{ alignSelf: 'center', color: T.faint, fontSize: 18, fontWeight: 700, flex: '0 0 auto' }}>→</div>
);

function SplitBar({ split }: { split: DealStory['splits'][number] }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.ink, marginBottom: 5 }}>{split.title}</div>
      <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', border: `1px solid ${T.line}` }}>
        {split.parts.map((p) => (
          <div key={p.label} title={`${p.label}: ${fmtMoney2(p.amount)}`}
            style={{
              width: `${(p.amount / split.total) * 100}%`, background: p.color, minWidth: p.amount > 0 ? 2 : 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              color: p.color === C.ft ? '#fff' : T.ink, fontSize: 10.5, fontWeight: 800, fontFamily: T.mono, whiteSpace: 'nowrap',
            }}>
            {p.amount / split.total > 0.16 ? fmtMoney2(p.amount) : ''}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 6, display: 'grid', gap: 3 }}>
        {split.parts.map((p) => (
          <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: p.color, flex: '0 0 auto', border: `1px solid ${T.line}` }} />
            <span style={{ color: T.ink, fontWeight: p.color === C.ft ? 800 : 600 }}>{p.label}</span>
            <span style={{ color: T.faint, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.who}</span>
            <span style={{ fontFamily: T.mono, fontWeight: 700, color: p.color === C.ft ? T.brandDark : T.body }}>{fmtMoney2(p.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * When the money lands, month by month, for one deal. Light bar = the client
 * finishes the program; solid bar = what the model expects after cancellations.
 */
function Timeline({ s, showExpected }: { s: DealStory; showExpected: boolean }) {
  const W = 760, H = 150, padL = 44, padR = 10, padT = 22, padB = 24;
  const last = Math.max(s.term + s.lag, s.repMonth, (s.clearMonth ?? 0) + 1, 6);
  const max = Math.max(...s.months.map((p) => p.full), s.repComm, 1);
  const bw = (W - padL - padR) / last;
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const x = (cashMonth: number) => padL + (cashMonth - 1) * bw;
  const ticks = last <= 12 ? Array.from({ length: last }, (_, i) => i + 1)
    : [1, ...Array.from({ length: Math.floor(last / 6) }, (_, i) => (i + 1) * 6)];
  const marker = (m: number, label: string, color: string, row: number) => (
    <g key={label}>
      <line x1={x(m) + bw / 2} x2={x(m) + bw / 2} y1={padT - 4} y2={H - padB} stroke={color} strokeDasharray="3 3" strokeWidth={1.2} />
      <text x={Math.min(x(m) + bw / 2 + 4, W - 120)} y={10 + row * 11} fontSize={9.5} fontWeight={700} fill={color}>{label}</text>
    </g>
  );
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
      aria-label={`${BRANDS[s.k].name}: Funding Tier cash per month for one deal`} style={{ display: 'block' }}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={padL} x2={W - padR} y1={y(max * f)} y2={y(max * f)} stroke={T.lineSoft} />
          <text x={padL - 6} y={y(max * f) + 3} fontSize={9} textAnchor="end" fill={T.faint} fontFamily="ui-monospace, monospace">{fmtMoney(max * f)}</text>
        </g>
      ))}
      {s.months.map((p) => {
        const cm = p.m + s.lag;
        const w = Math.max(bw - (last > 20 ? 1.5 : 4), 1);
        return (
          <g key={p.m}>
            <rect x={x(cm) + (bw - w) / 2} y={y(p.full)} width={w} height={H - padB - y(p.full)}
              fill={BRANDS[s.k].accentSoft} stroke={T.brandLine} strokeWidth={0.6} rx={1.5}>
              <title>{`Month ${cm}: ${fmtMoney2(p.full)} if the client stays${showExpected ? ` · ${fmtMoney2(p.expected)} expected` : ''}`}</title>
            </rect>
            {showExpected && (
              <rect x={x(cm) + (bw - w) / 2} y={y(p.expected)} width={w} height={H - padB - y(p.expected)} fill={C.ft} rx={1.5} pointerEvents="none" />
            )}
          </g>
        );
      })}
      {/* rep commission, drawn below the axis as money going out */}
      <rect x={x(s.repMonth) + bw * 0.2} y={H - padB - 5} width={bw * 0.6} height={5} fill={C.rep} />
      {marker(s.repMonth, `Rep paid ${fmtMoney(s.repComm)}`, C.rep, 0)}
      {s.clearMonth != null && marker(s.clearMonth, 'Chargeback risk ends', T.bad, 1)}
      {!s.oneTime && marker(s.term + s.lag, 'Program ends', T.muted, 1)}
      <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} stroke={T.line} />
      {ticks.map((m) => (
        <text key={m} x={x(m) + bw / 2} y={H - 8} fontSize={9} textAnchor="middle" fill={T.muted}>{`Mo ${m}`}</text>
      ))}
    </svg>
  );
}

function Stat({ label, value, sub, tone, tip }: { label: string; value: string; sub?: string; tone?: 'ft' | 'rep'; tip: string }) {
  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 9, padding: '8px 10px', background: G.tile, minWidth: 0 }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: T.muted, display: 'flex', alignItems: 'center' }}>
        {label}<Info text={tip} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, fontFamily: T.mono, marginTop: 3, color: tone === 'ft' ? T.brandDark : tone === 'rep' ? C.rep : T.ink }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: T.faint, marginTop: 1, lineHeight: 1.35 }}>{sub}</div>}
    </div>
  );
}

function StoryCard({ s, showExpected }: { s: DealStory; showExpected: boolean }) {
  const b = BRANDS[s.k];
  const paying = s.months.filter((p) => p.full > 0).length;
  return (
    <div style={{ border: `1px solid ${T.line}`, borderLeft: `3px solid ${b.accent}`, borderRadius: 10, padding: '12px 14px', marginBottom: 12, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <PartnerName k={s.k} size={20} sub />
        {s.variant && (
          <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 20,
            color: s.oneTime ? T.warn : T.good, background: s.oneTime ? T.warnBg : T.goodBg, border: `1px solid ${s.oneTime ? T.warnLine : '#bbf7d0'}` }}>{s.variant}</span>
        )}
        <span style={{ fontSize: 11, color: T.muted }}>Example deal: <strong style={{ color: T.ink }}>{fmtMoney(s.debt)}</strong> enrolled debt — the same amount at every partner (set above)</span>
      </div>

      <Row cols="minmax(0,1fr) minmax(0,1fr)" gap={16} style={{ marginTop: 10 }}>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: T.brandDark }}>What we are paid a portion of</div>
          <div style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.5, marginTop: 3 }}>{s.portionOf}</div>
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: T.brandDark, marginTop: 9 }}>How and when it is paid</div>
          <div style={{ fontSize: 12, color: T.body, lineHeight: 1.5, marginTop: 3 }}>{s.howPaid}</div>
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: T.brandDark, marginTop: 9 }}>When the risk ends</div>
          <div style={{ fontSize: 12, color: T.body, lineHeight: 1.5, marginTop: 3 }}>{s.riskEnds}</div>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          {s.splits.map((sp) => <SplitBar key={sp.title} split={sp} />)}
        </div>
      </Row>

      <div style={{ marginTop: 12, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: T.muted, display: 'flex', alignItems: 'center' }}>
        When the cash lands — one deal, month by month
        <Info text={`Each bar is the month the money reaches Funding Tier’s bank account (deal-month + ${s.lag}-month remittance lag). Light bars: the client stays to the end. ${showExpected ? 'Solid bars: what the model expects per enrolled deal after its first-payment and monthly cancellation assumptions (Risk & Attrition).' : ''} The orange tick is the rep’s commission going out.`} />
      </div>
      <Timeline s={s} showExpected={showExpected} />

      <Row cols={4} gap={10} style={{ marginTop: 8 }}>
        <Stat label="If the client finishes" value={fmtMoney(s.fullTotal)} tone="ft"
          sub={s.oneTime ? 'One payment' : `${paying} monthly payments`}
          tip="Total Funding Tier receives from this one deal if the client never cancels." />
        <Stat label="Expected per enrolled deal" value={fmtMoney(s.expectedTotal)} tone="ft"
          sub={`${fmtPct(s.fullTotal > 0 ? (s.expectedTotal / s.fullTotal) * 100 : 0, 0)} of the full amount`}
          tip="The same deal weighted by the survival curve: some clients never make a first payment, and some cancel each month after. This is the number the simulation actually books." />
        <Stat label="Rep commission" value={fmtMoney(s.repComm)} tone="rep"
          sub={`Paid in month ${s.repMonth}${s.levelRate != null ? ` · ${fmtPct(s.levelRate * 100, 2)} tier` : ''}`}
          tip={s.k === 'LEVEL'
            ? 'Level Debt commission is a percentage of enrolled debt, set by the company-wide Level Debt volume tier for the month. Paid only if the deal is still active at payout.'
            : 'Flat commission per enrolled deal from the live schedule. Paid only if the deal is still active at payout.'} />
        <Stat label="First cash in" value={`Month ${s.firstCashMonth}`}
          sub={s.oneTime ? 'All of it, at once' : `Last payment month ${s.term + s.lag}`}
          tip="The month Funding Tier’s first dollar from this deal reaches the bank, counting the month the deal is signed as month 1." />
      </Row>
    </div>
  );
}

// ── Section ──────────────────────────────────────────────────────────────────

// ── Same-debt comparison ─────────────────────────────────────────────────────

interface AtDebt extends DealStory {
  eligible: boolean;
  minDebt: number;
  clientPays: string;
  ftPerPayment: string;
  scaling: string;
  mainRisk: string;
}

/** One partner's deal at a debt amount the viewer picks, without touching the model. */
function storyAt(k: BackendKey, inputs: ModelInputs, debt: number, levelMonthlyVolume: number): AtDebt {
  const at: ModelInputs = { ...inputs, volume: { ...inputs.volume, avgDebt: { ...inputs.volume.avgDebt, [k]: debt } } };
  const s = buildStory(k, at, levelMonthlyVolume);
  if (k === 'LEVEL') {
    const t = inputs.levelDebt;
    return {
      ...s, eligible: debt >= t.minDebt, minDebt: t.minDebt,
      clientPays: 'Monthly deposits into Level Debt’s settlement program (not shared with us)',
      ftPerPayment: `${fmtMoney(s.fullTotal)} once`,
      scaling: `Straight line — every extra $1,000 enrolled adds ${fmtMoney(1000 * t.revenueSharePct)}.`,
      mainRisk: `Chargeback if the client cancels before payment ${t.chargebackClearMonths}`,
      id: 'LEVEL', oneTime: true,
    };
  }
  if (k === 'CS') {
    const t = inputs.consumerShield;
    const p = shield.getProgram(debt, t);
    const net = (p?.payment ?? 0) - t.servicingDeductionPerPayment;
    return {
      ...s, eligible: !!p && debt >= t.minDebt, minDebt: t.minDebt,
      clientPays: p ? `${fmtMoney(p.payment)}/mo × ${p.term} mo · program ${p.code}` : '—',
      ftPerPayment: p ? `${fmtMoney(net * t.frontCaptureRate)} (mo 1–${t.frontMonths}) → ${fmtMoney(net * t.backendCaptureRate)}` : '—',
      scaling: p ? `Stair-step — anything from ${fmtMoney(p.min)} to ${p.max === Infinity ? 'up' : fmtMoney(Math.floor(p.max))} pays exactly the same.` : '—',
      mainRisk: 'Client cancels and the monthly share stops',
      id: 'CS', variant: 'Perpetuity',
    };
  }
  const L = inputs.legacy;
  const ok = debt >= L.minDebt;
  return {
    ...s, eligible: ok, minDebt: L.minDebt,
    clientPays: ok ? `${fmtMoney2(legacy.getScheduledPayment(debt, L))}/mo × ${legacy.getMaxTerm(debt, L)} mo` : '—',
    ftPerPayment: ok ? `${fmtMoney(legacy.revenueForDealMonth(debt, 1, L))} (mo 1–2) → ${fmtMoney(legacy.revenueForDealMonth(debt, 3, L))}` : '—',
    scaling: `Mostly straight line — the fee is ${fmtPct(L.feeRate * 100, 0)} of the debt, but a bigger file also runs a longer term.`,
    mainRisk: 'Client cancels and the monthly share stops',
    id: 'LEGACY',
  };
}

/**
 * Consumer Shield Enrollment File Buyout at a chosen debt: the same file, sold
 * back to Consumer Shield for one advance instead of kept on the perpetuity.
 */
function buyoutAt(inputs: ModelInputs, debt: number): AtDebt {
  const t = inputs.consumerShield;
  const p = shield.getProgram(debt, t);
  const lag = inputs.remittanceLag.CS;
  const trig = t.buyout.triggerDealMonth;
  const pay = p?.payment ?? 0;
  const net = pay - t.servicingDeductionPerPayment;
  const rate = shield.buyoutRate(debt, t);
  const payout = shield.buyoutPayout(debt, t);
  const perpFull = shield.perpetualFullTerm(debt, t);
  const surv = buildSurvivalCurve(inputs.survivalCurves.CS, Math.max(trig, t.agentPayoutMonth) + 2);
  const months: MonthPoint[] = [];
  for (let m = 1; m <= trig; m++) {
    const v = m === trig ? payout : 0;
    months.push({ m, full: v, expected: v * (surv[m] ?? 0) });
  }
  const repComm = shield.agentCommission(debt, t);
  const be = shield.breakEvenPayments(debt, t);
  const high = shield.isHighDebtBuyout(debt, t);
  const sixNet = net * t.buyout.months;
  return {
    k: 'CS', id: 'CSBUY', variant: 'File buyout', oneTime: true,
    debt, lag, term: trig, months, repComm, repMonth: t.agentPayoutMonth,
    repExpected: repComm * (surv[t.agentPayoutMonth] ?? 0),
    fullTotal: payout, expectedTotal: months.reduce((a, q) => a + q.expected, 0),
    firstCashMonth: trig + lag,
    portionOf: `${t.buyout.months} months of the client’s net program payment, bought up front: (${fmtMoney(pay)} − ${fmtMoney(t.servicingDeductionPerPayment)}) × ${fmtPct(rate * 100, 0)} × ${t.buyout.months} = ${fmtMoney(payout)}. Files of ${fmtMoney(t.buyout.highDebtMinDebt)}+ are bought at ${fmtPct(t.buyout.highDebtRate * 100, 0)} instead of ${fmtPct(t.buyout.standardRate * 100, 0)}.`,
    howPaid: `One advance once the client’s first month (or both halves of a split first month) clears. It replaces every monthly share on that file — nothing recurs.${be != null ? ` Kept on the perpetuity instead, the same file out-earns the buyout after ${be} payments.` : ''}`,
    riskEnds: 'The model counts the advance as earned once the first payment clears. Clawback terms on bought-out files are not yet confirmed.',
    splits: [
      {
        title: `${t.buyout.months} months of net payments · ${fmtMoney(net)} × ${t.buyout.months} = ${fmtMoney(sixNet)}`,
        total: sixNet,
        parts: [
          { label: 'Funding Tier’s buyout', amount: payout, color: C.ft, who: `${fmtPct(rate * 100, 0)}${high ? ' — $20k+ rate' : ''}, paid now` },
          ...(sixNet - payout > 0.005 ? [{ label: 'Discount kept by Consumer Shield', amount: sixNet - payout, color: C.partner, who: `${fmtPct((1 - rate) * 100, 0)} for paying up front` }] : []),
        ],
      },
      {
        title: `Versus keeping the file on the perpetuity · ${fmtMoney(perpFull)} if the client finishes`,
        total: Math.max(perpFull, payout),
        parts: [
          { label: 'Buyout, paid now', amount: payout, color: C.ft, who: 'Certain once payment 1 clears' },
          ...(perpFull - payout > 0.005 ? [{ label: 'Perpetuity income given up', amount: perpFull - payout, color: C.partner, who: `Would arrive over ${p?.term ?? '—'} months — only if the client stays` }] : []),
        ],
      },
    ],
    eligible: !!p && debt >= t.minDebt, minDebt: t.minDebt,
    clientPays: p ? `${fmtMoney(p.payment)}/mo × ${p.term} mo · program ${p.code}` : '—',
    ftPerPayment: `${fmtMoney(payout)} once`,
    scaling: `Stair-step by program band, and jumps to the ${fmtPct(t.buyout.highDebtRate * 100, 0)} rate at ${fmtMoney(t.buyout.highDebtMinDebt)}+.`,
    mainRisk: 'Clawback terms not yet confirmed; no upside if the client stays',
  };
}

function colStory(id: ColId, inputs: ModelInputs, debt: number, levelMonthlyVolume: number): AtDebt {
  return id === 'CSBUY' ? buyoutAt(inputs, debt) : storyAt(id, inputs, debt, levelMonthlyVolume);
}

/** Funding Tier revenue per deal across enrolled debt, all three partners on one axis. */
function DebtCurve({ inputs, debt, expected, levelMonthlyVolume }: {
  inputs: ModelInputs; debt: number; expected: boolean; levelMonthlyVolume: number;
}) {
  const lo = 4000, hi = 50000, step = 500;
  const series = useMemo(() => COLS.map((k) => {
    const pts: [number, number][] = [];
    for (let d = lo; d <= hi; d += step) {
      const s = colStory(k, inputs, d, levelMonthlyVolume);
      pts.push([d, s.eligible ? (expected ? s.expectedTotal - s.repExpected : s.fullTotal - s.repComm) : NaN]);
    }
    return { k, pts };
  }), [inputs, expected, levelMonthlyVolume]);
  const W = 760, H = 220, padL = 52, padR = 150, padT = 12, padB = 26;
  const max = Math.max(1, ...series.flatMap((s) => s.pts.map((p) => (Number.isFinite(p[1]) ? p[1] : 0))));
  const x = (d: number) => padL + ((d - lo) / (hi - lo)) * (W - padL - padR);
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Funding Tier kept per deal by enrolled debt, each partner and payout option" style={{ display: 'block' }}>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={padL} x2={W - padR} y1={y(max * f)} y2={y(max * f)} stroke={T.lineSoft} />
          <text x={padL - 6} y={y(max * f) + 3} fontSize={9} textAnchor="end" fill={T.faint} fontFamily="ui-monospace, monospace">{fmtMoney(max * f)}</text>
        </g>
      ))}
      {[5000, 10000, 15000, 20000, 25000, 30000, 40000, 50000].map((d) => (
        <text key={d} x={x(d)} y={H - 8} fontSize={9} textAnchor="middle" fill={T.muted}>{`$${d / 1000}k`}</text>
      ))}
      {(() => {
        // End-of-line labels, pushed apart so lines that finish close together stay readable.
        const ends = series.map(({ k, pts }) => {
          const p = [...pts].reverse().find((q) => Number.isFinite(q[1]));
          return p ? { k, x: x(p[0]) + 6, y: y(p[1]) + 3 } : null;
        }).filter((e): e is { k: ColId; x: number; y: number } => !!e).sort((a, b) => a.y - b.y);
        for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 12) ends[i].y = ends[i - 1].y + 12;
        return ends.map((e) => <text key={e.k} x={e.x} y={e.y} fontSize={10} fontWeight={700} fill={BRANDS[colKey(e.k)].accent}>{colName(e.k)}</text>);
      })()}
      {series.map(({ k, pts }) => {
        let path = ''; let pen = false;
        pts.forEach(([d, v]) => {
          if (!Number.isFinite(v)) { pen = false; return; }
          path += `${pen ? 'L' : 'M'}${x(d).toFixed(1)},${y(v).toFixed(1)}`; pen = true;
        });
        return <path key={k} d={path} fill="none" stroke={BRANDS[colKey(k)].accent} strokeWidth={2} strokeDasharray={k === 'CSBUY' ? '5 4' : undefined} />;
      })}
      {debt >= lo && debt <= hi && (
        <g>
          <line x1={x(debt)} x2={x(debt)} y1={padT} y2={H - padB} stroke={T.ink} strokeDasharray="3 3" />
          {series.map(({ k, pts }) => {
            const s = colStory(k, inputs, debt, levelMonthlyVolume);
            if (!s.eligible) return null;
            const v = expected ? s.expectedTotal - s.repExpected : s.fullTotal - s.repComm;
            return <circle key={k} cx={x(debt)} cy={y(v)} r={4} fill={BRANDS[colKey(k)].accent} stroke="#fff" strokeWidth={1.5} />;
          })}
        </g>
      )}
      <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} stroke={T.line} />
    </svg>
  );
}

function ShieldBands({ inputs, debt }: { inputs: ModelInputs; debt: number }) {
  const t = inputs.consumerShield;
  const active = shield.getProgram(debt, t)?.code;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
        <thead>
          <tr>
            {['Program', 'Enrolled debt range', 'Client pays', 'Term', 'FT per payment', 'FT if the client finishes', 'File buyout', 'Rep commission'].map((h, i) => (
              <th key={h} style={{ ...th, textAlign: i < 2 ? 'left' : 'right' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.programs.map((p) => {
            const net = p.payment - t.servicingDeductionPerPayment;
            const on = p.code === active;
            const bg = on ? BRANDS.CS.accentSoft : undefined;
            const cellS = { ...tdNum, fontSize: 11.5, background: bg, fontWeight: on ? 800 : 500 };
            return (
              <tr key={p.code}>
                <td style={{ ...td, fontSize: 11.5, background: bg, fontWeight: 800 }}>{p.code}{on ? ' ◀ your example' : ''}</td>
                <td style={{ ...td, fontSize: 11.5, background: bg, fontFamily: T.mono }}>{fmtMoney(p.min)} – {p.max === Infinity ? 'and up' : fmtMoney(Math.floor(p.max))}</td>
                <td style={cellS}>{fmtMoney(p.payment)}/mo</td>
                <td style={cellS}>{p.term} mo</td>
                <td style={cellS}>{fmtMoney(net * t.frontCaptureRate)} → {fmtMoney(net * t.backendCaptureRate)}</td>
                <td style={{ ...cellS, color: T.brandDark }}>{fmtMoney(shield.perpetualFullTerm(p.min, t))}</td>
                <td style={cellS}>{fmtMoney(shield.buyoutPayout(p.min, t))}</td>
                <td style={cellS}>{fmtMoney(p.commission)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Section ──────────────────────────────────────────────────────────────────

const DEFAULT_DEBT = 15000;
const PRESETS = [8000, 15000, 25000, 40000];

export function BackendExplainer({ inputs, levelMonthlyVolume }: { inputs: ModelInputs; levelMonthlyVolume: number }) {
  const [showExpected, setShowExpected] = useState(true);
  const [focus, setFocus] = useState<ColId | 'ALL'>('ALL');
  const [debt, setDebt] = useState<number>(DEFAULT_DEBT);
  const [draft, setDraft] = useState<string>(String(DEFAULT_DEBT));
  const stories = useMemo(
    () => COLS.map((k) => colStory(k, inputs, debt, levelMonthlyVolume)),
    [inputs, debt, levelMonthlyVolume],
  );
  const shown = (focus === 'ALL' ? stories : stories.filter((s) => s.id === focus));
  const commit = (v: number) => {
    const n = Math.max(0, Math.min(250000, Math.round(v)));
    setDebt(n); setDraft(String(n));
  };

  type CmpRow = { label: string; tip?: string; get: (s: AtDebt) => number | string; money?: boolean; best?: boolean; color?: string; total?: boolean };
  const rows: CmpRow[] = [
    { label: 'We are paid a portion of', get: (s) => s.id === 'LEVEL' ? `The enrolled debt (${fmtPct(inputs.levelDebt.revenueSharePct * 100, 0)}), once` : s.id === 'CS' ? 'Each monthly program payment' : s.id === 'CSBUY' ? `${inputs.consumerShield.buyout.months} months of net payments, bought up front` : 'Each monthly fee draft' },
    { label: 'What the client pays the partner', get: (s) => s.clientPays },
    { label: 'Funding Tier per payment', get: (s) => s.ftPerPayment },
    { label: 'How pay changes with debt', get: (s) => s.scaling },
    { label: 'First cash arrives', get: (s) => `Month ${s.firstCashMonth}` },
    { label: 'If the client finishes', get: (s) => s.fullTotal, money: true, best: true, color: T.brandDark, tip: 'Everything Funding Tier receives on this one deal if the client never cancels.' },
    { label: 'Expected, after cancellations', get: (s) => s.expectedTotal, money: true, best: true, color: T.brandDark, tip: 'The same deal weighted by the first-payment and monthly cancellation assumptions in Risk & Attrition.' },
    { label: 'Rep commission', get: (s) => s.repComm, money: true, color: C.rep, tip: 'Paid only if the deal is still active at payout. Level Debt uses the current company-wide volume tier.' },
    { label: 'Kept by Funding Tier, expected', get: (s) => s.expectedTotal - s.repExpected, money: true, best: true, total: true, tip: 'Expected revenue less the expected rep commission, before transfer, labor and tool costs.' },
    { label: 'Kept per $1,000 enrolled', get: (s) => (s.expectedTotal - s.repExpected) / Math.max(debt, 1) * 1000, money: true, best: true, tip: 'The line above divided by enrolled debt — the cleanest way to compare partners.' },
    { label: 'Main risk', get: (s) => s.mainRisk },
  ];

  return (
    <>
      {/* 1 · The money path */}
      <div style={{ fontSize: 12.5, color: T.body, lineHeight: 1.55, marginBottom: 10 }}>
        <strong style={{ color: T.ink }}>How to read this page.</strong> Funding Tier never bills the client. The client enrolls with a
        servicing partner and pays that partner; the partner pays Funding Tier a contracted cut for delivering the client. Every revenue
        number in this model is that cut. The three partners take it from different things, on different schedules.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <FlowStep n={1} title="Client enrolls" body="Funding Tier’s rep closes the call and the client signs with Level Debt, Consumer Shield or Elite Legal Practice." />
        <Arrow />
        <FlowStep n={2} title="Client pays the partner" body="Monthly program payments go to the partner — never to Funding Tier." />
        <Arrow />
        <FlowStep n={3} title="Partner pays Funding Tier" body="A one-time fee (Level Debt) or a share of every monthly payment (Shield, Elite Legal)." tone="ft" />
        <Arrow />
        <FlowStep n={4} title="Funding Tier pays the rep" body="Commission goes out only after the partner has paid — never before." tone="rep" />
      </div>

      {/* 2 · Same debt, three partners */}
      <div style={{ marginTop: 18, border: `1px solid ${T.brandLine}`, borderRadius: 12, padding: '12px 14px', background: G.panel }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ marginRight: 'auto' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.ink }}>Same client, every way we can be paid</div>
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>Enter one enrolled-debt amount and see what the identical deal pays at each partner — including a Consumer Shield file kept on the monthly perpetuity versus sold through the file buyout. This does not change the model.</div>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: T.body }}>
            Enrolled debt
            <span style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${T.brand}`, borderRadius: 8, background: '#fff', padding: '0 8px' }}>
              <span style={{ color: T.muted, fontFamily: T.mono }}>$</span>
              <input
                type="number" min={0} step={500} value={draft}
                onChange={(e) => { setDraft(e.target.value); const n = Number(e.target.value); if (Number.isFinite(n)) setDebt(Math.max(0, n)); }}
                onBlur={() => commit(Number(draft) || 0)}
                style={{ width: 90, border: 0, outline: 'none', padding: '7px 4px', fontFamily: T.mono, fontSize: 14, fontWeight: 800, color: T.ink, background: 'transparent' }}
              />
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
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880, tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ ...th, width: '18%' }} />
                {stories.map((s) => (
                  <th key={s.id} style={{ ...th, textAlign: 'left', borderTop: `3px ${s.id === 'CSBUY' ? 'dashed' : 'solid'} ${BRANDS[s.k].accent}` }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><PartnerMark k={s.k} size={15} />{BRANDS[s.k].name}</span>
                    {s.variant && <div style={{ fontSize: 9, color: s.oneTime ? T.warn : T.good, marginTop: 2 }}>{s.variant}</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const vals = stories.map((s) => (s.eligible ? r.get(s) : null));
                const nums = vals.filter((v): v is number => typeof v === 'number');
                const top = r.best && nums.length > 1 ? Math.max(...nums) : null;
                const border = r.total ? { borderTop: `2px solid ${T.ink}` } : {};
                return (
                  <tr key={r.label}>
                    <td style={{ ...td, fontSize: 11, color: r.total ? T.ink : T.muted, fontWeight: r.total ? 800 : 500, ...border }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>{r.label}{r.tip && <Info text={r.tip} />}</span>
                    </td>
                    {stories.map((s, i) => {
                      const v = vals[i];
                      if (v == null) {
                        return <td key={s.id} style={{ ...td, fontSize: 11, color: T.faint, fontStyle: 'italic', whiteSpace: 'normal', ...border }}>
                          {r === rows[0] ? `Not eligible — minimum ${fmtMoney(s.minDebt)} enrolled` : '—'}
                        </td>;
                      }
                      if (typeof v === 'number') {
                        const win = top != null && Math.abs(v - top) < 0.5;
                        return (
                          <td key={s.id} style={{ ...tdNum, textAlign: 'left', fontSize: r.total ? 14 : 12.5, fontWeight: 800, color: r.color ?? T.ink, background: win ? T.brandSoft : undefined, ...border }}>
                            {fmtMoney(v)}{win && <span style={{ fontSize: 9, fontWeight: 800, color: T.brandDark, marginLeft: 6, fontFamily: T.sans, letterSpacing: 0.4 }}>HIGHEST</span>}
                          </td>
                        );
                      }
                      return <td key={s.id} style={{ ...td, fontSize: 11.5, color: T.ink, verticalAlign: 'top', lineHeight: 1.4, whiteSpace: 'normal', wordBreak: 'normal', ...border }}>{v}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 4px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: T.muted, display: 'flex', alignItems: 'center', marginRight: 'auto' }}>
            Kept by Funding Tier per deal, from $4k to $50k enrolled
            <Info text="Each line is what Funding Tier keeps from one deal, after the rep’s commission, at every enrolled-debt amount. The dots are the amount entered above. Consumer Shield moves in steps because it pays by program band — the dashed line is the same file sold through the buyout. Level Debt and Elite Legal Practice rise with the debt." />
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: T.body, cursor: 'pointer' }}>
            <input type="checkbox" checked={showExpected} onChange={(e) => setShowExpected(e.target.checked)} />
            After cancellations (uncheck = client finishes)
          </label>
        </div>
        <DebtCurve inputs={inputs} debt={debt} expected={showExpected} levelMonthlyVolume={levelMonthlyVolume} />
        <div style={{ fontSize: 10.5, color: T.faint, marginTop: 4, lineHeight: 1.5 }}>
          Before transfer, labor and tool costs — those are in Cost Stack and the statements.
        </div>
      </div>

      {/* 3 · Consumer Shield bands */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PartnerMark k="CS" size={18} />
          <div style={{ fontSize: 13, fontWeight: 800, color: T.ink }}>How Consumer Shield prices a file: debt ranges, not exact amounts</div>
        </div>
        <div style={{ fontSize: 12, color: T.body, lineHeight: 1.55, margin: '6px 0 8px' }}>
          Consumer Shield does not charge a percentage of the client’s debt. It places the client in a <strong>program band</strong> by
          enrolled debt, and every client in that band pays the same monthly amount for the same term. Funding Tier’s share is taken from
          that payment, so <strong>a {fmtMoney(15000)} file and a {fmtMoney(19999)} file pay Funding Tier exactly the same</strong>; crossing
          into the next band is what raises it. The same band sets the <strong>file buyout</strong>: Consumer Shield pays {inputs.consumerShield.buyout.months} months of the net payment up front at {fmtPct(inputs.consumerShield.buyout.standardRate * 100, 0)}, or {fmtPct(inputs.consumerShield.buyout.highDebtRate * 100, 0)} on files of {fmtMoney(inputs.consumerShield.buyout.highDebtMinDebt)}+. Level Debt and Elite Legal Practice, by contrast, pay more for every dollar enrolled.
          The highlighted row is the amount entered above.
        </div>
        <ShieldBands inputs={inputs} debt={debt} />
        <div style={{ fontSize: 10.5, color: T.faint, marginTop: 5, lineHeight: 1.5 }}>
          FT per payment: {fmtPct(inputs.consumerShield.frontCaptureRate * 100, 0)} of (payment − {fmtMoney(inputs.consumerShield.servicingDeductionPerPayment)} servicing) for the first {inputs.consumerShield.frontMonths} months,
          then {fmtPct(inputs.consumerShield.backendCaptureRate * 100, 0)}. File buyout is the one-time alternative, paid once the first payment clears (see Shield Buyout).
        </div>
      </div>

      {/* 4 · Follow one deal */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '18px 0 10px' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, marginRight: 'auto' }}>Follow the {fmtMoney(debt)} deal through each partner</div>
        {(['ALL', ...COLS] as const).map((k) => (
          <button key={k} onClick={() => setFocus(k)} style={{
            padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: T.sans,
            border: `1px solid ${focus === k ? T.brand : T.line}`, background: focus === k ? T.brand : '#fff', color: focus === k ? '#fff' : T.body,
          }}>{k === 'ALL' ? 'All' : colName(k)}</button>
        ))}
      </div>
      {shown.map((s) => s.eligible
        ? <StoryCard key={s.id} s={s} showExpected={showExpected} />
        : (
          <div key={s.id} style={{ border: `1px dashed ${T.line}`, borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <PartnerName k={s.k} size={18} />
            <span style={{ fontSize: 12, color: T.muted }}>Not eligible at {fmtMoney(debt)} — this partner’s minimum is {fmtMoney(s.minDebt)} enrolled.</span>
          </div>
        ))}
    </>
  );
}

export default BackendExplainer;
