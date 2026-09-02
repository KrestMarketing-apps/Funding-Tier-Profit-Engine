// ═══════════════════════════════════════════════════════════════════
// ELITE LEGAL PRACTICE / LEGACY CAPITAL SERVICES — REVENUE ENGINE
//
// Pure functions. Mirrors the production reference implementations:
//   /admins/legacy-capital-billable-payout-simulator
//   /agents/legacy-capital-program-calculator
//
// The product is an attorney-model creditor resolution program. The client
// pays a single service fee (35%-49% of enrolled debt) spread across a term
// that is capped by the $250/mo minimum draft — not by a fixed month count.
//
//   grossPayment = serviceFeeMonthly + maintenanceFee + draftFee
//
// Funding Tier's cut:
//   Payments 1-2 : 100% pass-through of (gross - draft fee)
//                  = serviceFeeMonthly + maintenanceFee
//   Payments 3+  : tier rate applied to (gross - maintenance - draft fee)
//                  = serviceFeeMonthly x tierRate
// ═══════════════════════════════════════════════════════════════════

export const ELP_DRAFT_FEE   = 4;      // per draft, per month
export const ELP_MIN_PAYMENT = 250;    // hard floor on the client draft
export const ELP_TERM_MIN    = 1;
export const ELP_TERM_MAX    = 60;
export const ELP_MIN_DEBT    = 6000;
export const ELP_FEE_MIN     = 35;
export const ELP_FEE_MAX     = 49;
export const ELP_MAINT_OPTIONS = [80, 120] as const;

/** Tier rate steps up once the book clears 100 billable files per month. */
export const ELP_TIER_RATE_BASE = 0.60;
export const ELP_TIER_RATE_HIGH = 0.65;
export const ELP_TIER_RATE_FILE_THRESHOLD = 100;

/** States where Legacy Capital Services cannot be sold. */
export const ELP_BLOCKED_STATES = ["ID", "ND", "GA"];

export type ElpTerms = {
  feeRatePct: number;   // 35-49
  maintFee: number;     // 80 or 120
  split: boolean;       // two drafts per month instead of one
  tierRate: number;     // 0.60 / 0.65
};

export type ElpSchedule = {
  eligible: boolean;
  term: number;
  serviceFeeTotal: number;
  serviceFeeMonthly: number;
  draftMonthly: number;
  maintFee: number;
  grossPayment: number;
  earlyDeduction: number;   // months 1-2
  lateDeduction: number;    // months 3+
  earlyNet: number;         // eligible base, months 1-2
  lateNet: number;          // eligible base, months 3+
  earlyRevenue: number;     // Funding Tier revenue, months 1-2
  lateRevenue: number;      // Funding Tier revenue, months 3+
  tierRate: number;
  feeRatePct: number;
  split: boolean;
};

export type ElpTimelineRow = {
  month: number;
  phase: "Pass-Through" | "Tier Share";
  monthlyRevenue: number;
  cumulativeRevenue: number;
  liabilityFreeMonth: number;
  payoutHitMonthAssumed: number;
};

export type LcBand = {
  code: string; label: string; range: string;
  minDebt: number; maxDebt: number;
  total: number; p2: number; p4: number;
};

/** Agent commission schedule — identical to the live Commission Simulator. */
export const LC_BANDS: LcBand[] = [
  { code:"L1", label:"Band L1", range:"$6,000 – $9,999",   minDebt:6000,  maxDebt:9999.99,                 total:150, p2:150, p4:0   },
  { code:"L2", label:"Band L2", range:"$10,000 – $14,999", minDebt:10000, maxDebt:14999.99,                total:225, p2:175, p4:50  },
  { code:"L3", label:"Band L3", range:"$15,000 – $19,999", minDebt:15000, maxDebt:19999.99,                total:275, p2:200, p4:75  },
  { code:"L4", label:"Band L4", range:"$20,000 – $24,999", minDebt:20000, maxDebt:24999.99,                total:350, p2:250, p4:100 },
  { code:"L5", label:"Band L5", range:"$25,000 – $29,999", minDebt:25000, maxDebt:29999.99,                total:400, p2:300, p4:100 },
  { code:"L6", label:"Band L6", range:"$30,000 – $49,999", minDebt:30000, maxDebt:49999.99,                total:500, p2:375, p4:125 },
  { code:"L7", label:"Band L7", range:"$50,000+",          minDebt:50000, maxDebt:Number.POSITIVE_INFINITY, total:600, p2:450, p4:150 },
];

export function getLcBand(debt: number): LcBand | null {
  if (debt < ELP_MIN_DEBT) return null;
  return LC_BANDS.find(b => debt >= b.minDebt && debt <= b.maxDebt) ?? null;
}

