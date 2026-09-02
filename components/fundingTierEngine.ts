// ═══════════════════════════════════════════════════════════════════
// FUNDING TIER OPERATING MODEL — CORE ENGINE
// Pure functions, no UI, fully typed. Every business number lives in
// Assumptions — nothing is hardcoded inside calculation logic.
// ═══════════════════════════════════════════════════════════════════

import {
  ELP_MIN_DEBT, ELP_MIN_PAYMENT, ELP_DRAFT_FEE, ELP_TERM_MAX,
  ELP_TIER_RATE_BASE, ELP_TIER_RATE_HIGH, ELP_TIER_RATE_FILE_THRESHOLD,
  ELP_DEFAULT_TARGET_TERM,
  elpDraftMonthly, elpMaxTerm, elpSchedule, elpScheduledPayment,
  elpFinalPayment, elpPaymentForMonth, elpTierRateForFiles,
  type ElpTerms,
} from "./legacyEngine";

export type BackendKey = "LEVEL" | "CS" | "LEGACY";

export interface Band {
  code: string;
  min: number;
  max: number;
  total: number;
}

export interface CSProgram {
  code: string;
  min: number;
  max: number;
  payment: number;
  term: number;
  commission: number;
}

export interface CommissionTier {
  threshold: number;
  rate: number;
}

export interface SurvivalCurve {
  firstPayPct: number;
  cancelPctByMonth: number[];
  steadyStateMonthlyCancelPct: number;
}

export interface FixedCost { label: string; amount: number; }
export interface PerUserCost { label: string; amountPerUser: number; }
export interface UsageRates {
  inboundForwardPerMin: number;
  smsPerSegment: number;
  emailPer1000: number;
  didRentalPerMonth: number;
}
export interface TrackdriveTier {
  key: string;
  threshold: number;
  did: number;
  inbound: number;
  api: number;
  reject: number;
}
export interface TransferCost {
  buffer1min: number;
  buffer2min: number;
  buffer5min: number;
}
export type TransferBufferKey = keyof TransferCost;

export interface Assumptions {
  levelDebt: {
    minDebt: number;
    revenueSharePct: number;
    revenueRecognizedMonth: number;
    agentPayoutMonth: number;
    commissionTiers: CommissionTier[];
  };
  consumerShield: {
    minDebt: number;
    servicingDeductionPerPayment: number;
    frontMonths: number;
    frontCaptureRate: number;
    backendCaptureRate: number;
    agentPayoutMonth: number;
    programs: CSProgram[];
  };
  legacy: {
    minDebt: number;
    minMonthlyPayment: number;
    /** Per draft. Doubles on a split schedule because the client is drafted twice. */
    draftFee: number;
    /** Flat monthly program maintenance. Charged once a month on split too. */
    maintenanceFee: number;
    /** Two drafts a month instead of one. Only the draft fee doubles. */
    splitSchedule: boolean;
    maxTerm: number;
    /**
     * Program length actually written, clamped by what the $250 floor allows.
     * The floor is a minimum on the draft, not the term the deal gets sold at
     * — assuming the longest permitted term understates both how much ELP
     * earns and how fast, because months 1-2 pass through in full.
     */
    targetTerm: number;
    tier1Rate: number;
    tier2Rate: number;
    tier2FileThreshold: number;
    agentPayoutMonth: number;
    feeRate: number;
    bands: Band[];
  };
  costs: {
    fixedCosts: FixedCost[];
    perUserCosts: PerUserCost[];
    usageRates: UsageRates;
    trackdriveTiers: TrackdriveTier[];
    trackdriveOutboundRate: number;
    transferCost: TransferCost;
    laborRatePerHour: number;
  };
  operations: {
    closeRate: number;
    avgCallMinutesPerDeal: number;
    transferMix: Record<TransferBufferKey, number>; // % split across buffer tiers, should sum to 100
    smsPerTransfer: number;
    emailPerTransfer: number;
    emailMonthlyCap: number | null;
  };
  headcount: {
    totalHeadcount: number;
    scheduledHoursPerWeek: number;
    concurrentSeats: number;
    commissionOnlySeats: number;
    activeDIDs: number;
    overtimeThresholdHoursPerWeek: number;
    overtimeMultiplier: number;
    staffingMode: "us_only" | "hybrid";
    overseasSeats: number;
    overseasScheduledHoursPerWeek: number;
    overseasRatePerHour: number;
    overseasQualifyingSharePct: number;
  };
  reservePolicy: {
    targetMonthsOverhead: number;
    expectedDisputeRatePct: number;
  };
  hiringPolicy: {
    utilizationThreshold: number;
    sustainMonths: number;
    seatsAddedPerHire: number;
    hireLagMonths: number;
    maxSeats: number | null;
  };
  survivalCurves: Record<BackendKey, SurvivalCurve>;
}

