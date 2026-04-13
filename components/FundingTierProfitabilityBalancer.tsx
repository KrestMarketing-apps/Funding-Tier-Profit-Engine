"use client";

import React, { useMemo, useState, useCallback } from "react";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

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
  levelDebtEligible: boolean;
  levelDebtRevenue: number;
  levelDebtRevShareEligible: boolean;
  consumerShieldPayment: number | null;
  consumerShieldTerm: number | null;
  consumerShieldNetPayment: number | null;
  consumerShieldRevenueAfter2: number | null;
  consumerShieldRevenueAfter4: number | null;
  consumerShieldFrontRevenue: number | null;
  consumerShieldBackRevenueMonthly: number | null;
  consumerShieldRevenueAtHalf: number | null;
  consumerShieldRevenueAtFull: number | null;
  consumerShieldExpectedRevenue: number | null;
  consumerShieldBreakEvenMonthVsLevel: number | null;
  consumerShieldLiabilityClearMonth: number | null;
  consumerShieldTimeline: TimelineRow[];
  effectiveP2: number;
  effectiveP4: number;
  effectiveBE: number;
  effectiveComp: number;
  recommendedBackend: "Level Debt" | "Consumer Shield" | "Consumer Shield (Required — Under $7k)" | "No Recommendation";
  recommendationReason: string;
};

// ─────────────────────────────────────────────
// ASSETS & CONSTANTS
// ─────────────────────────────────────────────

const FT_LOGO         = "https://assets.cdn.filesafe.space/S4ztIlDxBovAboldwbOR/media/68783cf82035bab4d790ae7e.png";
const LEVEL_DEBT_LOGO = "https://assets.cdn.filesafe.space/S4ztIlDxBovAboldwbOR/media/69c35b2cab2203b0fc83186d.webp";
const CS_LOGO         = "https://assets.cdn.filesafe.space/S4ztIlDxBovAboldwbOR/media/69c35b2c25c6995d2d2d21fa.png";

const FT_GREEN      = "#0f9d8a";
const FT_GREEN_DARK = "#0b7d6e";
const FT_HYPER      = "#00ff88";
const FT_BLUE       = "#1a6ed8";
const FT_AMBER      = "#f59e0b";
const FT_RED        = "#ef4444";
const FT_BG         = "#f8fafc";

const money      = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const percentFmt = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });

// ─────────────────────────────────────────────
// CS PROGRAM GRID
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

/**
 * Lead quality degrades effective CS survival rates.
 * At quality=100: multiplier=1.0 (rates unchanged)
 * At quality=50:  multiplier≈0.675 (rates degraded)
 * At quality=0:   multiplier=0.35  (floor — even bad leads, some survive)
 *
 * Formula: effectiveRate = baseRate × (0.35 + 0.65 × quality/100)
 * Cascade is re-enforced after applying quality scalar.
 */
function applyLeadQuality(p2: number, p4: number, be: number, comp: number, quality: number): [number, number, number, number] {
  const q = quality / 100;
  const scalar = 0.35 + 0.65 * q;
  let ep2   = round2(p2   * scalar);
  let ep4   = round2(Math.min(p4   * scalar, ep2));
  let ebe   = round2(Math.min(be   * scalar, ep4));
  let ecomp = round2(Math.min(comp * scalar, ebe));
  return [ep2, ep4, ebe, ecomp];
}

/**
 * Cash urgency → recommended % of deals above $7k to route to Level Debt.
 * 100% urgency = need cash in ~90 days  → route ~85% to Level Debt
 * 50%  urgency = need cash in ~180 days → route ~53% to Level Debt
 * 0%   urgency = no near-term cash need → route ~20% to Level Debt (maximize CS LTV)
 *
 * Formula: recommendedLDPct = 20 + (urgency × 0.65)
 */
function cashUrgencyToRouting(urgency: number): { ldPct: number; horizon: string; rationale: string } {
  const ldPct = Math.round(20 + urgency * 0.65);
  let horizon = "", rationale = "";
  if (urgency >= 90) {
    horizon   = "~90 days";
    rationale = "Maximum Level Debt routing to maximize near-term revenue recognition. CS deals won't break even within your cash window.";
  } else if (urgency >= 65) {
    horizon   = "~120–150 days";
    rationale = "Heavily weighted to Level Debt. A small CS allocation captures upside on the highest-quality deals only.";
  } else if (urgency >= 40) {
    horizon   = "~180 days";
    rationale = "Balanced approach. Level Debt funds operations while CS builds a long-tail revenue stack.";
  } else if (urgency >= 20) {
    horizon   = "~270 days";
    rationale = "Lean toward CS. You have enough runway to let the back-end revenue materialize on good-quality deals.";
  } else {
    horizon   = "No near-term constraint";
    rationale = "Maximize Consumer Shield routing for highest long-term LTV. Use Level Debt only as a cash buffer floor.";
  }
  return { ldPct, horizon, rationale };
}

/**
 * CORRECTED EXPECTED REVENUE
 * p2 >= p4 >= be >= comp (all as decimals 0–1, after lead quality applied)
 * Each rate = % of ALL CS deals reaching that milestone.
 */
function calcExpectedRevenue(
  ep2: number, ep4: number, ebe: number, ecomp: number,
  rev2: number, rev4: number, revBE: number, fullRev: number
): number {
  return round2(
    (ep2  - ep4)   * rev2
    + (ep4 - ebe)  * rev4
    + (ebe - ecomp)* revBE
    + ecomp        * fullRev
  );
}

// ─────────────────────────────────────────────
// CORE CALCULATOR
// ─────────────────────────────────────────────

function calculateDealMetrics(args: {
  debtAmount: number;
  p2Pct: number; p4Pct: number; bePct: number; compPct: number;
  leadQuality: number;
  cashUrgency: number;
}): DealMetrics {
  const { debtAmount, p2Pct, p4Pct, bePct, compPct, leadQuality, cashUrgency } = args;

  const levelDebtEligible = debtAmount >= 7000;
  const ldRev = levelDebtEligible ? round2(debtAmount * 0.08) : 0;
  const prog  = getProgram(debtAmount);

  // Apply lead quality to get effective CS rates
  const [ep2, ep4, ebe, ecomp] = applyLeadQuality(p2Pct, p4Pct, bePct, compPct, leadQuality);

  const empty: DealMetrics = {
    debtAmount, levelDebtEligible, levelDebtRevenue: ldRev,
    levelDebtRevShareEligible: debtAmount >= 120000,
    consumerShieldPayment: null, consumerShieldTerm: null, consumerShieldNetPayment: null,
    consumerShieldRevenueAfter2: null, consumerShieldRevenueAfter4: null,
    consumerShieldFrontRevenue: null, consumerShieldBackRevenueMonthly: null,
    consumerShieldRevenueAtHalf: null, consumerShieldRevenueAtFull: null,
    consumerShieldExpectedRevenue: null, consumerShieldBreakEvenMonthVsLevel: null,
    consumerShieldLiabilityClearMonth: null, consumerShieldTimeline: [],
    effectiveP2: ep2, effectiveP4: ep4, effectiveBE: ebe, effectiveComp: ecomp,
    recommendedBackend: "No Recommendation",
    recommendationReason: "Debt amount falls outside the configured range.",
  };

  if (!prog) return empty;

  const { payment, term } = prog;
  const net   = payment - 40;
  const tl    = buildTimeline(net, term);
  const rev2  = csRevenueAt(2, net, term);
  const rev4  = csRevenueAt(4, net, term);
  const front = round2(net * Math.min(4, term));
  const tailM = round2(net * 0.35);
  const tailF = round2(Math.max(0, term - 4) * tailM);
  const fullR = round2(front + tailF);
  const be    = levelDebtEligible ? calcBreakEven(ldRev, net, term) : null;
  const revBE = be ? csRevenueAt(be, net, term) : 0;
  const liabilityClearMonth = be !== null ? be + 4 : null;

  const expected = calcExpectedRevenue(ep2/100, ep4/100, ebe/100, ecomp/100, rev2, rev4, revBE, fullR);

  let recommendedBackend: DealMetrics["recommendedBackend"] = "No Recommendation";
  let recommendationReason = "";

  if (!levelDebtEligible) {
    recommendedBackend = "Consumer Shield (Required — Under $7k)";
    recommendationReason = "Deals under $7,000 enrolled debt cannot be routed to Level Debt. Consumer Shield is the only eligible backend for this deal.";
  } else {
    const urgencyRouting = cashUrgencyToRouting(cashUrgency);
    // Use cash urgency routing threshold + lead quality to decide
    // If urgency says route 70%+ to LD, and this is a borderline deal → LD wins
    const urgencyBias = cashUrgency / 100; // 0=prefer CS, 1=prefer LD
    const qualityBias = leadQuality / 100; // 0=low quality→LD safer, 1=high quality→CS viable

    // Expected CS vs LD comparison adjusted for urgency and quality
    const ldAdjusted = ldRev * (1 + urgencyBias * 0.6);
    const csAdjusted = expected * (0.5 + qualityBias * 0.7) * (1 - urgencyBias * 0.35);

    if (csAdjusted > ldAdjusted) {
      recommendedBackend = "Consumer Shield";
      recommendationReason = `CS wins on adjusted expected value. Effective survival rates after lead quality: P2=${ep2}% P4=${ep4}% BE=${ebe}% Complete=${ecomp}%.`;
    } else {
      recommendedBackend = "Level Debt";
      recommendationReason = `Level Debt wins — ${urgencyBias > 0.5 ? "cash urgency favors fast recognition" : "adjusted CS expected value doesn't clear the LD benchmark"} given current lead quality (${leadQuality}%) and urgency (${cashUrgency}%).`;
    }
  }

  return {
    debtAmount, levelDebtEligible, levelDebtRevenue: ldRev,
    levelDebtRevShareEligible: debtAmount >= 120000,
    consumerShieldPayment: payment, consumerShieldTerm: term, consumerShieldNetPayment: net,
    consumerShieldRevenueAfter2: rev2, consumerShieldRevenueAfter4: rev4,
    consumerShieldFrontRevenue: front, consumerShieldBackRevenueMonthly: tailM,
    consumerShieldRevenueAtHalf: fractionRevenue(0.5, net, term),
    consumerShieldRevenueAtFull: fullR,
    consumerShieldExpectedRevenue: expected,
    consumerShieldBreakEvenMonthVsLevel: be,
    consumerShieldLiabilityClearMonth: liabilityClearMonth,
    consumerShieldTimeline: tl,
    effectiveP2: ep2, effectiveP4: ep4, effectiveBE: ebe, effectiveComp: ecomp,
    recommendedBackend, recommendationReason,
  };
}

