// ─────────────────────────────────────────────────────────────────────────────
// Bonus vesting — did this deal stick long enough to earn the rep their money?
//
// The rule is a DRAFT COUNT, not a month count: two cleared drafts on a
// standard schedule, four on a split-payment schedule. A split-pay client can
// therefore vest inside one calendar month, which is intended.
//
// That makes the payment schedule load-bearing, and the risk is asymmetric.
// Read a split file as standard and the rep vests at two drafts when they owed
// four — money out the door that should not have left. Read a standard file as
// split and the rep waits longer than they should, which is visible, arguable
// and fixable. So the schedule is never assumed: it is observed from the actual
// draft cadence, cross-checked against whatever the backend declared, and when
// the two disagree — or there is not yet enough history to tell — the deal is
// HELD rather than vested. Split pays are rare, which is exactly why a
// "probably standard" default would be wrong in the cases that matter.
// ─────────────────────────────────────────────────────────────────────────────

export type ProgramType = 'settlement' | 'resolution' | 'validation';
export type PaymentSchedule = 'standard' | 'split' | 'unknown';
export type PaymentStatus = 'scheduled' | 'cleared' | 'nsf' | 'returned' | 'skipped' | 'cancelled';

export interface DealPayment {
  /** 1-based, in date order. Renumbered on import so gaps never shift the gate. */
  paymentNumber: number;
  dueAt: string | null;
  clearedAt: string | null;
  amount: number | null;
  status: PaymentStatus;
  source: 'backend_report' | 'inferred' | 'manual';
}

/**
 * Drafts required to vest, by schedule. Held per program so a future decision
 * to make settlement differ from resolution/validation is a config change and
 * not a code change — today all three are the same rule.
 */
export interface VestingRule { standard: number; split: number }

export const DEFAULT_VESTING: Record<ProgramType, VestingRule> = {
  settlement: { standard: 2, split: 4 },
  resolution: { standard: 2, split: 4 },
  validation: { standard: 2, split: 4 },
};

export type VestingState =
  | 'pending'    // still accruing drafts, deal alive, gate not yet reached
  | 'vested'     // gate cleared — the bonus is earned
  | 'forfeited'  // cancelled before the gate — no bonus is honoured
  | 'held';      // schedule cannot be trusted yet — pay nothing until resolved

export interface ScheduleVerdict {
  schedule: PaymentSchedule;
  /** How it was established, in plain words, for the rep-facing ledger. */
  basis: string;
  /** Backend/GHL said one thing, the draft dates say another. */
  conflict: boolean;
  declared: PaymentSchedule | null;
  observed: PaymentSchedule | null;
}

export interface VestingVerdict {
  state: VestingState;
  schedule: PaymentSchedule;
  draftsRequired: number | null;
  draftsCleared: number;
  nsfCount: number;
  /** Drafts still needed. Null when the schedule is unresolved. */
  remaining: number | null;
  cancelledAt: string | null;
  reason: string;
  scheduleVerdict: ScheduleVerdict;
}

const asTime = (s: string | null | undefined): number | null => {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
};

const DAY = 86_400_000;

/**
 * Days within which a cleared draft following an NSF is read as a re-draft of
 * that same billing cycle rather than the start of a new one. A backend that
 * re-presents a returned payment does it inside the month; a genuine next
 * cycle does not arrive that fast on a standard plan.
 */
const CURE_WINDOW_DAYS = 21;

/**
 * Collapse NSF cures into the cycle they repair.
 *
 * Without this, a bounced payment and its successful re-draft land as two dated
 * rows in one month, and the cadence below reads that as a split schedule. On a
 * standard file that is badly wrong in the expensive direction: the deal gets
 * flagged as a schedule conflict and the rep's money is held over what was only
 * a bounced payment. NSFs are common; split pays are not. So a cleared draft
 * arriving within the cure window after an NSF replaces that NSF in the cycle
 * list instead of adding to it.
 */
function billingCycleDates(payments: DealPayment[]): number[] {
  const rows = payments
    .map((p) => ({ at: asTime(p.clearedAt) ?? asTime(p.dueAt), status: p.status }))
    .filter((r): r is { at: number; status: PaymentStatus } => r.at != null)
    .sort((a, b) => a.at - b.at);

  const cycles: number[] = [];
  let lastFailedAt: number | null = null;

  for (const row of rows) {
    if (row.status === 'nsf' || row.status === 'returned') {
      // The failed attempt opens a cycle; a cure may replace it below.
      cycles.push(row.at);
      lastFailedAt = row.at;
      continue;
    }
    if (
      row.status === 'cleared' &&
      lastFailedAt != null &&
      row.at - lastFailedAt <= CURE_WINDOW_DAYS * DAY
    ) {
      cycles[cycles.length - 1] = row.at;  // same cycle, finally paid
      lastFailedAt = null;
      continue;
    }
    cycles.push(row.at);
    lastFailedAt = null;
  }
  return cycles;
}

/**
 * Observe the schedule from the gaps between billing cycles.
 *
 * A standard program drafts about once a month. A split schedule drafts twice,
 * roughly a fortnight apart, so its gaps cluster well under a month. Two cycles
 * landing in the same calendar month is the clearest signal there is; short
 * median spacing is the fallback when a split straddles a month boundary.
 *
 * Needs at least two dated cycles. One tells you nothing about cadence, and
 * guessing from one is precisely the overpayment this function exists to
 * prevent.
 */
