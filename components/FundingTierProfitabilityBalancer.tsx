"use client";

import React, { useMemo, useState } from "react";

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

const consumerShieldPrograms: ConsumerShieldProgram[] = [
  {
    label: "CS Program A",
    debtRange: "$4,000 - $4,999",
    minDebt: 4000,
    maxDebt: 4999.99,
    payment: 220,
    term: 18,
  },
  {
    label: "CS Program B",
    debtRange: "$5,000 - $8,799",
    minDebt: 5000,
    maxDebt: 8799.99,
    payment: 220,
    term: 24,
  },
  {
    label: "CS Program C",
    debtRange: "$8,800 - $9,999",
    minDebt: 8800,
    maxDebt: 9999.99,
    payment: 220,
    term: 36,
  },
  {
    label: "CS Program D",
    debtRange: "$10,000 - $14,999",
    minDebt: 10000,
    maxDebt: 14999.99,
    payment: 270,
    term: 36,
  },
  {
    label: "CS Program E",
    debtRange: "$15,000 - $19,999",
    minDebt: 15000,
    maxDebt: 19999.99,
    payment: 320,
    term: 36,
  },
  {
    label: "CS Program F",
    debtRange: "$20,000 - $24,999",
    minDebt: 20000,
    maxDebt: 24999.99,
    payment: 370,
    term: 36,
  },
  {
    label: "CS Program G",
    debtRange: "$25,000 - $29,999",
    minDebt: 25000,
    maxDebt: 29999.99,
    payment: 420,
    term: 36,
  },
  {
    label: "CS Program H",
    debtRange: "$30,000 - $49,999",
    minDebt: 30000,
    maxDebt: 49999.99,
    payment: 520,
    term: 36,
  },
  {
    label: "CS Program I",
    debtRange: "$50,000+",
    minDebt: 50000,
    maxDebt: Number.POSITIVE_INFINITY,
    payment: 620,
    term: 36,
  },
];

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getConsumerShieldPayment(debtAmount: number): number | null {
  if (debtAmount < 4000) return null;
  const match = consumerShieldPrograms.find(
    (p) => debtAmount >= p.minDebt && debtAmount <= p.maxDebt
  );
  return match ? match.payment : null;
}

function getConsumerShieldTerm(debtAmount: number): number | null {
  if (debtAmount < 4000) return null;
  const match = consumerShieldPrograms.find(
    (p) => debtAmount >= p.minDebt && debtAmount <= p.maxDebt
  );
  return match ? match.term : null;
}

function getConsumerShieldRevenueAtMonth(
  month: number,
  netPayment: number,
  term: number
): number {
  if (month <= 0) return 0;
  const safeMonth = Math.min(month, term);
  const frontMonths = Math.min(safeMonth, 4);
  const backendMonths = Math.max(0, safeMonth - 4);
  return round2(frontMonths * netPayment + backendMonths * netPayment * 0.35);
}

function getDetailedTimeline(netPayment: number, term: number): TimelineRow[] {
  const rows: TimelineRow[] = [];
  for (let month = 1; month <= term; month += 1) {
    const phase: "Front" | "Backend" = month <= 4 ? "Front" : "Backend";
    const monthlyRevenue = month <= 4 ? netPayment : netPayment * 0.35;
    rows.push({
      month,
      phase,
      monthlyRevenue: round2(monthlyRevenue),
      cumulativeRevenue: getConsumerShieldRevenueAtMonth(month, netPayment, term),
      liabilityFreeMonth: month + 4,
      payoutHitMonthAssumed: month + 1,
    });
  }
  return rows;
}

function getBreakEvenMonth(
  levelDebtRevenue: number,
  netPayment: number,
  term: number
): number | null {
  for (let month = 1; month <= term; month += 1) {
    if (getConsumerShieldRevenueAtMonth(month, netPayment, term) >= levelDebtRevenue) {
      return month;
    }
  }
  return null;
}

function getFractionRevenue(
  fraction: number,
  netPayment: number,
  term: number
): number {
  const months = Math.max(1, Math.floor(term * fraction));
  return getConsumerShieldRevenueAtMonth(months, netPayment, term);
}

