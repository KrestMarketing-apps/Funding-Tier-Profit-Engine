import type {
  BackendKey, CommissionTier, LegacyBand, LegacyTerms, LevelDebtTerms, ModelInputs,
  ShieldProgram, ShieldTerms, SurvivalCurveInputs,
} from './types';

/** Highest tier whose threshold the volume clears. Shared by every graduated-rate schedule. */
export function tierRate(volume: number, tiers: CommissionTier[]): number {
  let rate = tiers[0]?.rate ?? 0;
  for (const tier of tiers) {
    if (volume >= tier.threshold) rate = tier.rate;
  }
  return rate;
}

// ── Survival ─────────────────────────────────────────────────────────────────
/**
 * survival[n] = share of enrolled deals still paying in deal-month n.
 *   month 1 = first-pay conversion
 *   months 2..: prior month x (1 - cancel% for that month)
 */
export function buildSurvivalCurve(curve: SurvivalCurveInputs, term = 36): number[] {
  const out = new Array(term + 1).fill(0);
  out[1] = curve.firstPayPct / 100;
  for (let m = 2; m <= term; m++) {
    const idx = m - 2;
    const cancel = idx < curve.cancelPctByMonth.length
      ? curve.cancelPctByMonth[idx] / 100
      : curve.steadyStateMonthlyCancelPct / 100;
    out[m] = out[m - 1] * (1 - cancel);
  }
  return out;
}

// ── Level Debt ───────────────────────────────────────────────────────────────
// Settlement product. Funding Tier is paid a single 8% share of enrolled debt
// once the client's first payment clears. Chargeback liability is extinguished
// once the SECOND completed payment clears. Nothing recurs after that.
export const levelDebt = {
  revenueForDealMonth(avgDebt: number, dealMonth: number, terms: LevelDebtTerms): number {
    return dealMonth === terms.revenueRecognizedMonth ? avgDebt * terms.revenueSharePct : 0;
  },
  commissionRate(monthlyEnrolledVolume: number, terms: LevelDebtTerms): number {
    return tierRate(monthlyEnrolledVolume, terms.commissionTiers);
  },
  agentCommission(avgDebt: number, monthlyEnrolledVolume: number, terms: LevelDebtTerms): number {
    return avgDebt * levelDebt.commissionRate(monthlyEnrolledVolume, terms);
  },
  /** Deal-months that still carry chargeback exposure. */
  liabilityMonths(terms: LevelDebtTerms): number {
    return terms.chargebackClearMonths;
  },
};

