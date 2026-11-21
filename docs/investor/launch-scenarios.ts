/**
 * Launch scenarios for the investor package.
 *
 * Four named scenarios (Nov 21 revision), each run at two assumption sets:
 *   SAFE   — 15% close, 60% first payment clears, 15%/mo cancel on perpetuals
 *   TARGET — 16% close, 70% first payment clears, 10%/mo cancel on perpetuals
 * Level Debt (settlement) always carries a 15% second-payment NSF: 15% of files
 * that make payment 1 miss payment 2 and the 8% fee is clawed back.
 * First 90 days: 100% of files to Shield Services (engine launchMix).
 * Offshore (Egypt / CallBlade) closers: $12/hr, 3 minimum, +4.5% KPI bonus.
 * Transfers: standard election $14 per call, 2-minute buffer.
 *
 * Also writes: election cases (0 / 50 / 100% Shield buyout) for the two
 * 3-closer scenarios, and a sliding average-debt table showing the debt load
 * a mail or social deal needs to be profitable after all costs.
 */
import { DEFAULT_INPUTS, makeEmployee } from '../../components/operatingModel/config';
import { runModel } from '../../components/operatingModel/simulate';
import { computeEmployeeCost } from '../../components/operatingModel/labor';
import { revenueForDealMonth, agentCommissionForDeal, agentPayoutMonth, maxRevenueMonth, buildSurvivalCurve } from '../../components/operatingModel/backends';
import type { BackendKey } from '../../components/operatingModel/types';

const base: any = JSON.parse(JSON.stringify(DEFAULT_INPUTS));
base.ramp.horizonMonths = 48;
const OFFSHORE_RATE = 12;
const US_RATE = base.roster.find((e: any) => e.type === 'inhouse')?.hourlyRate ?? 18;
const NSF_2ND_PAYMENT_PCT = 15;

function roster(us: number, off: number) {
  const r: any[] = [makeEmployee({ name: 'Owner Operator', type: 'owner', role: 'closer', teamId: 'team-a' })];
  for (let i = 1; i <= us; i++) r.push(makeEmployee({ name: `Closer ${i} — US W-2`, type: 'inhouse', role: 'closer', teamId: 'team-a' }));
  for (let i = 1; i <= off; i++) r.push(makeEmployee({ name: `Closer ${i} — Egypt BPO`, type: 'bpo', role: 'closer', hourlyRate: OFFSHORE_RATE, teamId: 'team-a' }));
  return r;
}
function virtual(inp: any) { inp.costs.fixedCosts = inp.costs.fixedCosts.filter((c: any) => !/office|team lunch|rent/i.test(c.label)); }
function assumptions(inp: any, close: number, fp: number, c: number) {
  for (const b of inp.operations.buffers) b.closeRatePct = close;
  inp.marketing.directMail.closeRatePct = Math.max(close, inp.marketing.directMail.closeRatePct);
  inp.marketing.paidSocial.closeRatePct = close;
  for (const k of ['LEVEL', 'CS', 'LEGACY']) {
    inp.survivalCurves[k] = k === 'LEVEL'
      ? { firstPayPct: fp, cancelPctByMonth: [NSF_2ND_PAYMENT_PCT], steadyStateMonthlyCancelPct: 0 }
      : { firstPayPct: fp, cancelPctByMonth: [c], steadyStateMonthlyCancelPct: c };
  }
}

const CASES = [
  { key: 'SAFE', label: 'Safe: 15% close · 60% first pay · 15%/mo cancel', close: 15, fp: 60, c: 15 },
  { key: 'TARGET', label: 'Target: 16% close · 70% first pay · 10%/mo cancel', close: 16, fp: 70, c: 10 },
];
const SCEN = [
  { id: 'S1', label: 'Owner + 3 Egypt BPO closers ($12/hr), virtual, transfers', us: 0, off: 3 },
  { id: 'S2', label: 'Owner + 3 US W-2 closers, virtual, transfers', us: 3, off: 0 },
  { id: 'R0', label: 'Reference: owner only, virtual, transfers', us: 0, off: 0 },
  { id: 'R1', label: 'Reference: owner + 1 US W-2 closer (Plan C trial), virtual', us: 1, off: 0 },
];

