import type { Employee, ModelInputs, ModelResults } from './types';
import { makeEmployee } from './config';
import { computeEmployeeCost } from './labor';
import { runModel } from './simulate';

/**
 * Scale planner — works BACKWARDS from headcount.
 *
 * The Growth Marketing panel answers "what does $X of mail do?". This answers
 * the question an owner actually asks before hiring: "if I put N closers on
 * the phones, how much mail do I have to send and how much social do I have
 * to buy to keep them busy, and what is left over after everyone is paid?"
 *
 * For each headcount it
 *   1. builds a roster of N paid in-house closers (keeping every non-closer
 *      and the owner-operator from the live roster),
 *   2. sizes the mail drop and the social budget so their qualified inbound
 *      calls fill `marketingSharePct` of the closers' talk time, split
 *      `mailSharePct` / (100 − mailSharePct) between the two channels,
 *   3. lets purchased transfers fill whatever talk time is left, and
 *   4. runs the full cash model.
 *
 * Every rate (response, qualified share, close rate, avg debt, CPL) comes from
 * the Growth Marketing inputs, so once the CRM has measured a real drop the
 * planner is driven by observed numbers.
 */

export interface ScalePlanSettings {
  /**
   * Billed transfers the vendors can actually deliver per month. Transfers are
   * the cheapest call, so they fill closer time first up to this cap; owned
   * marketing has to feed everything above it. 0 = unlimited (no marketing).
   */
  transferCapPerMonth: number;
  /** Of the marketing share, how much comes from mail (rest = paid social). */
  mailSharePct: number;
  /** Closer headcounts to illustrate. */
  headcounts: number[];
  /** Months at the end of the horizon averaged for the "steady state" view. */
  steadyMonths: number;
  /**
   * Months to simulate. Shield and ELP pay residuals for 36–48 months, so a
   * 24-month run understates a mature book; the planner runs long enough for
   * the first cohorts to finish and reports the run-rate at the end.
   */
  horizonMonths: number;
}

export const DEFAULT_SCALE_SETTINGS: ScalePlanSettings = {
  transferCapPerMonth: 300,
  mailSharePct: 70,
  headcounts: [2, 4, 6, 8, 10, 15, 20],
  steadyMonths: 6,
  horizonMonths: 48,
};

export interface ScalePlanRow {
  closers: number;
  ownerIncluded: boolean;
  closerHoursPerMonth: number;
  /** Required inputs per month */
  mailPieces: number;
  mailSpend: number;          // pieces × cost per piece + data
  dataSpend: number;
  socialSpend: number;
  creativeSpend: number;
  marketingSpend: number;     // all of the above
  qualifiedInbound: number;   // qualified calls the channels must produce
  transfersPurchased: number;
  transferSpend: number;
  /** Steady-state monthly economics (average of the last `steadyMonths`) */
  deals: number;
  marketingDeals: number;
  enrolledVolume: number;
  revenue: number;
  repCommission: number;
  bonusesAndOverride: number;
  laborCost: number;
  otherOverhead: number;      // overhead ex labor, transfers, marketing
  totalCosts: number;
  netProfit: number;
  marginPct: number;
  utilizationPct: number;
  /** Unit economics at steady state */
  revenuePerDeal: number;
  mailCostPerDeal: number;
  socialCostPerDeal: number;
  transferCostPerDeal: number;
  /** Mail response rate at which a mail deal costs what it earns inside the horizon. */
  breakEvenResponsePct: number;
  /** Horizon */
  horizonRevenue: number;
  horizonNet: number;
  peakCapital: number;
  firstCashPositiveMonth: number | null;
  results: ModelResults;
  inputs: ModelInputs;
}

function closerRoster(inputs: ModelInputs, n: number): { roster: Employee[]; ownerIncluded: boolean } {
  const keep = inputs.roster.filter((e) => e.role !== 'closer' || e.type === 'owner');
  const owner = keep.find((e) => e.type === 'owner');
  const template = inputs.roster.find((e) => e.type === 'inhouse' && e.role === 'closer');
  const closers: Employee[] = [];
  for (let i = 0; i < n; i++) {
    closers.push(makeEmployee({
      ...(template ?? {}),
      id: `scale-closer-${i + 1}`,
      name: `Closer ${i + 1} — In-House`,
      type: 'inhouse',
      role: 'closer',
      startMonth: 1,
      endMonth: null,
      teamId: template?.teamId ?? owner?.teamId ?? 'team-a',
    }));
  }
  return { roster: [...keep, ...closers], ownerIncluded: !!owner };
}

