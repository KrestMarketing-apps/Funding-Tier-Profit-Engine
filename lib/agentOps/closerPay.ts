// ─────────────────────────────────────────────────────────────────────────────
// Closer pay — when a US-based, fully commissioned closer is owed money on a
// deal, how much, on which pay date, and whether it can still be taken back.
//
// The rules, in the order they are applied:
//
//   1. A commission is owed only when BOTH are true:
//        · the client's first PROGRAM payment has cleared, and
//        · the backend has paid Funding Tier on that file.
//      Until then the deal shows a projected pay date, never a promise.
//
//   2. A program payment is one MONTH of the client's plan. On a split or
//      bi-weekly plan that month is two drafts, and it only counts once both
//      have cleared — two drafts are never two program payments. If the plan
//      type cannot be established, the deal is HELD rather than guessed: paying
//      a split-pay file on its first half-draft is exactly the early payout this
//      exists to prevent. (Same asymmetry, and same NSF handling, as the bonus
//      vesting engine — its schedule reader is reused here, not re-implemented.)
//
//   3. Pay dates follow the backend payout timing on
//      ai.fundingtier.com/admins/backend-payout-timing:
//        Level Debt   first payment clears 1st–15th  → FT paid ~25th → closer paid the 1st of next month
//                     first payment clears 16th–EOM  → FT paid ~10th next month → closer paid the 15th of next month
//        Shield       payment clears in month M      → FT paid by the 15th of M+1 → closer paid the 20th of M+1
//        Legacy/ELP   weekly cleared cohorts          → FT paid ~12–19 days later → closer paid the 20th of the following month
//      If the backend actually pays Funding Tier later than that, the closer is
//      paid on the backend's next pay day at least BUFFER_DAYS after the money
//      landed — never before Funding Tier has it.
//
//   4. Chargeback exposure:
//        Level Debt   clawed back in full if the 2nd program payment does not clear
//        Shield, ELP  free of chargeback once the 1st program payment clears
//      A paid Level deal is "at risk" until its 2nd program payment clears;
//      if it cancels first, the commission becomes a clawback.
//
//   5. A closer who leaves:
//        for cause (deserted, quit without notice, harmed the company)
//            → nothing unpaid at the separation date is paid.
//        performance (missed goals/KPIs)
//            → still paid the FIRST payout on each deal they closed; a later
//              installment of a split commission is not paid.
//
// Everything a closer sees comes with a one-line reason, so "why haven't I been
// paid on this deal" is answerable without asking anyone.
// ─────────────────────────────────────────────────────────────────────────────

import { resolveSchedule, type DealPayment, type PaymentSchedule } from './vesting';
import type { BackendKey } from './types';

export type PayBackend = Exclude<BackendKey, 'UNKNOWN'>;

/** One payout of a commission. Most deals have one; a split commission has two. */
export interface PayMilestone {
  /** Program payments that must clear before this installment is owed. */
  afterProgramPayments: number;
  /** Share of the deal's commission paid at this milestone (all shares sum to 1). */
  share: number;
}

export interface BackendPayRule {
  label: string;
  milestones: PayMilestone[];
  /** Program payments after which nothing can be clawed back. */
  chargebackFreeAfter: number;
  /** Days of the month this backend's closers are paid on. */
  payDays: number[];
  /** Expected date Funding Tier is paid, from the date the milestone payment cleared. */
  expectedBackendPaid: (clearedAt: Date) => Date;
  /** Scheduled closer pay date, from the date the milestone payment cleared. */
  scheduledPayDate: (clearedAt: Date) => Date;
  /** Plain-language timing, shown to closers. */
  timing: string;
}

