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
  monthlyPayment: number;
  /** True when the derived deposit falls under Level Debt's $250 minimum. */
  belowMinimum: boolean;
};

export function ldProgram(debt: number, attorneyModel = false): LdProgram {
  const eligible = debt >= LD_MIN_DEBT;
  if (!eligible) {
    return {
      eligible: false, term: 0, feeRate: ldProgramFeeRate(attorneyModel),
      estimatedSettlement: 0, programFees: 0, totalProgramCost: 0,
      monthlyPayment: 0, belowMinimum: false,
    };
  }
  const term = ldTerm(debt);
  const feeRate = ldProgramFeeRate(attorneyModel);
  const estimatedSettlement = round2(debt * LD_ESTIMATED_SETTLEMENT_RATE);
  const programFees = round2(debt * feeRate);
  const totalProgramCost = round2(estimatedSettlement + programFees);
  const monthlyPayment = round2(totalProgramCost / term);
  return {
    eligible: true, term, feeRate, estimatedSettlement, programFees,
    totalProgramCost, monthlyPayment,
    belowMinimum: monthlyPayment < LD_MIN_DEPOSIT,
  };
}