function round2(v: number): number { return Math.round(v * 100) / 100; }
function findBand<T extends { min: number; max: number }>(list: T[], debt: number): T | null {
  return list.find(b => debt >= b.min && debt <= b.max) ?? null;
}

// ───────────────────────────────────────────────────────────────────
// DEFAULT ASSUMPTIONS
// ───────────────────────────────────────────────────────────────────

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  levelDebt: {
    minDebt: 7000,
    revenueSharePct: 0.08,
    revenueRecognizedMonth: 2,
    agentPayoutMonth: 2,
    commissionTiers: [
      { threshold: 0, rate: 0.0075 },
      { threshold: 500000, rate: 0.0100 },
      { threshold: 1000000, rate: 0.0125 },
      { threshold: 2000000, rate: 0.0175 },
      { threshold: 4000000, rate: 0.0250 },
    ],
  },
  consumerShield: {
    minDebt: 4000,
    servicingDeductionPerPayment: 40,
    frontMonths: 4,
    frontCaptureRate: 1.0,
    backendCaptureRate: 0.35,
    agentPayoutMonth: 2,
    programs: [
      { code: "A", min: 4000, max: 4999.99, payment: 220, term: 18, commission: 150 },
      { code: "B", min: 5000, max: 8799.99, payment: 220, term: 24, commission: 150 },
      { code: "C", min: 8800, max: 9999.99, payment: 220, term: 36, commission: 150 },
      { code: "D", min: 10000, max: 14999.99, payment: 270, term: 36, commission: 225 },
      { code: "E", min: 15000, max: 19999.99, payment: 320, term: 36, commission: 275 },
      { code: "F", min: 20000, max: 24999.99, payment: 370, term: 36, commission: 350 },
      { code: "G", min: 25000, max: 29999.99, payment: 420, term: 36, commission: 400 },
      { code: "H", min: 30000, max: 49999.99, payment: 520, term: 36, commission: 500 },
      { code: "I", min: 50000, max: Infinity, payment: 620, term: 36, commission: 600 },
    ],
  },
  legacy: {
    minDebt: ELP_MIN_DEBT,
    minMonthlyPayment: ELP_MIN_PAYMENT,
    // $80 program maintenance and a $4 payment-processing draft fee are two
    // separate charges. They were previously collapsed into a single $84
    // "admin fee", which made the split schedule impossible to express: split
    // drafts the client twice, so the $4 is charged twice while the $80 is
    // still charged once.
    draftFee: ELP_DRAFT_FEE,
    maintenanceFee: 80,
    splitSchedule: false,
    maxTerm: ELP_TERM_MAX,
    targetTerm: ELP_DEFAULT_TARGET_TERM,
    tier1Rate: ELP_TIER_RATE_BASE,
    tier2Rate: ELP_TIER_RATE_HIGH,
    tier2FileThreshold: ELP_TIER_RATE_FILE_THRESHOLD,
    agentPayoutMonth: 2,
    feeRate: 0.49,
    bands: [
      { code: "L1", min: 6000, max: 9999.99, total: 150 },
      { code: "L2", min: 10000, max: 14999.99, total: 225 },
      { code: "L3", min: 15000, max: 19999.99, total: 275 },
      { code: "L4", min: 20000, max: 24999.99, total: 350 },
      { code: "L5", min: 25000, max: 29999.99, total: 400 },
      { code: "L6", min: 30000, max: 49999.99, total: 500 },
      { code: "L7", min: 50000, max: Infinity, total: 600 },
    ],
  },
  costs: {
    fixedCosts: [
      { label: "KM App CRM", amount: 497 },
      { label: "Office Internet", amount: 150 },
      { label: "Office Utilities", amount: 300 },
      { label: "Team Lunch (weekly) + Water/Coffee", amount: 400 },
    ],
    perUserCosts: [
      { label: "Slack", amountPerUser: 12 },
      { label: "Forth", amountPerUser: 100 },
      { label: "Salesforce (Elite Legal Practice)", amountPerUser: 100 },
    ],
    usageRates: {
      inboundForwardPerMin: 0.02,
      smsPerSegment: 0.00747,
      emailPer1000: 0.675,
      didRentalPerMonth: 1.15,
    },
    trackdriveTiers: [
      { key: "PAYG", threshold: 0, did: 4, inbound: 0.05, api: 0.0025, reject: 0.025 },
      { key: "$50", threshold: 50, did: 3, inbound: 0.045, api: 0.0015, reject: 0.025 },
      { key: "$250", threshold: 250, did: 2, inbound: 0.035, api: 0.0012, reject: 0.02 },
      { key: "$1000", threshold: 1000, did: 1.5, inbound: 0.03, api: 0.0009, reject: 0.02 },
      { key: "$4000", threshold: 4000, did: 1, inbound: 0.025, api: 0.0007, reject: 0.02 },
      { key: "$8000", threshold: 8000, did: 0.5, inbound: 0.02, api: 0.0005, reject: 0.02 },
    ],
    trackdriveOutboundRate: 0.015,
    transferCost: { buffer1min: 8, buffer2min: 15, buffer5min: 55 },
    laborRatePerHour: 17,
  },
  operations: {
    closeRate: 0.15,
    avgCallMinutesPerDeal: 65,
    // Split evenly across all three buffer tiers, mixing acquisition cost.
    transferMix: { buffer1min: 33.34, buffer2min: 33.33, buffer5min: 33.33 },
    smsPerTransfer: 2,
    emailPerTransfer: 3,
    emailMonthlyCap: 5000,
  },
  headcount: {
    totalHeadcount: 2,
    scheduledHoursPerWeek: 40,
    concurrentSeats: 2,
    commissionOnlySeats: 1,
    activeDIDs: 4,
    overtimeThresholdHoursPerWeek: 40,
    overtimeMultiplier: 1.5,
    staffingMode: "us_only",
    overseasSeats: 0,
    overseasScheduledHoursPerWeek: 40,
    overseasRatePerHour: 5,
    overseasQualifyingSharePct: 70,
  },
  reservePolicy: {
    targetMonthsOverhead: 6,
    expectedDisputeRatePct: 0.5,
  },
  hiringPolicy: {
    utilizationThreshold: 0.85,
    sustainMonths: 2,
    seatsAddedPerHire: 1,
    hireLagMonths: 1,
    maxSeats: null,
  },
  survivalCurves: {
    // ILLUSTRATIVE PLACEHOLDERS — not real data. Industry completion rates
    // are contested: TASC (trade group) reports 35-60% full completion (avg
    // 45-50%); GAO/state AG investigations found actual completion "often
    // in the single digits." Calibrate toward real data as it comes in.
    // Uniform, deliberately unsugarcoated defaults across all three backends:
    // 50% of enrolled deals ever make their first payment, and a flat 15%
    // monthly cancellation rate applies every month thereafter, indefinitely.
    // Adjust per backend as real observed performance data comes in.
    LEVEL:  { firstPayPct: 50, cancelPctByMonth: [15, 15, 15, 15, 15], steadyStateMonthlyCancelPct: 15 },
    CS:     { firstPayPct: 50, cancelPctByMonth: [15, 15, 15, 15, 15], steadyStateMonthlyCancelPct: 15 },
    LEGACY: { firstPayPct: 50, cancelPctByMonth: [15, 15, 15, 15, 15], steadyStateMonthlyCancelPct: 15 },
  },
};

