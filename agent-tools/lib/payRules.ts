/**
 * Funding Tier pay rules — the ONE place commission, bonus, eligibility and
 * payout-timing numbers live. The Earnings Simulator, the Commission
 * Simulator, My Deals & Pay, and the Commission, Bonuses & SPIFFs page all
 * read from here so they cannot drift apart again.
 *
 * Decisions encoded here (Nathan Pottish, November 5, 2026):
 *   - Shield Services (Debt Validation) is the primary program. A new rep is
 *     Shield-only until trained and cleared on the other programs (typically
 *     the first 30 to 60 days).
 *   - Balanced Book Bonus = Level Debt share of the rep's WHOLE monthly book,
 *     minimum 5 deals, $100 at 25%, $250 at 35%, $500 at 45%. Only reps who
 *     are cleared on Level Debt and Debt Resolution are eligible.
 *   - Dispute or chargeback at any point reverses all commission and bonuses
 *     on that file.
 *
 * Change a number here, and every tool changes with it.
 */

export const PAY_RULES_VERSION = "2026-11-05";

export type ProgramKey = "SHIELD" | "ELP" | "LEVEL" | "LOAN";

export interface FlatBand {
  code: string;
  label: string;
  minDebt: number;
  maxDebt: number;
  commission: number;
}

export interface PctTier {
  id: number;
  label: string;
  /** Monthly Level Debt enrolled volume at which this tier starts. */
  minMonthlyVolume: number;
  rate: number;
}

// ── Program metadata ───────────────────────────────────────────────────────

export const PROGRAMS: Record<ProgramKey, {
  key: ProgramKey;
  name: string;
  short: string;
  partner: string;
  primary: boolean;
  minDebt: number;
  blockedStates: string[];
  /** Plain-language payout timing shown to reps. */
  timing: string;
  /** Program payments after which nothing can be clawed back (disputes aside). */
  chargebackFreeAfter: number;
  /** Rough month-of-cash lag from the close for a first payment that clears on time. */
  payLagMonths: number;
}> = {
  SHIELD: {
    key: "SHIELD",
    name: "Shield Services (Debt Validation)",
    short: "Shield Services",
    partner: "Shield Services",
    primary: true,
    minDebt: 4000,
    blockedStates: [],
    timing: "First program payment clears any day of month M → Shield pays Funding Tier by the 15th of M+1 → you are paid the 20th of M+1.",
    chargebackFreeAfter: 1,
    payLagMonths: 1,
  },
  ELP: {
    key: "ELP",
    name: "Debt Resolution (Elite Legal Practice)",
    short: "Debt Resolution",
    partner: "Elite Legal Practice",
    primary: false,
    minDebt: 6000,
    blockedStates: ["ID", "ND", "GA"],
    timing: "First program payment clears (weekly cohorts) → Funding Tier is paid 12 to 19 days later → you are paid the 20th of the following month.",
    chargebackFreeAfter: 1,
    payLagMonths: 1,
  },
  LEVEL: {
    key: "LEVEL",
    name: "Level Debt (Debt Settlement)",
    short: "Level Debt",
    partner: "Level Debt",
    primary: false,
    minDebt: 7000,
    blockedStates: [],
    timing: "First payment clears 1st–15th → paid the 1st of next month. Clears 16th–end of month → paid the 15th of next month. Final once the 2nd program payment clears.",
    chargebackFreeAfter: 2,
    payLagMonths: 1,
  },
  LOAN: {
    key: "LOAN",
    name: "Personal / Business Loan Referral",
    short: "Loan Referral",
    partner: "Corresponding lenders",
    primary: false,
    minDebt: 0,
    blockedStates: [],
    timing: "Paid within 60 days of Funding Tier receiving the lender's referral payment on a funded loan.",
    chargebackFreeAfter: 1,
    payLagMonths: 2,
  },
};

// ── Commission tables ──────────────────────────────────────────────────────

