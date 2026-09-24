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

/**
 * Exhibit D (Payout Model Election, 20260601EXD6065): the residual Service Fee
 * is calculated on the Active Lead's MMP for the first 48 months only (or the
 * term, if shorter). A 60-month program earns nothing in months 49-60.
 */
export const ELP_RESIDUAL_MAX_MONTHS = 48;

// ─────────────────────────────────────────────────────────────────────────────
// ACCELERATED PAYOUT MODEL (Exhibit D, Option 2)
//
// 90% of the Active Lead's payment each month for the first 7 months, then 25%
// for the following 17 months — a 24-month combined maximum. Nothing is paid
// after month 24. Leads written under 24 months cannot take it: they are paid
// on the Residual model instead.
//
// The payment it is applied to is the Service Fee base the whole of Exhibit D
// is built on: the cleared payment less the monthly maintenance fee, less
// processing / draft / software fees. That is the default ('net'). The
// exhibit's Option 2 sentence just says "the Active Lead's payment", so the
// model also carries the reading where only the draft fee comes off ('draft')
// until Legacy Capital Services confirms which base they pay on.
//
// The residual model's two-month maintenance add-back ("Additional
// Compensation") is written under Option 1 only, so it is NOT applied here.
// ─────────────────────────────────────────────────────────────────────────────

export type ElpAcceleratedBase = 'net' | 'draft';

export type ElpAcceleratedTerms = {
  frontRate: number;     // 0.90
  frontMonths: number;   // 7
  backRate: number;      // 0.25
  backMonths: number;    // 17
  /** Shortest term a lead can be written at and still take the accelerated model. */
  minTerm: number;       // 24
  base: ElpAcceleratedBase;
};

export const ELP_ACCELERATED_DEFAULT: ElpAcceleratedTerms = {
  frontRate: 0.90, frontMonths: 7, backRate: 0.25, backMonths: 17, minTerm: 24, base: 'net',
};

/** Software fees Legacy Capital Services deducts from Service Fees (Exhibit D). */
export const ELP_SOFTWARE_FEES = {
  eSign: 0,
  creditPull: 2.60,
  /** Per user per month, by files that became Active Leads in the month. */
  seatOver50: 25,
  seat1to49: 50,
  seatZero: 100,
};

/**
 * Seat fee per user for a month with this many ELP files. Exhibit D reads
 * "over 50" → $25 and "1 to 49" → $50, which leaves exactly 50 unassigned; it
 * is priced at $50 here (not "over 50") until LCS says otherwise.
 */
export function elpSeatFeeForFiles(files: number): number {
  if (files > 50) return ELP_SOFTWARE_FEES.seatOver50;
  if (files >= 1) return ELP_SOFTWARE_FEES.seat1to49;
  return ELP_SOFTWARE_FEES.seatZero;
}

/** States where Legacy Capital Services cannot be sold. */
export const ELP_BLOCKED_STATES = ["ID", "ND", "GA"];

export type ElpTerms = {
  feeRatePct: number;   // 35-49
  maintFee: number;     // 80 or 120
  split: boolean;       // two drafts per month instead of one
  tierRate: number;     // 0.60 / 0.65
  /**
   * Program length in months. The $250 minimum is a FLOOR on the client draft,
   * not a target — the term is really set by what the client can afford, so it
   * has to be an input rather than an assumption.
   *
   * Leaving this undefined falls back to the longest term the floor allows,
   * which is the most conservative case on both axes: a longer term pushes
   * more of the fee past month 2 into the tier-rate phase, so it earns less in
   * total AND earns it later. Callers should set it.
   */
  term?: number;
};

/** Typical program length when nothing more specific is known. */
export const ELP_DEFAULT_TARGET_TERM = 48;

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
/** Truncate to the cent — a scheduled draft never over-collects. */
function floorCents(n: number) { return Math.floor(n * 100) / 100; }

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

/**
 * The term actually used: the caller's chosen term, clamped to what the $250
 * floor permits. Falls back to the longest allowed term when unset.
 */
