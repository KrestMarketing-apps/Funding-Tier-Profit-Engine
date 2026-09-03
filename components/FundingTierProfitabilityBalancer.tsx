"use client";

import React, { useMemo, useState, useCallback } from "react";
import ToolShell, { ControlRow, Control, MetricsGrid, Metric } from "./ToolShell";
import {
  ELP_MIN_DEBT, ELP_FEE_MIN, ELP_FEE_MAX, ELP_MAINT_OPTIONS, ELP_TERM_MAX,
  ELP_BLOCKED_STATES, ELP_TIER_RATE_FILE_THRESHOLD,
  elpSchedule, elpRevenueAt, elpFullRevenue, elpBuildTimeline, elpBreakEven,
  elpRevenueAtFraction, elpExpectedRepCost, elpTierRateForFiles, getLcBand,
  elpMaxTerm, elpDraftForTerm, elpTermForDraft, ELP_DEFAULT_TARGET_TERM, ELP_TERM_MIN,
  type ElpSchedule, type ElpTerms,
} from "./legacyEngine";
import {
  ldProgram, LD_ESTIMATED_SETTLEMENT_RATE, LD_PROGRAM_FEE_ATTORNEY,
  LD_PROGRAM_FEE_STANDARD, LD_ATTORNEY_STATES, LD_MIN_DEPOSIT,
  LD_LEGAL_FEE_MONTHLY, LD_GATEWAY_FEE_MONTHLY, LD_GATEWAY_SETUP_FEE,
  LD_SPLIT_SURCHARGE_PER_PAYMENT, type LdProgram,
} from "./levelDebtEngine";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

type BackendKey = "LD" | "CS" | "ELP";