export const SHIELD_PROGRAMS: FlatBand[] = [
  { code: "A", label: "Program A", minDebt: 4000, maxDebt: 4999, commission: 150 },
  { code: "B", label: "Program B", minDebt: 5000, maxDebt: 8799, commission: 150 },
  { code: "C", label: "Program C", minDebt: 8800, maxDebt: 9999, commission: 150 },
  { code: "D", label: "Program D", minDebt: 10000, maxDebt: 14999, commission: 225 },
  { code: "E", label: "Program E", minDebt: 15000, maxDebt: 19999, commission: 275 },
  { code: "F", label: "Program F", minDebt: 20000, maxDebt: 24999, commission: 350 },
  { code: "G", label: "Program G", minDebt: 25000, maxDebt: 29999, commission: 400 },
  { code: "H", label: "Program H", minDebt: 30000, maxDebt: 49999, commission: 500 },
  { code: "I", label: "Program I", minDebt: 50000, maxDebt: Infinity, commission: 600 },
];

export const ELP_BANDS: FlatBand[] = [
  { code: "L1", label: "Band L1", minDebt: 6000, maxDebt: 9999, commission: 150 },
  { code: "L2", label: "Band L2", minDebt: 10000, maxDebt: 14999, commission: 225 },
  { code: "L3", label: "Band L3", minDebt: 15000, maxDebt: 19999, commission: 275 },
  { code: "L4", label: "Band L4", minDebt: 20000, maxDebt: 24999, commission: 350 },
  { code: "L5", label: "Band L5", minDebt: 25000, maxDebt: 29999, commission: 400 },
  { code: "L6", label: "Band L6", minDebt: 30000, maxDebt: 49999, commission: 500 },
  { code: "L7", label: "Band L7", minDebt: 50000, maxDebt: Infinity, commission: 600 },
];

export const LEVEL_TIERS: PctTier[] = [
  { id: 1, label: "Tier 1", minMonthlyVolume: 0, rate: 0.01 },
  { id: 2, label: "Tier 2", minMonthlyVolume: 1_000_000, rate: 0.0115 },
  { id: 3, label: "Tier 3", minMonthlyVolume: 2_000_000, rate: 0.013 },
];

/** Share of the revenue Funding Tier receives from a lender on a funded loan. */
export const LOAN_REFERRAL_RATE = 0.15;

export function shieldProgramFor(debt: number): FlatBand | null {
  return SHIELD_PROGRAMS.find((b) => debt >= b.minDebt && debt <= b.maxDebt) ?? null;
}
export function elpBandFor(debt: number): FlatBand | null {
  return ELP_BANDS.find((b) => debt >= b.minDebt && debt <= b.maxDebt) ?? null;
}
export function levelTierFor(monthlyVolume: number): PctTier {
  let t = LEVEL_TIERS[0];
  for (const tier of LEVEL_TIERS) if (monthlyVolume >= tier.minMonthlyVolume) t = tier;
  return t;
}

export interface CommissionResult {
  amount: number;
  basis: string;
  eligible: boolean;
}

/** Base commission for one deal. Level Debt needs the rep's Level volume for the month. */
export function commissionFor(program: ProgramKey, enrolledDebt: number, opts: { levelMonthlyVolume?: number; lenderRevenue?: number } = {}): CommissionResult {
  switch (program) {
    case "SHIELD": {
      const b = shieldProgramFor(enrolledDebt);
      return b
        ? { amount: b.commission, basis: `Shield ${b.label}: flat $${b.commission}`, eligible: true }
        : { amount: 0, basis: "Below the $4,000 Shield minimum", eligible: false };
    }
    case "ELP": {
      const b = elpBandFor(enrolledDebt);
      return b
        ? { amount: b.commission, basis: `Debt Resolution ${b.label}: flat $${b.commission}`, eligible: true }
        : { amount: 0, basis: "Below the $6,000 Debt Resolution minimum", eligible: false };
    }
    case "LEVEL": {
      if (enrolledDebt < PROGRAMS.LEVEL.minDebt) return { amount: 0, basis: "Below the $7,000 Level Debt minimum", eligible: false };
      const vol = opts.levelMonthlyVolume ?? enrolledDebt;
      const t = levelTierFor(vol);
      return { amount: Math.round(enrolledDebt * t.rate), basis: `${(t.rate * 100).toFixed(2)}% of $${enrolledDebt.toLocaleString()} (${t.label} on $${Math.round(vol).toLocaleString()} monthly Level volume)`, eligible: true };
    }
    case "LOAN": {
      const rev = opts.lenderRevenue ?? 0;
      return { amount: Math.round(rev * LOAN_REFERRAL_RATE), basis: `${LOAN_REFERRAL_RATE * 100}% of $${rev.toLocaleString()} lender revenue`, eligible: rev > 0 };
    }
  }
}

