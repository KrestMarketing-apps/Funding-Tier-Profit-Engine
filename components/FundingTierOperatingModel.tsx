"use client";

import React, { useMemo, useState, useCallback } from "react";
import {
  DEFAULT_ASSUMPTIONS, simulatePortfolio,
  type Assumptions, type BackendKey, type MonthRow, type HiringEvent,
} from "./fundingTierEngine";

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────

const FT_GREEN = "#0f9d8a";
const FT_GREEN_DARK = "#0b7d6e";
const FT_BLUE = "#1a6ed8";
const FT_AMBER = "#f59e0b";
const FT_RED = "#ef4444";
const FT_PURPLE = "#6d28d9";
const FT_BG = "#f8fafc";
const FT_LOGO = "https://assets.cdn.filesafe.space/S4ztIlDxBovAboldwbOR/media/68783cf82035bab4d790ae7e.png";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pct = (v: number, digits = 1) => `${v.toFixed(digits)}%`;

const card: React.CSSProperties = {
  background: "#fff", border: "1px solid #e2e8f0",
  borderRadius: 16, padding: 16, boxShadow: "0 3px 12px rgba(15,23,42,0.05)",
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 8,
  border: "1px solid #cbd5e1", fontSize: 13, color: "#0f172a",
  background: "#fff", boxSizing: "border-box", fontFamily: "inherit",
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 5,
  textTransform: "uppercase", letterSpacing: 0.4, display: "flex", alignItems: "center", gap: 4,
};

// ─────────────────────────────────────────────
// TOOLTIP (reusable "?" hover badge — same pattern as FundingTierProfitabilityBalancer)
// ─────────────────────────────────────────────

function InlineTip({ text, width = 260 }: { text: string; width?: number }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", verticalAlign: "middle" }}>
      <span onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 15, height: 15, borderRadius: "50%", background: FT_GREEN,
          color: "#fff", fontSize: 9, fontWeight: 900, cursor: "help", flexShrink: 0 }}>?</span>
      {show && (
        <div style={{ position: "absolute", bottom: "130%", left: "50%", transform: "translateX(-50%)",
          background: "#0f172a", color: "#fff", borderRadius: 10, padding: "10px 13px",
          fontSize: 12, lineHeight: 1.65, width, zIndex: 300, textTransform: "none", fontWeight: 400,
          boxShadow: "0 8px 24px rgba(0,0,0,0.28)", pointerEvents: "none", whiteSpace: "pre-line" }}>
          {text}
        </div>
      )}
    </span>
  );
}

// ─────────────────────────────────────────────
// SHARED SUBCOMPONENTS
// ─────────────────────────────────────────────

function MetricCard({ title, value, subtitle, color = "#0f172a", tooltip }: {
  title: string; value: string; subtitle?: string; color?: string; tooltip?: string;
}) {
  return (
    <div style={card}>
      <div style={labelStyle}>{title}{tooltip && <InlineTip text={tooltip} />}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1.15, wordBreak: "break-word" }}>{value}</div>
      {subtitle && <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>{subtitle}</div>}
    </div>
  );
}

function Accordion({ title, subtitle, defaultOpen = false, children, accent = FT_GREEN, tooltip }: {
  title: string; subtitle?: string; defaultOpen?: boolean; children: React.ReactNode; accent?: string; tooltip?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, background: "#fff", borderLeft: `4px solid ${accent}` }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", textAlign: "left", background: "#fff", border: "none",
        padding: "13px 18px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
            {title}{tooltip && <InlineTip text={tooltip} width={300} />}
          </div>
          {subtitle && <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{subtitle}</div>}
        </div>
        <span style={{ fontSize: 20, fontWeight: 900, color: accent, flexShrink: 0, paddingLeft: 12 }}>{open ? "−" : "+"}</span>
      </button>
      {open && <div style={{ borderTop: "1px solid #e2e8f0", padding: 18 }}>{children}</div>}
    </div>
  );
}

function NumField({ label, value, onChange, step = 1, min, max, suffix, tooltip }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string; tooltip?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}{suffix ? ` (${suffix})` : ""}{tooltip && <InlineTip text={tooltip} />}</label>
      <input type="number" value={value} step={step} min={min} max={max}
        onChange={e => onChange(Number(e.target.value))} style={inputStyle} />
    </div>
  );
}

function PctField({ label, valuePct, onChangePct, step = 0.5, min = 0, max = 100, tooltip }: {
  label: string; valuePct: number; onChangePct: (v: number) => void; step?: number; min?: number; max?: number; tooltip?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}{tooltip && <InlineTip text={tooltip} />}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: 260 }}>
        <input type="range" min={min} max={max} step={step} value={valuePct}
          onChange={e => onChangePct(Number(e.target.value))}
          style={{ width: 170, flexShrink: 0, accentColor: FT_GREEN }} />
        <span style={{ fontSize: 13, fontWeight: 800, color: FT_GREEN_DARK, minWidth: 46, textAlign: "left" }}>{valuePct}%</span>
      </div>
    </div>
  );
}

function LockedField({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <label style={labelStyle}>
        {label}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, fontWeight: 800,
          color: "#92400e", background: "#fef3c7", padding: "1px 6px", borderRadius: 999, textTransform: "none" }}>
          🔒 Contract Term
        </span>
      </label>
      <div style={{ ...inputStyle, background: "#f8fafc", color: "#475569", cursor: "not-allowed", fontWeight: 700 }}>{value}</div>
      {note && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>{note}</div>}
    </div>
  );
}

const grid3: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 };
const grid4: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 };

// ─────────────────────────────────────────────
// KNOWLEDGE BASE (floating glossary — same pattern as FundingTierProfitabilityBalancer)
// ─────────────────────────────────────────────

const GLOSSARY: [string, string][] = [
  ["Deal Volume Ramp", "Deal count scales linearly from ~1/month up to the full-volume target over the Ramp Period. Every downstream number — revenue, cost, staffing — is driven off this curve."],
  ["Close Rate & Qualified Transfers", "A 'qualified transfer' is a call that clears the pre-screening buffer a lead vendor guarantees. Close Rate is the % of those that actually convert into a signed deal. To hit N signed deals, the model buys N ÷ Close Rate qualified transfers — and pays the transfer cost, and burns agent time, on all of them, not just the ones that close."],
  ["Average Handle Time (AHT)", "How long a full enrollment call runs, whether or not it closes. Debt-relief enrollment calls run materially longer than a typical sales call (45-90 min) because of the financial disclosure and documentation involved — this drives both labor cost and Trackdrive/usage cost per call."],
  ["Backend Revenue Recognition", "Each backend pays Funding Tier on a different real schedule, not at the moment a deal is signed: Level Debt pays on an advance-fee model, month 2 — and agent commission is passed through on that same month 2 timing; Consumer Shield pays monthly with a front-loaded then discounted split; Legacy passes through the first 2 payments then keeps a set % after. The model times revenue to match each contract, not to deal-signing date."],
  ["Level Debt — Graduated Commission", "Agent commission on Level Debt deals isn't flat — it scales up (0.75% to 2.5%) with how much total Level Debt volume the company enrolls in that same month. More company-wide volume unlocks a better rate for everyone that month."],
  ["Consumer Shield — Front vs. Backend Capture", "Consumer Shield's revenue share to Funding Tier is higher for the first few months of a program (the 'front' rate) and drops to a lower ongoing rate after (the 'backend' rate). This mirrors the real contract's incentive to capture more value early, when program dropout risk is highest."],
  ["Legacy — Sliding Fee Rate", "Legacy's total program fee (35%-49% of enrolled debt) is negotiable per deal. Raising it mostly extends the program's length rather than raising the client's monthly payment much, since the term auto-solves to stay near the minimum monthly payment floor."],
  ["Trackdrive Tiered Pricing", "Trackdrive's per-minute call-routing rate drops automatically as monthly call volume grows. Rather than picking a tier manually, the model solves for the correct tier each month based on simulated call volume — so unit costs improve on their own as the company scales."],
  ["Cash Reserve Policy", "Sets how many months of overhead (plus a small buffer for the rare case of a payment dispute) the company should hold in cash before profit is considered safe to distribute. This reserve requirement is also one of two gates the Hiring Policy checks before recommending a new hire."],
  ["Hiring Policy — Why Two Conditions", "A hiring signal only fires when BOTH agent capacity has been sustained above threshold for the required number of months, AND the cash reserve target is currently met. Capacity pressure alone isn't enough — the model won't recommend a hire the company can't yet safely afford."],
  ["Survival Curves", "Model what % of enrolled clients are still active and paying at each month of their program. These are the least certain inputs in the whole tool — illustrative estimates, not real observed data. Published industry completion rates are themselves contested (trade-group self-reports of 35-60% vs. government investigations finding numbers 'often in the single digits'), so treat these curves as a starting point to refine as real performance data comes in."],
  ["Peak Cash Burn vs. Cash Position", "Cash Position is the running cumulative total of revenue minus commission, transfer cost, and overhead, month by month. Peak Cash Burn is simply the lowest point that running total ever reaches — the most capital the company needs on hand to survive the ramp before revenue catches up."],
  ["Distributable Profit", "Cash Position minus the current Cash Reserve target. This is the portion of cash that's actually safe to take out of the business without dipping below the safety buffer — not the same as total cash on hand."],
  ["Utilization", "Total agent-minutes needed that month (qualified transfers × average handle time), divided by total agent-minutes available (concurrent seats × scheduled hours). Sustained utilization above the Hiring Policy's threshold is what triggers a hiring signal."],
];