const f = (n: number) => Math.round(n);
const out: any[] = [];
const runs: any[] = [];
for (const s of SCEN) for (const cs of CASES) runs.push({ ...s, ...cs, caseKey: cs.key, buyout: null });
for (const s of SCEN.slice(0, 2)) for (const cs of CASES) for (const bo of [0, 50, 100]) runs.push({ ...s, ...cs, caseKey: cs.key, buyout: bo });

for (const r of runs) {
  const inp: any = JSON.parse(JSON.stringify(base));
  inp.roster = roster(r.us, r.off); virtual(inp); assumptions(inp, r.close, r.fp, r.c);
  if (r.buyout != null) inp.consumerShield.buyoutSharePct = r.buyout;
  const res = runModel(inp); const ms = res.months; const tail = ms.slice(-6);
  const avg = (k: (m: any) => number) => tail.reduce((a, m) => a + k(m), 0) / 6;
  const y1 = ms.slice(0, 12).reduce((a, m) => a + m.netCashFlow, 0);
  const y2 = ms.slice(12, 24).reduce((a, m) => a + m.netCashFlow, 0);
  const seatType = r.us > 0 ? 'inhouse' : 'bpo';
  const seat = computeEmployeeCost(makeEmployee({ name: 'p', type: seatType, role: 'closer', hourlyRate: seatType === 'inhouse' ? US_RATE : OFFSHORE_RATE }), inp.laborPolicy).monthlyCost;
  let hire: number | null = null;
  for (let i = 1; i < ms.length; i++) { const m = ms[i], p = ms[i - 1]; if (m.utilizationPct >= 90 && p.utilizationPct >= 90 && m.cashPosition >= m.reserveTarget + 3 * seat) { hire = m.month; break; } }
  out.push({
    id: r.id, label: r.label, caseKey: r.caseKey, caseLabel: r.label, close: r.close, fp: r.fp, c: r.c, buyout: r.buyout,
    seats: 1 + r.us + r.off, seatCost: seat,
    deals: avg((m) => m.deals), rev: avg((m) => m.revenue), labor: avg((m) => m.laborCost),
    mkt: avg((m) => m.transferCost + m.marketingCost), comm: avg((m) => m.repCommission + m.bonusPaid + m.managerOverride),
    other: avg((m) => Math.max(0, m.overhead - m.laborCost - m.transferCost - m.marketingCost)), net: avg((m) => m.netCashFlow),
    y1, y2, low: res.totals.lowestCash, cashOut: res.totals.cashOutMonth, cashPos: res.totals.firstCashPositiveMonth,
    peak: res.totals.peakCapitalRequired, reserveMet: res.totals.reserveTargetFirstMet, hire,
    m12bank: ms[11].cashPosition, m24bank: ms[23].cashPosition, warnings: res.warnings,
    months: ms.slice(0, 24).map((m) => ({ mo: m.month, deals: m.deals, rev: m.revenue, labor: m.laborCost, mkt: m.transferCost + m.marketingCost, comm: m.repCommission + m.bonusPaid, net: m.netCashFlow, bank: m.cashPosition, res: m.reserveTarget, util: m.utilizationPct })),
  });
}

