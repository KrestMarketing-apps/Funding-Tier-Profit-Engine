"use client";

import React, { useMemo, useState } from "react";

/* ===========================
   TYPES
=========================== */

type TimelineRow = {
  month: number;
  monthlyRevenue: number;
  cumulativeRevenue: number;
  phase: "Front" | "Backend";
};

type DealMetrics = {
  debtAmount: number;
  levelDebtRevenue: number;
  consumerShieldPayment: number;
  consumerShieldTerm: number;
  netPayment: number;

  revenueAfter1: number;
  revenueAfter2: number;
  revenueAfter4: number;

  frontRevenue: number;
  backendMonthly: number;
  backendFull: number;

  fullRevenue: number;
  breakEvenMonth: number | null;
  expectedRevenue: number;

  timeline: TimelineRow[];
};

/* ===========================
   CONSTANTS
=========================== */

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/* ===========================
   HELPERS
=========================== */

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/* ===========================
   CONSUMER SHIELD TIERS
=========================== */

function getPayment(debt: number) {
  if (debt < 10000) return 220;
  if (debt < 15000) return 270;
  if (debt < 20000) return 320;
  if (debt < 25000) return 370;
  if (debt < 30000) return 420;
  if (debt < 50000) return 520;
  return 620;
}

function getTerm(debt: number) {
  if (debt < 5000) return 18;
  if (debt < 8800) return 24;
  return 36;
}

/* ===========================
   CORE CALCULATOR
=========================== */

function calc(debt: number): DealMetrics {
  const payment = getPayment(debt);
  const term = getTerm(debt);
  const net = payment - 40;

  const level = debt * 0.08;

  const revenueAt = (m: number) => {
    if (m <= 4) return net * m;
    return net * 4 + (m - 4) * net * 0.35;
  };

  const timeline: TimelineRow[] = [];
  for (let i = 1; i <= term; i++) {
    timeline.push({
      month: i,
      monthlyRevenue: i <= 4 ? net : net * 0.35,
      cumulativeRevenue: revenueAt(i),
      phase: i <= 4 ? "Front" : "Backend",
    });
  }

  let breakEven: number | null = null;
  for (let i = 1; i <= term; i++) {
    if (revenueAt(i) >= level) {
      breakEven = i;
      break;
    }
  }

  const front = net * 4;
  const backendMonthly = net * 0.35;
  const backendFull = backendMonthly * (term - 4);
  const full = front + backendFull;

  return {
    debtAmount: debt,
    levelDebtRevenue: level,
    consumerShieldPayment: payment,
    consumerShieldTerm: term,
    netPayment: net,

    revenueAfter1: revenueAt(1),
    revenueAfter2: revenueAt(2),
    revenueAfter4: revenueAt(4),

    frontRevenue: front,
    backendMonthly,
    backendFull,
    fullRevenue: full,
    breakEvenMonth: breakEven,

    expectedRevenue: full * 0.35, // simple baseline

    timeline,
  };
}

/* ===========================
   UI
=========================== */

export default function FundingTierProfitabilityBalancer() {
  const [debt, setDebt] = useState(20000);

  const data = useMemo(() => calc(debt), [debt]);

  return (
    <div style={{ padding: 30, fontFamily: "Arial" }}>
      <h1>Funding Tier Profit Engine</h1>

      <div style={{ marginTop: 20 }}>
        <input
          type="number"
          value={debt}
          onChange={(e) => setDebt(Number(e.target.value))}
          style={{ padding: 10, fontSize: 16 }}
        />
      </div>

      <h2 style={{ marginTop: 30 }}>Level Debt</h2>
      <p>{money.format(data.levelDebtRevenue)}</p>

      <h2>Consumer Shield</h2>
      <p>Payment: {money.format(data.consumerShieldPayment)}</p>
      <p>Term: {data.consumerShieldTerm} months</p>

      <h3>Early Revenue</h3>
      <p>Payment 1: {money.format(data.revenueAfter1)}</p>
      <p>Payment 2: {money.format(data.revenueAfter2)}</p>
      <p>Payment 4: {money.format(data.revenueAfter4)}</p>

      <h3>Backend</h3>
      <p>Monthly Backend: {money.format(data.backendMonthly)}</p>

      <h3>Break Even</h3>
      <p>{data.breakEvenMonth ? `Month ${data.breakEvenMonth}` : "N/A"}</p>

      <h3>Total Revenue</h3>
      <p>{money.format(data.fullRevenue)}</p>

      <h3>Timeline</h3>
      <div style={{ maxHeight: 300, overflow: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Phase</th>
              <th>Monthly</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.timeline.map((row) => (
              <tr key={row.month}>
                <td>{row.month}</td>
                <td>{row.phase}</td>
                <td>{money.format(row.monthlyRevenue)}</td>
                <td>{money.format(row.cumulativeRevenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