// ── Calendar helpers (UTC dates, no time of day) ────────────────────────────

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const dayOf = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const t = Date.parse(s.length === 10 ? `${s}T00:00:00Z` : s);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return utc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};
export const iso = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/** First date on or after `from` whose day-of-month is in `days`. */
export function nextPayDay(from: Date, days: number[]): Date {
  const sorted = [...days].sort((a, b) => a - b);
  for (let i = 0; i < 3; i += 1) {
    const y = from.getUTCFullYear();
    const m = from.getUTCMonth() + i;
    for (const d of sorted) {
      const candidate = utc(y, m, d);
      if (candidate >= from) return candidate;
    }
  }
  return utc(from.getUTCFullYear(), from.getUTCMonth() + 3, sorted[0]);
}

/** Days after Funding Tier receives the money before a closer can be paid from it. */
export const BUFFER_DAYS = Number(process.env.AO_PAY_BUFFER_DAYS || 5);

export const PAY_RULES: Record<PayBackend, BackendPayRule> = {
  LEVEL: {
    label: 'Level Debt',
    milestones: [{ afterProgramPayments: 1, share: 1 }],
    chargebackFreeAfter: 2,
    payDays: [1, 15],
    expectedBackendPaid: (c) => (c.getUTCDate() <= 15
      ? utc(c.getUTCFullYear(), c.getUTCMonth(), 25)
      : utc(c.getUTCFullYear(), c.getUTCMonth() + 1, 10)),
    scheduledPayDate: (c) => (c.getUTCDate() <= 15
      ? utc(c.getUTCFullYear(), c.getUTCMonth() + 1, 1)
      : utc(c.getUTCFullYear(), c.getUTCMonth() + 1, 15)),
    timing: 'First payment clears 1st–15th → paid the 1st of next month. Clears 16th–end of month → paid the 15th of next month.',
  },
  CS: {
    label: 'Shield Services',
    milestones: [{ afterProgramPayments: 1, share: 1 }],
    chargebackFreeAfter: 1,
    payDays: [20],
    expectedBackendPaid: (c) => utc(c.getUTCFullYear(), c.getUTCMonth() + 1, 15),
    scheduledPayDate: (c) => utc(c.getUTCFullYear(), c.getUTCMonth() + 1, 20),
    timing: 'First payment clears any day of the month → paid the 20th of the following month.',
  },
  LEGACY: {
    label: 'Elite Legal Practice',
    milestones: [{ afterProgramPayments: 1, share: 1 }],
    chargebackFreeAfter: 1,
    payDays: [20],
    expectedBackendPaid: (c) => addDays(c, 19),
    scheduledPayDate: (c) => utc(c.getUTCFullYear(), c.getUTCMonth() + 1, 20),
    timing: 'First payment clears (weekly cohorts) → paid the 20th of the following month.',
  },
};

// ── Inputs ──────────────────────────────────────────────────────────────────

export type SeparationType = 'for_cause' | 'performance';

export interface CloserPayInput {
  dealId: string;
  backend: BackendKey;
  /** Total commission on the deal, before any split into milestones. */
  commission: number;
  /** Draft history for the matched backend file, any order. */
  drafts: DealPayment[];
  /** Plan type the backend or GHL states, if any. */
  declaredSchedule?: PaymentSchedule | null;
  /** When the backend reported the file cancelled, if it has. */
  cancelledAt?: string | null;
  /** When the backend paid Funding Tier on this file, if confirmed. */
  backendPaidAt?: string | null;
  /** Closer's separation, if they have left. */
  separation?: { at: string; type: SeparationType } | null;
  /** Commission already paid to the closer on this deal (sum of ledger payments). */
  paidAmount?: number;
  /** Clawback already recovered on this deal (positive number). */
  recoveredAmount?: number;
  /** "Today" — injectable for tests and for projecting forward. */
  asOf?: string;
}

export type CloserPayState =
  | 'held'                    // plan type cannot be established — nothing counted
  | 'awaiting_first_payment'  // deal alive, first program payment not complete
  | 'awaiting_backend'        // first payment cleared, Funding Tier not yet paid
  | 'scheduled'               // owed, pay date in the future
  | 'due'                     // owed, pay date today or past — pay it
  | 'paid_at_risk'            // paid; Level deal still inside its chargeback window
  | 'paid'                    // paid and past any chargeback exposure
  | 'clawback'                // paid, then cancelled inside the window — money owed back
  | 'cancelled'               // cancelled before anything was owed
  | 'forfeited';              // closer left for cause before it was paid

