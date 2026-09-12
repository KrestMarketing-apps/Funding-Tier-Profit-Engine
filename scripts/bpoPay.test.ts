/* Standalone regression harness — run before any UI work.
 *   npx tsx scripts/bpoPay.test.ts
 */
import { DEFAULT_INPUTS, defaultShifts, makeEmployee } from '../components/operatingModel/config';
import { runModel } from '../components/operatingModel/simulate';
import type { Employee, ModelInputs } from '../components/operatingModel/types';

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
let failures = 0;
function check(name: string, pass: boolean, detail = '') {
  if (!pass) failures++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}
const near = (a: number, b: number, tol = 0.5) => Math.abs(a - b) <= tol;

const shift = (start: number, end: number) => {
  const s = defaultShifts();
  (['mon', 'tue', 'wed', 'thu', 'fri'] as const).forEach((d) => { s[d] = { enabled: true, start, end }; });
  return s;
};

/** The roster actually running on ai.fundingtier.com today. */
function liveRoster(bpoSeats = 5): Employee[] {
  const out: Employee[] = [
    makeEmployee({
      name: 'Owner Operator', type: 'owner', role: 'closer', teamId: 'team-a',
      shifts: shift(9, 18),
    }),
  ];
  for (let i = 1; i <= bpoSeats; i++) {
    out.push(makeEmployee({
      name: `Egypt CLOSER | CallBlade ${i}`, type: 'bpo', role: 'closer',
      hourlyRate: 12, teamId: 'team-a', shifts: shift(9, 17),
    }));
  }
  return out;
}

/** Live settings: the deployed model runs a 60-minute average handle time. */
const LIVE_OPS = { ...DEFAULT_INPUTS.operations, avgHandleMinutes: 60 };

function withRoster(roster: Employee[], patch: Partial<ModelInputs> = {}): ModelInputs {
  return { ...DEFAULT_INPUTS, operations: LIVE_OPS, roster, ...patch };
}

console.log('\n=== 1. Live roster: BPO on the old contract schedule vs the volume bonus ===');
const before = runModel(withRoster(liveRoster(), {
  bpoPay: { ...DEFAULT_INPUTS.bpoPay, enabled: false },
  bonusPolicy: { ...DEFAULT_INPUTS.bonusPolicy, usOnly: false },
}));
const after = runModel(withRoster(liveRoster()));

const b = before.months[11], a = after.months[11];
console.log(`  deals/mo                ${a.deals}  (US ${a.usDeals.toFixed(1)} · BPO ${a.bpoDeals.toFixed(1)})`);
console.log(`  commission  before      ${money(b.repCommission)}   after ${money(a.repCommission)}`);
console.log(`  BPO volume bonus        ${money(a.bpoBonusPaid)}`);
console.log(`  spiffs      before      ${money(b.bonusPaid)}   after ${money(a.bonusPaid)}`);
console.log(`  24-mo total rep pay     ${money(before.totals.repCommission + before.totals.bonuses)}`
  + ` → ${money(after.totals.repCommission + after.totals.bpoBonus + after.totals.bonuses)}`);
console.log(`  final cash              ${money(before.totals.finalCash)} → ${money(after.totals.finalCash)}`);

check('BPO writes the large majority of deals', a.bpoDeals > a.usDeals,
  `${a.bpoDeals.toFixed(1)} BPO vs ${a.usDeals.toFixed(1)} US`);
check('commission falls once BPO comes off the contract schedule', a.repCommission < b.repCommission);
check('US commission is only the US-attributed share',
  near(a.repCommission, b.repCommission * (a.usDeals / a.deals), 25),
  `${money(a.repCommission)} vs ${money(b.repCommission * (a.usDeals / a.deals))} expected`);
check('total payout drops', after.totals.finalCash > before.totals.finalCash);

console.log('\n=== 2. The 25 / 30 deal cliffs ===');
const perRep = after.months[11].bpoBonus.lines[0];
console.log(`  per BPO rep: ${perRep.deals.toFixed(1)} deals · ${money(perRep.enrolledVolume)} enrolled`
  + ` · ${perRep.tierLabel} · ${money(perRep.amount)}`);
