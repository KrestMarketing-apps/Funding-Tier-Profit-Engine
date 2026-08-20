import type {
  BackendKey, LegacyBand, LegacyTerms, LevelDebtTerms, ModelInputs,
  ShieldProgram, ShieldTerms, SurvivalCurveInputs,
} from './types';

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
    let rate = terms.commissionTiers[0]?.rate ?? 0;
    for (const tier of terms.commissionTiers) {
      if (monthlyEnrolledVolume >= tier.threshold) rate = tier.rate;
    }
    return rate;
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
// Perpetuity product. Funding Tier captures a share of EVERY monthly client
// payment for the life of the program — 100% of (payment - servicing deduction)
// during the front months, then the backend capture rate thereafter.
export const shield = {
  getProgram(avgDebt: number, terms: ShieldTerms): ShieldProgram | undefined {
    return terms.programs.find((p) => avgDebt >= p.min && avgDebt <= p.max);
  },
  revenueForDealMonth(avgDebt: number, dealMonth: number, terms: ShieldTerms): number {
    const program = shield.getProgram(avgDebt, terms);
    if (!program || dealMonth > program.term || dealMonth < 1) return 0;
    const net = program.payment - terms.servicingDeductionPerPayment;
    return dealMonth <= terms.frontMonths
      ? net * terms.frontCaptureRate
      : net * terms.backendCaptureRate;
  },
  agentCommission(avgDebt: number, terms: ShieldTerms): number {
    return shield.getProgram(avgDebt, terms)?.commission ?? 0;
  },
};

// ── Elite Legal Practice (Legacy Capital) ────────────────────────────────────
// Perpetuity product. Sliding fee (35%-49% of enrolled debt) spread over a term
// set by the $250/mo payment floor. Months 1-2 pass through less the draft fee;
// from month 3 Funding Tier keeps tier-1 % of the payment after the admin fee.
function findBand(bands: LegacyBand[], avgDebt: number): LegacyBand | undefined {
  return bands.find((b) => avgDebt >= b.min && avgDebt <= b.max);
}

/** Round to the cent, the way a payment processor does. */
const toCents = (n: number) => Math.round(n * 100) / 100;
/** Truncate to the cent — a scheduled draft never over-collects. */
const floorCents = (n: number) => Math.floor(n * 100) / 100;

export const legacy = {
  /** Total program fee, exact to the penny. */
  totalFee(avgDebt: number, terms: LegacyTerms): number {
    return toCents(avgDebt * terms.feeRate);
  },
  /** Program length: the $250 floor caps how long the fee can be spread. */
  getMaxTerm(avgDebt: number, terms: LegacyTerms): number {
    const fee = legacy.totalFee(avgDebt, terms);
    return Math.max(1, Math.floor(fee / terms.minMonthlyPayment));
  },
  /**
   * Elite Legal Practice drafts to the exact penny — nothing is rounded to the
   * dollar. Every scheduled payment except the last is the fee divided by the
   * term truncated to the cent; the final draft carries the remainder so the
   * client is billed the fee exactly, never a fraction more or less.
   */
  getScheduledPayment(avgDebt: number, terms: LegacyTerms): number {
    const term = legacy.getMaxTerm(avgDebt, terms);
    return floorCents(legacy.totalFee(avgDebt, terms) / term);
  },
  getFinalPayment(avgDebt: number, terms: LegacyTerms): number {
    const term = legacy.getMaxTerm(avgDebt, terms);
    const base = legacy.getScheduledPayment(avgDebt, terms);
    return toCents(legacy.totalFee(avgDebt, terms) - base * (term - 1));
  },
  /** Payment drafted in a given deal-month, exact to the penny. */
  getMonthlyPayment(avgDebt: number, terms: LegacyTerms, dealMonth?: number): number {
    const term = legacy.getMaxTerm(avgDebt, terms);
    if (dealMonth != null && dealMonth >= term) return legacy.getFinalPayment(avgDebt, terms);
    return legacy.getScheduledPayment(avgDebt, terms);
  },
  revenueForDealMonth(avgDebt: number, dealMonth: number, terms: LegacyTerms): number {
    const term = legacy.getMaxTerm(avgDebt, terms);
    if (dealMonth > term || dealMonth < 1) return 0;
    const payment = legacy.getMonthlyPayment(avgDebt, terms, dealMonth);
    return dealMonth <= 2
      ? toCents(payment - terms.draftFee)
      : toCents((payment - terms.adminMonthlyFee) * terms.tier1Rate);
  },
  agentCommission(avgDebt: number, terms: LegacyTerms): number {
    const band = findBand(terms.bands, avgDebt);
    return band ? Math.round(band.total * (terms.feeRate / 0.4)) : 0;
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
    return `Monthly perpetuity for the life of the program (${p?.term ?? '?'} months). Funding Tier keeps ${(t.frontCaptureRate * 100).toFixed(0)}% of each $${p?.payment ?? '?'} payment less the $${t.servicingDeductionPerPayment} servicing deduction for the first ${t.frontMonths} months, then ${(t.backendCaptureRate * 100).toFixed(0)}%.`;
  }
  const t = inputs.legacy;
  const term = legacy.getMaxTerm(avgDebt, t);
  const pay = legacy.getMonthlyPayment(avgDebt, t);
  return `Monthly perpetuity across a ${term}-month term. Months 1-2 pass through at $${pay.toFixed(0)} less the $${t.draftFee} draft fee; from month 3 Funding Tier keeps ${(t.tier1Rate * 100).toFixed(0)}% of the payment after the $${t.adminMonthlyFee} admin fee.`;
}

export function isPerpetuity(key: BackendKey): boolean {
  return key !== 'LEVEL';
}
