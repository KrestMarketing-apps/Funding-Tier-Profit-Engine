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
  textTransform: "uppercase", letterSpacing: 0.4, display: "block",
};

// ─────────────────────────────────────────────
// SHARED SUBCOMPONENTS
// ─────────────────────────────────────────────

function MetricCard({ title, value, subtitle, color = "#0f172a" }: {
  title: string; value: string; subtitle?: string; color?: string;
}) {
  return (
    <div style={card}>
      <div style={labelStyle}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1.15, wordBreak: "break-word" }}>{value}</div>
      {subtitle && <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>{subtitle}</div>}
    </div>
  );
}

function Accordion({ title, subtitle, defaultOpen = false, children, accent = FT_GREEN }: {
  title: string; subtitle?: string; defaultOpen?: boolean; children: React.ReactNode; accent?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden", background: "#fff", borderLeft: `4px solid ${accent}` }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", textAlign: "left", background: "#fff", border: "none",
        padding: "13px 18px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{subtitle}</div>}
        </div>
        <span style={{ fontSize: 20, fontWeight: 900, color: accent, flexShrink: 0, paddingLeft: 12 }}>{open ? "−" : "+"}</span>
      </button>
      {open && <div style={{ borderTop: "1px solid #e2e8f0", padding: 18 }}>{children}</div>}
    </div>
  );
}

function NumField({ label, value, onChange, step = 1, min, max, suffix }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}{suffix ? ` (${suffix})` : ""}</label>
      <input type="number" value={value} step={step} min={min} max={max}
        onChange={e => onChange(Number(e.target.value))} style={inputStyle} />
    </div>
  );
}

function PctField({ label, valuePct, onChangePct, step = 0.5, min = 0, max = 100 }: {
  label: string; valuePct: number; onChangePct: (v: number) => void; step?: number; min?: number; max?: number;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="range" min={min} max={max} step={step} value={valuePct}
          onChange={e => onChangePct(Number(e.target.value))}
          style={{ flex: 1, accentColor: FT_GREEN }} />
        <span style={{ fontSize: 13, fontWeight: 800, color: FT_GREEN_DARK, width: 52, textAlign: "right" }}>{valuePct}%</span>
      </div>
    </div>
  );
}

const grid3: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 };
const grid4: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 };

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