export function observeSchedule(payments: DealPayment[]): PaymentSchedule {
  const dates = billingCycleDates(payments);

  if (dates.length < 2) return 'unknown';

  const monthKeys = dates.map((t) => {
    const d = new Date(t);
    return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
  });
  const perMonth: Record<string, number> = {};
  monthKeys.forEach((k) => { perMonth[k] = (perMonth[k] ?? 0) + 1; });
  if (Object.values(perMonth).some((n) => n >= 2)) return 'split';

  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i += 1) gaps.push(dates[i] - dates[i - 1]);
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];

  // ~2 weeks apart is a split cadence; ~a month apart is standard. The 20-day
  // line sits in the empty space between the two, not near either.
  if (median <= 20 * DAY) return 'split';
  return 'standard';
}

export function resolveSchedule(
  payments: DealPayment[],
  declared: PaymentSchedule | null,
): ScheduleVerdict {
  const observed = observeSchedule(payments);
  const declaredKnown = declared && declared !== 'unknown' ? declared : null;

  if (observed === 'unknown') {
    // Nothing to check the declaration against yet. A declaration alone is
    // enough to proceed only because the gate still needs drafts to arrive,
    // and those drafts will produce an observation before the gate is reached.
    if (declaredKnown) {
      return {
        schedule: declaredKnown,
        basis: `Declared ${declaredKnown} by the backend; too few drafts so far to confirm from cadence.`,
        conflict: false,
        declared: declaredKnown,
        observed: null,
      };
    }
    return {
      schedule: 'unknown',
      basis: 'Fewer than two dated drafts on file — the payment cadence cannot be read yet.',
      conflict: false,
      declared: null,
      observed: null,
    };
  }

  if (declaredKnown && declaredKnown !== observed) {
    // Trust neither. The draft dates are evidence and the declaration is a
    // claim, but a mismatch usually means the file was set up one way and
    // billed another — which is a question for a human, not a default.
    return {
      schedule: 'unknown',
      basis: `Backend declared ${declaredKnown}, but the draft dates read as ${observed}. Held for review rather than guessed.`,
      conflict: true,
      declared: declaredKnown,
      observed,
    };
  }

  return {
    schedule: observed,
    basis: declaredKnown
      ? `Declared ${declaredKnown} and confirmed by the draft cadence.`
      : `Read as ${observed} from the spacing of the drafts on file.`,
    conflict: false,
    declared: declaredKnown,
    observed,
  };
}

export interface VestingInput {
  program: ProgramType;
  payments: DealPayment[];
  /** What the backend or GHL says the schedule is, if anything. */
  declaredSchedule?: PaymentSchedule | null;
  /** Set when the backend reports the file cancelled. */
  cancelledAt?: string | null;
  rules?: Record<ProgramType, VestingRule>;
}

export function evaluateVesting(input: VestingInput): VestingVerdict {
  const rules = input.rules ?? DEFAULT_VESTING;
  const payments = [...input.payments].sort((a, b) => a.paymentNumber - b.paymentNumber);
  const scheduleVerdict = resolveSchedule(payments, input.declaredSchedule ?? null);

  const cleared = payments.filter((p) => p.status === 'cleared');
  // An NSF that is later re-drafted and clears shows up as a separate cleared
  // row, so counting cleared rows handles the cure without special-casing it.
  const nsfCount = payments.filter((p) => p.status === 'nsf' || p.status === 'returned').length;
  const draftsCleared = cleared.length;
  const cancelledAt = input.cancelledAt ?? null;

  const base = {
    schedule: scheduleVerdict.schedule,
    draftsCleared,
    nsfCount,
    cancelledAt,
    scheduleVerdict,
  };

  if (scheduleVerdict.schedule === 'unknown') {
    // The one case where a cancelled deal is not immediately forfeited: if it
    // already cleared enough drafts to vest under EITHER reading, the schedule
    // no longer matters and holding the money would just be wrong.
    const rule = rules[input.program];
    const worstCase = Math.max(rule.standard, rule.split);
    if (draftsCleared >= worstCase) {
      return {
        ...base,
        state: 'vested',
        schedule: 'unknown',
        draftsRequired: worstCase,
        remaining: 0,
        reason: `${draftsCleared} cleared drafts clears the gate on either schedule (${rule.standard} standard, ${rule.split} split), so the unresolved schedule no longer affects the outcome.`,
      };
    }
    return {
      ...base,
      state: 'held',
      draftsRequired: null,
      remaining: null,
      reason: `${scheduleVerdict.basis} Nothing is paid on this file until the schedule is confirmed — vesting needs ${rule.standard} drafts on a standard plan and ${rule.split} on a split plan, and ${draftsCleared} cleared so far cannot settle it either way.`,
    };
  }

  const rule = rules[input.program];
  const required = scheduleVerdict.schedule === 'split' ? rule.split : rule.standard;
  const remaining = Math.max(0, required - draftsCleared);

  if (draftsCleared >= required) {
    return {
      ...base,
      state: 'vested',
      draftsRequired: required,
      remaining: 0,
      reason: `${draftsCleared} of ${required} required drafts cleared on a ${scheduleVerdict.schedule} schedule — bonus earned.${cancelledAt ? ' The later cancellation does not undo it.' : ''}`,
    };
  }

  if (cancelledAt) {
    return {
      ...base,
      state: 'forfeited',
      draftsRequired: required,
      remaining,
      reason: `Cancelled after ${draftsCleared} of the ${required} drafts required on a ${scheduleVerdict.schedule} schedule — no bonus is honoured.${nsfCount > 0 ? ` ${nsfCount} draft${nsfCount === 1 ? '' : 's'} returned NSF along the way.` : ''} The rep's close rate is unaffected.`,
    };
  }

  return {
    ...base,
    state: 'pending',
    draftsRequired: required,
    remaining,
    reason: `${draftsCleared} of ${required} drafts cleared on a ${scheduleVerdict.schedule} schedule — ${remaining} more to vest.${nsfCount > 0 ? ` ${nsfCount} returned NSF so far.` : ''}`,
  };
}