export function mergeAssumptions(overrides: Partial<{ [K in keyof Assumptions]: Partial<Assumptions[K]> }> = {}): Assumptions {
  const merged = {} as Assumptions;
  (Object.keys(DEFAULT_ASSUMPTIONS) as (keyof Assumptions)[]).forEach(section => {
    (merged as any)[section] = { ...(DEFAULT_ASSUMPTIONS as any)[section], ...((overrides as any)[section] || {}) };
  });
  return merged;
}

// ───────────────────────────────────────────────────────────────────
// BACKEND MODELS
// ───────────────────────────────────────────────────────────────────

export const LEVEL_DEBT = {
  key: "LEVEL" as const,
  name: "Level Debt",
  companyRevenueForMonth(debt: number, month: number, a: Assumptions): number {
    return month === a.levelDebt.revenueRecognizedMonth ? debt * a.levelDebt.revenueSharePct : 0;
  },
  agentPayoutMonth(a: Assumptions): number { return a.levelDebt.agentPayoutMonth; },
  clawbackRule: "Chargeback of full upfront payout if the client's 2nd monthly deposit does not clear.",
};

export function resolveLevelCommissionRate(monthlyEnrolledVolume: number, tiers: CommissionTier[]): number {
  const sorted = [...tiers].sort((x, y) => x.threshold - y.threshold);
  let rate = sorted[0].rate;
  for (const t of sorted) if (monthlyEnrolledVolume >= t.threshold) rate = t.rate;
  return rate;
}

export function levelDebtCommission(debt: number, monthlyEnrolledVolume: number, a: Assumptions) {
  const rate = resolveLevelCommissionRate(monthlyEnrolledVolume, a.levelDebt.commissionTiers);
  return { amount: Math.round(debt * rate), rate };
}

