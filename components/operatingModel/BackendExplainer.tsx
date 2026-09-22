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

interface MonthPoint { m: number; full: number; expected: number }

interface DealStory {
  k: BackendKey;
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
      {s.k !== 'LEVEL' && marker(s.term + s.lag, 'Program ends', T.muted, 1)}
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
        <span style={{ fontSize: 11, color: T.muted }}>Example deal: <strong style={{ color: T.ink }}>{fmtMoney(s.debt)}</strong> enrolled debt (the model’s average for this partner)</span>
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
          sub={s.k === 'LEVEL' ? 'One payment' : `${paying} monthly payments`}
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
          sub={s.k === 'LEVEL' ? 'All of it, at once' : `Last payment month ${s.term + s.lag}`}
          tip="The month Funding Tier’s first dollar from this deal reaches the bank, counting the month the deal is signed as month 1." />
      </Row>
    </div>
  );
}

// ── Section ──────────────────────────────────────────────────────────────────

export function BackendExplainer({ inputs, levelMonthlyVolume }: { inputs: ModelInputs; levelMonthlyVolume: number }) {
  const [showExpected, setShowExpected] = useState(true);
  const [focus, setFocus] = useState<BackendKey | 'ALL'>('ALL');
  const stories = useMemo(
    () => BACKEND_KEYS.map((k) => buildStory(k, inputs, levelMonthlyVolume)),
    [inputs, levelMonthlyVolume],
  );
  const shown = focus === 'ALL' ? stories : stories.filter((s) => s.k === focus);

  const cell = (s: DealStory, v: React.ReactNode, strong?: boolean) => (
    <td key={s.k} style={{ ...td, fontSize: 11.5, fontWeight: strong ? 800 : 500, color: T.ink, verticalAlign: 'top' }}>{v}</td>
  );
  const money = (s: DealStory, v: number, color?: string) => (
    <td key={s.k} style={{ ...tdNum, fontSize: 12, fontWeight: 800, color: color ?? T.ink }}>{fmtMoney(v)}</td>
  );

  return (
    <>
      {/* 1 · The money path */}
      <div style={{ fontSize: 12.5, color: T.body, lineHeight: 1.55, marginBottom: 10 }}>
        <strong style={{ color: T.ink }}>How to read this page.</strong> Funding Tier never bills the client. The client enrolls with a
        servicing partner and pays that partner; the partner pays Funding Tier a contracted cut for delivering the client. Every revenue
        number in this model is that cut. The three partners take it from different things, on different schedules — which is why a
        deal is worth a different amount, and pays at a different time, at each one.
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

      {/* 2 · Side by side */}
      <div style={{ marginTop: 16, overflowX: 'auto' }}>
        <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: T.muted, marginBottom: 6, display: 'flex', alignItems: 'center' }}>
          One typical deal at each partner
          <Info text="Each column uses that partner’s average enrolled debt from Deal Volume, and the contract terms below. Change either and this table follows." />
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr>
              <th style={{ ...th, width: '22%' }} />
              {stories.map((s) => (
                <th key={s.k} style={{ ...th, textAlign: 'left' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><PartnerMark k={s.k} size={15} />{BRANDS[s.k].name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr><td style={{ ...td, color: T.muted, fontSize: 11 }}>Enrolled debt</td>{stories.map((s) => money(s, s.debt))}</tr>
            <tr><td style={{ ...td, color: T.muted, fontSize: 11 }}>We get a portion of</td>{stories.map((s) => cell(s,
              s.k === 'LEVEL' ? `The enrolled debt (${fmtPct(inputs.levelDebt.revenueSharePct * 100, 0)})`
                : s.k === 'CS' ? 'Each monthly program payment'
                : 'Each monthly fee draft'))}</tr>
            <tr><td style={{ ...td, color: T.muted, fontSize: 11 }}>Paid as</td>{stories.map((s) => cell(s,
              s.k === 'LEVEL' ? 'One lump sum' : `Monthly, up to ${s.term} months`))}</tr>
            <tr><td style={{ ...td, color: T.muted, fontSize: 11 }}>First cash arrives</td>{stories.map((s) => cell(s, `Month ${s.firstCashMonth}`))}</tr>
            <tr><td style={{ ...td, color: T.muted, fontSize: 11 }}>If the client finishes</td>{stories.map((s) => money(s, s.fullTotal, T.brandDark))}</tr>
            <tr><td style={{ ...td, color: T.muted, fontSize: 11 }}>Expected, after cancellations</td>{stories.map((s) => money(s, s.expectedTotal, T.brandDark))}</tr>
            <tr><td style={{ ...td, color: T.muted, fontSize: 11 }}>Rep commission (expected)</td>{stories.map((s) => money(s, -s.repExpected, C.rep))}</tr>
            <tr>
              <td style={{ ...td, color: T.ink, fontSize: 11, fontWeight: 800, borderTop: `2px solid ${T.ink}` }}>Kept by Funding Tier, expected</td>
              {stories.map((s) => (
                <td key={s.k} style={{ ...tdNum, fontSize: 13, fontWeight: 800, borderTop: `2px solid ${T.ink}` }}>{fmtMoney(s.expectedTotal - s.repExpected)}</td>
              ))}
            </tr>
            <tr><td style={{ ...td, color: T.muted, fontSize: 11 }}>Main risk</td>{stories.map((s) => cell(s,
              s.k === 'LEVEL' ? 'Chargeback if the client cancels before payment 2' : 'Client cancels and the monthly share stops'))}</tr>
          </tbody>
        </table>
        <div style={{ fontSize: 10.5, color: T.faint, marginTop: 5, lineHeight: 1.5 }}>
          Before transfer, labor and tool costs — those are in Cost Stack and the statements. “Expected” uses the first-payment and
          monthly cancellation assumptions in Risk &amp; Attrition, per enrolled deal.
        </div>
      </div>

      {/* 3 · Follow one deal */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '18px 0 10px' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, marginRight: 'auto' }}>Follow one deal through each partner</div>
        {(['ALL', ...BACKEND_KEYS] as const).map((k) => (
          <button key={k} onClick={() => setFocus(k)} style={{
            padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: T.sans,
            border: `1px solid ${focus === k ? T.brand : T.line}`, background: focus === k ? T.brand : '#fff', color: focus === k ? '#fff' : T.body,
          }}>{k === 'ALL' ? 'All three' : BRANDS[k].name}</button>
        ))}
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: T.body, cursor: 'pointer', marginLeft: 6 }}>
          <input type="checkbox" checked={showExpected} onChange={(e) => setShowExpected(e.target.checked)} />
          Show expected after cancellations
        </label>
      </div>
      {shown.map((s) => <StoryCard key={s.k} s={s} showExpected={showExpected} />)}
    </>
  );
}

export default BackendExplainer;
