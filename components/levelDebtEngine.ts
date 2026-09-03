// ═══════════════════════════════════════════════════════════════════
// LEVEL DEBT — CLIENT PROGRAM MATH
//
// Reproduces the Forth enrollment schedule exactly. Verified against a live
// Forth plan ($10,000 enrolled, California, 30 months, 25% success fee, 50%
// estimated settlement): total fees $2,839.45, program cost $7,839.45, client
// savings $2,160.55, payment $261.32, month 1 savings $156.09, $167.04 after.
//
//   settlement target = enrolled debt x estimated settlement %
//   success fee       = enrolled debt x success fee %
//   gateway           = monthly fee x term + one-time setup fee
//   total fees        = success fee + gateway (+ legal fee, if the plan has one)
//   program cost      = settlement target + total fees
//   monthly payment   = program cost / term        <- the SAME every month
//
// The setup fee does not make month 1 a larger draft. It is inside the program
// cost, so it is already spread across the term; what it does is take $10.95
// out of month 1's savings contribution. Every other month contributes more.
//
// Funding Tier's own revenue is a flat 8% of enrolled debt and has nothing to
// do with any of this — these are the CLIENT-facing numbers.
// ═══════════════════════════════════════════════════════════════════

export const LD_MIN_DEBT = 7000;
export const LD_MIN_PAYMENT = 250;

/** Success fee. Attorney-model states carry the higher rate. */
export const LD_SUCCESS_FEE_STANDARD = 0.25;
export const LD_SUCCESS_FEE_ATTORNEY = 0.27;

/** States where Level Debt runs the attorney model. */
export const LD_ATTORNEY_STATES = [
  "CT", "GA", "LA", "MN", "NV", "NH", "NJ", "ND", "OH", "PA", "TN", "WA", "WY",
];

/** Share of enrolled debt the plan assumes settlements will cost. */
export const LD_SETTLEMENT_PCT_DEFAULT = 0.5;

/** Global Holdings escrow / bank account. */
export const LD_GATEWAY_FEE_MONTHLY = 10.95;
/** Charged once. Inside the program cost, so it lands on month 1's savings. */
export const LD_GATEWAY_SETUP_FEE = 10.95;
/** Semi-monthly schedules draft twice; each draft carries this. */
export const LD_SPLIT_SURCHARGE_PER_PAYMENT = 0.515;

/**
 * Monthly legal fee. NOT present on the standard Forth debt settlement plan —
 * the live schedule's total fees reconcile exactly without it. Left as an
 * input, defaulting to zero, until it is confirmed which plans carry it.
 */
export const LD_LEGAL_FEE_MONTHLY = 0;

/** Program lengths Forth offers. */
export const LD_TERM_MIN = 12;
export const LD_TERM_MAX = 60;

/** Default term by enrolled debt, when the rep has not chosen one. */
const LD_TERM_BANDS: { max: number; term: number }[] = [
  { max: 10000, term: 24 },
  { max: 12500, term: 30 },
  { max: 15000, term: 36 },
  { max: 25000, term: 42 },
  { max: 35000, term: 48 },
  { max: 50000, term: 54 },
];

/** Usually the earliest point a first settlement can be attempted. */
export const LD_FIRST_SETTLEMENT_MILESTONE_MONTH = 6;

function round2(v: number) { return Math.round(v * 100) / 100; }
function clamp(v: number, lo: number, hi: number) { return Math.min(Math.max(v, lo), hi); }

export function ldDefaultTerm(debt: number): number {
  const band = LD_TERM_BANDS.find(b => debt < b.max);
  return band ? band.term : LD_TERM_MAX;
}

export function ldSuccessFeeRate(attorneyModel: boolean): number {
  return attorneyModel ? LD_SUCCESS_FEE_ATTORNEY : LD_SUCCESS_FEE_STANDARD;
}

export function ldIsAttorneyState(state?: string): boolean {
  return !!state && LD_ATTORNEY_STATES.includes(state.toUpperCase());
}

export type LdTerms = {
  /** Program length in months. Chosen, not derived — Forth offers a dropdown. */
  term?: number;
  attorneyModel?: boolean;
  /** Estimated settlement as a share of enrolled debt. */
  settlementPct?: number;
  splitPayments?: boolean;
  legalFeeMonthly?: number;
};