export const CONSUMER_SHIELD = {
  key: "CS" as const,
  name: "Shield Services (Consumer Shield)",
  getProgram(debt: number, a: Assumptions): CSProgram | null { return findBand(a.consumerShield.programs, debt); },
  companyRevenueForMonth(debt: number, month: number, a: Assumptions): number {
    const prog = this.getProgram(debt, a);
    if (!prog || month > prog.term) return 0;
    const cfg = a.consumerShield;
    const net = prog.payment - cfg.servicingDeductionPerPayment;
    return month <= cfg.frontMonths ? net * cfg.frontCaptureRate : net * cfg.backendCaptureRate;
  },
  agentCommission(debt: number, a: Assumptions): number {
    const prog = this.getProgram(debt, a);
    return prog ? prog.commission : 0;
  },
  agentPayoutMonth(a: Assumptions): number { return a.consumerShield.agentPayoutMonth; },
  clawbackRule: "No clawback for ordinary cancellation. Chargeback only on a formal payment dispute.",
};

/**
 * Adapt the Assumptions block to the shape legacyEngine works in.
 * `feeRate` is a fraction here and a percentage there — the only difference.
 */
export function legacyTermsFor(a: Assumptions, feeRate?: number, monthlyFiles?: number): ElpTerms {
  return {
    feeRatePct: (feeRate ?? a.legacy.feeRate) * 100,
    maintFee: a.legacy.maintenanceFee,
    split: a.legacy.splitSchedule,
    tierRate: monthlyFiles == null ? a.legacy.tier1Rate : elpTierRateForFiles(monthlyFiles),
    term: a.legacy.targetTerm,
  };
}

export const LEGACY_CAPITAL = {
  key: "LEGACY" as const,
  name: "Legacy Capital (Elite Legal Practice)",
  /**
   * The $250 floor is on the CLIENT DRAFT, not on the service fee. Maintenance
   * and draft fees are part of that draft, so only the remainder has to be
   * covered by the service fee — which is what sets the term.
   */
  getMaxTerm(debt: number, feeRate: number, a: Assumptions): number {
    return elpMaxTerm(debt, feeRate * 100, a.legacy.maintenanceFee, a.legacy.splitSchedule);
  },
  /** Full client draft: service fee + maintenance + draft fee(s). */
  getMonthlyPayment(debt: number, feeRate: number, term: number, a?: Assumptions): number {
    if (!a) return (debt * feeRate) / term;
    return elpScheduledPayment(debt, legacyTermsFor(a, feeRate));
  },
  getScheduledPayment(debt: number, feeRate: number, a: Assumptions): number {
    return elpScheduledPayment(debt, legacyTermsFor(a, feeRate));
  },
  getFinalPayment(debt: number, feeRate: number, a: Assumptions): number {
    return elpFinalPayment(debt, legacyTermsFor(a, feeRate));
  },
  getPaymentForMonth(debt: number, feeRate: number, month: number, a: Assumptions): number {
    return elpPaymentForMonth(debt, legacyTermsFor(a, feeRate), month);
  },
  /** Draft fee charged per month — doubled on a split schedule. */
  draftFeePerMonth(a: Assumptions): number {
    return elpDraftMonthly(a.legacy.splitSchedule);
  },
  companyRevenueForMonth(debt: number, feeRate: number, term: number, month: number, a: Assumptions): number {
    const sched = elpSchedule(debt, legacyTermsFor(a, feeRate));
    if (!sched.eligible || month < 1 || month > sched.term) return 0;
    // Months 1-2 pass through in full less the draft fee — the maintenance fee
    // is NOT backed out yet. From month 3 both come off and the tier rate
    // applies to what is left, which is the service fee portion.
    return month <= 2 ? sched.earlyRevenue : sched.lateRevenue;
  },
  /**
   * Flat band commission. The old model scaled this by feeRate / 0.40, which
   * paid 22.5% over schedule at the 49% fee rate. The live Commission
   * Simulator pays the band amount flat, split across the Payment 2 and
   * Payment 4 milestones.
   */
  agentCommission(debt: number, _feeRate: number, a: Assumptions): number {
    const band = findBand(a.legacy.bands, debt);
    return band ? band.total : 0;
  },
  agentPayoutMonth(a: Assumptions): number { return a.legacy.agentPayoutMonth; },
  clawbackRule: "Band L1 pays in full at Payment 2 with no clawback. Bands L2-L7 split across Payment 2 and Payment 4; the Payment 2 portion is clawed back if the client cancels before Payment 4 clears.",
};

