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
import { CREDIT_PULL_PRICES } from './costs';
import { ELP_ACCELERATED_DEFAULT } from '../legacyEngine';
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
  accelerated: { ...ELP_ACCELERATED_DEFAULT },
  // Default stays on the Residual model so every existing figure is unchanged
  // until the Accelerated election is switched on in ELP Accelerated.
  acceleratedSharePct: 0,
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
    // The ELP Salesforce seat is billed on Legacy Capital Services' Exhibit D
    // seat schedule, which steps with the month's ELP file count.
    ...(/elite legal practice/i.test(c.label) ? { tieredBy: 'ELP_FILES' as const } : {}),
  })),
  usageRates: { ...A.costs.usageRates },
  trackdriveTiers: A.costs.trackdriveTiers.map((t) => ({ ...t })),
  trackdriveOutboundPerMin: A.costs.trackdriveOutboundRate,
  transferCost: { ...A.costs.transferCost },
  dids: { perAgent: 1, additional: 0 },
  // Soft credit pull run on every billed qualified transfer, before a program
  // is quoted, priced by the backend that runs it (see CREDIT_PULL_PRICES):
  // Level Debt via Forth/Spinwheel $1.65 and Elite Legal Practice $2.60 are
  // confirmed; Consumer Shield $1.75 is a placeholder to confirm with Adam Robles.
  creditPulls: { enabled: true, pricePerPullByBackend: { ...CREDIT_PULL_PRICES }, pullsPerBilledTransfer: 1 },
});

/** The blended labour rate the old model applied to everyone, kept for reference. */
export const legacyBlendedLaborRate = A.costs.laborRatePerHour;
