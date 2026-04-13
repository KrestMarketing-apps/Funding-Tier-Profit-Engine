"use client";

import React, { useMemo, useState } from "react";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

type TimelineRow = {
  month: number;
  phase: "Front" | "Backend";
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
  consumerShieldTimeline: TimelineRow[];
  recommendedBackend:
    | "Level Debt"
    | "Consumer Shield"
    | "Consumer Shield (Guaranteed)"
    | "No Recommendation";
  recommendationReason: string;
};

// ─────────────────────────────────────────────
// ASSETS & CONSTANTS
// ─────────────────────────────────────────────

const FT_LOGO =
  "https://assets.cdn.filesafe.space/S4ztIlDxBovAboldwbOR/media/68783cf82035bab4d790ae7e.png";

const LEVEL_DEBT_LOGO =
  "https://assets.cdn.filesafe.space/S4ztIlDxBovAboldwbOR/media/69c35b2cab2203b0fc83186d.webp";

const CONSUMER_SHIELD_LOGO =
  "https://assets.cdn.filesafe.space/S4ztIlDxBovAboldwbOR/media/69c35b2c25c6995d2d2d21fa.png";

const FT_GREEN = "#0f9d8a";
const FT_GREEN_DARK = "#0b7d6e";
const FT_BG = "#f8fafc";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const percentFmt = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

// ─────────────────────────────────────────────
// CONSUMER SHIELD PROGRAM GRID
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// MATH HELPERS
// ─────────────────────────────────────────────

function round2(v: number) { return Math.round(v * 100) / 100; }
function clamp(v: number, lo: number, hi: number) { return Math.min(Math.max(v, lo), hi); }

function getProgram(debt: number): ConsumerShieldProgram | null {
  if (debt < 4000) return null;
  return consumerShieldPrograms.find(p => debt >= p.minDebt && debt <= p.maxDebt) ?? null;
}

function csRevenueAt(month: number, net: number, term: number): number {
  if (month <= 0) return 0;
  const m = Math.min(month, term);
  return round2(Math.min(m, 4) * net + Math.max(0, m - 4) * net * 0.35);
}

function buildTimeline(net: number, term: number): TimelineRow[] {
  return Array.from({ length: term }, (_, i) => {
    const month = i + 1;
    return {
      month,
      phase: month <= 4 ? "Front" : "Backend",
      monthlyRevenue: round2(month <= 4 ? net : net * 0.35),
      cumulativeRevenue: csRevenueAt(month, net, term),
      liabilityFreeMonth: month + 4,
      payoutHitMonthAssumed: month + 1,
    } as TimelineRow;
  });
}

function breakEvenMonth(ldRev: number, net: number, term: number): number | null {
  for (let m = 1; m <= term; m++) {
    if (csRevenueAt(m, net, term) >= ldRev) return m;
  }
  return null;
}

function fractionRevenue(frac: number, net: number, term: number): number {
  return csRevenueAt(Math.max(1, Math.floor(term * frac)), net, term);
}

// ─────────────────────────────────────────────
// CORE CALCULATOR
// ─────────────────────────────────────────────