export const BACKENDS = { LEVEL: LEVEL_DEBT, CS: CONSUMER_SHIELD, LEGACY: LEGACY_CAPITAL };

// ───────────────────────────────────────────────────────────────────
// SURVIVAL CURVE
// ───────────────────────────────────────────────────────────────────

export function buildSurvivalArray(curve: SurvivalCurve, maxMonths = 36): number[] {
  const active = new Array(maxMonths + 1).fill(0);
  active[1] = curve.firstPayPct / 100;
  for (let m = 2; m <= maxMonths; m++) {
    const idx = m - 2;
    const cancelPct = idx < curve.cancelPctByMonth.length
      ? curve.cancelPctByMonth[idx] / 100
      : curve.steadyStateMonthlyCancelPct / 100;
    active[m] = active[m - 1] * (1 - cancelPct);
  }
  return active;
}

// ───────────────────────────────────────────────────────────────────
// TRACKDRIVE TIER RESOLUTION
// ───────────────────────────────────────────────────────────────────

export function resolveTrackdriveTier(
  estimateMonthlySpendGivenTier: (tier: TrackdriveTier) => number,
  a: Assumptions,
  maxIter = 5
): { tier: TrackdriveTier; spend: number } {
  const tiers = a.costs.trackdriveTiers;
  let tier = tiers[0];
  for (let i = 0; i < maxIter; i++) {
    const spend = estimateMonthlySpendGivenTier(tier);
    const eligible = [...tiers].reverse().find(t => spend >= t.threshold) || tiers[0];
    if (eligible.key === tier.key) return { tier, spend };
    tier = eligible;
  }
  return { tier, spend: estimateMonthlySpendGivenTier(tier) };
}

// ───────────────────────────────────────────────────────────────────
// MONTHLY OVERHEAD COST STACK
// ───────────────────────────────────────────────────────────────────

export interface MonthlyCosts {
  fixed: number;
  perUser: number;
  usage: number;
  trackdrive: number;
  usLabor: number;
  overseasLabor: number;
  labor: number;
  total: number;
}

export function calculateMonthlyCosts(
  input: { totalCallMinutes: number; totalSmsSegments: number; totalEmails: number; trackdriveTierKey: string },
  a: Assumptions
): MonthlyCosts {
  const cfg = a.costs;
  const hc = a.headcount;
  const { totalCallMinutes, totalSmsSegments, totalEmails, trackdriveTierKey } = input;

  const fixed = cfg.fixedCosts.reduce((s, c) => s + c.amount, 0);

  const perUser = cfg.perUserCosts.reduce((s, c) => s + c.amountPerUser * hc.totalHeadcount, 0);

  const usage =
    totalCallMinutes * cfg.usageRates.inboundForwardPerMin +
    totalSmsSegments * cfg.usageRates.smsPerSegment +
    (totalEmails / 1000) * cfg.usageRates.emailPer1000 +
    hc.activeDIDs * cfg.usageRates.didRentalPerMonth;

  const tdTier = cfg.trackdriveTiers.find(t => t.key === trackdriveTierKey) || cfg.trackdriveTiers[0];
  const trackdrive =
    totalCallMinutes * tdTier.inbound +
    totalCallMinutes * cfg.trackdriveOutboundRate +
    hc.activeDIDs * tdTier.did;

  const hourlyPaidSeats = Math.max(0, hc.concurrentSeats - Math.min(hc.commissionOnlySeats, hc.concurrentSeats));
  const regularHoursPerWeek = Math.min(hc.scheduledHoursPerWeek, hc.overtimeThresholdHoursPerWeek);
  const overtimeHoursPerWeek = Math.max(0, hc.scheduledHoursPerWeek - hc.overtimeThresholdHoursPerWeek);
  const usRegularHours = regularHoursPerWeek * hourlyPaidSeats * (52 / 12);
  const usOvertimeHours = overtimeHoursPerWeek * hourlyPaidSeats * (52 / 12);
  const usLabor = usRegularHours * cfg.laborRatePerHour + usOvertimeHours * cfg.laborRatePerHour * hc.overtimeMultiplier;

  let overseasLabor = 0;
  if (hc.staffingMode === "hybrid") {
    const overseasLaborHours = hc.overseasScheduledHoursPerWeek * hc.overseasSeats * (52 / 12);
    overseasLabor = overseasLaborHours * hc.overseasRatePerHour;
  }

  const labor = usLabor + overseasLabor;

  return {
    fixed: round2(fixed),
    perUser: round2(perUser),
    usage: round2(usage),
    trackdrive: round2(trackdrive),
    usLabor: round2(usLabor),
    overseasLabor: round2(overseasLabor),
    labor: round2(labor),
    total: round2(fixed + perUser + usage + trackdrive + labor),
  };
}