// ── Bonuses and SPIFFs ─────────────────────────────────────────────────────

/** Shield + Debt Resolution deals pool together for the daily and monthly bonuses. Level Debt is tracked separately. */
export const POOLED_PROGRAMS: ProgramKey[] = ["SHIELD", "ELP"];

export const DAILY_DEAL_BONUS = [
  { minDeals: 3, perDeal: 50 },
  { minDeals: 5, perDeal: 75 },
];

/** Per-deal bonus paid on EVERY pooled deal closed that day once the day's count hits the threshold. */
export function dailyBonusPerDeal(pooledDealsToday: number): number {
  let per = 0;
  for (const t of DAILY_DEAL_BONUS) if (pooledDealsToday >= t.minDeals) per = t.perDeal;
  return per;
}
export function dailyBonusTotal(pooledDealsToday: number): number {
  return dailyBonusPerDeal(pooledDealsToday) * pooledDealsToday;
}

export const MONTHLY_VOLUME_BONUS = [
  { minDeals: 8, bonus: 300 },
  { minDeals: 12, bonus: 600 },
  { minDeals: 17, bonus: 1000 },
  { minDeals: 23, bonus: 1500 },
  { minDeals: 30, bonus: 2250 },
];

/** Pooled Shield + Debt Resolution deals with the 2nd program payment cleared in the calendar month. */
export function monthlyVolumeBonus(pooledDealsP2Cleared: number): number {
  let b = 0;
  for (const t of MONTHLY_VOLUME_BONUS) if (pooledDealsP2Cleared >= t.minDeals) b = t.bonus;
  return b;
}
export function nextMonthlyVolumeTier(pooledDeals: number) {
  return MONTHLY_VOLUME_BONUS.find((t) => pooledDeals < t.minDeals) ?? null;
}

export const BALANCED_BOOK = {
  minDeals: 5,
  /** Level Debt share of the rep's whole monthly book (all programs). */
  tiers: [
    { minLevelShare: 0.25, bonus: 100 },
    { minLevelShare: 0.35, bonus: 250 },
    { minLevelShare: 0.45, bonus: 500 },
  ],
  description: "Paid for the mix of your book, not the size of it: the share of this month's deals that are Level Debt settlement. Requires at least 5 total deals, and you must be cleared on Level Debt and Debt Resolution.",
};

export interface BalancedBookResult {
  bonus: number;
  levelShare: number;
  eligible: boolean;
  reason: string;
}

export function balancedBookBonus(totalDeals: number, levelDeals: number, clearedOnAllPrograms: boolean): BalancedBookResult {
  const share = totalDeals > 0 ? levelDeals / totalDeals : 0;
  if (!clearedOnAllPrograms) return { bonus: 0, levelShare: share, eligible: false, reason: "Available once you are trained and cleared on Level Debt and Debt Resolution." };
  if (totalDeals < BALANCED_BOOK.minDeals) return { bonus: 0, levelShare: share, eligible: true, reason: `Needs at least ${BALANCED_BOOK.minDeals} total deals this month.` };
  let bonus = 0;
  for (const t of BALANCED_BOOK.tiers) if (share >= t.minLevelShare) bonus = t.bonus;
  const pct = Math.round(share * 100);
  if (bonus === 0) {
    return { bonus, levelShare: share, eligible: true, reason: `Level Debt is ${pct}% of your book; the first tier starts at 25%.` };
  }
  return { bonus, levelShare: share, eligible: true, reason: `Level Debt is ${pct}% of your book.` };
}

