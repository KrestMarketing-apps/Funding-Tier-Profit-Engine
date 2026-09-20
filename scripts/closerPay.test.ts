/* Closer pay rules — run with: npx tsx scripts/closerPay.test.ts
 * Weighted toward paying early: a split/bi-weekly month counted as two
 * program payments, a closer paid before Funding Tier has the money, and a
 * Level deal paid then cancelled without the clawback showing.
 */
import { evaluateCloserPay, programPayments, type CloserPayInput } from '../lib/agentOps/closerPay';
import type { DealPayment, PaymentStatus } from '../lib/agentOps/vesting';

let failures = 0;
function check(name: string, pass: boolean, detail = '') {
  if (!pass) failures += 1;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

let n = 0;
const d = (date: string, status: PaymentStatus = 'cleared'): DealPayment => ({
  paymentNumber: ++n, dueAt: date, clearedAt: status === 'cleared' ? date : null, amount: 250, status, source: 'backend_report',
});
const run = (o: Partial<CloserPayInput>) => evaluateCloserPay({
  dealId: 'x', backend: 'CS', commission: 350, drafts: [], declaredSchedule: 'standard', asOf: '2026-09-19', ...o,
});

console.log('\n=== Never double count a split / bi-weekly month ===');
{
  const split = [d('2026-01-05'), d('2026-01-19'), d('2026-02-02'), d('2026-02-16')];
  check('4 split drafts = 2 program payments', programPayments(split, 'split').length === 2);
  check('4 monthly drafts = 4 program payments', programPayments(split, 'standard').length === 4);
  check('3 split drafts = 1 program payment (half a month does not count)',
    programPayments(split.slice(0, 3), 'split').length === 1);
}
{
  const v = run({ declaredSchedule: 'split', drafts: [d('2026-06-05')], backendPaidAt: '2026-07-10' });
  check('split plan, first half-draft cleared → not owed yet', v.state === 'awaiting_first_payment', v.reason);
}
{
  const v = run({ declaredSchedule: 'split', drafts: [d('2026-06-05'), d('2026-06-19')], backendPaidAt: '2026-07-14' });
  check('split plan, both June drafts cleared → one program payment, owed',
    v.programPaymentsCleared === 1 && v.state === 'due', `${v.state} ${v.programPaymentsCleared}`);
}
{
  const v = run({ backend: 'LEVEL', commission: 400, declaredSchedule: 'split',
    drafts: [d('2026-06-05'), d('2026-06-19')], backendPaidAt: '2026-06-25', paidAmount: 400 });
  check('Level split: 2 drafts in month 1 is NOT the 2nd program payment → still at risk',
    v.state === 'paid_at_risk', `${v.state} — ${v.reason}`);
}
{
  const v = run({ declaredSchedule: null, drafts: [d('2026-06-05')], backendPaidAt: '2026-07-14' });
  check('unknown plan with one draft → held, not paid', v.state === 'held', v.reason);
}
{
  const v = run({ declaredSchedule: 'split', drafts: [d('2026-06-05'), d('2026-07-05'), d('2026-08-05')], backendPaidAt: '2026-07-14' });
  check('declared split but monthly cadence → held for review', v.state === 'held', v.reason);
}
{
  n = 0;
  const v = run({ declaredSchedule: 'standard', drafts: [d('2026-06-05', 'nsf'), d('2026-06-12'), d('2026-07-05')], backendPaidAt: '2026-07-14' });
  check('an NSF and its re-draft in one month do not make it a split plan', v.state !== 'held', `${v.state} ${v.schedule}`);
}

console.log('\n=== Owed only when the payment cleared AND Funding Tier was paid ===');
{
  const v = run({ drafts: [d('2026-08-12')] });
  check('cleared, backend not yet paid → awaiting backend with a projected date',
    v.state === 'awaiting_backend' && v.nextPayDate === '2026-09-20', `${v.state} ${v.nextPayDate}`);
}
{
  const v = run({ drafts: [d('2026-08-12')], backendPaidAt: '2026-09-15' });
  check('Shield: clears Aug 12, FT paid Sep 15 → closer paid Sep 20 (scheduled, as of Sep 19)', v.nextPayDate === '2026-09-20' && v.state === 'scheduled', `${v.state} ${v.nextPayDate}`);
}
{
  const v = run({ drafts: [d('2026-08-12')], backendPaidAt: '2026-09-18' });
  check('Shield paid late (Sep 18) → pushed to next pay day after the 5-day buffer (Oct 20)',
    v.nextPayDate === '2026-10-20' && v.state === 'scheduled', `${v.state} ${v.nextPayDate}`);
}
{
  const a = run({ backend: 'LEVEL', commission: 400, drafts: [d('2026-01-08')], backendPaidAt: '2026-01-25', asOf: '2026-01-26' });
  const b = run({ backend: 'LEVEL', commission: 400, drafts: [d('2026-01-22')], backendPaidAt: '2026-02-10', asOf: '2026-02-11' });
  check('Level: clears Jan 8 → paid Feb 1 (scenario A)', a.nextPayDate === '2026-02-01', String(a.nextPayDate));
  check('Level: clears Jan 22 → paid Feb 15 (scenario B)', b.nextPayDate === '2026-02-15', String(b.nextPayDate));
}
{
  const v = run({ backend: 'LEGACY', commission: 300, drafts: [d('2026-01-07')], backendPaidAt: '2026-01-21', asOf: '2026-01-22' });
  check('ELP: Jan 5–9 cohort, FT paid Jan 21 → closer paid Feb 20', v.nextPayDate === '2026-02-20', String(v.nextPayDate));
}

console.log('\n=== Chargebacks ===');
{
  const v = run({ backend: 'LEVEL', commission: 400, drafts: [d('2026-06-05'), d('2026-07-05', 'nsf')],
    cancelledAt: '2026-07-20', backendPaidAt: '2026-06-25', paidAmount: 400 });
  check('Level paid, cancels before payment 2 → clawback of the full amount',
    v.state === 'clawback' && v.clawbackAmount === 400, `${v.state} ${v.clawbackAmount}`);
}
{
  const v = run({ backend: 'LEVEL', commission: 400, drafts: [d('2026-06-05'), d('2026-07-05', 'nsf')],
    cancelledAt: '2026-07-20', backendPaidAt: '2026-06-25', paidAmount: 400, recoveredAmount: 400 });
  check('…and once recovered it is closed out', v.state === 'cancelled' && v.clawbackAmount === 0, v.state);
}
{
  const v = run({ backend: 'LEVEL', commission: 400, drafts: [d('2026-06-05'), d('2026-07-05')],
    cancelledAt: '2026-08-20', backendPaidAt: '2026-06-25', paidAmount: 400 });
  check('Level cancels AFTER payment 2 → paid stands', v.state === 'paid' && v.chargebackFreeAt === '2026-07-05', v.state);
}
{
  const v = run({ backend: 'LEVEL', commission: 400, drafts: [d('2026-06-05')], cancelledAt: '2026-06-28', backendPaidAt: '2026-06-25' });
  check('Level cancels between payments 1 and 2, not yet paid → nothing owed', v.state === 'cancelled' && v.owedAmount === 0, v.state);
}
{
  const v = run({ drafts: [d('2026-06-05')], cancelledAt: '2026-07-01', backendPaidAt: '2026-07-15', paidAmount: 350 });
  check('Shield cancels after payment 1 → no clawback', v.state === 'paid', v.state);
}
{
  const v = run({ drafts: [], cancelledAt: '2026-06-01' });
  check('cancelled before any payment → nothing owed', v.state === 'cancelled');
}

console.log('\n=== Closers who leave ===');
{
  const v = run({ drafts: [d('2026-08-12')], backendPaidAt: '2026-09-15', separation: { at: '2026-09-01', type: 'for_cause' } });
  check('for cause before the pay date → forfeited', v.state === 'forfeited' && v.owedAmount === 0, v.state);
}
{
  const v = run({ drafts: [d('2026-06-12')], backendPaidAt: '2026-07-15', paidAmount: 350, separation: { at: '2026-09-01', type: 'for_cause' } });
  check('for cause after being paid → the payment stands', v.state === 'paid', v.state);
}
{
  const v = run({ drafts: [d('2026-08-12')], backendPaidAt: '2026-09-15', separation: { at: '2026-09-01', type: 'performance' } });
  check('performance separation → first payout still paid', v.state === 'scheduled' && v.owedAmount === 350, `${v.state} ${v.owedAmount}`);
}

console.log('\n=== Commission amounts match the published agent page ===');
{
  const { commissionFor } = require('../lib/agentOps/closerPayJob');
  check('Level $25,000 at Tier 1 = $250', commissionFor('LEVEL', 25000, 400000).amount === 250);
  check('Level $25,000 at Tier 2 ($1M+) = $287.50', commissionFor('LEVEL', 25000, 1200000).amount === 287.5);
  check('Level $25,000 at Tier 3 ($2M+) = $325', commissionFor('LEVEL', 25000, 2500000).amount === 325);
  check('Shield $20,000 = Program F $350', commissionFor('CS', 20000, 0).amount === 350);
  check('ELP $22,000 = Band L4 $350', commissionFor('LEGACY', 22000, 0).amount === 350);
}

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