// ───────────────────────────────────────────────────────────────────
// ROLLING MULTI-COHORT PORTFOLIO SIMULATOR
// ───────────────────────────────────────────────────────────────────

export interface MonthlyDealCounts { LEVEL: number; CS: number; LEGACY: number; }

export interface MonthRow {
  month: number;
  newDealsTotal: number;
  qualifiedTransfers: number;
  levelCommissionRate: number;
  revenue: number;
  revenueByBackend: Record<BackendKey, number>;
  commission: number;
  commissionByBackend: Record<BackendKey, number>;
  activeDealsByBackend: Record<BackendKey, number>;
  transferCost: number;
  overhead: number;
  costBreakdown: MonthlyCosts;
  trackdriveTierKey: string;
  monthCallMinutes: number;
  netCashFlow: number;
  cashPosition: number;
  reserveTarget: number;
  distributable: number;
  reserveMet: boolean;
  utilizationPct: number;
  closerUtilizationPct: number;
  overseasUtilizationPct: number;
  concurrentSeats: number;
  overseasSeats: number;
  safeToHire: boolean;
  hireScheduledFor: number | null;
}

export interface HiringEvent { month: number; pool: "closer" | "overseas"; seatsAfter: number; }

export interface PortfolioResult { rows: MonthRow[]; hiringEvents: HiringEvent[]; }

interface Cohort { backendKey: BackendKey; startMonth: number; dealCount: number; avgDebt: number; }