export const LEVEL_ENROLLMENT_BONUS = [
  { minDailyEnrolled: 75_000, bonus: 75 },
  { minDailyEnrolled: 100_000, bonus: 125 },
];

/** Level Debt's own daily enrolled-volume bonus. */
export function levelEnrollmentBonus(levelEnrolledToday: number): number {
  let b = 0;
  for (const t of LEVEL_ENROLLMENT_BONUS) if (levelEnrolledToday >= t.minDailyEnrolled) b = t.bonus;
  return b;
}

// ── Policy text shared across tools ────────────────────────────────────────

export const POLICY = {
  programPayment: "A program payment is one month of the client's plan. On split, bi-weekly, or semi-monthly plans, every draft for that month must clear before it counts; two drafts are never two program payments.",
  nsf: "A returned or NSF draft does not count. When the backend re-drafts and it clears, THAT clear date is the first program payment date, and your pay date is calculated from it.",
  lateBackend: "You are paid after Funding Tier has been paid by the program provider. If the provider pays late, your pay date moves to the next pay day after the money arrives.",
  provisional: "All bonus amounts are provisional until the related files clear the applicable clawback and chargeback windows.",
  dispute: "If a client formally disputes or charges back any payment at any point in the program, all commission and bonuses already paid on that file are clawed back.",
  modification: "Funding Tier may modify commission rates, bonus thresholds, and payout timing at its sole discretion with notice. Changes apply to deals closed after the effective date.",
};

// ── Earnings simulation (what a rep could make) ────────────────────────────

export interface EarningsInputs {
  hoursPerWeek: number;
  qualifiedCallsPerHour: number;
  /** 0–1: share of qualified calls that enroll. */
  closeRate: number;
  /** 0–1: share of enrollments whose first program payment never clears (NSF / cancel). */
  firstPaymentFallout: number;
  /** 0–1: share of paid deals whose 2nd program payment clears (used for Monthly Volume bonus and LD finality). */
  secondPaymentClears: number;
  /** Program mix of enrollments, must sum to 1. Forced to 100% Shield while not cleared. */
  mix: { SHIELD: number; ELP: number; LEVEL: number };
  /** Average enrolled debt per program. */
  avgDebt: { SHIELD: number; ELP: number; LEVEL: number };
  clearedOnAllPrograms: boolean;
}

export const DEFAULT_EARNINGS_INPUTS: EarningsInputs = {
  hoursPerWeek: 40,
  qualifiedCallsPerHour: 1.5,
  closeRate: 0.12,
  firstPaymentFallout: 0.5,
  secondPaymentClears: 0.9,
  mix: { SHIELD: 1, ELP: 0, LEVEL: 0 },
  avgDebt: { SHIELD: 12000, ELP: 15000, LEVEL: 25000 },
  clearedOnAllPrograms: false,
};

export const WEEKS_PER_MONTH = 52 / 12;
export const WORK_DAYS_PER_MONTH = 21;

export interface EarningsResult {
  hoursPerMonth: number;
  qualifiedCallsPerMonth: number;
  enrollmentsPerMonth: number;
  paidDealsPerMonth: number;
  lostToFallout: number;
  byProgram: Record<"SHIELD" | "ELP" | "LEVEL", { deals: number; perDeal: number; commission: number; avgDebt: number; basis: string }>;
  levelMonthlyVolume: number;
  levelTier: PctTier;
  pooledDeals: number;
  pooledDealsP2: number;
  dailyBonus: number;
  dailyBonusNote: string;
  monthlyBonus: number;
  monthlyBonusNext: { minDeals: number; bonus: number } | null;
  balancedBook: BalancedBookResult;
  levelEnrollment: number;
  commissionTotal: number;
  bonusTotal: number;
  monthlyTotal: number;
  annualTotal: number;
  perHour: number;
  perQualifiedCall: number;
}

