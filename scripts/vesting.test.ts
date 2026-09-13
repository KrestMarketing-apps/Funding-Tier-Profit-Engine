/* Vesting rules — run with: npx tsx scripts/vesting.test.ts
 * Weighted toward the overpayment cases, since paying a rep early on a
 * split-pay file is the failure that costs real money and is hard to unwind.
 */
import {
  evaluateVesting, observeSchedule, type DealPayment, type PaymentStatus,
} from '../lib/agentOps/vesting';

let failures = 0;
function check(name: string, pass: boolean, detail = '') {
  if (!pass) failures += 1;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

let n = 0;
const pay = (date: string, status: PaymentStatus = 'cleared'): DealPayment => ({
  paymentNumber: ++n,
  dueAt: date,
  clearedAt: status === 'cleared' ? date : null,
  amount: 250,
  status,
  source: 'backend_report',
});
const reset = () => { n = 0; };

console.log('\n=== Schedule inference ===');
reset();
const monthly = [pay('2026-01-05'), pay('2026-02-05'), pay('2026-03-05')];
check('monthly drafts read as standard', observeSchedule(monthly) === 'standard');
reset();
const twiceMonthly = [pay('2026-01-05'), pay('2026-01-20'), pay('2026-02-05'), pay('2026-02-20')];
check('two drafts in one month read as split', observeSchedule(twiceMonthly) === 'split');
reset();
const straddling = [pay('2026-01-25'), pay('2026-02-08'), pay('2026-02-25')];
check('split straddling a month boundary still reads as split',
  observeSchedule(straddling) === 'split');
reset();
check('a single draft reads as unknown', observeSchedule([pay('2026-01-05')]) === 'unknown');

console.log('\n=== The overpayment case: split pay must need 4, not 2 ===');
reset();
const splitTwo = evaluateVesting({
  program: 'settlement',
  payments: [pay('2026-01-05'), pay('2026-01-20')],
});
check('2 cleared drafts on a split schedule does NOT vest',
  splitTwo.state === 'pending' && splitTwo.draftsRequired === 4,
  `${splitTwo.state}, needs ${splitTwo.draftsRequired}, ${splitTwo.remaining} remaining`);
reset();
const splitFour = evaluateVesting({
  program: 'settlement',
  payments: [pay('2026-01-05'), pay('2026-01-20'), pay('2026-02-05'), pay('2026-02-20')],
});
check('4 cleared drafts on a split schedule vests', splitFour.state === 'vested');
check('split-pay file can vest inside two calendar months', splitFour.remaining === 0);

console.log('\n=== Standard schedule ===');
reset();
const stdTwo = evaluateVesting({
  program: 'validation',
  payments: [pay('2026-01-05'), pay('2026-02-05')],
});
check('2 cleared drafts on a standard schedule vests',
  stdTwo.state === 'vested' && stdTwo.draftsRequired === 2);
reset();
const stdOne = evaluateVesting({
  program: 'resolution',
  payments: [pay('2026-01-05'), pay('2026-02-05', 'scheduled')],
  declaredSchedule: 'standard',
});
check('1 cleared + 1 scheduled stays pending', stdOne.state === 'pending' && stdOne.remaining === 1);

console.log('\n=== NSF ===');
reset();
const nsf = evaluateVesting({
  program: 'settlement',
  payments: [pay('2026-01-05'), pay('2026-02-05', 'nsf'), pay('2026-03-05', 'scheduled')],
  declaredSchedule: 'standard',
});
check('an NSF draft does not count toward the gate',
  nsf.state === 'pending' && nsf.draftsCleared === 1 && nsf.nsfCount === 1);
reset();
const cured = evaluateVesting({
  program: 'settlement',
  payments: [pay('2026-01-05'), pay('2026-02-05', 'nsf'), pay('2026-02-18')],
  declaredSchedule: 'standard',
});
check('an NSF later cured by a cleared re-draft vests',
  cured.state === 'vested' && cured.nsfCount === 1,
  `${cured.draftsCleared} cleared, ${cured.nsfCount} NSF`);

console.log('\n=== Cancellation ===');
reset();
const cancelEarly = evaluateVesting({
  program: 'settlement',
  payments: [pay('2026-01-05')],
  declaredSchedule: 'standard',
  cancelledAt: '2026-01-28',
});
check('cancel before the gate forfeits the bonus', cancelEarly.state === 'forfeited');
check('forfeiture reason states the close rate is unaffected',
  /close rate is unaffected/i.test(cancelEarly.reason));
reset();
const cancelLate = evaluateVesting({
  program: 'settlement',
  payments: [pay('2026-01-05'), pay('2026-02-05')],
  declaredSchedule: 'standard',
  cancelledAt: '2026-04-01',
});
check('cancel after the gate keeps the bonus', cancelLate.state === 'vested');
reset();
const cancelSplitAtTwo = evaluateVesting({
  program: 'settlement',
  payments: [pay('2026-01-05'), pay('2026-01-20')],
  cancelledAt: '2026-02-02',
});
check('split-pay file cancelled at 2 drafts forfeits — it owed 4',
  cancelSplitAtTwo.state === 'forfeited' && cancelSplitAtTwo.draftsRequired === 4,
  cancelSplitAtTwo.reason);

console.log('\n=== Unresolved and conflicting schedules ===');
reset();
const oneDraft = evaluateVesting({ program: 'validation', payments: [pay('2026-01-05')] });
check('one draft, nothing declared → held, not vested', oneDraft.state === 'held');
check('held files quote no draft requirement', oneDraft.draftsRequired === null);
reset();
const conflict = evaluateVesting({
  program: 'settlement',
  payments: [pay('2026-01-05'), pay('2026-01-20')],
  declaredSchedule: 'standard',
});
check('declared standard but drafted twice in a month → held with a conflict flag',
  conflict.state === 'held' && conflict.scheduleVerdict.conflict === true,
  conflict.reason);
reset();
const conflictButPaid = evaluateVesting({
  program: 'settlement',
  payments: [pay('2026-01-05'), pay('2026-01-20'), pay('2026-02-05'), pay('2026-02-20')],
  declaredSchedule: 'standard',
});
check('a conflicted file that clears 4 drafts vests anyway — the schedule stops mattering',
  conflictButPaid.state === 'vested',
  conflictButPaid.reason);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