export function simulatePortfolio({
  months,
  monthlyNewDeals,
  avgDebtByBackend,
  assumptions,
}: {
  months: number;
  monthlyNewDeals: MonthlyDealCounts | ((monthIndex: number) => MonthlyDealCounts);
  avgDebtByBackend: Record<BackendKey, number>;
  assumptions?: Assumptions;
}): PortfolioResult {
  const a = assumptions || DEFAULT_ASSUMPTIONS;

  const survivalArrays: Record<BackendKey, number[]> = {
    LEVEL: buildSurvivalArray(a.survivalCurves.LEVEL, months + 6),
    CS: buildSurvivalArray(a.survivalCurves.CS, months + 6),
    LEGACY: buildSurvivalArray(a.survivalCurves.LEGACY, months + 6),
  };

  const legacyTerm = LEGACY_CAPITAL.getMaxTerm(avgDebtByBackend.LEGACY, a.legacy.feeRate, a);

  const cohorts: Cohort[] = [];
  const rows: MonthRow[] = [];
  let cashPosition = 0;
  let trailingCommission12mo: number[] = [];
  let closerUtilizationHistory: number[] = [];
  let overseasUtilizationHistory: number[] = [];

  let currentSeats = a.headcount.concurrentSeats;
  let currentOverseasSeats = a.headcount.overseasSeats;
  let currentHeadcount = a.headcount.totalHeadcount;
  let pendingHire: { effectiveMonth: number; pool: "closer" | "overseas" } | null = null;
  const hiringEvents: HiringEvent[] = [];

  for (let t = 1; t <= months; t++) {
    if (pendingHire && t >= pendingHire.effectiveMonth) {
      if (pendingHire.pool === "closer") {
        currentSeats += a.hiringPolicy.seatsAddedPerHire;
        currentHeadcount += a.hiringPolicy.seatsAddedPerHire;
        hiringEvents.push({ month: t, pool: "closer", seatsAfter: currentSeats });
      } else {
        currentOverseasSeats += a.hiringPolicy.seatsAddedPerHire;
        hiringEvents.push({ month: t, pool: "overseas", seatsAfter: currentOverseasSeats });
      }
      pendingHire = null;
    }

    const newDeals = typeof monthlyNewDeals === "function" ? monthlyNewDeals(t) : monthlyNewDeals;
    (["LEVEL", "CS", "LEGACY"] as BackendKey[]).forEach(key => {
      if (newDeals[key] > 0) {
        cohorts.push({ backendKey: key, startMonth: t, dealCount: newDeals[key], avgDebt: avgDebtByBackend[key] });
      }
    });

    let monthRevenue = 0, monthCommission = 0, monthTransferCost = 0, monthCallMinutes = 0, monthQualifiedTransfers = 0;
    const monthRevenueByBackend: Record<BackendKey, number> = { LEVEL: 0, CS: 0, LEGACY: 0 };
    const monthCommissionByBackend: Record<BackendKey, number> = { LEVEL: 0, CS: 0, LEGACY: 0 };
    const monthActiveDealsByBackend: Record<BackendKey, number> = { LEVEL: 0, CS: 0, LEGACY: 0 };
    const levelEnrolledVolumeThisMonth = newDeals.LEVEL * avgDebtByBackend.LEVEL;
    const levelRate = resolveLevelCommissionRate(levelEnrolledVolumeThisMonth, a.levelDebt.commissionTiers);

    (["LEVEL", "CS", "LEGACY"] as BackendKey[]).forEach(key => {
      const n = newDeals[key] || 0;
      const qualifiedTransfersNeeded = a.operations.closeRate > 0 ? n / a.operations.closeRate : 0;
      monthQualifiedTransfers += qualifiedTransfersNeeded;
      const blendedTransferCost =
        (a.operations.transferMix.buffer1min / 100) * a.costs.transferCost.buffer1min +
        (a.operations.transferMix.buffer2min / 100) * a.costs.transferCost.buffer2min +
        (a.operations.transferMix.buffer5min / 100) * a.costs.transferCost.buffer5min;
      monthTransferCost += qualifiedTransfersNeeded * blendedTransferCost;
      monthCallMinutes += qualifiedTransfersNeeded * a.operations.avgCallMinutesPerDeal;
    });

    for (const c of cohorts) {
      const age = t - c.startMonth + 1;
      if (age < 1) continue;
      const backend = BACKENDS[c.backendKey];
      const survival = survivalArrays[c.backendKey][age] ?? 0;
      const activeDeals = survival * c.dealCount;
      monthActiveDealsByBackend[c.backendKey] += activeDeals;

      let revPerActive = 0;
      if (c.backendKey === "LEGACY") revPerActive = LEGACY_CAPITAL.companyRevenueForMonth(c.avgDebt, a.legacy.feeRate, legacyTerm, age, a);
      else if (c.backendKey === "CS") revPerActive = CONSUMER_SHIELD.companyRevenueForMonth(c.avgDebt, age, a);
      else revPerActive = LEVEL_DEBT.companyRevenueForMonth(c.avgDebt, age, a);
      const revThisCohort = revPerActive * activeDeals;
      monthRevenue += revThisCohort;
      monthRevenueByBackend[c.backendKey] += revThisCohort;

      const payoutMonth = backend.agentPayoutMonth(a);
      if (age === payoutMonth) {
        const survivingAtPayout = (survivalArrays[c.backendKey][payoutMonth] ?? 0) * c.dealCount;
        let perDealComm: number;
        if (c.backendKey === "LEVEL") perDealComm = levelDebtCommission(c.avgDebt, levelEnrolledVolumeThisMonth, a).amount;
        else if (c.backendKey === "LEGACY") perDealComm = LEGACY_CAPITAL.agentCommission(c.avgDebt, a.legacy.feeRate, a);
        else perDealComm = CONSUMER_SHIELD.agentCommission(c.avgDebt, a);
        const commThisCohort = survivingAtPayout * perDealComm;
        monthCommission += commThisCohort;
        monthCommissionByBackend[c.backendKey] += commThisCohort;
      }
    }

    const dynamicAssumptions: Assumptions = {
      ...a,
      headcount: { ...a.headcount, concurrentSeats: currentSeats, overseasSeats: currentOverseasSeats, totalHeadcount: currentHeadcount },
    };
    const trackdriveTierKey = resolveTrackdriveTier(tier => monthCallMinutes * tier.inbound, dynamicAssumptions).tier.key;
    const rawTotalEmails = monthQualifiedTransfers * a.operations.emailPerTransfer;
    const cappedTotalEmails = a.operations.emailMonthlyCap != null ? Math.min(rawTotalEmails, a.operations.emailMonthlyCap) : rawTotalEmails;
    const costs = calculateMonthlyCosts({
      totalCallMinutes: monthCallMinutes,
      totalSmsSegments: monthQualifiedTransfers * a.operations.smsPerTransfer,
      totalEmails: cappedTotalEmails,
      trackdriveTierKey,
    }, dynamicAssumptions);

    const netCashFlow = monthRevenue - monthCommission - monthTransferCost - costs.total;
    cashPosition += netCashFlow;

    trailingCommission12mo.push(monthCommission);
    if (trailingCommission12mo.length > 12) trailingCommission12mo.shift();
    const trailingCommissionSum = trailingCommission12mo.reduce((x, y) => x + y, 0);
    const disputeBuffer = trailingCommissionSum * (a.reservePolicy.expectedDisputeRatePct / 100);
    const reserveTarget = costs.total * a.reservePolicy.targetMonthsOverhead + disputeBuffer;
    const distributable = Math.max(0, cashPosition - reserveTarget);
    const reserveMet = cashPosition >= reserveTarget;

    // Split call time between the overseas qualifier and the US closer in
    // hybrid mode. In us_only mode the closer handles the full call, exactly
    // as before — this keeps existing behavior unchanged unless hybrid is on.
    const isHybrid = a.headcount.staffingMode === "hybrid";
    const overseasShare = isHybrid ? a.headcount.overseasQualifyingSharePct / 100 : 0;
    const closerMinutesNeeded = monthQualifiedTransfers * a.operations.avgCallMinutesPerDeal * (1 - overseasShare);
    const overseasMinutesNeeded = monthQualifiedTransfers * a.operations.avgCallMinutesPerDeal * overseasShare;

    const closerCapacityMinutes = currentSeats * a.headcount.scheduledHoursPerWeek * 60 * (52 / 12);
    const overseasCapacityMinutes = currentOverseasSeats * a.headcount.overseasScheduledHoursPerWeek * 60 * (52 / 12);
    const closerUtilization = closerCapacityMinutes > 0 ? closerMinutesNeeded / closerCapacityMinutes : 0;
    const overseasUtilization = isHybrid && overseasCapacityMinutes > 0 ? overseasMinutesNeeded / overseasCapacityMinutes : 0;

    closerUtilizationHistory.push(closerUtilization);
    if (closerUtilizationHistory.length > a.hiringPolicy.sustainMonths) closerUtilizationHistory.shift();
    const closerSustained = closerUtilizationHistory.length === a.hiringPolicy.sustainMonths &&
      closerUtilizationHistory.every(u => u >= a.hiringPolicy.utilizationThreshold);

    overseasUtilizationHistory.push(overseasUtilization);
    if (overseasUtilizationHistory.length > a.hiringPolicy.sustainMonths) overseasUtilizationHistory.shift();
    const overseasSustained = isHybrid && overseasUtilizationHistory.length === a.hiringPolicy.sustainMonths &&
      overseasUtilizationHistory.every(u => u >= a.hiringPolicy.utilizationThreshold);

    const atSeatCap = a.hiringPolicy.maxSeats != null && currentSeats >= a.hiringPolicy.maxSeats;
    const canHire = reserveMet && !pendingHire && !atSeatCap;

    let safeToHire = false;
    if (canHire) {
      // If both pools are stretched at once, hire whichever is more strained.
      if (closerSustained && (!overseasSustained || closerUtilization >= overseasUtilization)) {
        pendingHire = { effectiveMonth: t + a.hiringPolicy.hireLagMonths, pool: "closer" };
        closerUtilizationHistory = [];
        safeToHire = true;
      } else if (overseasSustained) {
        pendingHire = { effectiveMonth: t + a.hiringPolicy.hireLagMonths, pool: "overseas" };
        overseasUtilizationHistory = [];
        safeToHire = true;
      }
    }

    rows.push({
      month: t,
      newDealsTotal: (newDeals.LEVEL || 0) + (newDeals.CS || 0) + (newDeals.LEGACY || 0),
      qualifiedTransfers: round2(monthQualifiedTransfers),
      levelCommissionRate: round2(levelRate * 100),
      revenue: round2(monthRevenue),
      revenueByBackend: {
        LEVEL: round2(monthRevenueByBackend.LEVEL),
        CS: round2(monthRevenueByBackend.CS),
        LEGACY: round2(monthRevenueByBackend.LEGACY),
      },
      commission: round2(monthCommission),
      commissionByBackend: {
        LEVEL: round2(monthCommissionByBackend.LEVEL),
        CS: round2(monthCommissionByBackend.CS),
        LEGACY: round2(monthCommissionByBackend.LEGACY),
      },
      activeDealsByBackend: {
        LEVEL: round2(monthActiveDealsByBackend.LEVEL),
        CS: round2(monthActiveDealsByBackend.CS),
        LEGACY: round2(monthActiveDealsByBackend.LEGACY),
      },
      transferCost: round2(monthTransferCost),
      overhead: costs.total,
      costBreakdown: costs,
      trackdriveTierKey,
      monthCallMinutes: round2(monthCallMinutes),
      netCashFlow: round2(netCashFlow),
      cashPosition: round2(cashPosition),
      reserveTarget: round2(reserveTarget),
      distributable: round2(distributable),
      reserveMet,
      utilizationPct: round2(Math.max(closerUtilization, overseasUtilization) * 100),
      closerUtilizationPct: round2(closerUtilization * 100),
      overseasUtilizationPct: round2(overseasUtilization * 100),
      concurrentSeats: currentSeats,
      overseasSeats: currentOverseasSeats,
      safeToHire,
      hireScheduledFor: pendingHire ? pendingHire.effectiveMonth : null,
    });
  }

  return { rows, hiringEvents };
}