function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i += 1) p *= lambda / i;
  return p;
}

/** Expected daily-bonus dollars per day when pooled deals per day average `lambda`. */
export function expectedDailyBonusPerDay(lambda: number): number {
  let total = 0;
  for (let k = 0; k <= 30; k += 1) total += poissonPmf(k, lambda) * dailyBonusTotal(k);
  return total;
}

export function simulateEarnings(raw: EarningsInputs): EarningsResult {
  const i = { ...raw };
  const mix = i.clearedOnAllPrograms ? { ...i.mix } : { SHIELD: 1, ELP: 0, LEVEL: 0 };
  const mixSum = mix.SHIELD + mix.ELP + mix.LEVEL || 1;
  mix.SHIELD /= mixSum; mix.ELP /= mixSum; mix.LEVEL /= mixSum;

  const hoursPerMonth = i.hoursPerWeek * WEEKS_PER_MONTH;
  const qualifiedCallsPerMonth = hoursPerMonth * i.qualifiedCallsPerHour;
  const enrollmentsPerMonth = qualifiedCallsPerMonth * i.closeRate;
  const paidDealsPerMonth = enrollmentsPerMonth * (1 - i.firstPaymentFallout);
  const lostToFallout = enrollmentsPerMonth - paidDealsPerMonth;

  const deals = {
    SHIELD: paidDealsPerMonth * mix.SHIELD,
    ELP: paidDealsPerMonth * mix.ELP,
    LEVEL: paidDealsPerMonth * mix.LEVEL,
  };
  const levelMonthlyVolume = deals.LEVEL * i.avgDebt.LEVEL;
  const levelTier = levelTierFor(levelMonthlyVolume);

  const shieldC = commissionFor("SHIELD", i.avgDebt.SHIELD);
  const elpC = commissionFor("ELP", i.avgDebt.ELP);
  const levelC = commissionFor("LEVEL", i.avgDebt.LEVEL, { levelMonthlyVolume });

  const byProgram = {
    SHIELD: { deals: deals.SHIELD, perDeal: shieldC.amount, commission: deals.SHIELD * shieldC.amount, avgDebt: i.avgDebt.SHIELD, basis: shieldC.basis },
    ELP: { deals: deals.ELP, perDeal: elpC.amount, commission: deals.ELP * elpC.amount, avgDebt: i.avgDebt.ELP, basis: elpC.basis },
    LEVEL: { deals: deals.LEVEL, perDeal: levelC.amount, commission: deals.LEVEL * levelC.amount, avgDebt: i.avgDebt.LEVEL, basis: levelC.basis },
  };
  const commissionTotal = byProgram.SHIELD.commission + byProgram.ELP.commission + byProgram.LEVEL.commission;

  const pooledDeals = deals.SHIELD + deals.ELP;
  const pooledDealsP2 = pooledDeals * i.secondPaymentClears;
  // Daily bonus counts deals CLOSED that day (enrollments, before fallout) — then clawed back if they never pay.
  // Simulate on paid pooled deals to stay conservative.
  const pooledPerDay = pooledDeals / WORK_DAYS_PER_MONTH;
  const dailyBonus = expectedDailyBonusPerDay(pooledPerDay) * WORK_DAYS_PER_MONTH;
  const dailyBonusNote = pooledPerDay >= 3
    ? `Averaging ${pooledPerDay.toFixed(1)} pooled deals a day, so most days clear the 3-deal threshold.`
    : pooledPerDay >= 1
      ? `Averaging ${pooledPerDay.toFixed(1)} pooled deals a day. Some days will hit 3+, most will not; this is the expected value.`
      : `Under 1 pooled deal a day on average, so 3-deal days are rare.`;

  const monthlyBonus = monthlyVolumeBonus(Math.floor(pooledDealsP2));
  const monthlyBonusNext = nextMonthlyVolumeTier(Math.floor(pooledDealsP2));
  const balancedBook = balancedBookBonus(Math.floor(paidDealsPerMonth), Math.floor(deals.LEVEL), i.clearedOnAllPrograms);
  const levelPerDay = levelMonthlyVolume / WORK_DAYS_PER_MONTH;
  const levelEnrollment = i.clearedOnAllPrograms ? levelEnrollmentBonus(levelPerDay) * WORK_DAYS_PER_MONTH : 0;

  const bonusTotal = dailyBonus + monthlyBonus + balancedBook.bonus + levelEnrollment;
  const monthlyTotal = commissionTotal + bonusTotal;

  return {
    hoursPerMonth, qualifiedCallsPerMonth, enrollmentsPerMonth, paidDealsPerMonth, lostToFallout,
    byProgram, levelMonthlyVolume, levelTier, pooledDeals, pooledDealsP2,
    dailyBonus, dailyBonusNote, monthlyBonus, monthlyBonusNext, balancedBook, levelEnrollment,
    commissionTotal, bonusTotal, monthlyTotal, annualTotal: monthlyTotal * 12,
    perHour: hoursPerMonth > 0 ? monthlyTotal / hoursPerMonth : 0,
    perQualifiedCall: qualifiedCallsPerMonth > 0 ? monthlyTotal / qualifiedCallsPerMonth : 0,
  };
}

