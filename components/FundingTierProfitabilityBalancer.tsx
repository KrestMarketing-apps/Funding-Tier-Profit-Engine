"use client";

import React, { useMemo, useState } from "react";

type TimelineRow = {
  month: number;
  phase: "Front" | "Tail-End Revenue";
  monthlyRevenue: number;
  cumulativeRevenue: number;
  liabilityFreeMonth: number;
  payoutHitMonthAssumed: number;
};

type ConsumerShieldProgram = {
  label: string;
  debtRange: string;
  minDebt: number;
  maxDebt: number;
  payment: number;
  term: number;
};

type DealMetrics = {
  debtAmount: number;
  levelDebtRevenue: number;
  levelDebtRevShareEligible: boolean;
  consumerShieldPayment: number | null;
  consumerShieldTerm: number | null;
  consumerShieldNetPayment: number | null;
  consumerShieldRevenueAfter1: number | null;
  consumerShieldRevenueAfter2: number | null;
  consumerShieldRevenueAfter4: number | null;
  consumerShieldFrontRevenue: number | null;
  consumerShieldBackRevenueMonthly: number | null;
  consumerShieldBackRevenueFull: number | null;
  consumerShieldRevenueAtQuarter: number | null;
  consumerShieldRevenueAtHalf: number | null;
  consumerShieldRevenueAtFull: number | null;
  consumerShieldExpectedRevenue: number | null;
  consumerShieldBreakEvenMonthVsLevel: number | null;
  consumerShieldLiabilityClearMonth: number | null;
  consumerShieldTimeline: TimelineRow[];
  recommendedBackend: "Level Debt" | "Consumer Shield" | "Consumer Shield (Guaranteed)" | "No Recommendation";
  recommendationReason: string;
};

const FT_LOGO         = "https://assets.cdn.filesafe.space/S4ztIlDxBovAboldwbOR/media/68783cf82035bab4d790ae7e.png";
const LEVEL_DEBT_LOGO = "https://assets.cdn.filesafe.space/S4ztIlDxBovAboldwbOR/media/69c35b2cab2203b0fc83186d.webp";
const CS_LOGO         = "https://assets.cdn.filesafe.space/S4ztIlDxBovAboldwbOR/media/69c35b2c25c6995d2d2d21fa.png";

const FT_GREEN      = "#0f9d8a";
const FT_GREEN_DARK = "#0b7d6e";
const FT_HYPER      = "#00ff88";
const FT_BLUE       = "#1a6ed8";
const FT_AMBER      = "#f59e0b";
const FT_BG         = "#f8fafc";

const money      = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const percentFmt = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });

const consumerShieldPrograms: ConsumerShieldProgram[] = [
  { label: "CS Program A", debtRange: "$4,000 – $4,999",   minDebt: 4000,  maxDebt: 4999.99,             payment: 220, term: 18 },
  { label: "CS Program B", debtRange: "$5,000 – $8,799",   minDebt: 5000,  maxDebt: 8799.99,             payment: 220, term: 24 },
  { label: "CS Program C", debtRange: "$8,800 – $9,999",   minDebt: 8800,  maxDebt: 9999.99,             payment: 220, term: 36 },
  { label: "CS Program D", debtRange: "$10,000 – $14,999", minDebt: 10000, maxDebt: 14999.99,            payment: 270, term: 36 },
  { label: "CS Program E", debtRange: "$15,000 – $19,999", minDebt: 15000, maxDebt: 19999.99,            payment: 320, term: 36 },
  { label: "CS Program F", debtRange: "$20,000 – $24,999", minDebt: 20000, maxDebt: 24999.99,            payment: 370, term: 36 },
  { label: "CS Program G", debtRange: "$25,000 – $29,999", minDebt: 25000, maxDebt: 29999.99,            payment: 420, term: 36 },
  { label: "CS Program H", debtRange: "$30,000 – $49,999", minDebt: 30000, maxDebt: 49999.99,            payment: 520, term: 36 },
  { label: "CS Program I", debtRange: "$50,000+",          minDebt: 50000, maxDebt: Number.POSITIVE_INFINITY, payment: 620, term: 36 },
];

function round2(v: number) { return Math.round(v * 100) / 100; }
function clamp(v: number, lo: number, hi: number) { return Math.min(Math.max(v, lo), hi); }

function getProgram(debt: number) {
  if (debt < 4000) return null;
  return consumerShieldPrograms.find(p => debt >= p.minDebt && debt <= p.maxDebt) ?? null;
}

function csRevenueAt(month: number, net: number, term: number) {
  if (month <= 0) return 0;
  const m = Math.min(month, term);
  return round2(Math.min(m, 4) * net + Math.max(0, m - 4) * net * 0.35);
}

function buildTimeline(net: number, term: number): TimelineRow[] {
  return Array.from({ length: term }, (_, i) => {
    const month = i + 1;
    return {
      month,
      phase: (month <= 4 ? "Front" : "Tail-End Revenue") as TimelineRow["phase"],
      monthlyRevenue: round2(month <= 4 ? net : net * 0.35),
      cumulativeRevenue: csRevenueAt(month, net, term),
      liabilityFreeMonth: month + 4,
      payoutHitMonthAssumed: month + 1,
    };
  });
}

function calcBreakEven(ldRev: number, net: number, term: number) {
  for (let m = 1; m <= term; m++) if (csRevenueAt(m, net, term) >= ldRev) return m;
  return null;
}

function fractionRevenue(frac: number, net: number, term: number) {
  return csRevenueAt(Math.max(1, Math.floor(term * frac)), net, term);
}