function calculateDealMetrics(args: {
  debtAmount: number;
  survive2Rate: number;
  survive4Rate: number;
  surviveBreakEvenRate: number;
  completeRate: number;
  leadQualityScore: number;
  cashUrgencyScore: number;
}): DealMetrics {
  const {
    debtAmount,
    survive2Rate,
    survive4Rate,
    surviveBreakEvenRate,
    completeRate,
    leadQualityScore,
    cashUrgencyScore,
  } = args;

  const levelDebtRevenue = round2(debtAmount * 0.08);
  const levelDebtRevShareEligible = debtAmount >= 120000;

  const payment = getConsumerShieldPayment(debtAmount);
  const term = getConsumerShieldTerm(debtAmount);

  if (!payment || !term) {
    return {
      debtAmount,
      levelDebtRevenue,
      levelDebtRevShareEligible,
      consumerShieldPayment: null,
      consumerShieldTerm: null,
      consumerShieldNetPayment: null,
      consumerShieldRevenueAfter1: null,
      consumerShieldRevenueAfter2: null,
      consumerShieldRevenueAfter4: null,
      consumerShieldFrontRevenue: null,
      consumerShieldBackRevenueMonthly: null,
      consumerShieldBackRevenueFull: null,
      consumerShieldRevenueAtQuarter: null,
      consumerShieldRevenueAtHalf: null,
      consumerShieldRevenueAtFull: null,
      consumerShieldExpectedRevenue: null,
      consumerShieldBreakEvenMonthVsLevel: null,
      consumerShieldTimeline: [],
      recommendedBackend: "No Recommendation",
      recommendationReason:
        "Debt amount falls outside the configured Consumer Shield range.",
    };
  }

  const netPayment = payment - 40;
  const timeline = getDetailedTimeline(netPayment, term);

  const revenueAfter1 = getConsumerShieldRevenueAtMonth(1, netPayment, term);
  const revenueAfter2 = getConsumerShieldRevenueAtMonth(2, netPayment, term);
  const revenueAfter4 = getConsumerShieldRevenueAtMonth(4, netPayment, term);

  const frontRevenue = round2(netPayment * Math.min(4, term));
  const backRevenueMonthly = round2(netPayment * 0.35);
  const backRevenueFull = round2(Math.max(0, term - 4) * backRevenueMonthly);

  const quarterRevenue = getFractionRevenue(0.25, netPayment, term);
  const halfRevenue = getFractionRevenue(0.5, netPayment, term);
  const fullRevenue = round2(frontRevenue + backRevenueFull);

  const breakEvenMonth = getBreakEvenMonth(levelDebtRevenue, netPayment, term);
  const revenueAtBreakEven = getConsumerShieldRevenueAtMonth(
    breakEvenMonth ?? term,
    netPayment,
    term
  );

  const expectedRevenue = round2(
    survive2Rate * revenueAfter2 +
      survive4Rate * Math.max(0, revenueAfter4 - revenueAfter2) +
      surviveBreakEvenRate * Math.max(0, revenueAtBreakEven - revenueAfter4) +
      completeRate * Math.max(0, fullRevenue - revenueAtBreakEven)
  );

  let recommendedBackend: DealMetrics["recommendedBackend"] = "No Recommendation";
  let recommendationReason = "";

  if (debtAmount >= 4000 && debtAmount <= 7000) {
    recommendedBackend = "Consumer Shield (Guaranteed)";
    recommendationReason =
      "This debt amount falls inside your guaranteed Consumer Shield routing band.";
  } else {
    const qualityFactor = leadQualityScore / 100;
    const urgencyFactor = cashUrgencyScore / 100;

    const adjustedLevelScore =
      levelDebtRevenue * (1 + urgencyFactor * 0.35) * (1.05 - qualityFactor * 0.1);

    const adjustedConsumerShieldScore =
      expectedRevenue * (0.8 + qualityFactor * 0.45) * (1 - urgencyFactor * 0.2);

    if (adjustedConsumerShieldScore > adjustedLevelScore) {
      recommendedBackend = "Consumer Shield";
      recommendationReason =
        "Consumer Shield wins on adjusted expected value after accounting for lead quality and your assumptions.";
    } else {
      recommendedBackend = "Level Debt";
      recommendationReason =
        "Level Debt wins because faster, more stable revenue recognition beats the slower Consumer Shield payout curve here.";
    }
  }

  return {
    debtAmount,
    levelDebtRevenue,
    levelDebtRevShareEligible,
    consumerShieldPayment: payment,
    consumerShieldTerm: term,
    consumerShieldNetPayment: netPayment,
    consumerShieldRevenueAfter1: revenueAfter1,
    consumerShieldRevenueAfter2: revenueAfter2,
    consumerShieldRevenueAfter4: revenueAfter4,
    consumerShieldFrontRevenue: frontRevenue,
    consumerShieldBackRevenueMonthly: backRevenueMonthly,
    consumerShieldBackRevenueFull: backRevenueFull,
    consumerShieldRevenueAtQuarter: quarterRevenue,
    consumerShieldRevenueAtHalf: halfRevenue,
    consumerShieldRevenueAtFull: fullRevenue,
    consumerShieldExpectedRevenue: expectedRevenue,
    consumerShieldBreakEvenMonthVsLevel: breakEvenMonth,
    consumerShieldTimeline: timeline,
    recommendedBackend,
    recommendationReason,
  };
}

function cardStyle(): React.CSSProperties {
  return {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.05)",
  };
}

function MetricCard(props: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div style={cardStyle()}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#64748b",
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {props.title}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: "#0f172a",
          lineHeight: 1.1,
          wordBreak: "break-word",
        }}
      >
        {props.value}
      </div>
      {props.subtitle ? (
        <div
          style={{
            fontSize: 13,
            color: "#64748b",
            marginTop: 10,
            lineHeight: 1.5,
          }}
        >
          {props.subtitle}
        </div>
      ) : null}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: 0,
        fontSize: 20,
        fontWeight: 800,
        color: "#0f172a",
      }}
    >
      {children}
    </h2>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: "block",
        marginBottom: 8,
        fontSize: 13,
        fontWeight: 700,
        color: "#334155",
      }}
    >
      {children}
    </label>
  );
}