check('26 deals/rep clears the 25 cliff at 0.25%', near(perRep.rate, 0.0025, 1e-9),
  `rate ${(perRep.rate * 100).toFixed(2)}%`);
check('bonus = rate x that rep\'s own enrolled dollars',
  near(perRep.amount, perRep.bonusBase * perRep.rate, 0.01));

// Per-rep volume tracks that rep's OWN hours, not the seat count — so the
// cliffs are exercised by lengthening and shortening the shift.
const longRoster = liveRoster().map((e) => (e.type === 'bpo' ? { ...e, shifts: shift(9, 19) } : e));
const fat = runModel(withRoster(longRoster));
const fatRep = fat.months[11].bpoBonus.lines[0];
console.log(`  50-hr BPO week: ${fatRep.deals.toFixed(1)} deals/rep · ${fatRep.tierLabel}`);
check('a rep over 30 deals moves to 0.30%', fatRep.deals >= 30 && near(fatRep.rate, 0.003, 1e-9),
  `${fatRep.deals.toFixed(1)} deals → ${(fatRep.rate * 100).toFixed(2)}%`);

const shortRoster = liveRoster().map((e) => (e.type === 'bpo' ? { ...e, shifts: shift(9, 14) } : e));
const thin = runModel(withRoster(shortRoster));
const thinRep = thin.months[11].bpoBonus.lines[0];
console.log(`  25-hr BPO week: ${thinRep.deals.toFixed(1)} deals/rep · ${thinRep.tierLabel}`);
check('below the cliff pays exactly zero', thinRep.deals < 25 && thinRep.amount === 0,
  `${thinRep.deals.toFixed(1)} deals → ${money(thinRep.amount)}`);

console.log('\n=== 2b. Cliff sensitivity at the live setting ===');
const aht65 = runModel(withRoster(liveRoster(), {
  operations: { ...LIVE_OPS, avgHandleMinutes: 65 },
}));
const r65 = aht65.months[11].bpoBonus.lines[0];
console.log(`  AHT 60 → ${perRep.deals.toFixed(1)} deals/rep, ${money(perRep.amount)}`);
console.log(`  AHT 65 → ${r65.deals.toFixed(1)} deals/rep, ${money(r65.amount)}`);
check('the live roster sits ON the 25-deal cliff, not above it',
  perRep.deals >= 25 && perRep.deals < 27 && r65.amount === 0,
  'a 5-minute AHT slip wipes the whole BPO bonus out');

console.log('\n=== 3. Payout timing and clawback ===');
check('month 1 pays no BPO bonus (accrued, not yet paid)', after.months[0].bpoBonusPaid === 0);
check('month 2 releases month 1\'s accrual',
  near(after.months[1].bpoBonusPaid, after.months[0].bpoBonus.accrued, 0.01));
check('bonus base is netted for NSF/clawback', perRep.bonusBase < perRep.enrolledVolume,
  `${money(perRep.bonusBase)} of ${money(perRep.enrolledVolume)} gross`);

const gross = runModel(withRoster(liveRoster(), {
  bpoPay: { ...DEFAULT_INPUTS.bpoPay, netOfClawbacks: false },
}));
check('netOfClawbacks off pays on gross enrolled dollars',
  near(gross.months[11].bpoBonus.lines[0].bonusBase, perRep.enrolledVolume, 1));

console.log('\n=== 4. Regression: an all-US roster must be untouched ===');
const usRoster: Employee[] = [
  makeEmployee({ name: 'Owner Operator', type: 'owner', role: 'closer', teamId: 'team-a', shifts: shift(9, 18) }),
  makeEmployee({ name: 'Closer 1', type: 'inhouse', role: 'closer', teamId: 'team-a', shifts: shift(9, 18) }),
];
const usOld = runModel(withRoster(usRoster, { bpoPay: { ...DEFAULT_INPUTS.bpoPay, enabled: false } }));
const usNew = runModel(withRoster(usRoster));
check('no BPO seats → identical commission', near(usOld.totals.repCommission, usNew.totals.repCommission, 0.01));
check('no BPO seats → identical final cash', near(usOld.totals.finalCash, usNew.totals.finalCash, 0.01));
check('no BPO seats → zero BPO bonus', usNew.totals.bpoBonus === 0);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