export default function FundingTierOperatingModel() {
  // Deep-clone the defaults so we never mutate the shared constant
  const [a, setA] = useState<Assumptions>(() => JSON.parse(JSON.stringify(DEFAULT_ASSUMPTIONS)));

  // Ramp planner — separate from assumptions since it drives the deal-volume function, not a static number
  const [rampMonths, setRampMonths] = useState(12);
  const [rampTargets, setRampTargets] = useState<Record<BackendKey, number>>({ LEVEL: 25, CS: 30, LEGACY: 20 });
  const [avgDebt, setAvgDebt] = useState<Record<BackendKey, number>>({ LEVEL: 16000, CS: 15000, LEGACY: 14000 });
  const [horizon, setHorizon] = useState(36);

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

  const rows = result.rows;
  const final = rows[rows.length - 1];
  const peakBurn = Math.min(...rows.map(r => r.cashPosition));
  const firstPositive = rows.find(r => r.cashPosition > 0)?.month ?? null;
  const firstReserveMet = rows.find(r => r.reserveMet)?.month ?? null;
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalCommission = rows.reduce((s, r) => s + r.commission, 0);
  const peakUtilization = Math.max(...rows.map(r => r.utilizationPct));

  return (
    <div style={{ minHeight: "100vh", background: FT_BG, color: "#0f172a",
      fontFamily: 'Inter, Arial, Helvetica, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif' }}>

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

        {/* ── KEY OUTCOMES ── */}
        <div style={grid4}>
          <MetricCard title="Peak Cash Burn" value={money.format(peakBurn)} color={peakBurn < 0 ? FT_RED : FT_GREEN_DARK}
            subtitle="Lowest cumulative cash position reached" />
          <MetricCard title="First Cash-Positive Month" value={firstPositive ? `Month ${firstPositive}` : "Not within horizon"}
            color={firstPositive ? FT_GREEN_DARK : FT_RED} />
          <MetricCard title="Reserve Target First Met" value={firstReserveMet ? `Month ${firstReserveMet}` : "Not within horizon"}
            color={firstReserveMet ? FT_GREEN_DARK : FT_AMBER} />
          <MetricCard title={`Final Cash (Mo ${horizon})`} value={money.format(final.cashPosition)} color={FT_GREEN_DARK}
            subtitle={`Distributable above reserve: ${money.format(final.distributable)}`} />
        </div>
        <div style={grid4}>
          <MetricCard title="Total Revenue" value={money.format(totalRevenue)} subtitle={`Over ${horizon} months`} />
          <MetricCard title="Total Commission Paid" value={money.format(totalCommission)} />
          <MetricCard title="Final Seat Count" value={String(final.concurrentSeats)}
            subtitle={`Started at ${a.headcount.concurrentSeats} · ${result.hiringEvents.length} hire${result.hiringEvents.length === 1 ? "" : "s"} triggered`} />
          <MetricCard title="Peak Utilization" value={pct(peakUtilization)} color={peakUtilization >= 85 ? FT_AMBER : FT_GREEN_DARK} />
        </div>

        {/* ── HIRING TIMELINE ── */}
        {result.hiringEvents.length > 0 && (
          <div style={{ ...card, background: `${FT_GREEN}0d`, border: `1px solid ${FT_GREEN}33` }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: FT_GREEN_DARK, marginBottom: 8 }}>Hiring Events (triggered by capacity + reserve health, both required)</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {result.hiringEvents.map((h, i) => (
                <div key={i} style={{ background: "#fff", border: `1px solid ${FT_GREEN}44`, borderRadius: 10, padding: "8px 14px" }}>
                  <span style={{ fontWeight: 800, color: FT_GREEN_DARK }}>Month {h.month}</span>
                  <span style={{ color: "#64748b", marginLeft: 8 }}>→ {h.seatsAfter} concurrent seats</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── RAMP PLANNER ── */}
        <Accordion title="Deal Volume Ramp Planner" defaultOpen accent={FT_GREEN}
          subtitle="Linear ramp from ~1 deal/mo to the full-volume target over the ramp period">
          <div style={grid4}>
            <NumField label="Ramp Period" value={rampMonths} onChange={setRampMonths} suffix="months" min={1} />
            <NumField label="Simulation Horizon" value={horizon} onChange={setHorizon} suffix="months" min={1} max={60} />
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
                  <NumField label="Target Deals/Month" value={rampTargets[key]} onChange={v => setRampTargets(p => ({ ...p, [key]: v }))} />
                  <NumField label="Avg Enrolled Debt" value={avgDebt[key]} onChange={v => setAvgDebt(p => ({ ...p, [key]: v }))} step={500} />
                </div>
              </div>
            ))}
          </div>
        </Accordion>

        {/* ── BACKEND: LEVEL DEBT ── */}
        <Accordion title="Level Debt — Backend Assumptions" accent={FT_GREEN}>
          <div style={grid3}>
            <PctField label="Revenue Share" valuePct={a.levelDebt.revenueSharePct * 100} step={0.5}
              onChangePct={v => update("levelDebt", { revenueSharePct: v / 100 })} />
            <NumField label="Revenue Recognized" value={a.levelDebt.revenueRecognizedMonth} suffix="month"
              onChange={v => update("levelDebt", { revenueRecognizedMonth: v })} />
            <NumField label="Agent Payout" value={a.levelDebt.agentPayoutMonth} suffix="month"
              onChange={v => update("levelDebt", { agentPayoutMonth: v })} />
          </div>
          <div style={{ marginTop: 14, fontSize: 12, fontWeight: 800, color: "#334155" }}>Graduated commission tiers (0.75%–2.5%, by monthly enrolled volume)</div>
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

        {/* ── BACKEND: CONSUMER SHIELD ── */}
        <Accordion title="Shield Services (Consumer Shield) — Backend Assumptions" accent={FT_BLUE}>
          <div style={grid4}>
            <NumField label="Servicing Deduction" value={a.consumerShield.servicingDeductionPerPayment} suffix="$/payment"
              onChange={v => update("consumerShield", { servicingDeductionPerPayment: v })} />
            <NumField label="Front Months" value={a.consumerShield.frontMonths}
              onChange={v => update("consumerShield", { frontMonths: v })} />
            <PctField label="Front Capture Rate" valuePct={a.consumerShield.frontCaptureRate * 100} max={100}
              onChangePct={v => update("consumerShield", { frontCaptureRate: v / 100 })} />
            <PctField label="Backend Capture Rate" valuePct={a.consumerShield.backendCaptureRate * 100} max={100}
              onChangePct={v => update("consumerShield", { backendCaptureRate: v / 100 })} />
          </div>
          <div style={{ marginTop: 10 }}>
            <NumField label="Agent Payout Month" value={a.consumerShield.agentPayoutMonth}
              onChange={v => update("consumerShield", { agentPayoutMonth: v })} />
          </div>
        </Accordion>

        {/* ── BACKEND: LEGACY ── */}
        <Accordion title="Elite Legal Practice (Legacy Capital) — Backend Assumptions" accent={FT_PURPLE}>
          <div style={grid4}>
            <NumField label="Min Monthly Payment" value={a.legacy.minMonthlyPayment} suffix="$"
              onChange={v => update("legacy", { minMonthlyPayment: v })} />
            <NumField label="Draft Fee" value={a.legacy.draftFee} suffix="$"
              onChange={v => update("legacy", { draftFee: v })} />
            <NumField label="Admin Monthly Fee" value={a.legacy.adminMonthlyFee} suffix="$"
              onChange={v => update("legacy", { adminMonthlyFee: v })} />
            <PctField label="Tier 1 Rate (post pass-through)" valuePct={a.legacy.tier1Rate * 100} max={100}
              onChangePct={v => update("legacy", { tier1Rate: v / 100 })} />
          </div>
          <div style={{ marginTop: 14 }}>
            <PctField label="Sliding Fee Rate (35%–49% of enrolled debt)" valuePct={a.legacy.feeRate * 100}
              min={35} max={49} step={1} onChangePct={v => update("legacy", { feeRate: v / 100 })} />
            <div style={{ fontSize: 11, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 11px", marginTop: 8, lineHeight: 1.6 }}>
              ⚠ Higher fee extends program term (to stay near the min monthly payment floor) more than it raises the monthly payment.
              This model holds the survival curve constant across fee rates — in reality a higher fee likely affects close rate and
              retention differently, which isn't yet modeled.
            </div>
          </div>
        </Accordion>

        {/* ── COST STACK ── */}
        <Accordion title="Cost Stack" accent={FT_AMBER} subtitle="Fixed tools, per-user tools, usage rates, Trackdrive, transfer cost, labor">
          <div style={{ fontSize: 12, fontWeight: 800, color: "#334155", marginBottom: 8 }}>Fixed Monthly Tools</div>
          <div style={grid3}>
            {a.costs.fixedCosts.map((c, i) => (
              <NumField key={i} label={c.label} value={c.amount} suffix="$/mo"
                onChange={v => {
                  const arr = [...a.costs.fixedCosts]; arr[i] = { ...arr[i], amount: v };
                  update("costs", { fixedCosts: arr });
                }} />
            ))}
          </div>

          <div style={{ fontSize: 12, fontWeight: 800, color: "#334155", margin: "16px 0 8px" }}>Per-User Tools</div>
          <div style={grid3}>
            {a.costs.perUserCosts.map((c, i) => (
              <NumField key={i} label={`${c.label} (${c.appliesTo === "all" ? "company-wide" : "ELP only"})`} value={c.amountPerUser} suffix="$/user/mo"
                onChange={v => {
                  const arr = [...a.costs.perUserCosts]; arr[i] = { ...arr[i], amountPerUser: v };
                  update("costs", { perUserCosts: arr });
                }} />
            ))}
          </div>

          <div style={{ fontSize: 12, fontWeight: 800, color: "#334155", margin: "16px 0 8px" }}>Krest Marketing App Usage Rates</div>
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

          <div style={{ fontSize: 12, fontWeight: 800, color: "#334155", margin: "16px 0 8px" }}>Trackdrive (tiered — resolves automatically by call volume)</div>
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
              onChange={v => update("costs", { trackdriveOutboundRate: v })} />
          </div>

          <div style={{ fontSize: 12, fontWeight: 800, color: "#334155", margin: "16px 0 8px" }}>Transfer Acquisition Cost (per qualified transfer)</div>
          <div style={grid3}>
            <NumField label="1-Minute Buffer" value={a.costs.transferCost.buffer1min} suffix="$"
              onChange={v => update("costs", { transferCost: { ...a.costs.transferCost, buffer1min: v } })} />
            <NumField label="2-Minute Buffer" value={a.costs.transferCost.buffer2min} suffix="$"
              onChange={v => update("costs", { transferCost: { ...a.costs.transferCost, buffer2min: v } })} />
            <NumField label="5-Minute Buffer" value={a.costs.transferCost.buffer5min} suffix="$"
              onChange={v => update("costs", { transferCost: { ...a.costs.transferCost, buffer5min: v } })} />
          </div>

          <div style={{ marginTop: 14 }}>
            <NumField label="Blended Labor Rate" value={a.costs.laborRatePerHour} suffix="$/hr"
              onChange={v => update("costs", { laborRatePerHour: v })} />
          </div>
        </Accordion>

        {/* ── OPERATIONS ── */}
        <Accordion title="Operations" accent={FT_GREEN} subtitle="Close rate, average handle time, transfer buffer">
          <div style={grid4}>
            <PctField label="Close Rate (qualified transfer → signed deal)" valuePct={a.operations.closeRate * 100} max={100}
              onChangePct={v => update("operations", { closeRate: v / 100 })} />
            <NumField label="Avg Handle Time" value={a.operations.avgCallMinutesPerDeal} suffix="min/call"
              onChange={v => update("operations", { avgCallMinutesPerDeal: v })} />
            <div>
              <label style={labelStyle}>Transfer Buffer</label>
              <select value={a.operations.transferBuffer} onChange={e => update("operations", { transferBuffer: e.target.value as any })} style={inputStyle}>
                <option value="buffer1min">1-minute buffer ({money.format(a.costs.transferCost.buffer1min)})</option>
                <option value="buffer2min">2-minute buffer ({money.format(a.costs.transferCost.buffer2min)})</option>
                <option value="buffer5min">5-minute buffer ({money.format(a.costs.transferCost.buffer5min)})</option>
              </select>
            </div>
            <div />
          </div>
          <div style={{ fontSize: 11, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 11px", marginTop: 12, lineHeight: 1.6 }}>
            ⚠ Debt-relief enrollment calls run 45-90 min per your own operational data. Close rate applies to every qualified
            (buffer-cleared) transfer, not just successful enrollments — agents spend time on calls that don't close too.
          </div>
        </Accordion>

        {/* ── HEADCOUNT ── */}
        <Accordion title="Starting Headcount &amp; Schedule" accent={FT_BLUE}>
          <div style={grid4}>
            <NumField label="Starting Total Headcount" value={a.headcount.totalHeadcount}
              onChange={v => update("headcount", { totalHeadcount: v })} />
            <NumField label="Legacy-Specific Headcount" value={a.headcount.legacyHeadcount}
              onChange={v => update("headcount", { legacyHeadcount: v })} />
            <NumField label="Starting Concurrent Seats" value={a.headcount.concurrentSeats}
              onChange={v => update("headcount", { concurrentSeats: v })} />
            <NumField label="Active DIDs (phone numbers)" value={a.headcount.activeDIDs}
              onChange={v => update("headcount", { activeDIDs: v })} />
          </div>
          <div style={{ marginTop: 10 }}>
            <NumField label="Scheduled Hours / Week" value={a.headcount.scheduledHoursPerWeek} suffix="hrs"
              onChange={v => update("headcount", { scheduledHoursPerWeek: v })} />
          </div>
        </Accordion>

        {/* ── RESERVE & HIRING POLICY ── */}
        <Accordion title="Cash Reserve Policy" accent={FT_GREEN}>
          <div style={grid3}>
            <NumField label="Reserve Target" value={a.reservePolicy.targetMonthsOverhead} suffix="months of overhead"
              onChange={v => update("reservePolicy", { targetMonthsOverhead: v })} />
            <PctField label="Expected Dispute Rate (chargeback buffer)" valuePct={a.reservePolicy.expectedDisputeRatePct} max={10} step={0.1}
              onChangePct={v => update("reservePolicy", { expectedDisputeRatePct: v })} />
          </div>
        </Accordion>

        <Accordion title="Hiring Policy" accent={FT_PURPLE} subtitle="Requires BOTH sustained high utilization AND reserve target met">
          <div style={grid4}>
            <PctField label="Utilization Threshold" valuePct={a.hiringPolicy.utilizationThreshold * 100} max={100}
              onChangePct={v => update("hiringPolicy", { utilizationThreshold: v / 100 })} />
            <NumField label="Sustain Period" value={a.hiringPolicy.sustainMonths} suffix="months"
              onChange={v => update("hiringPolicy", { sustainMonths: v })} />
            <NumField label="Seats Added Per Hire" value={a.hiringPolicy.seatsAddedPerHire}
              onChange={v => update("hiringPolicy", { seatsAddedPerHire: v })} />
            <NumField label="Hire Lag" value={a.hiringPolicy.hireLagMonths} suffix="months"
              onChange={v => update("hiringPolicy", { hireLagMonths: v })} />
          </div>
          <div style={{ marginTop: 10, maxWidth: 260 }}>
            <NumField label="Max Seats (0 = no cap)" value={a.hiringPolicy.maxSeats ?? 0}
              onChange={v => update("hiringPolicy", { maxSeats: v > 0 ? v : null })} />
          </div>
        </Accordion>

        {/* ── SURVIVAL CURVES ── */}
        <Accordion title="Survival Curves (per backend)" accent={FT_RED}
          subtitle="ILLUSTRATIVE ESTIMATES — not real data. See note below.">
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
                    onChangePct={v => setA(prev => ({ ...prev, survivalCurves: { ...prev.survivalCurves, [key]: { ...curve, firstPayPct: v } } }))} />
                  <PctField label="Steady-State Monthly Cancel (Mo 7+)" valuePct={curve.steadyStateMonthlyCancelPct} max={20} step={0.1}
                    onChangePct={v => setA(prev => ({ ...prev, survivalCurves: { ...prev.survivalCurves, [key]: { ...curve, steadyStateMonthlyCancelPct: v } } }))} />
                </div>
                <div style={{ marginTop: 10 }}>
                  <label style={labelStyle}>Monthly Cancel % — Months 2 through 6</label>
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
        <Accordion title="Month-by-Month Detail" defaultOpen accent={FT_GREEN}>
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