export type LdProgram = {
  eligible: boolean;
  term: number;
  successFeeRate: number;
  settlementPct: number;
  /** Enrolled debt x estimated settlement % — what the savings must reach. */
  settlementTarget: number;
  successFeeTotal: number;
  successFeeMonthly: number;
  gatewayMonthly: number;
  gatewaySetup: number;
  legalFeeMonthly: number;
  splitSurcharge: number;
  totalFees: number;
  totalProgramCost: number;
  estClientSavings: number;
  /** The same draft every month. */
  monthlyPayment: number;
  perDraft: number | null;
  splitPayments: boolean;
  belowMinimum: boolean;
};

export function ldProgram(debt: number, terms: LdTerms = {}): LdProgram {
  const attorneyModel = !!terms.attorneyModel;
  const successFeeRate = ldSuccessFeeRate(attorneyModel);
  const settlementPct = terms.settlementPct ?? LD_SETTLEMENT_PCT_DEFAULT;
  const splitPayments = !!terms.splitPayments;
  const legalFeeMonthly = terms.legalFeeMonthly ?? LD_LEGAL_FEE_MONTHLY;
  const splitSurcharge = splitPayments ? round2(LD_SPLIT_SURCHARGE_PER_PAYMENT * 2) : 0;
  const term = clamp(Math.round(terms.term ?? ldDefaultTerm(debt)), LD_TERM_MIN, LD_TERM_MAX);

  if (debt < LD_MIN_DEBT) {
    return {
      eligible: false, term: 0, successFeeRate, settlementPct,
      settlementTarget: 0, successFeeTotal: 0, successFeeMonthly: 0,
      gatewayMonthly: LD_GATEWAY_FEE_MONTHLY, gatewaySetup: LD_GATEWAY_SETUP_FEE,
      legalFeeMonthly, splitSurcharge, totalFees: 0, totalProgramCost: 0,
      estClientSavings: 0, monthlyPayment: 0, perDraft: null, splitPayments,
      belowMinimum: false,
    };
  }

  const settlementTarget = round2(debt * settlementPct);
  const successFeeTotal  = round2(debt * successFeeRate);
  const gatewayTotal     = round2(LD_GATEWAY_FEE_MONTHLY * term + LD_GATEWAY_SETUP_FEE);
  const legalTotal       = round2((legalFeeMonthly + splitSurcharge) * term);

  const totalFees        = round2(successFeeTotal + gatewayTotal + legalTotal);
  const totalProgramCost = round2(settlementTarget + totalFees);
  const monthlyPayment   = round2(totalProgramCost / term);
  const successFeeMonthly = round2(successFeeTotal / term);

  return {
    eligible: true, term, successFeeRate, settlementPct,
    settlementTarget, successFeeTotal, successFeeMonthly,
    gatewayMonthly: LD_GATEWAY_FEE_MONTHLY, gatewaySetup: LD_GATEWAY_SETUP_FEE,
    legalFeeMonthly, splitSurcharge,
    totalFees, totalProgramCost,
    estClientSavings: round2(debt - totalProgramCost),
    monthlyPayment,
    perDraft: splitPayments ? round2(monthlyPayment / 2) : null,
    splitPayments,
    belowMinimum: monthlyPayment < LD_MIN_PAYMENT,
  };
}

export type LdScheduleRow = {
  month: number;
  successFee: number;
  gatewaySetup: number;
  gatewayMonthly: number;
  legalFee: number;
  /** What lands in the savings / escrow account this month. */
  savings: number;
  cumulativeSavings: number;
  /** Always the same. */
  totalPayment: number;
};

/**
 * The payment schedule, column for column as Forth renders it. Savings is the
 * remainder after the month's fees, which is why month 1 is lighter by the
 * setup fee while the draft itself never moves.
 */
export function ldSchedule(program: LdProgram, months?: number): LdScheduleRow[] {
  if (!program.eligible) return [];
  const n = Math.min(months ?? program.term, program.term);
  const rows: LdScheduleRow[] = [];
  let cumulativeSavings = 0;
  for (let month = 1; month <= n; month++) {
    const gatewaySetup = month === 1 ? program.gatewaySetup : 0;
    const legalFee = round2(program.legalFeeMonthly + program.splitSurcharge);
    const savings = round2(
      program.monthlyPayment - program.successFeeMonthly
      - program.gatewayMonthly - gatewaySetup - legalFee
    );
    cumulativeSavings = round2(cumulativeSavings + savings);
    rows.push({
      month,
      successFee: program.successFeeMonthly,
      gatewaySetup,
      gatewayMonthly: program.gatewayMonthly,
      legalFee,
      savings,
      cumulativeSavings,
      totalPayment: program.monthlyPayment,
    });
  }
  return rows;
}