export function elpTerm(debt: number, terms: ElpTerms): number {
  const cap = elpMaxTerm(debt, terms.feeRatePct, terms.maintFee, terms.split);
  if (terms.term == null) return cap;
  return clamp(Math.round(terms.term), ELP_TERM_MIN, cap);
}

/** Client draft implied by a given term. */
export function elpDraftForTerm(debt: number, terms: ElpTerms, term: number): number {
  if (debt < ELP_MIN_DEBT || term < 1) return 0;
  const total = round2(debt * (terms.feeRatePct / 100));
  return round2(floorCents(total / term) + terms.maintFee + elpDraftMonthly(terms.split));
}

/**
 * Term implied by a client draft the customer can afford. Rounds the term UP
 * so the resulting draft lands at or below what they said they could pay, then
 * clamps to the longest term the $250 floor allows — so the answer is always
 * both affordable and legal.
 */
export function elpTermForDraft(debt: number, terms: ElpTerms, targetDraft: number): number {
  const cap = elpMaxTerm(debt, terms.feeRatePct, terms.maintFee, terms.split);
  const headroom = targetDraft - terms.maintFee - elpDraftMonthly(terms.split);
  if (headroom <= 0 || debt < ELP_MIN_DEBT) return cap;
  const total = round2(debt * (terms.feeRatePct / 100));
  return clamp(Math.ceil(total / headroom), ELP_TERM_MIN, cap);
}

