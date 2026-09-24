import type {
  BackendKey, CostBreakdownGroup, CostInputs, CreditPullPolicy, ModelInputs, MonthlyCostBreakdown, TrackdriveTier,
} from './types';
import { BACKEND_KEYS } from './types';
import type { RosterMonthSummary } from './labor';

const PULL_BACKEND_LABEL: Record<BackendKey, string> = {
  LEVEL: 'Level Debt (Forth / Spinwheel)', CS: 'Consumer Shield', LEGACY: 'Elite Legal Practice',
};

export const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
export const money2 = (n: number) => `$${n.toFixed(2)}`;

/**
 * Blended price of one BILLED transfer across the buffer mix.
 *
 * Weighted by each tier's share of billed transfers, not of raw transfers — a
 * tier with a low pass rate contributes fewer billed transfers than its raw mix
 * implies, so weighting by raw mix would overstate its influence on price.
 */
export function blendedTransferCost(inputs: ModelInputs): number {
  const buffers = inputs.operations.buffers;
  const w = buffers.map((b) => (b.mixPct / 100) * (b.passRatePct / 100));
  const sum = w.reduce((a, b) => a + b, 0);
  if (sum <= 0) return 0;
  return buffers.reduce((s, b, i) => s + (w[i] / sum) * b.price, 0);
}

/**
 * Trackdrive publishes spend tiers, not a plan you pick. The tier resolves from
 * simulated inbound minutes: take the richest tier whose spend threshold the
 * month's inbound cost actually clears.
 */
export function resolveTrackdriveTier(callMinutes: number, tiers: TrackdriveTier[]): TrackdriveTier {
  let chosen = tiers[0];
  for (const tier of tiers) {
    if (callMinutes * tier.inbound >= tier.threshold) chosen = tier;
  }
  return chosen;
}

export function didCount(costs: CostInputs, headcount: number): number {
  return Math.max(0, Math.round(headcount * costs.dids.perAgent + costs.dids.additional));
}

/**
 * What Funding Tier is charged for one soft credit pull, by backend.
 *
 *   Level Debt (Forth via Spinwheel)  $1.65  confirmed 2026-09-23
 *   Elite Legal Practice (Salesforce) $2.60  confirmed 2026-09-23
 *   Consumer Shield (Equifax)         $1.75  PLACEHOLDER — confirm with Adam Robles
 */
export const CREDIT_PULL_PRICES: Record<BackendKey, number> = { LEVEL: 1.65, CS: 1.75, LEGACY: 2.6 };

/** Backends whose pull price is still an estimate, with who to confirm it with. */
export const CREDIT_PULL_UNCONFIRMED: Partial<Record<BackendKey, string>> = {
  CS: 'Placeholder — confirm the Consumer Shield pull price with Adam Robles',
};

/** Defaults for the credit-pull policy, so an older saved input shape still runs. */
export const CREDIT_PULL_FALLBACK: CreditPullPolicy = {
  enabled: true, pricePerPullByBackend: { ...CREDIT_PULL_PRICES }, pullsPerBilledTransfer: 1,
};

/**
 * The policy in force. A profile saved before per-backend pricing carries a
 * single flat `pricePerPull`; that number is dropped in favour of the
 * confirmed per-backend prices rather than silently kept.
 */
export function creditPullPolicy(costs: CostInputs): CreditPullPolicy {
  const p = costs.creditPulls;
  if (!p) return CREDIT_PULL_FALLBACK;
  return {
    enabled: p.enabled ?? true,
    pullsPerBilledTransfer: p.pullsPerBilledTransfer ?? 1,
    pricePerPullByBackend: { ...CREDIT_PULL_PRICES, ...(p.pricePerPullByBackend ?? {}) },
  };
}

/**
 * Each backend's share of pulls. A pull is run by the backend the file is
 * pushed to, so pulls follow the backend volume split.
 */
export function creditPullShares(inputs: ModelInputs): Record<BackendKey, number> {
  const mix = inputs.volume.mixPct;
  const total = BACKEND_KEYS.reduce((s, k) => s + (mix[k] || 0), 0) || 1;
  const out = {} as Record<BackendKey, number>;
  BACKEND_KEYS.forEach((k) => { out[k] = (mix[k] || 0) / total; });
  return out;
}