// ─────────────────────────────────────────────
// SHARED STYLES
// ─────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "#fff", border: "1px solid #e2e8f0",
  borderRadius: 16, padding: 16, boxShadow: "0 3px 12px rgba(15,23,42,0.05)",
};

const TH: React.CSSProperties = {
  padding: "10px 13px", borderBottom: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0",
  color: FT_GREEN, fontWeight: 800, whiteSpace: "nowrap", fontSize: 12, textAlign: "left",
};

const TD: React.CSSProperties = {
  padding: "10px 13px", borderBottom: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0",
  color: "#0f172a", fontSize: 13, textAlign: "left",
};

// ─────────────────────────────────────────────
// CASCADING FUNNEL SLIDERS
// ─────────────────────────────────────────────

function CascadingFunnel({ p2, p4, be, comp, onChange }: {
  p2: number; p4: number; be: number; comp: number;
  onChange: (p2: number, p4: number, be: number, comp: number) => void;
}) {
  const stages = [
    { key: "p2",   val: p2,   label: "CS Reach Payment 2",   color: FT_GREEN },
    { key: "p4",   val: p4,   label: "CS Reach Payment 4",   color: FT_BLUE  },
    { key: "be",   val: be,   label: "CS Reach Break-Even",  color: FT_AMBER },
    { key: "comp", val: comp, label: "CS Complete Program",  color: FT_HYPER },
  ];

  const handleChange = (key: string, newVal: number) => {
    let [np2, np4, nbe, ncomp] = [p2, p4, be, comp];
    if (key === "p2")        { np2 = newVal; np4 = Math.min(np4, np2); nbe = Math.min(nbe, np4); ncomp = Math.min(ncomp, nbe); }
    else if (key === "p4")   { np4 = newVal; np2 = Math.max(np2, np4); nbe = Math.min(nbe, np4); ncomp = Math.min(ncomp, nbe); }
    else if (key === "be")   { nbe = newVal; np4 = Math.max(np4, nbe); np2 = Math.max(np2, np4); ncomp = Math.min(ncomp, nbe); }
    else                     { ncomp = newVal; nbe = Math.max(nbe, ncomp); np4 = Math.max(np4, nbe); np2 = Math.max(np2, np4); }
    onChange(np2, np4, nbe, ncomp);
  };

  return (
    <div style={{ display: "flex", gap: 10, flex: 1, flexWrap: "wrap" }}>
      {stages.map(s => (
        <div key={s.key} style={{ flex: 1, minWidth: 88 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: s.color, marginBottom: 3,
            textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap",
            overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
          <input type="range" min={0} max={100} step={1} value={s.val}
            onChange={e => handleChange(s.key, Number(e.target.value))}
            style={{ width: "100%", accentColor: s.color }} />
          <div style={{ fontSize: 11, fontWeight: 800, color: s.color, marginTop: 1 }}>{s.val}%</div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// CASH URGENCY ROUTING PANEL
// ─────────────────────────────────────────────

function CashUrgencyPanel({ urgency, onChange, debtAmount }: {
  urgency: number; onChange: (v: number) => void; debtAmount: number;
}) {
  const routing = cashUrgencyToRouting(urgency);
  const csPct   = 100 - routing.ldPct;
  const under7k = debtAmount < 7000 && debtAmount >= 4000;

  const horizonMarkers = [
    { label: "No urgency", pct: 0 },
    { label: "270 days",   pct: 25 },
    { label: "180 days",   pct: 50 },
    { label: "120 days",   pct: 75 },
    { label: "90 days",    pct: 100 },
  ];

  return (
    <div style={{ ...card, borderLeft: `4px solid ${FT_AMBER}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>Cash Urgency — Portfolio Routing Driver</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 3, lineHeight: 1.6, maxWidth: 560 }}>
            How quickly does Funding Tier need cash to fuel operations and growth? This drives the recommended allocation of deals above $7k between Level Debt and Consumer Shield.
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>Cash Horizon</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: FT_AMBER }}>{routing.horizon}</div>
        </div>
      </div>

      {/* Slider */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          {horizonMarkers.map(m => (
            <span key={m.pct} style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>{m.label}</span>
          ))}
        </div>
        <input type="range" min={0} max={100} step={1} value={urgency}
          onChange={e => onChange(Number(e.target.value))}
          style={{ width: "100%", accentColor: FT_AMBER }} />
        <div style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: FT_AMBER, marginTop: 2 }}>{urgency}%</div>
      </div>

      {/* Routing recommendation */}
      {under7k ? (
        <div style={{ background: FT_RED + "11", border: `1px solid ${FT_RED}33`, borderRadius: 12,
          padding: "12px 14px" }}>
          <div style={{ fontWeight: 800, color: FT_RED, fontSize: 13 }}>⛔ Deal Under $7,000 — Level Debt Cannot Accept This Deal</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, lineHeight: 1.6 }}>
            Level Debt only accepts enrolled debt of $7,000 or more. This deal must route to Consumer Shield regardless of cash urgency.
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
          <div style={{ background: FT_GREEN + "11", border: `1px solid ${FT_GREEN}33`,
            borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: FT_GREEN_DARK, textTransform: "uppercase", letterSpacing: 0.4 }}>
              Recommended — Level Debt (Deals &gt;$7k)
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: FT_GREEN_DARK, lineHeight: 1 }}>{routing.ldPct}%</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, lineHeight: 1.5 }}>
              Route this share of deals above $7k to Level Debt for fast 8% recognition
            </div>
          </div>
          <div style={{ background: FT_BLUE + "11", border: `1px solid ${FT_BLUE}33`,
            borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: FT_BLUE, textTransform: "uppercase", letterSpacing: 0.4 }}>
              Recommended — Consumer Shield (Deals &gt;$7k)
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: FT_BLUE, lineHeight: 1 }}>{csPct}%</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, lineHeight: 1.5 }}>
              Route this share to Consumer Shield for higher long-term LTV
            </div>
          </div>
          <div style={{ gridColumn: "1/-1", fontSize: 13, color: "#475569", lineHeight: 1.7,
            background: "#f8fafc", borderRadius: 10, padding: "10px 13px" }}>
            <strong style={{ color: "#0f172a" }}>Rationale:</strong> {routing.rationale}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// LEAD QUALITY PANEL
// ─────────────────────────────────────────────

function LeadQualityPanel({ quality, onChange, p2Pct, p4Pct, bePct, compPct, ep2, ep4, ebe, ecomp }: {
  quality: number; onChange: (v: number) => void;
  p2Pct: number; p4Pct: number; bePct: number; compPct: number;
  ep2: number; ep4: number; ebe: number; ecomp: number;
}) {
  const qualityLabel = quality >= 80 ? "Strong" : quality >= 55 ? "Average" : quality >= 30 ? "Weak" : "Poor";
  const qualityColor = quality >= 80 ? FT_GREEN : quality >= 55 ? FT_BLUE : quality >= 30 ? FT_AMBER : FT_RED;

  return (
    <div style={{ ...card, borderLeft: `4px solid ${qualityColor}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>CS Lead Quality — Survival Rate Adjuster</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 3, lineHeight: 1.6, maxWidth: 560 }}>
            Lower lead quality degrades effective CS survival rates. Your set rates represent ideal conditions — lead quality scales them down to reflect real-world churn risk on weaker leads.
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>Quality Tier</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: qualityColor }}>{qualityLabel}</div>
        </div>
      </div>

      <input type="range" min={0} max={100} step={1} value={quality}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: qualityColor }} />
      <div style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: qualityColor, marginTop: 2, marginBottom: 12 }}>
        {quality}%
      </div>

      {/* Before / After table */}
      <div style={{ overflowX: "auto", borderRadius: 11, border: "1px solid #e2e8f0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={TH}>Milestone</th>
              <th style={TH}>Your Estimate</th>
              <th style={{ ...TH, borderRight: "none" }}>Effective Rate at {quality}% Quality</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: "CS Reach Payment 2",  set: p2Pct,   eff: ep2,   color: FT_GREEN },
              { label: "CS Reach Payment 4",  set: p4Pct,   eff: ep4,   color: FT_BLUE  },
              { label: "CS Reach Break-Even", set: bePct,   eff: ebe,   color: FT_AMBER },
              { label: "CS Complete Program", set: compPct, eff: ecomp, color: FT_HYPER },
            ].map((row, i) => (
              <tr key={i} style={{ background: i % 2 ? "#f8fafc" : "#fff" }}>
                <td style={{ ...TD, fontWeight: 700, color: row.color }}>{row.label}</td>
                <td style={TD}>{row.set}%</td>
                <td style={{ ...TD, fontWeight: 800, color: row.eff < row.set ? FT_RED : row.color, borderRight: "none" }}>
                  {row.eff}%
                  {row.eff < row.set && (
                    <span style={{ marginLeft: 6, fontSize: 10, color: FT_RED }}>
                      ↓ {row.set - row.eff}pp
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// FUNNEL EXPLAINER
// ─────────────────────────────────────────────

function FunnelExplainer({ ep2, ep4, ebe, ecomp, rev2, rev4, revBE, fullRev, ldRev }: {
  ep2: number; ep4: number; ebe: number; ecomp: number;
  rev2: number; rev4: number; revBE: number; fullRev: number; ldRev: number;
}) {
  const stages = [
    { pct: 100,  label: "CS Deals Sent",          color: "#94a3b8" },
    { pct: ep2,  label: `CS Reach Payment 2`,      color: FT_GREEN  },
    { pct: ep4,  label: `CS Reach Payment 4`,      color: FT_BLUE   },
    { pct: ebe,  label: `CS Reach Break-Even`,     color: FT_AMBER  },
    { pct: ecomp,label: `CS Complete Full Program`,color: FT_HYPER  },
  ];

  const marginals = [
    { label: `${round2(100 - ep2)}% drop before CS Payment 2`,        contrib: 0,                              color: "#e2e8f0" },
    { label: `${round2(ep2 - ep4)}% reach CS P2 only`,                 contrib: round2((ep2 - ep4) / 100 * rev2), color: FT_GREEN },
    { label: `${round2(ep4 - ebe)}% reach CS P4 only`,                 contrib: round2((ep4 - ebe) / 100 * rev4), color: FT_BLUE  },
    { label: `${round2(ebe - ecomp)}% reach CS Break-Even only`,       contrib: round2((ebe - ecomp) / 100 * revBE), color: FT_AMBER },
    { label: `${ecomp}% complete CS full program`,                     contrib: round2(ecomp / 100 * fullRev),    color: FT_HYPER },
  ];

  const totalExpected = round2(marginals.reduce((s, m) => s + m.contrib, 0));

  return (
    <div style={card}>
      <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", marginBottom: 12 }}>
        CS Expected Revenue — Deal Survival Funnel (after Lead Quality adjustment)
      </div>
      <div style={{ display: "grid", gap: 6, marginBottom: 16 }}>
        {stages.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 12, color: "#64748b", width: 200, flexShrink: 0, fontWeight: i === 0 ? 400 : 700 }}>
              {s.label}
            </div>
            <div style={{ flex: 1, background: "#f1f5f9", borderRadius: 99, height: 16, overflow: "hidden" }}>
              <div style={{ width: `${s.pct}%`, height: "100%", background: s.color,
                borderRadius: 99, transition: "width 0.3s" }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: s.color, width: 42, textAlign: "right" }}>
              {s.pct}%
            </div>
          </div>
        ))}
      </div>
      <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#334155", marginBottom: 8 }}>Revenue contribution per cohort:</div>
        <div style={{ display: "grid", gap: 4 }}>
          {marginals.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between",
              fontSize: 13, padding: "4px 8px", borderRadius: 8,
              background: m.contrib === 0 ? "#f8fafc" : m.color + "14" }}>
              <span style={{ color: m.contrib === 0 ? "#94a3b8" : "#0f172a" }}>{m.label}</span>
              <span style={{ fontWeight: 700, color: m.contrib === 0 ? "#94a3b8" : m.color }}>
                {m.contrib === 0 ? "$0 (no revenue captured)" : money.format(m.contrib)}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10,
          padding: "8px 10px", background: FT_GREEN + "18", borderRadius: 10, fontWeight: 800, fontSize: 14 }}>
          <span>CS Expected Revenue Per Deal</span>
          <span style={{ color: FT_GREEN_DARK }}>{money.format(totalExpected)}</span>
        </div>
        {ldRev > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6,
            padding: "8px 10px", background: "#f1f5f9", borderRadius: 10, fontSize: 13, color: "#64748b" }}>
            <span>Level Debt guaranteed equivalent (8%)</span>
            <span style={{ fontWeight: 700, color: "#334155" }}>{money.format(ldRev)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ACCORDION
// ─────────────────────────────────────────────

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
          {badge && <span style={{ fontSize: 11, fontWeight: 700, background: FT_GREEN + "22",
            color: FT_GREEN_DARK, padding: "2px 8px", borderRadius: 99 }}>{badge}</span>}
        </div>
        <span style={{ fontSize: 20, fontWeight: 900, color: FT_GREEN }}>{open ? "−" : "+"}</span>
      </button>
      {open && <div style={{ borderTop: "1px solid #e2e8f0", padding: 18 }}>{children}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────
// METRIC CARD
// ─────────────────────────────────────────────

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
            <span onMouseEnter={() => setShowTip(true)} onMouseLeave={() => setShowTip(false)}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 14, height: 14, borderRadius: "50%", background: FT_GREEN,
                color: "#fff", fontSize: 9, fontWeight: 900, cursor: "help", flexShrink: 0 }}>?</span>
          )}
        </span>
        {inlineTag && <span style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8",
          fontStyle: "italic", textTransform: "none", whiteSpace: "nowrap" }}>{inlineTag}</span>}
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
      {subtitle && <div style={{ fontSize: 12, color: "#64748b", marginTop: 7, lineHeight: 1.5 }}>{subtitle}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────
// CS MILESTONES TIMELINE
// ─────────────────────────────────────────────

function CSRevenueMilestonesTimeline({ timeline, breakEvenMonth, liabilityClearMonth, levelDebtRevenue, debtAmount }: {
  timeline: TimelineRow[]; breakEvenMonth: number | null; liabilityClearMonth: number | null;
  levelDebtRevenue: number; debtAmount: number;
}) {
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);
  const [showTip, setShowTip] = useState(false);

  if (!timeline.length) return <div style={{ color: "#94a3b8", fontSize: 13 }}>Enter a valid debt amount to see the timeline.</div>;

  const W = 740, H = 130, PL = 22, PR = 22, dotY = 54;
  const term  = timeline.length;
  const getX  = (i: number) => PL + (i / Math.max(term - 1, 1)) * (W - PL - PR);
  const hov   = hoveredMonth !== null ? timeline[hoveredMonth - 1] : null;
  const hovX  = hoveredMonth !== null ? getX(hoveredMonth - 1) : 0;

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
          Figures based on <strong>{money.format(debtAmount)}</strong> enrolled debt —
          Level Debt = {levelDebtRevenue > 0 ? money.format(levelDebtRevenue) : "N/A (under $7k)"} vs the assigned CS program.
        </span>
        <span onMouseEnter={() => setShowTip(true)} onMouseLeave={() => setShowTip(false)}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 16, height: 16, borderRadius: "50%", background: FT_GREEN,
            color: "#fff", fontSize: 10, fontWeight: 900, cursor: "help", flexShrink: 0, position: "relative" }}>
          ?
          {showTip && (
            <div style={{ position: "absolute", bottom: "120%", left: "50%", transform: "translateX(-50%)",
              background: "#0f172a", color: "#fff", borderRadius: 10, padding: "10px 13px",
              fontSize: 12, lineHeight: 1.6, width: 300, boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
              zIndex: 200, pointerEvents: "none" }}>
              All revenue milestone figures are calculated from the Enrolled Debt input.
              The timeline shows CS cumulative revenue month-by-month for the CS program assigned to {money.format(debtAmount)}.
              Adjust Enrolled Debt to see how milestones shift across deal sizes.
            </div>
          )}
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <svg width={W} height={H} style={{ minWidth: W, display: "block" }} onMouseLeave={() => setHoveredMonth(null)}>
          <line x1={PL} y1={dotY} x2={W - PR} y2={dotY} stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
          {timeline.map((row, i) => {
            if (i === 0) return null;
            const col = row.month === liabilityClearMonth ? FT_HYPER
                      : row.month <= (breakEvenMonth ?? 0) ? FT_AMBER
                      : row.phase === "Front" ? FT_GREEN : FT_BLUE;
            return <line key={i} x1={getX(i-1)} y1={dotY} x2={getX(i)} y2={dotY} stroke={col} strokeWidth="4" strokeLinecap="round" />;
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
                  style={{ pointerEvents: "none" }} />
                {isLC && <circle cx={x} cy={dotY} r={isHov ? 14 : 10}
                  fill="none" stroke={FT_HYPER} strokeWidth="2" opacity="0.4" style={{ pointerEvents: "none" }} />}
                {isLbl && <text x={x} y={dotY+20} textAnchor="middle" fontSize="10" fill={labels[row.month].color} fontWeight="800">{labels[row.month].text}</text>}
                {isLast && <text x={x} y={dotY-14} textAnchor="middle" fontSize="11" fill={FT_GREEN_DARK} fontWeight="900">{money.format(row.cumulativeRevenue)}</text>}
                {isBE && !isLast && <text x={x} y={dotY-14} textAnchor="middle" fontSize="10" fill={FT_AMBER} fontWeight="800">{money.format(row.cumulativeRevenue)}</text>}
                {isLC && !isBE && !isLast && <text x={x} y={dotY-14} textAnchor="middle" fontSize="10" fill={FT_HYPER} fontWeight="900">{money.format(row.cumulativeRevenue)}</text>}
              </g>
            );
          })}
          {hov && (() => {
            const tx = Math.min(Math.max(hovX, 68), W - 68);
            return (
              <g style={{ pointerEvents: "none" }}>
                <rect x={tx-62} y={dotY-62} width={124} height={48} rx="8" fill="#0f172a" opacity="0.93" />
                <text x={tx} y={dotY-47} textAnchor="middle" fontSize="10" fill="#94a3b8" fontWeight="700">MONTH {hov.month} · {hov.phase.toUpperCase()}</text>
                <text x={tx} y={dotY-28} textAnchor="middle" fontSize="14" fill="#fff" fontWeight="800">{money.format(hov.cumulativeRevenue)}</text>
              </g>
            );
          })()}
        </svg>
        <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 11, color: "#64748b", flexWrap: "wrap" }}>
          <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: FT_GREEN, marginRight: 4, verticalAlign: "middle" }} />Front (Mo 1–4): 100% net</span>
          <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: FT_BLUE, marginRight: 4, verticalAlign: "middle" }} />Tail-End (Mo 5+): 35% net</span>
          {breakEvenMonth && <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: FT_AMBER, marginRight: 4, verticalAlign: "middle" }} />CS breaks even after Month {breakEvenMonth} vs Level Debt after Month 2</span>}
          {liabilityClearMonth && liabilityClearMonth <= timeline.length && (
            <span style={{ color: FT_HYPER, fontWeight: 800 }}>
              <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: FT_HYPER, marginRight: 4, verticalAlign: "middle", boxShadow: `0 0 6px ${FT_HYPER}` }} />
              Break-Even + Fully Liability-Clear (Mo {liabilityClearMonth})
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PAYOUT + LIABILITY TABLE
// ─────────────────────────────────────────────