export function elpSchedule(debt: number, terms: ElpTerms): ElpSchedule {
  const eligible = debt >= ELP_MIN_DEBT;
  const draftMonthly = elpDraftMonthly(terms.split);
  const term = eligible ? elpTerm(debt, terms) : 0;
  const serviceFeeTotal   = eligible ? round2(debt * (terms.feeRatePct / 100)) : 0;
  // Truncated to the cent, matching the scheduled draft the client actually
  // pays. The final month carries the leftover cents (see elpFinalPayment);
  // ignoring them here keeps every displayed figure internally consistent and
  // errs a few cents low across the whole term.
  const serviceFeeMonthly = term > 0 ? floorCents(serviceFeeTotal / term) : 0;
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

/**
 * Residual-model revenue in one deal month. Months 1-2 pass through, the tier
 * share applies from month 3, and nothing is paid past month 48 (Exhibit D).
 */
export function elpResidualRevenueForMonth(s: ElpSchedule, month: number): number {
  if (!s.eligible || month < 1 || month > s.term || month > ELP_RESIDUAL_MAX_MONTHS) return 0;
  return month <= 2 ? s.earlyRevenue : s.lateRevenue;
}

/** Cumulative Funding Tier revenue through a given deal month (residual model). */
export function elpRevenueAt(month: number, s: ElpSchedule): number {
  if (month <= 0 || !s.eligible) return 0;
  const m = Math.min(month, s.term, ELP_RESIDUAL_MAX_MONTHS);
  const early = Math.min(m, 2);
  const late  = Math.max(0, m - 2);
  return round2(early * s.earlyRevenue + late * s.lateRevenue);
}

// ── Accelerated model ────────────────────────────────────────────────────────

/** True when a lead's term lets it take the accelerated model at all. */
export function elpAcceleratedEligible(s: ElpSchedule, a: ElpAcceleratedTerms = ELP_ACCELERATED_DEFAULT): boolean {
  return s.eligible && s.term >= a.minTerm;
}

/** Monthly payment the accelerated rates are applied to. */
export function elpAcceleratedBase(s: ElpSchedule, a: ElpAcceleratedTerms = ELP_ACCELERATED_DEFAULT): number {
  return a.base === 'draft' ? s.earlyNet : s.lateNet;
}

/**
 * Accelerated-model revenue in one deal month. A lead written under the minimum
 * term falls back to the residual model, exactly as Exhibit D requires.
 */
export function elpAcceleratedRevenueForMonth(
  s: ElpSchedule, month: number, a: ElpAcceleratedTerms = ELP_ACCELERATED_DEFAULT,
): number {
  if (!s.eligible || month < 1 || month > s.term) return 0;
  if (!elpAcceleratedEligible(s, a)) return elpResidualRevenueForMonth(s, month);
  const base = elpAcceleratedBase(s, a);
  if (month <= a.frontMonths) return round2(base * a.frontRate);
  if (month <= a.frontMonths + a.backMonths) return round2(base * a.backRate);
  return 0;
}

/** Cumulative accelerated revenue through a given deal month. */
export function elpAcceleratedRevenueAt(
  month: number, s: ElpSchedule, a: ElpAcceleratedTerms = ELP_ACCELERATED_DEFAULT,
): number {
  let total = 0;
  for (let m = 1; m <= Math.min(month, s.term); m++) total += elpAcceleratedRevenueForMonth(s, m, a);
  return round2(total);
}

export function elpAcceleratedFullRevenue(s: ElpSchedule, a: ElpAcceleratedTerms = ELP_ACCELERATED_DEFAULT): number {
  return elpAcceleratedRevenueAt(s.term, s, a);
}

/**
 * Last deal month in which the residual model is still behind the accelerated
 * model on a cumulative basis, i.e. the payment count a residual lead must
 * survive past before it out-earns the accelerated election. null = the
 * residual never catches up inside the term.
 */
export function elpResidualCatchUpMonth(
  s: ElpSchedule, a: ElpAcceleratedTerms = ELP_ACCELERATED_DEFAULT,
): number | null {
  if (!elpAcceleratedEligible(s, a)) return null;
  for (let m = 1; m <= s.term; m++) {
    if (elpRevenueAt(m, s) >= elpAcceleratedRevenueAt(m, s, a)) {
      // Must stay ahead from here on — the accelerated model stops at 24.
      let ahead = true;
      for (let k = m; k <= s.term; k++) {
        if (elpRevenueAt(k, s) < elpAcceleratedRevenueAt(k, s, a)) { ahead = false; break; }
      }
      if (ahead) return m;
    }
  }
  return null;
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
      monthlyRevenue: elpResidualRevenueForMonth(s, month),
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

// ─────────────────────────────────────────────────────────────────────────────
// PENNY-EXACT DRAFT SCHEDULE
//
// Elite Legal Practice drafts to the exact cent — nothing is rounded to the
// dollar. Only the SERVICE FEE has to total exactly; the maintenance and draft
// fees are flat adders charged every month. So the service fee portion is
// truncated to the cent for every month but the last, and the final month
// carries the remainder.
// ─────────────────────────────────────────────────────────────────────────────

/** Service fee portion of every draft except the last. */
export function elpScheduledServiceFee(debt: number, terms: ElpTerms): number {
  const term = elpTerm(debt, terms);
  if (term <= 0) return 0;
  return floorCents(round2(debt * (terms.feeRatePct / 100)) / term);
}

/** Service fee portion of the final draft — carries the rounding remainder. */
export function elpFinalServiceFee(debt: number, terms: ElpTerms): number {
  const term = elpTerm(debt, terms);
  if (term <= 0) return 0;
  const total = round2(debt * (terms.feeRatePct / 100));
  return round2(total - elpScheduledServiceFee(debt, terms) * (term - 1));
}

/** Full client draft for a scheduled month: service fee + maintenance + draft fee. */
export function elpScheduledPayment(debt: number, terms: ElpTerms): number {
  if (debt < ELP_MIN_DEBT) return 0;
  return round2(elpScheduledServiceFee(debt, terms) + terms.maintFee + elpDraftMonthly(terms.split));
}

/** Full client draft for the final month. */
export function elpFinalPayment(debt: number, terms: ElpTerms): number {
  if (debt < ELP_MIN_DEBT) return 0;
  return round2(elpFinalServiceFee(debt, terms) + terms.maintFee + elpDraftMonthly(terms.split));
}

/** Client draft in a given deal month, exact to the cent. */
export function elpPaymentForMonth(debt: number, terms: ElpTerms, dealMonth?: number): number {
  const term = elpTerm(debt, terms);
  if (dealMonth != null && dealMonth >= term) return elpFinalPayment(debt, terms);
  return elpScheduledPayment(debt, terms);
}