/** Blended price of one pull across the backend volume split. */
export function blendedCreditPullPrice(inputs: ModelInputs): number {
  const p = creditPullPolicy(inputs.costs);
  const sh = creditPullShares(inputs);
  return BACKEND_KEYS.reduce((s, k) => s + sh[k] * p.pricePerPullByBackend[k], 0);
}

/**
 * Soft credit pulls run in a month.
 *
 * One pull per BILLED qualified transfer. A dud disconnects before the buffer
 * elapses, is never invoiced and never reaches a closer, so it never triggers a
 * pull — which is why raw transfers are the wrong multiplier here.
 */
export function creditPullCount(costs: CostInputs, billedTransfers: number): number {
  const p = creditPullPolicy(costs);
  if (!p.enabled) return 0;
  return Math.max(0, billedTransfers * p.pullsPerBilledTransfer);
}

export interface CostContext {
  /** Billed transfers — the calls actually invoiced and actually handled. */
  totalTransfers: number;
  purchasedTransfers: number;
  totalCallMinutes: number;
  /** Transfer spend, computed by the funnel. */
  transferCost: number;
  /** Deals closed this month — used only to express costs per closed deal. */
  deals?: number;
  roster: RosterMonthSummary;
}

/**
 * Full monthly cost ledger. Every line carries the formula that produced it so
 * the "Show the math" view and the tooltips can render a derivation instead of
 * an unexplained number.
 */