function calculateDealMetrics(args: {
  debtAmount: number; survive2Rate: number; survive4Rate: number;
  surviveBreakEvenRate: number; completeRate: number;
  leadQualityScore: number; cashUrgencyScore: number;
}): DealMetrics {
  const { debtAmount, survive2Rate, survive4Rate, surviveBreakEvenRate,
          completeRate, leadQualityScore, cashUrgencyScore } = args;

  const ldRev = round2(debtAmount * 0.08);
  const prog  = getProgram(debtAmount);

  const empty: DealMetrics = {
    debtAmount, levelDebtRevenue: ldRev, levelDebtRevShareEligible: debtAmount >= 120000,
    consumerShieldPayment: null, consumerShieldTerm: null, consumerShieldNetPayment: null,
    consumerShieldRevenueAfter1: null, consumerShieldRevenueAfter2: null, consumerShieldRevenueAfter4: null,
    consumerShieldFrontRevenue: null, consumerShieldBackRevenueMonthly: null, consumerShieldBackRevenueFull: null,
    consumerShieldRevenueAtQuarter: null, consumerShieldRevenueAtHalf: null, consumerShieldRevenueAtFull: null,
    consumerShieldExpectedRevenue: null, consumerShieldBreakEvenMonthVsLevel: null,
    consumerShieldLiabilityClearMonth: null,
    consumerShieldTimeline: [],
    recommendedBackend: "No Recommendation",
    recommendationReason: "Debt amount falls outside the configured Consumer Shield range.",
  };

  if (!prog) return empty;

  const { payment, term } = prog;
  const net   = payment - 40;
  const tl    = buildTimeline(net, term);
  const rev1  = csRevenueAt(1, net, term);
  const rev2  = csRevenueAt(2, net, term);
  const rev4  = csRevenueAt(4, net, term);
  const front = round2(net * Math.min(4, term));
  const tailM = round2(net * 0.35);
  const tailF = round2(Math.max(0, term - 4) * tailM);
  const fullR = round2(front + tailF);
  const be    = calcBreakEven(ldRev, net, term);
  const revBE = csRevenueAt(be ?? term, net, term);
  const liabilityClearMonth = be !== null ? be + 4 : null;

  const expected = round2(
    survive2Rate * rev2
    + survive4Rate * Math.max(0, rev4 - rev2)
    + surviveBreakEvenRate * Math.max(0, revBE - rev4)
    + completeRate * Math.max(0, fullR - revBE)
  );

  let recommendedBackend: DealMetrics["recommendedBackend"] = "No Recommendation";
  let recommendationReason = "";

  if (debtAmount >= 4000 && debtAmount <= 7000) {
    recommendedBackend = "Consumer Shield (Guaranteed)";
    recommendationReason = "This debt amount falls inside your guaranteed Consumer Shield routing band ($4k–$7k).";
  } else {
    const q = leadQualityScore / 100, u = cashUrgencyScore / 100;
    const ldScore = ldRev * (1 + u * 0.35) * (1.05 - q * 0.1);
    const csScore = expected * (0.8 + q * 0.45) * (1 - u * 0.2);
    if (csScore > ldScore) {
      recommendedBackend = "Consumer Shield";
      recommendationReason = "Consumer Shield wins on adjusted expected value after accounting for lead quality and your risk assumptions.";
    } else {
      recommendedBackend = "Level Debt";
      recommendationReason = "Level Debt wins — faster, more certain revenue recognition beats the slower Consumer Shield payout curve given current assumptions.";
    }
  }

  return {
    debtAmount, levelDebtRevenue: ldRev, levelDebtRevShareEligible: debtAmount >= 120000,
    consumerShieldPayment: payment, consumerShieldTerm: term, consumerShieldNetPayment: net,
    consumerShieldRevenueAfter1: rev1, consumerShieldRevenueAfter2: rev2, consumerShieldRevenueAfter4: rev4,
    consumerShieldFrontRevenue: front, consumerShieldBackRevenueMonthly: tailM,
    consumerShieldBackRevenueFull: tailF,
    consumerShieldRevenueAtQuarter: fractionRevenue(0.25, net, term),
    consumerShieldRevenueAtHalf:    fractionRevenue(0.5,  net, term),
    consumerShieldRevenueAtFull:    fullR,
    consumerShieldExpectedRevenue:  expected,
    consumerShieldBreakEvenMonthVsLevel: be,
    consumerShieldLiabilityClearMonth: liabilityClearMonth,
    consumerShieldTimeline: tl,
    recommendedBackend, recommendationReason,
  };
}

const card: React.CSSProperties = {
  background: "#fff", border: "1px solid #e2e8f0",
  borderRadius: 16, padding: 16, boxShadow: "0 3px 12px rgba(15,23,42,0.05)",
};

const TH_BASE: React.CSSProperties = {
  padding: "10px 13px", borderBottom: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0",
  color: FT_GREEN, fontWeight: 800, whiteSpace: "nowrap", fontSize: 12, textAlign: "left",
};

const TD_BASE: React.CSSProperties = {
  padding: "10px 13px", borderBottom: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0",
  color: "#0f172a", fontSize: 13, textAlign: "left",
};

function Accordion({ title, defaultOpen = false, children, badge }: {
  title: string; defaultOpen?: boolean; children: React.ReactNode; badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", textAlign: "left", background: "#fff", border: "none",
        padding: "13px 18px", cursor: "pointer",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>{title}</span>
          {badge && (
            <span style={{ fontSize: 11, fontWeight: 700, background: FT_GREEN + "22",
              color: FT_GREEN_DARK, padding: "2px 8px", borderRadius: 99 }}>{badge}</span>
          )}
        </div>
        <span style={{ fontSize: 20, fontWeight: 900, color: FT_GREEN }}>{open ? "−" : "+"}</span>
      </button>
      {open && <div style={{ borderTop: "1px solid #e2e8f0", padding: 18 }}>{children}</div>}
    </div>
  );
}

function MetricCard({ title, value, subtitle, tooltip, inlineTag }: {
  title: string; value: string; subtitle?: string; tooltip?: string; inlineTag?: string;
}) {
  const [showTip, setShowTip] = useState(false);
  return (
    <div style={{ ...card, position: "relative" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 7,
        textTransform: "uppercase", letterSpacing: 0.4,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {title}
          {tooltip && (
            <span
              onMouseEnter={() => setShowTip(true)}
              onMouseLeave={() => setShowTip(false)}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 14, height: 14, borderRadius: "50%", background: FT_GREEN,
                color: "#fff", fontSize: 9, fontWeight: 900, cursor: "help", flexShrink: 0 }}>?</span>
          )}
        </span>
        {inlineTag && (
          <span style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8",
            fontStyle: "italic", textTransform: "none", whiteSpace: "nowrap" }}>{inlineTag}</span>
        )}
      </div>
      {showTip && tooltip && (
        <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 100,
          background: "#0f172a", color: "#fff", borderRadius: 10,
          padding: "10px 13px", fontSize: 12, lineHeight: 1.6,
          width: 260, boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          marginTop: 4, pointerEvents: "none" }}>{tooltip}</div>
      )}
      <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", lineHeight: 1.1, wordBreak: "break-word" }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 7, lineHeight: 1.5 }}>{subtitle}</div>
      )}
    </div>
  );
}