export interface Installment {
  index: number;
  afterProgramPayments: number;
  amount: number;
  /** When the milestone payment cleared, if it has. */
  clearedAt: string | null;
  expectedBackendPaidAt: string | null;
  payDate: string | null;
  /** Whether this installment is owed at all (false if forfeited or not reached). */
  earned: boolean;
}

export interface CloserPayVerdict {
  state: CloserPayState;
  schedule: PaymentSchedule;
  programPaymentsCleared: number;
  draftsCleared: number;
  commission: number;
  owedAmount: number;
  paidAmount: number;
  /** Positive = owed back by the closer. */
  clawbackAmount: number;
  nextPayDate: string | null;
  chargebackFreeAt: string | null;
  installments: Installment[];
  reason: string;
}

// ── Program payments: the heart of "never double count a split month" ────────

/**
 * Turn draft rows into completed PROGRAM payments (dates they completed).
 *
 * Standard plan: one cleared draft = one program payment.
 * Split / bi-weekly: two cleared drafts = one program payment, completed on the
 * date the second of the pair cleared. An odd trailing draft is half a month
 * and does not count. NSF re-drafts that cured are already folded by the
 * schedule reader, and a cleared draft is only ever counted once.
 */
export function programPayments(drafts: DealPayment[], schedule: PaymentSchedule): Date[] {
  const cleared = drafts
    .filter((d) => d.status === 'cleared')
    .map((d) => dayOf(d.clearedAt) ?? dayOf(d.dueAt))
    .filter((d): d is Date => d != null)
    .sort((a, b) => a.getTime() - b.getTime());
  if (schedule === 'split') {
    const out: Date[] = [];
    for (let i = 1; i < cleared.length; i += 2) out.push(cleared[i]);
    return out;
  }
  return cleared;
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDay = (s: string | null) => (s ? new Date(`${s}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '—');

export function evaluateCloserPay(input: CloserPayInput): CloserPayVerdict {
  const asOf = dayOf(input.asOf ?? new Date().toISOString()) as Date;
  const paidAmount = round(input.paidAmount ?? 0);
  const recovered = round(input.recoveredAmount ?? 0);
  const draftsCleared = input.drafts.filter((d) => d.status === 'cleared').length;
  const base = {
    commission: round(input.commission), paidAmount, draftsCleared,
    installments: [] as Installment[], nextPayDate: null as string | null, chargebackFreeAt: null as string | null,
  };

  if (input.backend === 'UNKNOWN') {
    return { ...base, state: 'held', schedule: 'unknown', programPaymentsCleared: 0, owedAmount: 0, clawbackAmount: 0,
      reason: 'No backend on this deal yet, so there is no pay rule to apply. Set the backend on the opportunity.' };
  }
  const rule = PAY_RULES[input.backend];

  // Plan type. A single cleared draft on an unknown plan might be half of a
  // split month — do not count it until the plan type is known.
  const sv = resolveSchedule(input.drafts, input.declaredSchedule ?? null);
  const schedule = sv.schedule;
  const cancelledAt = dayOf(input.cancelledAt);
  const separation = input.separation ? { at: dayOf(input.separation.at) as Date, type: input.separation.type } : null;

  if (schedule === 'unknown' || sv.conflict) {
    // Held — but a deal paid already still has to show what it is owed back.
    const reason = sv.conflict
      ? `Held: ${sv.basis}`
      : draftsCleared === 0
        ? 'Waiting on the first program payment.'
        : `Held: ${draftsCleared} draft${draftsCleared === 1 ? '' : 's'} cleared, but the plan type (monthly or split/bi-weekly) is not confirmed, so it is not yet known whether a full program payment is complete.`;
    return { ...base, state: draftsCleared === 0 && !sv.conflict ? 'awaiting_first_payment' : 'held', schedule,
      programPaymentsCleared: 0, owedAmount: 0, clawbackAmount: 0, reason };
  }

  const payments = programPayments(input.drafts, schedule);
  const completed = payments.length;
  const backendPaid = dayOf(input.backendPaidAt);
  const freeDate = payments[rule.chargebackFreeAfter - 1] ?? null;
  const cancelledInWindow = cancelledAt != null && (freeDate == null || cancelledAt < freeDate);

  // Build installments.
  const installments: Installment[] = rule.milestones.map((m, index) => {
    const clearedAt = payments[m.afterProgramPayments - 1] ?? null;
    const amount = round(input.commission * m.share);
    let payDate: Date | null = null;
    let expectedBackend: Date | null = null;
    if (clearedAt) {
      expectedBackend = rule.expectedBackendPaid(clearedAt);
      payDate = rule.scheduledPayDate(clearedAt);
      // Only milestone 1 is gated on the backend's payout for the file; later
      // installments follow their own clearing date.
      if (index === 0 && backendPaid) {
        const earliest = nextPayDay(addDays(backendPaid, BUFFER_DAYS), rule.payDays);
        if (earliest > payDate) payDate = earliest;
      }
    }
    // Separation rules.
    let earned = clearedAt != null && !(cancelledAt && clearedAt && cancelledAt < clearedAt);
    if (separation) {
      if (separation.type === 'for_cause') {
        // Nothing unpaid at the separation date is paid — judged below against
        // what was actually paid; any installment not already paid is forfeit.
        earned = earned && payDate != null && payDate <= separation.at;
      } else if (index > 0) {
        earned = false;                 // performance: first payout only
      }
    }
    return {
      index, afterProgramPayments: m.afterProgramPayments, amount,
      clearedAt: iso(clearedAt), expectedBackendPaidAt: iso(expectedBackend), payDate: iso(payDate), earned,
    };
  });

  const first = installments[0];
  const earnedTotal = round(installments.filter((i) => i.earned).reduce((s, i) => s + i.amount, 0));
  const chargebackFreeAt = iso(freeDate);

  // ── Clawback: paid on a Level deal that cancelled before its 2nd payment ──
  if (paidAmount > 0 && cancelledInWindow) {
    const owedBack = round(paidAmount - recovered);
    return {
      ...base, installments, schedule, programPaymentsCleared: completed, chargebackFreeAt,
      state: owedBack > 0 ? 'clawback' : 'cancelled',
      owedAmount: 0, clawbackAmount: Math.max(0, owedBack),
      reason: owedBack > 0
        ? `Cancelled ${fmtDay(iso(cancelledAt))} before program payment ${rule.chargebackFreeAfter} cleared — ${rule.label} claws back the payout, so ${money(owedBack)} comes out of your next commission.`
        : `Cancelled inside the chargeback window; the ${money(paidAmount)} paid has been recovered.`,
    };
  }

  // Not yet owed and cancelled → nothing ever owed.
  if (cancelledAt && completed < first.afterProgramPayments) {
    return { ...base, installments, schedule, programPaymentsCleared: completed, chargebackFreeAt,
      state: 'cancelled', owedAmount: 0, clawbackAmount: 0,
      reason: `Cancelled ${fmtDay(iso(cancelledAt))} before the first program payment cleared — no commission is owed.` };
  }
  // Level: cancelled after payment 1 but before payment 2, and not yet paid —
  // Funding Tier's payout is being clawed back, so nothing is paid.
  if (cancelledInWindow && paidAmount === 0) {
    return { ...base, installments, schedule, programPaymentsCleared: completed, chargebackFreeAt,
      state: 'cancelled', owedAmount: 0, clawbackAmount: 0,
      reason: `Cancelled ${fmtDay(iso(cancelledAt))} before program payment ${rule.chargebackFreeAfter} cleared — ${rule.label} takes its payout back, so no commission is owed.` };
  }

  // ── Separation for cause: anything not already paid is forfeit ──
  if (separation?.type === 'for_cause' && earnedTotal <= paidAmount) {
    return { ...base, installments, schedule, programPaymentsCleared: completed, chargebackFreeAt,
      state: paidAmount > 0 ? (freeDate ? 'paid' : 'paid_at_risk') : 'forfeited', owedAmount: 0, clawbackAmount: 0,
      reason: paidAmount > 0
        ? `Paid ${money(paidAmount)} before separation. Separated for cause ${fmtDay(iso(separation.at))} — nothing further is paid on this deal.`
        : `Separated for cause ${fmtDay(iso(separation.at))} — commission not paid by the separation date is not paid.` };
  }

  // ── Waiting stages ──
  if (completed < first.afterProgramPayments) {
    return { ...base, installments, schedule, programPaymentsCleared: completed, chargebackFreeAt,
      state: 'awaiting_first_payment', owedAmount: 0, clawbackAmount: 0,
      reason: schedule === 'split'
        ? `Split/bi-weekly plan: ${draftsCleared} of 2 drafts for the first month have cleared. Commission is owed once the whole first month clears.`
        : 'Waiting on the client\'s first program payment to clear.' };
  }
  if (!backendPaid && paidAmount === 0) {
    return { ...base, installments, schedule, programPaymentsCleared: completed, chargebackFreeAt,
      state: 'awaiting_backend', owedAmount: 0, clawbackAmount: 0, nextPayDate: first.payDate,
      reason: `First program payment cleared ${fmtDay(first.clearedAt)}. ${rule.label} is expected to pay Funding Tier around ${fmtDay(first.expectedBackendPaidAt)}; once confirmed you are paid ${money(first.amount)} on ${fmtDay(first.payDate)}.` };
  }

  // ── Owed / paid ──
  const owed = round(Math.max(0, earnedTotal - paidAmount));
  const nextUnpaid = (() => {
    let cum = 0;
    for (const i of installments) {
      if (!i.earned) continue;
      cum += i.amount;
      if (cum > paidAmount + 0.004) return i;
    }
    return null;
  })();
  const pending = installments.find((i) => !i.clearedAt && !(separation && i.index > 0));

  if (owed > 0 && nextUnpaid) {
    const pd = dayOf(nextUnpaid.payDate) as Date;
    const due = pd <= asOf;
    return { ...base, installments, schedule, programPaymentsCleared: completed, chargebackFreeAt,
      state: due ? 'due' : 'scheduled', owedAmount: owed, clawbackAmount: 0, nextPayDate: nextUnpaid.payDate,
      reason: due
        ? `Owed ${money(owed)} — pay date ${fmtDay(nextUnpaid.payDate)} has arrived.`
        : `${money(owed)} scheduled for ${fmtDay(nextUnpaid.payDate)}. ${rule.label} paid Funding Tier${backendPaid ? ` on ${fmtDay(iso(backendPaid))}` : ''}.` };
  }

  const atRisk = freeDate == null;
  return { ...base, installments, schedule, programPaymentsCleared: completed, chargebackFreeAt,
    state: atRisk ? 'paid_at_risk' : 'paid', owedAmount: 0, clawbackAmount: 0,
    reason: atRisk
      ? `Paid ${money(paidAmount)}. Final once program payment ${rule.chargebackFreeAfter} clears — if the client cancels before then, ${rule.label} claws it back.`
      : pending
        ? `Paid ${money(paidAmount)} so far; the next installment is owed after program payment ${pending.afterProgramPayments} clears.`
        : `Paid ${money(paidAmount)} in full${chargebackFreeAt ? `; clear of chargeback since ${fmtDay(chargebackFreeAt)}` : ''}.` };
}

function round(n: number): number { return Math.round(n * 100) / 100; }