export function planScaleRow(base: ModelInputs, closers: number, s: ScalePlanSettings): ScalePlanRow {
  const { roster, ownerIncluded } = closerRoster(base, closers);
  const costs = roster.map((e) => computeEmployeeCost(e, base.laborPolicy));
  const closerHours = costs.reduce((sum, c) => sum + c.monthlyCloserHours, 0);
  const aht = Math.max(1, base.operations.avgHandleMinutes);

  // Transfers fill talk time first, up to what vendors can deliver; the
  // channels must produce the rest.
  const totalCalls = (closerHours * 60) / aht;
  const transferCalls = s.transferCapPerMonth > 0 ? Math.min(s.transferCapPerMonth, totalCalls) : totalCalls;
  const targetCalls = Math.max(0, totalCalls - transferCalls);
  const mailCalls = targetCalls * (s.mailSharePct / 100);
  const socialCalls = targetCalls - mailCalls;

  const dm = base.marketing.directMail;
  const ps = base.marketing.paidSocial;
  const mailYield = (dm.responsePct / 100) * (dm.qualifiedPct / 100);     // qualified calls per piece
  const socialYield = (ps.qualifiedPct / 100);                             // qualified calls per lead
  const pieces = mailYield > 0 ? Math.ceil(mailCalls / mailYield / 500) * 500 : 0;
  const leads = socialYield > 0 ? socialCalls / socialYield : 0;
  const socialSpend = Math.ceil((leads * ps.costPerLead) / 100) * 100;
  // Data cost scales with the list: keep the $/record implied by the inputs.
  const dataPerPiece = dm.piecesPerMonth > 0 ? dm.dataCostPerMonth / dm.piecesPerMonth : 0.15;
  const dataSpend = Math.round(pieces * dataPerPiece);

  const inputs: ModelInputs = {
    ...base,
    ramp: { ...base.ramp, horizonMonths: Math.max(base.ramp.horizonMonths, s.horizonMonths) },
    roster,
    marketing: {
      ...base.marketing,
      directMail: { ...dm, enabled: pieces > 0, piecesPerMonth: pieces, dataCostPerMonth: dataSpend, startMonth: 1 },
      paidSocial: { ...ps, enabled: socialSpend > 0, spendPerMonth: socialSpend, startMonth: 1 },
    },
  };
  const results = runModel(inputs);

  const months = results.months;
  const tail = months.slice(Math.max(0, months.length - s.steadyMonths));
  const avg = (f: (r: typeof months[number]) => number) => tail.reduce((a, r) => a + f(r), 0) / Math.max(1, tail.length);

  const mailSpend = pieces * dm.costPerPiece + dataSpend;
  const creative = pieces > 0 || socialSpend > 0 ? base.marketing.creativeAndTrackingPerMonth : 0;
  const marketingSpend = avg((r) => r.marketingCost);
  const laborCost = avg((r) => r.laborCost);
  const transferSpend = avg((r) => r.transferCost);
  const overhead = avg((r) => r.overhead);
  const revenue = avg((r) => r.revenue);
  const commission = avg((r) => r.repCommission);
  const bonusesAndOverride = avg((r) => r.bonusPaid + r.managerOverride);
  const net = avg((r) => r.netCashFlow);
  const deals = avg((r) => r.deals);
  // Enrolled debt: transfer deals at the backend-mix average debt, plus the
  // marketing deals at their own (larger) debt load.
  const mix = inputs.volume.mixPct;
  const mixTotal = Math.max(1, mix.LEVEL + mix.CS + mix.LEGACY);
  const transferAvgDebt = (mix.LEVEL * inputs.volume.avgDebt.LEVEL + mix.CS * inputs.volume.avgDebt.CS + mix.LEGACY * inputs.volume.avgDebt.LEGACY) / mixTotal;
  const enrolledVolume = avg((r) => Math.max(0, r.deals - r.marketing.deals) * transferAvgDebt + r.marketing.enrolledVolume);

  const revenuePerDeal = deals > 0 ? revenue / deals : 0;
  const netPerDeal = deals > 0 ? (revenue - commission) / deals : 0;
  const mailDeals = avg((r) => r.marketing.channels.find((c) => c.key === 'mail')?.deals ?? 0);
  const socialDeals = avg((r) => r.marketing.channels.find((c) => c.key === 'social')?.deals ?? 0);
  const transferDeals = Math.max(0, deals - mailDeals - socialDeals);
  const mailCostPerDeal = mailDeals > 0 ? mailSpend / mailDeals : 0;
  const socialCostPerDeal = socialDeals > 0 ? socialSpend / socialDeals : 0;
  const transferCostPerDeal = transferDeals > 0 ? transferSpend / transferDeals : 0;
  // pieces per deal at break-even = netPerDeal / (cost per piece + data per piece)
  const allInPerPiece = dm.costPerPiece + dataPerPiece;
  const breakEvenResponsePct = netPerDeal > 0 && dm.qualifiedPct > 0 && dm.closeRatePct > 0
    ? (allInPerPiece / netPerDeal) / ((dm.qualifiedPct / 100) * (dm.closeRatePct / 100)) * 100
    : 0;

  return {
    closers, ownerIncluded, closerHoursPerMonth: closerHours,
    mailPieces: pieces, mailSpend, dataSpend, socialSpend, creativeSpend: creative, marketingSpend,
    qualifiedInbound: targetCalls,
    transfersPurchased: avg((r) => r.capacity.purchasedTransfers), transferSpend,
    deals, marketingDeals: avg((r) => r.marketing.deals), enrolledVolume,
    revenue, repCommission: commission, bonusesAndOverride, laborCost,
    otherOverhead: Math.max(0, overhead - laborCost - transferSpend - marketingSpend),
    totalCosts: commission + bonusesAndOverride + overhead,
    netProfit: net, marginPct: revenue > 0 ? (net / revenue) * 100 : 0,
    utilizationPct: avg((r) => r.utilizationPct),
    revenuePerDeal, mailCostPerDeal, socialCostPerDeal, transferCostPerDeal, breakEvenResponsePct,
    horizonRevenue: results.totals.revenue,
    horizonNet: months.reduce((a, r) => a + r.netCashFlow, 0),
    peakCapital: results.totals.peakCapitalRequired,
    firstCashPositiveMonth: results.totals.firstCashPositiveMonth,
    results, inputs,
  };
}

export function planScale(base: ModelInputs, s: ScalePlanSettings = DEFAULT_SCALE_SETTINGS): ScalePlanRow[] {
  return s.headcounts.map((n) => planScaleRow(base, n, s));
}