function CSRevenueMilestonesTimeline({ timeline, breakEvenMonth, liabilityClearMonth, levelDebtRevenue, debtAmount }: {
  timeline: TimelineRow[]; breakEvenMonth: number | null; liabilityClearMonth: number | null;
  levelDebtRevenue: number; debtAmount: number;
}) {
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);
  const [showTooltip,  setShowTooltip]  = useState(false);

  if (!timeline.length) return (
    <div style={{ color: "#94a3b8", fontSize: 13 }}>Enter a valid debt amount to see the timeline.</div>
  );

  const W = 740, H = 130, PL = 22, PR = 22, dotY = 54;
  const term   = timeline.length;
  const getX   = (i: number) => PL + (i / Math.max(term - 1, 1)) * (W - PL - PR);
  const hovered = hoveredMonth !== null ? timeline[hoveredMonth - 1] : null;
  const hovX    = hoveredMonth !== null ? getX(hoveredMonth - 1) : 0;

  const labels: Record<number, { text: string; color: string }> = {};
  labels[1] = { text: "Mo 1", color: FT_GREEN };
  labels[4] = { text: "Mo 4", color: FT_GREEN };
  if (breakEvenMonth) labels[breakEvenMonth] = { text: `Mo ${breakEvenMonth}`, color: FT_AMBER };
  if (liabilityClearMonth && liabilityClearMonth <= term) labels[liabilityClearMonth] = { text: `Mo ${liabilityClearMonth}`, color: FT_HYPER };
  labels[term] = { text: `Mo ${term}`, color: FT_GREEN_DARK };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: "#64748b" }}>
          Figures based on <strong>{money.format(debtAmount)}</strong> enrolled debt — comparing Level Debt ({money.format(levelDebtRevenue)} at 8%) to the Consumer Shield program snapshot.
        </span>
        <span onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 16, height: 16, borderRadius: "50%", background: FT_GREEN,
            color: "#fff", fontSize: 10, fontWeight: 900, cursor: "help", flexShrink: 0, position: "relative" }}>
          ?
          {showTooltip && (
            <div style={{ position: "absolute", bottom: "120%", left: "50%", transform: "translateX(-50%)",
              background: "#0f172a", color: "#fff", borderRadius: 10,
              padding: "10px 13px", fontSize: 12, lineHeight: 1.6,
              width: 300, boxShadow: "0 8px 24px rgba(0,0,0,0.25)", zIndex: 200, pointerEvents: "none" }}>
              All revenue milestone figures are calculated from the Enrolled Debt amount entered in the Risk Assumptions header.
              The timeline compares Level Debt (8% = {money.format(levelDebtRevenue)} after 2 payments) to the Consumer Shield
              program assigned to {money.format(debtAmount)} enrolled debt. Adjust the Enrolled Debt input to see how milestones shift.
            </div>
          )}
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <svg width={W} height={H} style={{ minWidth: W, display: "block" }}
          onMouseLeave={() => setHoveredMonth(null)}>
          <line x1={PL} y1={dotY} x2={W - PR} y2={dotY} stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
          {timeline.map((row, i) => {
            if (i === 0) return null;
            const x1  = getX(i - 1), x2 = getX(i);
            const col = row.month === liabilityClearMonth ? FT_HYPER
                      : row.month <= (breakEvenMonth ?? 0) ? FT_AMBER
                      : row.phase === "Front" ? FT_GREEN : FT_BLUE;
            return <line key={i} x1={x1} y1={dotY} x2={x2} y2={dotY} stroke={col} strokeWidth="4" strokeLinecap="round" />;
          })}
          {timeline.map((row, i) => {
            const x      = getX(i);
            const isHov  = hoveredMonth === row.month;
            const isLbl  = !!labels[row.month];
            const isBE   = row.month === breakEvenMonth;
            const isLC   = row.month === liabilityClearMonth;
            const isLast = row.month === term;
            const dotCol = isLC ? FT_HYPER : isBE ? FT_AMBER : isLast ? FT_GREEN_DARK
                         : row.phase === "Front" ? FT_GREEN : FT_BLUE;
            return (
              <g key={row.month}>
                <circle cx={x} cy={dotY} r={12} fill="transparent" style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredMonth(row.month)} />
                <circle cx={x} cy={dotY} r={isHov ? 9 : isLbl ? 6 : 3.5}
                  fill={dotCol} stroke={isLC || isHov ? "#fff" : "none"} strokeWidth={isLC ? 2.5 : 2}
                  style={{ pointerEvents: "none", transition: "r 0.1s" }} />
                {isLC && <circle cx={x} cy={dotY} r={isHov ? 14 : 10}
                  fill="none" stroke={FT_HYPER} strokeWidth="2" opacity="0.4" style={{ pointerEvents: "none" }} />}
                {isLbl && <text x={x} y={dotY + 20} textAnchor="middle" fontSize="10"
                  fill={labels[row.month].color} fontWeight="800">{labels[row.month].text}</text>}
                {isLast && <text x={x} y={dotY - 14} textAnchor="middle" fontSize="11"
                  fill={FT_GREEN_DARK} fontWeight="900">{money.format(row.cumulativeRevenue)}</text>}
                {isBE && !isLast && <text x={x} y={dotY - 14} textAnchor="middle" fontSize="10"
                  fill={FT_AMBER} fontWeight="800">{money.format(row.cumulativeRevenue)}</text>}
                {isLC && !isBE && !isLast && <text x={x} y={dotY - 14} textAnchor="middle" fontSize="10"
                  fill={FT_HYPER} fontWeight="900">{money.format(row.cumulativeRevenue)}</text>}
              </g>
            );
          })}
          {hovered && (() => {
            const tx = Math.min(Math.max(hovX, 68), W - 68);
            const ty = dotY - 62;
            return (
              <g style={{ pointerEvents: "none" }}>
                <rect x={tx - 62} y={ty} width={124} height={48} rx="8" fill="#0f172a" opacity="0.93" />
                <text x={tx} y={ty + 15} textAnchor="middle" fontSize="10" fill="#94a3b8" fontWeight="700">
                  MONTH {hovered.month} · {hovered.phase.toUpperCase()}
                </text>
                <text x={tx} y={ty + 36} textAnchor="middle" fontSize="14" fill="#fff" fontWeight="800">
                  {money.format(hovered.cumulativeRevenue)}
                </text>
              </g>
            );
          })()}
        </svg>

        <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 11, color: "#64748b", flexWrap: "wrap" }}>
          <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: FT_GREEN, marginRight: 4, verticalAlign: "middle" }} />Front (Mo 1–4): 100% net</span>
          <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: FT_BLUE, marginRight: 4, verticalAlign: "middle" }} />Tail-End (Mo 5+): 35% net</span>
          {breakEvenMonth && (
            <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: FT_AMBER, marginRight: 4, verticalAlign: "middle" }} />
              Consumer Shield Revenue Breaks Even After Month {breakEvenMonth} Payment vs Level Debt After Month 2 Payment
            </span>
          )}
          {liabilityClearMonth && liabilityClearMonth <= timeline.length && (
            <span style={{ color: FT_HYPER, fontWeight: 800 }}>
              <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: FT_HYPER, marginRight: 4, verticalAlign: "middle", boxShadow: `0 0 6px ${FT_HYPER}` }} />
              Break-Even + Fully Liability-Clear (Mo {liabilityClearMonth})
            </span>
          )}
          <span style={{ color: FT_GREEN_DARK, fontWeight: 700 }}>↑ Hover any dot to see cumulative revenue</span>
        </div>
      </div>
    </div>
  );
}

