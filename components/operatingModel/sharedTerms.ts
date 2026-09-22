//
// Single source of truth for backend contract terms.
//
// The Operating Model does NOT keep its own copy of the Level Debt / Consumer
// Shield / Legacy Capital contract terms. It reads them from the shared engine
// that the Commission Simulator and Profitability Balancer already use, so the
// three apps can never drift apart.
//
// If a contract term changes, change it in fundingTierEngine.ts once.
//
// The Elite Legal Practice math itself lives one level further down, in
// components/legacyEngine.ts — the single source of truth shared with the
// Profit Engine, mirroring the production Billable Payout Simulator. Neither
// this file nor operatingModel/backends.ts reimplements any of it.
//
import { DEFAULT_ASSUMPTIONS } from '../fundingTierEngine';
import type {
  CostInputs, LegacyTerms, LevelDebtTerms, ShieldTerms,
} from './types';

const A = DEFAULT_ASSUMPTIONS;

export const sharedLevelDebt = (chargebackClearMonths: number): LevelDebtTerms => ({
  ...A.levelDebt,
  commissionTiers: A.levelDebt.commissionTiers.map((t) => ({ ...t })),
  chargebackClearMonths,
});

export const sharedShield = (): ShieldTerms => ({
  ...A.consumerShield,
  programs: A.consumerShield.programs.map((p) => ({ ...p })),
  buyout: { ...A.consumerShield.buyout },
  // Default stays on the perpetuity so every existing figure is unchanged
  // until the buyout is switched on in Shield Buyout.
  buyoutSharePct: 0,
});

export const sharedLegacy = (): LegacyTerms => ({
  ...A.legacy,
  bands: A.legacy.bands.map((b) => ({ ...b })),
});

/**
 * Cost inputs, adapted from the shared engine's shape.
 *
 * Two additions the shared engine does not carry, because they are specific to
 * this page: stable ids (so a row can be toggled or edited without index
 * juggling) and the DID provisioning policy, which replaces the old fixed
 * `activeDIDs` count with a per-agent multiplier plus a flat extra.
 */
export const sharedCosts = (): CostInputs => ({
  fixedCosts: A.costs.fixedCosts.map((c, i) => ({
    id: `fixed-${i}`, label: c.label, amount: c.amount,
  })),
  perUserCosts: A.costs.perUserCosts.map((c, i) => ({
    id: `user-${i}`, label: c.label, amountPerUser: c.amountPerUser, enabled: true,
  })),
  usageRates: { ...A.costs.usageRates },
  trackdriveTiers: A.costs.trackdriveTiers.map((t) => ({ ...t })),
  trackdriveOutboundPerMin: A.costs.trackdriveOutboundRate,
  transferCost: { ...A.costs.transferCost },
  dids: { perAgent: 1, additional: 0 },
  // Soft credit pull run on every billed qualified transfer, before a program
  // is quoted. $2.50 a pull is the rate Funding Tier is charged.
  creditPulls: { enabled: true, pricePerPull: 2.5, pullsPerBilledTransfer: 1 },
});

/** The blended labour rate the old model applied to everyone, kept for reference. */
export const legacyBlendedLaborRate = A.costs.laborRatePerHour;