export function buildMonthlyCosts(inputs: ModelInputs, ctx: CostContext): MonthlyCostBreakdown {
  const c = inputs.costs;
  const headcount = ctx.roster.headcount;
  const groups: CostBreakdownGroup[] = [];

  // 1 — Fixed
  const fixedLines = c.fixedCosts.map((f) => ({
    id: f.id, label: f.label, detail: 'Flat monthly', formula: `${money(f.amount)} flat`, amount: f.amount,
  }));
  groups.push({
    id: 'fixed', label: 'Fixed Monthly Costs',
    note: 'Software, office, and team costs — flat regardless of volume',
    lines: fixedLines, subtotal: fixedLines.reduce((s, l) => s + l.amount, 0),
  });

  // 2 — Per-user (FIX: line items and subtotal both use CURRENT headcount)
  const perUserLines = c.perUserCosts.filter((p) => p.enabled).map((p) => ({
    id: p.id, label: p.label,
    detail: `${money2(p.amountPerUser)}/user x ${headcount} user${headcount === 1 ? '' : 's'}`,
    formula: `${money2(p.amountPerUser)} x ${headcount}`,
    amount: p.amountPerUser * headcount,
  }));
  groups.push({
    id: 'peruser', label: 'Per-User Tools',
    note: `Scales with active headcount (${headcount} on payroll this month)`,
    lines: perUserLines, subtotal: perUserLines.reduce((s, l) => s + l.amount, 0),
  });

  // 3 — Usage
  const sms = ctx.totalTransfers * inputs.operations.smsPerTransfer;
  const emailRaw = ctx.totalTransfers * inputs.operations.emailPerTransfer;
  const emails = inputs.operations.emailMonthlyCap > 0
    ? Math.min(emailRaw, inputs.operations.emailMonthlyCap) : emailRaw;
  const dids = didCount(c, headcount);
  const usageLines = [
    {
      id: 'inbound', label: 'Inbound Forwarding',
      detail: `${Math.round(ctx.totalCallMinutes).toLocaleString()} min`,
      formula: `${Math.round(ctx.totalCallMinutes).toLocaleString()} min x $${c.usageRates.inboundForwardPerMin}`,
      amount: ctx.totalCallMinutes * c.usageRates.inboundForwardPerMin,
    },
    {
      id: 'sms', label: 'SMS', detail: `${Math.round(sms).toLocaleString()} segments`,
      formula: `${Math.round(sms).toLocaleString()} x $${c.usageRates.smsPerSegment}`,
      amount: sms * c.usageRates.smsPerSegment,
    },
    {
      id: 'email', label: 'Email', detail: `${Math.round(emails).toLocaleString()} sent`,
      formula: `${Math.round(emails).toLocaleString()} / 1000 x $${c.usageRates.emailPer1000}`,
      amount: (emails / 1000) * c.usageRates.emailPer1000,
    },
    {
      id: 'did', label: 'DID Rental',
      detail: `${dids} numbers (${c.dids.perAgent}/agent x ${headcount} + ${c.dids.additional} extra)`,
      formula: `${dids} x ${money2(c.usageRates.didRentalPerMonth)}`,
      amount: dids * c.usageRates.didRentalPerMonth,
    },
  ];
  groups.push({
    id: 'usage', label: 'Usage Rates (calls, SMS, email)',
    note: 'Krest Marketing App — scales with call volume',
    lines: usageLines, subtotal: usageLines.reduce((s, l) => s + l.amount, 0),
  });

  // 4 — Trackdrive
  const tier = resolveTrackdriveTier(ctx.totalCallMinutes, c.trackdriveTiers);
  const tdLines = [
    {
      id: 'td-in', label: 'Inbound routing', detail: `Tier "${tier.key}"`,
      formula: `${Math.round(ctx.totalCallMinutes).toLocaleString()} min x $${tier.inbound}`,
      amount: ctx.totalCallMinutes * tier.inbound,
    },
    {
      id: 'td-out', label: 'Outbound routing', detail: 'Negotiated flat rate',
      formula: `${Math.round(ctx.totalCallMinutes).toLocaleString()} min x $${c.trackdriveOutboundPerMin}`,
      amount: ctx.totalCallMinutes * c.trackdriveOutboundPerMin,
    },
    {
      id: 'td-did', label: 'DID rental at tier', detail: `${dids} numbers`,
      formula: `${dids} x ${money2(tier.did)}`,
      amount: dids * tier.did,
    },
  ];
  groups.push({
    id: 'trackdrive', label: 'Trackdrive (call routing)',
    note: `Tier "${tier.key}" — resolved automatically from ${Math.round(ctx.totalCallMinutes).toLocaleString()} call minutes`,
    lines: tdLines, subtotal: tdLines.reduce((s, l) => s + l.amount, 0),
  });

  // 5 — Transfer acquisition (FIX: previously deducted from cash but shown nowhere)
  const blended = blendedTransferCost(inputs);
  const openerCovered = ctx.totalTransfers - ctx.purchasedTransfers;
  const transferLines = [
    {
      id: 'tx-buy', label: 'Purchased billed transfers',
      detail: `${Math.round(ctx.purchasedTransfers).toLocaleString()} billed transfers x ${money2(blended)} blended`,
      formula: `${Math.round(ctx.purchasedTransfers).toLocaleString()} x ${money2(blended)}`,
      amount: ctx.transferCost,
    },
  ];
  if (openerCovered > 0.5) {
    transferLines.push({
      id: 'tx-opener', label: 'Covered in-house by openers',
      detail: `${Math.round(openerCovered).toLocaleString()} transfers produced by opener hours — cost sits in Labor, not here`,
      formula: `avoided: ${Math.round(openerCovered).toLocaleString()} x ${money2(blended)} = ${money(openerCovered * blended)}`,
      amount: 0,
    });
  }
  groups.push({
    id: 'transfers', label: 'Transfer Acquisition',
    note: `Blended ${money2(blended)} per BILLED transfer. Transfers that drop before the buffer are never invoiced.`,
    lines: transferLines, subtotal: transferLines.reduce((s, l) => s + l.amount, 0),
  });

  // 6 — Soft credit pulls
  //
  // Underwriting cost, not a marketing cost: a soft pull is run on every billed
  // qualified transfer so the file can be scored before a program is quoted. It
  // is incurred whether or not the call closes.
  const cp = creditPullPolicy(c);
  const pulls = creditPullCount(c, ctx.totalTransfers);
  const shares = creditPullShares(inputs);
  const blendedPull = blendedCreditPullPrice(inputs);
  const pullSpendByBackend = {} as Record<BackendKey, number>;
  const creditLines = BACKEND_KEYS.map((k) => {
    const n = pulls * shares[k];
    const price = cp.pricePerPullByBackend[k];
    pullSpendByBackend[k] = n * price;
    const flag = CREDIT_PULL_UNCONFIRMED[k] ? ` — ${CREDIT_PULL_UNCONFIRMED[k]}` : '';
    return {
      id: `cp-${k.toLowerCase()}`, label: `Soft credit pulls — ${PULL_BACKEND_LABEL[k]}`,
      detail: cp.enabled
        ? `${Math.round(n).toLocaleString()} pulls x ${money2(price)}${flag}`
        : 'Disabled — no pull cost is being charged to the model',
      formula: `${Math.round(ctx.totalTransfers).toLocaleString()} billed transfers x ${cp.pullsPerBilledTransfer} x ${(shares[k] * 100).toFixed(1)}% volume x ${money2(price)}`,
      amount: n * price,
    };
  });
  const pullSpend = creditLines.reduce((s, l) => s + l.amount, 0);
  if (cp.enabled && (ctx.deals ?? 0) > 0.01) {
    creditLines.push({
      id: 'cp-perdeal', label: 'Cost per closed deal',
      detail: `${money2(pullSpend / (ctx.deals ?? 1))} of pull cost per deal that actually closed — the rest was spent on files that did not`,
      formula: `${money(pullSpend)} / ${Math.round(ctx.deals ?? 0).toLocaleString()} deals`,
      amount: 0,
    });
  }
  groups.push({
    id: 'creditpulls', label: 'Credit Pulls (soft)',
    note: `Priced by backend — Level Debt (Forth/Spinwheel) ${money2(cp.pricePerPullByBackend.LEVEL)}, Elite Legal Practice ${money2(cp.pricePerPullByBackend.LEGACY)}, Consumer Shield ${money2(cp.pricePerPullByBackend.CS)} (unconfirmed — Adam Robles); ${money2(blendedPull)} blended on the volume split. One pull on every billed qualified transfer. Duds never reach a pull — they disconnect before the buffer and are never invoiced.`,
    lines: creditLines, subtotal: creditLines.reduce((s, l) => s + l.amount, 0),
  });

  // 7 — Labor
  const laborLines = ctx.roster.active.map((e) => ({
    id: e.employee.id,
    label: `${e.employee.name}${e.employee.commissionOnly ? ' (commission-only)' : ''}`,
    detail: `${e.employee.type === 'inhouse' ? 'In-House' : 'BPO'} ${e.employee.role} · ${e.weeklyPaidHours.toFixed(1)} hrs/wk @ ${money2(e.employee.commissionOnly ? 0 : e.employee.hourlyRate)}/hr${e.otHoursPerWeek > 0 ? ` (+${e.otHoursPerWeek.toFixed(1)} OT)` : ''}`,
    formula: e.otHoursPerWeek > 0
      ? `(${e.regularHoursPerWeek.toFixed(1)} x ${money2(e.employee.hourlyRate)} + ${e.otHoursPerWeek.toFixed(1)} x ${money2(e.employee.hourlyRate)} x ${inputs.laborPolicy.otMultiplier}) x ${inputs.laborPolicy.weeksPerMonth.toFixed(4)}`
      : `${e.regularHoursPerWeek.toFixed(1)} x ${money2(e.employee.commissionOnly ? 0 : e.employee.hourlyRate)} x ${inputs.laborPolicy.weeksPerMonth.toFixed(4)}`,
    amount: e.monthlyCost,
  }));
  groups.push({
    id: 'labor', label: 'Labor',
    note: 'Per person: paid hours x rate, with 1.5x above 40 hrs/wk for In-House/CA staff',
    lines: laborLines, subtotal: laborLines.reduce((s, l) => s + l.amount, 0),
  });

  return {
    groups,
    total: groups.reduce((s, g) => s + g.subtotal, 0),
    trackdriveTierKey: tier.key,
    totalCallMinutes: ctx.totalCallMinutes,
    totalSmsSegments: sms,
    totalEmails: emails,
    didCount: dids,
    creditPullCount: pulls,
    creditPullSpendByBackend: pullSpendByBackend,
    headcount,
  };
}