function calculateDealMetrics(args: {
  debtAmount: number;
  survive2Rate: number;
  survive4Rate: number;
  surviveBreakEvenRate: number;
  completeRate: number;
  leadQualityScore: number;
  cashUrgencyScore: number;
}): DealMetrics {
  const { debtAmount, survive2Rate, survive4Rate, surviveBreakEvenRate,
          completeRate, leadQualityScore, cashUrgencyScore } = args;

  const ldRev = round2(debtAmount * 0.08);
  const prog = getProgram(debtAmount);

  if (!prog) {
    return {
      debtAmount, levelDebtRevenue: ldRev, levelDebtRevShareEligible: debtAmount >= 120000,
      consumerShieldPayment: null, consumerShieldTerm: null, consumerShieldNetPayment: null,
      consumerShieldRevenueAfter1: null, consumerShieldRevenueAfter2: null, consumerShieldRevenueAfter4: null,
      consumerShieldFrontRevenue: null, consumerShieldBackRevenueMonthly: null, consumerShieldBackRevenueFull: null,
      consumerShieldRevenueAtQuarter: null, consumerShieldRevenueAtHalf: null, consumerShieldRevenueAtFull: null,
      consumerShieldExpectedRevenue: null, consumerShieldBreakEvenMonthVsLevel: null, consumerShieldTimeline: [],
      recommendedBackend: "No Recommendation",
      recommendationReason: "Debt amount falls outside the configured Consumer Shield range.",
    };
  }

  const { payment, term } = prog;
  const net = payment - 40;
  const timeline = buildTimeline(net, term);

  const rev1 = csRevenueAt(1, net, term);
  const rev2 = csRevenueAt(2, net, term);
  const rev4 = csRevenueAt(4, net, term);

  const front = round2(net * Math.min(4, term));
  const tailMonthly = round2(net * 0.35);
  const tailFull = round2(Math.max(0, term - 4) * tailMonthly);
  const fullRev = round2(front + tailFull);

  const be = breakEvenMonth(ldRev, net, term);
  const revAtBE = csRevenueAt(be ?? term, net, term);

  const expected = round2(
    survive2Rate * rev2
    + survive4Rate * Math.max(0, rev4 - rev2)
    + surviveBreakEvenRate * Math.max(0, revAtBE - rev4)
    + completeRate * Math.max(0, fullRev - revAtBE)
  );

  let recommendedBackend: DealMetrics["recommendedBackend"] = "No Recommendation";
  let recommendationReason = "";

  if (debtAmount >= 4000 && debtAmount <= 7000) {
    recommendedBackend = "Consumer Shield (Guaranteed)";
    recommendationReason = "This debt amount falls inside your guaranteed Consumer Shield routing band ($4k–$7k).";
  } else {
    const q = leadQualityScore / 100;
    const u = cashUrgencyScore / 100;
    const ldScore = ldRev * (1 + u * 0.35) * (1.05 - q * 0.1);
    const csScore = expected * (0.8 + q * 0.45) * (1 - u * 0.2);

    if (csScore > ldScore) {
      recommendedBackend = "Consumer Shield";
      recommendationReason = "Consumer Shield wins on adjusted expected value after accounting for lead quality and your risk assumptions.";
    } else {
      recommendedBackend = "Level Debt";
      recommendationReason = "Level Debt wins — faster, more certain revenue recognition beats the slower Consumer Shield payout curve given your current assumptions.";
    }
  }

  return {
    debtAmount, levelDebtRevenue: ldRev, levelDebtRevShareEligible: debtAmount >= 120000,
    consumerShieldPayment: payment, consumerShieldTerm: term, consumerShieldNetPayment: net,
    consumerShieldRevenueAfter1: rev1, consumerShieldRevenueAfter2: rev2, consumerShieldRevenueAfter4: rev4,
    consumerShieldFrontRevenue: front, consumerShieldBackRevenueMonthly: tailMonthly,
    consumerShieldBackRevenueFull: tailFull,
    consumerShieldRevenueAtQuarter: fractionRevenue(0.25, net, term),
    consumerShieldRevenueAtHalf: fractionRevenue(0.5, net, term),
    consumerShieldRevenueAtFull: fullRev,
    consumerShieldExpectedRevenue: expected,
    consumerShieldBreakEvenMonthVsLevel: be,
    consumerShieldTimeline: timeline,
    recommendedBackend, recommendationReason,
  };
}

// ─────────────────────────────────────────────
// SHARED STYLES
// ─────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 4px 14px rgba(15,23,42,0.05)",
};

const TH: React.CSSProperties = {
  padding: "11px 13px",
  borderBottom: "1px solid #e2e8f0",
  color: "#334155",
  fontWeight: 800,
  whiteSpace: "nowrap",
  fontSize: 13,
};

const TD: React.CSSProperties = {
  padding: "11px 13px",
  borderBottom: "1px solid #e2e8f0",
  color: "#0f172a",
  whiteSpace: "nowrap",
  fontSize: 14,
};

// ─────────────────────────────────────────────
// PRIMITIVE COMPONENTS
// ─────────────────────────────────────────────

function MetricCard({ title, value, subtitle, tooltip }: {
  title: string; value: string; subtitle?: string; tooltip?: string;
}) {
  return (
    <div style={card} title={tooltip}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 8,
        textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 5 }}>
        {title}
        {tooltip && (
          <span title={tooltip} style={{ display: "inline-flex", alignItems: "center",
            justifyContent: "center", width: 15, height: 15, borderRadius: "50%",
            background: "#e2e8f0", color: "#334155", fontSize: 10, fontWeight: 900, cursor: "help" }}>?</span>
        )}
      </div>
      <div style={{ fontSize: 27, fontWeight: 800, color: "#0f172a", lineHeight: 1.1, wordBreak: "break-word" }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 8, lineHeight: 1.5 }}>{subtitle}</div>
      )}
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#0f172a" }}>{children}</h2>;
}

function WL({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 7 }}>{children}</div>;
}

function NI({ value, onChange, min, max, step }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number;
}) {
  return (
    <input type="number" value={Number.isNaN(value) ? "" : value}
      min={min} max={max} step={step ?? 1}
      onChange={e => onChange(Number(e.target.value))}
      style={{ width: "100%", padding: "10px 12px", borderRadius: 11,
        border: "1px solid rgba(255,255,255,0.25)", fontSize: 15,
        color: "#0f172a", background: "#fff", boxSizing: "border-box" }} />
  );
}

function Slider({ value, onChange, min = 0, max = 100, step = 1 }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number;
}) {
  return (
    <div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: FT_GREEN }} />
      <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginTop: 3 }}>{value}%</div>
    </div>
  );
}

function Info({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: "8px 0 0", fontSize: 14, color: "#475569", lineHeight: 1.7 }}>{children}</p>;
}