function NumberInput(props: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      value={Number.isNaN(props.value) ? "" : props.value}
      min={props.min}
      max={props.max}
      step={props.step ?? 1}
      onChange={(e) => props.onChange(Number(e.target.value))}
      style={{
        width: "100%",
        padding: "11px 12px",
        borderRadius: 12,
        border: "1px solid #cbd5e1",
        fontSize: 15,
        color: "#0f172a",
        background: "#fff",
        boxSizing: "border-box",
      }}
    />
  );
}

function Slider(props: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div>
      <input
        type="range"
        min={props.min ?? 0}
        max={props.max ?? 100}
        step={props.step ?? 1}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        style={{
          width: "100%",
          accentColor: FT_GREEN,
        }}
      />
      <div
        style={{
          marginTop: 4,
          fontSize: 12,
          color: "#64748b",
          fontWeight: 700,
        }}
      >
        {props.value}%
      </div>
    </div>
  );
}

function InfoText({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        marginTop: 10,
        marginBottom: 0,
        fontSize: 14,
        color: "#475569",
        lineHeight: 1.7,
      }}
    >
      {children}
    </p>
  );
}

function SimpleRevenueChart({
  title,
  subtitle,
  payment,
  term,
}: {
  title: string;
  subtitle: string;
  payment: number;
  term: number;
}) {
  const net = payment - 40;
  const points = Array.from({ length: term }, (_, i) => {
    const month = i + 1;
    const y = getConsumerShieldRevenueAtMonth(month, net, term);
    return { month, y };
  });

  const maxY = Math.max(...points.map((p) => p.y), 1);
  const width = 760;
  const height = 240;
  const padL = 54;
  const padB = 34;
  const padT = 18;
  const padR = 20;

  const coords = points.map((p, i) => {
    const x =
      padL + (i / Math.max(points.length - 1, 1)) * (width - padL - padR);
    const y = height - padB - (p.y / maxY) * (height - padT - padB);
    return `${x},${y}`;
  });

  return (
    <div style={{ ...cardStyle(), overflowX: "auto" }}>
      <div style={{ fontWeight: 800, fontSize: 18, color: "#0f172a" }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
        {subtitle}
      </div>

      <svg width={width} height={height} style={{ marginTop: 16, minWidth: width }}>
        <line
          x1={padL}
          y1={height - padB}
          x2={width - padR}
          y2={height - padB}
          stroke="#94a3b8"
          strokeWidth="1"
        />
        <line
          x1={padL}
          y1={padT}
          x2={padL}
          y2={height - padB}
          stroke="#94a3b8"
          strokeWidth="1"
        />

        {[0.25, 0.5, 0.75, 1].map((tick, idx) => {
          const y = height - padB - tick * (height - padT - padB);
          const value = maxY * tick;
          return (
            <g key={idx}>
              <line
                x1={padL}
                y1={y}
                x2={width - padR}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text x={8} y={y + 4} fontSize="11" fill="#64748b">
                {money.format(value)}
              </text>
            </g>
          );
        })}

        <polyline
          fill="none"
          stroke={FT_GREEN}
          strokeWidth="4"
          points={coords.join(" ")}
        />

        {points.map((p, i) => {
          const x =
            padL + (i / Math.max(points.length - 1, 1)) * (width - padL - padR);
          const y = height - padB - (p.y / maxY) * (height - padT - padB);
          const showMonth = p.month === 1 || p.month === 4 || p.month === term;

          return (
            <g key={p.month}>
              <circle cx={x} cy={y} r="3" fill={FT_GREEN_DARK} />
              {showMonth ? (
                <text x={x - 8} y={height - 10} fontSize="11" fill="#64748b">
                  {p.month}
                </text>
              ) : null}
            </g>
          );
        })}

        <text x={width / 2 - 92} y={height - 4} fontSize="12" fill="#334155">
          X Axis = Program Length In Months
        </text>
        <text
          x={-145}
          y={14}
          transform="rotate(-90)"
          fontSize="12"
          fill="#334155"
        >
          Y Axis = Revenue Earned
        </text>
      </svg>
    </div>
  );
}

function MiniInfographic({
  title,
  items,
}: {
  title: string;
  items: { label: string; month: string; detail: string }[];
}) {
  return (
    <div style={cardStyle()}>
      <div style={{ fontWeight: 800, fontSize: 18, color: "#0f172a" }}>{title}</div>
      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {items.map((item, idx) => (
          <div
            key={idx}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              padding: 14,
              background: idx % 2 ? "#f8fafc" : "#ffffff",
            }}
          >
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
              {item.label}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 24,
                fontWeight: 800,
                color: FT_GREEN_DARK,
              }}
            >
              {item.month}
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 13,
                color: "#475569",
                lineHeight: 1.6,
              }}
            >
              {item.detail}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgramAccordion({
  program,
  open,
  onToggle,
}: {
  program: ConsumerShieldProgram;
  open: boolean;
  onToggle: () => void;
}) {
  const net = program.payment - 40;
  const front = net * 4;
  const tail = net * 0.35;
  const full = front + Math.max(0, program.term - 4) * tail;

  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 16,
        overflow: "hidden",
        background: "#fff",
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          textAlign: "left",
          background: "white",
          border: "none",
          padding: 16,
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontWeight: 800, color: "#0f172a" }}>{program.label}</div>
            <div style={{ marginTop: 4, fontSize: 13, color: "#64748b" }}>
              {program.debtRange} • {program.term} months • {money.format(program.payment)}/mo
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: FT_GREEN }}>
            {open ? "−" : "+"}
          </div>
        </div>
      </button>

      {open ? (
        <div style={{ borderTop: "1px solid #e2e8f0", padding: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            <MetricCard title="Net Payment" value={money.format(net)} />
            <MetricCard title="Front Revenue" value={money.format(front)} subtitle="Months 1-4" />
            <MetricCard
              title="Tail End - Revenue"
              value={money.format(tail)}
              subtitle="Per month from month 5+"
            />
            <MetricCard
              title="Full Revenue"
              value={money.format(full)}
              subtitle="If client completes full term"
            />
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: "#475569", lineHeight: 1.7 }}>
            *All CS deals between {program.debtRange} are structured for {program.term} months based on the pricing grid supplied.
          </div>
        </div>
      ) : null}
    </div>
  );
}

