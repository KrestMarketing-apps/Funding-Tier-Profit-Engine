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
  label: string; debtRange: string;
  minDebt: number; maxDebt: number;
  payment: number; term: number;
};

type DealMetrics = {
  debtAmount: number; levelDebtEligible: boolean;
  levelDebtRevenue: number; levelDebtRevShareEligible: boolean;
  consumerShieldPayment: number | null; consumerShieldTerm: number | null;
  consumerShieldNetPayment: number | null;
  consumerShieldRevenueAfter2: number | null; consumerShieldRevenueAfter4: number | null;
  consumerShieldFrontRevenue: number | null; consumerShieldBackRevenueMonthly: number | null;
  consumerShieldRevenueAtHalf: number | null; consumerShieldRevenueAtFull: number | null;
  consumerShieldExpectedRevenue: number | null;
  consumerShieldBreakEvenMonthVsLevel: number | null;
  consumerShieldLiabilityClearMonth: number | null;
  consumerShieldTimeline: TimelineRow[];
  effectiveP2: number; effectiveP4: number; effectiveBE: number; effectiveComp: number;
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
// CS PROGRAMS
// ─────────────────────────────────────────────

const consumerShieldPrograms: ConsumerShieldProgram[] = [
  { label:"CS Program A", debtRange:"$4,000 – $4,999",   minDebt:4000,  maxDebt:4999.99,             payment:220, term:18 },
  { label:"CS Program B", debtRange:"$5,000 – $8,799",   minDebt:5000,  maxDebt:8799.99,             payment:220, term:24 },
  { label:"CS Program C", debtRange:"$8,800 – $9,999",   minDebt:8800,  maxDebt:9999.99,             payment:220, term:36 },
  { label:"CS Program D", debtRange:"$10,000 – $14,999", minDebt:10000, maxDebt:14999.99,            payment:270, term:36 },
  { label:"CS Program E", debtRange:"$15,000 – $19,999", minDebt:15000, maxDebt:19999.99,            payment:320, term:36 },
  { label:"CS Program F", debtRange:"$20,000 – $24,999", minDebt:20000, maxDebt:24999.99,            payment:370, term:36 },
  { label:"CS Program G", debtRange:"$25,000 – $29,999", minDebt:25000, maxDebt:29999.99,            payment:420, term:36 },
  { label:"CS Program H", debtRange:"$30,000 – $49,999", minDebt:30000, maxDebt:49999.99,            payment:520, term:36 },
  { label:"CS Program I", debtRange:"$50,000+",          minDebt:50000, maxDebt:Number.POSITIVE_INFINITY, payment:620, term:36 },
];

// ─────────────────────────────────────────────
// MATH
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
 * effectiveRate = baseRate × (0.35 + 0.65 × quality/100)
 * Cascade enforced after applying scalar.
 */
function applyLeadQuality(p2: number, p4: number, be: number, comp: number, quality: number): [number, number, number, number] {
  const scalar = 0.35 + 0.65 * (quality / 100);
  let ep2   = round2(p2   * scalar);
  let ep4   = round2(Math.min(p4   * scalar, ep2));
  let ebe   = round2(Math.min(be   * scalar, ep4));
  let ecomp = round2(Math.min(comp * scalar, ebe));
  return [ep2, ep4, ebe, ecomp];
}

/**
 * STABILITY-ADJUSTED URGENCY
 *
 * If CS survival rates are poor, the effective CS revenue per deal is unreliable.
 * The system automatically increases urgency to protect cash flow stability.
 *
 * Penalty components:
 *   - Low effective completion (< 30%) → high penalty: company is not realizing CS LTV
 *   - Low effective P2 (< 50%) → medium penalty: most CS deals earning nothing
 *   - Gap between P2 and completion → measures how much revenue is being lost mid-funnel
 *
 * Formula:
 *   stabilityPenalty = completionPenalty + p2Penalty + funnelLeakPenalty
 *   adjustedUrgency  = clamp(baseUrgency + stabilityPenalty, 0, 100)
 */
function calcStabilityAdjustedUrgency(
  baseUrgency: number,
  ep2: number, ep4: number, ebe: number, ecomp: number
): { adjusted: number; penalty: number; reason: string } {
  // Completion penalty: 0 at 50%+ completion, up to 25 at 0% completion
  const completionPenalty = ecomp < 50 ? round2((50 - ecomp) * 0.5) : 0;

  // P2 penalty: if less than half your CS deals even make payment 2, cash flow is fragile
  const p2Penalty = ep2 < 50 ? round2((50 - ep2) * 0.3) : 0;

  // Funnel leak penalty: large gap between P2 and completion means lots of early drop-off
  const funnelLeak = ep2 - ecomp;
  const funnelPenalty = funnelLeak > 50 ? round2((funnelLeak - 50) * 0.15) : 0;

  const totalPenalty = Math.round(completionPenalty + p2Penalty + funnelPenalty);
  const adjusted = clamp(baseUrgency + totalPenalty, 0, 100);

  let reason = "";
  if (totalPenalty === 0) {
    reason = "CS survival rates are healthy — no stability adjustment needed.";
  } else {
    const parts = [];
    if (completionPenalty > 0) parts.push(`low CS completion (${ecomp}%) +${Math.round(completionPenalty)}pt`);
    if (p2Penalty > 0) parts.push(`low CS P2 rate (${ep2}%) +${Math.round(p2Penalty)}pt`);
    if (funnelPenalty > 0) parts.push(`high funnel drop-off (${funnelLeak}pp gap) +${Math.round(funnelPenalty)}pt`);
    reason = `Stability adjustment +${totalPenalty}pt due to: ${parts.join("; ")}. Routing more deals to Level Debt protects near-term cash flow.`;
  }

  return { adjusted, penalty: totalPenalty, reason };
}

/**
 * Cash urgency → recommended % of deals above $7k to route to Level Debt.
 * Uses stability-adjusted urgency for routing math.
 * 100% → ~85% LD, 0% → ~20% LD
 * Formula: ldPct = 20 + (adjustedUrgency × 0.65)
 */
function cashUrgencyToRouting(adjustedUrgency: number): { ldPct: number; horizon: string; rationale: string } {
  const ldPct = Math.round(20 + adjustedUrgency * 0.65);
  let horizon = "", rationale = "";
  if (adjustedUrgency >= 90)      { horizon = "~90 days";  rationale = "Maximum Level Debt routing. CS deals won't break even within your cash window."; }
  else if (adjustedUrgency >= 65) { horizon = "~120–150 days"; rationale = "Heavily weighted to Level Debt. Small CS allocation for high-quality deals only."; }
  else if (adjustedUrgency >= 40) { horizon = "~180 days"; rationale = "Balanced. Level Debt funds operations while CS builds a long-tail revenue stack."; }
  else if (adjustedUrgency >= 20) { horizon = "~270 days"; rationale = "Lean toward CS. You have enough runway to let back-end revenue materialize on quality deals."; }
  else                             { horizon = "No near-term constraint"; rationale = "Maximize Consumer Shield for highest long-term LTV. Use Level Debt as a cash buffer floor only."; }
  return { ldPct, horizon, rationale };
}

function calcExpectedRevenue(ep2: number, ep4: number, ebe: number, ecomp: number,
  rev2: number, rev4: number, revBE: number, fullRev: number): number {
  return round2(
    (ep2 - ep4) / 100 * rev2
    + (ep4 - ebe) / 100 * rev4
    + (ebe - ecomp) / 100 * revBE
    + ecomp / 100 * fullRev
  );
}

// ─────────────────────────────────────────────
// CORE CALCULATOR
// ─────────────────────────────────────────────

function calculateDealMetrics(args: {
  debtAmount: number; p2Pct: number; p4Pct: number; bePct: number; compPct: number;
  leadQuality: number; adjustedUrgency: number;
}): DealMetrics {
  const { debtAmount, p2Pct, p4Pct, bePct, compPct, leadQuality, adjustedUrgency } = args;

  const levelDebtEligible = debtAmount >= 7000;
  const ldRev = levelDebtEligible ? round2(debtAmount * 0.08) : 0;
  const prog  = getProgram(debtAmount);
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
  const expected = calcExpectedRevenue(ep2, ep4, ebe, ecomp, rev2, rev4, revBE, fullR);

  let recommendedBackend: DealMetrics["recommendedBackend"] = "No Recommendation";
  let recommendationReason = "";

  if (!levelDebtEligible) {
    recommendedBackend = "Consumer Shield (Required — Under $7k)";
    recommendationReason = "Deals under $7,000 enrolled debt cannot be routed to Level Debt. Consumer Shield is the only eligible backend.";
  } else {
    const urgencyBias = adjustedUrgency / 100;
    const qualityBias = leadQuality / 100;
    const ldAdjusted  = ldRev * (1 + urgencyBias * 0.6);
    const csAdjusted  = expected * (0.5 + qualityBias * 0.7) * (1 - urgencyBias * 0.35);
    if (csAdjusted > ldAdjusted) {
      recommendedBackend = "Consumer Shield";
      recommendationReason = `CS wins on adjusted expected value. Effective rates: P2=${ep2}% P4=${ep4}% BE=${ebe}% Comp=${ecomp}%.`;
    } else {
      recommendedBackend = "Level Debt";
      recommendationReason = `Level Debt wins — ${urgencyBias > 0.5 ? "cash urgency/stability favors fast recognition" : "adjusted CS expected value doesn't clear the LD benchmark"} at current lead quality (${leadQuality}%).`;
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
// INLINE TOOLTIP (reusable)
// ─────────────────────────────────────────────

function InlineTip({ text, width = 260 }: { text: string; width?: number }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", verticalAlign: "middle", marginLeft: 5 }}>
      <span onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 15, height: 15, borderRadius: "50%", background: FT_GREEN,
          color: "#fff", fontSize: 9, fontWeight: 900, cursor: "help", flexShrink: 0 }}>?</span>
      {show && (
        <div style={{ position: "absolute", bottom: "130%", left: "50%", transform: "translateX(-50%)",
          background: "#0f172a", color: "#fff", borderRadius: 10, padding: "10px 13px",
          fontSize: 12, lineHeight: 1.65, width, zIndex: 300,
          boxShadow: "0 8px 24px rgba(0,0,0,0.28)", pointerEvents: "none", whiteSpace: "pre-line" }}>
          {text}
        </div>
      )}
    </span>
  );
}

// ─────────────────────────────────────────────
// CASCADING FUNNEL SLIDERS
// ─────────────────────────────────────────────

function CascadingFunnel({ p2, p4, be, comp, onChange }: {
  p2: number; p4: number; be: number; comp: number;
  onChange: (p2: number, p4: number, be: number, comp: number) => void;
}) {
  const stages = [
    { key:"p2",   val:p2,   label:"CS Reach Payment 2",   color:FT_GREEN },
    { key:"p4",   val:p4,   label:"CS Reach Payment 4",   color:FT_BLUE  },
    { key:"be",   val:be,   label:"CS Reach Break-Even",  color:FT_AMBER },
    { key:"comp", val:comp, label:"CS Complete Program",  color:FT_HYPER },
  ];

  const handleChange = (key: string, nv: number) => {
    let [np2,np4,nbe,ncomp]=[p2,p4,be,comp];
    if      (key==="p2")   { np2=nv; np4=Math.min(np4,np2); nbe=Math.min(nbe,np4); ncomp=Math.min(ncomp,nbe); }
    else if (key==="p4")   { np4=nv; np2=Math.max(np2,np4); nbe=Math.min(nbe,np4); ncomp=Math.min(ncomp,nbe); }
    else if (key==="be")   { nbe=nv; np4=Math.max(np4,nbe); np2=Math.max(np2,np4); ncomp=Math.min(ncomp,nbe); }
    else                   { ncomp=nv; nbe=Math.max(nbe,ncomp); np4=Math.max(np4,nbe); np2=Math.max(np2,np4); }
    onChange(np2,np4,nbe,ncomp);
  };

  return (
    <div style={{ display:"flex", gap:10, flex:1, flexWrap:"wrap" }}>
      {stages.map(s => (
        <div key={s.key} style={{ flex:1, minWidth:88 }}>
          <div style={{ fontSize:9, fontWeight:800, color:s.color, marginBottom:3,
            textTransform:"uppercase", letterSpacing:0.3, whiteSpace:"nowrap",
            overflow:"hidden", textOverflow:"ellipsis" }}>{s.label}</div>
          <input type="range" min={0} max={100} step={1} value={s.val}
            onChange={e => handleChange(s.key, Number(e.target.value))}
            style={{ width:"100%", accentColor:s.color }} />
          <div style={{ fontSize:11, fontWeight:800, color:s.color, marginTop:1 }}>{s.val}%</div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// CASH URGENCY PANEL
// ─────────────────────────────────────────────

function CashUrgencyPanel({ urgency, onChange, adjustedUrgency, stabilityPenalty, stabilityReason,
  routing, debtAmount }: {
  urgency: number; onChange: (v: number) => void;
  adjustedUrgency: number; stabilityPenalty: number; stabilityReason: string;
  routing: { ldPct: number; horizon: string; rationale: string };
  debtAmount: number;
}) {
  const csPct   = 100 - routing.ldPct;
  const under7k = debtAmount >= 4000 && debtAmount < 7000;

  const horizonMarkers = [
    { label:"No urgency", pct:0 },
    { label:"270 days",   pct:25 },
    { label:"180 days",   pct:50 },
    { label:"120 days",   pct:75 },
    { label:"90 days",    pct:100 },
  ];

  return (
    <div style={{ ...card, borderLeft:`4px solid ${FT_AMBER}` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
        <div>
          <div style={{ fontWeight:800, fontSize:15, color:"#0f172a" }}>
            Cash Urgency — Portfolio Routing Driver
          </div>
          <div style={{ fontSize:12, color:"#64748b", marginTop:3, lineHeight:1.6, maxWidth:560 }}>
            How quickly does Funding Tier need cash to fuel operations and growth?
            This drives the recommended allocation of deals above $7k between Level Debt and Consumer Shield.
            {stabilityPenalty > 0 && (
              <span style={{ color:FT_RED, fontWeight:700 }}>
                {" "}Your CS survival rates are adding a stability adjustment of +{stabilityPenalty}pt.
              </span>
            )}
          </div>
        </div>
        <div style={{ textAlign:"right", flexShrink:0 }}>
          <div style={{ fontSize:11, color:"#64748b", textTransform:"uppercase", letterSpacing:0.4, fontWeight:700 }}>Cash Horizon</div>
          <div style={{ fontSize:20, fontWeight:900, color:FT_AMBER }}>{routing.horizon}</div>
          {stabilityPenalty > 0 && (
            <div style={{ fontSize:10, color:FT_RED, fontWeight:700, marginTop:2 }}>
              Base {urgency}% + {stabilityPenalty}pt stability → {adjustedUrgency}%
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom:10 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
          {horizonMarkers.map(m => (
            <span key={m.pct} style={{ fontSize:10, color:"#94a3b8", fontWeight:600 }}>{m.label}</span>
          ))}
        </div>
        <input type="range" min={0} max={100} step={1} value={urgency}
          onChange={e => onChange(Number(e.target.value))}
          style={{ width:"100%", accentColor:FT_AMBER }} />
        <div style={{ textAlign:"center", fontSize:12, fontWeight:700, color:FT_AMBER, marginTop:2 }}>
          {urgency}%{stabilityPenalty > 0 ? ` (stability-adjusted: ${adjustedUrgency}%)` : ""}
        </div>
      </div>

      {stabilityPenalty > 0 && (
        <div style={{ background:FT_RED+"0d", border:`1px solid ${FT_RED}33`, borderRadius:10,
          padding:"9px 13px", fontSize:12, color:"#475569", lineHeight:1.65, marginBottom:12 }}>
          <strong style={{ color:FT_RED }}>⚡ Stability adjustment active:</strong> {stabilityReason}
        </div>
      )}

      {under7k ? (
        <div style={{ background:FT_RED+"11", border:`1px solid ${FT_RED}33`, borderRadius:12, padding:"12px 14px" }}>
          <div style={{ fontWeight:800, color:FT_RED, fontSize:13 }}>⛔ Deal Under $7,000 — Level Debt Cannot Accept This Deal</div>
          <div style={{ fontSize:12, color:"#64748b", marginTop:4, lineHeight:1.6 }}>
            Level Debt only accepts enrolled debt of $7,000 or more. This deal must route to Consumer Shield regardless of cash urgency.
          </div>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:4 }}>
          <div style={{ background:FT_GREEN+"11", border:`1px solid ${FT_GREEN}33`, borderRadius:12, padding:"12px 14px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:FT_GREEN_DARK, textTransform:"uppercase", letterSpacing:0.4 }}>Recommended — Level Debt (&gt;$7k)</div>
            <div style={{ fontSize:28, fontWeight:900, color:FT_GREEN_DARK, lineHeight:1 }}>{routing.ldPct}%</div>
            <div style={{ fontSize:12, color:"#64748b", marginTop:4, lineHeight:1.5 }}>Route this share to Level Debt for fast 8% recognition</div>
          </div>
          <div style={{ background:FT_BLUE+"11", border:`1px solid ${FT_BLUE}33`, borderRadius:12, padding:"12px 14px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:FT_BLUE, textTransform:"uppercase", letterSpacing:0.4 }}>Recommended — Consumer Shield (&gt;$7k)</div>
            <div style={{ fontSize:28, fontWeight:900, color:FT_BLUE, lineHeight:1 }}>{csPct}%</div>
            <div style={{ fontSize:12, color:"#64748b", marginTop:4, lineHeight:1.5 }}>Route this share to Consumer Shield for long-term LTV</div>
          </div>
          <div style={{ gridColumn:"1/-1", fontSize:13, color:"#475569", lineHeight:1.7,
            background:"#f8fafc", borderRadius:10, padding:"10px 13px" }}>
            <strong style={{ color:"#0f172a" }}>Rationale:</strong> {routing.rationale}
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
    <div style={{ ...card, borderLeft:`4px solid ${qualityColor}` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
        <div>
          <div style={{ fontWeight:800, fontSize:15, color:"#0f172a" }}>CS Lead Quality — Survival Rate Adjuster</div>
          <div style={{ fontSize:12, color:"#64748b", marginTop:3, lineHeight:1.6, maxWidth:560 }}>
            Scales effective CS survival rates to reflect real-world churn risk on weaker leads.
            Your set rates assume ideal conditions — lead quality degrades them proportionally.
          </div>
        </div>
        <div style={{ textAlign:"right", flexShrink:0 }}>
          <div style={{ fontSize:11, color:"#64748b", textTransform:"uppercase", letterSpacing:0.4, fontWeight:700 }}>Quality Tier</div>
          <div style={{ fontSize:20, fontWeight:900, color:qualityColor }}>{qualityLabel}</div>
        </div>
      </div>

      <input type="range" min={0} max={100} step={1} value={quality}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width:"100%", accentColor:qualityColor }} />
      <div style={{ textAlign:"center", fontSize:12, fontWeight:700, color:qualityColor, marginTop:2, marginBottom:12 }}>{quality}%</div>

      <div style={{ overflowX:"auto", borderRadius:11, border:"1px solid #e2e8f0" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
          <thead><tr style={{ background:"#f8fafc" }}>
            <th style={TH}>Milestone</th>
            <th style={TH}>Your Estimate</th>
            <th style={{ ...TH, borderRight:"none" }}>Effective Rate at {quality}% Quality</th>
          </tr></thead>
          <tbody>
            {[
              { label:"CS Reach Payment 2",  set:p2Pct,   eff:ep2,   color:FT_GREEN },
              { label:"CS Reach Payment 4",  set:p4Pct,   eff:ep4,   color:FT_BLUE  },
              { label:"CS Reach Break-Even", set:bePct,   eff:ebe,   color:FT_AMBER },
              { label:"CS Complete Program", set:compPct, eff:ecomp, color:FT_HYPER },
            ].map((row, i) => (
              <tr key={i} style={{ background:i%2?"#f8fafc":"#fff" }}>
                <td style={{ ...TD, fontWeight:700, color:row.color }}>{row.label}</td>
                <td style={TD}>{row.set}%</td>
                <td style={{ ...TD, fontWeight:800, borderRight:"none",
                  color:row.eff < row.set ? FT_RED : row.color }}>
                  {row.eff}%
                  {row.eff < row.set && <span style={{ marginLeft:6, fontSize:10, color:FT_RED }}>↓ {row.set-row.eff}pp</span>}
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
// FUNNEL EXPLAINER (with cohort tooltip)
// ─────────────────────────────────────────────

function FunnelExplainer({ ep2, ep4, ebe, ecomp, rev2, rev4, revBE, fullRev, ldRev }: {
  ep2: number; ep4: number; ebe: number; ecomp: number;
  rev2: number; rev4: number; revBE: number; fullRev: number; ldRev: number;
}) {
  const stages = [
    { pct:100,  label:"CS Deals Sent",           color:"#94a3b8" },
    { pct:ep2,  label:"CS Reach Payment 2",       color:FT_GREEN  },
    { pct:ep4,  label:"CS Reach Payment 4",       color:FT_BLUE   },
    { pct:ebe,  label:"CS Reach Break-Even",      color:FT_AMBER  },
    { pct:ecomp,label:"CS Complete Full Program", color:FT_HYPER  },
  ];

  const d2c  = round2(ep2 - ep4);
  const d4be = round2(ep4 - ebe);
  const dbeC = round2(ebe - ecomp);

  const marginals = [
    { label:`${round2(100-ep2)}% drop before CS Payment 2 — earn $0`,
      contrib:0, calc:`(100% − ${ep2}%) = ${round2(100-ep2)}% of deals earn nothing`, color:"#e2e8f0" },
    { label:`${d2c}% reach CS P2 only — earn ${money.format(rev2)} each`,
      contrib:round2(d2c/100*rev2), calc:`(${ep2}% − ${ep4}%) × ${money.format(rev2)} = ${money.format(round2(d2c/100*rev2))}`, color:FT_GREEN },
    { label:`${d4be}% reach CS P4 only — earn ${money.format(rev4)} each`,
      contrib:round2(d4be/100*rev4), calc:`(${ep4}% − ${ebe}%) × ${money.format(rev4)} = ${money.format(round2(d4be/100*rev4))}`, color:FT_BLUE },
    { label:`${dbeC}% reach CS Break-Even only — earn ${money.format(revBE)} each`,
      contrib:round2(dbeC/100*revBE), calc:`(${ebe}% − ${ecomp}%) × ${money.format(revBE)} = ${money.format(round2(dbeC/100*revBE))}`, color:FT_AMBER },
    { label:`${ecomp}% complete CS full program — earn ${money.format(fullRev)} each`,
      contrib:round2(ecomp/100*fullRev), calc:`${ecomp}% × ${money.format(fullRev)} = ${money.format(round2(ecomp/100*fullRev))}`, color:FT_HYPER },
  ];

  const totalExpected = round2(marginals.reduce((s, m) => s + m.contrib, 0));

  const cohortTipText = `Each row represents a "cohort" — the group of CS deals that dropped out at a specific stage.\n\n` +
    `How each row is calculated:\n` +
    `• "% in cohort" = difference between adjacent funnel stages\n` +
    `  e.g. P2 cohort = P2 rate minus P4 rate\n` +
    `• "Revenue per deal" = cumulative CS revenue at that stage exit point\n` +
    `• "Contribution" = cohort % × revenue per deal\n\n` +
    `Summing all cohort contributions gives the total Expected Revenue per CS deal.\n\n` +
    `Example: if 15% of deals reach P2 only and earn $660 each,\n` +
    `that cohort contributes $99 per average CS deal.`;

  return (
    <div style={card}>
      <div style={{ fontWeight:800, fontSize:15, color:"#0f172a", marginBottom:12 }}>
        CS Expected Revenue — Deal Survival Funnel (after Lead Quality adjustment)
      </div>
      <div style={{ display:"grid", gap:6, marginBottom:16 }}>
        {stages.map((s, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ fontSize:12, color:"#64748b", width:210, flexShrink:0, fontWeight:i===0?400:700 }}>{s.label}</div>
            <div style={{ flex:1, background:"#f1f5f9", borderRadius:99, height:16, overflow:"hidden" }}>
              <div style={{ width:`${s.pct}%`, height:"100%", background:s.color, borderRadius:99, transition:"width 0.3s" }} />
            </div>
            <div style={{ fontSize:13, fontWeight:800, color:s.color, width:42, textAlign:"right" }}>{s.pct}%</div>
          </div>
        ))}
      </div>

      <div style={{ borderTop:"1px solid #e2e8f0", paddingTop:12 }}>
        <div style={{ display:"flex", alignItems:"center", fontWeight:700, fontSize:13, color:"#334155", marginBottom:8 }}>
          Revenue contribution per cohort:
          <InlineTip text={cohortTipText} width={320} />
        </div>
        <div style={{ display:"grid", gap:4 }}>
          {marginals.map((m, i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start",
              fontSize:13, padding:"5px 10px", borderRadius:8,
              background:m.contrib===0?"#f8fafc":m.color+"14" }}>
              <div>
                <div style={{ color:m.contrib===0?"#94a3b8":"#0f172a" }}>{m.label}</div>
                <div style={{ fontSize:11, color:"#94a3b8", marginTop:1 }}>{m.calc}</div>
              </div>
              <span style={{ fontWeight:700, color:m.contrib===0?"#94a3b8":m.color, flexShrink:0, marginLeft:12 }}>
                {m.contrib===0 ? "$0" : money.format(m.contrib)}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:10,
          padding:"8px 10px", background:FT_GREEN+"18", borderRadius:10, fontWeight:800, fontSize:14 }}>
          <span>CS Expected Revenue Per Deal</span>
          <span style={{ color:FT_GREEN_DARK }}>{money.format(totalExpected)}</span>
        </div>
        {ldRev > 0 && (
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:6,
            padding:"8px 10px", background:"#f1f5f9", borderRadius:10, fontSize:13, color:"#64748b" }}>
            <span>Level Debt guaranteed equivalent (8% — recognized after 2 payments)</span>
            <span style={{ fontWeight:700, color:"#334155" }}>{money.format(ldRev)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ACCORDION
// ─────────────────────────────────────────────

function Accordion({ title, defaultOpen=false, children, badge }: {
  title:string; defaultOpen?:boolean; children:React.ReactNode; badge?:string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border:"1px solid #e2e8f0", borderRadius:16, overflow:"hidden", background:"#fff" }}>
      <button onClick={() => setOpen(o=>!o)} style={{
        width:"100%", textAlign:"left", background:"#fff", border:"none",
        padding:"13px 18px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontWeight:800, fontSize:16, color:"#0f172a" }}>{title}</span>
          {badge && <span style={{ fontSize:11, fontWeight:700, background:FT_GREEN+"22", color:FT_GREEN_DARK, padding:"2px 8px", borderRadius:99 }}>{badge}</span>}
        </div>
        <span style={{ fontSize:20, fontWeight:900, color:FT_GREEN }}>{open?"−":"+"}</span>
      </button>
      {open && <div style={{ borderTop:"1px solid #e2e8f0", padding:18 }}>{children}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────
// METRIC CARD
// ─────────────────────────────────────────────

function MetricCard({ title, value, subtitle, tooltip, inlineTag }: {
  title:string; value:string; subtitle?:string; tooltip?:string; inlineTag?:string;
}) {
  const [showTip, setShowTip] = useState(false);
  return (
    <div style={{ ...card, position:"relative" }}>
      <div style={{ fontSize:11, fontWeight:700, color:"#64748b", marginBottom:7,
        textTransform:"uppercase", letterSpacing:0.4,
        display:"flex", alignItems:"center", justifyContent:"space-between", gap:4 }}>
        <span style={{ display:"flex", alignItems:"center", gap:4 }}>
          {title}
          {tooltip && (
            <span onMouseEnter={() => setShowTip(true)} onMouseLeave={() => setShowTip(false)}
              style={{ display:"inline-flex", alignItems:"center", justifyContent:"center",
                width:14, height:14, borderRadius:"50%", background:FT_GREEN,
                color:"#fff", fontSize:9, fontWeight:900, cursor:"help", flexShrink:0 }}>?</span>
          )}
        </span>
        {inlineTag && <span style={{ fontSize:10, fontWeight:600, color:"#94a3b8", fontStyle:"italic", textTransform:"none", whiteSpace:"nowrap" }}>{inlineTag}</span>}
      </div>
      {showTip && tooltip && (
        <div style={{ position:"absolute", top:"100%", left:0, zIndex:100,
          background:"#0f172a", color:"#fff", borderRadius:10,
          padding:"10px 13px", fontSize:12, lineHeight:1.6,
          width:260, boxShadow:"0 8px 24px rgba(0,0,0,0.25)", marginTop:4, pointerEvents:"none" }}>{tooltip}</div>
      )}
      <div style={{ fontSize:24, fontWeight:800, color:"#0f172a", lineHeight:1.1, wordBreak:"break-word" }}>{value}</div>
      {subtitle && <div style={{ fontSize:12, color:"#64748b", marginTop:7, lineHeight:1.5 }}>{subtitle}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────
// CS MILESTONES TIMELINE
// ─────────────────────────────────────────────

function CSRevenueMilestonesTimeline({ timeline, breakEvenMonth, liabilityClearMonth, levelDebtRevenue, debtAmount }: {
  timeline:TimelineRow[]; breakEvenMonth:number|null; liabilityClearMonth:number|null;
  levelDebtRevenue:number; debtAmount:number;
}) {
  const [hovM, setHovM] = useState<number|null>(null);
  const [showTip, setShowTip] = useState(false);

  if (!timeline.length) return <div style={{ color:"#94a3b8", fontSize:13 }}>Enter a valid debt amount to see the timeline.</div>;

  const W=740,H=130,PL=22,PR=22,dotY=54;
  const term=timeline.length;
  const getX=(i:number)=>PL+(i/Math.max(term-1,1))*(W-PL-PR);
  const hov=hovM!==null?timeline[hovM-1]:null;
  const hovX=hovM!==null?getX(hovM-1):0;

  const labels:Record<number,{text:string;color:string}>={};
  labels[1]={text:"Mo 1",color:FT_GREEN}; labels[4]={text:"Mo 4",color:FT_GREEN};
  if(breakEvenMonth) labels[breakEvenMonth]={text:`Mo ${breakEvenMonth}`,color:FT_AMBER};
  if(liabilityClearMonth&&liabilityClearMonth<=term) labels[liabilityClearMonth]={text:`Mo ${liabilityClearMonth}`,color:FT_HYPER};
  labels[term]={text:`Mo ${term}`,color:FT_GREEN_DARK};

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
        <span style={{ fontSize:13, color:"#64748b" }}>
          Figures based on <strong>{money.format(debtAmount)}</strong> enrolled debt —
          Level Debt = {levelDebtRevenue > 0 ? money.format(levelDebtRevenue) : "N/A (under $7k)"} vs the assigned CS program.
        </span>
        <span onMouseEnter={()=>setShowTip(true)} onMouseLeave={()=>setShowTip(false)}
          style={{ display:"inline-flex", alignItems:"center", justifyContent:"center",
            width:16, height:16, borderRadius:"50%", background:FT_GREEN,
            color:"#fff", fontSize:10, fontWeight:900, cursor:"help", flexShrink:0, position:"relative" }}>
          ?
          {showTip && (
            <div style={{ position:"absolute", bottom:"120%", left:"50%", transform:"translateX(-50%)",
              background:"#0f172a", color:"#fff", borderRadius:10, padding:"10px 13px",
              fontSize:12, lineHeight:1.65, width:300, boxShadow:"0 8px 24px rgba(0,0,0,0.25)",
              zIndex:200, pointerEvents:"none" }}>
              These milestones show the cumulative CS revenue at each month for the program assigned to {money.format(debtAmount)} enrolled debt.
              Level Debt comparison is based on 8% of enrolled debt recognized after 2 payments.
              Adjust Enrolled Debt to see how milestones shift.
            </div>
          )}
        </span>
      </div>

      <div style={{ overflowX:"auto" }}>
        <svg width={W} height={H} style={{ minWidth:W, display:"block" }} onMouseLeave={()=>setHovM(null)}>
          <line x1={PL} y1={dotY} x2={W-PR} y2={dotY} stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
          {timeline.map((row,i)=>{
            if(i===0) return null;
            const col=row.month===liabilityClearMonth?FT_HYPER:row.month<=(breakEvenMonth??0)?FT_AMBER:row.phase==="Front"?FT_GREEN:FT_BLUE;
            return <line key={i} x1={getX(i-1)} y1={dotY} x2={getX(i)} y2={dotY} stroke={col} strokeWidth="4" strokeLinecap="round" />;
          })}
          {timeline.map((row,i)=>{
            const x=getX(i),isHov=hovM===row.month,isLbl=!!labels[row.month];
            const isBE=row.month===breakEvenMonth,isLC=row.month===liabilityClearMonth,isLast=row.month===term;
            const dc=isLC?FT_HYPER:isBE?FT_AMBER:isLast?FT_GREEN_DARK:row.phase==="Front"?FT_GREEN:FT_BLUE;
            return (
              <g key={row.month}>
                <circle cx={x} cy={dotY} r={12} fill="transparent" style={{cursor:"pointer"}} onMouseEnter={()=>setHovM(row.month)} />
                <circle cx={x} cy={dotY} r={isHov?9:isLbl?6:3.5} fill={dc} stroke={isLC||isHov?"#fff":"none"} strokeWidth={isLC?2.5:2} style={{pointerEvents:"none"}} />
                {isLC&&<circle cx={x} cy={dotY} r={isHov?14:10} fill="none" stroke={FT_HYPER} strokeWidth="2" opacity="0.4" style={{pointerEvents:"none"}} />}
                {isLbl&&<text x={x} y={dotY+20} textAnchor="middle" fontSize="10" fill={labels[row.month].color} fontWeight="800">{labels[row.month].text}</text>}
                {isLast&&<text x={x} y={dotY-14} textAnchor="middle" fontSize="11" fill={FT_GREEN_DARK} fontWeight="900">{money.format(row.cumulativeRevenue)}</text>}
                {isBE&&!isLast&&<text x={x} y={dotY-14} textAnchor="middle" fontSize="10" fill={FT_AMBER} fontWeight="800">{money.format(row.cumulativeRevenue)}</text>}
                {isLC&&!isBE&&!isLast&&<text x={x} y={dotY-14} textAnchor="middle" fontSize="10" fill={FT_HYPER} fontWeight="900">{money.format(row.cumulativeRevenue)}</text>}
              </g>
            );
          })}
          {hov&&(()=>{
            const tx=Math.min(Math.max(hovX,68),W-68);
            return (
              <g style={{pointerEvents:"none"}}>
                <rect x={tx-62} y={dotY-62} width={124} height={48} rx="8" fill="#0f172a" opacity="0.93" />
                <text x={tx} y={dotY-47} textAnchor="middle" fontSize="10" fill="#94a3b8" fontWeight="700">MONTH {hov.month} · {hov.phase.toUpperCase()}</text>
                <text x={tx} y={dotY-28} textAnchor="middle" fontSize="14" fill="#fff" fontWeight="800">{money.format(hov.cumulativeRevenue)}</text>
              </g>
            );
          })()}
        </svg>
        <div style={{ display:"flex", gap:14, marginTop:6, fontSize:11, color:"#64748b", flexWrap:"wrap" }}>
          <span><span style={{ display:"inline-block", width:9, height:9, borderRadius:"50%", background:FT_GREEN, marginRight:4, verticalAlign:"middle" }} />Front (Mo 1–4): 100% net</span>
          <span><span style={{ display:"inline-block", width:9, height:9, borderRadius:"50%", background:FT_BLUE, marginRight:4, verticalAlign:"middle" }} />Tail-End (Mo 5+): 35% net</span>
          {breakEvenMonth&&<span><span style={{ display:"inline-block", width:9, height:9, borderRadius:"50%", background:FT_AMBER, marginRight:4, verticalAlign:"middle" }} />CS breaks even after Month {breakEvenMonth} vs LD after Month 2</span>}
          {liabilityClearMonth&&liabilityClearMonth<=timeline.length&&(
            <span style={{ color:FT_HYPER, fontWeight:800 }}>
              <span style={{ display:"inline-block", width:9, height:9, borderRadius:"50%", background:FT_HYPER, marginRight:4, verticalAlign:"middle", boxShadow:`0 0 6px ${FT_HYPER}` }} />
              Break-Even + Fully Liability-Clear (Mo {liabilityClearMonth})
            </span>
          )}
          <span style={{ color:FT_GREEN_DARK, fontWeight:700 }}>↑ Hover dots for cumulative revenue</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PAYOUT + LIABILITY
// ─────────────────────────────────────────────

function PayoutLiabilityAccordion() {
  const rows = [
    { event:"Expected Funds Hit Bank", ld:"Month 3 (20th)", cs:"Month +1 per payment",
      detail:"LD: Payment 1 = Jan 1, Payment 2 = Feb 1 → payout March 20. CS: each payment hits your bank ~1 month after processing." },
    { event:"Chargeback Liability Free", ld:"After Payment 2", cs:"Each payment: Month +4",
      detail:"LD: zero liability after 2 cleared payments. CS: each payment has its own 4-month window — they do not clear together." },
    { event:"ACH Return Window", ld:"~60 days (Nacha)", cs:"~60 days per payment",
      detail:"Funding Tier models 4 months as a conservative internal buffer. Real Nacha window is ~60 calendar days per payment." },
  ];
  return (
    <Accordion title="Payout + Liability Timing — Level Debt vs Consumer Shield">
      <div style={{ overflowX:"auto", borderRadius:12, border:"1px solid #e2e8f0" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead><tr style={{ background:"#f8fafc" }}>{["Timing Event","Level Debt","Consumer Shield","Notes"].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((row,i)=>(
              <tr key={i} style={{ background:i%2?"#f8fafc":"#fff" }}>
                <td style={{ ...TD, fontWeight:700 }}>{row.event}</td>
                <td style={{ ...TD, color:FT_GREEN_DARK, fontWeight:700 }}>{row.ld}</td>
                <td style={{ ...TD, color:FT_BLUE, fontWeight:700 }}>{row.cs}</td>
                <td style={{ ...TD, color:"#64748b", lineHeight:1.6 }}>{row.detail}</td>
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

function ProgramChart({ program }: { program:ConsumerShieldProgram }) {
  const [hov, setHov] = useState<{month:number;rev:number;x:number;y:number}|null>(null);
  const net=program.payment-40;
  const pts=Array.from({length:program.term},(_,i)=>({month:i+1,y:csRevenueAt(i+1,net,program.term)}));
  const maxY=Math.max(...pts.map(p=>p.y),1);
  const W=700,H=240,PL=90,PB=40,PT=22,PR=24;
  const gx=(i:number)=>PL+(i/Math.max(pts.length-1,1))*(W-PL-PR);
  const gy=(v:number)=>H-PB-(v/maxY)*(H-PT-PB);
  const coords=pts.map((p,i)=>`${gx(i)},${gy(p.y)}`).join(" ");
  const notable=new Set([1,4,program.term]);

  return (
    <div style={{ overflowX:"auto", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:14, padding:"12px 10px 8px" }}>
      <svg width={W} height={H} style={{ minWidth:W, display:"block" }} onMouseLeave={()=>setHov(null)}>
        {[0,0.25,0.5,0.75,1].map((t,i)=>{
          const yv=H-PB-t*(H-PT-PB);
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
        {pts.map((p,i)=>{
          const x=gx(i),y=gy(p.y),isH=hov?.month===p.month,isN=notable.has(p.month);
          return <g key={p.month}>
            <circle cx={x} cy={y} r={11} fill="transparent" style={{cursor:"pointer"}} onMouseEnter={()=>setHov({month:p.month,rev:p.y,x,y})} />
            <circle cx={x} cy={y} r={isH?8:isN?5.5:3.5} fill={isH||isN?FT_GREEN_DARK:FT_GREEN} stroke={isH?"#fff":"none"} strokeWidth="2" style={{pointerEvents:"none"}} />
            {isN&&<text x={x} y={H-PB+16} textAnchor="middle" fontSize="10" fill={FT_GREEN} fontWeight="700">{p.month}</text>}
            {p.month===program.term&&<text x={x} y={y-14} textAnchor="middle" fontSize="11" fill={FT_GREEN_DARK} fontWeight="900">{money.format(p.y)}</text>}
          </g>;
        })}
        {hov&&(()=>{
          const tx=Math.min(Math.max(hov.x,68),W-68),ty=Math.max(hov.y-56,4);
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
  program:ConsumerShieldProgram; open:boolean; onToggle:()=>void;
}) {
  const net=program.payment-40,front=round2(net*Math.min(4,program.term));
  const tail=round2(net*0.35),fullRev=round2(front+Math.max(0,program.term-4)*tail);
  return (
    <div style={{ border:"1px solid #e2e8f0", borderRadius:16, overflow:"hidden", background:"#fff" }}>
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
      {open&&(
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

function KnowledgeBase({ open, onClose }: { open:boolean; onClose:()=>void }) {
  if (!open) return null;
  return (
    <div style={{ position:"fixed", right:20, bottom:88, width:430,
      maxWidth:"calc(100vw - 24px)", maxHeight:"72vh", zIndex:999, background:"#fff",
      border:"1px solid #dbeafe", borderRadius:18, boxShadow:"0 20px 40px rgba(15,23,42,0.22)",
      display:"flex", flexDirection:"column" }}>
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
          ["CS Survival Funnel", `Each slider = % of ALL Consumer Shield deals reaching that milestone (cumulative, cascading).\n\nIf 25% complete, those same 25% also cleared break-even, P4, and P2.\n\nExpected Revenue = (P2-P4)% × rev2 + (P4-BE)% × rev4 + (BE-Comp)% × revBE + Comp% × fullRev`],
          ["CS Lead Quality", `Scales all effective CS survival rates.\nFormula: effectiveRate = setRate × (0.35 + 0.65 × quality/100)\n\nAt 100%: unchanged. At 50%: ×0.68. At 0%: ×0.35 floor.`],
          ["Cash Urgency + Stability Adjustment", `Cash urgency sets your base routing split for deals above $7k.\nRecommended LD% = 20 + (adjustedUrgency × 0.65)\n\nThe system auto-adds a stability penalty when CS survival rates are poor:\n• Low CS completion (<30%) → up to +25pt\n• Low CS P2 rate (<50%) → up to +15pt\n• High funnel drop-off → up to +10pt\n\nThis ensures that when your CS book is struggling, more deals route to Level Debt to protect cash flow stability — automatically.`],
          ["Under $7k Rule", "Level Debt does not accept enrolled debt below $7,000. These deals are CS-only. Enforced throughout the tool."],
          ["Revenue Contribution Per Cohort", `Each cohort = group of CS deals that dropped out at a specific funnel stage.\n\nCalculation:\n• Cohort % = difference between adjacent funnel stages (e.g. P2% − P4%)\n• Revenue per deal = cumulative CS revenue at that exit point\n• Contribution = cohort % × revenue per deal\n\nSumming all cohorts = total Expected CS Revenue per deal.`],
          ["Break-Even + Liability Clear (Hyper Green)", "First month where CS has both (a) broken even vs Level Debt AND (b) the chargeback window on the break-even payment has closed. The true zero-risk inflection point."],
          ["Level Debt", "Revenue = 8% of enrolled debt. After 2 cleared payments, Funding Tier is free and clear of chargeback liability. Payout on the 20th of Month 3."],
        ].map(([title,body],i)=>(
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
  const [portfolioLevelMixPct, setPortfolioLevelMixPct] = useState(53); // default matches 50% urgency
  const [kbOpen,               setKbOpen]               = useState(false);
  const [openProgram,          setOpenProgram]          = useState<string|null>("CS Program A");

  const handleFunnelChange = useCallback((np2:number,np4:number,nbe:number,ncomp:number)=>{
    setP2Pct(np2); setP4Pct(np4); setBePct(nbe); setCompPct(ncomp);
  },[]);

  // Compute effective rates first so stability calc can use them
  const [ep2Raw, ep4Raw, ebeRaw, ecompRaw] = applyLeadQuality(p2Pct, p4Pct, bePct, compPct, leadQuality);

  // Stability-adjusted urgency
  const stability = useMemo(() =>
    calcStabilityAdjustedUrgency(cashUrgency, ep2Raw, ep4Raw, ebeRaw, ecompRaw),
  [cashUrgency, ep2Raw, ep4Raw, ebeRaw, ecompRaw]);

  const routing = cashUrgencyToRouting(stability.adjusted);

  const deal = useMemo(() => calculateDealMetrics({
    debtAmount, p2Pct, p4Pct, bePct, compPct, leadQuality,
    adjustedUrgency: stability.adjusted,
  }), [debtAmount, p2Pct, p4Pct, bePct, compPct, leadQuality, stability.adjusted]);

  const repEcon = useMemo(() => {
    const ldCost = round2(debtAmount * (levelRepPct / 100));
    const csCost = round2(csRepUpfront + csRepAfter4 * (deal.effectiveP4 / 100));
    return { ldCost, csCost,
             ldNet: round2(deal.levelDebtRevenue - ldCost),
             csNet: round2((deal.consumerShieldExpectedRevenue ?? 0) - csCost) };
  }, [debtAmount, levelRepPct, csRepUpfront, csRepAfter4, deal]);

  // Determine if portfolio routing matches urgency recommendation
  const effectiveLDPct = portfolioAvgDebt < 7000 ? 0 : portfolioLevelMixPct;
  const routingMatchesRecommendation = Math.abs(effectiveLDPct - routing.ldPct) <= 2;

  const handleApplyUrgencyRouting = () => {
    if (portfolioAvgDebt >= 7000) setPortfolioLevelMixPct(routing.ldPct);
  };

  const portfolio = useMemo(() => {
    const eLDPct  = portfolioAvgDebt < 7000 ? 0 : portfolioLevelMixPct;
    const ldCount = Math.round(portfolioDeals * eLDPct / 100);
    const csCount = portfolioDeals - ldCount;
    const avg     = calculateDealMetrics({ debtAmount:portfolioAvgDebt, p2Pct, p4Pct, bePct, compPct, leadQuality, adjustedUrgency:stability.adjusted });
    const ldGross  = round2(ldCount * avg.levelDebtRevenue);
    const csGross  = round2(csCount * (avg.consumerShieldExpectedRevenue ?? 0));
    const csUpside = round2(csCount * (avg.consumerShieldRevenueAtFull ?? 0));
    const ldRep    = round2(ldCount * portfolioAvgDebt * (levelRepPct / 100));
    const csRep    = round2(csCount * (csRepUpfront + csRepAfter4 * (avg.effectiveP4 / 100)));
    return { ldCount, csCount, ldGross, csGross, csUpside, ldRep, csRep, eLDPct,
             totalGross: round2(ldGross + csGross), totalRep: round2(ldRep + csRep),
             totalNet: round2(ldGross + csGross - ldRep - csRep) };
  }, [portfolioDeals, portfolioLevelMixPct, portfolioAvgDebt, p2Pct, p4Pct, bePct, compPct,
      leadQuality, stability.adjusted, levelRepPct, csRepUpfront, csRepAfter4]);

  const recLogo = deal.recommendedBackend.startsWith("Consumer Shield") ? CS_LOGO
                : deal.recommendedBackend === "Level Debt" ? LEVEL_DEBT_LOGO : null;

  const prog    = getProgram(debtAmount);
  const net     = prog ? prog.payment - 40 : 0;
  const termLen = prog ? prog.term : 0;
  const rev2v   = deal.consumerShieldRevenueAfter2 ?? 0;
  const rev4v   = deal.consumerShieldRevenueAfter4 ?? 0;
  const beM     = deal.consumerShieldBreakEvenMonthVsLevel;
  const revBEv  = beM ? csRevenueAt(beM, net, termLen) : 0;
  const fullRv  = deal.consumerShieldRevenueAtFull ?? 0;

  const WL = ({ ch }: { ch:string }) => (
    <div style={{ fontSize:9, fontWeight:700, color:"#94a3b8", marginBottom:3,
      textTransform:"uppercase", letterSpacing:0.4 }}>{ch}</div>
  );

  return (
    <div style={{ minHeight:"100vh", background:FT_BG, color:"#0f172a",
      fontFamily:'Inter, Arial, Helvetica, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif' }}>

      <KnowledgeBase open={kbOpen} onClose={() => setKbOpen(false)} />

      <button onClick={() => setKbOpen(true)} style={{ position:"fixed", right:20, bottom:20, zIndex:1000,
        border:"none", borderRadius:999, background:FT_GREEN, color:"#fff", padding:"11px 16px",
        fontWeight:800, fontSize:13, boxShadow:"0 10px 28px rgba(15,157,138,0.35)", cursor:"pointer" }}>
        Legend / Knowledge Base
      </button>

      {/* STICKY HEADER */}
      <div style={{ position:"sticky", top:0, zIndex:50,
        background:"rgba(248,250,252,0.97)", backdropFilter:"blur(10px)",
        borderBottom:"1px solid #e2e8f0" }}>
        <div style={{ maxWidth:1380, margin:"0 auto", padding:"8px 16px" }}>
          <div style={{ background:"linear-gradient(135deg,#0f172a 0%,#0b3b50 45%,#0f766e 100%)",
            borderRadius:16, padding:"10px 18px", boxShadow:"0 8px 24px rgba(15,23,42,0.18)" }}>
            <div style={{ display:"flex", alignItems:"flex-start", gap:12, flexWrap:"wrap" }}>

              <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0, alignSelf:"center" }}>
                <img src={FT_LOGO} alt="Funding Tier" style={{ height:28, width:"auto" }} />
                <span style={{ fontWeight:900, fontSize:20, color:"#fff", letterSpacing:"-0.5px", whiteSpace:"nowrap" }}>Profit Engine</span>
              </div>
              <div style={{ width:1, height:36, background:"rgba(255,255,255,0.2)", flexShrink:0, alignSelf:"center" }} />

              <div style={{ flexShrink:0, alignSelf:"flex-end" }}>
                <WL ch="Enrolled Debt" />
                <input type="number" value={debtAmount} onChange={e => setDebtAmount(Number(e.target.value))}
                  min={0} step={100}
                  style={{ width:108, padding:"6px 9px", borderRadius:8,
                    border:"1px solid rgba(255,255,255,0.2)", fontSize:14,
                    color:"#000", fontWeight:800, background:"#fff", boxSizing:"border-box" }} />
                {debtAmount > 0 && debtAmount < 7000 && (
                  <div style={{ fontSize:9, color:FT_AMBER, fontWeight:700, marginTop:2 }}>⚠ CS only — under $7k</div>
                )}
              </div>
              <div style={{ width:1, height:36, background:"rgba(255,255,255,0.2)", flexShrink:0, alignSelf:"center" }} />

              <div style={{ flex:1, minWidth:300 }}>
                <div style={{ fontSize:9, fontWeight:800, color:"#94a3b8", marginBottom:4,
                  textTransform:"uppercase", letterSpacing:0.4 }}>
                  CS Deal Survival Funnel — % of all CS deals reaching each milestone (auto-cascading)
                </div>
                <CascadingFunnel p2={p2Pct} p4={p4Pct} be={bePct} comp={compPct} onChange={handleFunnelChange} />
              </div>
              <div style={{ width:1, height:36, background:"rgba(255,255,255,0.2)", flexShrink:0, alignSelf:"center" }} />

              <div style={{ minWidth:90, flexShrink:0 }}>
                <WL ch="CS Lead Quality" />
                <input type="range" min={0} max={100} step={1} value={leadQuality}
                  onChange={e => setLeadQuality(Number(e.target.value))}
                  style={{ width:"100%", accentColor:leadQuality>=70?FT_GREEN:leadQuality>=40?FT_AMBER:FT_RED }} />
                <div style={{ fontSize:11, fontWeight:800, marginTop:1,
                  color:leadQuality>=70?FT_GREEN:leadQuality>=40?FT_AMBER:FT_RED }}>{leadQuality}%</div>
              </div>

              <div style={{ minWidth:120, flexShrink:0 }}>
                <WL ch="Cash Urgency" />
                <input type="range" min={0} max={100} step={1} value={cashUrgency}
                  onChange={e => setCashUrgency(Number(e.target.value))}
                  style={{ width:"100%", accentColor:FT_AMBER }} />
                <div style={{ fontSize:10, fontWeight:700, color:FT_AMBER, marginTop:1 }}>
                  {cashUrgency}%{stability.penalty > 0 ? ` → ${stability.adjusted}% (adj)` : ""}
                </div>
                <div style={{ fontSize:9, color:"#94a3b8", marginTop:1 }}>Route {routing.ldPct}% LD / {100-routing.ldPct}% CS</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ maxWidth:1380, margin:"0 auto", padding:"18px 16px 60px", display:"grid", gap:18 }}>

        {/* Top 4 */}
        <div className="grid-4">
          <div style={{ ...card, position:"relative" }}>
            {recLogo && <img src={recLogo} alt="" style={{ position:"absolute", top:12, left:12, height:22, width:"auto", objectFit:"contain", opacity:0.85 }} />}
            <div style={{ fontSize:11, fontWeight:700, color:"#64748b", marginBottom:7,
              textTransform:"uppercase", letterSpacing:0.4, marginTop:recLogo?28:0 }}>Recommended Backend</div>
            <div style={{ fontSize:deal.recommendedBackend.length>20?16:22, fontWeight:800, color:"#0f172a", lineHeight:1.2, wordBreak:"break-word" }}>
              {deal.recommendedBackend}
            </div>
            <div style={{ fontSize:12, color:"#64748b", marginTop:7, lineHeight:1.5 }}>{deal.recommendationReason}</div>
          </div>
          <MetricCard title="Level Debt Revenue"
            value={deal.levelDebtEligible ? money.format(deal.levelDebtRevenue) : "Not Eligible"}
            subtitle={!deal.levelDebtEligible ? "Under $7k — Level Debt cannot accept this deal"
              : deal.levelDebtRevShareEligible ? "120k+ flagged for additional rev share"
              : "Base 8% — guaranteed after 2 payments"} />
          <MetricCard title="CS Expected Revenue"
            value={money.format(deal.consumerShieldExpectedRevenue ?? 0)}
            subtitle={`Effective rates (${leadQuality}% LQ): P2=${deal.effectiveP2}% P4=${deal.effectiveP4}% BE=${deal.effectiveBE}% Comp=${deal.effectiveComp}%`} />
          <MetricCard title="Break-Even Month"
            value={deal.consumerShieldBreakEvenMonthVsLevel ? `Month ${deal.consumerShieldBreakEvenMonthVsLevel}` : deal.levelDebtEligible ? "N/A" : "CS Only Deal"}
            subtitle="When CS cumulative revenue catches Level Debt 8%" />
        </div>

        {/* Cash Urgency */}
        <CashUrgencyPanel
          urgency={cashUrgency}
          onChange={v => setCashUrgency(v)}
          adjustedUrgency={stability.adjusted}
          stabilityPenalty={stability.penalty}
          stabilityReason={stability.reason}
          routing={routing}
          debtAmount={debtAmount}
        />

        {/* Lead Quality */}
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
              {!deal.levelDebtEligible && <span style={{ fontSize:11, fontWeight:800, color:FT_RED, background:FT_RED+"11", padding:"2px 8px", borderRadius:99 }}>Not eligible — under $7k</span>}
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
                tooltip={`${money.format(deal.consumerShieldPayment ?? 0)} program payment minus $40 servicing = ${money.format(deal.consumerShieldNetPayment ?? 0)} net. Base amount before the 100% (months 1–4) or 35% (month 5+) split.`} />
              <MetricCard title="Front Revenue" value={money.format(deal.consumerShieldFrontRevenue ?? 0)} inlineTag="Months 1 through 4" />
              <MetricCard title="Tail End – Revenue" value={money.format(deal.consumerShieldBackRevenueMonthly ?? 0)} inlineTag="Per month from month 5+" />
            </div>
          </div>
        </div>

        {/* Funnel explainer */}
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
          <h2 style={{ margin:"0 0 6px", fontSize:18, fontWeight:800, color:"#0f172a" }}>Consumer Shield Offerings / Retention Scenarios</h2>
          <div style={{ fontSize:13, color:"#64748b", lineHeight:1.6, marginBottom:14 }}>
            Expand each offering for the full revenue breakdown and interactive revenue curve.
          </div>
          <div style={{ display:"grid", gap:10 }}>
            {consumerShieldPrograms.map(prog => (
              <ProgramAccordion key={prog.label} program={prog}
                open={openProgram===prog.label}
                onToggle={() => setOpenProgram(c => c===prog.label ? null : prog.label)} />
            ))}
          </div>
        </div>

        {/* Monthly Revenue Timeline */}
        <Accordion title="Consumer Shield Monthly Revenue Timeline" defaultOpen={false}>
          <div style={{ overflowX:"auto", borderRadius:13, border:"1px solid #e2e8f0" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead><tr style={{ background:"#f1f5f9" }}>
                {["Month","Phase","Monthly Revenue","Cumulative Revenue","Assumed Funds Hit","Liability Clears"].map(h=><th key={h} style={TH}>{h}</th>)}
              </tr></thead>
              <tbody>
                {deal.consumerShieldTimeline.map(row=>{
                  const isBE=row.month===deal.consumerShieldBreakEvenMonthVsLevel;
                  const isLC=row.month===deal.consumerShieldLiabilityClearMonth;
                  const is1=row.month===1,is4=row.month===4;
                  const isMile=isBE||isLC||is1||is4;
                  const rowBg=isLC?FT_HYPER+"22":isBE?FT_AMBER+"22":is1||is4?FT_GREEN+"11":row.month%2?"#f8fafc":"#fff";
                  return (
                    <tr key={row.month} style={{ background:rowBg }}>
                      <td style={{ ...TD, fontWeight:isMile?800:400 }}>
                        {row.month}
                        {is1&&<span style={{ marginLeft:6, fontSize:10, background:FT_GREEN+"22", color:FT_GREEN_DARK, fontWeight:700, padding:"1px 6px", borderRadius:99 }}>Start</span>}
                        {is4&&<span style={{ marginLeft:6, fontSize:10, background:FT_GREEN+"22", color:FT_GREEN_DARK, fontWeight:700, padding:"1px 6px", borderRadius:99 }}>Front Close</span>}
                        {isBE&&<span style={{ marginLeft:6, fontSize:10, background:FT_AMBER+"33", color:FT_AMBER, fontWeight:800, padding:"1px 6px", borderRadius:99 }}>Break-Even</span>}
                        {isLC&&<span style={{ marginLeft:6, fontSize:10, background:FT_HYPER+"33", color:FT_GREEN_DARK, fontWeight:800, padding:"1px 6px", borderRadius:99 }}>Liability Clear</span>}
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
            ].map(f=>(
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

          {/* Urgency recommendation banner with APPLY button */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12,
            background: routingMatchesRecommendation ? FT_GREEN+"11" : FT_AMBER+"11",
            border:`1px solid ${routingMatchesRecommendation ? FT_GREEN+"44" : FT_AMBER+"44"}`,
            borderRadius:12, padding:"12px 16px", marginBottom:16 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:routingMatchesRecommendation ? FT_GREEN_DARK : "#92400e" }}>
                {routingMatchesRecommendation
                  ? `✓ Portfolio routing matches the stability-adjusted recommendation (${routing.ldPct}% LD / ${100-routing.ldPct}% CS) for the ${routing.horizon} cash horizon.`
                  : `⚠ Portfolio routing (${effectiveLDPct}% LD) does not match the stability-adjusted recommendation (${routing.ldPct}% LD / ${100-routing.ldPct}% CS) for the ${routing.horizon} cash horizon.`}
              </div>
              <div style={{ fontSize:12, color:"#64748b", marginTop:4, lineHeight:1.5 }}>
                {routing.rationale}
                {stability.penalty > 0 && ` Stability adjustment of +${stability.penalty}pt applied due to CS survival rate pressure.`}
              </div>
            </div>
            {portfolioAvgDebt >= 7000 && (
              <button
                onClick={handleApplyUrgencyRouting}
                style={{
                  flexShrink: 0,
                  padding: "10px 18px",
                  borderRadius: 10,
                  border: "none",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: routingMatchesRecommendation ? "default" : "pointer",
                  background: routingMatchesRecommendation ? "#e2e8f0" : FT_AMBER,
                  color: routingMatchesRecommendation ? "#94a3b8" : "#fff",
                  boxShadow: routingMatchesRecommendation ? "none" : "0 4px 14px rgba(245,158,11,0.4)",
                  transition: "all 0.2s",
                  opacity: routingMatchesRecommendation ? 0.7 : 1,
                }}>
                {routingMatchesRecommendation ? "✓ APPLIED" : "ADJUST FOR CASH URGENCY NEEDED"}
              </button>
            )}
            {portfolioAvgDebt < 7000 && (
              <div style={{ fontSize:11, fontWeight:800, color:FT_RED }}>⛔ All deals must go to CS (under $7k)</div>
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
                % Routed to Level Debt
                {portfolioAvgDebt < 7000 && <span style={{ color:FT_RED, fontWeight:800, marginLeft:6 }}>(forced 0%)</span>}
                {!routingMatchesRecommendation && portfolioAvgDebt >= 7000 && (
                  <span style={{ color:FT_AMBER, fontWeight:700, marginLeft:6, fontSize:11 }}>
                    Rec: {routing.ldPct}%
                  </span>
                )}
              </div>
              <input type="range" min={0} max={100} step={1}
                value={portfolioAvgDebt < 7000 ? 0 : portfolioLevelMixPct}
                onChange={e => { if (portfolioAvgDebt >= 7000) setPortfolioLevelMixPct(Number(e.target.value)); }}
                disabled={portfolioAvgDebt < 7000}
                style={{ width:"100%", accentColor:routingMatchesRecommendation ? FT_GREEN : FT_AMBER,
                  opacity: portfolioAvgDebt < 7000 ? 0.4 : 1 }} />
              <div style={{ fontSize:12, fontWeight:700, color:routingMatchesRecommendation ? FT_GREEN_DARK : FT_AMBER, marginTop:3 }}>
                {portfolioAvgDebt < 7000 ? "0" : portfolioLevelMixPct}%
              </div>
            </div>
          </div>

          <div className="grid-4" style={{ marginTop:16 }}>
            <MetricCard title="Level Debt Deals" value={String(portfolio.ldCount)} subtitle={`${percentFmt.format(portfolio.eLDPct/100)} of portfolio`} />
            <MetricCard title="Consumer Shield Deals" value={String(portfolio.csCount)} subtitle={`${percentFmt.format((100-portfolio.eLDPct)/100)} of portfolio`} />
            <MetricCard title="Expected Gross Revenue" value={money.format(portfolio.totalGross)} />
            <MetricCard title="Expected Net Revenue"   value={money.format(portfolio.totalNet)} />
          </div>

          <div style={{ marginTop:16, overflowX:"auto", border:"1px solid #e2e8f0", borderRadius:13 }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead><tr style={{ background:"#f1f5f9" }}>
                {["Metric","Level Debt Portion","Consumer Shield Portion","Combined"].map(h=><th key={h} style={TH}>{h}</th>)}
              </tr></thead>
              <tbody>
                {[
                  { label:"Deal Count", tip:"Total deals split by your routing allocation. Deals under $7k are forced to CS.",
                    ld:String(portfolio.ldCount), cs:String(portfolio.csCount), tot:String(portfolioDeals) },
                  { label:"Gross Revenue", tip:"LD = 8% × avg debt × deal count. CS = expected revenue (quality-adjusted) × CS deal count.",
                    ld:money.format(portfolio.ldGross), cs:money.format(portfolio.csGross), tot:money.format(portfolio.totalGross) },
                  { label:"Rep Cost", tip:"LD = enrolled debt × rep %. CS = (upfront + milestone × effective P4 rate) × CS deals.",
                    ld:money.format(portfolio.ldRep), cs:money.format(portfolio.csRep), tot:money.format(portfolio.totalRep) },
                  { label:"Net Revenue", tip:"Gross revenue minus total rep cost for each side.",
                    ld:money.format(portfolio.ldGross-portfolio.ldRep), cs:money.format(portfolio.csGross-portfolio.csRep), tot:money.format(portfolio.totalNet) },
                  { label:"CS Full-Upside Ref", tip:"CS revenue if every CS deal completed the full term. Ceiling only.",
                    ld:"—", cs:money.format(portfolio.csUpside), tot:money.format(portfolio.ldGross+portfolio.csUpside) },
                ].map((row,i)=>(
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
            ["Under $7k", "Level Debt will not accept enrolled debt below $7,000. These deals are Consumer Shield only — no routing decision needed. Enforced throughout this tool."],
            ["CS Survival Funnel", "Cascading rates — completing 25% means those 25% also cleared break-even, P4, and P2. Adjust based on your real observed rates as your book ages."],
            ["CS Lead Quality", "Degrades effective survival rates proportionally. Compare your actual P2 and P4 rates to your effective rates shown in the Lead Quality panel to validate your assumptions."],
            ["Cash Urgency + Stability", "Cash urgency sets your base routing intent. The stability adjustment automatically increases urgency when your CS survival rates are poor — protecting cash flow when CS revenue is unreliable. Use the 'ADJUST FOR CASH URGENCY NEEDED' button in Portfolio Forecast to snap the routing slider to the stability-adjusted recommendation."],
            ["Break-even + Liability Clear", "The hyper-green milestone is your true zero-risk inflection point — CS has both matched Level Debt economically AND the chargeback window on the break-even payment has closed."],
            ["Using this tool over time", "The real value compounds as you enter your actual observed P2, P4, and break-even survival rates instead of estimates. The routing recommendation and expected revenue numbers will self-correct as your inputs improve."],
          ].map(([b,rest],i)=>(
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