function PayoutLiabilityAccordion() {
  const rows = [
    { event: "Expected Funds Hit Bank", ld: "Month 3 (20th)", cs: "Month +1 per payment",
      detail: "LD: Payment 1 = Jan 1, Payment 2 = Feb 1 → payout March 20. CS: each payment hits your bank ~1 month after processing." },
    { event: "Chargeback Liability Free", ld: "After Payment 2", cs: "Each payment: Month +4",
      detail: "LD: zero liability after 2 cleared payments. CS: each payment has its own 4-month window — they do NOT clear together." },
    { event: "ACH Return Window", ld: "~60 days (Nacha)", cs: "~60 days per payment",
      detail: "Funding Tier models 4 months as an internal conservative buffer. Real Nacha window is ~60 calendar days." },
  ];
  return (
    <Accordion title="Payout + Liability Timing — Level Debt vs Consumer Shield">
      <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #e2e8f0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: "#f8fafc" }}>{["Timing Event","Level Debt","Consumer Shield","Notes"].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 ? "#f8fafc" : "#fff" }}>
                <td style={{ ...TD, fontWeight: 700 }}>{row.event}</td>
                <td style={{ ...TD, color: FT_GREEN_DARK, fontWeight: 700 }}>{row.ld}</td>
                <td style={{ ...TD, color: FT_BLUE, fontWeight: 700 }}>{row.cs}</td>
                <td style={{ ...TD, color: "#64748b", lineHeight: 1.6 }}>{row.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Accordion>
  );
}

// ─────────────────────────────────────────────
// PROGRAM CHART
// ─────────────────────────────────────────────

function ProgramChart({ program }: { program: ConsumerShieldProgram }) {
  const [hov, setHov] = useState<{ month: number; rev: number; x: number; y: number } | null>(null);
  const net = program.payment - 40;
  const pts = Array.from({ length: program.term }, (_, i) => ({ month: i + 1, y: csRevenueAt(i + 1, net, program.term) }));
  const maxY = Math.max(...pts.map(p => p.y), 1);
  const W = 700, H = 240, PL = 90, PB = 40, PT = 22, PR = 24;
  const gx = (i: number) => PL + (i / Math.max(pts.length - 1, 1)) * (W - PL - PR);
  const gy = (v: number) => H - PB - (v / maxY) * (H - PT - PB);
  const coords = pts.map((p, i) => `${gx(i)},${gy(p.y)}`).join(" ");
  const notable = new Set([1, 4, program.term]);

  return (
    <div style={{ overflowX: "auto", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, padding: "12px 10px 8px" }}>
      <svg width={W} height={H} style={{ minWidth: W, display: "block" }} onMouseLeave={() => setHov(null)}>
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const yv = H - PB - t * (H - PT - PB);
          return <g key={i}>
            <line x1={PL} y1={yv} x2={W-PR} y2={yv} stroke={t===0?"#94a3b8":"#e2e8f0"} strokeWidth={t===0?1.5:1} />
            <text x={PL-8} y={yv+4} fontSize="11" fill={FT_GREEN} textAnchor="end" fontWeight="600">{money.format(maxY*t)}</text>
          </g>;
        })}
        <text x={16} y={H/2} textAnchor="middle" fontSize="11" fill={FT_GREEN} fontWeight="700" transform={`rotate(-90,16,${H/2})`}>Revenue Earned</text>
        <line x1={PL} y1={H-PB} x2={W-PR} y2={H-PB} stroke="#94a3b8" strokeWidth="1.5" />
        <text x={PL+(W-PL-PR)/2} y={H-6} textAnchor="middle" fontSize="11" fill={FT_GREEN} fontWeight="700">Program Length (Months)</text>
        <polyline fill={FT_GREEN+"18"} stroke="none" points={`${gx(0)},${H-PB} ${coords} ${gx(pts.length-1)},${H-PB}`} />
        <polyline fill="none" stroke={FT_GREEN} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={coords} />
        {pts.map((p, i) => {
          const x=gx(i), y=gy(p.y), isH=hov?.month===p.month, isN=notable.has(p.month);
          return <g key={p.month}>
            <circle cx={x} cy={y} r={11} fill="transparent" style={{cursor:"pointer"}} onMouseEnter={() => setHov({month:p.month,rev:p.y,x,y})} />
            <circle cx={x} cy={y} r={isH?8:isN?5.5:3.5} fill={isH||isN?FT_GREEN_DARK:FT_GREEN} stroke={isH?"#fff":"none"} strokeWidth="2" style={{pointerEvents:"none"}} />
            {isN && <text x={x} y={H-PB+16} textAnchor="middle" fontSize="10" fill={FT_GREEN} fontWeight="700">{p.month}</text>}
            {p.month===program.term && <text x={x} y={y-14} textAnchor="middle" fontSize="11" fill={FT_GREEN_DARK} fontWeight="900">{money.format(p.y)}</text>}
          </g>;
        })}
        {hov && (() => {
          const tx=Math.min(Math.max(hov.x,68),W-68), ty=Math.max(hov.y-56,4);
          return <g style={{pointerEvents:"none"}}>
            <rect x={tx-60} y={ty} width={120} height={46} rx="8" fill="#0f172a" opacity="0.92" />
            <text x={tx} y={ty+15} textAnchor="middle" fontSize="10" fill="#94a3b8" fontWeight="700">MONTH {hov.month} CUMULATIVE</text>
            <text x={tx} y={ty+35} textAnchor="middle" fontSize="14" fill="#fff" fontWeight="800">{money.format(hov.rev)}</text>
          </g>;
        })()}
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
  const net=program.payment-40, front=round2(net*Math.min(4,program.term));
  const tail=round2(net*0.35), fullRev=round2(front+Math.max(0,program.term-4)*tail);

  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
      <button onClick={onToggle} style={{ width:"100%", textAlign:"left", background:"#fff", border:"none", padding:"11px 16px", cursor:"pointer" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:0 }}>
            <span style={{ fontWeight:800, color:"#0f172a", fontSize:14, width:120, flexShrink:0 }}>{program.label}</span>
            <span style={{ fontSize:12, color:"#64748b", width:170, flexShrink:0 }}>{program.debtRange}</span>
            <span style={{ fontSize:12, fontWeight:800, color:FT_BLUE, width:130, flexShrink:0 }}>Net: {money.format(net)}/mo</span>
            <span style={{ fontSize:12, color:"#64748b", width:120, flexShrink:0 }}>{program.term} mo · {money.format(program.payment)}/mo</span>
          </div>
          <span style={{ fontSize:20, fontWeight:900, color:FT_GREEN, flexShrink:0, paddingLeft:8 }}>{open?"−":"+"}</span>
        </div>
      </button>
      {open && (
        <div style={{ borderTop:"1px solid #e2e8f0", padding:16 }}>
          <div style={{ overflowX:"auto", borderRadius:11, border:"1px solid #e2e8f0", marginBottom:14 }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead><tr style={{ background:"#f8fafc" }}>
                <th style={{ ...TH, textAlign:"center" }}>Front Revenue <span style={{ fontSize:10, fontWeight:600, color:"#94a3b8" }}>Months 1–4</span></th>
                <th style={{ ...TH, textAlign:"center" }}>Tail End – Revenue <span style={{ fontSize:10, fontWeight:600, color:"#94a3b8" }}>Per month 5+</span></th>
                <th style={{ ...TH, textAlign:"center", borderRight:"none" }}>Full Revenue <span style={{ fontSize:10, fontWeight:600, color:"#94a3b8" }}>If full term</span></th>
              </tr></thead>
              <tbody><tr>
                <td style={{ ...TD, textAlign:"center", fontSize:20, fontWeight:800, color:FT_GREEN }}>{money.format(front)}</td>
                <td style={{ ...TD, textAlign:"center", fontSize:20, fontWeight:800, color:FT_BLUE }}>{money.format(tail)}<span style={{ fontSize:11, color:"#94a3b8" }}>/mo</span></td>
                <td style={{ ...TD, textAlign:"center", fontSize:20, fontWeight:800, color:FT_GREEN_DARK, borderRight:"none" }}>{money.format(fullRev)}</td>
              </tr></tbody>
            </table>
          </div>
          <ProgramChart program={program} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// KNOWLEDGE BASE
// ─────────────────────────────────────────────

function KnowledgeBase({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div style={{ position:"fixed", right:20, bottom:88, width:430,
      maxWidth:"calc(100vw - 24px)", maxHeight:"72vh", zIndex:999, background:"#fff",
      border:"1px solid #dbeafe", borderRadius:18,
      boxShadow:"0 20px 40px rgba(15,23,42,0.22)", display:"flex", flexDirection:"column" }}>
      <div style={{ position:"sticky", top:0, zIndex:10, background:"#fff",
        borderBottom:"1px solid #e2e8f0", borderRadius:"18px 18px 0 0",
        padding:"13px 16px 11px", display:"flex",
        justifyContent:"space-between", alignItems:"flex-start", gap:12, flexShrink:0 }}>
        <div>
          <div style={{ fontSize:16, fontWeight:800, color:"#0f172a" }}>Legend / Knowledge Base</div>
          <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>How every number is calculated.</div>
        </div>
        <button onClick={onClose} style={{ border:"none", background:"#f1f5f9", borderRadius:10,
          width:34, height:34, cursor:"pointer", fontWeight:900, fontSize:18, color:"#334155",
          flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
      </div>
      <div style={{ overflowY:"auto", padding:"13px 16px 20px", display:"grid", gap:13 }}>
        {[
          ["CS Survival Funnel Sliders", `Each slider = % of ALL Consumer Shield deals that reach that milestone.\n\nThey CASCADE — you cannot have more deals reach Payment 4 than reached Payment 2. The sliders auto-enforce this.\n\nExample at 75/60/40/25:\n• 25% complete full term (also cleared BE, P4, P2)\n• 15% reached BE but didn't complete (also cleared P4, P2)\n• 20% reached P4 but didn't reach BE (also cleared P2)\n• 15% reached P2 only, then dropped\n• 25% never made Payment 2 ($0 revenue)`],
          ["CS Lead Quality", `Lead quality scales all effective CS survival rates.\n\nFormula: effectiveRate = setRate × (0.35 + 0.65 × quality/100)\n\nAt 100% quality: rates unchanged\nAt 75% quality: rates × 0.84\nAt 50% quality: rates × 0.68\nAt 0% quality: rates × 0.35 (floor)\n\nThis reflects that even on weak leads, some deals will still stick. High quality leads deliver closer to your expected funnel rates.`],
          ["Cash Urgency", `Cash urgency drives the RECOMMENDED routing split for deals above $7,000.\n\n100% = need cash in ~90 days → route ~85% to Level Debt\n50%  = need cash in ~180 days → route ~53% to Level Debt\n0%   = no urgency → route ~20% to Level Debt\n\nFormula: recommended LD% = 20 + (urgency × 0.65)\n\nThis is a ROUTING decision tool, not a CS revenue calculator input. Use it to answer: "Given our cash needs right now, what % of deals above $7k should go to each backend?"`],
          ["Under $7k Rule", "Level Debt does not accept enrolled debt below $7,000. Any deal under $7k must route to Consumer Shield regardless of urgency or lead quality. This is enforced throughout the tool."],
          ["Expected Revenue Formula", `Expected Revenue = \n(P2% − P4%) × rev at P2\n+ (P4% − BE%) × rev at P4\n+ (BE% − Complete%) × rev at Break-Even\n+ Complete% × Full Program Revenue\n\nAll rates are the EFFECTIVE rates after lead quality adjustment.\n\nIf all rates = 100%, expected revenue = full program revenue (everyone completes).`],
          ["Level Debt", "Revenue = 8% of enrolled debt. After 2 cleared payments, Funding Tier is free and clear of chargeback liability. Payout: Payment 2 clears → funds hit bank on the 20th of the following month."],
          ["Break-Even + Liability Clear (Hyper Green)", "The month where CS has both (a) broken even vs Level Debt AND (b) the 4-month chargeback window on the break-even payment has closed. The first true zero-risk, zero-deficit inflection point for a CS deal."],
        ].map(([title, body], i) => (
          <div key={i}>
            <div style={{ fontWeight:800, color:"#0f172a", fontSize:13 }}>{title}</div>
            <p style={{ margin:"5px 0 0", fontSize:13, color:"#475569", lineHeight:1.7, whiteSpace:"pre-line" }}>{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────

export default function FundingTierProfitabilityBalancer() {
  const [debtAmount,           setDebtAmount]           = useState(20000);
  const [p2Pct,                setP2Pct]                = useState(75);
  const [p4Pct,                setP4Pct]                = useState(60);
  const [bePct,                setBePct]                = useState(40);
  const [compPct,              setCompPct]              = useState(25);
  const [leadQuality,          setLeadQuality]          = useState(75);
  const [cashUrgency,          setCashUrgency]          = useState(50);
  const [levelRepPct,          setLevelRepPct]          = useState(1.25);
  const [csRepUpfront,         setCsRepUpfront]         = useState(200);
  const [csRepAfter4,          setCsRepAfter4]          = useState(75);
  const [portfolioDeals,       setPortfolioDeals]       = useState(100);
  const [portfolioAvgDebt,     setPortfolioAvgDebt]     = useState(18000);
  const [kbOpen,               setKbOpen]               = useState(false);
  const [openProgram,          setOpenProgram]          = useState<string | null>("CS Program A");

  // Cash urgency drives recommended routing %
  const urgencyRouting = cashUrgencyToRouting(cashUrgency);
  // Portfolio uses urgency-recommended routing
  const [portfolioLevelMixPct, setPortfolioLevelMixPct] = useState(urgencyRouting.ldPct);

  const handleFunnelChange = useCallback((np2: number, np4: number, nbe: number, ncomp: number) => {
    setP2Pct(np2); setP4Pct(np4); setBePct(nbe); setCompPct(ncomp);
  }, []);

  const deal = useMemo(() => calculateDealMetrics({
    debtAmount, p2Pct, p4Pct, bePct, compPct, leadQuality, cashUrgency,
  }), [debtAmount, p2Pct, p4Pct, bePct, compPct, leadQuality, cashUrgency]);

  const repEcon = useMemo(() => {
    const ldCost = round2(debtAmount * (levelRepPct / 100));
    const csCost = round2(csRepUpfront + csRepAfter4 * (deal.effectiveP4 / 100));
    return { ldCost, csCost,
             ldNet: round2(deal.levelDebtRevenue - ldCost),
             csNet: round2((deal.consumerShieldExpectedRevenue ?? 0) - csCost) };
  }, [debtAmount, levelRepPct, csRepUpfront, csRepAfter4, deal]);

  const portfolio = useMemo(() => {
    // Under $7k deals cannot go to Level Debt — enforce in portfolio
    const effectiveLDPct = portfolioAvgDebt < 7000 ? 0 : portfolioLevelMixPct;
    const ldCount  = Math.round(portfolioDeals * effectiveLDPct / 100);
    const csCount  = portfolioDeals - ldCount;
    const avg      = calculateDealMetrics({ debtAmount: portfolioAvgDebt, p2Pct, p4Pct, bePct, compPct, leadQuality, cashUrgency });
    const ldGross  = round2(ldCount * avg.levelDebtRevenue);
    const csGross  = round2(csCount * (avg.consumerShieldExpectedRevenue ?? 0));
    const csUpside = round2(csCount * (avg.consumerShieldRevenueAtFull ?? 0));
    const ldRep    = round2(ldCount * portfolioAvgDebt * (levelRepPct / 100));
    const csRep    = round2(csCount * (csRepUpfront + csRepAfter4 * (avg.effectiveP4 / 100)));
    return { ldCount, csCount, ldGross, csGross, csUpside, ldRep, csRep,
             effectiveLDPct,
             totalGross: round2(ldGross + csGross), totalRep: round2(ldRep + csRep),
             totalNet: round2(ldGross + csGross - ldRep - csRep) };
  }, [portfolioDeals, portfolioLevelMixPct, portfolioAvgDebt, p2Pct, p4Pct, bePct, compPct,
      leadQuality, cashUrgency, levelRepPct, csRepUpfront, csRepAfter4]);

  const recLogo = deal.recommendedBackend.startsWith("Consumer Shield") ? CS_LOGO
                : deal.recommendedBackend === "Level Debt" ? LEVEL_DEBT_LOGO : null;

  const milestoneMonths = new Set<number>([1, 4]);
  if (deal.consumerShieldBreakEvenMonthVsLevel) milestoneMonths.add(deal.consumerShieldBreakEvenMonthVsLevel);
  if (deal.consumerShieldLiabilityClearMonth)   milestoneMonths.add(deal.consumerShieldLiabilityClearMonth);

  const prog    = getProgram(debtAmount);
  const net     = prog ? prog.payment - 40 : 0;
  const termLen = prog ? prog.term : 0;
  const rev2v   = deal.consumerShieldRevenueAfter2 ?? 0;
  const rev4v   = deal.consumerShieldRevenueAfter4 ?? 0;
  const beM     = deal.consumerShieldBreakEvenMonthVsLevel;
  const revBEv  = beM ? csRevenueAt(beM, net, termLen) : 0;
  const fullRv  = deal.consumerShieldRevenueAtFull ?? 0;

  const WL = ({ ch }: { ch: string }) => (
    <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", marginBottom: 3,
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
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>

              {/* Logo + title */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, alignSelf: "center" }}>
                <img src={FT_LOGO} alt="Funding Tier" style={{ height: 28, width: "auto" }} />
                <span style={{ fontWeight: 900, fontSize: 20, color: "#fff", letterSpacing: "-0.5px", whiteSpace: "nowrap" }}>Profit Engine</span>
              </div>

              <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.2)", flexShrink: 0, alignSelf: "center" }} />

              {/* Enrolled debt */}
              <div style={{ flexShrink: 0, alignSelf: "flex-end" }}>
                <WL ch="Enrolled Debt" />
                <input type="number" value={debtAmount} onChange={e => setDebtAmount(Number(e.target.value))}
                  min={0} step={100}
                  style={{ width: 108, padding: "6px 9px", borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.2)", fontSize: 14,
                    color: "#000", fontWeight: 800, background: "#fff", boxSizing: "border-box" }} />
                {debtAmount > 0 && debtAmount < 7000 && (
                  <div style={{ fontSize: 9, color: FT_AMBER, fontWeight: 700, marginTop: 2 }}>⚠ CS only — under $7k</div>
                )}
              </div>

              <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.2)", flexShrink: 0, alignSelf: "center" }} />

              {/* CS Funnel sliders */}
              <div style={{ flex: 1, minWidth: 300 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: "#94a3b8", marginBottom: 4,
                  textTransform: "uppercase", letterSpacing: 0.4 }}>
                  CS Deal Survival Funnel — % of all CS deals reaching each milestone (auto-cascading)
                </div>
                <CascadingFunnel p2={p2Pct} p4={p4Pct} be={bePct} comp={compPct} onChange={handleFunnelChange} />
              </div>

              <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.2)", flexShrink: 0, alignSelf: "center" }} />

              {/* CS Lead Quality */}
              <div style={{ minWidth: 90, flexShrink: 0 }}>
                <WL ch="CS Lead Quality" />
                <input type="range" min={0} max={100} step={1} value={leadQuality}
                  onChange={e => setLeadQuality(Number(e.target.value))}
                  style={{ width: "100%", accentColor: leadQuality >= 70 ? FT_GREEN : leadQuality >= 40 ? FT_AMBER : FT_RED }} />
                <div style={{ fontSize: 11, fontWeight: 800, marginTop: 1,
                  color: leadQuality >= 70 ? FT_GREEN : leadQuality >= 40 ? FT_AMBER : FT_RED }}>{leadQuality}%</div>
              </div>

              {/* Cash Urgency */}
              <div style={{ minWidth: 110, flexShrink: 0 }}>
                <WL ch="Cash Urgency" />
                <input type="range" min={0} max={100} step={1} value={cashUrgency}
                  onChange={e => setCashUrgency(Number(e.target.value))}
                  style={{ width: "100%", accentColor: FT_AMBER }} />
                <div style={{ fontSize: 10, fontWeight: 700, color: FT_AMBER, marginTop: 1 }}>
                  {cashUrgency}% · Route {urgencyRouting.ldPct}% LD
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ maxWidth: 1380, margin: "0 auto", padding: "18px 16px 60px", display: "grid", gap: 18 }}>

        {/* Top 4 */}
        <div className="grid-4">
          <div style={{ ...card, position: "relative" }}>
            {recLogo && <img src={recLogo} alt="" style={{ position:"absolute", top:12, left:12,
              height:22, width:"auto", objectFit:"contain", opacity:0.85 }} />}
            <div style={{ fontSize:11, fontWeight:700, color:"#64748b", marginBottom:7,
              textTransform:"uppercase", letterSpacing:0.4, marginTop: recLogo ? 28 : 0 }}>Recommended Backend</div>
            <div style={{ fontSize: deal.recommendedBackend.length > 20 ? 16 : 22, fontWeight:800, color:"#0f172a", lineHeight:1.2, wordBreak:"break-word" }}>
              {deal.recommendedBackend}
            </div>
            <div style={{ fontSize:12, color:"#64748b", marginTop:7, lineHeight:1.5 }}>{deal.recommendationReason}</div>
          </div>
          <MetricCard title="Level Debt Revenue"
            value={deal.levelDebtEligible ? money.format(deal.levelDebtRevenue) : "Not Eligible"}
            subtitle={!deal.levelDebtEligible ? "Under $7k — Level Debt cannot accept this deal" :
              deal.levelDebtRevShareEligible ? "120k+ flagged for additional rev share" : "Base 8% — guaranteed after 2 payments"} />
          <MetricCard title="CS Expected Revenue" value={money.format(deal.consumerShieldExpectedRevenue ?? 0)}
            subtitle={`Effective rates after ${leadQuality}% lead quality: P2=${deal.effectiveP2}% P4=${deal.effectiveP4}% BE=${deal.effectiveBE}% Comp=${deal.effectiveComp}%`} />
          <MetricCard title="Break-Even Month"
            value={deal.consumerShieldBreakEvenMonthVsLevel ? `Month ${deal.consumerShieldBreakEvenMonthVsLevel}` : deal.levelDebtEligible ? "N/A" : "CS Only Deal"}
            subtitle="When CS cumulative revenue catches Level Debt 8%" />
        </div>

        {/* Cash Urgency Panel — strategic routing */}
        <CashUrgencyPanel urgency={cashUrgency} onChange={v => { setCashUrgency(v); setPortfolioLevelMixPct(cashUrgencyToRouting(v).ldPct); }} debtAmount={debtAmount} />

        {/* Lead Quality Panel */}
        <LeadQualityPanel
          quality={leadQuality} onChange={setLeadQuality}
          p2Pct={p2Pct} p4Pct={p4Pct} bePct={bePct} compPct={compPct}
          ep2={deal.effectiveP2} ep4={deal.effectiveP4} ebe={deal.effectiveBE} ecomp={deal.effectiveComp}
        />

        {/* Snapshots */}
        <div className="grid-2">
          <div style={card}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
              <img src={LEVEL_DEBT_LOGO} alt="Level Debt" style={{ height:30, width:"auto", objectFit:"contain" }} />
              <h2 style={{ margin:0, fontSize:17, fontWeight:800, color:"#0f172a" }}>Level Debt Snapshot</h2>
              {!deal.levelDebtEligible && (
                <span style={{ fontSize:11, fontWeight:800, color:FT_RED, background:FT_RED+"11",
                  padding:"2px 8px", borderRadius:99 }}>Not eligible — under $7k</span>
              )}
            </div>
            <div className="grid-2-inner">
              <MetricCard title="Debt Amount" value={money.format(deal.debtAmount)} />
              <MetricCard title="Gross Revenue" value={deal.levelDebtEligible ? money.format(deal.levelDebtRevenue) : "N/A"} />
              <MetricCard title="Commission Paid To Closer" value={deal.levelDebtEligible ? money.format(repEcon.ldCost) : "N/A"} />
              <MetricCard title="Net Revenue" value={deal.levelDebtEligible ? money.format(repEcon.ldNet) : "N/A"} />
            </div>
          </div>
          <div style={card}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
              <img src={CS_LOGO} alt="Consumer Shield" style={{ height:30, width:"auto", objectFit:"contain" }} />
              <h2 style={{ margin:0, fontSize:17, fontWeight:800, color:"#0f172a" }}>Consumer Shield Program Snapshot</h2>
            </div>
            <div className="grid-2-inner">
              <div style={card}>
                <div style={{ fontSize:11, fontWeight:700, color:"#64748b", marginBottom:7,
                  textTransform:"uppercase", letterSpacing:0.4,
                  display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span>Payment / Monthly</span>
                  {deal.consumerShieldTerm && <span style={{ fontSize:10, color:"#94a3b8", fontWeight:600 }}>{deal.consumerShieldTerm} months</span>}
                </div>
                <div style={{ fontSize:24, fontWeight:800, color:"#0f172a" }}>{money.format(deal.consumerShieldPayment ?? 0)}</div>
              </div>
              <MetricCard title="Net Payment" value={money.format(deal.consumerShieldNetPayment ?? 0)}
                tooltip={`${money.format(deal.consumerShieldPayment ?? 0)} program payment minus $40 servicing = ${money.format(deal.consumerShieldNetPayment ?? 0)} net. This is the base before the 100% (months 1–4) or 35% (month 5+) split.`} />
              <MetricCard title="Front Revenue"      value={money.format(deal.consumerShieldFrontRevenue ?? 0)} inlineTag="Months 1 through 4" />
              <MetricCard title="Tail End – Revenue" value={money.format(deal.consumerShieldBackRevenueMonthly ?? 0)} inlineTag="Per month from month 5+" />
            </div>
          </div>
        </div>

        {/* Funnel Explainer */}
        <FunnelExplainer ep2={deal.effectiveP2} ep4={deal.effectiveP4} ebe={deal.effectiveBE} ecomp={deal.effectiveComp}
          rev2={rev2v} rev4={rev4v} revBE={revBEv} fullRev={fullRv} ldRev={deal.levelDebtRevenue} />

        {/* CS Revenue Milestones */}
        <Accordion title="Consumer Shield Revenue Milestones" defaultOpen={true} badge="Hover dots for detail">
          <CSRevenueMilestonesTimeline
            timeline={deal.consumerShieldTimeline}
            breakEvenMonth={deal.consumerShieldBreakEvenMonthVsLevel}
            liabilityClearMonth={deal.consumerShieldLiabilityClearMonth}
            levelDebtRevenue={deal.levelDebtRevenue}
            debtAmount={deal.debtAmount}
          />
          <div className="grid-4" style={{ marginTop:16 }}>
            <MetricCard title="After CS Payment 2" value={money.format(deal.consumerShieldRevenueAfter2 ?? 0)} subtitle="Early quality signal" />
            <MetricCard title="After CS Payment 4" value={money.format(deal.consumerShieldRevenueAfter4 ?? 0)} subtitle="Front window closes" />
            <MetricCard title="CS 1/2 Program"     value={money.format(deal.consumerShieldRevenueAtHalf ?? 0)} subtitle="Mid-term reference" />
            <MetricCard title="CS Full Program"     value={money.format(deal.consumerShieldRevenueAtFull ?? 0)} subtitle="Best-case ceiling" />
          </div>
        </Accordion>

        {/* Payout + Liability */}
        <PayoutLiabilityAccordion />

        {/* CS Offerings */}
        <div style={card}>
          <h2 style={{ margin:"0 0 6px", fontSize:18, fontWeight:800, color:"#0f172a" }}>
            Consumer Shield Offerings / Retention Scenarios
          </h2>
          <div style={{ fontSize:13, color:"#64748b", lineHeight:1.6, marginBottom:14 }}>
            Expand each offering for the full revenue breakdown and interactive revenue curve.
          </div>
          <div style={{ display:"grid", gap:10 }}>
            {consumerShieldPrograms.map(prog => (
              <ProgramAccordion key={prog.label} program={prog}
                open={openProgram === prog.label}
                onToggle={() => setOpenProgram(c => c === prog.label ? null : prog.label)} />
            ))}
          </div>
        </div>

        {/* Monthly Revenue Timeline */}
        <Accordion title="Consumer Shield Monthly Revenue Timeline" defaultOpen={false}>
          <div style={{ overflowX:"auto", borderRadius:13, border:"1px solid #e2e8f0" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead><tr style={{ background:"#f1f5f9" }}>
                {["Month","Phase","Monthly Revenue","Cumulative Revenue","Assumed Funds Hit","Liability Clears"].map(h => <th key={h} style={TH}>{h}</th>)}
              </tr></thead>
              <tbody>
                {deal.consumerShieldTimeline.map(row => {
                  const isBE=row.month===deal.consumerShieldBreakEvenMonthVsLevel;
                  const isLC=row.month===deal.consumerShieldLiabilityClearMonth;
                  const is1=row.month===1, is4=row.month===4;
                  const isMile=isBE||isLC||is1||is4;
                  const rowBg=isLC?FT_HYPER+"22":isBE?FT_AMBER+"22":is1||is4?FT_GREEN+"11":row.month%2?"#f8fafc":"#fff";
                  return (
                    <tr key={row.month} style={{ background:rowBg }}>
                      <td style={{ ...TD, fontWeight:isMile?800:400 }}>
                        {row.month}
                        {is1 && <span style={{ marginLeft:6, fontSize:10, background:FT_GREEN+"22", color:FT_GREEN_DARK, fontWeight:700, padding:"1px 6px", borderRadius:99 }}>Start</span>}
                        {is4 && <span style={{ marginLeft:6, fontSize:10, background:FT_GREEN+"22", color:FT_GREEN_DARK, fontWeight:700, padding:"1px 6px", borderRadius:99 }}>Front Close</span>}
                        {isBE && <span style={{ marginLeft:6, fontSize:10, background:FT_AMBER+"33", color:FT_AMBER, fontWeight:800, padding:"1px 6px", borderRadius:99 }}>Break-Even</span>}
                        {isLC && <span style={{ marginLeft:6, fontSize:10, background:FT_HYPER+"33", color:FT_GREEN_DARK, fontWeight:800, padding:"1px 6px", borderRadius:99 }}>Liability Clear</span>}
                      </td>
                      <td style={{ ...TD, color:row.phase==="Front"?FT_GREEN:FT_BLUE, fontWeight:700 }}>{row.phase}</td>
                      <td style={TD}>{money.format(row.monthlyRevenue)}</td>
                      <td style={{ ...TD, fontWeight:isMile?800:400, color:isLC?FT_GREEN_DARK:isBE?FT_AMBER:"inherit" }}>
                        {money.format(row.cumulativeRevenue)}
                      </td>
                      <td style={TD}>Month {row.payoutHitMonthAssumed}</td>
                      <td style={{ ...TD, borderRight:"none" }}>Month {row.liabilityFreeMonth}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Accordion>

        {/* Rep Economics */}
        <div style={card}>
          <h2 style={{ margin:"0 0 14px", fontSize:18, fontWeight:800, color:"#0f172a" }}>Sales Rep Economics</h2>
          <div className="grid-3">
            {[
              { label:"Level Debt Rep Payout (% of enrolled debt)", value:levelRepPct, set:setLevelRepPct, min:0, max:10, step:0.05 },
              { label:"CS Upfront Rep Payout ($)", value:csRepUpfront, set:setCsRepUpfront, min:0, step:25 },
              { label:"CS Payment 4 Milestone Payout ($)", value:csRepAfter4, set:setCsRepAfter4, min:0, step:25 },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize:13, fontWeight:700, color:"#334155", marginBottom:7 }}>{f.label}</div>
                <input type="number" value={f.value} onChange={e => f.set(Number(e.target.value))}
                  min={f.min} max={f.max} step={f.step}
                  style={{ width:"100%", padding:"10px 12px", borderRadius:10,
                    border:"1px solid #cbd5e1", fontSize:15, color:"#0f172a",
                    background:"#fff", boxSizing:"border-box" }} />
              </div>
            ))}
          </div>
        </div>

        {/* Portfolio Forecast */}
        <div style={card}>
          <h2 style={{ margin:"0 0 4px", fontSize:18, fontWeight:800, color:"#0f172a" }}>Portfolio Forecast — Deals Above $7,000</h2>
          <div style={{ fontSize:13, color:"#64748b", marginBottom:14, lineHeight:1.6 }}>
            Cash urgency currently recommends routing <strong style={{ color:FT_GREEN_DARK }}>{urgencyRouting.ldPct}% to Level Debt</strong> / <strong style={{ color:FT_BLUE }}>{100-urgencyRouting.ldPct}% to Consumer Shield</strong> for the {urgencyRouting.horizon} cash horizon. Adjust manually below or change cash urgency to auto-update.
            {portfolioAvgDebt < 7000 && (
              <span style={{ marginLeft:8, color:FT_RED, fontWeight:700 }}>⛔ Average debt under $7k — all deals must go to CS.</span>
            )}
          </div>
          <div className="grid-3">
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:"#334155", marginBottom:7 }}>Number of Deals</div>
              <input type="number" value={portfolioDeals} onChange={e => setPortfolioDeals(Number(e.target.value))}
                min={1} step={1} style={{ width:"100%", padding:"10px 12px", borderRadius:10,
                  border:"1px solid #cbd5e1", fontSize:15, color:"#0f172a", background:"#fff", boxSizing:"border-box" }} />
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:"#334155", marginBottom:7 }}>Average Debt Amount</div>
              <input type="number" value={portfolioAvgDebt} onChange={e => setPortfolioAvgDebt(Number(e.target.value))}
                min={4000} step={100} style={{ width:"100%", padding:"10px 12px", borderRadius:10,
                  border:"1px solid #cbd5e1", fontSize:15, color:"#0f172a", background:"#fff", boxSizing:"border-box" }} />
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:"#334155", marginBottom:7 }}>
                % Routed to Level Debt {portfolioAvgDebt < 7000 && <span style={{ color:FT_RED, fontWeight:800 }}>(forced 0%)</span>}
              </div>
              <input type="range" min={0} max={100} step={1}
                value={portfolioAvgDebt < 7000 ? 0 : portfolioLevelMixPct}
                onChange={e => { if (portfolioAvgDebt >= 7000) setPortfolioLevelMixPct(Number(e.target.value)); }}
                disabled={portfolioAvgDebt < 7000}
                style={{ width:"100%", accentColor:FT_GREEN, opacity: portfolioAvgDebt < 7000 ? 0.4 : 1 }} />
              <div style={{ fontSize:12, fontWeight:700, color:"#64748b", marginTop:3 }}>
                {portfolioAvgDebt < 7000 ? "0" : portfolioLevelMixPct}%
              </div>
            </div>
          </div>

          <div className="grid-4" style={{ marginTop:16 }}>
            <MetricCard title="Level Debt Deals"       value={String(portfolio.ldCount)} subtitle={`${percentFmt.format(portfolio.effectiveLDPct/100)} of portfolio`} />
            <MetricCard title="Consumer Shield Deals"  value={String(portfolio.csCount)} subtitle={`${percentFmt.format((100-portfolio.effectiveLDPct)/100)} of portfolio`} />
            <MetricCard title="Expected Gross Revenue" value={money.format(portfolio.totalGross)} />
            <MetricCard title="Expected Net Revenue"   value={money.format(portfolio.totalNet)} />
          </div>

          <div style={{ marginTop:16, overflowX:"auto", border:"1px solid #e2e8f0", borderRadius:13 }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead><tr style={{ background:"#f1f5f9" }}>
                {["Metric","Level Debt Portion","Consumer Shield Portion","Combined"].map(h => <th key={h} style={TH}>{h}</th>)}
              </tr></thead>
              <tbody>
                {[
                  { label:"Deal Count", tip:"Total deals split by routing allocation. Deals under $7k are forced to CS.",
                    ld:String(portfolio.ldCount), cs:String(portfolio.csCount), tot:String(portfolioDeals) },
                  { label:"Gross Revenue", tip:"LD = 8% × avg debt × deal count. CS = expected revenue × CS deal count using effective (quality-adjusted) survival rates.",
                    ld:money.format(portfolio.ldGross), cs:money.format(portfolio.csGross), tot:money.format(portfolio.totalGross) },
                  { label:"Rep Cost", tip:"LD = enrolled debt × rep %. CS = (upfront + milestone × effective P4 rate) × CS deals.",
                    ld:money.format(portfolio.ldRep), cs:money.format(portfolio.csRep), tot:money.format(portfolio.totalRep) },
                  { label:"Net Revenue", tip:"Gross revenue minus total rep cost.",
                    ld:money.format(portfolio.ldGross-portfolio.ldRep), cs:money.format(portfolio.csGross-portfolio.csRep), tot:money.format(portfolio.totalNet) },
                  { label:"CS Full-Upside Ref", tip:"CS revenue if every CS deal completed the full term. Ceiling only — not a forecast.",
                    ld:"—", cs:money.format(portfolio.csUpside), tot:money.format(portfolio.ldGross+portfolio.csUpside) },
                ].map((row, i) => (
                  <tr key={row.label} style={{ background:i%2?"#f8fafc":"#fff" }}>
                    <td style={{ ...TD, fontWeight:700 }} title={row.tip}>
                      {row.label} <span style={{ fontSize:10, background:"#e2e8f0", borderRadius:99, padding:"1px 5px", color:"#334155", cursor:"help" }}>?</span>
                    </td>
                    <td style={TD}>{row.ld}</td>
                    <td style={TD}>{row.cs}</td>
                    <td style={{ ...TD, borderRight:"none" }}>{row.tot}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Operator Notes */}
        <div style={card}>
          <h2 style={{ margin:"0 0 10px", fontSize:18, fontWeight:800, color:"#0f172a" }}>Operator Notes</h2>
          {[
            ["Under $7k deals", "Level Debt cannot accept enrolled debt below $7,000. These deals are Consumer Shield by default — no routing decision is needed. This rule is enforced throughout this tool."],
            ["CS Funnel sliders", "These represent your estimate of how many CS deals survive to each milestone. They cascade — completing 25% means those same 25% also cleared break-even, payment 4, and payment 2. Lowering completion automatically lowers break-even if needed."],
            ["CS Lead quality", "Adjusts effective survival rates based on the quality of leads being sent to CS. Poor leads reduce how many deals survive to each milestone. Check this against your actual CS payment-2 and payment-4 rates to validate your assumptions."],
            ["Cash urgency", "This is a routing decision tool, not a CS revenue input. It answers: 'Given our cash needs, what % of deals above $7k should go to Level Debt vs CS?' Adjust as your cash position changes month to month. 100% urgency means you need immediate revenue recognition — route heavily to Level Debt. 0% means you can afford to build the CS long-tail stack."],
            ["Break-even + Liability Clear (Hyper Green)", "The first month where CS has both matched Level Debt economically AND the chargeback window on the break-even payment has closed. This is your true zero-risk inflection point for CS deals."],
            ["Using this tool over time", "As your book of CS deals ages, compare your actual payment-2, payment-4, and break-even survival rates to the funnel assumptions. When reality diverges from the estimate, adjust the sliders — the expected revenue and routing recommendations will update automatically."],
          ].map(([b, rest], i) => (
            <p key={i} style={{ margin:"8px 0 0", fontSize:14, color:"#475569", lineHeight:1.7 }}>
              <strong style={{ color:"#0f172a" }}>{b}:</strong> {rest}
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