function round2(v: number) { return Math.round(v * 100) / 100; }
function clamp(v: number, lo: number, hi: number) { return Math.min(Math.max(v, lo), hi); }

/** Draft fee charged per month — split schedules draft twice. */
export function elpDraftMonthly(split: boolean): number {
  return split ? ELP_DRAFT_FEE * 2 : ELP_DRAFT_FEE;
}

/** Tier rate for a given monthly billable file count. */
export function elpTierRateForFiles(files: number): number {
  return files >= ELP_TIER_RATE_FILE_THRESHOLD ? ELP_TIER_RATE_HIGH : ELP_TIER_RATE_BASE;
}

/**
 * Longest term this deal can run before the client draft falls under $250.
 * The service fee has to cover whatever is left of $250 after maintenance and
 * draft fees. If those already clear $250 on their own the floor cannot bind
 * and the term is free to run the full 60.
 */
export function elpMaxTerm(debt: number, feeRatePct: number, maintFee: number, split: boolean): number {
  const headroom = ELP_MIN_PAYMENT - maintFee - elpDraftMonthly(split);
  if (headroom <= 0) return ELP_TERM_MAX;
  if (!debt || !feeRatePct) return ELP_TERM_MAX;
  return clamp(Math.floor((debt * (feeRatePct / 100)) / headroom), ELP_TERM_MIN, ELP_TERM_MAX);
}

export function elpSchedule(debt: number, terms: ElpTerms): ElpSchedule {
  const eligible = debt >= ELP_MIN_DEBT;
  const draftMonthly = elpDraftMonthly(terms.split);
  const term = eligible ? elpMaxTerm(debt, terms.feeRatePct, terms.maintFee, terms.split) : 0;
  const serviceFeeTotal   = eligible ? round2(debt * (terms.feeRatePct / 100)) : 0;
  const serviceFeeMonthly = term > 0 ? round2(serviceFeeTotal / term) : 0;
  const grossPayment      = round2(serviceFeeMonthly + terms.maintFee + draftMonthly);

  const earlyDeduction = draftMonthly;
  const lateDeduction  = round2(terms.maintFee + draftMonthly);
  const earlyNet = round2(grossPayment - earlyDeduction);
  const lateNet  = round2(grossPayment - lateDeduction);

  return {
    eligible, term, serviceFeeTotal, serviceFeeMonthly,
    draftMonthly, maintFee: terms.maintFee, grossPayment,
    earlyDeduction, lateDeduction, earlyNet, lateNet,
    earlyRevenue: earlyNet,                          // 100% pass-through
    lateRevenue: round2(lateNet * terms.tierRate),   // tier share
    tierRate: terms.tierRate,
    feeRatePct: terms.feeRatePct,
    split: terms.split,
  };
}

/** Cumulative Funding Tier revenue through a given deal month. */
export function elpRevenueAt(month: number, s: ElpSchedule): number {
  if (month <= 0 || !s.eligible) return 0;
  const m = Math.min(month, s.term);
  const early = Math.min(m, 2);
  const late  = Math.max(0, m - 2);
  return round2(early * s.earlyRevenue + late * s.lateRevenue);
}

export function elpFullRevenue(s: ElpSchedule): number {
  return elpRevenueAt(s.term, s);
}

export function elpBuildTimeline(s: ElpSchedule): ElpTimelineRow[] {
  if (!s.eligible || s.term <= 0) return [];
  return Array.from({ length: s.term }, (_, i) => {
    const month = i + 1;
    return {
      month,
      phase: (month <= 2 ? "Pass-Through" : "Tier Share") as ElpTimelineRow["phase"],
      monthlyRevenue: month <= 2 ? s.earlyRevenue : s.lateRevenue,
      cumulativeRevenue: elpRevenueAt(month, s),
      liabilityFreeMonth: month + 4,
      payoutHitMonthAssumed: month + 1,
    };
  });
}

/** First month where cumulative ELP revenue catches the Level Debt 8%. */
export function elpBreakEven(levelDebtRevenue: number, s: ElpSchedule): number | null {
  if (!s.eligible || levelDebtRevenue <= 0) return null;
  for (let m = 1; m <= s.term; m++) if (elpRevenueAt(m, s) >= levelDebtRevenue) return m;
  return null;
}

export function elpRevenueAtFraction(frac: number, s: ElpSchedule): number {
  if (!s.eligible) return 0;
  return elpRevenueAt(Math.max(1, Math.floor(s.term * frac)), s);
}

/** Expected agent commission, weighted by the effective P2 / P4 survival rates. */
export function elpExpectedRepCost(debt: number, effP2Pct: number, effP4Pct: number): number {
  const band = getLcBand(debt);
  if (!band) return 0;
  return round2(band.p2 * (effP2Pct / 100) + band.p4 * (effP4Pct / 100));
}