// ── Shield Services (Consumer Shield) ────────────────────────────────────────
// Two payout options on the same file:
//  • Perpetuity — Funding Tier captures a share of EVERY monthly client payment
//    for the life of the program: 100% of (payment - servicing deduction) during
//    the front months, then the backend capture rate thereafter.
//  • Enrollment File Buyout — once the first month's payment (or both halves of
//    a split first month) fully clears, Consumer Shield buys the file out with a
//    single advance: (payment - $40) x 65% x 6, or x 100% x 6 on $20k+ deals.
//    Nothing recurs after that.
export const shield = {
  getProgram(avgDebt: number, terms: ShieldTerms): ShieldProgram | undefined {
    return terms.programs.find((p) => avgDebt >= p.min && avgDebt <= p.max);
  },
  /** Monthly perpetuity — the original contract. */
  perpetualRevenueForDealMonth(avgDebt: number, dealMonth: number, terms: ShieldTerms): number {
    const program = shield.getProgram(avgDebt, terms);
    if (!program || dealMonth > program.term || dealMonth < 1) return 0;
    const net = program.payment - terms.servicingDeductionPerPayment;
    return dealMonth <= terms.frontMonths
      ? net * terms.frontCaptureRate
      : net * terms.backendCaptureRate;
  },
  /** True when the file is paid at the $20k+ buyout rate. */
  isHighDebtBuyout(avgDebt: number, terms: ShieldTerms): boolean {
    return avgDebt >= terms.buyout.highDebtMinDebt;
  },
  buyoutRate(avgDebt: number, terms: ShieldTerms): number {
    return shield.isHighDebtBuyout(avgDebt, terms) ? terms.buyout.highDebtRate : terms.buyout.standardRate;
  },
  /**
   * Enrollment File Buyout — one advance fee, sized on six months of net
   * payment, paid once the first payment (or both split halves) clears.
   * It replaces every perpetuity payment on that file.
   */
  buyoutPayout(avgDebt: number, terms: ShieldTerms): number {
    const program = shield.getProgram(avgDebt, terms);
    if (!program) return 0;
    const net = program.payment - terms.servicingDeductionPerPayment;
    return net * shield.buyoutRate(avgDebt, terms) * terms.buyout.months;
  },
  buyoutRevenueForDealMonth(avgDebt: number, dealMonth: number, terms: ShieldTerms): number {
    return dealMonth === terms.buyout.triggerDealMonth ? shield.buyoutPayout(avgDebt, terms) : 0;
  },
  /**
   * Blended per-deal revenue: buyoutSharePct of files take the advance, the
   * rest stay on the perpetuity. The survival curve is applied by the caller,
   * so the buyout lands only on files whose first payment actually cleared.
   */
  revenueForDealMonth(avgDebt: number, dealMonth: number, terms: ShieldTerms): number {
    const share = Math.min(1, Math.max(0, (terms.buyoutSharePct ?? 0) / 100));
    const perp = share < 1 ? shield.perpetualRevenueForDealMonth(avgDebt, dealMonth, terms) : 0;
    const buy = share > 0 ? shield.buyoutRevenueForDealMonth(avgDebt, dealMonth, terms) : 0;
    return perp * (1 - share) + buy * share;
  },
  /** Perpetuity income per deal if the client never cancels. */
  perpetualFullTerm(avgDebt: number, terms: ShieldTerms): number {
    const program = shield.getProgram(avgDebt, terms);
    if (!program) return 0;
    let total = 0;
    for (let m = 1; m <= program.term; m++) total += shield.perpetualRevenueForDealMonth(avgDebt, m, terms);
    return total;
  },
  /**
   * Expected perpetuity income per deal whose first payment cleared, weighted
   * by the survival curve (survival[n] / survival[1]).
   */
  perpetualExpected(avgDebt: number, terms: ShieldTerms, survival: number[]): number {
    const program = shield.getProgram(avgDebt, terms);
    const s1 = survival[1] ?? 0;
    if (!program || s1 <= 0) return 0;
    let total = 0;
    for (let m = 1; m <= program.term; m++) {
      total += ((survival[m] ?? 0) / s1) * shield.perpetualRevenueForDealMonth(avgDebt, m, terms);
    }
    return total;
  },
  /** Payments a perpetuity file must make before it out-earns the buyout. null = never. */
  breakEvenPayments(avgDebt: number, terms: ShieldTerms): number | null {
    const program = shield.getProgram(avgDebt, terms);
    const target = shield.buyoutPayout(avgDebt, terms);
    if (!program) return null;
    let total = 0;
    for (let m = 1; m <= program.term; m++) {
      total += shield.perpetualRevenueForDealMonth(avgDebt, m, terms);
      if (total >= target) return m;
    }
    return null;
  },
  agentCommission(avgDebt: number, terms: ShieldTerms): number {
    return shield.getProgram(avgDebt, terms)?.commission ?? 0;
  },
};

// ── Elite Legal Practice (Legacy Capital) ────────────────────────────────────
// Perpetuity product. Sliding fee (35%-49% of enrolled debt) spread over a term
// set by the $250/mo CLIENT DRAFT floor.
//
//   clientDraft = serviceFee/term + $80 maintenance + $4 per draft
//   Payments 1-2 : clientDraft - draftFee        (maintenance NOT backed out)
//   Payments 3+  : (clientDraft - maintenance - draftFee) x tier rate
//
// A split schedule drafts the client twice a month: the $4 is charged twice,
// the $80 maintenance still once.
//
// The math itself lives in components/legacyEngine.ts, which is the single
// source of truth shared with the Profit Engine and mirrors the production
// Billable Payout Simulator. Nothing is reimplemented here.
import {
  elpDraftMonthly, elpFinalPayment, elpMaxTerm, elpPaymentForMonth,
  elpSchedule, elpScheduledPayment, elpTierRateForFiles, elpTerm,
  type ElpTerms as EngineElpTerms,
} from '../legacyEngine';