// ─────────────────────────────────────────────
// MINI INFOGRAPHIC
// ─────────────────────────────────────────────

function MiniInfographic({ title, items }: {
  title: string;
  items: { label: string; month: string; detail: string }[];
}) {
  return (
    <div style={card}>
      <H2>{title}</H2>
      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {items.map((item, i) => (
          <div key={i} style={{ border: "1px solid #e2e8f0", borderRadius: 13,
            padding: 13, background: i % 2 ? "#f8fafc" : "#fff" }}>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>
              {item.label}
            </div>
            <div style={{ marginTop: 3, fontSize: 22, fontWeight: 800, color: FT_GREEN_DARK }}>
              {item.month}
            </div>
            <div style={{ marginTop: 6, fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{item.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PROGRAM REVENUE CHART
// ─────────────────────────────────────────────

function ProgramChart({ program }: { program: ConsumerShieldProgram }) {
  const net = program.payment - 40;
  const pts = Array.from({ length: program.term }, (_, i) => ({
    month: i + 1,
    y: csRevenueAt(i + 1, net, program.term),
  }));

  const maxY = Math.max(...pts.map(p => p.y), 1);
  const W = 680, H = 200, PL = 52, PB = 28, PT = 14, PR = 16;

  const coords = pts.map((p, i) => {
    const x = PL + (i / Math.max(pts.length - 1, 1)) * (W - PL - PR);
    const y = H - PB - (p.y / maxY) * (H - PT - PB);
    return `${x},${y}`;
  }).join(" ");

  const noteMonths = new Set([1, 4, program.term]);

  return (
    <div style={{ marginTop: 12, overflowX: "auto", background: "#f8fafc",
      border: "1px solid #e2e8f0", borderRadius: 14, padding: "10px 12px 6px" }}>
      <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6, marginBottom: 4 }}>
        *All CS deals between {program.debtRange} are structured for {program.term} months based on the pricing grid supplied.
      </div>
      <svg width={W} height={H} style={{ minWidth: W }}>
        <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="#94a3b8" strokeWidth="1" />
        <line x1={PL} y1={PT}     x2={PL}     y2={H - PB} stroke="#94a3b8" strokeWidth="1" />
        {[0.25, 0.5, 0.75, 1].map((t, i) => {
          const y = H - PB - t * (H - PT - PB);
          return (
            <g key={i}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={5} y={y + 4} fontSize="10" fill="#64748b">{money.format(maxY * t)}</text>
            </g>
          );
        })}
        <polyline fill="none" stroke={FT_GREEN} strokeWidth="3.5" points={coords} />
        {pts.map((p, i) => {
          const x = PL + (i / Math.max(pts.length - 1, 1)) * (W - PL - PR);
          const y = H - PB - (p.y / maxY) * (H - PT - PB);
          return (
            <g key={p.month}>
              <circle cx={x} cy={y} r={noteMonths.has(p.month) ? 4 : 2.5}
                fill={noteMonths.has(p.month) ? FT_GREEN_DARK : FT_GREEN} />
              {noteMonths.has(p.month) && (
                <text x={x - 8} y={H - 8} fontSize="10" fill="#64748b">Mo {p.month}</text>
              )}
            </g>
          );
        })}
        <text x={W / 2 - 80} y={H - 2} fontSize="11" fill="#334155">X — Program Length (Months)</text>
        <text x={-130} y={12} transform="rotate(-90)" fontSize="11" fill="#334155">Y — Revenue Earned</text>
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────
// PROGRAM ACCORDION
// ─────────────────────────────────────────────

function ProgramAccordion({ program, open, onToggle }: {
  program: ConsumerShieldProgram; open: boolean; onToggle: () => void;
}) {
  const net = program.payment - 40;
  const front = round2(net * Math.min(4, program.term));
  const tail = round2(net * 0.35);
  const fullRev = round2(front + Math.max(0, program.term - 4) * tail);

  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
      <button onClick={onToggle} style={{ width: "100%", textAlign: "left", background: "#fff",
        border: "none", padding: "14px 16px", cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 15 }}>{program.label}</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>
              {program.debtRange} &nbsp;•&nbsp; {program.term} months &nbsp;•&nbsp; {money.format(program.payment)}/mo
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: FT_GREEN, paddingRight: 4 }}>
            {open ? "−" : "+"}
          </div>
        </div>
      </button>
      {open && (
        <div style={{ borderTop: "1px solid #e2e8f0", padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
            <MetricCard title="Net Payment" value={money.format(net)} subtitle="Program payment minus $40 servicing" />
            <MetricCard title="Front Revenue" value={money.format(front)} subtitle="Months 1 through 4" />
            <MetricCard title="Tail End – Revenue" value={money.format(tail)} subtitle="Per month from month 5+" />
            <MetricCard title="Full Revenue" value={money.format(fullRev)} subtitle="If client completes entire term" />
          </div>
          <ProgramChart program={program} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// KNOWLEDGE BASE PANEL
// ─────────────────────────────────────────────

function KnowledgeBase({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", right: 20, bottom: 88, width: 430,
      maxWidth: "calc(100vw - 24px)", maxHeight: "72vh",
      zIndex: 999, background: "#fff", border: "1px solid #dbeafe",
      borderRadius: 18, boxShadow: "0 20px 40px rgba(15,23,42,0.22)",
      display: "flex", flexDirection: "column",
    }}>
      {/* STICKY CLOSE — always visible */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10, background: "#fff",
        borderBottom: "1px solid #e2e8f0", borderRadius: "18px 18px 0 0",
        padding: "14px 16px 12px", display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", gap: 12, flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#0f172a" }}>Legend / Knowledge Base</div>
          <div style={{ marginTop: 3, fontSize: 13, color: "#64748b" }}>How the engine calculates every number.</div>
        </div>
        <button onClick={onClose} style={{
          border: "none", background: "#f1f5f9", borderRadius: 10,
          width: 34, height: 34, cursor: "pointer", fontWeight: 900,
          fontSize: 18, color: "#334155", flexShrink: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>×</button>
      </div>

      {/* SCROLLABLE BODY */}
      <div style={{ overflowY: "auto", padding: "14px 16px 20px", display: "grid", gap: 14 }}>
        <div>
          <div style={{ fontWeight: 800, color: "#0f172a" }}>Risk Assumptions</div>
          <Info>These sliders are operating assumptions — not deal facts. They represent your estimated probability of a client surviving to payment 2, payment 4, break-even month, and full program completion.</Info>
        </div>
        <div>
          <div style={{ fontWeight: 800, color: "#0f172a" }}>Level Debt — Apply This Rule</div>
          <Info>Revenue is modeled as 8% of enrolled debt. After 2 successful program payments, Funding Tier is treated as free and clear of chargeback liability.</Info>
          <Info><strong>Payout timing example:</strong> If Program Payment 1 is Jan 1 and Program Payment 2 is Feb 1, expected payout hits your bank on March 20 — in Month 3.</Info>
        </div>
        <div>
          <div style={{ fontWeight: 800, color: "#0f172a" }}>Consumer Shield</div>
          <Info>Net payment = program payment minus $40 servicing fee.</Info>
          <Info>Months 1–4 revenue: you keep 100% of net payment per month.</Info>
          <Info>Month 5+ revenue: you keep 35% of net payment per month (tail-end / backend).</Info>
          <Info><strong>Worst-case liability rule:</strong> Each individual Consumer Shield payment is treated as secured and chargeback-free only 4 months after that specific ACH payment was processed at the bank. This is Funding Tier's conservative internal risk standard — not a universal bank rule.</Info>
        </div>
        <div>
          <div style={{ fontWeight: 800, color: "#0f172a" }}>Expected Revenue</div>
          <Info>Expected revenue is built by stacking staged survival probabilities: payment 2 rate × payment 2 revenue, plus incremental gains at payment 4, break-even month, and full completion. This avoids the error of modeling CS as if every client completes.</Info>
        </div>
        <div>
          <div style={{ fontWeight: 800, color: "#0f172a" }}>Break-Even Month</div>
          <Info>The month at which Consumer Shield cumulative revenue finally matches or exceeds what Level Debt would have already recognized at 8%. Until that month, Level Debt has already been paid and CS has not.</Info>
        </div>
        <div>
          <div style={{ fontWeight: 800, color: "#0f172a" }}>ACH Chargeback Windows</div>
          <Info>The 4-month liability window is Funding Tier's internal worst-case standard. In practice, most banks do not process consumer ACH return claims after the standard Nacha return window (~60 calendar days for unauthorized transactions). After that window closes on each payment, chargeback risk on that specific payment is generally eliminated. The 4-month rule here is deliberately conservative.</Info>
        </div>
        <div>
          <div style={{ fontWeight: 800, color: "#0f172a" }}>Portfolio Metrics</div>
          <Info><strong>Deal Count:</strong> Total deals split by your routing allocation percentage.</Info>
          <Info><strong>Gross Revenue:</strong> Level Debt = 8% × debt × deal count. Consumer Shield = expected revenue × CS deal count.</Info>
          <Info><strong>Rep Cost:</strong> Level Debt = enrolled debt × rep %. Consumer Shield = upfront SPIFF + (milestone bonus × payment-4 survival rate) × CS deal count.</Info>
          <Info><strong>Net Revenue:</strong> Gross revenue minus total rep cost for each side.</Info>
          <Info><strong>CS Full-Upside Reference:</strong> What Consumer Shield would pay if every CS deal reached full program completion. A ceiling reference only — not an operating forecast.</Info>
        </div>
        <div>
          <div style={{ fontWeight: 800, color: "#0f172a" }}>120k+ Rev Share</div>
          <Info>Level Debt has an additional rev share for enrolled debt of $120,000+. Deals at or above that threshold are flagged but the extra share is not calculated into totals yet.</Info>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

export default function FundingTierProfitabilityBalancer() {
  const [debtAmount,          setDebtAmount]          = useState(20000);
  const [survive2Pct,         setSurvive2Pct]         = useState(75);
  const [survive4Pct,         setSurvive4Pct]         = useState(60);
  const [surviveBreakEvenPct, setSurviveBreakEvenPct] = useState(40);
  const [completePct,         setCompletePct]         = useState(25);
  const [leadQualityScore,    setLeadQualityScore]    = useState(75);
  const [cashUrgencyScore,    setCashUrgencyScore]    = useState(60);

  const [levelRepPct,  setLevelRepPct]  = useState(1.25);
  const [csRepUpfront, setCsRepUpfront] = useState(200);
  const [csRepAfter4,  setCsRepAfter4]  = useState(75);

  const [portfolioDeals,       setPortfolioDeals]       = useState(100);
  const [portfolioAvgDebt,     setPortfolioAvgDebt]     = useState(18000);
  const [portfolioLevelMixPct, setPortfolioLevelMixPct] = useState(70);

  const [kbOpen,      setKbOpen]      = useState(false);
  const [openProgram, setOpenProgram] = useState<string | null>("CS Program A");

  const s2  = clamp(survive2Pct / 100, 0, 1);
  const s4  = clamp(survive4Pct / 100, 0, 1);
  const sBE = clamp(surviveBreakEvenPct / 100, 0, 1);
  const sC  = clamp(completePct / 100, 0, 1);

  const deal = useMemo(() => calculateDealMetrics({
    debtAmount, survive2Rate: s2, survive4Rate: s4,
    surviveBreakEvenRate: sBE, completeRate: sC,
    leadQualityScore, cashUrgencyScore,
  }), [debtAmount, s2, s4, sBE, sC, leadQualityScore, cashUrgencyScore]);

  const repEcon = useMemo(() => {
    const ldCost = round2(debtAmount * (levelRepPct / 100));
    const csCost = round2(csRepUpfront + csRepAfter4 * s4);
    return {
      ldCost, csCost,
      ldNet: round2(deal.levelDebtRevenue - ldCost),
      csNet: round2((deal.consumerShieldExpectedRevenue ?? 0) - csCost),
    };
  }, [debtAmount, levelRepPct, csRepUpfront, csRepAfter4, s4, deal]);

  const portfolio = useMemo(() => {
    const ldCount = Math.round(portfolioDeals * portfolioLevelMixPct / 100);
    const csCount = portfolioDeals - ldCount;
    const avg = calculateDealMetrics({
      debtAmount: portfolioAvgDebt, survive2Rate: s2, survive4Rate: s4,
      surviveBreakEvenRate: sBE, completeRate: sC, leadQualityScore, cashUrgencyScore,
    });
    const ldGross  = round2(ldCount * avg.levelDebtRevenue);
    const csGross  = round2(csCount * (avg.consumerShieldExpectedRevenue ?? 0));
    const csUpside = round2(csCount * (avg.consumerShieldRevenueAtFull ?? 0));
    const ldRep    = round2(ldCount * portfolioAvgDebt * (levelRepPct / 100));
    const csRep    = round2(csCount * (csRepUpfront + csRepAfter4 * s4));
    return {
      ldCount, csCount, ldGross, csGross, csUpside, ldRep, csRep,
      totalGross: round2(ldGross + csGross),
      totalRep:   round2(ldRep + csRep),
      totalNet:   round2(ldGross + csGross - ldRep - csRep),
    };
  }, [portfolioDeals, portfolioLevelMixPct, portfolioAvgDebt, s2, s4, sBE, sC,
      leadQualityScore, cashUrgencyScore, levelRepPct, csRepUpfront, csRepAfter4]);

  return (
    <div style={{ minHeight: "100vh", background: FT_BG, color: "#0f172a",
      fontFamily: 'Inter, Arial, Helvetica, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif' }}>

      <KnowledgeBase open={kbOpen} onClose={() => setKbOpen(false)} />

      {/* FLOATING LEGEND BUTTON */}
      <button onClick={() => setKbOpen(true)} style={{
        position: "fixed", right: 20, bottom: 20, zIndex: 1000,
        border: "none", borderRadius: 999, background: FT_GREEN,
        color: "#fff", padding: "13px 18px", fontWeight: 800, fontSize: 14,
        boxShadow: "0 10px 28px rgba(15,157,138,0.35)", cursor: "pointer",
      }}>
        Legend / Knowledge Base
      </button>

      {/* STICKY HEADER */}
      <div style={{ position: "sticky", top: 0, zIndex: 50,
        background: "rgba(248,250,252,0.96)", backdropFilter: "blur(10px)",
        borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1380, margin: "0 auto", padding: "10px 18px 16px" }}>
          <div style={{
            background: "linear-gradient(135deg,#0f172a 0%,#0b3b50 45%,#0f766e 100%)",
            color: "#fff", borderRadius: 22, padding: "18px 22px 20px",
            boxShadow: "0 10px 30px rgba(15,23,42,0.18)",
          }}>
            <img src={FT_LOGO} alt="Funding Tier"
              style={{ height: 40, width: "auto", display: "block", marginBottom: 10 }} />
            <h1 style={{ margin: "0 0 6px", fontSize: 34, lineHeight: 1.1, fontWeight: 900 }}>
              Profit Engine
            </h1>
            <p style={{ margin: "0 0 16px", maxWidth: 900, color: "rgba(255,255,255,0.85)", fontSize: 14, lineHeight: 1.7 }}>
              Compare Level Debt vs Consumer Shield using staged survival risk, payout timing, chargeback liability windows, break-even logic, and portfolio mix across deals above $7,000.
            </p>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12, color: "#fff" }}>Risk Assumptions</div>
            <div className="assumption-grid">
              <div><WL>Total Enrolled Debt</WL><NI value={debtAmount} onChange={setDebtAmount} min={0} step={100} /></div>
              <div><WL>Payment 2</WL><Slider value={survive2Pct} onChange={setSurvive2Pct} /></div>
              <div><WL>Payment 4</WL><Slider value={survive4Pct} onChange={setSurvive4Pct} /></div>
              <div><WL>Break-Even</WL><Slider value={surviveBreakEvenPct} onChange={setSurviveBreakEvenPct} /></div>
              <div><WL>Completion</WL><Slider value={completePct} onChange={setCompletePct} /></div>
              <div><WL>Lead Quality</WL><Slider value={leadQualityScore} onChange={setLeadQualityScore} /></div>
              <div><WL>Cash Urgency</WL><Slider value={cashUrgencyScore} onChange={setCashUrgencyScore} /></div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ maxWidth: 1380, margin: "0 auto", padding: "20px 18px 60px", display: "grid", gap: 20 }}>

        {/* Top summary */}
        <div className="grid-4">
          <MetricCard title="Recommended Backend" value={deal.recommendedBackend} subtitle={deal.recommendationReason} />
          <MetricCard title="Level Debt Revenue" value={money.format(deal.levelDebtRevenue)}
            subtitle={deal.levelDebtRevShareEligible ? "120k+ flagged for additional rev share" : "Base 8% commission"} />
          <MetricCard title="CS Expected Revenue" value={money.format(deal.consumerShieldExpectedRevenue ?? 0)}
            subtitle="Blended from payment 2, 4, break-even, and completion survival assumptions" />
          <MetricCard title="Break-Even Month"
            value={deal.consumerShieldBreakEvenMonthVsLevel ? `Month ${deal.consumerShieldBreakEvenMonthVsLevel}` : "N/A"}
            subtitle="When CS cumulative revenue reaches the Level Debt 8% benchmark" />
        </div>

        {/* Snapshots */}
        <div className="grid-2">
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <img src={LEVEL_DEBT_LOGO} alt="Level Debt" style={{ height: 34, width: "auto", objectFit: "contain" }} />
              <H2>Level Debt Snapshot</H2>
            </div>
            <div className="grid-2-inner">
              <MetricCard title="Debt Amount" value={money.format(deal.debtAmount)} />
              <MetricCard title="Gross Revenue" value={money.format(deal.levelDebtRevenue)} />
              <MetricCard title="Rep Cost" value={money.format(repEcon.ldCost)} />
              <MetricCard title="Net After Rep" value={money.format(repEcon.ldNet)} />
            </div>
          </div>
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <img src={CONSUMER_SHIELD_LOGO} alt="Consumer Shield" style={{ height: 34, width: "auto", objectFit: "contain" }} />
              <H2>Consumer Shield Snapshot</H2>
            </div>
            <div className="grid-2-inner">
              <MetricCard title="Program Payment"
                value={`${money.format(deal.consumerShieldPayment ?? 0)} · ${deal.consumerShieldTerm ?? 0} mo`} />
              <MetricCard title="Net Payment" value={money.format(deal.consumerShieldNetPayment ?? 0)}
                subtitle={`${money.format(deal.consumerShieldPayment ?? 0)} program payment minus $40 servicing`} />
              <MetricCard title="Front Revenue" value={money.format(deal.consumerShieldFrontRevenue ?? 0)}
                subtitle="Months 1 through 4" />
              <MetricCard title="Tail End – Revenue" value={money.format(deal.consumerShieldBackRevenueMonthly ?? 0)}
                subtitle="Per month from month 5+" />
            </div>
          </div>
        </div>

        {/* Early milestones */}
        <div style={card}>
          <H2>Early Revenue Milestones</H2>
          <div className="grid-4" style={{ marginTop: 16 }}>
            <MetricCard title="After Payment 1" value={money.format(deal.consumerShieldRevenueAfter1 ?? 0)} />
            <MetricCard title="After Payment 2" value={money.format(deal.consumerShieldRevenueAfter2 ?? 0)} />
            <MetricCard title="After Payment 4" value={money.format(deal.consumerShieldRevenueAfter4 ?? 0)} />
            <MetricCard title="Net After Expected Rep Cost" value={money.format(repEcon.csNet)}
              subtitle={`Expected rep cost: ${money.format(repEcon.csCost)}`} />
          </div>
        </div>

        {/* Infographics */}
        <div className="grid-2">
          <MiniInfographic
            title="Level Debt — Payout + Liability Timing"
            items={[
              { label: "Expected Funds Hit Bank", month: "Month 3 (20th)",
                detail: "After 2 cleared program payments, payout is expected on the 20th of the following month. Example: Payment 1 = Jan 1, Payment 2 = Feb 1 → payout hits March 20." },
              { label: "Chargeback Liability Free", month: "After Payment 2",
                detail: "After 2 successful program payments, Funding Tier is fully clear of chargeback liability on Level Debt deals." },
            ]}
          />
          <MiniInfographic
            title="Consumer Shield — Payout + Liability Timing"
            items={[
              { label: "Expected Funds Hit Bank", month: "Month +1 (per payment)",
                detail: "Each CS payment is assumed to hit your bank approximately one month after it is processed. Adjust operationally if your remittance schedule differs." },
              { label: "Chargeback Liability Free", month: "Payment Month +4",
                detail: "Worst-case treatment: each CS payment is considered fully secured 4 months after that specific ACH was processed. This is Funding Tier's conservative internal standard — not a universal bank rule. In practice, most ACH return windows close well before 4 months." },
            ]}
          />
        </div>

        {/* CS Offerings / Accordion with charts */}
        <div style={card}>
          <H2>Consumer Shield Offerings / Retention Scenarios</H2>
          <div style={{ marginTop: 8, fontSize: 13, color: "#64748b", lineHeight: 1.7 }}>
            Expand each offering to see the debt band, program term, revenue profile, and revenue curve chart for that exact program.
          </div>
          <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
            {consumerShieldPrograms.map(prog => (
              <ProgramAccordion key={prog.label} program={prog}
                open={openProgram === prog.label}
                onToggle={() => setOpenProgram(c => c === prog.label ? null : prog.label)} />
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div style={card}>
          <H2>Consumer Shield Monthly Revenue Timeline</H2>
          <div style={{ marginTop: 14, overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                  <th style={TH}>Month</th><th style={TH}>Phase</th>
                  <th style={TH}>Monthly Revenue</th><th style={TH}>Cumulative Revenue</th>
                  <th style={TH}>Assumed Funds Hit</th><th style={TH}>Liability Clears</th>
                </tr>
              </thead>
              <tbody>
                {deal.consumerShieldTimeline.map(row => (
                  <tr key={row.month}>
                    <td style={TD}>{row.month}</td>
                    <td style={TD}>{row.phase}</td>
                    <td style={TD}>{money.format(row.monthlyRevenue)}</td>
                    <td style={TD}>{money.format(row.cumulativeRevenue)}</td>
                    <td style={TD}>Month {row.payoutHitMonthAssumed}</td>
                    <td style={TD}>Month {row.liabilityFreeMonth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rep Economics */}
        <div style={card}>
          <H2>Sales Rep Economics</H2>
          <div className="grid-3" style={{ marginTop: 16 }}>
            {[
              { label: "Level Debt Rep Payout (% of enrolled debt)", value: levelRepPct, set: setLevelRepPct, min: 0, max: 10, step: 0.05 },
              { label: "CS Upfront Rep Payout ($)", value: csRepUpfront, set: setCsRepUpfront, min: 0, max: undefined, step: 25 },
              { label: "CS Payment 4 Milestone Payout ($)", value: csRepAfter4, set: setCsRepAfter4, min: 0, max: undefined, step: 25 },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 7 }}>{f.label}</div>
                <input type="number" value={f.value} onChange={e => f.set(Number(e.target.value))}
                  min={f.min} max={f.max} step={f.step}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 11,
                    border: "1px solid #cbd5e1", fontSize: 15, color: "#0f172a",
                    background: "#fff", boxSizing: "border-box" }} />
              </div>
            ))}
          </div>
        </div>

        {/* Portfolio Forecast */}
        <div style={card}>
          <H2>Portfolio Forecast — Deals Above $7,000</H2>
          <div className="grid-3" style={{ marginTop: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 7 }}>Number of Deals</div>
              <input type="number" value={portfolioDeals} onChange={e => setPortfolioDeals(Number(e.target.value))}
                min={1} step={1} style={{ width: "100%", padding: "10px 12px", borderRadius: 11,
                  border: "1px solid #cbd5e1", fontSize: 15, color: "#0f172a", background: "#fff", boxSizing: "border-box" }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 7 }}>Average Debt Amount</div>
              <input type="number" value={portfolioAvgDebt} onChange={e => setPortfolioAvgDebt(Number(e.target.value))}
                min={7001} step={100} style={{ width: "100%", padding: "10px 12px", borderRadius: 11,
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
            <MetricCard title="Level Debt Deals" value={String(portfolio.ldCount)}
              subtitle={`${percentFmt.format(portfolioLevelMixPct / 100)} of portfolio`} />
            <MetricCard title="Consumer Shield Deals" value={String(portfolio.csCount)}
              subtitle={`${percentFmt.format((100 - portfolioLevelMixPct) / 100)} of portfolio`} />
            <MetricCard title="Expected Gross Revenue" value={money.format(portfolio.totalGross)} />
            <MetricCard title="Expected Net Revenue" value={money.format(portfolio.totalNet)} />
          </div>

          <div style={{ marginTop: 16, overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                  <th style={TH}>Metric</th>
                  <th style={TH}>Level Debt Portion</th>
                  <th style={TH}>Consumer Shield Portion</th>
                  <th style={TH}>Combined</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Deal Count", tip: "Total deals split by your routing allocation.",
                    ld: String(portfolio.ldCount), cs: String(portfolio.csCount), total: String(portfolioDeals) },
                  { label: "Gross Revenue", tip: "Level Debt = 8% × avg debt × deal count. Consumer Shield = expected revenue × CS deal count using your survival assumptions.",
                    ld: money.format(portfolio.ldGross), cs: money.format(portfolio.csGross), total: money.format(portfolio.totalGross) },
                  { label: "Rep Cost", tip: "Level Debt = enrolled debt × rep %. Consumer Shield = (upfront SPIFF + milestone bonus × payment-4 survival rate) × CS deal count.",
                    ld: money.format(portfolio.ldRep), cs: money.format(portfolio.csRep), total: money.format(portfolio.totalRep) },
                  { label: "Net Revenue", tip: "Gross revenue minus total rep cost for each side.",
                    ld: money.format(portfolio.ldGross - portfolio.ldRep), cs: money.format(portfolio.csGross - portfolio.csRep), total: money.format(portfolio.totalNet) },
                  { label: "CS Full-Upside Ref", tip: "What Consumer Shield would pay if every CS deal reached full program completion. A ceiling reference only — not an operating forecast.",
                    ld: "—", cs: money.format(portfolio.csUpside), total: money.format(portfolio.ldGross + portfolio.csUpside) },
                ].map(row => (
                  <tr key={row.label}>
                    <td style={{ ...TD, fontWeight: 700 }} title={row.tip}>
                      {row.label}{" "}
                      <span style={{ fontSize: 10, background: "#e2e8f0", borderRadius: 99,
                        padding: "1px 5px", color: "#334155", cursor: "help" }}>?</span>
                    </td>
                    <td style={TD}>{row.ld}</td>
                    <td style={TD}>{row.cs}</td>
                    <td style={TD}>{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Operator Notes */}
        <div style={card}>
          <H2>Operator Notes</H2>
          <Info><strong>Payment 2</strong> is your first real quality checkpoint. If payment 2 survival is weak, Consumer Shield exposure should stay tight.</Info>
          <Info><strong>Payment 4</strong> tells you whether the front-end Consumer Shield economics are actually materializing in your book.</Info>
          <Info><strong>Break-even month</strong> shows how long it takes Consumer Shield to catch what Level Debt would have already paid. Until that month, Level Debt has already been recognized and CS has not.</Info>
          <Info><strong>Liability timing:</strong> On Consumer Shield, each payment carries its own chargeback window. Each payment should be tracked independently — a client making payment 5 has not cleared the liability on payments 1–4 simultaneously.</Info>
          <Info><strong>ACH chargeback windows in practice:</strong> The 4-month window used in this engine is Funding Tier's conservative internal risk standard. In practice, most banks do not accept consumer ACH return claims beyond the standard Nacha window (~60 calendar days for unauthorized transactions). Once that window closes on a given payment, chargeback risk on that specific payment is generally eliminated — which can materially de-risk Consumer Shield exposure earlier than the 4-month model suggests. Track your actual return rates by payment month to validate against your real book.</Info>
          <Info><strong>Portfolio mix above $7,000:</strong> Start conservative — 65–75% Level Debt, 25–35% Consumer Shield — until you have enough book data to validate your own payment-2, payment-4, and break-even survival rates. Then adjust the allocation slider based on what your actual portfolio is doing.</Info>
        </div>

      </div>

      <style jsx>{`
        .assumption-grid {
          display: grid;
          grid-template-columns: 1.3fr repeat(6, 1fr);
          gap: 12px;
          align-items: end;
        }
        .grid-4 {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }
        .grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }
        .grid-2-inner {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        @media (max-width: 1200px) {
          .assumption-grid { grid-template-columns: 1fr 1fr; }
          .grid-4          { grid-template-columns: 1fr 1fr; }
          .grid-3          { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 720px) {
          .assumption-grid,
          .grid-4,
          .grid-3,
          .grid-2,
          .grid-2-inner { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
