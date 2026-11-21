/** Per-deal economics by program and debt load, survival-weighted, for the investor package. */
import { DEFAULT_INPUTS } from '../../components/operatingModel/config';
import { revenueForDealMonth, agentCommissionForDeal, agentPayoutMonth, maxRevenueMonth, buildSurvivalCurve, shield, legacy } from '../../components/operatingModel/backends';
import type { BackendKey } from '../../components/operatingModel/types';
const I: any = DEFAULT_INPUTS; const NSF = 15;
const CASES = [{ key: 'SAFE', fp: 60, c: 15 }, { key: 'TARGET', fp: 70, c: 10 }];
const out: any = { cases: {}, shield: {}, elp: {} };
for (const cs of CASES) {
  out.cases[cs.key] = {};
  for (const debt of [15000, 25000]) {
    out.cases[cs.key][debt] = {};
    for (const key of ['LEVEL', 'CS', 'LEGACY'] as BackendKey[]) {
      const term = maxRevenueMonth(key, debt, I);
      const curve = key === 'LEVEL' ? { firstPayPct: cs.fp, cancelPctByMonth: [NSF], steadyStateMonthlyCancelPct: 0 } : { firstPayPct: cs.fp, cancelPctByMonth: [cs.c], steadyStateMonthlyCancelPct: cs.c };
      const s = buildSurvivalCurve(curve, Math.max(term, 60));
      let full = 0, exp = 0; const sched: any[] = [];
      for (let m = 1; m <= term; m++) { const r = revenueForDealMonth(key, debt, m, I); full += r; exp += r * (s[m] ?? 0); if (r > 0 && (m <= 5 || m === term)) sched.push({ m, r, surv: s[m] }); }
      const pm = agentPayoutMonth(key, I);
      const comm = agentCommissionForDeal(key, debt, 60 * debt, I); const expComm = comm * (s[pm] ?? 0);
      out.cases[cs.key][debt][key] = { term, full, exp, comm, payoutMonth: pm, survAtPayout: s[pm], expComm, netUs: exp - expComm, netNoComm: exp, sched };
    }
    out.cases[cs.key][debt].survival = [1, 2, 3, 4, 5, 6, 12, 24, 36].map((m) => ({ m, s: buildSurvivalCurve({ firstPayPct: cs.fp, cancelPctByMonth: [cs.c], steadyStateMonthlyCancelPct: cs.c }, 40)[m] }));
  }
}
for (const debt of [15000, 20000, 25000]) {
  const p = shield.getProgram(debt, I.consumerShield)!;
  out.shield[debt] = { payment: p.payment, term: p.term, commission: p.commission, buyout: shield.buyoutPayout(debt, I.consumerShield), perpFirst: shield.perpetualRevenueForDealMonth(debt, 1, I.consumerShield), perpLater: shield.perpetualRevenueForDealMonth(debt, 5, I.consumerShield), fullPerp: shield.perpetualFullTerm(debt, I.consumerShield) };
  out.elp[debt] = { term: maxRevenueMonth('LEGACY', debt, I), m1: revenueForDealMonth('LEGACY', debt, 1, I), m3: revenueForDealMonth('LEGACY', debt, 3, I), full: Array.from({ length: 60 }, (_, i) => revenueForDealMonth('LEGACY', debt, i + 1, I)).reduce((a, b) => a + b, 0) };
}
out.mix = I.volume.mixPct; out.levelShare = I.levelDebt.revenueSharePct;
require('fs').writeFileSync('' + __dirname + '/deal-economics.json', JSON.stringify(out));
console.log(JSON.stringify(out.shield), JSON.stringify(out.elp));
for (const k of Object.keys(out.cases)) for (const d of [15000, 25000]) for (const p of ['LEVEL', 'CS', 'LEGACY']) { const x = out.cases[k][d][p]; console.log(k, d, p, 'term', x.term, 'full', Math.round(x.full), 'exp', Math.round(x.exp), 'comm', Math.round(x.comm), 'surv@pay', (x.survAtPayout * 100).toFixed(0), 'netUs', Math.round(x.netUs), 'netNo', Math.round(x.netNoComm)); }
