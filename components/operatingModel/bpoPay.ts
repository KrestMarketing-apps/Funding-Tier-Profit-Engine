import type {
  BackendKey, BpoBonusResult, BpoPayPolicy, BpoRepLine, BpoVolumeTier, EmployeeCost,
} from './types';
import { BACKEND_KEYS } from './types';

/**
 * BPO / overseas variable pay.
 *
 * A BPO closer is not on the US per-deal schedule. Their whole variable comp is
 * one monthly bonus: a share of the total dollars THEY enrolled that calendar
 * month, but only if they personally cleared a deal-count threshold. It is a
 * cliff, not a ladder — miss 25 deals and the bonus is zero; clear 25 and the
 * rate pays on the rep's entire month of enrolled volume, not just the deals
 * above the line.
 *
 * Deals are attributed to a rep by their share of total closer hours, the same
 * technique the model already uses for manager overrides and for the US/BPO
 * draw split. No part of this model tracks named individuals' deals, so hours
 * are the only honest proxy available.
 */

/** Highest tier the rep's deal count clears. Undefined = below the lowest cliff. */
export function bpoTierFor(deals: number, tiers: BpoVolumeTier[]): BpoVolumeTier | undefined {
  return [...tiers]
    .sort((a, b) => b.minDealsPerMonth - a.minDealsPerMonth)
    .find((t) => deals >= t.minDealsPerMonth);
}

export interface BpoBonusContext {
  /** BPO-type roster rows carrying closer hours this month. */
  bpoClosers: EmployeeCost[];
  /** Every closer hour on the roster this month, US and BPO alike. */
  totalCloserHours: number;
  dealsByBackend: Record<BackendKey, number>;
  avgDebt: Record<BackendKey, number>;
  /** survival[k] at the deal-month the bonus is paid — the clawback / NSF haircut. */
  survivalAtPayout: Record<BackendKey, number>;
}

const EMPTY: BpoBonusResult = { lines: [], deals: 0, enrolledVolume: 0, accrued: 0 };

export function computeBpoBonus(policy: BpoPayPolicy, ctx: BpoBonusContext): BpoBonusResult {
  if (!policy.enabled) return EMPTY;
  if (ctx.bpoClosers.length === 0 || ctx.totalCloserHours <= 0) return EMPTY;

  const lowestCliff = policy.tiers.length
    ? Math.min(...policy.tiers.map((t) => t.minDealsPerMonth))
    : 0;

  const lines: BpoRepLine[] = ctx.bpoClosers.map((c) => {
    const share = c.monthlyCloserHours / ctx.totalCloserHours;

    let deals = 0;
    let survivingDeals = 0;
    let enrolledVolume = 0;
    let survivingVolume = 0;
    BACKEND_KEYS.forEach((k) => {
      const d = ctx.dealsByBackend[k] * share;
      const surviving = d * (ctx.survivalAtPayout[k] ?? 0);
      deals += d;
      survivingDeals += surviving;
      enrolledVolume += d * ctx.avgDebt[k];
      survivingVolume += surviving * ctx.avgDebt[k];
    });

    const thresholdDeals = policy.thresholdBasis === 'gross' ? deals : survivingDeals;
    const tier = bpoTierFor(thresholdDeals, policy.tiers);
    const rate = tier?.rate ?? 0;
    const bonusBase = policy.netOfClawbacks ? survivingVolume : enrolledVolume;

    return {
      name: c.employee.name,
      closerHours: c.monthlyCloserHours,
      deals,
      survivingDeals,
      enrolledVolume,
      bonusBase,
      rate,
      tierLabel: tier
        ? `${tier.minDealsPerMonth}+ deals → ${(tier.rate * 100).toFixed(2)}%`
        : `Below the ${lowestCliff}-deal cliff — no bonus`,
      qualified: tier != null,
      amount: bonusBase * rate,
    };
  });

  return {
    lines,
    deals: lines.reduce((s, l) => s + l.deals, 0),
    enrolledVolume: lines.reduce((s, l) => s + l.enrolledVolume, 0),
    accrued: lines.reduce((s, l) => s + l.amount, 0),
  };
}