type TimelineRow = {
  month: number;
  phase: string;
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

type Funnel = { p2: number; p4: number; be: number; comp: number };
type Effective = { p2: number; p4: number; be: number; comp: number };

type BackendResult = {
  key: BackendKey;
  name: string;
  eligible: boolean;
  ineligibleReason: string;
  /** Expected (survival-weighted) revenue per deal. */
  expectedRevenue: number;
  /** Full-term ceiling. Same as expectedRevenue for Level Debt. */
  fullRevenue: number;
  /** Score used for the routing recommendation. */
  adjustedScore: number;
  breakEvenMonth: number | null;
  liabilityClearMonth: number | null;
  term: number;
  timeline: TimelineRow[];
  effective: Effective;
  repCost: number;
  netRevenue: number;
};

// ─────────────────────────────────────────────
// ASSETS & CONSTANTS
// ─────────────────────────────────────────────

const FT_LOGO         = "https://assets.cdn.filesafe.space/S4ztIlDxBovAboldwbOR/media/68783cf82035bab4d790ae7e.png";
const LEVEL_DEBT_LOGO = "https://assets.cdn.filesafe.space/S4ztIlDxBovAboldwbOR/media/69c35b2cab2203b0fc83186d.webp";
const CS_LOGO         = "https://assets.cdn.filesafe.space/S4ztIlDxBovAboldwbOR/media/69c35b2c25c6995d2d2d21fa.png";
const ELP_LOGO        = "https://assets.cdn.filesafe.space/S4ztIlDxBovAboldwbOR/media/69e1c95dc56ad279084b3141.png";

const FT_GREEN      = "#0f9d8a";
const FT_GREEN_DARK = "#0b7d6e";
const FT_HYPER      = "#00ff88";
const FT_BLUE       = "#1a6ed8";
const FT_CYAN       = "#0891b2";  // Elite Legal Practice / Legacy Capital
const FT_CYAN_DARK  = "#0e7490";
const FT_AMBER      = "#f59e0b";
const FT_RED        = "#ef4444";
const FT_BG         = "#f8fafc";

const BACKEND_META: Record<BackendKey, { name: string; short: string; service: string; logo: string; color: string; colorDark: string; minDebt: number }> = {
  LD:  { name: "Level Debt",           short: "LD",  service: "Settlement", logo: LEVEL_DEBT_LOGO, color: FT_GREEN, colorDark: FT_GREEN_DARK, minDebt: 7000 },
  ELP: { name: "Elite Legal Practice", short: "ELP", service: "Resolution", logo: ELP_LOGO,        color: FT_CYAN,  colorDark: FT_CYAN_DARK,  minDebt: ELP_MIN_DEBT },
  CS:  { name: "Consumer Shield",      short: "CS",  service: "Validation", logo: CS_LOGO,         color: FT_BLUE,  colorDark: "#1552a8",     minDebt: 4000 },
};

/** Display order everywhere: settlement, resolution, validation. */
const BACKEND_ORDER: BackendKey[] = ["LD", "ELP", "CS"];

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

function csBuildTimeline(net: number, term: number): TimelineRow[] {
  return Array.from({ length: term }, (_, i) => {
    const month = i + 1;
    return {
      month,
      phase: month <= 4 ? "Front" : "Tail-End Revenue",
      monthlyRevenue: round2(month <= 4 ? net : net * 0.35),
      cumulativeRevenue: csRevenueAt(month, net, term),
      liabilityFreeMonth: month + 4,
      payoutHitMonthAssumed: month + 1,
    };
  });
}

function csBreakEven(ldRev: number, net: number, term: number) {
  if (ldRev <= 0) return null;
  for (let m = 1; m <= term; m++) if (csRevenueAt(m, net, term) >= ldRev) return m;
  return null;
}

/**
 * Lead quality degrades effective survival rates.
 * effectiveRate = baseRate × (0.35 + 0.65 × quality/100)
 * Cascade enforced after applying the scalar.
 */
function applyLeadQuality(f: Funnel, quality: number): Effective {
  const scalar = 0.35 + 0.65 * (quality / 100);
  const p2   = round2(f.p2 * scalar);
  const p4   = round2(Math.min(f.p4 * scalar, p2));
  const be   = round2(Math.min(f.be * scalar, p4));
  const comp = round2(Math.min(f.comp * scalar, be));
  return { p2, p4, be, comp };
}

function calcExpectedRevenue(e: Effective, rev2: number, rev4: number, revBE: number, fullRev: number): number {
  return round2(
    (e.p2 - e.p4) / 100 * rev2
    + (e.p4 - e.be) / 100 * rev4
    + (e.be - e.comp) / 100 * revBE
    + e.comp / 100 * fullRev
  );
}

/**
 * STABILITY-ADJUSTED URGENCY
 *
 * Both perpetuity backends (Consumer Shield and Elite Legal Practice) earn out
 * over time, so when either book is churning the company's near-term cash is
 * unreliable and urgency should rise. The penalty is computed against the
 * unweighted mean of the two effective funnels — deliberately independent of
 * the portfolio routing sliders, so the recommendation never chases itself.
 */
function blendPerpetuityRates(cs: Effective, elp: Effective): Effective {
  return {
    p2:   round2((cs.p2 + elp.p2) / 2),
    p4:   round2((cs.p4 + elp.p4) / 2),
    be:   round2((cs.be + elp.be) / 2),
    comp: round2((cs.comp + elp.comp) / 2),
  };
}

function calcStabilityAdjustedUrgency(baseUrgency: number, e: Effective): { adjusted: number; penalty: number; reason: string } {
  const completionPenalty = e.comp < 50 ? round2((50 - e.comp) * 0.5) : 0;
  const p2Penalty         = e.p2  < 50 ? round2((50 - e.p2) * 0.3)   : 0;
  const funnelLeak        = round2(e.p2 - e.comp);
  const funnelPenalty     = funnelLeak > 50 ? round2((funnelLeak - 50) * 0.15) : 0;

  const totalPenalty = Math.round(completionPenalty + p2Penalty + funnelPenalty);
  const adjusted = clamp(baseUrgency + totalPenalty, 0, 100);

  let reason = "";
  if (totalPenalty === 0) {
    reason = "Blended CS + ELP survival rates are healthy — no stability adjustment needed.";
  } else {
    const parts: string[] = [];
    if (completionPenalty > 0) parts.push(`low blended completion (${e.comp}%) +${Math.round(completionPenalty)}pt`);
    if (p2Penalty > 0)         parts.push(`low blended P2 rate (${e.p2}%) +${Math.round(p2Penalty)}pt`);
    if (funnelPenalty > 0)     parts.push(`high funnel drop-off (${funnelLeak}pp gap) +${Math.round(funnelPenalty)}pt`);
    reason = `Stability adjustment +${totalPenalty}pt due to: ${parts.join("; ")}. Routing more deals to Level Debt protects near-term cash flow.`;
  }
  return { adjusted, penalty: totalPenalty, reason };
}

/**
 * Cash urgency → recommended routing across all three backends.
 *
 * Level Debt's share is driven purely by how fast cash is needed:
 *   ldPct = 20 + (adjustedUrgency × 0.65)
 *
 * Whatever is left is split between the two perpetuity backends in proportion
 * to their adjusted expected value at the portfolio's average deal — so the
 * stronger long-tail product wins the larger share of the tail allocation.
 */
function cashUrgencyToRouting(adjustedUrgency: number, csScore: number, elpScore: number, csEligible: boolean, elpEligible: boolean): {
  ldPct: number; csPct: number; elpPct: number; horizon: string; rationale: string;
} {
  let ldPct = Math.round(20 + adjustedUrgency * 0.65);
  const tail = 100 - ldPct;

  let csPct: number, elpPct: number;
  if (csEligible && elpEligible) {
    const total = csScore + elpScore;
    csPct  = total > 0 ? Math.round(tail * (csScore / total)) : Math.round(tail / 2);
    elpPct = tail - csPct;
  } else if (csEligible)  { csPct = tail; elpPct = 0; }
  else if (elpEligible)   { csPct = 0;    elpPct = tail; }
  else                    { csPct = 0;    elpPct = 0; ldPct = 100; }

  let horizon = "", rationale = "";
  if (adjustedUrgency >= 90)      { horizon = "~90 days";      rationale = "Maximum Level Debt routing. Neither perpetuity backend breaks even inside your cash window."; }
  else if (adjustedUrgency >= 65) { horizon = "~120–150 days"; rationale = "Heavily weighted to Level Debt. Reserve the perpetuity allocation for high-quality deals only."; }
  else if (adjustedUrgency >= 40) { horizon = "~180 days";     rationale = "Balanced. Level Debt funds operations while CS and ELP build a long-tail revenue stack."; }
  else if (adjustedUrgency >= 20) { horizon = "~270 days";     rationale = "Lean into the perpetuity backends. You have enough runway to let back-end revenue materialize."; }
  else                            { horizon = "No near-term constraint"; rationale = "Maximize long-term LTV across CS and ELP. Use Level Debt as a cash buffer floor only."; }

  const tailNote = csEligible && elpEligible
    ? ` Tail allocation splits ${csPct}% CS / ${elpPct}% ELP on adjusted expected value.`
    : "";

  return { ldPct, csPct, elpPct, horizon, rationale: rationale + tailNote };
}

// ─────────────────────────────────────────────
// CORE ANALYSIS — ALL THREE BACKENDS, ONE DEAL
// ─────────────────────────────────────────────

export type DealAnalysisArgs = {
  debtAmount: number;
  csFunnel: Funnel; csLeadQuality: number;
  elpFunnel: Funnel; elpLeadQuality: number;
  elpTerms: ElpTerms;
  /** Attorney-model states carry the higher Level Debt program fee. */
  ldAttorneyModel: boolean;
  /** Semi-monthly drafting adds a per-draft surcharge to the client payment. */
  ldSplitPayments: boolean;
  adjustedUrgency: number;
  levelRepPct: number;
  csRepUpfront: number; csRepAfter4: number;
};

export type DealAnalysis = {
  debtAmount: number;
  ld: BackendResult & { grossRevenue: number; program: LdProgram };
  cs: BackendResult & { program: ConsumerShieldProgram | null; payment: number; netPayment: number; frontRevenue: number; tailMonthly: number; revAfter2: number; revAfter4: number; revAtHalf: number; breakEvenRefMonth: number; breakEvenRefRevenue: number };
  elp: BackendResult & { schedule: ElpSchedule; revAfter2: number; revAfter4: number; revAtHalf: number; bandLabel: string; breakEvenRefMonth: number; breakEvenRefRevenue: number };
  ranked: BackendResult[];
  recommended: BackendKey | null;
  recommendedLabel: string;
  recommendationReason: string;
};

function analyzeDeal(a: DealAnalysisArgs): DealAnalysis {
  const debt = a.debtAmount;
  const urgencyBias = a.adjustedUrgency / 100;

  // ── Level Debt ────────────────────────────────────────────
  const ldEligible = debt >= BACKEND_META.LD.minDebt;
  const ldRev  = ldEligible ? round2(debt * 0.08) : 0;
  const ldRep  = ldEligible ? round2(debt * (a.levelRepPct / 100)) : 0;
  const ldScore = ldEligible ? ldRev * (1 + urgencyBias * 0.6) : -1;
  const ldProg  = ldProgram(debt, a.ldAttorneyModel, a.ldSplitPayments);

  const ld = {
    key: "LD" as const, name: BACKEND_META.LD.name,
    eligible: ldEligible,
    ineligibleReason: ldEligible ? "" : "Level Debt will not accept enrolled debt below $7,000.",
    grossRevenue: ldRev, program: ldProg,
    expectedRevenue: ldRev, fullRevenue: ldRev,
    adjustedScore: ldScore,
    breakEvenMonth: ldEligible ? 2 : null,
    liabilityClearMonth: ldEligible ? 2 : null,
    term: ldEligible ? ldProg.term : 0,
    timeline: [] as TimelineRow[],
    effective: { p2: 100, p4: 100, be: 100, comp: 100 },
    repCost: ldRep,
    netRevenue: round2(ldRev - ldRep),
  };

  // ── Consumer Shield ───────────────────────────────────────
  const csEff  = applyLeadQuality(a.csFunnel, a.csLeadQuality);
  const prog   = getProgram(debt);
  const csNet  = prog ? prog.payment - 40 : 0;
  const csTerm = prog ? prog.term : 0;
  const csTimeline  = prog ? csBuildTimeline(csNet, csTerm) : [];
  const csRev2      = prog ? csRevenueAt(2, csNet, csTerm) : 0;
  const csRev4      = prog ? csRevenueAt(4, csNet, csTerm) : 0;
  const csFront     = prog ? round2(csNet * Math.min(4, csTerm)) : 0;
  const csTailM     = prog ? round2(csNet * 0.35) : 0;
  const csFull      = prog ? round2(csFront + Math.max(0, csTerm - 4) * csTailM) : 0;
  const csBE        = prog ? csBreakEven(ldRev, csNet, csTerm) : null;
  // With no Level Debt benchmark (deal under $7k) there is no break-even month.
  // Falling back to $0 for that cohort would silently understate every sub-$7k
  // deal, so the mid-program month stands in as the reference point instead.
  const csBERef     = csBE ?? (prog ? Math.max(1, Math.floor(csTerm / 2)) : 0);
  const csRevBE     = prog ? csRevenueAt(csBERef, csNet, csTerm) : 0;
  const csExpected  = prog ? calcExpectedRevenue(csEff, csRev2, csRev4, csRevBE, csFull) : 0;
  const csRep       = prog ? round2(a.csRepUpfront + a.csRepAfter4 * (csEff.p4 / 100)) : 0;
  const csScoreRaw  = csExpected * (0.5 + (a.csLeadQuality / 100) * 0.7) * (1 - urgencyBias * 0.35);

  const cs = {
    key: "CS" as const, name: BACKEND_META.CS.name,
    eligible: !!prog,
    ineligibleReason: prog ? "" : "Consumer Shield requires at least $4,000 in enrolled debt.",
    program: prog, payment: prog?.payment ?? 0, netPayment: csNet,
    frontRevenue: csFront, tailMonthly: csTailM,
    revAfter2: csRev2, revAfter4: csRev4,
    revAtHalf: prog ? csRevenueAt(Math.max(1, Math.floor(csTerm * 0.5)), csNet, csTerm) : 0,
    breakEvenRefMonth: csBERef, breakEvenRefRevenue: csRevBE,
    expectedRevenue: csExpected, fullRevenue: csFull,
    adjustedScore: prog ? csScoreRaw : -1,
    breakEvenMonth: csBE,
    liabilityClearMonth: csBE !== null ? csBE + 4 : null,
    term: csTerm,
    timeline: csTimeline,
    effective: csEff,
    repCost: csRep,
    netRevenue: round2(csExpected - csRep),
  };

  // ── Elite Legal Practice / Legacy Capital ─────────────────
  const elpEff   = applyLeadQuality(a.elpFunnel, a.elpLeadQuality);
  const sched    = elpSchedule(debt, a.elpTerms);
  const elpTl    = elpBuildTimeline(sched);
  const elpRev2  = elpRevenueAt(2, sched);
  const elpRev4  = elpRevenueAt(4, sched);
  const elpFull  = elpFullRevenue(sched);
  const elpBE    = elpBreakEven(ldRev, sched);
  const elpBERef = elpBE ?? (sched.eligible ? Math.max(1, Math.floor(sched.term / 2)) : 0);
  const elpRevBE = sched.eligible ? elpRevenueAt(elpBERef, sched) : 0;
  const elpExpected = sched.eligible ? calcExpectedRevenue(elpEff, elpRev2, elpRev4, elpRevBE, elpFull) : 0;
  const elpRep   = sched.eligible ? elpExpectedRepCost(debt, elpEff.p2, elpEff.p4) : 0;
  const elpScoreRaw = elpExpected * (0.5 + (a.elpLeadQuality / 100) * 0.7) * (1 - urgencyBias * 0.35);
  const band     = getLcBand(debt);

  const elp = {
    key: "ELP" as const, name: BACKEND_META.ELP.name,
    eligible: sched.eligible,
    ineligibleReason: sched.eligible ? "" : `Elite Legal Practice requires at least ${money.format(ELP_MIN_DEBT)} in enrolled debt.`,
    schedule: sched,
    revAfter2: elpRev2, revAfter4: elpRev4,
    revAtHalf: elpRevenueAtFraction(0.5, sched),
    breakEvenRefMonth: elpBERef, breakEvenRefRevenue: elpRevBE,
    expectedRevenue: elpExpected, fullRevenue: elpFull,
    adjustedScore: sched.eligible ? elpScoreRaw : -1,
    breakEvenMonth: elpBE,
    liabilityClearMonth: elpBE !== null ? elpBE + 4 : null,
    term: sched.term,
    timeline: elpTl,
    effective: elpEff,
    repCost: elpRep,
    netRevenue: round2(elpExpected - elpRep),
    bandLabel: band ? `${band.label} · ${band.range}` : "—",
  };

  // ── Ranking ───────────────────────────────────────────────
  const contenders: BackendResult[] = [ld, cs, elp].filter(b => b.eligible);
  const ranked = [...contenders].sort((x, y) => y.adjustedScore - x.adjustedScore);
  const winner = ranked[0] ?? null;

  let recommendedLabel = "No Recommendation";
  let recommendationReason = "Debt amount falls outside every backend's accepted range.";

  if (winner) {
    const onlyOne = contenders.length === 1;
    recommendedLabel = onlyOne ? `${winner.name} (Only Eligible Backend)` : winner.name;
    const runnerUp = ranked[1];
    if (onlyOne) {
      const blocked = [ld, cs, elp].filter(b => !b.eligible).map(b => b.ineligibleReason);
      recommendationReason = `${winner.name} is the only backend that will accept ${money.format(debt)}. ${blocked.join(" ")}`;
    } else if (winner.key === "LD") {
      recommendationReason = `Level Debt wins — ${urgencyBias > 0.5 ? "cash urgency/stability favors fast recognition" : "neither perpetuity backend's adjusted expected value clears the 8% benchmark"}. Next best: ${runnerUp.name} at ${money.format(runnerUp.expectedRevenue)} expected.`;
    } else {
      recommendationReason = `${winner.name} wins on adjusted expected value (${money.format(winner.expectedRevenue)} vs ${money.format(runnerUp.expectedRevenue)} for ${runnerUp.name}). Effective rates: P2=${winner.effective.p2}% P4=${winner.effective.p4}% BE=${winner.effective.be}% Comp=${winner.effective.comp}%.`;
    }
  }

  return {
    debtAmount: debt, ld, cs, elp, ranked,
    recommended: winner?.key ?? null,
    recommendedLabel, recommendationReason,
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
// ACCORDION
// ─────────────────────────────────────────────

function Accordion({ title, defaultOpen=false, children, badge, accent=FT_GREEN }: {
  title:string; defaultOpen?:boolean; children:React.ReactNode; badge?:string; accent?:string;
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
          {badge && <span style={{ fontSize:11, fontWeight:700, background:accent+"22", color:accent, padding:"2px 8px", borderRadius:99 }}>{badge}</span>}
        </div>
        <span style={{ fontSize:20, fontWeight:900, color:accent }}>{open?"−":"+"}</span>
      </button>
      {open && <div style={{ borderTop:"1px solid #e2e8f0", padding:18 }}>{children}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────
// METRIC CARD
// ─────────────────────────────────────────────

function MetricCard({ title, value, subtitle, tooltip, inlineTag, accent, highlight }: {
  title:string; value:string; subtitle?:string; tooltip?:string; inlineTag?:string;
  accent?:string; highlight?:boolean;
}) {
  const [showTip, setShowTip] = useState(false);
  const valueColor = highlight ? FT_GREEN_DARK : (accent ?? "#0f172a");
  return (
    <div style={{ ...card, position:"relative",
      ...(highlight ? { background:FT_GREEN+"0d", border:`1px solid ${FT_GREEN}55` } : null) }}>
      <div style={{ fontSize:11, fontWeight:700, color:"#64748b", marginBottom:7,
        textTransform:"uppercase", letterSpacing:0.4,
        display:"flex", alignItems:"center", justifyContent:"space-between", gap:4 }}>
        <span style={{ display:"flex", alignItems:"center", gap:4 }}>
          {title}
          {tooltip && (
            <span onMouseEnter={() => setShowTip(true)} onMouseLeave={() => setShowTip(false)}
              style={{ display:"inline-flex", alignItems:"center", justifyContent:"center",
                width:14, height:14, borderRadius:"50%", background:accent ?? FT_GREEN,
                color:"#fff", fontSize:9, fontWeight:900, cursor:"help", flexShrink:0 }}>?</span>
          )}
        </span>
        {inlineTag && <span style={{ fontSize:10, fontWeight:600, color:"#94a3b8", fontStyle:"italic", textTransform:"none", whiteSpace:"nowrap" }}>{inlineTag}</span>}
      </div>
      {showTip && tooltip && (
        <div style={{ position:"absolute", top:"100%", left:0, zIndex:100,
          background:"#0f172a", color:"#fff", borderRadius:10,
          padding:"10px 13px", fontSize:12, lineHeight:1.6,
          width:260, boxShadow:"0 8px 24px rgba(0,0,0,0.25)", marginTop:4, pointerEvents:"none", whiteSpace:"pre-line" }}>{tooltip}</div>
      )}
      <div style={{ fontSize:24, fontWeight:800, color:valueColor, lineHeight:1.1, wordBreak:"break-word" }}>{value}</div>
      {subtitle && <div style={{ fontSize:12, color:"#64748b", marginTop:7, lineHeight:1.5 }}>{subtitle}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────
// CASCADING FUNNEL SLIDERS (per backend)
// ─────────────────────────────────────────────

function CascadingFunnel({ prefix, funnel, onChange, accent }: {
  prefix: string; funnel: Funnel; onChange: (f: Funnel) => void; accent: string;
}) {
  const { p2, p4, be, comp } = funnel;
  const stages = [
    { key:"p2",   val:p2,   label:`${prefix} Payment 2`,  color:accent  },
    { key:"p4",   val:p4,   label:`${prefix} Payment 4`,  color:FT_BLUE },
    { key:"be",   val:be,   label:`${prefix} Break-Even`, color:FT_AMBER },
    { key:"comp", val:comp, label:`${prefix} Complete`,   color:FT_HYPER },
  ];

  const handleChange = (key: string, nv: number) => {
    let [np2,np4,nbe,ncomp]=[p2,p4,be,comp];
    if      (key==="p2")   { np2=nv; np4=Math.min(np4,np2); nbe=Math.min(nbe,np4); ncomp=Math.min(ncomp,nbe); }
    else if (key==="p4")   { np4=nv; np2=Math.max(np2,np4); nbe=Math.min(nbe,np4); ncomp=Math.min(ncomp,nbe); }
    else if (key==="be")   { nbe=nv; np4=Math.max(np4,nbe); np2=Math.max(np2,np4); ncomp=Math.min(ncomp,nbe); }
    else                   { ncomp=nv; nbe=Math.max(nbe,ncomp); np4=Math.max(np4,nbe); np2=Math.max(np2,np4); }
    onChange({ p2:np2, p4:np4, be:nbe, comp:ncomp });
  };

  return (
    <div style={{ display:"flex", gap:8, flex:1, flexWrap:"wrap" }}>
      {stages.map(s => (
        <div key={s.key} style={{ flex:1, minWidth:72 }}>
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
// LEAD QUALITY PANEL (per backend)
// ─────────────────────────────────────────────

function LeadQualityPanel({ prefix, quality, onChange, funnel, eff, accent }: {
  prefix: string; quality: number; onChange: (v: number) => void;
  funnel: Funnel; eff: Effective; accent: string;
}) {
  const qualityLabel = quality >= 80 ? "Strong" : quality >= 55 ? "Average" : quality >= 30 ? "Weak" : "Poor";
  const qualityColor = quality >= 80 ? FT_GREEN : quality >= 55 ? accent : quality >= 30 ? FT_AMBER : FT_RED;

  const rows = [
    { label:`${prefix} Reach Payment 2`,  set:funnel.p2,   eff:eff.p2,   color:accent   },
    { label:`${prefix} Reach Payment 4`,  set:funnel.p4,   eff:eff.p4,   color:FT_BLUE  },
    { label:`${prefix} Reach Break-Even`, set:funnel.be,   eff:eff.be,   color:FT_AMBER },
    { label:`${prefix} Complete Program`, set:funnel.comp, eff:eff.comp, color:FT_HYPER },
  ];

  return (
    <div style={{ ...card, borderLeft:`4px solid ${qualityColor}` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
        <div>
          <div style={{ fontWeight:800, fontSize:15, color:"#0f172a" }}>{prefix} Lead Quality — Survival Rate Adjuster</div>
          <div style={{ fontSize:12, color:"#64748b", marginTop:3, lineHeight:1.6 }}>
            Scales effective {prefix} survival rates to reflect real-world churn risk on weaker leads.
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
            <th style={{ ...TH, borderRight:"none" }}>Effective at {quality}%</th>
          </tr></thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ background:i%2?"#f8fafc":"#fff" }}>
                <td style={{ ...TD, fontWeight:700, color:row.color }}>{row.label}</td>
                <td style={TD}>{row.set}%</td>
                <td style={{ ...TD, fontWeight:800, borderRight:"none",
                  color:row.eff < row.set ? FT_RED : row.color }}>
                  {row.eff}%
                  {row.eff < row.set && <span style={{ marginLeft:6, fontSize:10, color:FT_RED }}>↓ {round2(row.set-row.eff)}pp</span>}
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
// CASH URGENCY PANEL — THREE-WAY ROUTING
// ─────────────────────────────────────────────

function CashUrgencyPanel({ urgency, onChange, adjustedUrgency, stabilityPenalty, stabilityReason,
  routing, debtAmount, analysis }: {
  urgency: number; onChange: (v: number) => void;
  adjustedUrgency: number; stabilityPenalty: number; stabilityReason: string;
  routing: { ldPct: number; csPct: number; elpPct: number; horizon: string; rationale: string };
  debtAmount: number; analysis: DealAnalysis;
}) {
  const horizonMarkers = [
    { label:"No urgency", pct:0 },
    { label:"270 days",   pct:25 },
    { label:"180 days",   pct:50 },
    { label:"120 days",   pct:75 },
    { label:"90 days",    pct:100 },
  ];

  const cards = [
    { key:"LD"  as const, pct:routing.ldPct,  blurb:"Fast 8% recognition — cash in the door by Month 3", res:analysis.ld },
    { key:"ELP" as const, pct:routing.elpPct, blurb:"Attorney model — term set by the client payment, highest full-term ceiling", res:analysis.elp },
    { key:"CS"  as const, pct:routing.csPct,  blurb:"Debt validation perpetuity — 36-month tail on most bands", res:analysis.cs },
  ];

  return (
    <div style={{ ...card, borderLeft:`4px solid ${FT_AMBER}` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12, flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontWeight:800, fontSize:15, color:"#0f172a" }}>
            Cash Urgency — Portfolio Routing Driver
          </div>
          <div style={{ fontSize:12, color:"#64748b", marginTop:3, lineHeight:1.6, maxWidth:620 }}>
            How quickly does Funding Tier need cash to fuel operations and growth?
            This sets Level Debt's share; the remainder splits between Consumer Shield and Elite Legal Practice
            in proportion to their adjusted expected value.
            {stabilityPenalty > 0 && (
              <span style={{ color:FT_RED, fontWeight:700 }}>
                {" "}Blended CS + ELP survival rates are adding a stability adjustment of +{stabilityPenalty}pt.
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

      <div className="ft-grid-3">
        {cards.map(c => {
          const meta = BACKEND_META[c.key];
          return (
            <div key={c.key} style={{ background:meta.color+"11", border:`1px solid ${meta.color}33`,
              borderRadius:12, padding:"12px 14px", opacity:c.res.eligible?1:0.45 }}>
              <div style={{ fontSize:11, fontWeight:700, color:meta.colorDark, textTransform:"uppercase", letterSpacing:0.4 }}>
                Recommended — {meta.name}
              </div>
              <div style={{ fontSize:28, fontWeight:900, color:meta.colorDark, lineHeight:1 }}>
                {c.res.eligible ? `${c.pct}%` : "N/A"}
              </div>
              <div style={{ fontSize:12, color:"#64748b", marginTop:4, lineHeight:1.5 }}>
                {c.res.eligible ? c.blurb : c.res.ineligibleReason}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize:13, color:"#475569", lineHeight:1.7, marginTop:12,
        background:"#f8fafc", borderRadius:10, padding:"10px 13px" }}>
        <strong style={{ color:"#0f172a" }}>Rationale:</strong> {routing.rationale}
        {debtAmount > 0 && debtAmount < 7000 && (
          <span style={{ color:FT_RED, fontWeight:700 }}>
            {" "}At {money.format(debtAmount)} this deal is below the Level Debt floor — its LD share is forced to 0%.
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// BACKEND COMPARISON — HEAD TO HEAD
// ─────────────────────────────────────────────

function BackendComparison({ analysis }: { analysis: DealAnalysis }) {
  const { ld, cs, elp } = analysis;
  const cells = BACKEND_ORDER.map(k => (k === "LD" ? ld : k === "ELP" ? elp : cs)) as BackendResult[];
  const best = (vals: number[]) => Math.max(...vals);

  const bestExpected = best(cells.map(c => c.eligible ? c.expectedRevenue : -1));
  const bestNet      = best(cells.map(c => c.eligible ? c.netRevenue : -1));
  const bestFull     = best(cells.map(c => c.eligible ? c.fullRevenue : -1));

  const fmtBE = (b: BackendResult) =>
    !b.eligible ? "—" : b.key === "LD" ? "Month 2 (guaranteed)" : b.breakEvenMonth ? `Month ${b.breakEvenMonth}` : "Never within term";

  const rows: { label: string; tip: string; vals: (b: BackendResult) => string; highlight?: (b: BackendResult) => boolean }[] = [
    { label:"Revenue model", tip:"How Funding Tier is paid on this backend.",
      vals: b => b.key==="LD" ? "One-time 8% of enrolled debt"
             : b.key==="CS" ? "100% of net payment Mo 1–4, then 35%"
             : `100% pass-through Mo 1–2, then ${Math.round(elp.schedule.tierRate*100)}% of service fee` },
    { label:"Minimum enrolled debt", tip:"Hard floor the servicer will accept.",
      vals: b => money.format(BACKEND_META[b.key].minDebt) },
    { label:"Eligible at this deal", tip:"Whether this backend can take the deal at the current enrolled debt.",
      vals: b => b.eligible ? "Yes" : "No" },
    { label:"Program term", tip:"Months the client pays. Level Debt recognizes once and stops.",
      vals: b => !b.eligible ? "—" : b.key==="LD" ? "Recognized at Month 2" : `${b.term} months` },
    { label:"Expected revenue / deal", tip:"Survival-weighted revenue after the lead-quality adjustment. This is the number to compare.",
      vals: b => b.eligible ? money.format(b.expectedRevenue) : "—",
      highlight: b => b.eligible && b.expectedRevenue === bestExpected },
    { label:"Full-term ceiling", tip:"Revenue if the client completes the entire program. Best case, not a forecast.",
      vals: b => b.eligible ? money.format(b.fullRevenue) : "—",
      highlight: b => b.eligible && b.fullRevenue === bestFull },
    { label:"Rep commission cost", tip:"LD = enrolled debt × rep %. CS = upfront + milestone × effective P4. ELP = band schedule weighted by effective P2 / P4.",
      vals: b => b.eligible ? money.format(b.repCost) : "—" },
    { label:"Net expected / deal", tip:"Expected revenue minus rep commission cost.",
      vals: b => b.eligible ? money.format(b.netRevenue) : "—",
      highlight: b => b.eligible && b.netRevenue === bestNet },
    { label:"Break-even vs Level Debt", tip:"First month cumulative revenue catches the Level Debt 8%.",
      vals: fmtBE },
    { label:"Liability clear", tip:"Break-even month plus the 4-month chargeback buffer Funding Tier models per payment.",
      vals: b => !b.eligible ? "—" : b.key==="LD" ? "After Payment 2" : b.liabilityClearMonth ? `Month ${b.liabilityClearMonth}` : "—" },
    { label:"Cash speed", tip:"How quickly the money is actually in the bank.",
      vals: b => b.key==="LD" ? "Fastest — 20th of Month 3" : b.key==="CS" ? "Monthly, ~1 month behind each payment" : "Monthly, ~1 month behind each draft" },
  ];

  return (
    <div style={card}>
      <h2 style={{ margin:"0 0 4px", fontSize:18, fontWeight:800, color:"#0f172a" }}>
        Backend Comparison — {money.format(analysis.debtAmount)} Enrolled Debt
      </h2>
      <div style={{ fontSize:13, color:"#64748b", lineHeight:1.6, marginBottom:14 }}>
        Every backend on the same deal, same survival assumptions, same rep costs. Highlighted cells are the winner on that row.
      </div>
      <div style={{ overflowX:"auto", border:"1px solid #e2e8f0", borderRadius:13 }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead><tr style={{ background:"#f1f5f9" }}>
            <th style={TH}>Metric</th>
            {cells.map(b => (
              <th key={b.key} style={{ ...TH, color:BACKEND_META[b.key].colorDark, borderRight:b.key==="CS"?"none":TH.borderRight }}>
                {BACKEND_META[b.key].name}
                <span style={{ marginLeft:6, fontSize:10, fontWeight:700, color:"#64748b",
                  background:"#e2e8f0", padding:"1px 6px", borderRadius:99, textTransform:"none" }}>
                  {BACKEND_META[b.key].service}
                </span>
                {analysis.recommended === b.key && (
                  <span style={{ marginLeft:6, fontSize:10, background:BACKEND_META[b.key].color+"22",
                    padding:"1px 6px", borderRadius:99 }}>RECOMMENDED</span>
                )}
              </th>
            ))}
          </tr></thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.label} style={{ background:i%2?"#f8fafc":"#fff" }}>
                <td style={{ ...TD, fontWeight:700 }} title={row.tip}>
                  {row.label} <span style={{ fontSize:10, background:"#e2e8f0", borderRadius:99, padding:"1px 5px", color:"#334155", cursor:"help" }}>?</span>
                </td>
                {cells.map(b => {
                  const win = row.highlight?.(b) ?? false;
                  return (
                    <td key={b.key} style={{ ...TD,
                      borderRight: b.key==="CS" ? "none" : TD.borderRight,
                      background: win ? BACKEND_META[b.key].color+"1a" : undefined,
                      fontWeight: win ? 800 : 400,
                      color: win ? BACKEND_META[b.key].colorDark : (b.eligible ? "#0f172a" : "#94a3b8") }}>
                      {row.vals(b)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// FUNNEL EXPLAINER (per backend)
// ─────────────────────────────────────────────

function FunnelExplainer({ prefix, accent, eff, rev2, rev4, revBE, fullRev, ldRev, expected }: {
  prefix: string; accent: string; eff: Effective;
  rev2: number; rev4: number; revBE: number; fullRev: number; ldRev: number; expected: number;
}) {
  const stages = [
    { pct:100,      label:`${prefix} Deals Sent`,            color:"#94a3b8" },
    { pct:eff.p2,   label:`${prefix} Reach Payment 2`,       color:accent    },
    { pct:eff.p4,   label:`${prefix} Reach Payment 4`,       color:FT_BLUE   },
    { pct:eff.be,   label:`${prefix} Reach Break-Even`,      color:FT_AMBER  },
    { pct:eff.comp, label:`${prefix} Complete Full Program`, color:FT_HYPER  },
  ];

  const d2c  = round2(eff.p2 - eff.p4);
  const d4be = round2(eff.p4 - eff.be);
  const dbeC = round2(eff.be - eff.comp);

  const marginals = [
    { label:`${round2(100-eff.p2)}% drop before ${prefix} Payment 2 — earn $0`,
      contrib:0, calc:`(100% − ${eff.p2}%) = ${round2(100-eff.p2)}% of deals earn nothing`, color:"#e2e8f0" },
    { label:`${d2c}% reach ${prefix} P2 only — earn ${money.format(rev2)} each`,
      contrib:round2(d2c/100*rev2), calc:`(${eff.p2}% − ${eff.p4}%) × ${money.format(rev2)} = ${money.format(round2(d2c/100*rev2))}`, color:accent },
    { label:`${d4be}% reach ${prefix} P4 only — earn ${money.format(rev4)} each`,
      contrib:round2(d4be/100*rev4), calc:`(${eff.p4}% − ${eff.be}%) × ${money.format(rev4)} = ${money.format(round2(d4be/100*rev4))}`, color:FT_BLUE },
    { label:`${dbeC}% reach ${prefix} Break-Even only — earn ${money.format(revBE)} each`,
      contrib:round2(dbeC/100*revBE), calc:`(${eff.be}% − ${eff.comp}%) × ${money.format(revBE)} = ${money.format(round2(dbeC/100*revBE))}`, color:FT_AMBER },
    { label:`${eff.comp}% complete ${prefix} full program — earn ${money.format(fullRev)} each`,
      contrib:round2(eff.comp/100*fullRev), calc:`${eff.comp}% × ${money.format(fullRev)} = ${money.format(round2(eff.comp/100*fullRev))}`, color:FT_HYPER },
  ];

  const cohortTipText = `Each row represents a "cohort" — the group of ${prefix} deals that dropped out at a specific stage.\n\n` +
    `• "% in cohort" = difference between adjacent funnel stages\n` +
    `• "Revenue per deal" = cumulative ${prefix} revenue at that exit point\n` +
    `• "Contribution" = cohort % × revenue per deal\n\n` +
    `Summing all cohort contributions gives the total Expected Revenue per ${prefix} deal.`;

  return (
    <div style={card}>
      <div style={{ fontWeight:800, fontSize:15, color:"#0f172a", marginBottom:12 }}>
        {prefix} Expected Revenue — Deal Survival Funnel (after Lead Quality adjustment)
      </div>
      <div style={{ display:"grid", gap:6, marginBottom:16 }}>
        {stages.map((s, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ fontSize:12, color:"#64748b", width:230, flexShrink:0, fontWeight:i===0?400:700 }}>{s.label}</div>
            <div style={{ flex:1, background:"#f1f5f9", borderRadius:99, height:16, overflow:"hidden" }}>
              <div style={{ width:`${s.pct}%`, height:"100%", background:s.color, borderRadius:99, transition:"width 0.3s" }} />
            </div>
            <div style={{ fontSize:13, fontWeight:800, color:s.color, width:46, textAlign:"right" }}>{s.pct}%</div>
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
          padding:"8px 10px", background:accent+"18", borderRadius:10, fontWeight:800, fontSize:14 }}>
          <span>{prefix} Expected Revenue Per Deal</span>
          <span style={{ color:accent }}>{money.format(expected)}</span>
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
// REVENUE MILESTONES TIMELINE (per backend)
// ─────────────────────────────────────────────

function MilestonesTimeline({ timeline, breakEvenMonth, liabilityClearMonth, levelDebtRevenue,
  debtAmount, accent, accentDark, frontPhase, frontLabel, tailLabel, frontEndsMonth }: {
  timeline:TimelineRow[]; breakEvenMonth:number|null; liabilityClearMonth:number|null;
  levelDebtRevenue:number; debtAmount:number; accent:string; accentDark:string;
  frontPhase:string; frontLabel:string; tailLabel:string; frontEndsMonth:number;
}) {
  const [hovM, setHovM] = useState<number|null>(null);

  if (!timeline.length) return <div style={{ color:"#94a3b8", fontSize:13 }}>Enter a valid debt amount to see the timeline.</div>;

  const W=740,H=130,PL=22,PR=22,dotY=54;
  const term=timeline.length;
  const getX=(i:number)=>PL+(i/Math.max(term-1,1))*(W-PL-PR);
  const hov=hovM!==null?timeline[hovM-1]:null;
  const hovX=hovM!==null?getX(hovM-1):0;

  const labels:Record<number,{text:string;color:string}>={};
  // On a long term the "Mo 1" and front-close labels collide when the front
  // window is only two months (ELP). Keep the more informative one.
  if(frontEndsMonth>2) labels[1]={text:"Mo 1",color:accent};
  if(frontEndsMonth<=term) labels[frontEndsMonth]={text:`Mo ${frontEndsMonth}`,color:accent};
  if(breakEvenMonth) labels[breakEvenMonth]={text:`Mo ${breakEvenMonth}`,color:FT_AMBER};
  if(liabilityClearMonth&&liabilityClearMonth<=term) labels[liabilityClearMonth]={text:`Mo ${liabilityClearMonth}`,color:FT_HYPER};
  labels[term]={text:`Mo ${term}`,color:accentDark};

  return (
    <div>
      <div style={{ fontSize:13, color:"#64748b", marginBottom:10 }}>
        Figures based on <strong>{money.format(debtAmount)}</strong> enrolled debt —
        Level Debt = {levelDebtRevenue > 0 ? money.format(levelDebtRevenue) : "N/A (under $7k)"} vs this program.
      </div>

      <div style={{ overflowX:"auto" }}>
        <svg width={W} height={H} style={{ minWidth:W, display:"block" }} onMouseLeave={()=>setHovM(null)}>
          <line x1={PL} y1={dotY} x2={W-PR} y2={dotY} stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
          {timeline.map((row,i)=>{
            if(i===0) return null;
            const col=row.month===liabilityClearMonth?FT_HYPER:row.month<=(breakEvenMonth??0)?FT_AMBER:row.phase===frontPhase?accent:FT_BLUE;
            return <line key={i} x1={getX(i-1)} y1={dotY} x2={getX(i)} y2={dotY} stroke={col} strokeWidth="4" strokeLinecap="round" />;
          })}
          {timeline.map((row,i)=>{
            const x=getX(i),isHov=hovM===row.month,isLbl=!!labels[row.month];
            const isBE=row.month===breakEvenMonth,isLC=row.month===liabilityClearMonth,isLast=row.month===term;
            const dc=isLC?FT_HYPER:isBE?FT_AMBER:isLast?accentDark:row.phase===frontPhase?accent:FT_BLUE;
            return (
              <g key={row.month}>
                <circle cx={x} cy={dotY} r={12} fill="transparent" style={{cursor:"pointer"}} onMouseEnter={()=>setHovM(row.month)} />
                <circle cx={x} cy={dotY} r={isHov?9:isLbl?6:3} fill={dc} stroke={isLC||isHov?"#fff":"none"} strokeWidth={isLC?2.5:2} style={{pointerEvents:"none"}} />
                {isLC&&<circle cx={x} cy={dotY} r={isHov?14:10} fill="none" stroke={FT_HYPER} strokeWidth="2" opacity="0.4" style={{pointerEvents:"none"}} />}
                {isLbl&&<text x={x} y={dotY+20} textAnchor="middle" fontSize="10" fill={labels[row.month].color} fontWeight="800">{labels[row.month].text}</text>}
                {isLast&&<text x={x} y={dotY-14} textAnchor="middle" fontSize="11" fill={accentDark} fontWeight="900">{money.format(row.cumulativeRevenue)}</text>}
                {isBE&&!isLast&&<text x={x} y={dotY-14} textAnchor="middle" fontSize="10" fill={FT_AMBER} fontWeight="800">{money.format(row.cumulativeRevenue)}</text>}
                {isLC&&!isBE&&!isLast&&<text x={x} y={dotY-14} textAnchor="middle" fontSize="10" fill={FT_HYPER} fontWeight="900">{money.format(row.cumulativeRevenue)}</text>}
              </g>
            );
          })}
          {hov&&(()=>{
            const tx=Math.min(Math.max(hovX,68),W-68);
            return (
              <g style={{pointerEvents:"none"}}>
                <rect x={tx-66} y={dotY-62} width={132} height={48} rx="8" fill="#0f172a" opacity="0.93" />
                <text x={tx} y={dotY-47} textAnchor="middle" fontSize="10" fill="#94a3b8" fontWeight="700">MONTH {hov.month} · {hov.phase.toUpperCase()}</text>
                <text x={tx} y={dotY-28} textAnchor="middle" fontSize="14" fill="#fff" fontWeight="800">{money.format(hov.cumulativeRevenue)}</text>
              </g>
            );
          })()}
        </svg>
        <div style={{ display:"flex", gap:14, marginTop:6, fontSize:11, color:"#64748b", flexWrap:"wrap" }}>
          <span><span style={{ display:"inline-block", width:9, height:9, borderRadius:"50%", background:accent, marginRight:4, verticalAlign:"middle" }} />{frontLabel}</span>
          <span><span style={{ display:"inline-block", width:9, height:9, borderRadius:"50%", background:FT_BLUE, marginRight:4, verticalAlign:"middle" }} />{tailLabel}</span>
          {breakEvenMonth&&<span><span style={{ display:"inline-block", width:9, height:9, borderRadius:"50%", background:FT_AMBER, marginRight:4, verticalAlign:"middle" }} />Breaks even vs Level Debt after Month {breakEvenMonth}</span>}
          {liabilityClearMonth&&liabilityClearMonth<=timeline.length&&(
            <span style={{ color:FT_GREEN_DARK, fontWeight:800 }}>
              <span style={{ display:"inline-block", width:9, height:9, borderRadius:"50%", background:FT_HYPER, marginRight:4, verticalAlign:"middle", boxShadow:`0 0 6px ${FT_HYPER}` }} />
              Break-Even + Fully Liability-Clear (Mo {liabilityClearMonth})
            </span>
          )}
          <span style={{ color:accentDark, fontWeight:700 }}>↑ Hover dots for cumulative revenue</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MONTHLY REVENUE TABLE (per backend)
// ─────────────────────────────────────────────

function MonthlyRevenueTable({ timeline, breakEvenMonth, liabilityClearMonth, frontPhase, frontEndsMonth, accent, accentDark }: {
  timeline:TimelineRow[]; breakEvenMonth:number|null; liabilityClearMonth:number|null;
  frontPhase:string; frontEndsMonth:number; accent:string; accentDark:string;
}) {
  return (
    <div style={{ overflowX:"auto", borderRadius:13, border:"1px solid #e2e8f0", maxHeight:520 }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
        <thead><tr style={{ background:"#f1f5f9" }}>
          {["Month","Phase","Monthly Revenue","Cumulative Revenue","Assumed Funds Hit","Liability Clears"].map(h=><th key={h} style={TH}>{h}</th>)}
        </tr></thead>
        <tbody>
          {timeline.map(row=>{
            const isBE=row.month===breakEvenMonth;
            const isLC=row.month===liabilityClearMonth;
            const is1=row.month===1,isFE=row.month===frontEndsMonth;
            const isMile=isBE||isLC||is1||isFE;
            const rowBg=isLC?FT_HYPER+"22":isBE?FT_AMBER+"22":is1||isFE?accent+"11":row.month%2?"#f8fafc":"#fff";
            return (
              <tr key={row.month} style={{ background:rowBg }}>
                <td style={{ ...TD, fontWeight:isMile?800:400 }}>
                  {row.month}
                  {is1&&<span style={{ marginLeft:6, fontSize:10, background:accent+"22", color:accentDark, fontWeight:700, padding:"1px 6px", borderRadius:99 }}>Start</span>}
                  {isFE&&<span style={{ marginLeft:6, fontSize:10, background:accent+"22", color:accentDark, fontWeight:700, padding:"1px 6px", borderRadius:99 }}>Front Close</span>}
                  {isBE&&<span style={{ marginLeft:6, fontSize:10, background:FT_AMBER+"33", color:FT_AMBER, fontWeight:800, padding:"1px 6px", borderRadius:99 }}>Break-Even</span>}
                  {isLC&&<span style={{ marginLeft:6, fontSize:10, background:FT_HYPER+"33", color:FT_GREEN_DARK, fontWeight:800, padding:"1px 6px", borderRadius:99 }}>Liability Clear</span>}
                </td>
                <td style={{ ...TD, color:row.phase===frontPhase?accentDark:FT_BLUE, fontWeight:700 }}>{row.phase}</td>
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
  );
}

// ─────────────────────────────────────────────
// REVENUE CURVE (generic cumulative series)
// ─────────────────────────────────────────────

function RevenueCurve({ points, accent, accentDark, notableMonths }: {
  points:{month:number;y:number}[]; accent:string; accentDark:string; notableMonths:number[];
}) {
  const [hov, setHov] = useState<{month:number;rev:number;x:number;y:number}|null>(null);
  if (!points.length) return null;
  const maxY=Math.max(...points.map(p=>p.y),1);
  const W=700,H=240,PL=90,PB=40,PT=22,PR=24;
  const gx=(i:number)=>PL+(i/Math.max(points.length-1,1))*(W-PL-PR);
  const gy=(v:number)=>H-PB-(v/maxY)*(H-PT-PB);
  const coords=points.map((p,i)=>`${gx(i)},${gy(p.y)}`).join(" ");
  const notable=new Set(notableMonths);

  return (
    <div style={{ overflowX:"auto", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:14, padding:"12px 10px 8px" }}>
      <svg width={W} height={H} style={{ minWidth:W, display:"block" }} onMouseLeave={()=>setHov(null)}>
        {[0,0.25,0.5,0.75,1].map((t,i)=>{
          const yv=H-PB-t*(H-PT-PB);
          return <g key={i}>
            <line x1={PL} y1={yv} x2={W-PR} y2={yv} stroke={t===0?"#94a3b8":"#e2e8f0"} strokeWidth={t===0?1.5:1} />
            <text x={PL-8} y={yv+4} fontSize="11" fill={accentDark} textAnchor="end" fontWeight="600">{money.format(maxY*t)}</text>
          </g>;
        })}
        <text x={16} y={H/2} textAnchor="middle" fontSize="11" fill={accentDark} fontWeight="700" transform={`rotate(-90,16,${H/2})`}>Revenue Earned</text>
        <line x1={PL} y1={H-PB} x2={W-PR} y2={H-PB} stroke="#94a3b8" strokeWidth="1.5" />
        <text x={PL+(W-PL-PR)/2} y={H-6} textAnchor="middle" fontSize="11" fill={accentDark} fontWeight="700">Program Length (Months)</text>
        <polyline fill={accent+"18"} stroke="none" points={`${gx(0)},${H-PB} ${coords} ${gx(points.length-1)},${H-PB}`} />
        <polyline fill="none" stroke={accent} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={coords} />
        {points.map((p,i)=>{
          const x=gx(i),y=gy(p.y),isH=hov?.month===p.month,isN=notable.has(p.month);
          return <g key={p.month}>
            <circle cx={x} cy={y} r={11} fill="transparent" style={{cursor:"pointer"}} onMouseEnter={()=>setHov({month:p.month,rev:p.y,x,y})} />
            <circle cx={x} cy={y} r={isH?8:isN?5.5:2.5} fill={isH||isN?accentDark:accent} stroke={isH?"#fff":"none"} strokeWidth="2" style={{pointerEvents:"none"}} />
            {isN&&<text x={x} y={H-PB+16} textAnchor="middle" fontSize="10" fill={accentDark} fontWeight="700">{p.month}</text>}
            {i===points.length-1&&<text x={x} y={y-14} textAnchor="middle" fontSize="11" fill={accentDark} fontWeight="900">{money.format(p.y)}</text>}
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
// CS PROGRAM ACCORDION
// ─────────────────────────────────────────────

function ProgramAccordion({ program, open, onToggle }: {
  program:ConsumerShieldProgram; open:boolean; onToggle:()=>void;
}) {
  const net=program.payment-40,front=round2(net*Math.min(4,program.term));
  const tail=round2(net*0.35),fullRev=round2(front+Math.max(0,program.term-4)*tail);
  const pts=Array.from({length:program.term},(_,i)=>({month:i+1,y:csRevenueAt(i+1,net,program.term)}));
  return (
    <div style={{ border:"1px solid #e2e8f0", borderRadius:16, overflow:"hidden", background:"#fff" }}>
      <button onClick={onToggle} style={{ width:"100%", textAlign:"left", background:"#fff", border:"none", padding:"11px 16px", cursor:"pointer" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:0, flexWrap:"wrap" }}>
            <span style={{ fontWeight:800, color:"#0f172a", fontSize:14, width:120, flexShrink:0 }}>{program.label}</span>
            <span style={{ fontSize:12, color:"#64748b", width:170, flexShrink:0 }}>{program.debtRange}</span>
            <span style={{ fontSize:12, fontWeight:800, color:FT_BLUE, width:130, flexShrink:0 }}>Net: {money.format(net)}/mo</span>
            <span style={{ fontSize:12, color:"#64748b", width:120, flexShrink:0 }}>{program.term} mo · {money.format(program.payment)}/mo</span>
          </div>
          <span style={{ fontSize:20, fontWeight:900, color:FT_BLUE, flexShrink:0, paddingLeft:8 }}>{open?"−":"+"}</span>
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
                <td style={{ ...TD, textAlign:"center", fontSize:20, fontWeight:800, color:FT_BLUE }}>{money.format(front)}</td>
                <td style={{ ...TD, textAlign:"center", fontSize:20, fontWeight:800, color:FT_BLUE }}>{money.format(tail)}<span style={{ fontSize:11, color:"#94a3b8" }}>/mo</span></td>
                <td style={{ ...TD, textAlign:"center", fontSize:20, fontWeight:800, color:"#1552a8", borderRight:"none" }}>{money.format(fullRev)}</td>
              </tr></tbody>
            </table>
          </div>
          <RevenueCurve points={pts} accent={FT_BLUE} accentDark="#1552a8" notableMonths={[1,4,program.term]} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// PAYMENT / TERM TRADE-OFF
//
// The client-facing question on an attorney-model program is always the same:
// "can you lower my payment?" The answer is yes, and the cost is months. This
// lays both sides out — what the client pays, how long they pay it, and what
// Funding Tier earns — so the trade can be shown rather than argued.
// ─────────────────────────────────────────────

function PaymentTermTradeoff({ debtAmount, terms, sched, csPayment, csTerm, ldRevenue, onPick }: {
  debtAmount:number; terms:ElpTerms; sched:ElpSchedule;
  csPayment:number; csTerm:number; ldRevenue:number; onPick:(draft:number)=>void;
}) {
  const capTerm = elpMaxTerm(debtAmount, terms.feeRatePct, terms.maintFee, terms.split);
  const current = sched.term;

  // Terms spanning the current program out to the longest the floor allows.
  const candidates = Array.from(new Set(
    [current,
     Math.round(current + (capTerm - current) * 0.33),
     Math.round(current + (capTerm - current) * 0.66),
     capTerm].filter(t => t >= ELP_TERM_MIN && t <= capTerm)
  )).sort((a, b) => a - b);

  if (!sched.eligible || candidates.length === 0) return null;

  const rows = candidates.map(t => {
    const s = elpSchedule(debtAmount, { ...terms, term: t });
    const be = elpBreakEven(ldRevenue, s);
    return {
      term: t, draft: s.grossPayment, full: elpFullRevenue(s), be,
      deltaMonths: t - current, deltaDraft: round2(s.grossPayment - sched.grossPayment),
      isCurrent: t === current,
    };
  });

  return (
    <div style={{ marginTop:14, border:"1px solid #e2e8f0", borderRadius:12, overflow:"hidden" }}>
      <div style={{ padding:"10px 13px", background:"#f8fafc", borderBottom:"1px solid #e2e8f0" }}>
        <div style={{ fontSize:13, fontWeight:800, color:"#0f172a" }}>Payment vs term — what a lower payment costs</div>
        <div style={{ fontSize:12, color:"#64748b", marginTop:2, lineHeight:1.6 }}>
          The service fee is fixed at {money.format(sched.serviceFeeTotal)} ({terms.feeRatePct}% of {money.format(debtAmount)}),
          so a lower payment does not reduce what the client owes — it spreads it over more months.
          Click a row to model it.
        </div>
      </div>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead><tr style={{ background:"#fff" }}>
            {["Client payment","Term","vs current","Full-term revenue","Break-even vs LD"].map(h =>
              <th key={h} style={{ ...TH, color:FT_CYAN_DARK }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.term} onClick={() => onPick(r.draft)}
                style={{ background:r.isCurrent ? FT_CYAN+"14" : "#fff", cursor:"pointer" }}>
                <td style={{ ...TD, fontWeight:800, color:r.isCurrent?FT_CYAN_DARK:"#0f172a" }}>
                  {money.format(r.draft)}/mo
                  {r.isCurrent && <span style={{ marginLeft:6, fontSize:10, background:FT_CYAN+"26", color:FT_CYAN_DARK, fontWeight:800, padding:"1px 6px", borderRadius:99 }}>CURRENT</span>}
                </td>
                <td style={TD}>{r.term} mo</td>
                <td style={{ ...TD, color:r.deltaMonths===0?"#94a3b8":"#475569" }}>
                  {r.deltaMonths===0 ? "—"
                    : `${money.format(r.deltaDraft)}/mo · +${r.deltaMonths} mo`}
                </td>
                <td style={{ ...TD, fontWeight:700 }}>{money.format(r.full)}</td>
                <td style={{ ...TD, borderRight:"none", color:r.be?FT_AMBER:"#94a3b8", fontWeight:700 }}>
                  {r.be ? `Month ${r.be}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {csPayment > 0 && (() => {
        const elpDraft = sched.grossPayment;
        const gap      = round2(elpDraft - csPayment);
        const matched  = Math.abs(gap) <= 10;      // within rounding of the CS payment
        const dMonths  = current - csTerm;
        const mo       = (n: number) => `${n} month${n === 1 ? "" : "s"}`;
        const lengthPhrase = dMonths === 0 ? "the same length"
          : dMonths < 0 ? `${mo(-dMonths)} shorter`
          : `${mo(dMonths)} longer`;
        return (
          <div style={{ padding:"9px 13px", borderTop:"1px solid #e2e8f0", background:"#f8fafc",
            fontSize:12, color:"#475569", lineHeight:1.65 }}>
            <strong style={{ color:FT_BLUE }}>Against Consumer Shield:</strong> {money.format(csPayment)}/mo for {csTerm} months.
            {matched
              ? ` At a matched payment ELP runs ${current} months — ${lengthPhrase}.`
              : gap > 0
                ? ` ELP cannot go that low here — its floor is ${money.format(elpDraft)}/mo, ${money.format(gap)} more, over ${current} months (${lengthPhrase}).`
                : ` ELP runs ${money.format(elpDraft)}/mo over ${current} months — ${money.format(-gap)} less per month, ${lengthPhrase}.`}
            {" "}The programs resolve debt differently, so this compares cost and duration, not outcome.
          </div>
        );
      })()}
    </div>
  );
}

// ─────────────────────────────────────────────
// ELP PROGRAM TERMS PANEL
// ─────────────────────────────────────────────

function ElpTermsPanel({ terms, onChange, sched, debtAmount, files, targetDraft, onDraftChange,
  csPayment, csTerm, ldRevenue }: {
  terms:ElpTerms; onChange:(t:ElpTerms)=>void; sched:ElpSchedule; debtAmount:number; files:number;
  targetDraft:number|null; onDraftChange:(v:number|null)=>void;
  csPayment:number; csTerm:number; ldRevenue:number;
}) {
  const floorOk = sched.eligible && sched.grossPayment >= 250;
  const capTerm  = elpMaxTerm(debtAmount, terms.feeRatePct, terms.maintFee, terms.split);
  const minDraft = sched.eligible ? elpDraftForTerm(debtAmount, terms, capTerm) : 0;
  const isAuto   = targetDraft == null;
  return (
    <div style={{ ...card, borderLeft:`4px solid ${FT_CYAN}` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12, flexWrap:"wrap", gap:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <img src={ELP_LOGO} alt="Elite Legal Practice" style={{ height:26, width:"auto", objectFit:"contain" }} />
          <div>
            <div style={{ fontWeight:800, fontSize:15, color:"#0f172a" }}>Elite Legal Practice — Program Terms</div>
            <div style={{ fontSize:12, color:"#64748b", marginTop:2, lineHeight:1.6 }}>
              Legacy Capital Services attorney model. The client draft sets the term — $250/mo is the floor, not the target.
              Shorter terms earn more and earn it sooner, because months 1–2 pass through in full.
            </div>
          </div>
        </div>
        <div style={{ textAlign:"right", flexShrink:0 }}>
          <div style={{ fontSize:11, color:"#64748b", textTransform:"uppercase", letterSpacing:0.4, fontWeight:700 }}>Program Term</div>
          <div style={{ fontSize:22, fontWeight:900, color:FT_CYAN_DARK }}>{sched.eligible ? `${sched.term} mo` : "N/A"}</div>
          {sched.eligible && (
            <div style={{ fontSize:10, color:sched.term===capTerm?FT_AMBER:"#94a3b8", fontWeight:700, marginTop:2 }}>
              {sched.term===capTerm ? `at the $250 floor — longest allowed` : `max ${capTerm} mo at this fee rate`}
            </div>
          )}
        </div>
      </div>

      <div className="ft-grid-4" style={{ marginBottom:14 }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:5, gap:6 }}>
            <span style={{ fontSize:12, fontWeight:800, color:FT_CYAN_DARK, textTransform:"uppercase", letterSpacing:0.3 }}>
              Client Monthly Payment
            </span>
            <button onClick={() => onDraftChange(null)}
              title={csPayment > 0 ? `Reset to the Consumer Shield payment (${money.format(csPayment)}/mo)` : `Reset to a ${ELP_DEFAULT_TARGET_TERM}-month program`}
              style={{ border:"none", borderRadius:99, cursor:isAuto?"default":"pointer",
                padding:"1px 7px", fontSize:9, fontWeight:800, letterSpacing:0.3,
                background:isAuto?FT_CYAN+"22":"#e2e8f0", color:isAuto?FT_CYAN_DARK:"#64748b" }}>
              {isAuto ? (csPayment > 0 ? "MATCHED TO CS" : `AUTO ${ELP_DEFAULT_TARGET_TERM}MO`) : "RESET"}
            </button>
          </div>
          <input type="number" value={sched.eligible ? Math.round(sched.grossPayment) : 0}
            min={Math.round(minDraft)} step={10} disabled={!sched.eligible}
            onChange={e => onDraftChange(Number(e.target.value))}
            style={{ width:"100%", padding:"7px 9px", borderRadius:8, boxSizing:"border-box",
              border:`1px solid ${floorOk?"#cbd5e1":FT_AMBER}`, fontSize:14, fontWeight:800, color:"#0f172a", background:"#fff" }} />
          <input type="range" min={ELP_TERM_MIN} max={Math.max(ELP_TERM_MIN, capTerm)} step={1}
            value={sched.eligible ? sched.term : ELP_TERM_MIN} disabled={!sched.eligible}
            onChange={e => onDraftChange(elpDraftForTerm(debtAmount, terms, Number(e.target.value)))}
            style={{ width:"100%", accentColor:FT_CYAN, marginTop:5 }} />
          <div style={{ fontSize:11, color:"#94a3b8" }}>
            Drag for term · floor {money.format(minDraft)}/mo at {capTerm} mo
          </div>
          {csPayment > 0 && (
            <div style={{ fontSize:11, marginTop:2, fontWeight:700,
              color: minDraft > csPayment ? FT_AMBER : "#64748b" }}>
              {minDraft > csPayment
                ? `⚠ Cannot match CS ${money.format(csPayment)}/mo — ELP floor is ${money.format(minDraft)}`
                : `Consumer Shield charges ${money.format(csPayment)}/mo for ${csTerm} mo`}
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize:12, fontWeight:800, color:FT_CYAN_DARK, marginBottom:5, textTransform:"uppercase", letterSpacing:0.3 }}>
            Service Fee Rate
          </div>
          <input type="range" min={ELP_FEE_MIN} max={ELP_FEE_MAX} step={1} value={terms.feeRatePct}
            onChange={e => onChange({ ...terms, feeRatePct:Number(e.target.value) })}
            style={{ width:"100%", accentColor:FT_CYAN }} />
          <div style={{ fontSize:13, fontWeight:800, color:FT_CYAN_DARK }}>{terms.feeRatePct}% of enrolled debt</div>
          <div style={{ fontSize:11, color:"#94a3b8" }}>Range {ELP_FEE_MIN}–{ELP_FEE_MAX}%</div>
        </div>
        <div>
          <div style={{ fontSize:12, fontWeight:800, color:FT_CYAN_DARK, marginBottom:5, textTransform:"uppercase", letterSpacing:0.3 }}>
            Maintenance Fee
          </div>
          <div style={{ display:"flex", gap:6 }}>
            {ELP_MAINT_OPTIONS.map(v => (
              <button key={v} onClick={() => onChange({ ...terms, maintFee:v })}
                style={{ flex:1, padding:"9px 6px", borderRadius:9, cursor:"pointer", fontWeight:800, fontSize:13,
                  border:`1px solid ${terms.maintFee===v?FT_CYAN:"#cbd5e1"}`,
                  background:terms.maintFee===v?FT_CYAN+"1a":"#fff",
                  color:terms.maintFee===v?FT_CYAN_DARK:"#64748b" }}>
                {money.format(v)}/mo
              </button>
            ))}
          </div>
          <div style={{ fontSize:11, color:"#94a3b8", marginTop:4 }}>Backed out of the draft from Payment 3 on</div>
        </div>
        <div>
          <div style={{ fontSize:12, fontWeight:800, color:FT_CYAN_DARK, marginBottom:5, textTransform:"uppercase", letterSpacing:0.3 }}>
            Payment Schedule
          </div>
          <div style={{ display:"flex", gap:6 }}>
            {[{ v:false, l:"Monthly · 1 draft" }, { v:true, l:"Split · 2 drafts" }].map(o => (
              <button key={String(o.v)} onClick={() => onChange({ ...terms, split:o.v })}
                style={{ flex:1, padding:"9px 6px", borderRadius:9, cursor:"pointer", fontWeight:800, fontSize:12,
                  border:`1px solid ${terms.split===o.v?FT_CYAN:"#cbd5e1"}`,
                  background:terms.split===o.v?FT_CYAN+"1a":"#fff",
                  color:terms.split===o.v?FT_CYAN_DARK:"#64748b" }}>
                {o.l}
              </button>
            ))}
          </div>
          <div style={{ fontSize:11, color:"#94a3b8", marginTop:4 }}>${sched.draftMonthly}/mo in draft fees</div>
        </div>
      </div>

      {!sched.eligible ? (
        <div style={{ background:FT_RED+"11", border:`1px solid ${FT_RED}33`, borderRadius:12, padding:"12px 14px" }}>
          <div style={{ fontWeight:800, color:FT_RED, fontSize:13 }}>⛔ Under {money.format(ELP_MIN_DEBT)} — Elite Legal Practice cannot accept this deal</div>
          <div style={{ fontSize:12, color:"#64748b", marginTop:4, lineHeight:1.6 }}>
            Legacy Capital Services requires {money.format(ELP_MIN_DEBT)} minimum enrolled debt and $250/mo payment capacity.
          </div>
        </div>
      ) : (
        <>
          <div className="ft-grid-4">
            <MetricCard title="Payment / Monthly" accent={FT_CYAN_DARK}
              value={money.format(sched.grossPayment)}
              inlineTag={`${sched.term} months`}
              tooltip={`Service fee ${money.format(sched.serviceFeeMonthly)} + maintenance ${money.format(sched.maintFee)} + draft fee $${sched.draftMonthly} = ${money.format(sched.grossPayment)}.\n\nMust stay at or above the $250 floor — that floor is what caps the term.`} />
            <MetricCard title="Payments 1–2 Revenue" accent={FT_CYAN_DARK}
              value={money.format(sched.earlyRevenue)} inlineTag="100% pass-through"
              tooltip={`Draft ${money.format(sched.grossPayment)} less the $${sched.draftMonthly} draft fee. Maintenance is not backed out yet, so Funding Tier keeps the full remainder.`} />
            <MetricCard title="Payments 3+ Revenue" accent={FT_CYAN_DARK}
              value={money.format(sched.lateRevenue)} inlineTag={`${Math.round(sched.tierRate*100)}% tier rate`}
              tooltip={`Draft less maintenance (${money.format(sched.maintFee)}) and draft fee ($${sched.draftMonthly}) = ${money.format(sched.lateNet)} eligible, × ${Math.round(sched.tierRate*100)}% tier rate.\n\nTier steps to 65% at ${ELP_TIER_RATE_FILE_THRESHOLD}+ billable files per month — currently ${files} files.`} />
            <MetricCard title="Total Service Fee" accent={FT_CYAN_DARK}
              value={money.format(sched.serviceFeeTotal)}
              subtitle={`${terms.feeRatePct}% of ${money.format(debtAmount)} spread over ${sched.term} months`} />
          </div>
          {!floorOk && (
            <div style={{ marginTop:12, background:FT_AMBER+"11", border:`1px solid ${FT_AMBER}44`, borderRadius:10,
              padding:"9px 13px", fontSize:12, color:"#92400e", fontWeight:700 }}>
              ⚠ Derived draft of {money.format(sched.grossPayment)} sits under the $250 floor. Raise the fee rate or lower the maintenance fee.
            </div>
          )}
          <PaymentTermTradeoff debtAmount={debtAmount} terms={terms} sched={sched}
            csPayment={csPayment} csTerm={csTerm} ldRevenue={ldRevenue} onPick={onDraftChange} />
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// PAYOUT + LIABILITY (three-way)
// ─────────────────────────────────────────────

function PayoutLiabilityAccordion() {
  const rows = [
    { event:"Expected Funds Hit Bank", ld:"Month 3 (20th)", cs:"Month +1 per payment", elp:"Month +1 per draft",
      detail:"LD: Payment 1 = Jan 1, Payment 2 = Feb 1 → payout March 20. CS and ELP: each client payment hits your bank ~1 month after processing." },
    { event:"Chargeback Liability Free", ld:"After Payment 2", cs:"Each payment: Month +4", elp:"Each draft: Month +4",
      detail:"LD: zero liability after 2 cleared payments. Both perpetuity backends carry a rolling per-payment window — they do not clear together." },
    { event:"ACH Return Window", ld:"~60 days (Nacha)", cs:"~60 days per payment", elp:"~60 days per draft",
      detail:"Funding Tier models 4 months as a conservative internal buffer. Real Nacha window is ~60 calendar days per payment." },
    { event:"Rep Commission Timing", ld:"20th of Month 3", cs:"P2 payout, then P4 milestone", elp:"P2 payout, then P4 milestone (Bands L2–L7)",
      detail:"ELP Band L1 pays its full $150 at Payment 2 with no second milestone and no clawback. Bands L2–L7 split across Payment 2 and Payment 4, with the P2 portion subject to clawback if the client cancels before Payment 4 clears." },
    { event:"Revenue Recognition Shape", ld:"Single event", cs:"Front-loaded then long tail", elp:"Two big months then a long flat tail",
      detail:"ELP months 1–2 pass through in full (service fee + maintenance), then every remaining month pays the tier share of the service fee only." },
  ];
  return (
    <Accordion title="Payout + Liability Timing — All Three Backends">
      <div style={{ overflowX:"auto", borderRadius:12, border:"1px solid #e2e8f0" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead><tr style={{ background:"#f8fafc" }}>{["Timing Event","Level Debt","Consumer Shield","Elite Legal Practice","Notes"].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((row,i)=>(
              <tr key={i} style={{ background:i%2?"#f8fafc":"#fff" }}>
                <td style={{ ...TD, fontWeight:700 }}>{row.event}</td>
                <td style={{ ...TD, color:FT_GREEN_DARK, fontWeight:700 }}>{row.ld}</td>
                <td style={{ ...TD, color:FT_BLUE, fontWeight:700 }}>{row.cs}</td>
                <td style={{ ...TD, color:FT_CYAN_DARK, fontWeight:700 }}>{row.elp}</td>
                <td style={{ ...TD, color:"#64748b", lineHeight:1.6, borderRight:"none" }}>{row.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Accordion>
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
          ["Three Backends, One Deal", `Level Debt — settlement. One-time 8% of enrolled debt, recognized after 2 cleared payments, then nothing recurs.\n\nConsumer Shield — debt validation. 100% of (payment − $40 servicing) for months 1–4, then 35% for the rest of the term.\n\nElite Legal Practice / Legacy Capital Services — attorney model. Months 1–2 pass through in full (service fee + maintenance, less the draft fee); from month 3 Funding Tier keeps the tier rate of the service fee portion only.`],
          ["Survival Funnels", `Each backend has its own set of sliders = % of ALL that backend's deals reaching that milestone (cumulative, cascading).\n\nIf 25% complete, those same 25% also cleared break-even, P4, and P2.\n\nExpected Revenue = (P2−P4)% × rev2 + (P4−BE)% × rev4 + (BE−Comp)% × revBE + Comp% × fullRev`],
          ["Lead Quality", `Scales that backend's effective survival rates.\nFormula: effectiveRate = setRate × (0.35 + 0.65 × quality/100)\n\nAt 100%: unchanged. At 50%: ×0.68. At 0%: ×0.35 floor.\n\nCS and ELP carry separate quality sliders — an attorney-model book and a validation book rarely churn the same way.`],
          ["Cash Urgency + Stability Adjustment", `Cash urgency sets Level Debt's share:\n  LD% = 20 + (adjustedUrgency × 0.65)\n\nThe remainder splits between CS and ELP in proportion to their adjusted expected value, so the stronger perpetuity backend takes the larger tail share.\n\nThe stability penalty is computed on the unweighted mean of the CS and ELP effective funnels — deliberately independent of your portfolio sliders so the recommendation never chases itself:\n• Low blended completion (<50%) → up to +25pt\n• Low blended P2 rate (<50%) → up to +15pt\n• High funnel drop-off → up to +10pt`],
          ["Eligibility Floors", `Level Debt: $7,000 minimum enrolled debt.\nElite Legal Practice: $6,000 minimum, plus $250/mo payment capacity.\nConsumer Shield: $4,000 minimum.\n\nEnforced everywhere in this tool — including the portfolio routing sliders.`],
          ["ELP Term and the $250 Floor", `The term is set by what the client can afford to draft each month, not by the floor. $250/mo is only a minimum, and it caps how long the fee can be spread:\n\n  headroom = $250 − maintenance − draft fee\n  max term = floor(debt × fee% / headroom), capped at 60\n\nThe tool defaults to a ${ELP_DEFAULT_TARGET_TERM}-month program. Enter the client's draft to change it, or drag the slider to pick a term directly.`],
          ["Why Shorter Terms Earn More", `Months 1–2 pass through in full — service fee plus maintenance. Everything after is the tier rate on the service fee alone.\n\nA longer term shrinks the monthly service fee, so less of the total lands inside that 100% window:\n\n  revenue = fee × tier + fee × 2(1 − tier) / term + 2 × maintenance\n\nSo a longer term earns LESS in total and earns it LATER. Assuming the longest permitted term is the pessimistic corner on both axes, which is why it is no longer the default.`],
          ["ELP Tier Rate", `Funding Tier keeps 60% of the post-fee service amount from Payment 3 on, stepping to 65% once the book clears 100 billable files per month. The Portfolio Forecast deal count drives which tier this tool applies.`],
          ["ELP State Restrictions", `Legacy Capital Services cannot be sold in ${ELP_BLOCKED_STATES.join(", ")}. This tool models national economics — check state eligibility in the Router before routing a live deal.`],
          ["Break-Even Cohort With No Level Debt Benchmark", `Below $7,000 Level Debt cannot take the deal, so there is no 8% benchmark and no break-even month to show.\n\nThe break-even cohort still has to be worth something — those clients paid for half a program. This tool prices that cohort at the mid-program month instead of $0, which is the only sub-$7k range where Consumer Shield and Elite Legal Practice compete head to head.`],
          ["Break-Even + Liability Clear (Hyper Green)", "First month where the backend has both (a) broken even vs Level Debt AND (b) the chargeback window on the break-even payment has closed. The true zero-risk inflection point."],
          ["Revenue Contribution Per Cohort", `Each cohort = group of deals that dropped out at a specific funnel stage.\n\n• Cohort % = difference between adjacent funnel stages\n• Revenue per deal = cumulative revenue at that exit point\n• Contribution = cohort % × revenue per deal`],
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
// SNAPSHOT CARD HEADER
// ─────────────────────────────────────────────

function SnapshotHead({ k, logo, name, warn }: {
  k: BackendKey; logo: string; name: string; warn: string | null;
}) {
  const meta = BACKEND_META[k];
  return (
    <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:14, minHeight:34, flexWrap:"wrap" }}>
      <img src={logo} alt={name} style={{ height:26, width:"auto", objectFit:"contain" }} />
      <h2 style={{ margin:0, fontSize:16, fontWeight:800, color:"#0f172a" }}>{name}</h2>
      <span style={{ fontSize:10, fontWeight:800, letterSpacing:0.4, textTransform:"uppercase",
        color:meta.colorDark, background:meta.color+"1f", padding:"2px 8px", borderRadius:99 }}>
        {meta.service}
      </span>
      {warn && <span style={{ fontSize:10, fontWeight:800, color:FT_RED, background:FT_RED+"11", padding:"2px 8px", borderRadius:99 }}>{warn}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────

export default function FundingTierProfitabilityBalancer({ mode = "admin" }: { mode?: "admin" | "agent" }) {
  const [debtAmount,       setDebtAmount]       = useState(20000);
  const [csFunnel,         setCsFunnel]         = useState<Funnel>({ p2:75, p4:60, be:40, comp:25 });
  const [elpFunnel,        setElpFunnel]        = useState<Funnel>({ p2:75, p4:60, be:40, comp:25 });
  const [csLeadQuality,    setCsLeadQuality]    = useState(75);
  const [elpLeadQuality,   setElpLeadQuality]   = useState(75);
  const [elpFeeRate,       setElpFeeRate]       = useState(49);
  const [elpMaintFee,      setElpMaintFee]      = useState<number>(80);
  const [elpSplit,         setElpSplit]         = useState(false);
  // null = follow the ELP_DEFAULT_TARGET_TERM-month default; a number = the
  // client draft the customer can afford, which is what really sets the term.
  const [elpTargetDraft,   setElpTargetDraft]   = useState<number|null>(null);
  const [ldAttorneyModel,  setLdAttorneyModel]  = useState(false);
  const [ldSplitPayments,  setLdSplitPayments]  = useState(false);
  const [cashUrgency,      setCashUrgency]      = useState(50);
  const [levelRepPct,      setLevelRepPct]      = useState(1.25);
  const [csRepUpfront,     setCsRepUpfront]     = useState(200);
  const [csRepAfter4,      setCsRepAfter4]      = useState(75);
  const [portfolioDeals,   setPortfolioDeals]   = useState(100);
  const [portfolioAvgDebt, setPortfolioAvgDebt] = useState(18000);
  const [mixLdPct,         setMixLdPct]         = useState(53);
  const [mixElpPct,        setMixElpPct]        = useState(24);
  const [kbOpen,           setKbOpen]           = useState(false);
  const [openProgram,      setOpenProgram]      = useState<string|null>("CS Program A");

  const elpBaseTerms: ElpTerms = useMemo(() => ({
    feeRatePct: elpFeeRate, maintFee: elpMaintFee, split: elpSplit,
    tierRate: elpTierRateForFiles(portfolioDeals),
  }), [elpFeeRate, elpMaintFee, elpSplit, portfolioDeals]);

  /**
   * Term is per-deal: the same client draft buys a shorter program on a
   * smaller debt. Resolve it against whatever debt is being analysed rather
   * than pinning one term across every deal size.
   */
  const elpTermsFor = useCallback((debt: number): ElpTerms => {
    // Default the client draft to whatever Consumer Shield would charge on the
    // same deal. That makes the two programs comparable on the one number the
    // client actually feels — the monthly payment — instead of comparing a
    // 36-month CS program against an ELP program stretched to the $250 floor.
    const target = elpTargetDraft ?? getProgram(debt)?.payment ?? null;
    return {
      ...elpBaseTerms,
      term: target == null
        ? ELP_DEFAULT_TARGET_TERM
        : elpTermForDraft(debt, elpBaseTerms, target),
    };
  }, [elpBaseTerms, elpTargetDraft]);

  const elpTerms = useMemo(() => elpTermsFor(debtAmount), [elpTermsFor, debtAmount]);

  const csEff  = useMemo(() => applyLeadQuality(csFunnel, csLeadQuality),   [csFunnel, csLeadQuality]);
  const elpEff = useMemo(() => applyLeadQuality(elpFunnel, elpLeadQuality), [elpFunnel, elpLeadQuality]);

  const stability = useMemo(
    () => calcStabilityAdjustedUrgency(cashUrgency, blendPerpetuityRates(csEff, elpEff)),
    [cashUrgency, csEff, elpEff]
  );

  const analysisArgs = useMemo(() => ({
    csFunnel, csLeadQuality, elpFunnel, elpLeadQuality, ldAttorneyModel, ldSplitPayments,
    adjustedUrgency: stability.adjusted, levelRepPct, csRepUpfront, csRepAfter4,
  }), [csFunnel, csLeadQuality, elpFunnel, elpLeadQuality, ldAttorneyModel, ldSplitPayments, stability.adjusted, levelRepPct, csRepUpfront, csRepAfter4]);

  const deal = useMemo(
    () => analyzeDeal({ debtAmount, elpTerms: elpTermsFor(debtAmount), ...analysisArgs }),
    [debtAmount, elpTermsFor, analysisArgs]);
  const portfolioDeal = useMemo(
    () => analyzeDeal({ debtAmount: portfolioAvgDebt, elpTerms: elpTermsFor(portfolioAvgDebt), ...analysisArgs }),
    [portfolioAvgDebt, elpTermsFor, analysisArgs]);

  const routing = useMemo(() => cashUrgencyToRouting(
    stability.adjusted,
    Math.max(portfolioDeal.cs.adjustedScore, 0),
    Math.max(portfolioDeal.elp.adjustedScore, 0),
    portfolioDeal.cs.eligible,
    portfolioDeal.elp.eligible,
  ), [stability.adjusted, portfolioDeal]);

  // ── portfolio mix, eligibility-clamped ────────────────────
  const ldOk  = portfolioAvgDebt >= BACKEND_META.LD.minDebt;
  const elpOk = portfolioAvgDebt >= BACKEND_META.ELP.minDebt;
  const csOk  = portfolioAvgDebt >= BACKEND_META.CS.minDebt;

  const effLdPct  = ldOk  ? clamp(mixLdPct, 0, 100) : 0;
  const effElpPct = elpOk ? clamp(mixElpPct, 0, 100 - effLdPct) : 0;
  const effCsPct  = csOk  ? Math.max(0, 100 - effLdPct - effElpPct) : 0;

  const setLd  = (v:number) => { if (!ldOk) return; const nv = clamp(v,0,100); setMixLdPct(nv); if (nv + effElpPct > 100) setMixElpPct(100 - nv); };
  const setElp = (v:number) => { if (!elpOk) return; const nv = clamp(v,0,100 - effLdPct); setMixElpPct(nv); };

  const routingMatches =
    Math.abs(effLdPct - (ldOk ? routing.ldPct : 0)) <= 2 &&
    Math.abs(effElpPct - (elpOk ? routing.elpPct : 0)) <= 2;

  const applyRecommendedRouting = () => {
    if (ldOk)  setMixLdPct(routing.ldPct);   else setMixLdPct(0);
    if (elpOk) setMixElpPct(routing.elpPct); else setMixElpPct(0);
  };

  const portfolio = useMemo(() => {
    const ldCount  = Math.round(portfolioDeals * effLdPct / 100);
    const elpCount = Math.round(portfolioDeals * effElpPct / 100);
    const csCount  = Math.max(0, portfolioDeals - ldCount - elpCount);
    const a = portfolioDeal;

    const ldGross  = round2(ldCount  * a.ld.expectedRevenue);
    const csGross  = round2(csCount  * a.cs.expectedRevenue);
    const elpGross = round2(elpCount * a.elp.expectedRevenue);

    const ldRep  = round2(ldCount  * a.ld.repCost);
    const csRep  = round2(csCount  * a.cs.repCost);
    const elpRep = round2(elpCount * a.elp.repCost);

    const csUpside  = round2(csCount  * a.cs.fullRevenue);
    const elpUpside = round2(elpCount * a.elp.fullRevenue);

    return {
      ldCount, csCount, elpCount,
      ldGross, csGross, elpGross,
      ldRep, csRep, elpRep,
      csUpside, elpUpside,
      totalGross: round2(ldGross + csGross + elpGross),
      totalRep:   round2(ldRep + csRep + elpRep),
      totalNet:   round2(ldGross + csGross + elpGross - ldRep - csRep - elpRep),
      totalUpside: round2(ldGross + csUpside + elpUpside),
    };
  }, [portfolioDeals, effLdPct, effElpPct, portfolioDeal]);

  const recLogo = deal.recommended ? BACKEND_META[deal.recommended].logo : null;

  const csRevBE  = deal.cs.breakEvenRefRevenue;
  const elpRevBE = deal.elp.breakEvenRefRevenue;

  const WL = ({ ch }: { ch:string }) => (
    <div style={{ fontSize:9, fontWeight:700, color:"#94a3b8", marginBottom:3,
      textTransform:"uppercase", letterSpacing:0.4 }}>{ch}</div>
  );

  // ELP economics across the debt bands, at the current terms
  const elpBandSweep = useMemo(() => {
    const samples = [7500, 12500, 17500, 22500, 27500, 40000, 60000];
    return samples.map(d => {
      const s = elpSchedule(d, elpTermsFor(d));
      const ldR = d >= 7000 ? round2(d * 0.08) : 0;
      const be = elpBreakEven(ldR, s);
      const band = getLcBand(d);
      return { debt:d, s, ldR, be, band, full: elpFullRevenue(s) };
    });
  }, [elpTermsFor]);

  // The two survival funnels moved out of the old sticky header and into a
  // body panel — too much control surface for a hero, and they read better
  // beside the lead-quality panels they feed.
  const funnelPanel = (
    <div style={card}>
      <h2 style={{ margin:"0 0 4px", fontSize:18, fontWeight:800, color:"#0f172a" }}>Deal Survival Funnels</h2>
      <div style={{ fontSize:13, color:"#64748b", lineHeight:1.6, marginBottom:14 }}>
        Percentage of all deals on each perpetuity backend reaching each milestone. Cascading — completing implies
        clearing every earlier stage.
      </div>
      <div className="ft-grid-2">
        <div>
          <div style={{ fontSize:11, fontWeight:800, color:FT_BLUE, marginBottom:6,
            textTransform:"uppercase", letterSpacing:0.4 }}>Consumer Shield</div>
          <CascadingFunnel prefix="CS" funnel={csFunnel} onChange={setCsFunnel} accent={FT_BLUE} />
        </div>
        <div>
          <div style={{ fontSize:11, fontWeight:800, color:FT_CYAN, marginBottom:6,
            textTransform:"uppercase", letterSpacing:0.4 }}>Elite Legal Practice</div>
          <CascadingFunnel prefix="ELP" funnel={elpFunnel} onChange={setElpFunnel} accent={FT_CYAN} />
        </div>
      </div>
    </div>
  );

  const heroSlot = (
    <div style={{ display:"grid", gap:10 }}>
      <ControlRow result={{ label:"Recommended Backend", value:deal.recommendedLabel }}>
        <Control label="Enrolled Debt" type="number" min={0} step={100}
          value={String(debtAmount)} onChange={v => setDebtAmount(Number(v))}
          hint={debtAmount > 0 && debtAmount < 7000
            ? <span style={{ fontSize:10, color:"#f5a524", fontWeight:700 }}>Under $7k — Level Debt cannot accept</span>
            : <span style={{ fontSize:10, color:"rgba(245,248,247,0.55)", fontWeight:600 }}>
                {[deal.ld, deal.elp, deal.cs].filter(b => b.eligible).length} of 3 backends eligible
              </span>} />
        <div style={{ display:"flex", flexDirection:"column", gap:6, minWidth:190, flex:1 }}>
          <label style={{ fontSize:10, fontWeight:800, letterSpacing:"0.04em", color:"rgba(245,248,247,0.68)" }}>
            CASH URGENCY
          </label>
          <input type="range" min={0} max={100} step={1} value={cashUrgency}
            onChange={e => setCashUrgency(Number(e.target.value))}
            style={{ width:"100%", accentColor:"#f5a524" }} />
          <div style={{ fontSize:11, fontWeight:700, color:"#f5a524" }}>
            {cashUrgency}%{stability.penalty > 0 ? ` → ${stability.adjusted}% adjusted` : ""}
            <span style={{ color:"rgba(245,248,247,0.55)", fontWeight:600 }}>
              {"  ·  "}Route {routing.ldPct}% LD / {routing.elpPct}% ELP / {routing.csPct}% CS
            </span>
          </div>
        </div>
      </ControlRow>
      <MetricsGrid>
        <Metric label="LEVEL DEBT — SETTLEMENT"
          value={deal.ld.eligible ? money.format(deal.ld.expectedRevenue) : "Not eligible"} />
        <Metric label="ELITE LEGAL — RESOLUTION" accent
          value={deal.elp.eligible ? money.format(deal.elp.expectedRevenue) : "Not eligible"} />
        <Metric label="CONSUMER SHIELD — VALIDATION"
          value={deal.cs.eligible ? money.format(deal.cs.expectedRevenue) : "Not eligible"} />
        <Metric label="BREAK-EVEN VS LD"
          value={deal.ld.eligible
            ? `ELP ${deal.elp.breakEvenMonth ? "Mo "+deal.elp.breakEvenMonth : "—"} · CS ${deal.cs.breakEvenMonth ? "Mo "+deal.cs.breakEvenMonth : "—"}`
            : "No LD benchmark"} />
      </MetricsGrid>
    </div>
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

      <ToolShell
        mode={mode}
        tool="Profit Engine"
        eyebrow={`${mode === "admin" ? "ADMIN" : "AGENT"} · BACKEND ROUTING & MARGIN`}
        badge={{ text: mode === "admin" ? "ADMIN ONLY" : "AGENT" }}
        title="Profit Engine"
        subtitle="Level Debt, Elite Legal Practice and Consumer Shield on the same deal — expected revenue, break-even and portfolio routing under one set of survival assumptions."
        heroSlot={heroSlot}
      >

      {/* MAIN — ToolShell supplies the frame and padding */}
      <div style={{ display:"grid", gap:18 }}>

        {funnelPanel}

        {/* Headline metrics now live in the ToolShell hero — the recommendation
            and the three expected-revenue figures were duplicated here. */}

        {/* Head-to-head */}
        <BackendComparison analysis={deal} />

        {/* Cash urgency */}
        <CashUrgencyPanel
          urgency={cashUrgency} onChange={setCashUrgency}
          adjustedUrgency={stability.adjusted}
          stabilityPenalty={stability.penalty}
          stabilityReason={stability.reason}
          routing={routing} debtAmount={debtAmount} analysis={deal}
        />

        {/* ELP program terms */}
        <ElpTermsPanel terms={elpTerms} sched={deal.elp.schedule} debtAmount={debtAmount} files={portfolioDeals}
          targetDraft={elpTargetDraft} onDraftChange={setElpTargetDraft}
          csPayment={deal.cs.payment} csTerm={deal.cs.term} ldRevenue={deal.ld.expectedRevenue}
          onChange={t => { setElpFeeRate(t.feeRatePct); setElpMaintFee(t.maintFee); setElpSplit(t.split); }} />

        {/* Snapshots — settlement, resolution, validation */}
        <div className="ft-grid-3">
          {/* LEVEL DEBT — settlement */}
          <div style={card}>
            <SnapshotHead k="LD" logo={LEVEL_DEBT_LOGO} name="Level Debt"
              warn={!deal.ld.eligible ? "Under $7k" : null} />
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:11, flexWrap:"wrap" }}>
              <span style={{ fontSize:11, fontWeight:800, color:"#64748b", textTransform:"uppercase", letterSpacing:0.3 }}>
                Program Fee
              </span>
              <InlineTip width={300} text={
                `Level Debt runs an attorney model in ${LD_ATTORNEY_STATES.length} states, where the client program fee is `
                + `${Math.round(LD_PROGRAM_FEE_ATTORNEY*100)}% instead of ${Math.round(LD_PROGRAM_FEE_STANDARD*100)}%:\n\n`
                + LD_ATTORNEY_STATES.join(", ")
                + `\n\nThis raises what the CLIENT pays each month. It does not change Funding Tier's 8% — that is a share of enrolled debt and is unaffected by the fee rate.`} />
              <div style={{ display:"flex", gap:5, flex:1, minWidth:180 }}>
                {[{ v:false, l:`Standard ${Math.round(LD_PROGRAM_FEE_STANDARD*100)}%` },
                  { v:true,  l:`Attorney ${Math.round(LD_PROGRAM_FEE_ATTORNEY*100)}%` }].map(o => (
                  <button key={String(o.v)} onClick={() => setLdAttorneyModel(o.v)}
                    style={{ flex:1, padding:"6px 5px", borderRadius:8, cursor:"pointer", fontWeight:800, fontSize:11,
                      border:`1px solid ${ldAttorneyModel===o.v?FT_GREEN:"#cbd5e1"}`,
                      background:ldAttorneyModel===o.v?FT_GREEN+"1a":"#fff",
                      color:ldAttorneyModel===o.v?FT_GREEN_DARK:"#64748b" }}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:11, flexWrap:"wrap" }}>
              <span style={{ fontSize:11, fontWeight:800, color:"#64748b", textTransform:"uppercase", letterSpacing:0.3 }}>
                Draft Schedule
              </span>
              <div style={{ display:"flex", gap:5, flex:1, minWidth:180 }}>
                {[{ v:false, l:"Monthly · 1 draft" }, { v:true, l:"Semi-monthly · 2" }].map(o => (
                  <button key={String(o.v)} onClick={() => setLdSplitPayments(o.v)}
                    style={{ flex:1, padding:"6px 5px", borderRadius:8, cursor:"pointer", fontWeight:800, fontSize:11,
                      border:`1px solid ${ldSplitPayments===o.v?FT_GREEN:"#cbd5e1"}`,
                      background:ldSplitPayments===o.v?FT_GREEN+"1a":"#fff",
                      color:ldSplitPayments===o.v?FT_GREEN_DARK:"#64748b" }}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
            <div className="ft-grid-2-inner">
              <MetricCard title="Debt Amount" value={money.format(deal.debtAmount)} />
              <MetricCard title="Payment / Monthly"
                value={deal.ld.program.eligible ? money.format(deal.ld.program.monthlyPayment) : "N/A"}
                inlineTag={deal.ld.program.eligible ? `${deal.ld.program.term} months` : undefined}
                tooltip={deal.ld.program.eligible
                  ? `What actually leaves the client's account each month.\n\n`
                    + `Settlement deposit ${money.format(deal.ld.program.monthlyDeposit)} — estimated settlement (${Math.round(LD_ESTIMATED_SETTLEMENT_RATE*100)}% of enrolled debt) ${money.format(deal.ld.program.estimatedSettlement)} + program fees (${Math.round(deal.ld.program.feeRate*100)}%) ${money.format(deal.ld.program.programFees)} = ${money.format(deal.ld.program.totalProgramCost)} over ${deal.ld.program.term} months.\n\n`
                    + `+ $${LD_LEGAL_FEE_MONTHLY} legal fee\n+ $${LD_GATEWAY_FEE_MONTHLY} gateway (Global Holdings escrow)`
                    + (deal.ld.program.splitPayments ? `\n+ $${LD_SPLIT_SURCHARGE_PER_PAYMENT} × 2 drafts` : "")
                    + `\n= ${money.format(deal.ld.program.monthlyPayment)}`
                    + (deal.ld.program.perDraft ? ` (2 × ${money.format(deal.ld.program.perDraft)})` : "")
                    + `\n\nMonth 1 is ${money.format(deal.ld.program.firstMonthPayment)} — the $${LD_GATEWAY_SETUP_FEE} gateway setup fee is charged once.\n\n`
                    + `${ldAttorneyModel ? "Attorney-model rate in play." : `Attorney-model states use ${Math.round(LD_PROGRAM_FEE_ATTORNEY*100)}% instead.`}`
                  : undefined} />
              <MetricCard title="Settlement Deposit"
                value={deal.ld.program.eligible ? money.format(deal.ld.program.monthlyDeposit) : "N/A"}
                inlineTag={deal.ld.program.belowMinimum ? "⚠ under $250" : "of the payment"}
                subtitle={deal.ld.program.eligible
                  ? `+ ${money.format(deal.ld.program.ancillaryMonthly)} fees · month 1 ${money.format(deal.ld.program.firstMonthPayment)}`
                  : undefined} />
              <MetricCard title="Gross Revenue" value={deal.ld.eligible ? money.format(deal.ld.grossRevenue) : "N/A"}
                subtitle="8% of enrolled debt — unaffected by client fees" />
              <MetricCard title="Commission Paid To Agent" value={deal.ld.eligible ? money.format(deal.ld.repCost) : "N/A"} />
              <MetricCard title="Net Revenue" highlight={deal.ld.eligible}
                value={deal.ld.eligible ? money.format(deal.ld.netRevenue) : "N/A"} />
              {deal.ld.program.belowMinimum && (
                <div style={{ ...card, background:FT_AMBER+"11", border:`1px solid ${FT_AMBER}44` }}>
                  <div style={{ fontSize:12, fontWeight:800, color:"#92400e", lineHeight:1.5 }}>
                    ⚠ Derived deposit is under the {money.format(LD_MIN_DEPOSIT)} minimum
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ELITE LEGAL PRACTICE — resolution */}
          <div style={card}>
            <SnapshotHead k="ELP" logo={ELP_LOGO} name="Elite Legal Practice"
              warn={!deal.elp.eligible ? "Under $6k" : null} />
            <div className="ft-grid-2-inner">
              <MetricCard title="Debt Amount" value={money.format(deal.debtAmount)} />
              <MetricCard title="Payment / Monthly"
                value={deal.elp.eligible ? money.format(deal.elp.schedule.grossPayment) : "N/A"}
                inlineTag={deal.elp.term ? `${deal.elp.term} months` : undefined}
                tooltip={deal.elp.eligible
                  ? `Service fee ${money.format(deal.elp.schedule.serviceFeeMonthly)} + ${money.format(deal.elp.schedule.maintFee)} maintenance + $${deal.elp.schedule.draftMonthly} processing.\n\nSet this in the Program Terms panel above — the payment is what sets the term.`
                  : undefined} />
              <MetricCard title="Service Fee / Monthly"
                value={deal.elp.eligible ? money.format(deal.elp.schedule.serviceFeeMonthly) : "N/A"}
                tooltip={`${deal.elp.schedule.feeRatePct}% of enrolled debt spread across the term. The only component Funding Tier shares in from Payment 3 on.`} />
              <MetricCard title="Front Revenue" highlight={deal.elp.eligible}
                value={deal.elp.eligible ? money.format(deal.elp.revAfter2) : "N/A"}
                inlineTag="Months 1–2 total"
                tooltip={`${money.format(deal.elp.schedule.earlyRevenue)} per month for the first two payments — 100% pass-through, maintenance not yet backed out.`} />
              <MetricCard title="Tail End – Revenue" highlight={deal.elp.eligible}
                value={deal.elp.eligible ? money.format(deal.elp.schedule.lateRevenue) : "N/A"}
                inlineTag={deal.elp.term ? `Months 3–${deal.elp.term}, per month` : undefined} />
            </div>
          </div>

          {/* CONSUMER SHIELD — validation */}
          <div style={card}>
            <SnapshotHead k="CS" logo={CS_LOGO} name="Consumer Shield"
              warn={!deal.cs.eligible ? "Under $4k" : null} />
            <div className="ft-grid-2-inner">
              <MetricCard title="Debt Amount" value={money.format(deal.debtAmount)} />
              <MetricCard title="Payment / Monthly" value={deal.cs.eligible ? money.format(deal.cs.payment) : "N/A"}
                inlineTag={deal.cs.term ? `${deal.cs.term} months` : undefined} />
              <MetricCard title="Net Payment" value={deal.cs.eligible ? money.format(deal.cs.netPayment) : "N/A"}
                tooltip={`${money.format(deal.cs.payment)} program payment minus $40 servicing = ${money.format(deal.cs.netPayment)} net. Base before the 100% (months 1–4) or 35% (month 5+) split.`} />
              <MetricCard title="Front Revenue" highlight={deal.cs.eligible}
                value={deal.cs.eligible ? money.format(deal.cs.frontRevenue) : "N/A"}
                inlineTag="Months 1–4 total"
                tooltip={`${money.format(deal.cs.netPayment)} per month for the first four payments — 100% of the net payment.`} />
              <MetricCard title="Tail End – Revenue" highlight={deal.cs.eligible}
                value={deal.cs.eligible ? money.format(deal.cs.tailMonthly) : "N/A"}
                inlineTag={deal.cs.term ? `Months 5–${deal.cs.term}, per month` : undefined} />
            </div>
          </div>
        </div>

        {/* Lead quality — side by side */}
        <div className="ft-grid-2">
          <LeadQualityPanel prefix="CS"  quality={csLeadQuality}  onChange={setCsLeadQuality}  funnel={csFunnel}  eff={csEff}  accent={FT_BLUE} />
          <LeadQualityPanel prefix="ELP" quality={elpLeadQuality} onChange={setElpLeadQuality} funnel={elpFunnel} eff={elpEff} accent={FT_CYAN} />
        </div>

        {/* Funnel explainers */}
        <Accordion title="Consumer Shield — Expected Revenue Funnel" defaultOpen={true} accent={FT_BLUE}
          badge={money.format(deal.cs.expectedRevenue)+" / deal"}>
          <FunnelExplainer prefix="CS" accent={FT_BLUE} eff={csEff}
            rev2={deal.cs.revAfter2} rev4={deal.cs.revAfter4} revBE={csRevBE}
            fullRev={deal.cs.fullRevenue} ldRev={deal.ld.expectedRevenue} expected={deal.cs.expectedRevenue} />
        </Accordion>

        <Accordion title="Elite Legal Practice — Expected Revenue Funnel" defaultOpen={true} accent={FT_CYAN}
          badge={money.format(deal.elp.expectedRevenue)+" / deal"}>
          <FunnelExplainer prefix="ELP" accent={FT_CYAN} eff={elpEff}
            rev2={deal.elp.revAfter2} rev4={deal.elp.revAfter4} revBE={elpRevBE}
            fullRev={deal.elp.fullRevenue} ldRev={deal.ld.expectedRevenue} expected={deal.elp.expectedRevenue} />
        </Accordion>

        {/* Milestone timelines */}
        <Accordion title="Consumer Shield Revenue Milestones" defaultOpen={true} accent={FT_BLUE} badge="Hover dots for detail">
          <MilestonesTimeline timeline={deal.cs.timeline}
            breakEvenMonth={deal.cs.breakEvenMonth} liabilityClearMonth={deal.cs.liabilityClearMonth}
            levelDebtRevenue={deal.ld.expectedRevenue} debtAmount={deal.debtAmount}
            accent={FT_BLUE} accentDark="#1552a8"
            frontPhase="Front" frontEndsMonth={4}
            frontLabel="Front (Mo 1–4): 100% net" tailLabel="Tail-End (Mo 5+): 35% net" />
          <div className="ft-grid-4" style={{ marginTop:16 }}>
            <MetricCard title="After CS Payment 2" value={money.format(deal.cs.revAfter2)} subtitle="Early quality signal" />
            <MetricCard title="After CS Payment 4" value={money.format(deal.cs.revAfter4)} subtitle="Front window closes" />
            <MetricCard title="CS 1/2 Program"     value={money.format(deal.cs.revAtHalf)} subtitle="Mid-term reference" />
            <MetricCard title="CS Full Program"    value={money.format(deal.cs.fullRevenue)} subtitle="Best-case ceiling" />
          </div>
        </Accordion>

        <Accordion title="Elite Legal Practice Revenue Milestones" defaultOpen={true} accent={FT_CYAN} badge="Hover dots for detail">
          <MilestonesTimeline timeline={deal.elp.timeline}
            breakEvenMonth={deal.elp.breakEvenMonth} liabilityClearMonth={deal.elp.liabilityClearMonth}
            levelDebtRevenue={deal.ld.expectedRevenue} debtAmount={deal.debtAmount}
            accent={FT_CYAN} accentDark={FT_CYAN_DARK}
            frontPhase="Pass-Through" frontEndsMonth={2}
            frontLabel="Pass-Through (Mo 1–2): 100% less draft fee"
            tailLabel={`Tier Share (Mo 3+): ${Math.round(deal.elp.schedule.tierRate*100)}% of service fee`} />
          <div className="ft-grid-4" style={{ marginTop:16 }}>
            <MetricCard title="After ELP Payment 2" value={money.format(deal.elp.revAfter2)} subtitle="Pass-through window closes" />
            <MetricCard title="After ELP Payment 4" value={money.format(deal.elp.revAfter4)} subtitle="Commission milestone cleared" />
            <MetricCard title="ELP 1/2 Program"     value={money.format(deal.elp.revAtHalf)} subtitle="Mid-term reference" />
            <MetricCard title="ELP Full Program"    value={money.format(deal.elp.fullRevenue)} subtitle="Best-case ceiling" />
          </div>
          {deal.elp.eligible && (
            <div style={{ marginTop:16 }}>
              <RevenueCurve
                points={deal.elp.timeline.map(r => ({ month:r.month, y:r.cumulativeRevenue }))}
                accent={FT_CYAN} accentDark={FT_CYAN_DARK}
                notableMonths={[1, 2, ...(deal.elp.breakEvenMonth?[deal.elp.breakEvenMonth]:[]), deal.elp.term]} />
            </div>
          )}
        </Accordion>

        {/* Payout + liability */}
        <PayoutLiabilityAccordion />

        {/* CS offerings */}
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

        {/* ELP band sweep */}
        <Accordion title="Elite Legal Practice — Economics Across Debt Bands" accent={FT_CYAN}
          badge={`${elpTerms.feeRatePct}% fee · ${money.format(elpTerms.maintFee)} maint · ${elpTerms.split?"split":"monthly"}`}>
          <div style={{ fontSize:13, color:"#64748b", lineHeight:1.6, marginBottom:12 }}>
            How the derived term, client draft and revenue move across enrolled-debt bands at the terms currently set above.
            ELP has no fixed program table — the $250 draft floor sets the term for every deal individually.
          </div>
          <div style={{ overflowX:"auto", borderRadius:12, border:"1px solid #e2e8f0" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead><tr style={{ background:"#f8fafc" }}>
                {["Enrolled Debt","Commission Band","Derived Term","Client Draft","Pmts 1–2","Pmts 3+","Full-Term Revenue","Level Debt 8%","Break-Even"].map(h=><th key={h} style={TH}>{h}</th>)}
              </tr></thead>
              <tbody>
                {elpBandSweep.map((r,i)=>(
                  <tr key={r.debt} style={{ background:i%2?"#f8fafc":"#fff" }}>
                    <td style={{ ...TD, fontWeight:800 }}>{money.format(r.debt)}</td>
                    <td style={TD}>{r.band ? `${r.band.code} · ${money.format(r.band.total)}` : "—"}</td>
                    <td style={TD}>{r.s.term} mo</td>
                    <td style={TD}>{money.format(r.s.grossPayment)}</td>
                    <td style={{ ...TD, color:FT_CYAN_DARK, fontWeight:700 }}>{money.format(r.s.earlyRevenue)}</td>
                    <td style={{ ...TD, color:FT_CYAN_DARK, fontWeight:700 }}>{money.format(r.s.lateRevenue)}</td>
                    <td style={{ ...TD, fontWeight:800 }}>{money.format(r.full)}</td>
                    <td style={TD}>{money.format(r.ldR)}</td>
                    <td style={{ ...TD, borderRight:"none", color:r.be?FT_AMBER:"#94a3b8", fontWeight:700 }}>{r.be ? `Month ${r.be}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Accordion>

        {/* Monthly revenue timelines */}
        <Accordion title="Consumer Shield Monthly Revenue Timeline" accent={FT_BLUE}>
          <MonthlyRevenueTable timeline={deal.cs.timeline} breakEvenMonth={deal.cs.breakEvenMonth}
            liabilityClearMonth={deal.cs.liabilityClearMonth} frontPhase="Front" frontEndsMonth={4}
            accent={FT_BLUE} accentDark="#1552a8" />
        </Accordion>

        <Accordion title="Elite Legal Practice Monthly Revenue Timeline" accent={FT_CYAN}>
          <MonthlyRevenueTable timeline={deal.elp.timeline} breakEvenMonth={deal.elp.breakEvenMonth}
            liabilityClearMonth={deal.elp.liabilityClearMonth} frontPhase="Pass-Through" frontEndsMonth={2}
            accent={FT_CYAN} accentDark={FT_CYAN_DARK} />
        </Accordion>

        {/* Rep economics */}
        <div style={card}>
          <h2 style={{ margin:"0 0 4px", fontSize:18, fontWeight:800, color:"#0f172a" }}>Sales Rep Economics</h2>
          <div style={{ fontSize:13, color:"#64748b", lineHeight:1.6, marginBottom:14 }}>
            Level Debt and Consumer Shield payouts are editable. Elite Legal Practice pays a fixed band schedule, so it is read from the live commission table.
          </div>
          <div className="ft-grid-3">
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
          <div className="ft-grid-3" style={{ marginTop:14 }}>
            <MetricCard title="LD Commission — This Deal" accent={FT_GREEN_DARK}
              value={deal.ld.eligible ? money.format(deal.ld.repCost) : "N/A"} subtitle="Paid on the 20th of Month 3" />
            <MetricCard title="CS Commission — Expected" accent={FT_BLUE}
              value={deal.cs.eligible ? money.format(deal.cs.repCost) : "N/A"}
              subtitle={`Upfront + milestone × ${csEff.p4}% effective P4`} />
            <MetricCard title="ELP Commission — Expected" accent={FT_CYAN_DARK}
              value={deal.elp.eligible ? money.format(deal.elp.repCost) : "N/A"}
              subtitle={deal.elp.eligible ? `${deal.elp.bandLabel} — P2 and P4 milestones weighted by effective survival` : "Under $6k"} />
          </div>
        </div>

        {/* Portfolio forecast */}
        <div style={card}>
          <h2 style={{ margin:"0 0 4px", fontSize:18, fontWeight:800, color:"#0f172a" }}>Portfolio Forecast</h2>

          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12,
            background: routingMatches ? FT_GREEN+"11" : FT_AMBER+"11",
            border:`1px solid ${routingMatches ? FT_GREEN+"44" : FT_AMBER+"44"}`,
            borderRadius:12, padding:"12px 16px", marginBottom:16 }}>
            <div style={{ flex:1, minWidth:280 }}>
              <div style={{ fontSize:13, fontWeight:700, color:routingMatches ? FT_GREEN_DARK : "#92400e" }}>
                {routingMatches
                  ? `✓ Portfolio routing matches the stability-adjusted recommendation (${routing.ldPct}% LD / ${routing.csPct}% CS / ${routing.elpPct}% ELP) for the ${routing.horizon} cash horizon.`
                  : `⚠ Portfolio routing (${effLdPct}% LD / ${effCsPct}% CS / ${effElpPct}% ELP) does not match the recommendation (${routing.ldPct}% LD / ${routing.csPct}% CS / ${routing.elpPct}% ELP) for the ${routing.horizon} cash horizon.`}
              </div>
              <div style={{ fontSize:12, color:"#64748b", marginTop:4, lineHeight:1.5 }}>
                {routing.rationale}
                {stability.penalty > 0 && ` Stability adjustment of +${stability.penalty}pt applied due to survival rate pressure.`}
              </div>
            </div>
            <button onClick={applyRecommendedRouting}
              style={{ flexShrink:0, padding:"10px 18px", borderRadius:10, border:"none",
                fontWeight:800, fontSize:13, cursor:routingMatches?"default":"pointer",
                background:routingMatches?"#e2e8f0":FT_AMBER, color:routingMatches?"#94a3b8":"#fff",
                boxShadow:routingMatches?"none":"0 4px 14px rgba(245,158,11,0.4)",
                opacity:routingMatches?0.7:1 }}>
              {routingMatches ? "✓ APPLIED" : "ADJUST FOR CASH URGENCY NEEDED"}
            </button>
          </div>

          {!csOk && (
            <div style={{ background:FT_RED+"11", border:`1px solid ${FT_RED}33`, borderRadius:12,
              padding:"12px 14px", marginBottom:16, fontSize:13, fontWeight:700, color:FT_RED }}>
              ⛔ Average debt below {money.format(BACKEND_META.CS.minDebt)} — no backend will accept this portfolio.
            </div>
          )}

          <div className="ft-grid-2">
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:"#334155", marginBottom:7 }}>Number of Deals</div>
              <input type="number" value={portfolioDeals} onChange={e => setPortfolioDeals(Number(e.target.value))}
                min={1} step={1} style={{ width:"100%", padding:"10px 12px", borderRadius:10,
                  border:"1px solid #cbd5e1", fontSize:15, color:"#0f172a", background:"#fff", boxSizing:"border-box" }} />
              <div style={{ fontSize:11, color:"#94a3b8", marginTop:4 }}>
                Also sets the ELP tier rate — {Math.round(elpTerms.tierRate*100)}% at {portfolioDeals} billable files/mo
                {portfolioDeals < ELP_TIER_RATE_FILE_THRESHOLD ? ` (65% at ${ELP_TIER_RATE_FILE_THRESHOLD}+)` : ""}
              </div>
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:"#334155", marginBottom:7 }}>Average Debt Amount</div>
              <input type="number" value={portfolioAvgDebt} onChange={e => setPortfolioAvgDebt(Number(e.target.value))}
                min={4000} step={100} style={{ width:"100%", padding:"10px 12px", borderRadius:10,
                  border:"1px solid #cbd5e1", fontSize:15, color:"#0f172a", background:"#fff", boxSizing:"border-box" }} />
              <div style={{ fontSize:11, color:"#94a3b8", marginTop:4 }}>
                Eligible here: {[ldOk&&"Level Debt", elpOk&&"Elite Legal Practice", csOk&&"Consumer Shield"].filter(Boolean).join(", ") || "none"}
              </div>
            </div>
          </div>

          <div className="ft-grid-2" style={{ marginTop:14 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:"#334155", marginBottom:7 }}>
                % Routed to Level Debt
                {!ldOk && <span style={{ color:FT_RED, fontWeight:800, marginLeft:6 }}>(forced 0% — under $7k)</span>}
                {ldOk && effLdPct !== routing.ldPct && <span style={{ color:FT_AMBER, fontWeight:700, marginLeft:6, fontSize:11 }}>Rec: {routing.ldPct}%</span>}
              </div>
              <input type="range" min={0} max={100} step={1} value={effLdPct}
                onChange={e => setLd(Number(e.target.value))} disabled={!ldOk}
                style={{ width:"100%", accentColor:FT_GREEN, opacity:ldOk?1:0.4 }} />
              <div style={{ fontSize:12, fontWeight:700, color:FT_GREEN_DARK, marginTop:3 }}>{effLdPct}%</div>
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:"#334155", marginBottom:7 }}>
                % Routed to Elite Legal Practice
                {!elpOk && <span style={{ color:FT_RED, fontWeight:800, marginLeft:6 }}>(forced 0% — under $6k)</span>}
                {elpOk && effElpPct !== routing.elpPct && <span style={{ color:FT_AMBER, fontWeight:700, marginLeft:6, fontSize:11 }}>Rec: {routing.elpPct}%</span>}
              </div>
              <input type="range" min={0} max={100 - effLdPct} step={1} value={effElpPct}
                onChange={e => setElp(Number(e.target.value))} disabled={!elpOk}
                style={{ width:"100%", accentColor:FT_CYAN, opacity:elpOk?1:0.4 }} />
              <div style={{ fontSize:12, fontWeight:700, color:FT_CYAN_DARK, marginTop:3 }}>{effElpPct}%</div>
            </div>
          </div>

          <div style={{ marginTop:10, padding:"9px 13px", background:FT_BLUE+"0d",
            border:`1px solid ${FT_BLUE}33`, borderRadius:10, fontSize:12, color:"#475569" }}>
            <strong style={{ color:FT_BLUE }}>Consumer Shield takes the remainder: {effCsPct}%</strong>
            {" "}— the three shares always sum to 100%. Move Level Debt or Elite Legal Practice and CS absorbs the difference.
          </div>

          <div className="ft-grid-4" style={{ marginTop:16 }}>
            <MetricCard title="Deal Split" value={`${portfolio.ldCount} / ${portfolio.elpCount} / ${portfolio.csCount}`}
              subtitle="Level Debt / Elite Legal Practice / Consumer Shield" />
            <MetricCard title="Expected Gross Revenue" value={money.format(portfolio.totalGross)}
              subtitle={`Across ${portfolioDeals} deals at ${money.format(portfolioAvgDebt)} average`} />
            <MetricCard title="Total Rep Cost" value={money.format(portfolio.totalRep)} />
            <MetricCard title="Expected Net Revenue" value={money.format(portfolio.totalNet)} highlight />
          </div>

          <div style={{ marginTop:16, overflowX:"auto", border:"1px solid #e2e8f0", borderRadius:13 }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead><tr style={{ background:"#f1f5f9" }}>
                {["Metric","Level Debt","Elite Legal Practice","Consumer Shield","Combined"].map(h=><th key={h} style={TH}>{h}</th>)}
              </tr></thead>
              <tbody>
                {[
                  { label:"Deal Count", tip:"Total deals split by your routing allocation, with eligibility floors enforced.",
                    ld:String(portfolio.ldCount), cs:String(portfolio.csCount), elp:String(portfolio.elpCount), tot:String(portfolioDeals) },
                  { label:"Expected Revenue / Deal", tip:"Survival-weighted revenue at the portfolio average debt.",
                    ld:money.format(portfolioDeal.ld.expectedRevenue), cs:money.format(portfolioDeal.cs.expectedRevenue),
                    elp:money.format(portfolioDeal.elp.expectedRevenue), tot:"—" },
                  { label:"Gross Revenue", tip:"Expected revenue per deal × deal count.",
                    ld:money.format(portfolio.ldGross), cs:money.format(portfolio.csGross), elp:money.format(portfolio.elpGross), tot:money.format(portfolio.totalGross) },
                  { label:"Rep Cost", tip:"LD = enrolled debt × rep %. CS = upfront + milestone × effective P4. ELP = band schedule weighted by effective P2 / P4.",
                    ld:money.format(portfolio.ldRep), cs:money.format(portfolio.csRep), elp:money.format(portfolio.elpRep), tot:money.format(portfolio.totalRep) },
                  { label:"Net Revenue", tip:"Gross revenue minus rep cost for each side.",
                    ld:money.format(portfolio.ldGross-portfolio.ldRep), cs:money.format(portfolio.csGross-portfolio.csRep),
                    elp:money.format(portfolio.elpGross-portfolio.elpRep), tot:money.format(portfolio.totalNet) },
                  { label:"Full-Upside Ref", tip:"Revenue if every perpetuity deal completed its full term. Ceiling only, never a forecast.",
                    ld:"—", cs:money.format(portfolio.csUpside), elp:money.format(portfolio.elpUpside), tot:money.format(portfolio.totalUpside) },
                ].map((row,i)=>(
                  <tr key={row.label} style={{ background:i%2?"#f8fafc":"#fff" }}>
                    <td style={{ ...TD, fontWeight:700 }} title={row.tip}>
                      {row.label} <span style={{ fontSize:10, background:"#e2e8f0", borderRadius:99, padding:"1px 5px", color:"#334155", cursor:"help" }}>?</span>
                    </td>
                    <td style={TD}>{row.ld}</td>
                    <td style={TD}>{row.elp}</td>
                    <td style={TD}>{row.cs}</td>
                    <td style={{ ...TD, borderRight:"none", fontWeight:700 }}>{row.tot}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Operator notes */}
        <div style={card}>
          <h2 style={{ margin:"0 0 10px", fontSize:18, fontWeight:800, color:"#0f172a" }}>Operator Notes</h2>
          {[
            ["Eligibility floors", "Level Debt will not accept enrolled debt below $7,000. Elite Legal Practice requires $6,000 and $250/mo payment capacity. Consumer Shield starts at $4,000. Between $4,000 and $5,999 there is no routing decision — Consumer Shield is the only option. Enforced throughout this tool."],
            ["Three-way comparison", "The Backend Comparison table is the one place every assumption lands on the same deal. Expected revenue is the number to compare — full-term ceilings flatter Elite Legal Practice because its terms run far longer than Consumer Shield's."],
            ["Separate survival funnels", "Consumer Shield and Elite Legal Practice each carry their own cascading rates and their own lead quality slider. A validation book and an attorney-model book rarely churn the same way, and forcing one curve on both hides exactly the difference this tool exists to measure."],
            ["ELP term is a choice, not a constant", `The $250/mo minimum is a floor on the client's draft, not the term a deal gets written at — it only caps how long the fee can be spread (max = fee ÷ ($250 − maintenance − draft fee), up to 60 months). Set the client's monthly draft in the Program Terms panel; the model defaults to a ${ELP_DEFAULT_TARGET_TERM}-month program.`],
            ["Shorter ELP terms are worth more", "Months 1–2 pass through in full; everything after pays the tier rate on the service fee alone. A longer term pushes more of the fee past month 2, so it earns less in total AND later. On a $20,000 deal: 20 months returns about $6,432 and breaks even against Level Debt in month 4, while 59 months returns about $6,173 and takes until month 14. Worth checking the draft against what your reps actually write."],
            ["ELP revenue shape", "Payments 1–2 pass through in full — service fee plus maintenance, less the draft fee. From Payment 3 the maintenance fee is backed out and Funding Tier keeps the tier rate of the service fee portion only. That is why the first two months are worth several times any later month."],
            ["ELP state restrictions", `Legacy Capital Services cannot be sold in ${ELP_BLOCKED_STATES.join(", ")}. This tool models national economics — confirm state eligibility in the Router before routing a live deal.`],
            ["Break-even below $7k", "Under $7,000 there is no Level Debt benchmark, so no break-even month is displayed. The break-even cohort is still priced — at the mid-program month rather than at zero — otherwise every sub-$7k deal would look worse than it is. $6,000–$6,999 is the one band where Consumer Shield and Elite Legal Practice compete with no settlement option at all."],
            ["Cash urgency + stability", "Cash urgency sets Level Debt's share. The remainder splits between Consumer Shield and Elite Legal Practice on adjusted expected value, so the stronger perpetuity backend earns the larger tail allocation automatically. The stability penalty reads the blended CS + ELP funnel, not the portfolio sliders, so the recommendation never chases its own tail."],
            ["Using this tool over time", "The real value compounds as you replace estimates with observed P2, P4 and break-even survival rates for each backend separately. Every recommendation on this page self-corrects as those inputs improve."],
          ].map(([b,rest],i)=>(
            <p key={i} style={{ margin:"8px 0 0", fontSize:14, color:"#475569", lineHeight:1.7 }}>
              <strong style={{ color:"#0f172a" }}>{b}:</strong> {rest}
            </p>
          ))}
        </div>

      </div>
      </ToolShell>

      <style jsx global>{`
        /* auto-fit rather than fixed counts: ToolShell caps the frame at
           1100px, so these have to reflow to the container, not the viewport. */
        .ft-grid-5       { display: grid; grid-template-columns: repeat(auto-fit,minmax(185px,1fr)); gap: 14px; }
        .ft-grid-4       { display: grid; grid-template-columns: repeat(auto-fit,minmax(200px,1fr)); gap: 14px; }
        .ft-grid-3       { display: grid; grid-template-columns: repeat(auto-fit,minmax(230px,1fr)); gap: 14px; }
        .ft-grid-2       { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .ft-grid-2-inner { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; }
        @media (max-width: 720px) {
          .ft-grid-5, .ft-grid-4, .ft-grid-3, .ft-grid-2, .ft-grid-2-inner { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