function KnowledgeBase({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 20,
        bottom: 88,
        width: 420,
        maxWidth: "calc(100vw - 24px)",
        maxHeight: "70vh",
        overflowY: "auto",
        zIndex: 999,
        background: "#fff",
        border: "1px solid #dbeafe",
        borderRadius: 18,
        boxShadow: "0 20px 40px rgba(15,23,42,0.20)",
        padding: 18,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
            Legend / Knowledge Base
          </div>
          <div style={{ marginTop: 4, fontSize: 13, color: "#64748b" }}>
            How the engine calculates every major number.
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            border: "none",
            background: "#f1f5f9",
            borderRadius: 10,
            width: 34,
            height: 34,
            cursor: "pointer",
            fontWeight: 800,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 800, color: "#0f172a" }}>Risk Assumptions</div>
          <InfoText>
            These sliders are operating assumptions for survival to payment 2, payment 4, break-even month, and full completion.
          </InfoText>
        </div>

        <div>
          <div style={{ fontWeight: 800, color: "#0f172a" }}>Level Debt</div>
          <InfoText>
            Revenue is modeled as 8% of enrolled debt. After 2 successful program payments, Funding Tier is treated as free and clear of chargeback liability.
          </InfoText>
        </div>

        <div>
          <div style={{ fontWeight: 800, color: "#0f172a" }}>Consumer Shield</div>
          <InfoText>Net payment = program payment minus $40 servicing.</InfoText>
          <InfoText>Months 1-4 revenue = 100% of net payment.</InfoText>
          <InfoText>Month 5+ revenue = 35% of net payment per month.</InfoText>
          <InfoText>
            Worst-case liability treatment: each Consumer Shield payment is only considered fully clear 4 months after that payment was processed with the bank.
          </InfoText>
        </div>

        <div>
          <div style={{ fontWeight: 800, color: "#0f172a" }}>Expected Revenue</div>
          <InfoText>
            Expected revenue is built from staged survival assumptions instead of assuming every client completes.
          </InfoText>
        </div>

        <div>
          <div style={{ fontWeight: 800, color: "#0f172a" }}>Break-Even Month</div>
          <InfoText>
            This is the month where Consumer Shield cumulative revenue finally catches or exceeds what Level Debt would have already paid at 8%.
          </InfoText>
        </div>

        <div>
          <div style={{ fontWeight: 800, color: "#0f172a" }}>Payout Timing</div>
          <InfoText>
            The infographics use an assumed “funds hit bank” timing of roughly the month after the payment is processed. Adjust that if your real remittance timing differs.
          </InfoText>
        </div>
      </div>
    </div>
  );
}

