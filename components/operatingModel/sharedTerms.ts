//
// Single source of truth for backend contract terms.
//
// The Operating Model does NOT keep its own copy of the Level Debt / Consumer
// Shield / Legacy Capital contract terms. It reads them from the shared engine
// that the Commission Simulator and Profitability Balancer already use, so the
// three apps can never drift apart. Nothing in fundingTierEngine.ts is modified.
//
// If a contract term changes, change it in fundingTierEngine.ts once.
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
});

/** The blended labour rate the old model applied to everyone, kept for reference. */
export const legacyBlendedLaborRate = A.costs.laborRatePerHour;