// ── Sliding average-debt scale: what a mail / social deal must carry to pay ──
// Per-deal expected net (after US closer commission, survival-weighted) by
// average debt, versus the all-in acquisition cost per deal for each method.
const I: any = base;
function perDealNet(debt: number, fp: number, c: number, usClosed: boolean) {
  const mix = I.volume.mixPct; let net = 0;
  for (const key of ['LEVEL', 'CS', 'LEGACY'] as BackendKey[]) {
    const term = maxRevenueMonth(key, debt, I);
    const curve = key === 'LEVEL'
      ? { firstPayPct: fp, cancelPctByMonth: [NSF_2ND_PAYMENT_PCT], steadyStateMonthlyCancelPct: 0 }
      : { firstPayPct: fp, cancelPctByMonth: [c], steadyStateMonthlyCancelPct: c };
    const s = buildSurvivalCurve(curve, Math.max(term, 60));
    let exp = 0; for (let m = 1; m <= term; m++) exp += revenueForDealMonth(key, debt, m, I) * (s[m] ?? 0);
    const comm = usClosed ? agentCommissionForDeal(key, debt, 60 * debt, I) * (s[agentPayoutMonth(key, I)] ?? 0) : 0;
    net += (exp - comm) * (mix[key] / 100);
  }
  return net;
}
function costPerDeal(method: 'transfer' | 'mail' | 'social', close: number) {
  if (method === 'transfer') {
    const ops = I.operations; const b = ops.buffers.find((x: any) => x.key === 'buffer2min');
    // $14 per qualified transfer; pass rate is already in the price (billed only on passed calls)
    return b.price / (close / 100);
  }
  if (method === 'mail') {
    const dm = I.marketing.directMail;
    const perQualifiedCall = (dm.costPerPiece) / ((dm.responsePct / 100) * (dm.qualifiedPct / 100));
    return perQualifiedCall / (Math.max(close, dm.closeRatePct) / 100) + (dm.dataCostPerMonth / Math.max(1, dm.piecesPerMonth)) / ((dm.responsePct / 100) * (dm.qualifiedPct / 100) * (Math.max(close, dm.closeRatePct) / 100));
  }
  const ps = I.marketing.paidSocial;
  const perQualifiedCall = ps.costPerLead / (ps.qualifiedPct / 100);
  return perQualifiedCall / (close / 100);
}
const slide: any = { debts: [15000, 20000, 25000, 30000, 35000, 40000], cases: {} };
for (const cs of CASES) {
  const cpd = { transfer: costPerDeal('transfer', cs.close), mail: costPerDeal('mail', cs.close), social: costPerDeal('social', cs.close) };
  slide.cases[cs.key] = { costPerDeal: cpd, rows: slide.debts.map((d: number) => ({ debt: d, netUs: perDealNet(d, cs.fp, cs.c, true), netNoComm: perDealNet(d, cs.fp, cs.c, false) })) };
}

require('fs').writeFileSync('' + __dirname + '/launch-scenarios.json', JSON.stringify({ scenarios: out, slide, assumptions: { offshoreRate: OFFSHORE_RATE, usRate: US_RATE, nsfSecondPaymentPct: NSF_2ND_PAYMENT_PCT, offshoreBonusPct: base.laborPolicy.offshoreBonusPct, transfer: { price: 14, buffer: 2 }, launchMix: base.volume.launchMix, mixPct: base.volume.mixPct } }));
for (const o of out) console.log([o.id, o.caseKey, o.buyout == null ? '' : `${o.buyout}% buyout`, 'deals', o.deals.toFixed(0), 'rev', f(o.rev), 'labor', f(o.labor), 'mkt', f(o.mkt), 'comm', f(o.comm), 'other', f(o.other), 'net', f(o.net), 'y1', f(o.y1), 'y2', f(o.y2), 'low', f(o.low), 'out', o.cashOut, 'cash+', o.cashPos, 'resMet', o.reserveMet, 'hire', o.hire, 'bank12', f(o.m12bank), 'bank24', f(o.m24bank)].join('\t'));
console.log('\nSliding scale (per-deal expected net, US-closed / no-commission) vs cost per deal');
for (const k of Object.keys(slide.cases)) { const c = slide.cases[k]; console.log(k, 'cost/deal', JSON.stringify(Object.fromEntries(Object.entries(c.costPerDeal).map(([a, b]: any) => [a, f(b)])))); for (const r of c.rows) console.log('  ', r.debt, f(r.netUs), f(r.netNoComm)); }