// ── Pay-date math (mirrors lib/agentOps/closerPay.ts PAY_RULES) ───────────

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

/** Scheduled rep pay date given the date the first program payment actually cleared. */
export function scheduledPayDate(program: ProgramKey, clearedAt: Date): Date {
  const y = clearedAt.getUTCFullYear(), m = clearedAt.getUTCMonth(), d = clearedAt.getUTCDate();
  switch (program) {
    case "LEVEL": return d <= 15 ? utc(y, m + 1, 1) : utc(y, m + 1, 15);
    case "SHIELD":
    case "ELP": return utc(y, m + 1, 20);
    case "LOAN": return utc(y, m + 2, d);
  }
}

export interface DraftEvent {
  date: Date;
  kind: "scheduled" | "nsf" | "redraft_cleared" | "cleared";
  label: string;
}

/**
 * Walk a first-payment scenario so a rep can see exactly what an NSF does to
 * their pay date. `nsfDays` = days after the scheduled draft that it returns;
 * `redraftDays` = days after the NSF that the re-draft clears.
 */
export function firstPaymentTimeline(program: ProgramKey, scheduledDraft: Date, opts: { nsf?: boolean; nsfDays?: number; redraftDays?: number } = {}) {
  const events: DraftEvent[] = [{ date: scheduledDraft, kind: "scheduled", label: "First draft scheduled" }];
  let clearedAt = scheduledDraft;
  if (opts.nsf) {
    const nsfAt = new Date(scheduledDraft.getTime() + (opts.nsfDays ?? 3) * 86_400_000);
    const redraftAt = new Date(nsfAt.getTime() + (opts.redraftDays ?? 14) * 86_400_000);
    events.push({ date: nsfAt, kind: "nsf", label: "Draft returned NSF — does not count as a program payment" });
    events.push({ date: redraftAt, kind: "redraft_cleared", label: "Re-draft cleared — this is program payment 1" });
    clearedAt = redraftAt;
  } else {
    events.push({ date: scheduledDraft, kind: "cleared", label: "Draft cleared — program payment 1" });
  }
  const payDate = scheduledPayDate(program, clearedAt);
  const onTimePayDate = scheduledPayDate(program, scheduledDraft);
  const slipDays = Math.round((payDate.getTime() - onTimePayDate.getTime()) / 86_400_000);
  return { events, clearedAt, payDate, onTimePayDate, slipDays };
}
