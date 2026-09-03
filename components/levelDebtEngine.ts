// ═══════════════════════════════════════════════════════════════════
// LEVEL DEBT — CLIENT PROGRAM MATH
//
// Mirrors the Router's src/config/backends/levelDebt/revenue.js. Funding
// Tier's own revenue is a flat 8% of enrolled debt and has nothing to do with
// any of this — these are the CLIENT-facing numbers, needed so the three
// backends can be compared on the one figure a client actually feels: what
// leaves their account every month.
//
//   estimated settlement = enrolled debt x 50%
//   program fees         = enrolled debt x fee rate
//   monthly deposit      = (settlement + fees) / term
//
// The term is banded by enrolled debt rather than chosen.
// ═══════════════════════════════════════════════════════════════════

export const LD_MIN_DEBT = 7000;
export const LD_MIN_DEPOSIT = 250;

/** Share of enrolled debt assumed to be paid out in settlements. */
export const LD_ESTIMATED_SETTLEMENT_RATE = 0.5;

/** Client program fee. Attorney-model states carry the higher rate. */
export const LD_PROGRAM_FEE_STANDARD = 0.25;
export const LD_PROGRAM_FEE_ATTORNEY = 0.27;

// ── Ancillary client fees ───────────────────────────────────────────────────
// These ride on top of the settlement deposit every month. They are what the
// client actually pays and none of them touch Funding Tier's 8%, so they move
// the payment shown on screen and nothing else.
export const LD_LEGAL_FEE_MONTHLY = 19.99;
/** Global Holdings escrow / bank account. */
export const LD_GATEWAY_FEE_MONTHLY = 10.95;
/**
 * Charged once at enrollment. It does NOT make month 1 a bigger draft — the
 * client pays the same amount every month. It comes out of that payment, so
 * month 1 simply puts less into the savings/escrow account.
 */
export const LD_GATEWAY_SETUP_FEE = 10.95;
/** Semi-monthly schedules draft twice; each draft carries this. */
export const LD_SPLIT_SURCHARGE_PER_PAYMENT = 0.515;

/** States where Level Debt runs the attorney model. */
export const LD_ATTORNEY_STATES = [
  "CT", "GA", "LA", "MN", "NV", "NH", "NJ", "ND", "OH", "PA", "TN", "WA", "WY",
];

/** Term bands, by enrolled debt. Larger loads spread further. */
const LD_TERM_BANDS: { max: number; term: number }[] = [
  { max: 10000, term: 24 },
  { max: 12500, term: 30 },
  { max: 15000, term: 36 },
  { max: 25000, term: 42 },
  { max: 35000, term: 48 },
  { max: 50000, term: 54 },
];
export const LD_TERM_MAX = 60;

function round2(v: number) { return Math.round(v * 100) / 100; }

export function ldTerm(debt: number): number {
  const band = LD_TERM_BANDS.find(b => debt < b.max);
  return band ? band.term : LD_TERM_MAX;
}

export function ldProgramFeeRate(attorneyModel: boolean): number {
  return attorneyModel ? LD_PROGRAM_FEE_ATTORNEY : LD_PROGRAM_FEE_STANDARD;
}

export type LdProgram = {
  eligible: boolean;
  term: number;
  feeRate: number;
  estimatedSettlement: number;
  programFees: number;
  totalProgramCost: number;
  /** Settlement deposit alone — what the $250 minimum applies to. */
  monthlyDeposit: number;
  /** Legal + gateway (+ split surcharge) on an ordinary month. */
  ancillaryMonthly: number;
  /**
   * Deposit + ancillary fees: what leaves the client's account. The same
   * figure every month — the gateway setup fee does not change the draft.
   */
  monthlyPayment: number;
  /** Per-draft amount on a semi-monthly schedule; null when drafting monthly. */
  perDraft: number | null;
  splitPayments: boolean;
  /** True when the derived deposit falls under Level Debt's $250 minimum. */
  belowMinimum: boolean;
};

/**
 * Recurring fees taken out of every draft. Constant across the term — the
 * one-time setup fee is handled in the escrow projection, not here, because it
 * changes what lands in savings rather than what the client pays.
 */
export function ldAncillaryFees(split: boolean): number {
  return round2(
    LD_LEGAL_FEE_MONTHLY
    + LD_GATEWAY_FEE_MONTHLY
    + (split ? LD_SPLIT_SURCHARGE_PER_PAYMENT * 2 : 0)
  );
}

export type LdEscrowRow = {
  month: number;
  /** Always the same — the client's draft does not vary. */
  payment: number;
  /** Legal + gateway (+ split), plus the one-time setup fee in month 1. */
  feesTaken: number;
  /** What actually lands in the savings account this month. */
  toEscrow: number;
  cumulative: number;
};

/**
 * Funds accumulating in the client's savings / escrow account, month by month.
 *
 * This is deposits net of the legal and gateway fees only. It does NOT deduct
 * settlement payouts or Level Debt's program fee, both of which draw the
 * balance down as accounts settle — so treat it as the ceiling on what is
 * available to settle with, not a forecast of the balance.
 */
export function ldEscrowProjection(program: LdProgram, months?: number): LdEscrowRow[] {
  if (!program.eligible) return [];
  const n = Math.min(months ?? program.term, program.term);
  const rows: LdEscrowRow[] = [];
  let cumulative = 0;
  for (let month = 1; month <= n; month++) {
    const feesTaken = round2(
      program.ancillaryMonthly + (month === 1 ? LD_GATEWAY_SETUP_FEE : 0)
    );
    const toEscrow = round2(program.monthlyPayment - feesTaken);
    cumulative = round2(cumulative + toEscrow);
    rows.push({ month, payment: program.monthlyPayment, feesTaken, toEscrow, cumulative });
  }
  return rows;
}

/** Usually the earliest point a first settlement can be attempted. */
export const LD_FIRST_SETTLEMENT_MILESTONE_MONTH = 6;

export function ldProgram(debt: number, attorneyModel = false, splitPayments = false): LdProgram {
  const eligible = debt >= LD_MIN_DEBT;
  if (!eligible) {
    return {
      eligible: false, term: 0, feeRate: ldProgramFeeRate(attorneyModel),
      estimatedSettlement: 0, programFees: 0, totalProgramCost: 0,
      monthlyDeposit: 0, ancillaryMonthly: 0, monthlyPayment: 0,
      perDraft: null, splitPayments, belowMinimum: false,
    };
  }
  const term = ldTerm(debt);
  const feeRate = ldProgramFeeRate(attorneyModel);
  const estimatedSettlement = round2(debt * LD_ESTIMATED_SETTLEMENT_RATE);
  const programFees = round2(debt * feeRate);
  const totalProgramCost = round2(estimatedSettlement + programFees);

  const monthlyDeposit   = round2(totalProgramCost / term);
  const ancillaryMonthly = ldAncillaryFees(splitPayments);
  const monthlyPayment   = round2(monthlyDeposit + ancillaryMonthly);

  return {
    eligible: true, term, feeRate, estimatedSettlement, programFees,
    totalProgramCost, monthlyDeposit, ancillaryMonthly, monthlyPayment,
    perDraft: splitPayments ? round2(monthlyPayment / 2) : null,
    splitPayments,
    // The $250 minimum is a floor on the program DEPOSIT, not on the total
    // draft — the legal and gateway fees are not settlement money.
    belowMinimum: monthlyDeposit < LD_MIN_DEPOSIT,
  };
}