// ─────────────────────────────────────────────
// EXPENSE STATEMENT (accounting-style monthly ledger)
// ─────────────────────────────────────────────

function round2(v: number): number { return Math.round(v * 100) / 100; }

const BACKEND_META: Record<BackendKey, { label: string; color: string }> = {
  LEVEL: { label: "Level Debt", color: FT_GREEN_DARK },
  CS: { label: "Shield Services", color: FT_BLUE },
  LEGACY: { label: "Elite Legal Practice", color: FT_PURPLE },
};

function RevenueForecastByPartner({ rows, monthlyNewDeals, avgDebt, horizon, statementRow, month, setMonth }: {
  rows: MonthRow[]; monthlyNewDeals: (t: number) => { LEVEL: number; CS: number; LEGACY: number };
  avgDebt: Record<BackendKey, number>; horizon: number; statementRow: MonthRow; month: number; setMonth: (v: number) => void;
}) {
  const backends: BackendKey[] = ["LEVEL", "CS", "LEGACY"];

  const totalDealsSubmitted: Record<BackendKey, number> = { LEVEL: 0, CS: 0, LEGACY: 0 };
  for (let t = 1; t <= horizon; t++) {
    const d = monthlyNewDeals(t);
    totalDealsSubmitted.LEVEL += d.LEVEL;
    totalDealsSubmitted.CS += d.CS;
    totalDealsSubmitted.LEGACY += d.LEGACY;
  }

  const cumRevenue: Record<BackendKey, number> = { LEVEL: 0, CS: 0, LEGACY: 0 };
  const cumCommission: Record<BackendKey, number> = { LEVEL: 0, CS: 0, LEGACY: 0 };
  rows.forEach(r => backends.forEach(k => {
    cumRevenue[k] += r.revenueByBackend[k];
    cumCommission[k] += r.commissionByBackend[k];
  }));

  const totalRevenueAll = backends.reduce((s, k) => s + cumRevenue[k], 0);
  const totalCommissionAll = backends.reduce((s, k) => s + cumCommission[k], 0);
  const totalDealsAll = backends.reduce((s, k) => s + totalDealsSubmitted[k], 0);
  const totalEnrolledAll = backends.reduce((s, k) => s + totalDealsSubmitted[k] * avgDebt[k], 0);

  return (
    <div style={{ ...card, background: "#fff" }}>
      <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        Revenue Forecast by Servicing Partner
        <InlineTip text="Projected revenue and commission, broken out per backend, based on deals submitted and average debt load for each. Cumulative totals cover the full simulation horizon; the table below shows one specific month in detail." width={300} />
      </div>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>Cumulative over {horizon} months, by servicing partner</div>

      <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: "#f8fafc" }}>
            {["Servicing Partner", "Deals Submitted", "Avg Debt Load", "Total Enrolled Volume", "Total Revenue", "Total Commission", "Net Revenue"].map(h => (
              <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {backends.map((k, i) => (
              <tr key={k} style={{ background: i % 2 ? "#f8fafc" : "#fff" }}>
                <td style={{ padding: "8px 12px", fontWeight: 800, color: BACKEND_META[k].color }}>{BACKEND_META[k].label}</td>
                <td style={{ padding: "8px 12px" }}>{Math.round(totalDealsSubmitted[k]).toLocaleString()}</td>
                <td style={{ padding: "8px 12px" }}>{money.format(avgDebt[k])}</td>
                <td style={{ padding: "8px 12px" }}>{money.format(totalDealsSubmitted[k] * avgDebt[k])}</td>
                <td style={{ padding: "8px 12px", fontWeight: 700 }}>{money.format(cumRevenue[k])}</td>
                <td style={{ padding: "8px 12px" }}>{money.format(cumCommission[k])}</td>
                <td style={{ padding: "8px 12px", fontWeight: 800, color: FT_GREEN_DARK }}>{money.format(cumRevenue[k] - cumCommission[k])}</td>
              </tr>
            ))}
            <tr style={{ background: "#f1f5f9", borderTop: "2px solid #cbd5e1" }}>
              <td style={{ padding: "8px 12px", fontWeight: 900 }}>TOTAL</td>
              <td style={{ padding: "8px 12px", fontWeight: 800 }}>{Math.round(totalDealsAll).toLocaleString()}</td>
              <td style={{ padding: "8px 12px" }}>—</td>
              <td style={{ padding: "8px 12px", fontWeight: 800 }}>{money.format(totalEnrolledAll)}</td>
              <td style={{ padding: "8px 12px", fontWeight: 900 }}>{money.format(totalRevenueAll)}</td>
              <td style={{ padding: "8px 12px", fontWeight: 800 }}>{money.format(totalCommissionAll)}</td>
              <td style={{ padding: "8px 12px", fontWeight: 900, color: FT_GREEN_DARK }}>{money.format(totalRevenueAll - totalCommissionAll)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18, marginBottom: 8, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>Single-Month Detail — active deals, revenue, and commission by partner</div>
        <div>
          <label style={{ ...labelStyle, marginBottom: 4 }}>Statement Month</label>
          <input type="number" min={1} max={horizon} value={month}
            onChange={e => setMonth(Math.max(1, Math.min(horizon, Number(e.target.value))))}
            style={{ ...inputStyle, width: 90 }} />
        </div>
      </div>
      <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: "#f8fafc" }}>
            {["Servicing Partner", "Active Deals This Month", "Revenue This Month", "Commission This Month"].map(h => (
              <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {backends.map((k, i) => (
              <tr key={k} style={{ background: i % 2 ? "#f8fafc" : "#fff" }}>
                <td style={{ padding: "8px 12px", fontWeight: 800, color: BACKEND_META[k].color }}>{BACKEND_META[k].label}</td>
                <td style={{ padding: "8px 12px" }}>{Math.round(statementRow.activeDealsByBackend[k]).toLocaleString()}</td>
                <td style={{ padding: "8px 12px", fontWeight: 700 }}>{money.format(statementRow.revenueByBackend[k])}</td>
                <td style={{ padding: "8px 12px" }}>{money.format(statementRow.commissionByBackend[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: "#64748b", marginTop: 10, lineHeight: 1.6 }}>
        "Active Deals" reflects survival-adjusted counts still generating revenue that month — not raw deals submitted.
        Revenue timing differs by partner (Level Debt pays a lump sum after 2 deposits clear; Shield Services and Elite
        Legal Practice pay monthly), so a given month's revenue mix will look different from the cumulative totals above.
      </div>
    </div>
  );
}

function LedgerCategory({ label, subtotal, note, children }: {
  label: string; subtotal: number; note: string; children: React.ReactNode;
}) {
  return (
    <div style={{ borderBottom: "1px solid #f1f5f9", padding: "8px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 13 }}>{label}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{note}</div>
        </div>
        <div style={{ fontWeight: 700, color: "#334155", fontVariantNumeric: "tabular-nums" }}>{money.format(subtotal)}</div>
      </div>
      <div style={{ marginTop: 6, paddingLeft: 14, display: "grid", gap: 3 }}>{children}</div>
    </div>
  );
}

function LedgerSubline({ label, amount }: { label: string; amount: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b" }}>
      <span>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{money.format(amount)}</span>
    </div>
  );
}

function ExpenseStatement({ row, month, setMonth, horizon, assumptions }: {
  row: MonthRow; month: number; setMonth: (v: number) => void; horizon: number; assumptions: Assumptions;
}) {
  const cb = row.costBreakdown;
  const a = assumptions;
  const isHybrid = a.headcount.staffingMode === "hybrid";

  const totalSms = row.qualifiedTransfers * a.operations.smsPerTransfer;
  const rawTotalEmails = row.qualifiedTransfers * a.operations.emailPerTransfer;
  const totalEmails = a.operations.emailMonthlyCap != null ? Math.min(rawTotalEmails, a.operations.emailMonthlyCap) : rawTotalEmails;
  const inboundForwardCost = round2(row.monthCallMinutes * a.costs.usageRates.inboundForwardPerMin);
  const smsCost = round2(totalSms * a.costs.usageRates.smsPerSegment);
  const emailCost = round2((totalEmails / 1000) * a.costs.usageRates.emailPer1000);
  const didCost = round2(a.headcount.activeDIDs * a.costs.usageRates.didRentalPerMonth);

  return (
    <div style={{ ...card, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
            Monthly Operating Expense Statement
            <InlineTip text="An accounting-style, itemized breakdown of every recurring cost for a single chosen month, rolling up to the same overhead total used in Results and the Month-by-Month table above." width={300} />
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
            {row.concurrentSeats} US closer seat{row.concurrentSeats === 1 ? "" : "s"}{isHybrid ? ` · ${row.overseasSeats} overseas seat${row.overseasSeats === 1 ? "" : "s"}` : ""} · {row.qualifiedTransfers.toLocaleString()} qualified transfers this month
          </div>
        </div>
        <div>
          <label style={{ ...labelStyle, marginBottom: 4 }}>Statement Month</label>
          <input type="number" min={1} max={horizon} value={month}
            onChange={e => setMonth(Math.max(1, Math.min(horizon, Number(e.target.value))))}
            style={{ ...inputStyle, width: 90 }} />
        </div>
      </div>

      <div style={{ marginTop: 14, border: "1px solid #e2e8f0", borderRadius: 12, padding: "4px 16px", background: "#fafbfc" }}>
        <LedgerCategory label="Fixed Monthly Costs" subtotal={cb.fixed} note="Software, office, and team costs — flat regardless of volume">
          {a.costs.fixedCosts.map((c, i) => <LedgerSubline key={i} label={c.label} amount={c.amount} />)}
        </LedgerCategory>

        <LedgerCategory label="Per-User Tools" subtotal={cb.perUser} note="Scales with total headcount">
          {a.costs.perUserCosts.map((c, i) => (
            <LedgerSubline key={i} label={`${c.label} (${money.format(c.amountPerUser)} × ${a.headcount.totalHeadcount} users)`} amount={c.amountPerUser * a.headcount.totalHeadcount} />
          ))}
        </LedgerCategory>

        <LedgerCategory label="Usage Rates (calls, SMS, email)" subtotal={cb.usage} note="Krest Marketing App — scales with call volume">
          <LedgerSubline label={`Inbound Forwarding (${row.monthCallMinutes.toLocaleString()} min)`} amount={inboundForwardCost} />
          <LedgerSubline label={`SMS (${Math.round(totalSms).toLocaleString()} segments)`} amount={smsCost} />
          <LedgerSubline label={`Email (${Math.round(totalEmails).toLocaleString()} sent)`} amount={emailCost} />
          <LedgerSubline label={`DID Rental (${a.headcount.activeDIDs} numbers)`} amount={didCost} />
        </LedgerCategory>

        <LedgerCategory label="Trackdrive (call routing)" subtotal={cb.trackdrive}
          note={`Tier "${row.trackdriveTierKey}" — resolved automatically from ${row.monthCallMinutes.toLocaleString()} call minutes`}>
          <LedgerSubline label="Inbound + outbound routing, DID rental at this tier" amount={cb.trackdrive} />
        </LedgerCategory>

        <div style={{ padding: "8px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 13 }}>Labor</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>Seats × scheduled hours × rate, per pool</div>
            </div>
            <div style={{ fontWeight: 700, color: "#334155", fontVariantNumeric: "tabular-nums" }}>{money.format(cb.labor)}</div>
          </div>
          <div style={{ marginTop: 6, paddingLeft: 14, display: "grid", gap: 3 }}>
            <LedgerSubline label={`US Closers — ${Math.max(0, row.concurrentSeats - Math.min(a.headcount.commissionOnlySeats, row.concurrentSeats))} hourly-paid seat${Math.max(0, row.concurrentSeats - Math.min(a.headcount.commissionOnlySeats, row.concurrentSeats)) === 1 ? "" : "s"}${a.headcount.commissionOnlySeats > 0 ? ` (+ ${Math.min(a.headcount.commissionOnlySeats, row.concurrentSeats)} commission-only, $0 labor)` : ""} × ${a.headcount.scheduledHoursPerWeek} hrs/wk × ${money.format(a.costs.laborRatePerHour)}/hr${a.headcount.scheduledHoursPerWeek > a.headcount.overtimeThresholdHoursPerWeek ? `, incl. ${a.headcount.overtimeMultiplier}× OT beyond ${a.headcount.overtimeThresholdHoursPerWeek}hrs` : ""}`} amount={cb.usLabor} />
            {isHybrid && (
              <LedgerSubline label={`Overseas Qualifiers (${row.overseasSeats} seat${row.overseasSeats === 1 ? "" : "s"} × ${a.headcount.overseasScheduledHoursPerWeek} hrs/wk × ${money.format(a.headcount.overseasRatePerHour)}/hr)`} amount={cb.overseasLabor} />
            )}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, marginTop: 4, borderTop: `2px solid #0f172a` }}>
          <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a" }}>GRAND TOTAL — Monthly Overhead</div>
          <div style={{ fontWeight: 900, fontSize: 20, color: FT_GREEN_DARK, fontVariantNumeric: "tabular-nums" }}>{money.format(cb.total)}</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: "#64748b", marginTop: 10, lineHeight: 1.6 }}>
        This total already flows into every Results metric above (Peak Capital Required, Final Cash, etc.) and the
        "Overhead" column in Month-by-Month Detail below — this panel exists to show <em>what makes up</em> that number.
        Since Labor and usage-based costs scale with call volume and seat count, this total will differ month to month
        as the ramp progresses or a hire comes online — try changing the Statement Month above to see how.
      </div>
    </div>
  );
}

function StaffingComparison({ usOnlyLabor, hybridLabor, currentMode, horizon }: {
  usOnlyLabor: number; hybridLabor: number; currentMode: "us_only" | "hybrid"; horizon: number;
}) {
  const savings = usOnlyLabor - hybridLabor;
  return (
    <div style={{ marginTop: 16, border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, background: "#faf5ff" }}>
      <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        Total Labor Cost Comparison — over {horizon} months
        <InlineTip text={`How this is calculated: the model runs two complete, independent simulations of the exact same ${horizon}-month deal volume, close rate, and hiring policy — one with Staffing Mode forced to "US Only," one forced to "Hybrid." Every month in each simulation contributes its labor cost (regular hours + overtime for US closers, plus overseas wages if hybrid, minus anything paid to commission-only seats) to that scenario's running total. The two totals shown below are those sums — nothing else in the model (revenue, commission, other overhead) changes between them, so the difference you see is purely the cost of the staffing choice.`} width={320} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ background: "#fff", border: `1px solid ${currentMode === "us_only" ? FT_BLUE : "#e2e8f0"}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
            US Only {currentMode === "us_only" && "(current)"}
            <InlineTip text="Sum of US closer labor cost (hourly wage + overtime, per your current rate and schedule, excluding any Commission-Only Seats) across every month of the simulation, assuming Staffing Mode is US Only for the full run — no overseas team, no hybrid handoff." width={260} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>{money.format(usOnlyLabor)}</div>
        </div>
        <div style={{ background: "#fff", border: `1px solid ${currentMode === "hybrid" ? FT_PURPLE : "#e2e8f0"}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
            Hybrid (overseas + US) {currentMode === "hybrid" && "(current)"}
            <InlineTip text="Sum of US closer labor cost PLUS overseas qualifier labor cost, across every month, assuming Staffing Mode is Hybrid for the full run — using your current overseas rate, seats, hours, and qualifying-share split. Hiring events in this scenario may add seats to whichever pool (US or overseas) is actually strained." width={280} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>{money.format(hybridLabor)}</div>
        </div>
      </div>
      <div style={{ marginTop: 10, textAlign: "center", fontSize: 13, fontWeight: 800, color: savings > 0 ? FT_GREEN_DARK : FT_RED }}>
        {savings > 0
          ? `Hybrid saves ${money.format(savings)} in labor cost over ${horizon} months`
          : savings < 0
            ? `Hybrid costs ${money.format(-savings)} more over ${horizon} months at these settings`
            : "No difference at current settings"}
      </div>
      <div style={{ fontSize: 11, color: "#64748b", marginTop: 8, lineHeight: 1.6 }}>
        Both scenarios use the same deal volume, close rate, and hiring policy — only the staffing structure differs.
        This isolates the true cost impact of the staffing choice itself.
      </div>
    </div>
  );
}

function KnowledgeBase({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", right: 20, bottom: 88, width: 430,
      maxWidth: "calc(100vw - 24px)", maxHeight: "72vh", zIndex: 999, background: "#fff",
      border: "1px solid #dbeafe", borderRadius: 18, boxShadow: "0 20px 40px rgba(15,23,42,0.22)",
      display: "flex", flexDirection: "column" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "#fff",
        borderBottom: "1px solid #e2e8f0", borderRadius: "18px 18px 0 0",
        padding: "13px 16px 11px", display: "flex",
        justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>Glossary / Knowledge Base</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Deeper explanations behind the numbers.</div>
        </div>
        <button onClick={onClose} style={{ border: "none", background: "#f1f5f9", borderRadius: 10,
          width: 34, height: 34, cursor: "pointer", fontWeight: 900, fontSize: 18, color: "#334155",
          flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
      </div>
      <div style={{ overflowY: "auto", padding: "13px 16px 20px", display: "grid", gap: 13 }}>
        {GLOSSARY.map(([title, body], i) => (
          <div key={i}>
            <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 13 }}>{title}</div>
            <p style={{ margin: "5px 0 0", fontSize: 13, color: "#475569", lineHeight: 1.7 }}>{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

export default function FundingTierOperatingModel() {
  const [a, setA] = useState<Assumptions>(() => JSON.parse(JSON.stringify(DEFAULT_ASSUMPTIONS)));

  const [rampMonths, setRampMonths] = useState(12);
  const [rampTargets, setRampTargets] = useState<Record<BackendKey, number>>({ LEVEL: 25, CS: 30, LEGACY: 20 });
  const [avgDebt, setAvgDebt] = useState<Record<BackendKey, number>>({ LEVEL: 16000, CS: 15000, LEGACY: 14000 });
  const [horizon, setHorizon] = useState(36);
  const [kbOpen, setKbOpen] = useState(false);
  const [statementMonth, setStatementMonth] = useState(36);

  const update = useCallback(<K extends keyof Assumptions>(section: K, patch: Partial<Assumptions[K]>) => {
    setA(prev => ({ ...prev, [section]: { ...prev[section], ...patch } }));
  }, []);

  const monthlyNewDeals = useCallback((t: number) => {
    const rf = Math.min(1, t / rampMonths);
    return {
      LEVEL: Math.round(rampTargets.LEVEL * rf + 1),
      CS: Math.round(rampTargets.CS * rf + 1),
      LEGACY: Math.round(rampTargets.LEGACY * rf + 1),
    };
  }, [rampMonths, rampTargets]);

  const result = useMemo(() => simulatePortfolio({
    months: horizon,
    monthlyNewDeals,
    avgDebtByBackend: avgDebt,
    assumptions: a,
  }), [horizon, monthlyNewDeals, avgDebt, a]);

  // Staffing comparison: run both modes with everything else held identical,
  // so the Staffing Model panel can show the true isolated cost of the choice.
  const usOnlyComparison = useMemo(() => simulatePortfolio({
    months: horizon, monthlyNewDeals, avgDebtByBackend: avgDebt,
    assumptions: { ...a, headcount: { ...a.headcount, staffingMode: "us_only" } },
  }), [horizon, monthlyNewDeals, avgDebt, a]);
  const hybridComparison = useMemo(() => simulatePortfolio({
    months: horizon, monthlyNewDeals, avgDebtByBackend: avgDebt,
    assumptions: { ...a, headcount: { ...a.headcount, staffingMode: "hybrid" } },
  }), [horizon, monthlyNewDeals, avgDebt, a]);
  const usOnlyComparisonTotalLabor = usOnlyComparison.rows.reduce((s, r) => s + r.costBreakdown.labor, 0);
  const hybridComparisonTotalLabor = hybridComparison.rows.reduce((s, r) => s + r.costBreakdown.labor, 0);

  const rows = result.rows;
  const final = rows[rows.length - 1];
  const peakBurn = Math.min(...rows.map(r => r.cashPosition));
  const firstPositive = rows.find(r => r.cashPosition > 0)?.month ?? null;
  const firstReserveMet = rows.find(r => r.reserveMet)?.month ?? null;
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalCommission = rows.reduce((s, r) => s + r.commission, 0);
  const peakUtilization = Math.max(...rows.map(r => r.utilizationPct));
  const clampedStatementMonth = Math.min(statementMonth, horizon);
  const statementRow = rows[clampedStatementMonth - 1];

  return (
    <div style={{ minHeight: "100vh", background: FT_BG, color: "#0f172a",
      fontFamily: 'Inter, Arial, Helvetica, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif' }}>

      <KnowledgeBase open={kbOpen} onClose={() => setKbOpen(false)} />

      <button onClick={() => setKbOpen(true)} style={{ position: "fixed", right: 20, bottom: 20, zIndex: 1000,
        border: "none", borderRadius: 999, background: FT_GREEN, color: "#fff", padding: "11px 16px",
        fontWeight: 800, fontSize: 13, boxShadow: "0 10px 28px rgba(15,157,138,0.35)", cursor: "pointer" }}>
        📖 Glossary / Knowledge Base
      </button>

      {/* HEADER */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(248,250,252,0.97)", backdropFilter: "blur(10px)", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "10px 16px" }}>
          <div style={{ background: "linear-gradient(135deg,#0f172a 0%,#0b3b50 45%,#0f766e 100%)", borderRadius: 16, padding: "12px 20px", boxShadow: "0 8px 24px rgba(15,23,42,0.18)", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <img src={FT_LOGO} alt="Funding Tier" style={{ height: 28 }} />
            <span style={{ fontWeight: 900, fontSize: 20, color: "#fff", letterSpacing: "-0.5px" }}>Operating Model</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>Level Debt · Shield Services · Elite Legal Practice</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "18px 16px 60px", display: "grid", gap: 18 }}>

        {/* ── HOW THIS WORKS ── */}
        <div style={{ ...card, background: "#f0fdfa", border: "1px solid #99f6e4" }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: FT_GREEN_DARK, marginBottom: 8 }}>How to Read This Tool</div>
          <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.75 }}>
            This projects Funding Tier's cash flow, staffing needs, and profitability month-by-month, based on a set of
            adjustable assumptions. <strong>Every number below is editable</strong> — the defaults are Funding Tier's real
            contract terms and current costs where known, and clearly-labeled estimates where real data doesn't exist yet.
            <br /><br />
            <strong>Suggested order to review:</strong> start with the <strong>Deal Volume Ramp Planner</strong> (how many deals
            you expect per month), then the three <strong>Backend Assumptions</strong> panels (how each partner pays), then
            <strong> Operations &amp; Staffing</strong> and <strong> Cost Stack</strong> (what it costs to run), then
            <strong> Cash Reserve</strong> and <strong> Hiring Policy</strong> (how the model decides when it's financially
            safe to grow). Hover any <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 14, height: 14, borderRadius: "50%", background: FT_GREEN, color: "#fff", fontSize: 8, fontWeight: 900, margin: "0 2px" }}>?</span> icon for a plain-English explanation of what that number means.
          </div>
        </div>

        {/* ── KEY OUTCOMES ── */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#334155", marginBottom: 10 }}>Results — based on everything set below</div>
          <div style={grid4}>
            <MetricCard title="Total Revenue" value={money.format(totalRevenue)} subtitle={`Over ${horizon} months`}
              tooltip="Sum of all company revenue recognized across the simulation — money actually received from the three backends, timed to when they actually pay Funding Tier, not when a deal is first signed." />
            <MetricCard title={`Final Cash (Mo ${horizon})`} value={money.format(final.cashPosition)} color={FT_GREEN_DARK}
              subtitle={`Distributable above reserve: ${money.format(final.distributable)}`}
              tooltip="Cumulative cash position at the end of the simulation, after all revenue, commission, transfer cost, and overhead. 'Distributable' is the amount above the reserve target — safe to actually take out of the business." />
            <MetricCard title="First Cash-Positive Month" value={firstPositive ? `Month ${firstPositive}` : "Not within horizon"}
              color={firstPositive ? FT_GREEN_DARK : FT_RED}
              tooltip="The first month cumulative cash position turns positive — total revenue collected has caught up with everything spent so far." />
            <MetricCard title="Total Commission Paid" value={money.format(totalCommission)}
              tooltip="Sum of all agent commission paid out across the simulation, timed to each backend's real payout schedule." />
          </div>
        </div>
        <div style={grid4}>
          <MetricCard title="Peak Capital Required" value={money.format(Math.abs(peakBurn))} color={peakBurn < 0 ? FT_AMBER : FT_GREEN_DARK}
            subtitle="Most capital needed on hand before revenue catches up"
            tooltip="The lowest point cumulative cash reaches during the simulation, shown as a positive number — this is the amount of outside capital or runway the company needs to fund the ramp-up period before revenue exceeds costs. Same underlying number some call 'peak burn.'" />
          <MetricCard title="Reserve Target First Met" value={firstReserveMet ? `Month ${firstReserveMet}` : "Not within horizon"}
            color={firstReserveMet ? FT_GREEN_DARK : FT_AMBER}
            tooltip="The first month cash on hand is enough to cover the Cash Reserve Policy target below — a safety buffer against chargebacks and normal overhead swings." />
          <MetricCard title="Final Seat Count" value={String(final.concurrentSeats)}
            subtitle={`Started at ${a.headcount.concurrentSeats} · ${result.hiringEvents.length} hire${result.hiringEvents.length === 1 ? "" : "s"} triggered`}
            tooltip="How many concurrent agent seats the model ends with, after any hiring events triggered by the Hiring Policy below." />
          <MetricCard title="Peak Utilization" value={pct(peakUtilization)} color={peakUtilization >= 85 ? FT_AMBER : FT_GREEN_DARK}
            tooltip="The highest % of available agent capacity used in any single month. Sustained utilization above the Hiring Policy threshold is what triggers a hiring event." />
        </div>

        {/* ── HIRING TIMELINE ── */}
        {result.hiringEvents.length > 0 && (
          <div style={{ ...card, background: `${FT_GREEN}0d`, border: `1px solid ${FT_GREEN}33` }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: FT_GREEN_DARK, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              Hiring Events
              <InlineTip text="Each event fires only when BOTH conditions from the Hiring Policy section are true at once: agent capacity has been sustained above threshold, AND the cash reserve target is met. This prevents recommending a hire the company can't yet afford." width={300} />
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {result.hiringEvents.map((h, i) => (
                <div key={i} style={{ background: "#fff", border: `1px solid ${FT_GREEN}44`, borderRadius: 10, padding: "8px 14px" }}>
                  <span style={{ fontWeight: 800, color: FT_GREEN_DARK }}>Month {h.month}</span>
                  <span style={{ color: "#64748b", marginLeft: 8 }}>→ {h.seatsAfter} {h.pool === "overseas" ? "overseas" : "US closer"} seats</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 1. RAMP PLANNER ── */}
        <Accordion title="1 · Deal Volume Ramp Planner" defaultOpen accent={FT_GREEN}
          subtitle="Start here — this drives everything else in the model"
          tooltip="How many deals you expect to enroll each month, and how quickly volume ramps up from a standing start. Every other calculation in this tool flows from these numbers.">
          <div style={grid4}>
            <NumField label="Ramp Period" value={rampMonths} onChange={setRampMonths} suffix="months" min={1}
              tooltip="Number of months to linearly scale up from ~1 deal/month to the full-volume target set below." />
            <NumField label="Simulation Horizon" value={horizon} onChange={setHorizon} suffix="months" min={1} max={60}
              tooltip="Total number of months the model projects forward. Set this long enough that all deal cohorts finish their program terms, or later-ramping backends (like Legacy) can look artificially weak from being cut off mid-program." />
            <div />
            <div />
          </div>
          <div style={{ marginTop: 14, fontSize: 12, fontWeight: 800, color: "#334155" }}>Full-volume target (deals/month) &amp; average enrolled debt, per backend</div>
          <div style={{ ...grid3, marginTop: 8 }}>
            {(["LEVEL", "CS", "LEGACY"] as BackendKey[]).map(key => (
              <div key={key} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8, color: key === "LEVEL" ? FT_GREEN_DARK : key === "CS" ? FT_BLUE : FT_PURPLE }}>
                  {key === "LEVEL" ? "Level Debt" : key === "CS" ? "Shield Services" : "Elite Legal Practice"}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  <NumField label="Target Deals/Month" value={rampTargets[key]} onChange={v => setRampTargets(p => ({ ...p, [key]: v }))}
                    tooltip="The full-volume (steady-state) number of new deals per month for this backend, once the ramp period completes." />
                  <NumField label="Avg Enrolled Debt" value={avgDebt[key]} onChange={v => setAvgDebt(p => ({ ...p, [key]: v }))} step={500}
                    tooltip="A single representative enrolled-debt amount used for every deal in this backend, for simplicity — not a distribution of deal sizes." />
                </div>
              </div>
            ))}
          </div>
        </Accordion>

        <RevenueForecastByPartner rows={rows} monthlyNewDeals={monthlyNewDeals} avgDebt={avgDebt} horizon={horizon}
          statementRow={statementRow} month={clampedStatementMonth} setMonth={setStatementMonth} />

        {/* ── 2. BACKEND ASSUMPTIONS ── */}
        <div style={{ fontSize: 13, fontWeight: 800, color: "#334155", marginTop: 4 }}>2 · How each backend pays Funding Tier and its agents</div>

        <Accordion title="Level Debt" accent={FT_GREEN}
          tooltip="Debt settlement backend. Pays Funding Tier a one-time 8% revenue share after the client's 2nd deposit clears, and pays agents a graduated commission that scales with company-wide monthly volume.">
          <div style={grid3}>
            <LockedField label="Revenue Share" value={`${(a.levelDebt.revenueSharePct * 100).toFixed(1)}%`}
              note="8% of enrolled debt, per the Level Debt affiliate agreement." />
            <LockedField label="Revenue Recognized" value={`Month ${a.levelDebt.revenueRecognizedMonth}`}
              note="Timed to when Level Debt actually pays Funding Tier — advance-fee model, paid month 2." />
            <LockedField label="Agent Payout" value={`Month ${a.levelDebt.agentPayoutMonth}`}
              note="Set by real payout timing, not a company policy choice." />
          </div>
          <div style={{ marginTop: 14, fontSize: 12, fontWeight: 800, color: "#334155", display: "flex", alignItems: "center", gap: 6 }}>
            Graduated commission tiers (0.75%–2.5%, by monthly enrolled volume)
            <InlineTip text="Agent commission rate scales up as company-wide monthly Level Debt enrolled volume grows in a given month — more volume unlocks a higher rate per deal for that month's cohort." width={290} />
          </div>
          <div style={{ overflowX: "auto", marginTop: 8, border: "1px solid #e2e8f0", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, color: "#64748b" }}>Volume Threshold ($/mo)</th>
                <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, color: "#64748b" }}>Rate</th>
              </tr></thead>
              <tbody>
                {a.levelDebt.commissionTiers.map((t, i) => (
                  <tr key={i}>
                    <td style={{ padding: "6px 12px" }}>
                      <input type="number" value={t.threshold} step={50000}
                        onChange={e => {
                          const tiers = [...a.levelDebt.commissionTiers];
                          tiers[i] = { ...tiers[i], threshold: Number(e.target.value) };
                          update("levelDebt", { commissionTiers: tiers });
                        }} style={{ ...inputStyle, width: 140 }} />
                    </td>
                    <td style={{ padding: "6px 12px" }}>
                      <input type="number" value={t.rate * 100} step={0.05} min={0.75} max={2.5}
                        onChange={e => {
                          const tiers = [...a.levelDebt.commissionTiers];
                          tiers[i] = { ...tiers[i], rate: Number(e.target.value) / 100 };
                          update("levelDebt", { commissionTiers: tiers });
                        }} style={{ ...inputStyle, width: 90 }} />
                      <span style={{ marginLeft: 4, fontSize: 12, color: "#64748b" }}>%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Accordion>

        <Accordion title="Shield Services (Consumer Shield)" accent={FT_BLUE}
          tooltip="Debt validation backend. Pays Funding Tier a monthly share of each client payment — a high share for the first few months, a lower share for the rest of the program.">
          <div style={grid4}>
            <LockedField label="Servicing Deduction" value={money.format(a.consumerShield.servicingDeductionPerPayment) + "/payment"}
              note="Per the Consumer Shield Service Marketing Agreement." />
            <LockedField label="Front Months" value={String(a.consumerShield.frontMonths)}
              note="Duration of the higher-capture window, per contract." />
            <LockedField label="Front Capture Rate" value={`${(a.consumerShield.frontCaptureRate * 100).toFixed(0)}%`}
              note="Funding Tier's share during front months." />
            <LockedField label="Backend Capture Rate" value={`${(a.consumerShield.backendCaptureRate * 100).toFixed(0)}%`}
              note="Funding Tier's share after front months." />
          </div>
          <div style={{ marginTop: 10, maxWidth: 260 }}>
            <LockedField label="Agent Payout Month" value={`Month ${a.consumerShield.agentPayoutMonth}`}
              note="Set by real payout timing (by the 15th of the following month, per contract)." />
          </div>
        </Accordion>

        <Accordion title="Elite Legal Practice (Legacy Capital)" accent={FT_PURPLE}
          tooltip="Debt resolution backend. Charges a sliding fee (35%-49% of enrolled debt) spread over the program; Funding Tier passes through most of the first 2 payments, then keeps a set % of the rest.">
          <div style={grid4}>
            <LockedField label="Min Monthly Payment" value={money.format(a.legacy.minMonthlyPayment)}
              note="Sets program length: term = total fee ÷ this floor." />
            <LockedField label="Draft Fee" value={money.format(a.legacy.draftFee)}
              note="Per-payment fee during months 1-2 pass-through." />
            <LockedField label="Admin Monthly Fee" value={money.format(a.legacy.adminMonthlyFee)}
              note="Deducted from month 3 onward, before the tier rate." />
            <LockedField label="Tier 1 Rate" value={`${(a.legacy.tier1Rate * 100).toFixed(0)}%`}
              note="Funding Tier's share of payment (after admin fee) from month 3 on." />
          </div>
          <div style={{ marginTop: 14 }}>
            <PctField label="Sliding Fee Rate (35%–49% of enrolled debt)" valuePct={a.legacy.feeRate * 100}
              min={35} max={49} step={1} onChangePct={v => update("legacy", { feeRate: v / 100 })}
              tooltip="The % of enrolled debt charged as the total program fee — Legacy's negotiable range. Higher fee mostly extends the program length rather than raising the monthly payment much." />
            <div style={{ fontSize: 11, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 11px", marginTop: 8, lineHeight: 1.6 }}>
              ⚠ This model holds the survival curve constant across fee rates — in reality a higher fee likely affects
              close rate and retention differently, which isn't yet modeled.
            </div>
          </div>
        </Accordion>

        {/* ── 3. OPERATIONS & STAFFING ── */}
        <div style={{ fontSize: 13, fontWeight: 800, color: "#334155", marginTop: 4 }}>3 · Operations, staffing, and how calls turn into deals</div>

        <Accordion title="Operations" accent={FT_GREEN}
          tooltip="How raw call transfers convert into signed deals, and how long that takes per call — the link between marketing spend and agent workload."
          subtitle="Close rate, average handle time, blended transfer mix">
          <div style={grid3}>
            <PctField label="Close Rate" valuePct={a.operations.closeRate * 100} max={100}
              onChangePct={v => update("operations", { closeRate: v / 100 })}
              tooltip="% of qualified transfers (calls that clear the buffer) that actually convert into a signed, enrolled deal. Determines how many transfers you need to buy to hit your deal targets." />
            <NumField label="Avg Handle Time" value={a.operations.avgCallMinutesPerDeal} suffix="min/call"
              onChange={v => update("operations", { avgCallMinutesPerDeal: v })}
              tooltip="Average length of a full enrollment call, whether or not it results in a signed deal. Debt-relief enrollment calls typically run 45-90 minutes." />
            <div />
          </div>

          <div style={{ marginTop: 16, fontSize: 12, fontWeight: 800, color: "#334155", display: "flex", alignItems: "center", gap: 6 }}>
            Monthly Cost of Call Transfers — blended mix across all 3 buffers
            <InlineTip text="Rather than picking one buffer length, real call volume is split across all three transfer tiers. Set the % mix below — it should add to 100%. Only qualified (buffer-cleared) transfers are billed; unqualified attempts never reach this stage." width={300} />
          </div>
          <div style={grid3}>
            <NumField label={`1-Minute Buffer (${money.format(a.costs.transferCost.buffer1min)}/transfer)`} value={a.operations.transferMix.buffer1min} suffix="%" step={1}
              onChange={v => update("operations", { transferMix: { ...a.operations.transferMix, buffer1min: v } })} />
            <NumField label={`2-Minute Buffer (${money.format(a.costs.transferCost.buffer2min)}/transfer)`} value={a.operations.transferMix.buffer2min} suffix="%" step={1}
              onChange={v => update("operations", { transferMix: { ...a.operations.transferMix, buffer2min: v } })} />
            <NumField label={`5-Minute Buffer (${money.format(a.costs.transferCost.buffer5min)}/transfer)`} value={a.operations.transferMix.buffer5min} suffix="%" step={1}
              onChange={v => update("operations", { transferMix: { ...a.operations.transferMix, buffer5min: v } })} />
          </div>
          {(() => {
            const mix = a.operations.transferMix;
            const sum = mix.buffer1min + mix.buffer2min + mix.buffer5min;
            const blended = (mix.buffer1min / 100) * a.costs.transferCost.buffer1min
              + (mix.buffer2min / 100) * a.costs.transferCost.buffer2min
              + (mix.buffer5min / 100) * a.costs.transferCost.buffer5min;
            return (
              <div style={{ fontSize: 12, marginTop: 8, color: Math.abs(sum - 100) > 0.5 ? FT_RED : "#64748b", fontWeight: Math.abs(sum - 100) > 0.5 ? 800 : 500 }}>
                Mix totals {sum.toFixed(1)}% {Math.abs(sum - 100) > 0.5 && "— should sum to 100%"} · Blended cost per qualified transfer: <strong>{money.format(blended)}</strong>
              </div>
            );
          })()}

          <div style={{ marginTop: 16, fontSize: 12, fontWeight: 800, color: "#334155" }}>SMS &amp; Email Volume</div>
          <div style={grid3}>
            <NumField label="SMS per Transfer" value={a.operations.smsPerTransfer} suffix="segments"
              onChange={v => update("operations", { smsPerTransfer: v })}
              tooltip="Number of SMS segments sent per qualified transfer (not per call minute) — this drives the SMS line in Krest Marketing App Usage Rates." />
            <NumField label="Email per Transfer" value={a.operations.emailPerTransfer} suffix="emails"
              onChange={v => update("operations", { emailPerTransfer: v })}
              tooltip="Number of emails sent per qualified transfer (not per call minute)." />
            <NumField label="Email Monthly Cap" value={a.operations.emailMonthlyCap ?? 0} suffix="emails, 0 = no cap"
              onChange={v => update("operations", { emailMonthlyCap: v > 0 ? v : null })}
              tooltip="Hard ceiling on total emails sent per month, regardless of call volume — set to a realistic operating limit." />
          </div>

          <div style={{ fontSize: 11, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 11px", marginTop: 12, lineHeight: 1.6 }}>
            ⚠ Close rate applies to every qualified transfer, not just successful enrollments — agents spend time on
            calls that don't close too, which this model accounts for in labor and Trackdrive cost. SMS and email
            volume now scale per transfer, not per call-minute, and email has a hard monthly cap.
          </div>
        </Accordion>

        <Accordion title="Starting Headcount &amp; Schedule" accent={FT_BLUE}
          tooltip="The company's staffing starting point for the US closer team — how many people, how many can take calls at once, and what hours the team covers. Every agent is assumed to work across all three backends — none are dedicated to a single one.">
          <div style={grid4}>
            <NumField label="Starting Total Headcount" value={a.headcount.totalHeadcount}
              onChange={v => update("headcount", { totalHeadcount: v })}
              tooltip="Total US company headcount at the start of the simulation — used for every per-user software cost below (Slack, Salesforce, etc.), since all agents work across all backends." />
            <NumField label="US Closer Seats" value={a.headcount.concurrentSeats}
              onChange={v => update("headcount", { concurrentSeats: v })}
              tooltip="How many US-based agents can be actively on a call at the same time. In Hybrid mode, this pool only handles the closing portion of each call — see Staffing Model below." />
            <NumField label="Commission-Only Seats" value={a.headcount.commissionOnlySeats}
              onChange={v => update("headcount", { commissionOnlySeats: v })}
              tooltip="How many of the US Closer Seats above are paid commission-only — no hourly wage or overtime at all, earning purely through the per-deal agent commission already modeled in each backend's payout. Capacity and call-handling stay the same; only the labor cost line changes. Set to your own seat (or any 1099/commission-only closer) to remove their hourly cost entirely." />
            <NumField label="Active DIDs (phone numbers)" value={a.headcount.activeDIDs}
              onChange={v => update("headcount", { activeDIDs: v })}
              tooltip="Number of active phone numbers rented, which factors into DID rental costs (both Krest Marketing App and Trackdrive)." />
          </div>
          <div style={{ marginTop: 10 }}>
            <NumField label="Scheduled Hours / Week" value={a.headcount.scheduledHoursPerWeek} suffix="hrs"
              onChange={v => update("headcount", { scheduledHoursPerWeek: v })}
              tooltip="Hours per week the US closer team is scheduled to be available, per seat. For a 6am-7pm PST operating window, that's 13 hrs/day — multiply by however many days/week you actually run." />
          </div>
          <div style={{ marginTop: 14, fontSize: 12, fontWeight: 800, color: "#334155" }}>Overtime — US Closers Only</div>
          <div style={grid3}>
            <NumField label="Overtime Threshold" value={a.headcount.overtimeThresholdHoursPerWeek} suffix="hrs/wk"
              onChange={v => update("headcount", { overtimeThresholdHoursPerWeek: v })}
              tooltip="Hours per week a US closer can work before overtime pay kicks in — standard is 40. Hours scheduled beyond this are paid at the overtime multiplier. Does not apply to overseas reps." />
            <NumField label="Overtime Multiplier" value={a.headcount.overtimeMultiplier} suffix="×" step={0.1}
              onChange={v => update("headcount", { overtimeMultiplier: v })}
              tooltip="Pay multiplier applied to US closer hours beyond the overtime threshold — 1.5× is standard." />
            <div />
          </div>
        </Accordion>

        <Accordion title="Staffing Model — US Only vs. Overseas Hybrid" accent={FT_PURPLE} defaultOpen
          tooltip="Compare an all-US staffing model against a hybrid model where an overseas team handles call qualification (the bulk of average handle time) and warm-hands off to a US closer who spends minimal time finishing the deal.">
          <div style={{ maxWidth: 340, marginBottom: 16 }}>
            <label style={labelStyle}>Staffing Mode</label>
            <select value={a.headcount.staffingMode} onChange={e => update("headcount", { staffingMode: e.target.value as any })} style={inputStyle}>
              <option value="us_only">US Only — closers handle full calls</option>
              <option value="hybrid">Hybrid — overseas qualifiers + US closers</option>
            </select>
          </div>

          {a.headcount.staffingMode === "hybrid" && (
            <div style={grid4}>
              <NumField label="Overseas Seats" value={a.headcount.overseasSeats}
                onChange={v => update("headcount", { overseasSeats: v })}
                tooltip="How many overseas agents can be actively on a qualifying call at the same time." />
              <NumField label="Overseas Hours / Week" value={a.headcount.overseasScheduledHoursPerWeek} suffix="hrs"
                onChange={v => update("headcount", { overseasScheduledHoursPerWeek: v })}
                tooltip="Hours per week the overseas team is scheduled to be available, per seat." />
              <NumField label="Overseas Rate" value={a.headcount.overseasRatePerHour} suffix="$/hr"
                onChange={v => update("headcount", { overseasRatePerHour: v })}
                tooltip="Blended hourly cost per overseas agent — illustrative estimate, adjust to your actual BPO/shored-services rate." />
              <PctField label="Overseas Qualifying Share" valuePct={a.headcount.overseasQualifyingSharePct} max={95}
                onChangePct={v => update("headcount", { overseasQualifyingSharePct: v })}
                tooltip="% of the average handle time spent by the overseas qualifier before a warm handoff to the US closer. The remaining % is what the US closer's time — and required seat count — is based on." />
            </div>
          )}

          <StaffingComparison
            usOnlyLabor={usOnlyComparisonTotalLabor}
            hybridLabor={hybridComparisonTotalLabor}
            currentMode={a.headcount.staffingMode}
            horizon={horizon}
          />
        </Accordion>

        {/* ── 4. COST STACK ── */}
        <div style={{ fontSize: 13, fontWeight: 800, color: "#334155", marginTop: 4 }}>4 · What it costs to run the company</div>

        <Accordion title="Cost Stack" accent={FT_AMBER}
          tooltip="Every recurring cost the company pays, from software subscriptions to per-minute call charges. This is what gets subtracted from revenue each month to find net cash flow."
          subtitle="Fixed tools, per-user tools, usage rates, Trackdrive, transfer cost, labor">
          <div style={{ fontSize: 12, fontWeight: 800, color: "#334155", marginBottom: 8 }}>Fixed Monthly Tools</div>
          <div style={grid3}>
            {a.costs.fixedCosts.map((c, i) => (
              <NumField key={i} label={c.label} value={c.amount} suffix="$/mo"
                tooltip="Monthly software cost that doesn't change with call volume or headcount."
                onChange={v => {
                  const arr = [...a.costs.fixedCosts]; arr[i] = { ...arr[i], amount: v };
                  update("costs", { fixedCosts: arr });
                }} />
            ))}
          </div>

          <div style={{ fontSize: 12, fontWeight: 800, color: "#334155", margin: "16px 0 8px" }}>Per-User Tools</div>
          <div style={grid3}>
            {a.costs.perUserCosts.map((c, i) => (
              <NumField key={i} label={c.label} value={c.amountPerUser} suffix="$/user/mo"
                tooltip="Monthly cost that scales directly with headcount — each additional hire adds this cost."
                onChange={v => {
                  const arr = [...a.costs.perUserCosts]; arr[i] = { ...arr[i], amountPerUser: v };
                  update("costs", { perUserCosts: arr });
                }} />
            ))}
          </div>

          <div style={{ fontSize: 12, fontWeight: 800, color: "#334155", margin: "16px 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
            Krest Marketing App Usage Rates
            <InlineTip text="Per-unit costs for calls, texts, and emails sent through the Krest Marketing App (GoHighLevel) platform — these scale directly with call volume." width={280} />
          </div>
          <div style={grid4}>
            <NumField label="Inbound Forwarding" value={a.costs.usageRates.inboundForwardPerMin} step={0.001} suffix="$/min"
              onChange={v => update("costs", { usageRates: { ...a.costs.usageRates, inboundForwardPerMin: v } })} />
            <NumField label="SMS" value={a.costs.usageRates.smsPerSegment} step={0.0001} suffix="$/segment"
              onChange={v => update("costs", { usageRates: { ...a.costs.usageRates, smsPerSegment: v } })} />
            <NumField label="Email" value={a.costs.usageRates.emailPer1000} step={0.01} suffix="$/1000"
              onChange={v => update("costs", { usageRates: { ...a.costs.usageRates, emailPer1000: v } })} />
            <NumField label="DID Rental" value={a.costs.usageRates.didRentalPerMonth} step={0.05} suffix="$/mo"
              onChange={v => update("costs", { usageRates: { ...a.costs.usageRates, didRentalPerMonth: v } })} />
          </div>

          <div style={{ fontSize: 12, fontWeight: 800, color: "#334155", margin: "16px 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
            Trackdrive (call routing)
            <InlineTip text="Trackdrive's per-minute call-routing rate gets cheaper automatically as monthly call volume grows. This table shows the rate at each spend tier — the model picks the right tier for you each month based on simulated volume." width={300} />
          </div>
          <div style={{ fontSize: 11, color: "#0c4a6e", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "8px 11px", marginBottom: 8, lineHeight: 1.6 }}>
            ℹ You don't pick a tier — the model resolves it automatically each month from simulated call volume, which is
            itself driven by how many deals are submitted (not by headcount). More deals → more calls → cheaper per-minute
            rate. This table only sets the <em>rate at each tier</em>; see the Monthly Operating Expense Statement below
            to check which tier a given month actually landed in.
          </div>
          <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ background: "#f8fafc" }}>
                {["Tier", "Threshold ($)", "DID ($/mo)", "Inbound ($/min)"].map(h => (
                  <th key={h} style={{ padding: "7px 10px", textAlign: "left", fontSize: 10, color: "#64748b" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {a.costs.trackdriveTiers.map((t, i) => (
                  <tr key={t.key} style={{ background: i % 2 ? "#f8fafc" : "#fff" }}>
                    <td style={{ padding: "6px 10px", fontWeight: 700 }}>{t.key}</td>
                    <td style={{ padding: "6px 10px" }}>{money.format(t.threshold)}</td>
                    <td style={{ padding: "6px 10px" }}>
                      <input type="number" value={t.did} step={0.1} onChange={e => {
                        const arr = [...a.costs.trackdriveTiers]; arr[i] = { ...arr[i], did: Number(e.target.value) };
                        update("costs", { trackdriveTiers: arr });
                      }} style={{ ...inputStyle, width: 80 }} />
                    </td>
                    <td style={{ padding: "6px 10px" }}>
                      <input type="number" value={t.inbound} step={0.001} onChange={e => {
                        const arr = [...a.costs.trackdriveTiers]; arr[i] = { ...arr[i], inbound: Number(e.target.value) };
                        update("costs", { trackdriveTiers: arr });
                      }} style={{ ...inputStyle, width: 90 }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10 }}>
            <NumField label="Trackdrive Outbound (negotiated flat rate)" value={a.costs.trackdriveOutboundRate} step={0.001} suffix="$/min"
              onChange={v => update("costs", { trackdriveOutboundRate: v })}
              tooltip="Your negotiated flat outbound calling rate — fixed regardless of the volume tier above." />
          </div>

          <div style={{ fontSize: 12, fontWeight: 800, color: "#334155", margin: "16px 0 8px" }}>Transfer Acquisition Cost (per qualified transfer)</div>
          <div style={grid3}>
            <NumField label="1-Minute Buffer" value={a.costs.transferCost.buffer1min} suffix="$"
              tooltip="What Funding Tier pays a lead vendor per qualified inbound transfer at this buffer length."
              onChange={v => update("costs", { transferCost: { ...a.costs.transferCost, buffer1min: v } })} />
            <NumField label="2-Minute Buffer" value={a.costs.transferCost.buffer2min} suffix="$"
              tooltip="What Funding Tier pays a lead vendor per qualified inbound transfer at this buffer length."
              onChange={v => update("costs", { transferCost: { ...a.costs.transferCost, buffer2min: v } })} />
            <NumField label="5-Minute Buffer" value={a.costs.transferCost.buffer5min} suffix="$"
              tooltip="What Funding Tier pays a lead vendor per qualified inbound transfer at this buffer length."
              onChange={v => update("costs", { transferCost: { ...a.costs.transferCost, buffer5min: v } })} />
          </div>

          <div style={{ marginTop: 14 }}>
            <NumField label="Blended Labor Rate" value={a.costs.laborRatePerHour} suffix="$/hr"
              onChange={v => update("costs", { laborRatePerHour: v })}
              tooltip="Blended average hourly cost per agent, used to calculate total monthly labor cost from scheduled hours and seat count." />
          </div>
        </Accordion>

        <ExpenseStatement row={statementRow} month={clampedStatementMonth} setMonth={setStatementMonth} horizon={horizon}
          assumptions={a} />

        {/* ── 5. RISK & GROWTH POLICY ── */}
        <div style={{ fontSize: 13, fontWeight: 800, color: "#334155", marginTop: 4 }}>5 · How the model manages risk and decides when to grow</div>

        <Accordion title="Cash Reserve Policy" accent={FT_GREEN}
          tooltip="Defines how much cash the company should hold back as a safety buffer before profit is considered 'distributable' — and this reserve requirement is one of two conditions the Hiring Policy checks before recommending a new hire.">
          <div style={grid3}>
            <NumField label="Reserve Target" value={a.reservePolicy.targetMonthsOverhead} suffix="months of overhead"
              onChange={v => update("reservePolicy", { targetMonthsOverhead: v })}
              tooltip="How many months of overhead the company should keep in cash reserve before profit is considered safe to distribute." />
            <PctField label="Expected Dispute Rate (chargeback buffer)" valuePct={a.reservePolicy.expectedDisputeRatePct} max={10} step={0.1}
              onChangePct={v => update("reservePolicy", { expectedDisputeRatePct: v })}
              tooltip="A small ongoing safety buffer against the rare case of a client formally disputing a payment — which claws back commission and revenue already paid on that file." />
          </div>
        </Accordion>

        <Accordion title="Hiring Policy" accent={FT_PURPLE}
          tooltip="Controls when the model recommends adding agent capacity. A hire only triggers when BOTH the utilization threshold has been sustained AND the cash reserve target is met — capacity need alone isn't enough if the company can't yet afford it."
          subtitle="Requires BOTH sustained high utilization AND reserve target met">
          <div style={grid4}>
            <PctField label="Utilization Threshold" valuePct={a.hiringPolicy.utilizationThreshold * 100} max={100}
              onChangePct={v => update("hiringPolicy", { utilizationThreshold: v / 100 })}
              tooltip="% of agent capacity that, if sustained, signals the team is stretched thin and needs more headcount." />
            <NumField label="Sustain Period" value={a.hiringPolicy.sustainMonths} suffix="months"
              onChange={v => update("hiringPolicy", { sustainMonths: v })}
              tooltip="How many consecutive months utilization must stay above the threshold before a hire actually triggers — avoids overreacting to a single busy month." />
            <NumField label="Seats Added Per Hire" value={a.hiringPolicy.seatsAddedPerHire}
              onChange={v => update("hiringPolicy", { seatsAddedPerHire: v })}
              tooltip="How many new agent seats come online each time a hiring event triggers." />
            <NumField label="Hire Lag" value={a.hiringPolicy.hireLagMonths} suffix="months"
              onChange={v => update("hiringPolicy", { hireLagMonths: v })}
              tooltip="Months between the hiring signal and the new seat actually being staffed and productive (recruiting + onboarding time)." />
          </div>
          <div style={{ marginTop: 10, maxWidth: 260 }}>
            <NumField label="Max Seats (0 = no cap)" value={a.hiringPolicy.maxSeats ?? 0}
              onChange={v => update("hiringPolicy", { maxSeats: v > 0 ? v : null })}
              tooltip="Optional hard cap on total concurrent seats the model will ever hire up to. Leave at 0 for no cap." />
          </div>
        </Accordion>

        {/* ── 6. SURVIVAL CURVES (most speculative — pushed toward the end) ── */}
        <div style={{ fontSize: 13, fontWeight: 800, color: "#334155", marginTop: 4 }}>6 · Client attrition assumptions (estimates — least certain inputs)</div>

        <Accordion title="Survival Curves (per backend)" accent={FT_RED}
          subtitle="ILLUSTRATIVE ESTIMATES — not real data. See note below."
          tooltip="Models what % of enrolled clients are still active and paying at each month of their program. This is the least certain part of the whole model — treat every number here as a placeholder to refine with real data over time.">
          <div style={{ fontSize: 11, color: "#7f1d1d", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 13px", marginBottom: 14, lineHeight: 1.65 }}>
            Industry completion rates are contested: TASC (industry trade group) reports 35-60% full-program completion
            (avg 45-50%); GAO / state AG investigations found actual completion "often in the single digits." These curves
            are placeholders — calibrate toward real observed performance as data becomes available.
          </div>
          {(["LEVEL", "CS", "LEGACY"] as BackendKey[]).map(key => {
            const curve = a.survivalCurves[key];
            const label = key === "LEVEL" ? "Level Debt" : key === "CS" ? "Shield Services" : "Elite Legal Practice";
            return (
              <div key={key} style={{ marginBottom: 16, border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10 }}>{label}</div>
                <div style={grid3}>
                  <PctField label="First-Pay Conversion" valuePct={curve.firstPayPct} max={100}
                    tooltip="% of enrolled deals that ever make it to their first payment at all — some deals fall through before ever paying."
                    onChangePct={v => setA(prev => ({ ...prev, survivalCurves: { ...prev.survivalCurves, [key]: { ...curve, firstPayPct: v } } }))} />
                  <PctField label="Steady-State Monthly Cancel (Mo 7+)" valuePct={curve.steadyStateMonthlyCancelPct} max={20} step={0.1}
                    tooltip="The ongoing monthly cancellation rate assumed for clients who've been active 7 months or longer."
                    onChangePct={v => setA(prev => ({ ...prev, survivalCurves: { ...prev.survivalCurves, [key]: { ...curve, steadyStateMonthlyCancelPct: v } } }))} />
                </div>
                <div style={{ marginTop: 10 }}>
                  <label style={labelStyle}>Monthly Cancel % — Months 2 through 6
                    <InlineTip text="% of still-active clients from the prior month who cancel in each specific month — this is where most attrition risk concentrates early in a program." width={280} />
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {curve.cancelPctByMonth.map((v, i) => (
                      <input key={i} type="number" value={v} step={0.5} min={0} max={100}
                        onChange={e => {
                          const arr = [...curve.cancelPctByMonth];
                          arr[i] = Number(e.target.value);
                          setA(prev => ({ ...prev, survivalCurves: { ...prev.survivalCurves, [key]: { ...curve, cancelPctByMonth: arr } } }));
                        }}
                        style={{ ...inputStyle, textAlign: "center" }} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </Accordion>

        {/* ── MONTHLY TABLE ── */}
        <div style={{ fontSize: 13, fontWeight: 800, color: "#334155", marginTop: 4 }}>Full month-by-month output</div>
        <Accordion title="Month-by-Month Detail" defaultOpen accent={FT_GREEN}
          tooltip="The raw monthly output of the simulation — every number above (Peak Cash Burn, Total Revenue, etc.) is derived from this table.">
          <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ background: "#f1f5f9" }}>
                {["Mo", "Deals", "Revenue", "Commission", "Overhead", "Net CF", "Cash Position", "Reserve Met", "Seats", "Utilization", "Event"].map(h => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {rows.map((r: MonthRow, i: number) => {
                  const hireEvent = result.hiringEvents.find((h: HiringEvent) => h.month === r.month);
                  return (
                    <tr key={r.month} style={{ background: hireEvent ? `${FT_GREEN}18` : i % 2 ? "#f8fafc" : "#fff" }}>
                      <td style={{ padding: "7px 10px", fontWeight: 700 }}>{r.month}</td>
                      <td style={{ padding: "7px 10px" }}>{r.newDealsTotal}</td>
                      <td style={{ padding: "7px 10px" }}>{money.format(r.revenue)}</td>
                      <td style={{ padding: "7px 10px" }}>{money.format(r.commission)}</td>
                      <td style={{ padding: "7px 10px" }}>{money.format(r.overhead)}</td>
                      <td style={{ padding: "7px 10px", color: r.netCashFlow >= 0 ? FT_GREEN_DARK : FT_RED, fontWeight: 700 }}>{money.format(r.netCashFlow)}</td>
                      <td style={{ padding: "7px 10px", fontWeight: 800, color: r.cashPosition >= 0 ? FT_GREEN_DARK : FT_RED }}>{money.format(r.cashPosition)}</td>
                      <td style={{ padding: "7px 10px", color: r.reserveMet ? FT_GREEN_DARK : "#94a3b8", fontWeight: r.reserveMet ? 700 : 400 }}>{r.reserveMet ? "Yes" : "No"}</td>
                      <td style={{ padding: "7px 10px" }}>{r.concurrentSeats}</td>
                      <td style={{ padding: "7px 10px", color: r.utilizationPct >= 85 ? FT_AMBER : "inherit", fontWeight: r.utilizationPct >= 85 ? 700 : 400 }}>{pct(r.utilizationPct)}</td>
                      <td style={{ padding: "7px 10px", fontWeight: 800, color: FT_GREEN_DARK }}>{hireEvent ? `★ Hire → ${hireEvent.seatsAfter} seats` : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Accordion>

      </div>
    </div>
  );
}