function findBand(bands: LegacyBand[], avgDebt: number): LegacyBand | undefined {
  return bands.find((b) => avgDebt >= b.min && avgDebt <= b.max);
}

/** Round to the cent, the way a payment processor does. */
const toCents = (n: number) => Math.round(n * 100) / 100;

/** LegacyTerms carries feeRate as a fraction; the engine wants a percentage. */
function engineTerms(terms: LegacyTerms, monthlyFiles?: number): EngineElpTerms {
  return {
    feeRatePct: terms.feeRate * 100,
    maintFee: terms.maintenanceFee,
    split: terms.splitSchedule,
    tierRate: monthlyFiles == null ? terms.tier1Rate : elpTierRateForFiles(monthlyFiles),
    term: terms.targetTerm,
  };
}

export const legacy = {
  /** Total program fee, exact to the penny. */
  totalFee(avgDebt: number, terms: LegacyTerms): number {
    return toCents(avgDebt * terms.feeRate);
  },
  /**
   * The term deals are actually written at, clamped by what the $250 draft
   * floor allows. The floor is a minimum on the CLIENT DRAFT, not the term —
   * treating the longest permitted term as the default understates ELP on
   * both axes, since months 1-2 pass through in full and a longer term pushes
   * more of the fee past them into the tier-rate phase.
   */
  getMaxTerm(avgDebt: number, terms: LegacyTerms): number {
    return elpTerm(avgDebt, engineTerms(terms));
  },
  /** Longest term the $250 floor permits — the ceiling, not the default. */
  getTermCap(avgDebt: number, terms: LegacyTerms): number {
    return elpMaxTerm(avgDebt, terms.feeRate * 100, terms.maintenanceFee, terms.splitSchedule);
  },
  /** Draft fee charged per month — doubled on a split schedule. */
  draftFeePerMonth(terms: LegacyTerms): number {
    return elpDraftMonthly(terms.splitSchedule);
  },
  /**
   * Elite Legal Practice drafts to the exact penny — nothing is rounded to the
   * dollar. Only the service fee portion has to total exactly, so it is
   * truncated to the cent for every month but the last; the final draft
   * carries the remainder. Maintenance and draft fees are flat adders.
   */
  getScheduledPayment(avgDebt: number, terms: LegacyTerms): number {
    return elpScheduledPayment(avgDebt, engineTerms(terms));
  },
  getFinalPayment(avgDebt: number, terms: LegacyTerms): number {
    return elpFinalPayment(avgDebt, engineTerms(terms));
  },
  /** Payment drafted in a given deal-month, exact to the penny. */
  getMonthlyPayment(avgDebt: number, terms: LegacyTerms, dealMonth?: number): number {
    return elpPaymentForMonth(avgDebt, engineTerms(terms), dealMonth);
  },
  /** Service fee portion of the draft — the only part shared from month 3 on. */
  serviceFeeMonthly(avgDebt: number, terms: LegacyTerms): number {
    return elpSchedule(avgDebt, engineTerms(terms)).serviceFeeMonthly;
  },
  revenueForDealMonth(avgDebt: number, dealMonth: number, terms: LegacyTerms): number {
    const sched = elpSchedule(avgDebt, engineTerms(terms));
    if (!sched.eligible || dealMonth < 1 || dealMonth > sched.term) return 0;
    return dealMonth <= 2 ? sched.earlyRevenue : sched.lateRevenue;
  },
  /**
   * Flat band commission. This was previously scaled by feeRate / 0.4, which
   * paid 22.5% over schedule at the 49% fee rate. The live Commission
   * Simulator pays the band amount flat, split across Payment 2 and Payment 4.
   */
  agentCommission(avgDebt: number, terms: LegacyTerms): number {
    const band = findBand(terms.bands, avgDebt);
    return band ? band.total : 0;
  },
};

// ── Unified accessors ────────────────────────────────────────────────────────

