"use client";

import React, { useMemo, useState } from "react";

type TimelineRow = {
  month: number;
  phase: "Front" | "Backend";
  monthlyRevenue: number;
  cumulativeRevenue: number;
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

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const percentFmt = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getConsumerShieldPayment(debtAmount: number): number | null {
  if (debtAmount < 4000) return null;
  if (debtAmount < 10000) return 220;
  if (debtAmount < 15000) return 270;
  if (debtAmount < 20000) return 320;
  if (debtAmount < 25000) return 370;
  if (debtAmount < 30000) return 420;
  if (debtAmount < 50000) return 520;
  return 620;
}

function getConsumerShieldTerm(debtAmount: number): number | null {
  if (debtAmount < 4000) return null;
  if (debtAmount < 5000) return 18;
  if (debtAmount < 8800) return 24;
  return 36;
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
    const cumulativeRevenue = getConsumerShieldRevenueAtMonth(
      month,
      netPayment,
      term
    );

    rows.push({
      month,
      phase,
      monthlyRevenue: round2(monthlyRevenue),
      cumulativeRevenue,
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
    const cumulative = getConsumerShieldRevenueAtMonth(month, netPayment, term);
    if (cumulative >= levelDebtRevenue) return month;
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
    padding: 20,
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
          fontSize: 13,
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
          fontSize: 30,
          fontWeight: 800,
          color: "#0f172a",
          lineHeight: 1.1,
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
        fontSize: 14,
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
        padding: "12px 14px",
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
        style={{ width: "100%" }}
      />
      <div
        style={{
          marginTop: 6,
          fontSize: 13,
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
      averageDeal,
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

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#0f172a",
        fontFamily:
          'Inter, Arial, Helvetica, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 1380,
          margin: "0 auto",
          padding: "24px 18px 40px",
        }}
      >
        <div
          style={{
            background:
              "linear-gradient(135deg, #0f172a 0%, #0b3b50 45%, #0f766e 100%)",
            color: "#fff",
            borderRadius: 24,
            padding: 28,
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.18)",
            marginBottom: 24,
          }}
        >
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
              fontSize: 38,
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
            Compare Level Debt versus Consumer Shield using payment 2, payment 4,
            break-even month, expected value, rep compensation, and portfolio mix
            across deals above $7,000.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "360px 1fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: 20 }}>
            <div style={cardStyle()}>
              <SectionTitle>Deal Inputs</SectionTitle>

              <div style={{ marginTop: 18 }}>
                <Label>Total Enrolled Debt</Label>
                <NumberInput
                  value={debtAmount}
                  onChange={setDebtAmount}
                  min={0}
                  step={100}
                />
              </div>

              <div style={{ marginTop: 18 }}>
                <Label>Payment 2 Survival Rate</Label>
                <Slider value={survive2Pct} onChange={setSurvive2Pct} />
              </div>

              <div style={{ marginTop: 18 }}>
                <Label>Payment 4 Survival Rate</Label>
                <Slider value={survive4Pct} onChange={setSurvive4Pct} />
              </div>

              <div style={{ marginTop: 18 }}>
                <Label>Break-Even Survival Rate</Label>
                <Slider
                  value={surviveBreakEvenPct}
                  onChange={setSurviveBreakEvenPct}
                />
              </div>

              <div style={{ marginTop: 18 }}>
                <Label>Full Completion Rate</Label>
                <Slider value={completePct} onChange={setCompletePct} />
              </div>

              <div style={{ marginTop: 18 }}>
                <Label>Lead Quality Score</Label>
                <Slider value={leadQualityScore} onChange={setLeadQualityScore} />
              </div>

              <div style={{ marginTop: 18 }}>
                <Label>Short-Term Cash Urgency</Label>
                <Slider value={cashUrgencyScore} onChange={setCashUrgencyScore} />
              </div>
            </div>

            <div style={cardStyle()}>
              <SectionTitle>Sales Rep Economics</SectionTitle>

              <div style={{ marginTop: 18 }}>
                <Label>Level Debt Rep Payout (% of enrolled debt)</Label>
                <NumberInput
                  value={levelRepPct}
                  onChange={setLevelRepPct}
                  min={0}
                  max={10}
                  step={0.05}
                />
              </div>

              <div style={{ marginTop: 18 }}>
                <Label>Consumer Shield Upfront Rep Payout ($)</Label>
                <NumberInput
                  value={csRepUpfront}
                  onChange={setCsRepUpfront}
                  min={0}
                  step={25}
                />
              </div>

              <div style={{ marginTop: 18 }}>
                <Label>Consumer Shield Payment 4 Milestone Payout ($)</Label>
                <NumberInput
                  value={csRepAfter4}
                  onChange={setCsRepAfter4}
                  min={0}
                  step={25}
                />
              </div>
            </div>

            <div
              style={{
                ...cardStyle(),
                background: "#fff7ed",
                border: "1px solid #fed7aa",
              }}
            >
              <SectionTitle>Rules In This Engine</SectionTitle>
              <InfoText>
                Deals from $4,000 to $7,000 are marked as guaranteed Consumer Shield
                routing.
              </InfoText>
              <InfoText>
                Level Debt is modeled at 8% of enrolled debt. The 120k+ rev share is
                flagged but not calculated into totals yet.
              </InfoText>
              <InfoText>
                Consumer Shield uses your fixed payment and term grid. Months 1 to 4
                keep 100% of net payment. Month 5 forward keeps 35% of net payment.
              </InfoText>
            </div>
          </div>

          <div style={{ display: "grid", gap: 20 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 16,
              }}
            >
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

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20,
              }}
            >
              <div style={cardStyle()}>
                <SectionTitle>Level Debt Snapshot</SectionTitle>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 14,
                    marginTop: 18,
                  }}
                >
                  <MetricCard
                    title="Debt Amount"
                    value={money.format(deal.debtAmount)}
                  />
                  <MetricCard
                    title="Gross Revenue"
                    value={money.format(deal.levelDebtRevenue)}
                  />
                  <MetricCard
                    title="Rep Cost"
                    value={money.format(repEconomics.levelRepCost)}
                  />
                  <MetricCard
                    title="Net After Rep"
                    value={money.format(repEconomics.levelNetAfterRep)}
                  />
                </div>
              </div>

              <div style={cardStyle()}>
                <SectionTitle>Consumer Shield Snapshot</SectionTitle>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 14,
                    marginTop: 18,
                  }}
                >
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
                    title="Backend Revenue Per Month"
                    value={money.format(deal.consumerShieldBackRevenueMonthly ?? 0)}
                    subtitle="Starts in month 5"
                  />
                </div>
              </div>
            </div>

            <div style={cardStyle()}>
              <SectionTitle>Early Revenue Milestones</SectionTitle>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 14,
                  marginTop: 18,
                }}
              >
                <MetricCard
                  title="After Payment 1"
                  value={money.format(deal.consumerShieldRevenueAfter1 ?? 0)}
                />
                <MetricCard
                  title="After Payment 2"
                  value={money.format(deal.consumerShieldRevenueAfter2 ?? 0)}
                />
                <MetricCard
                  title="After Payment 4"
                  value={money.format(deal.consumerShieldRevenueAfter4 ?? 0)}
                />
                <MetricCard
                  title="Net After Expected Rep Cost"
                  value={money.format(repEconomics.consumerShieldNetAfterRep)}
                  subtitle={`Expected rep cost: ${money.format(
                    repEconomics.csRepCostExpected
                  )}`}
                />
              </div>
            </div>

            <div style={cardStyle()}>
              <SectionTitle>Retention Scenarios</SectionTitle>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 14,
                  marginTop: 18,
                }}
              >
                <MetricCard
                  title="1/4 Program Revenue"
                  value={money.format(deal.consumerShieldRevenueAtQuarter ?? 0)}
                />
                <MetricCard
                  title="1/2 Program Revenue"
                  value={money.format(deal.consumerShieldRevenueAtHalf ?? 0)}
                />
                <MetricCard
                  title="Full Program Revenue"
                  value={money.format(deal.consumerShieldRevenueAtFull ?? 0)}
                />
                <MetricCard
                  title="Full Backend Revenue"
                  value={money.format(deal.consumerShieldBackRevenueFull ?? 0)}
                />
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
                    </tr>
                  </thead>
                  <tbody>
                    {deal.consumerShieldTimeline.map((row) => (
                      <tr key={row.month}>
                        <td style={tdStyle}>{row.month}</td>
                        <td style={tdStyle}>{row.phase}</td>
                        <td style={tdStyle}>{money.format(row.monthlyRevenue)}</td>
                        <td style={tdStyle}>
                          {money.format(row.cumulativeRevenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={cardStyle()}>
              <SectionTitle>Portfolio Forecast For Deals Above $7,000</SectionTitle>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 16,
                  marginTop: 18,
                }}
              >
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

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 14,
                  marginTop: 18,
                }}
              >
                <MetricCard
                  title="Level Debt Deal Count"
                  value={String(portfolio.levelCount)}
                  subtitle={`${percentFmt.format(
                    portfolioLevelMixPct / 100
                  )} of portfolio`}
                />
                <MetricCard
                  title="Consumer Shield Deal Count"
                  value={String(portfolio.csCount)}
                  subtitle={`${percentFmt.format(
                    (100 - portfolioLevelMixPct) / 100
                  )} of portfolio`}
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
                      <td style={tdStyle}>
                        {money.format(portfolio.csExpectedGross)}
                      </td>
                      <td style={tdStyle}>
                        {money.format(portfolio.totalGrossExpected)}
                      </td>
                    </tr>
                    <tr>
                      <td style={tdStyle}>Rep Cost</td>
                      <td style={tdStyle}>
                        {money.format(portfolio.levelRepCost)}
                      </td>
                      <td style={tdStyle}>{money.format(portfolio.csRepCost)}</td>
                      <td style={tdStyle}>{money.format(portfolio.totalRepCost)}</td>
                    </tr>
                    <tr>
                      <td style={tdStyle}>Net Revenue</td>
                      <td style={tdStyle}>
                        {money.format(portfolio.levelGross - portfolio.levelRepCost)}
                      </td>
                      <td style={tdStyle}>
                        {money.format(
                          portfolio.csExpectedGross - portfolio.csRepCost
                        )}
                      </td>
                      <td style={tdStyle}>
                        {money.format(portfolio.totalNetExpected)}
                      </td>
                    </tr>
                    <tr>
                      <td style={tdStyle}>CS Full-Upside Reference</td>
                      <td style={tdStyle}>-</td>
                      <td style={tdStyle}>{money.format(portfolio.csFullUpside)}</td>
                      <td style={tdStyle}>
                        {money.format(portfolio.levelGross + portfolio.csFullUpside)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div style={cardStyle()}>
              <SectionTitle>Operator Notes</SectionTitle>
              <InfoText>
                Payment 2 is your early reality check. If payment 2 retention is weak,
                Consumer Shield exposure should stay tight.
              </InfoText>
              <InfoText>
                Payment 4 tells you whether the front-end Consumer Shield economics are
                actually being realized.
              </InfoText>
              <InfoText>
                Break-even month shows when Consumer Shield finally catches what Level
                Debt would already have locked in.
              </InfoText>
              <InfoText>
                The portfolio simulator is what you use to decide what percentage of
                deals above $7,000 should go to each backend.
              </InfoText>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 1180px) {
          div[data-main-grid] {
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