function PayoutLiabilityAccordion() {
  const rows = [
    { event: "Expected Funds Hit Bank", ld: "Month 3 (20th of month)", cs: "Month +1 per payment",
      detail: "LD: Payment 1 = Jan 1, Payment 2 = Feb 1 → payout March 20. CS: each payment hits your bank ~1 month after processing." },
    { event: "Chargeback Liability Free", ld: "After Payment 2", cs: "Each payment: Payment Month +4",
      detail: "LD: zero liability after 2 cleared payments. CS: each payment has its own 4-month window — they do not clear together." },
    { event: "ACH Return Window", ld: "~60 days (Nacha)", cs: "~60 days per payment (Nacha)",
      detail: "Funding Tier models 4 months as a conservative internal buffer. Real Nacha consumer unauthorized return window is ~60 calendar days. After that closes per payment, risk is generally eliminated." },
  ];
  return (
    <Accordion title="Payout + Liability Timing — Level Debt vs Consumer Shield">
      <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #e2e8f0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Timing Event", "Level Debt", "Consumer Shield", "Notes"].map(h => (
                <th key={h} style={TH_BASE}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 ? "#f8fafc" : "#fff" }}>
                <td style={{ ...TD_BASE, fontWeight: 700 }}>{row.event}</td>
                <td style={{ ...TD_BASE, color: FT_GREEN_DARK, fontWeight: 700 }}>{row.ld}</td>
                <td style={{ ...TD_BASE, color: FT_BLUE, fontWeight: 700 }}>{row.cs}</td>
                <td style={{ ...TD_BASE, color: "#64748b", lineHeight: 1.6 }}>{row.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Accordion>
  );
}