export default function FundingTierProfitabilityBalancer() {
  const [debtAmount, setDebtAmount] = useState<number>(20000);
  const [survive2Pct, setSurvive2Pct] = useState<number>(75);
  const [survive4Pct, setSurvive4Pct] = useState<number>(60);
  const [surviveBreakEvenPct, setSurviveBreakEvenPct] = useState<number>(40);
  const [completePct, setCompletePct] = useState<number>(25);
  const [leadQualityScore, setLeadQualityScore] = useState<number>(75);
  const [cashUrgencyScore, setCashUrgencyScore] = useState<number>(60);

  const [levelRepPct, setLevelRepPct] = useState<number>(1.25);
  const [csRepUpfront, setCsRepUpfront] = useState<number>(200);
  const [csRepAfter4, setCsRepAfter4] = useState<number>(75);

  const [portfolioDeals, setPortfolioDeals] = useState<number>(100);
  const [portfolioAverageDebt, setPortfolioAverageDebt] = useState<number>(18000);
  const [portfolioLevelMixPct, setPortfolioLevelMixPct] = useState<number>(70);

  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [openProgram, setOpenProgram] = useState<string | null>("CS Program A");

  const survive2Rate = clamp(survive2Pct / 100, 0, 1);
  const survive4Rate = clamp(survive4Pct / 100, 0, 1);
  const surviveBreakEvenRate = clamp(surviveBreakEvenPct / 100, 0, 1);
  const completeRate = clamp(completePct / 100, 0, 1);

  const deal = useMemo(
    () =>
      calculateDealMetrics({
        debtAmount,
        survive2Rate,
        survive4Rate,
        surviveBreakEvenRate,
        completeRate,
        leadQualityScore,
        cashUrgencyScore,
      }),
    [
      debtAmount,
      survive2Rate,
      survive4Rate,
      surviveBreakEvenRate,
      completeRate,
      leadQualityScore,
      cashUrgencyScore,
    ]
  );

  const repEconomics = useMemo(() => {
    const levelRepCost = round2(debtAmount * (levelRepPct / 100));
    const csRepCostExpected = round2(csRepUpfront + csRepAfter4 * survive4Rate);

    return {
      levelRepCost,
      csRepCostExpected,
      levelNetAfterRep: round2(deal.levelDebtRevenue - levelRepCost),
      consumerShieldNetAfterRep: round2(
        (deal.consumerShieldExpectedRevenue ?? 0) - csRepCostExpected
      ),
    };
  }, [debtAmount, levelRepPct, csRepUpfront, csRepAfter4, survive4Rate, deal]);

  const portfolio = useMemo(() => {
    const levelCount = Math.round((portfolioDeals * portfolioLevelMixPct) / 100);
    const csCount = portfolioDeals - levelCount;

    const averageDeal = calculateDealMetrics({
      debtAmount: portfolioAverageDebt,
      survive2Rate,
      survive4Rate,
      surviveBreakEvenRate,
      completeRate,
      leadQualityScore,
      cashUrgencyScore,
    });

    const levelGross = round2(levelCount * averageDeal.levelDebtRevenue);
    const csExpectedGross = round2(
      csCount * (averageDeal.consumerShieldExpectedRevenue ?? 0)
    );
    const csFullUpside = round2(
      csCount * (averageDeal.consumerShieldRevenueAtFull ?? 0)
    );

    const levelRepCost = round2(
      levelCount * portfolioAverageDebt * (levelRepPct / 100)
    );
    const csRepCost = round2(
      csCount * (csRepUpfront + csRepAfter4 * survive4Rate)
    );

    const totalGrossExpected = round2(levelGross + csExpectedGross);
    const totalRepCost = round2(levelRepCost + csRepCost);
    const totalNetExpected = round2(totalGrossExpected - totalRepCost);

    return {
      levelCount,
      csCount,
      levelGross,
      csExpectedGross,
      csFullUpside,
      levelRepCost,
      csRepCost,
      totalGrossExpected,
      totalRepCost,
      totalNetExpected,
    };
  }, [
    portfolioDeals,
    portfolioLevelMixPct,
    portfolioAverageDebt,
    survive2Rate,
    survive4Rate,
    surviveBreakEvenRate,
    completeRate,
    leadQualityScore,
    cashUrgencyScore,
    levelRepPct,
    csRepUpfront,
    csRepAfter4,
  ]);

  const groupedCharts = [
    {
      term: 18,
      items: consumerShieldPrograms.filter((p) => p.term === 18),
    },
    {
      term: 24,
      items: consumerShieldPrograms.filter((p) => p.term === 24),
    },
    {
      term: 36,
      items: consumerShieldPrograms.filter((p) => p.term === 36),
    },
  ].filter((g) => g.items.length > 0);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: FT_BG,
        color: "#0f172a",
        fontFamily:
          'Inter, Arial, Helvetica, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
      }}
    >
      <KnowledgeBase open={knowledgeOpen} onClose={() => setKnowledgeOpen(false)} />

      <button
        onClick={() => setKnowledgeOpen(true)}
        style={{
          position: "fixed",
          right: 20,
          bottom: 20,
          zIndex: 1000,
          border: "none",
          borderRadius: 999,
          background: FT_GREEN,
          color: "#fff",
          padding: "14px 18px",
          fontWeight: 800,
          boxShadow: "0 12px 30px rgba(15,157,138,0.35)",
          cursor: "pointer",
        }}
      >
        Legend / Knowledge Base
      </button>

      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(248,250,252,0.96)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div
          style={{
            maxWidth: 1380,
            margin: "0 auto",
            padding: "12px 18px 18px",
          }}
        >
          <div
            style={{
              background:
                "linear-gradient(135deg, #0f172a 0%, #0b3b50 45%, #0f766e 100%)",
              color: "#fff",
              borderRadius: 24,
              padding: 22,
              boxShadow: "0 10px 30px rgba(15, 23, 42, 0.18)",
            }}
          >
            <img
              src={FT_LOGO}
              alt="Funding Tier"
              style={{ height: 42, width: "auto", display: "block", marginBottom: 10 }}
            />

            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.75)",
              }}
            >
              Funding Tier
            </div>

            <h1
              style={{
                margin: "8px 0 10px",
                fontSize: 36,
                lineHeight: 1.1,
                fontWeight: 900,
              }}
            >
              Profit Engine
            </h1>

            <p
              style={{
                margin: 0,
                maxWidth: 920,
                color: "rgba(255,255,255,0.88)",
                lineHeight: 1.7,
                fontSize: 15,
              }}
            >
              Compare Level Debt versus Consumer Shield using staged survival risk, payout timing, liability timing, break-even logic, and portfolio mix across deals above $7,000.
            </p>

            <div style={{ marginTop: 18 }}>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 14 }}>
                Risk Assumptions
              </div>

              <div className="assumption-grid">
                <div>
                  <Label>Total Enrolled Debt</Label>
                  <NumberInput value={debtAmount} onChange={setDebtAmount} min={0} step={100} />
                </div>
                <div>
                  <Label>Payment 2</Label>
                  <Slider value={survive2Pct} onChange={setSurvive2Pct} />
                </div>
                <div>
                  <Label>Payment 4</Label>
                  <Slider value={survive4Pct} onChange={setSurvive4Pct} />
                </div>
                <div>
                  <Label>Break-Even</Label>
                  <Slider value={surviveBreakEvenPct} onChange={setSurviveBreakEvenPct} />
                </div>
                <div>
                  <Label>Completion</Label>
                  <Slider value={completePct} onChange={setCompletePct} />
                </div>
                <div>
                  <Label>Lead Quality</Label>
                  <Slider value={leadQualityScore} onChange={setLeadQualityScore} />
                </div>
                <div>
                  <Label>Cash Urgency</Label>
                  <Slider value={cashUrgencyScore} onChange={setCashUrgencyScore} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          maxWidth: 1380,
          margin: "0 auto",
          padding: "20px 18px 40px",
          display: "grid",
          gap: 20,
        }}
      >
        <div className="top-metric-grid">
          <MetricCard
            title="Recommended Backend"
            value={deal.recommendedBackend}
            subtitle={deal.recommendationReason}
          />
          <MetricCard
            title="Level Debt Revenue"
            value={money.format(deal.levelDebtRevenue)}
            subtitle={
              deal.levelDebtRevShareEligible
                ? "120k+ debt flagged for possible extra rev share"
                : "Base 8% commission"
            }
          />
          <MetricCard
            title="Consumer Shield Expected Revenue"
            value={money.format(deal.consumerShieldExpectedRevenue ?? 0)}
            subtitle="Blended from payment 2, payment 4, break-even, and completion assumptions"
          />
          <MetricCard
            title="Break-Even Month"
            value={
              deal.consumerShieldBreakEvenMonthVsLevel
                ? `Month ${deal.consumerShieldBreakEvenMonthVsLevel}`
                : "N/A"
            }
            subtitle="When CS cumulative revenue reaches Level Debt 8%"
          />
        </div>

        <div className="two-col-grid">
          <div style={cardStyle()}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <img
                src={LEVEL_DEBT_LOGO}
                alt="Level Debt"
                style={{ height: 36, width: "auto", objectFit: "contain" }}
              />
              <SectionTitle>Level Debt Snapshot</SectionTitle>
            </div>

            <div className="metric-grid-2">
              <MetricCard title="Debt Amount" value={money.format(deal.debtAmount)} />
              <MetricCard title="Gross Revenue" value={money.format(deal.levelDebtRevenue)} />
              <MetricCard title="Rep Cost" value={money.format(repEconomics.levelRepCost)} />
              <MetricCard title="Net After Rep" value={money.format(repEconomics.levelNetAfterRep)} />
            </div>
          </div>

          <div style={cardStyle()}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <img
                src={CONSUMER_SHIELD_LOGO}
                alt="Consumer Shield"
                style={{ height: 34, width: "auto", objectFit: "contain" }}
              />
              <SectionTitle>Consumer Shield Snapshot</SectionTitle>
            </div>

            <div className="metric-grid-2">
              <MetricCard
                title="Program Payment"
                value={money.format(deal.consumerShieldPayment ?? 0)}
                subtitle={
                  deal.consumerShieldTerm
                    ? `${deal.consumerShieldTerm} month term`
                    : undefined
                }
              />
              <MetricCard
                title="Net Payment"
                value={money.format(deal.consumerShieldNetPayment ?? 0)}
                subtitle="Program payment minus $40 servicing"
              />
              <MetricCard
                title="Front Revenue"
                value={money.format(deal.consumerShieldFrontRevenue ?? 0)}
                subtitle="Months 1 through 4"
              />
              <MetricCard
                title="Tail End - Revenue"
                value={money.format(deal.consumerShieldBackRevenueMonthly ?? 0)}
                subtitle="Per month from month 5+"
              />
            </div>
          </div>
        </div>

        <div style={cardStyle()}>
          <SectionTitle>Early Revenue Milestones</SectionTitle>
          <div className="top-metric-grid" style={{ marginTop: 18 }}>
            <MetricCard title="After Payment 1" value={money.format(deal.consumerShieldRevenueAfter1 ?? 0)} />
            <MetricCard title="After Payment 2" value={money.format(deal.consumerShieldRevenueAfter2 ?? 0)} />
            <MetricCard title="After Payment 4" value={money.format(deal.consumerShieldRevenueAfter4 ?? 0)} />
            <MetricCard
              title="Net After Expected Rep Cost"
              value={money.format(repEconomics.consumerShieldNetAfterRep)}
              subtitle={`Expected rep cost: ${money.format(repEconomics.csRepCostExpected)}`}
            />
          </div>
        </div>

        <div className="two-col-grid">
          <MiniInfographic
            title="Level Debt Payout + Liability Timing"
            items={[
              {
                label: "Expected Funds Hit Bank",
                month: "After Month 2",
                detail:
                  "Operational assumption: revenue is recognized after two cleared program payments.",
              },
              {
                label: "Chargeback Liability Free",
                month: "After Month 2",
                detail:
                  "After 2 successful program payments, Funding Tier is treated as free and clear of chargeback liability on Level Debt deals.",
              },
            ]}
          />

          <MiniInfographic
            title="Consumer Shield Payout + Liability Timing"
            items={[
              {
                label: "Expected Funds Hit Bank",
                month: "Month +1",
                detail:
                  "Assumed payout timing shown as one month after each payment is processed. Adjust operationally if your remittance timing differs.",
              },
              {
                label: "Chargeback Liability Free",
                month: "Payment Month +4",
                detail:
                  "Worst-case treatment: each individual Consumer Shield payment is only considered secured and clear 4 months after the ACH/payment processed with the bank.",
              },
            ]}
          />
        </div>

        <div style={cardStyle()}>
          <SectionTitle>Consumer Shield Revenue Curves By Program Length</SectionTitle>
          <div style={{ marginTop: 10, fontSize: 13, color: "#64748b", lineHeight: 1.7 }}>
            Each chart shows how revenue compounds over time for the Consumer Shield offers tied to that program length.
          </div>

          <div style={{ marginTop: 18, display: "grid", gap: 18 }}>
            {groupedCharts.map((group) => {
              const representative = group.items[group.items.length - 1];
              const ranges = group.items.map((i) => i.debtRange).join(", ");
              return (
                <SimpleRevenueChart
                  key={group.term}
                  title={`${group.term}-Month Consumer Shield Programs`}
                  subtitle={`*All CS deals between ${ranges} are structured for ${group.term} months based on the payment grid supplied.`}
                  payment={representative.payment}
                  term={group.term}
                />
              );
            })}
          </div>
        </div>

        <div style={cardStyle()}>
          <SectionTitle>Consumer Shield Offerings / Retention Scenarios</SectionTitle>
          <div style={{ marginTop: 10, fontSize: 13, color: "#64748b", lineHeight: 1.7 }}>
            Expand each offering to see the debt band, term, front revenue, tail-end revenue, and full-program revenue profile.
          </div>

          <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
            {consumerShieldPrograms.map((program) => (
              <ProgramAccordion
                key={program.label}
                program={program}
                open={openProgram === program.label}
                onToggle={() =>
                  setOpenProgram((curr) => (curr === program.label ? null : program.label))
                }
              />
            ))}
          </div>
        </div>

        <div style={cardStyle()}>
          <SectionTitle>Consumer Shield Monthly Revenue Timeline</SectionTitle>

          <div
            style={{
              marginTop: 18,
              overflowX: "auto",
              border: "1px solid #e2e8f0",
              borderRadius: 16,
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 14,
              }}
            >
              <thead>
                <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                  <th style={thStyle}>Month</th>
                  <th style={thStyle}>Phase</th>
                  <th style={thStyle}>Monthly Revenue</th>
                  <th style={thStyle}>Cumulative Revenue</th>
                  <th style={thStyle}>Assumed Funds Hit</th>
                  <th style={thStyle}>Liability Clears</th>
                </tr>
              </thead>
              <tbody>
                {deal.consumerShieldTimeline.map((row) => (
                  <tr key={row.month}>
                    <td style={tdStyle}>{row.month}</td>
                    <td style={tdStyle}>{row.phase}</td>
                    <td style={tdStyle}>{money.format(row.monthlyRevenue)}</td>
                    <td style={tdStyle}>{money.format(row.cumulativeRevenue)}</td>
                    <td style={tdStyle}>Month {row.payoutHitMonthAssumed}</td>
                    <td style={tdStyle}>Month {row.liabilityFreeMonth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={cardStyle()}>
          <SectionTitle>Portfolio Forecast For Deals Above $7,000</SectionTitle>

          <div className="portfolio-controls">
            <div>
              <Label>Number of Deals</Label>
              <NumberInput
                value={portfolioDeals}
                onChange={setPortfolioDeals}
                min={1}
                step={1}
              />
            </div>

            <div>
              <Label>Average Debt Amount</Label>
              <NumberInput
                value={portfolioAverageDebt}
                onChange={setPortfolioAverageDebt}
                min={7001}
                step={100}
              />
            </div>

            <div>
              <Label>% Routed To Level Debt</Label>
              <Slider
                value={portfolioLevelMixPct}
                onChange={setPortfolioLevelMixPct}
              />
            </div>
          </div>

          <div className="top-metric-grid" style={{ marginTop: 18 }}>
            <MetricCard
              title="Level Debt Deal Count"
              value={String(portfolio.levelCount)}
              subtitle={`${percentFmt.format(portfolioLevelMixPct / 100)} of portfolio`}
            />
            <MetricCard
              title="Consumer Shield Deal Count"
              value={String(portfolio.csCount)}
              subtitle={`${percentFmt.format((100 - portfolioLevelMixPct) / 100)} of portfolio`}
            />
            <MetricCard
              title="Expected Gross Revenue"
              value={money.format(portfolio.totalGrossExpected)}
            />
            <MetricCard
              title="Expected Net Revenue"
              value={money.format(portfolio.totalNetExpected)}
            />
          </div>

          <div
            style={{
              marginTop: 18,
              overflowX: "auto",
              border: "1px solid #e2e8f0",
              borderRadius: 16,
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 14,
              }}
            >
              <thead>
                <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                  <th style={thStyle}>Metric</th>
                  <th style={thStyle}>Level Debt Portion</th>
                  <th style={thStyle}>Consumer Shield Portion</th>
                  <th style={thStyle}>Combined</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdStyle}>Deal Count</td>
                  <td style={tdStyle}>{portfolio.levelCount}</td>
                  <td style={tdStyle}>{portfolio.csCount}</td>
                  <td style={tdStyle}>{portfolioDeals}</td>
                </tr>
                <tr>
                  <td style={tdStyle}>Gross Revenue</td>
                  <td style={tdStyle}>{money.format(portfolio.levelGross)}</td>
                  <td style={tdStyle}>{money.format(portfolio.csExpectedGross)}</td>
                  <td style={tdStyle}>{money.format(portfolio.totalGrossExpected)}</td>
                </tr>
                <tr>
                  <td style={tdStyle}>Rep Cost</td>
                  <td style={tdStyle}>{money.format(portfolio.levelRepCost)}</td>
                  <td style={tdStyle}>{money.format(portfolio.csRepCost)}</td>
                  <td style={tdStyle}>{money.format(portfolio.totalRepCost)}</td>
                </tr>
                <tr>
                  <td style={tdStyle}>Net Revenue</td>
                  <td style={tdStyle}>{money.format(portfolio.levelGross - portfolio.levelRepCost)}</td>
                  <td style={tdStyle}>{money.format(portfolio.csExpectedGross - portfolio.csRepCost)}</td>
                  <td style={tdStyle}>{money.format(portfolio.totalNetExpected)}</td>
                </tr>
                <tr>
                  <td style={tdStyle}>CS Full-Upside Reference</td>
                  <td style={tdStyle}>-</td>
                  <td style={tdStyle}>{money.format(portfolio.csFullUpside)}</td>
                  <td style={tdStyle}>{money.format(portfolio.levelGross + portfolio.csFullUpside)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style={cardStyle()}>
          <SectionTitle>Operator Notes</SectionTitle>
          <InfoText>
            Payment 2 is your first real quality checkpoint. If payment 2 survival is weak, Consumer Shield exposure should stay tight.
          </InfoText>
          <InfoText>
            Payment 4 tells you whether the front-end Consumer Shield economics are actually materializing.
          </InfoText>
          <InfoText>
            Break-even month shows how long it takes Consumer Shield to catch the more immediate Level Debt economics.
          </InfoText>
          <InfoText>
            Liability timing matters. On Consumer Shield, each payment should be viewed separately because each payment clears its own 4-month bank chargeback window.
          </InfoText>
        </div>
      </div>

      <style jsx>{`
        .assumption-grid {
          display: grid;
          grid-template-columns: 1.2fr repeat(6, 1fr);
          gap: 14px;
          align-items: end;
        }

        .top-metric-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .two-col-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .metric-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .portfolio-controls {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 16px;
          margin-top: 18px;
        }

        @media (max-width: 1180px) {
          .assumption-grid,
          .top-metric-grid,
          .two-col-grid,
          .portfolio-controls,
          .metric-grid-2 {
            grid-template-columns: 1fr 1fr !important;
          }
        }

        @media (max-width: 720px) {
          .assumption-grid,
          .top-metric-grid,
          .two-col-grid,
          .portfolio-controls,
          .metric-grid-2 {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid #e2e8f0",
  color: "#334155",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid #e2e8f0",
  color: "#0f172a",
  whiteSpace: "nowrap",
};