export function revenueForDealMonth(
  key: BackendKey, avgDebt: number, dealMonth: number, inputs: ModelInputs,
): number {
  if (key === 'LEVEL') return levelDebt.revenueForDealMonth(avgDebt, dealMonth, inputs.levelDebt);
  if (key === 'CS') return shield.revenueForDealMonth(avgDebt, dealMonth, inputs.consumerShield);
  return legacy.revenueForDealMonth(avgDebt, dealMonth, inputs.legacy);
}

export function agentCommissionForDeal(
  key: BackendKey, avgDebt: number, monthlyEnrolledVolume: number, inputs: ModelInputs,
): number {
  if (key === 'LEVEL') return levelDebt.agentCommission(avgDebt, monthlyEnrolledVolume, inputs.levelDebt);
  if (key === 'CS') return shield.agentCommission(avgDebt, inputs.consumerShield);
  return legacy.agentCommission(avgDebt, inputs.legacy);
}

export function agentPayoutMonth(key: BackendKey, inputs: ModelInputs): number {
  if (key === 'LEVEL') return inputs.levelDebt.agentPayoutMonth;
  if (key === 'CS') return inputs.consumerShield.agentPayoutMonth;
  return inputs.legacy.agentPayoutMonth;
}

/** Longest deal-month that can still produce revenue for a backend. */
export function maxRevenueMonth(key: BackendKey, avgDebt: number, inputs: ModelInputs): number {
  if (key === 'LEVEL') return inputs.levelDebt.revenueRecognizedMonth;
  if (key === 'CS') return shield.getProgram(avgDebt, inputs.consumerShield)?.term ?? 0;
  return legacy.getMaxTerm(avgDebt, inputs.legacy);
}

export function revenueModelLabel(key: BackendKey, avgDebt: number, inputs: ModelInputs): string {
  if (key === 'LEVEL') {
    const t = inputs.levelDebt;
    return `One-time ${(t.revenueSharePct * 100).toFixed(0)}% of enrolled debt, paid once the first client payment clears (deal-month ${t.revenueRecognizedMonth}). Chargeback liability is extinguished after ${t.chargebackClearMonths} completed payments — no revenue recurs after that.`;
  }
  if (key === 'CS') {
    const t = inputs.consumerShield;
    const p = shield.getProgram(avgDebt, t);
    const perp = `Monthly perpetuity for the life of the program (${p?.term ?? '?'} months). Funding Tier keeps ${(t.frontCaptureRate * 100).toFixed(0)}% of each $${p?.payment ?? '?'} payment less the $${t.servicingDeductionPerPayment} servicing deduction for the first ${t.frontMonths} months, then ${(t.backendCaptureRate * 100).toFixed(0)}%.`;
    const buy = `Enrollment File Buyout: one advance of $${shield.buyoutPayout(avgDebt, t).toFixed(0)} ((${p?.payment ?? '?'} − ${t.servicingDeductionPerPayment}) × ${(shield.buyoutRate(avgDebt, t) * 100).toFixed(0)}% × ${t.buyout.months}), paid once the first payment clears. Nothing recurs.`;
    const share = t.buyoutSharePct ?? 0;
    if (share <= 0) return perp;
    if (share >= 100) return buy;
    return `${share.toFixed(0)}% of files bought out, ${(100 - share).toFixed(0)}% kept on the perpetuity. ${buy} ${perp}`;
  }
  const t = inputs.legacy;
  const term = legacy.getMaxTerm(avgDebt, t);
  const pay = legacy.getMonthlyPayment(avgDebt, t);
  const draftFee = legacy.draftFeePerMonth(t);
  const schedule = t.splitSchedule ? '2 drafts/mo' : '1 draft/mo';
  return `Monthly perpetuity across a ${term}-month term. Client draft $${pay.toFixed(0)} = service fee + $${t.maintenanceFee} maintenance + $${draftFee} processing (${schedule}). Months 1-2 pass through less the $${draftFee} draft fee; from month 3 the maintenance fee also comes off and Funding Tier keeps ${(t.tier1Rate * 100).toFixed(0)}% of what is left.`;
}

export function isPerpetuity(key: BackendKey, inputs?: ModelInputs): boolean {
  if (key === 'LEVEL') return false;
  if (key === 'CS' && inputs && (inputs.consumerShield.buyoutSharePct ?? 0) >= 100) return false;
  return true;
}