function ProgramChart({ program }: { program: ConsumerShieldProgram }) {
  const [hov, setHov] = useState<{ month: number; rev: number; x: number; y: number } | null>(null);
  const net    = program.payment - 40;
  const pts    = Array.from({ length: program.term }, (_, i) => ({ month: i + 1, y: csRevenueAt(i + 1, net, program.term) }));
  const maxY   = Math.max(...pts.map(p => p.y), 1);
  const W = 700, H = 240, PL = 90, PB = 40, PT = 22, PR = 24;
  const gx     = (i: number) => PL + (i / Math.max(pts.length - 1, 1)) * (W - PL - PR);
  const gy     = (v: number) => H - PB - (v / maxY) * (H - PT - PB);
  const coords = pts.map((p, i) => `${gx(i)},${gy(p.y)}`).join(" ");
  const notable = new Set([1, 4, program.term]);

  return (
    <div style={{ overflowX: "auto", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, padding: "12px 10px 8px" }}>
      <svg width={W} height={H} style={{ minWidth: W, display: "block" }} onMouseLeave={() => setHov(null)}>
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const yv = H - PB - t * (H - PT - PB);
          return (
            <g key={i}>
              <line x1={PL} y1={yv} x2={W - PR} y2={yv} stroke={t === 0 ? "#94a3b8" : "#e2e8f0"} strokeWidth={t === 0 ? 1.5 : 1} />
              <text x={PL - 8} y={yv + 4} fontSize="11" fill={FT_GREEN} textAnchor="end" fontWeight="600">{money.format(maxY * t)}</text>
            </g>
          );
        })}
        <text x={16} y={H / 2} textAnchor="middle" fontSize="11" fill={FT_GREEN} fontWeight="700"
          transform={`rotate(-90, 16, ${H / 2})`}>Revenue Earned</text>
        <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="#94a3b8" strokeWidth="1.5" />
        <text x={PL + (W - PL - PR) / 2} y={H - 6} textAnchor="middle" fontSize="11" fill={FT_GREEN} fontWeight="700">Program Length (Months)</text>
        <polyline fill={FT_GREEN + "18"} stroke="none" points={`${gx(0)},${H - PB} ${coords} ${gx(pts.length - 1)},${H - PB}`} />
        <polyline fill="none" stroke={FT_GREEN} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={coords} />
        {pts.map((p, i) => {
          const x = gx(i), y = gy(p.y);
          const isHov = hov?.month === p.month;
          const isN   = notable.has(p.month);
          return (
            <g key={p.month}>
              <circle cx={x} cy={y} r={11} fill="transparent" style={{ cursor: "pointer" }}
                onMouseEnter={() => setHov({ month: p.month, rev: p.y, x, y })} />
              <circle cx={x} cy={y} r={isHov ? 8 : isN ? 5.5 : 3.5}
                fill={isHov || isN ? FT_GREEN_DARK : FT_GREEN}
                stroke={isHov ? "#fff" : "none"} strokeWidth="2" style={{ pointerEvents: "none" }} />
              {isN && <text x={x} y={H - PB + 16} textAnchor="middle" fontSize="10" fill={FT_GREEN} fontWeight="700">{p.month}</text>}
              {p.month === program.term && (
                <text x={x} y={y - 14} textAnchor="middle" fontSize="11" fill={FT_GREEN_DARK} fontWeight="900">{money.format(p.y)}</text>
              )}
            </g>
          );
        })}
        {hov && (() => {
          const tx = Math.min(Math.max(hov.x, 68), W - 68);
          const ty = Math.max(hov.y - 56, 4);
          return (
            <g style={{ pointerEvents: "none" }}>
              <rect x={tx - 60} y={ty} width={120} height={46} rx="8" fill="#0f172a" opacity="0.92" />
              <text x={tx} y={ty + 15} textAnchor="middle" fontSize="10" fill="#94a3b8" fontWeight="700">MONTH {hov.month} CUMULATIVE</text>
              <text x={tx} y={ty + 35} textAnchor="middle" fontSize="14" fill="#fff" fontWeight="800">{money.format(hov.rev)}</text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

function ProgramAccordion({ program, open, onToggle }: {
  program: ConsumerShieldProgram; open: boolean; onToggle: () => void;
}) {
  const net     = program.payment - 40;
  const front   = round2(net * Math.min(4, program.term));
  const tail    = round2(net * 0.35);
  const fullRev = round2(front + Math.max(0, program.term - 4) * tail);

  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
      <button onClick={onToggle} style={{ width: "100%", textAlign: "left", background: "#fff", border: "none", padding: "11px 16px", cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            <span style={{ fontWeight: 800, color: "#0f172a", fontSize: 14, width: 120, flexShrink: 0 }}>{program.label}</span>
            <span style={{ fontSize: 12, color: "#64748b", width: 170, flexShrink: 0 }}>{program.debtRange}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: FT_BLUE, width: 130, flexShrink: 0 }}>Net: {money.format(net)}/mo</span>
            <span style={{ fontSize: 12, color: "#64748b", width: 120, flexShrink: 0 }}>{program.term} mo · {money.format(program.payment)}/mo</span>
          </div>
          <span style={{ fontSize: 20, fontWeight: 900, color: FT_GREEN, flexShrink: 0, paddingLeft: 8 }}>{open ? "−" : "+"}</span>
        </div>
      </button>
      {open && (
        <div style={{ borderTop: "1px solid #e2e8f0", padding: 16 }}>
          <div style={{ overflowX: "auto", borderRadius: 11, border: "1px solid #e2e8f0", marginBottom: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ ...TH_BASE, textAlign: "center" }}>Front Revenue <span style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8" }}>Months 1–4</span></th>
                  <th style={{ ...TH_BASE, textAlign: "center" }}>Tail End – Revenue <span style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8" }}>Per month 5+</span></th>
                  <th style={{ ...TH_BASE, textAlign: "center", borderRight: "none" }}>Full Revenue <span style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8" }}>If full term</span></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...TD_BASE, textAlign: "center", fontSize: 20, fontWeight: 800, color: FT_GREEN }}>{money.format(front)}</td>
                  <td style={{ ...TD_BASE, textAlign: "center", fontSize: 20, fontWeight: 800, color: FT_BLUE }}>{money.format(tail)}<span style={{ fontSize: 11, color: "#94a3b8" }}>/mo</span></td>
                  <td style={{ ...TD_BASE, textAlign: "center", fontSize: 20, fontWeight: 800, color: FT_GREEN_DARK, borderRight: "none" }}>{money.format(fullRev)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ProgramChart program={program} />
        </div>
      )}
    </div>
  );
}

function KnowledgeBase({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", right: 20, bottom: 88, width: 430,
      maxWidth: "calc(100vw - 24px)", maxHeight: "72vh", zIndex: 999, background: "#fff",
      border: "1px solid #dbeafe", borderRadius: 18,
      boxShadow: "0 20px 40px rgba(15,23,42,0.22)", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "#fff",
        borderBottom: "1px solid #e2e8f0", borderRadius: "18px 18px 0 0",
        padding: "13px 16px 11px", display: "flex",
        justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>Legend / Knowledge Base</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>How every number is calculated.</div>
        </div>
        <button onClick={onClose} style={{ border: "none", background: "#f1f5f9", borderRadius: 10,
          width: 34, height: 34, cursor: "pointer", fontWeight: 900, fontSize: 18, color: "#334155",
          flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
      </div>
      <div style={{ overflowY: "auto", padding: "13px 16px 20px", display: "grid", gap: 13 }}>
        {[
          ["Risk Assumptions", "Sliders are operating assumptions — not deal facts. They represent your estimated probability of a client surviving to payment 2, payment 4, break-even month, and full completion."],
          ["Level Debt — Apply This Rule", "Revenue = 8% of enrolled debt. After 2 cleared payments, Funding Tier is free and clear of chargeback liability.\n\nPayout example: Payment 1 = Jan 1, Payment 2 = Feb 1 → funds hit your bank March 20 (Month 3)."],
          ["Consumer Shield", "Net payment = program payment − $40 servicing.\nMonths 1–4: keep 100% of net payment.\nMonth 5+: keep 35% of net payment (tail-end).\n\nWorst-case rule: each payment is chargeback-clear only 4 months after that specific ACH processed. This is Funding Tier's internal conservative standard — not a universal bank rule."],
          ["Expected Revenue", "Built from staged survival: payment 2 rate × rev2, plus incremental gains at payment 4, break-even, and full completion."],
          ["Break-Even Month", "The month CS cumulative revenue finally catches Level Debt's 8%. Until that month, LD has already been paid and CS has not."],
          ["Break-Even + Liability Clear (Hyper Green)", "This milestone marks the month where CS has both (a) broken even vs Level Debt AND (b) the chargeback window on the break-even payment has closed (break-even month + 4). This is the first point where CS has fully matched LD economically with zero residual bank liability on the break-even payment."],
          ["ACH Chargeback Windows", "The 4-month model is Funding Tier's conservative internal buffer. Nacha's consumer unauthorized return window is ~60 calendar days. Once that closes per payment, risk is generally eliminated."],
          ["CS Full-Upside Reference", "What CS pays if every deal completes the full term. A ceiling — not a forecast."],
        ].map(([title, body], i) => (
          <div key={i}>
            <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 13 }}>{title}</div>
            <p style={{ margin: "5px 0 0", fontSize: 13, color: "#475569", lineHeight: 1.7, whiteSpace: "pre-line" }}>{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Slider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <input type="range" min={0} max={100} step={1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: FT_GREEN }} />
      <div style={{ fontSize: 11, fontWeight: 700, color: "#e2e8f0", marginTop: 2 }}>{value}%</div>
    </div>
  );
}

export default function FundingTierProfitabilityBalancer() {
  const [debtAmount,           setDebtAmount]           = useState(20000);
  const [survive2Pct,          setSurvive2Pct]          = useState(75);
  const [survive4Pct,          setSurvive4Pct]          = useState(60);
  const [surviveBreakEvenPct,  setSurviveBreakEvenPct]  = useState(40);
  const [completePct,          setCompletePct]          = useState(25);
  const [leadQualityScore,     setLeadQualityScore]     = useState(75);
  const [cashUrgencyScore,     setCashUrgencyScore]     = useState(60);
  const [levelRepPct,          setLevelRepPct]          = useState(1.25);
  const [csRepUpfront,         setCsRepUpfront]         = useState(200);
  const [csRepAfter4,          setCsRepAfter4]          = useState(75);
  const [portfolioDeals,       setPortfolioDeals]       = useState(100);
  const [portfolioAvgDebt,     setPortfolioAvgDebt]     = useState(18000);
  const [portfolioLevelMixPct, setPortfolioLevelMixPct] = useState(70);
  const [kbOpen,               setKbOpen]               = useState(false);
  const [openProgram,          setOpenProgram]          = useState<string | null>("CS Program A");

  const s2  = clamp(survive2Pct / 100, 0, 1);
  const s4  = clamp(survive4Pct / 100, 0, 1);
  const sBE = clamp(surviveBreakEvenPct / 100, 0, 1);
  const sC  = clamp(completePct / 100, 0, 1);

  const deal = useMemo(() => calculateDealMetrics({
    debtAmount, survive2Rate: s2, survive4Rate: s4,
    surviveBreakEvenRate: sBE, completeRate: sC, leadQualityScore, cashUrgencyScore,
  }), [debtAmount, s2, s4, sBE, sC, leadQualityScore, cashUrgencyScore]);

  const repEcon = useMemo(() => {
    const ldCost = round2(debtAmount * (levelRepPct / 100));
    const csCost = round2(csRepUpfront + csRepAfter4 * s4);
    return { ldCost, csCost, ldNet: round2(deal.levelDebtRevenue - ldCost),
             csNet: round2((deal.consumerShieldExpectedRevenue ?? 0) - csCost) };
  }, [debtAmount, levelRepPct, csRepUpfront, csRepAfter4, s4, deal]);

  const portfolio = useMemo(() => {
    const ldCount  = Math.round(portfolioDeals * portfolioLevelMixPct / 100);
    const csCount  = portfolioDeals - ldCount;
    const avg      = calculateDealMetrics({ debtAmount: portfolioAvgDebt, survive2Rate: s2, survive4Rate: s4,
      surviveBreakEvenRate: sBE, completeRate: sC, leadQualityScore, cashUrgencyScore });
    const ldGross  = round2(ldCount * avg.levelDebtRevenue);
    const csGross  = round2(csCount * (avg.consumerShieldExpectedRevenue ?? 0));
    const csUpside = round2(csCount * (avg.consumerShieldRevenueAtFull ?? 0));
    const ldRep    = round2(ldCount * portfolioAvgDebt * (levelRepPct / 100));
    const csRep    = round2(csCount * (csRepUpfront + csRepAfter4 * s4));
    return { ldCount, csCount, ldGross, csGross, csUpside, ldRep, csRep,
             totalGross: round2(ldGross + csGross), totalRep: round2(ldRep + csRep),
             totalNet: round2(ldGross + csGross - ldRep - csRep) };
  }, [portfolioDeals, portfolioLevelMixPct, portfolioAvgDebt, s2, s4, sBE, sC,
      leadQualityScore, cashUrgencyScore, levelRepPct, csRepUpfront, csRepAfter4]);

  const recLogo = deal.recommendedBackend.startsWith("Consumer Shield") ? CS_LOGO
                : deal.recommendedBackend === "Level Debt" ? LEVEL_DEBT_LOGO : null;

  const milestoneMonths = new Set<number>([1, 4]);
  if (deal.consumerShieldBreakEvenMonthVsLevel) milestoneMonths.add(deal.consumerShieldBreakEvenMonthVsLevel);
  if (deal.consumerShieldLiabilityClearMonth)   milestoneMonths.add(deal.consumerShieldLiabilityClearMonth);

  const WL = ({ ch }: { ch: string }) => (
    <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 4,
      textTransform: "uppercase", letterSpacing: 0.4 }}>{ch}</div>
  );

  return (
    <div style={{ minHeight: "100vh", background: FT_BG, color: "#0f172a",
      fontFamily: 'Inter, Arial, Helvetica, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif' }}>

      <KnowledgeBase open={kbOpen} onClose={() => setKbOpen(false)} />

      <button onClick={() => setKbOpen(true)} style={{ position: "fixed", right: 20, bottom: 20, zIndex: 1000,
        border: "none", borderRadius: 999, background: FT_GREEN, color: "#fff", padding: "11px 16px",
        fontWeight: 800, fontSize: 13, boxShadow: "0 10px 28px rgba(15,157,138,0.35)", cursor: "pointer" }}>
        Legend / Knowledge Base
      </button>

      {/* STICKY HEADER */}
      <div style={{ position: "sticky", top: 0, zIndex: 50,
        background: "rgba(248,250,252,0.97)", backdropFilter: "blur(10px)",
        borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1380, margin: "0 auto", padding: "8px 16px" }}>
          <div style={{ background: "linear-gradient(135deg,#0f172a 0%,#0b3b50 45%,#0f766e 100%)",
            borderRadius: 16, padding: "10px 18px", boxShadow: "0 8px 24px rgba(15,23,42,0.18)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <img src={FT_LOGO} alt="Funding Tier" style={{ height: 28, width: "auto" }} />
                <span style={{ fontWeight: 900, fontSize: 20, color: "#fff", letterSpacing: "-0.5px", whiteSpace: "nowrap" }}>Profit Engine</span>
              </div>
              <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
              <div style={{ flexShrink: 0 }}>
                <WL ch="Enrolled Debt" />
                <input type="number" value={debtAmount} onChange={e => setDebtAmount(Number(e.target.value))}
                  min={0} step={100}
                  style={{ width: 108, padding: "6px 9px", borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.2)", fontSize: 14,
                    color: "#000", fontWeight: 800, background: "#fff", boxSizing: "border-box" }} />
              </div>
              {[
                { label: "Payment 2",   val: survive2Pct,         set: setSurvive2Pct },
                { label: "Payment 4",   val: survive4Pct,         set: setSurvive4Pct },
                { label: "Break-Even",  val: surviveBreakEvenPct, set: setSurviveBreakEvenPct },
                { label: "Completion",  val: completePct,         set: setCompletePct },
                { label: "Lead Quality",val: leadQualityScore,    set: setLeadQualityScore },
                { label: "Cash Urgency",val: cashUrgencyScore,    set: setCashUrgencyScore },
              ].map(f => (
                <div key={f.label} style={{ minWidth: 80, flex: 1 }}>
                  <WL ch={f.label} />
                  <Slider value={f.val} onChange={f.set} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ maxWidth: 1380, margin: "0 auto", padding: "18px 16px 60px", display: "grid", gap: 18 }}>

        {/* Top 4 */}
        <div className="grid-4">
          <div style={{ ...card, position: "relative" }}>
            {recLogo && (
              <img src={recLogo} alt="" style={{ position: "absolute", top: 12, left: 12,
                height: 22, width: "auto", objectFit: "contain", opacity: 0.85 }} />
            )}
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 7,
              textTransform: "uppercase", letterSpacing: 0.4, marginTop: recLogo ? 28 : 0 }}>
              Recommended Backend
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", lineHeight: 1.1, wordBreak: "break-word" }}>
              {deal.recommendedBackend}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 7, lineHeight: 1.5 }}>{deal.recommendationReason}</div>
          </div>
          <MetricCard title="Level Debt Revenue" value={money.format(deal.levelDebtRevenue)}
            subtitle={deal.levelDebtRevShareEligible ? "120k+ flagged for additional rev share" : "Base 8% commission"} />
          <MetricCard title="Consumer Shield Expected Revenue" value={money.format(deal.consumerShieldExpectedRevenue ?? 0)}
            subtitle="Blended from payment 2, 4, break-even, and completion survival assumptions" />
          <MetricCard title="Break-Even Month"
            value={deal.consumerShieldBreakEvenMonthVsLevel ? `Month ${deal.consumerShieldBreakEvenMonthVsLevel}` : "N/A"}
            subtitle="When CS cumulative revenue reaches the Level Debt 8% benchmark" />
        </div>

        {/* Snapshots */}
        <div className="grid-2">
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <img src={LEVEL_DEBT_LOGO} alt="Level Debt" style={{ height: 30, width: "auto", objectFit: "contain" }} />
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" }}>Level Debt Snapshot</h2>
            </div>
            <div className="grid-2-inner">
              <MetricCard title="Debt Amount"               value={money.format(deal.debtAmount)} />
              <MetricCard title="Gross Revenue"             value={money.format(deal.levelDebtRevenue)} />
              <MetricCard title="Commission Paid To Closer" value={money.format(repEcon.ldCost)} />
              <MetricCard title="Net Revenue"               value={money.format(repEcon.ldNet)} />
            </div>
          </div>
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <img src={CS_LOGO} alt="Consumer Shield" style={{ height: 30, width: "auto", objectFit: "contain" }} />
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" }}>Consumer Shield Program Snapshot</h2>
            </div>
            <div className="grid-2-inner">
              <div style={card}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 7,
                  textTransform: "uppercase", letterSpacing: 0.4,
                  display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>Payment / Monthly</span>
                  {deal.consumerShieldTerm && (
                    <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>{deal.consumerShieldTerm} months</span>
                  )}
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>{money.format(deal.consumerShieldPayment ?? 0)}</div>
              </div>
              <MetricCard title="Net Payment"
                value={money.format(deal.consumerShieldNetPayment ?? 0)}
                tooltip={`${money.format(deal.consumerShieldPayment ?? 0)} program payment minus $40 servicing fee = ${money.format(deal.consumerShieldNetPayment ?? 0)} net per month. This is the base amount Funding Tier works from before applying the 100% (months 1–4) or 35% (month 5+) revenue split.`} />
              <MetricCard title="Front Revenue"      value={money.format(deal.consumerShieldFrontRevenue ?? 0)}       inlineTag="Months 1 through 4" />
              <MetricCard title="Tail End – Revenue" value={money.format(deal.consumerShieldBackRevenueMonthly ?? 0)} inlineTag="Per month from month 5+" />
            </div>
          </div>
        </div>

        {/* CS Revenue Milestones */}
        <Accordion title="Consumer Shield Revenue Milestones" defaultOpen={true} badge="Hover dots for detail">
          <CSRevenueMilestonesTimeline
            timeline={deal.consumerShieldTimeline}
            breakEvenMonth={deal.consumerShieldBreakEvenMonthVsLevel}
            liabilityClearMonth={deal.consumerShieldLiabilityClearMonth}
            levelDebtRevenue={deal.levelDebtRevenue}
            debtAmount={deal.debtAmount}
          />
          <div className="grid-4" style={{ marginTop: 16 }}>
            <MetricCard title="After Payment 2" value={money.format(deal.consumerShieldRevenueAfter2 ?? 0)} subtitle="Early quality signal" />
            <MetricCard title="After Payment 4" value={money.format(deal.consumerShieldRevenueAfter4 ?? 0)} subtitle="Front window closes" />
            <MetricCard title="1/2 Program"     value={money.format(deal.consumerShieldRevenueAtHalf ?? 0)} subtitle="Mid-term reference" />
            <MetricCard title="Full Program"     value={money.format(deal.consumerShieldRevenueAtFull ?? 0)} subtitle="Best-case ceiling" />
          </div>
        </Accordion>

        {/* Payout + Liability */}
        <PayoutLiabilityAccordion />

        {/* CS Offerings */}
        <div style={card}>
          <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
            Consumer Shield Offerings / Retention Scenarios
          </h2>
          <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, marginBottom: 14 }}>
            Expand each offering for the full revenue breakdown and interactive revenue curve. Hover any chart dot to see cumulative net revenue at that exact month.
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {consumerShieldPrograms.map(prog => (
              <ProgramAccordion key={prog.label} program={prog}
                open={openProgram === prog.label}
                onToggle={() => setOpenProgram(c => c === prog.label ? null : prog.label)} />
            ))}
          </div>
        </div>

        {/* Monthly Revenue Timeline */}
        <Accordion title="Consumer Shield Monthly Revenue Timeline" defaultOpen={false}>
          <div style={{ overflowX: "auto", borderRadius: 13, border: "1px solid #e2e8f0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  {["Month","Phase","Monthly Revenue","Cumulative Revenue","Assumed Funds Hit","Liability Clears"].map(h => (
                    <th key={h} style={TH_BASE}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deal.consumerShieldTimeline.map(row => {
                  const isBE   = row.month === deal.consumerShieldBreakEvenMonthVsLevel;
                  const isLC   = row.month === deal.consumerShieldLiabilityClearMonth;
                  const is1    = row.month === 1;
                  const is4    = row.month === 4;
                  const isMile = isBE || isLC || is1 || is4;
                  const rowBg  = isLC ? FT_HYPER + "22" : isBE ? FT_AMBER + "22"
                               : is1 || is4 ? FT_GREEN + "11" : row.month % 2 ? "#f8fafc" : "#fff";
                  return (
                    <tr key={row.month} style={{ background: rowBg }}>
                      <td style={{ ...TD_BASE, fontWeight: isMile ? 800 : 400 }}>
                        {row.month}
                        {is1  && <span style={{ marginLeft: 6, fontSize: 10, background: FT_GREEN + "22", color: FT_GREEN_DARK, fontWeight: 700, padding: "1px 6px", borderRadius: 99 }}>Start</span>}
                        {is4  && <span style={{ marginLeft: 6, fontSize: 10, background: FT_GREEN + "22", color: FT_GREEN_DARK, fontWeight: 700, padding: "1px 6px", borderRadius: 99 }}>Front Close</span>}
                        {isBE && <span style={{ marginLeft: 6, fontSize: 10, background: FT_AMBER + "33", color: FT_AMBER,      fontWeight: 800, padding: "1px 6px", borderRadius: 99 }}>Break-Even</span>}
                        {isLC && <span style={{ marginLeft: 6, fontSize: 10, background: FT_HYPER + "33", color: FT_GREEN_DARK, fontWeight: 800, padding: "1px 6px", borderRadius: 99 }}>Liability Clear</span>}
                      </td>
                      <td style={{ ...TD_BASE, color: row.phase === "Front" ? FT_GREEN : FT_BLUE, fontWeight: 700 }}>{row.phase}</td>
                      <td style={TD_BASE}>{money.format(row.monthlyRevenue)}</td>
                      <td style={{ ...TD_BASE, fontWeight: isMile ? 800 : 400,
                        color: isLC ? FT_GREEN_DARK : isBE ? FT_AMBER : "inherit" }}>
                        {money.format(row.cumulativeRevenue)}
                      </td>
                      <td style={TD_BASE}>Month {row.payoutHitMonthAssumed}</td>
                      <td style={{ ...TD_BASE, borderRight: "none" }}>Month {row.liabilityFreeMonth}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Accordion>

        {/* Rep Economics */}
        <div style={card}>
          <h2 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 800, color: "#0f172a" }}>Sales Rep Economics</h2>
          <div className="grid-3">
            {[
              { label: "Level Debt Rep Payout (% of enrolled debt)", value: levelRepPct, set: setLevelRepPct, min: 0, max: 10, step: 0.05 },
              { label: "CS Upfront Rep Payout ($)",                  value: csRepUpfront, set: setCsRepUpfront, min: 0, step: 25 },
              { label: "CS Payment 4 Milestone Payout ($)",          value: csRepAfter4,  set: setCsRepAfter4,  min: 0, step: 25 },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 7 }}>{f.label}</div>
                <input type="number" value={f.value} onChange={e => f.set(Number(e.target.value))}
                  min={f.min} max={f.max} step={f.step}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10,
                    border: "1px solid #cbd5e1", fontSize: 15, color: "#0f172a",
                    background: "#fff", boxSizing: "border-box" }} />
              </div>
            ))}
          </div>
        </div>

        {/* Portfolio Forecast */}
        <div style={card}>
          <h2 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 800, color: "#0f172a" }}>Portfolio Forecast — Deals Above $7,000</h2>
          <div className="grid-3">
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 7 }}>Number of Deals</div>
              <input type="number" value={portfolioDeals} onChange={e => setPortfolioDeals(Number(e.target.value))}
                min={1} step={1} style={{ width: "100%", padding: "10px 12px", borderRadius: 10,
                  border: "1px solid #cbd5e1", fontSize: 15, color: "#0f172a", background: "#fff", boxSizing: "border-box" }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 7 }}>Average Debt Amount</div>
              <input type="number" value={portfolioAvgDebt} onChange={e => setPortfolioAvgDebt(Number(e.target.value))}
                min={7001} step={100} style={{ width: "100%", padding: "10px 12px", borderRadius: 10,
                  border: "1px solid #cbd5e1", fontSize: 15, color: "#0f172a", background: "#fff", boxSizing: "border-box" }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 7 }}>% Routed to Level Debt</div>
              <input type="range" min={0} max={100} step={1} value={portfolioLevelMixPct}
                onChange={e => setPortfolioLevelMixPct(Number(e.target.value))}
                style={{ width: "100%", accentColor: FT_GREEN }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginTop: 3 }}>{portfolioLevelMixPct}%</div>
            </div>
          </div>
          <div className="grid-4" style={{ marginTop: 16 }}>
            <MetricCard title="Level Debt Deals" value={String(portfolio.ldCount)} subtitle={`${percentFmt.format(portfolioLevelMixPct / 100)} of portfolio`} />
            <MetricCard title="Consumer Shield Deals" value={String(portfolio.csCount)} subtitle={`${percentFmt.format((100 - portfolioLevelMixPct) / 100)} of portfolio`} />
            <MetricCard title="Expected Gross Revenue" value={money.format(portfolio.totalGross)} />
            <MetricCard title="Expected Net Revenue"   value={money.format(portfolio.totalNet)} />
          </div>
          <div style={{ marginTop: 16, overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 13 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  {["Metric","Level Debt Portion","Consumer Shield Portion","Combined"].map(h => (
                    <th key={h} style={TH_BASE}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Deal Count",        tip: "Total deals split by your routing allocation.",
                    ld: String(portfolio.ldCount), cs: String(portfolio.csCount), tot: String(portfolioDeals) },
                  { label: "Gross Revenue",     tip: "LD = 8% × avg debt × deal count. CS = expected revenue × CS deal count.",
                    ld: money.format(portfolio.ldGross), cs: money.format(portfolio.csGross), tot: money.format(portfolio.totalGross) },
                  { label: "Rep Cost",          tip: "LD = enrolled debt × rep %. CS = (upfront SPIFF + milestone × p4 survival) × CS deals.",
                    ld: money.format(portfolio.ldRep), cs: money.format(portfolio.csRep), tot: money.format(portfolio.totalRep) },
                  { label: "Net Revenue",       tip: "Gross revenue minus total rep cost for each side.",
                    ld: money.format(portfolio.ldGross - portfolio.ldRep), cs: money.format(portfolio.csGross - portfolio.csRep), tot: money.format(portfolio.totalNet) },
                  { label: "CS Full-Upside Ref",tip: "CS revenue if every CS deal reached full program completion. Ceiling only — not a forecast.",
                    ld: "—", cs: money.format(portfolio.csUpside), tot: money.format(portfolio.ldGross + portfolio.csUpside) },
                ].map((row, i) => (
                  <tr key={row.label} style={{ background: i % 2 ? "#f8fafc" : "#fff" }}>
                    <td style={{ ...TD_BASE, fontWeight: 700 }} title={row.tip}>
                      {row.label} <span style={{ fontSize: 10, background: "#e2e8f0", borderRadius: 99, padding: "1px 5px", color: "#334155", cursor: "help" }}>?</span>
                    </td>
                    <td style={TD_BASE}>{row.ld}</td>
                    <td style={TD_BASE}>{row.cs}</td>
                    <td style={{ ...TD_BASE, borderRight: "none" }}>{row.tot}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Operator Notes */}
        <div style={card}>
          <h2 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 800, color: "#0f172a" }}>Operator Notes</h2>
          {[
            ["Payment 2", "is your first real quality checkpoint. If payment 2 survival is weak, Consumer Shield exposure should stay tight."],
            ["Payment 4", "tells you whether the front-end Consumer Shield economics are actually materializing in your book."],
            ["Break-even month", "shows how long it takes Consumer Shield to catch what Level Debt would have already paid. Until that month, LD has already been recognized and CS has not."],
            ["Break-even + Liability Clear (Hyper Green)", "is the first month where CS has both matched LD economically AND the chargeback window on the break-even payment has closed. This is the true zero-risk inflection point for CS economics."],
            ["Liability timing", "On CS, each payment carries its own chargeback window — track each independently."],
            ["ACH chargeback windows in practice", "The 4-month window is Funding Tier's conservative internal standard. Most banks don't accept consumer ACH returns beyond Nacha's ~60-day window per payment."],
            ["Portfolio mix above $7,000", "Start conservative — 65–75% Level Debt, 25–35% Consumer Shield — until you have real book data to validate payment-2, payment-4, and break-even survival rates."],
          ].map(([b, rest], i) => (
            <p key={i} style={{ margin: "8px 0 0", fontSize: 14, color: "#475569", lineHeight: 1.7 }}>
              <strong style={{ color: "#0f172a" }}>{b}:</strong> {rest}
            </p>
          ))}
        </div>

      </div>

      <style jsx>{`
        .grid-4       { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 14px; }
        .grid-3       { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; }
        .grid-2       { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .grid-2-inner { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; }
        @media (max-width: 1200px) {
          .grid-4 { grid-template-columns: 1fr 1fr; }
          .grid-3 { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 720px) {
          .grid-4, .grid-3, .grid-2, .grid-2-inner { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
