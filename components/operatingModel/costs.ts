import type {
  CostBreakdownGroup, CostInputs, ModelInputs, MonthlyCostBreakdown, TrackdriveTier,
} from './types';
import type { RosterMonthSummary } from './labor';

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

/** Defaults for the credit-pull policy, so an older saved input shape still runs. */
export const CREDIT_PULL_FALLBACK = { enabled: true, pricePerPull: 2.5, pullsPerBilledTransfer: 1 };

export function creditPullPolicy(costs: CostInputs) {
  return costs.creditPulls ?? CREDIT_PULL_FALLBACK;
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
  const pullSpend = pulls * cp.pricePerPull;
  const creditLines = [
    {
      id: 'cp-soft', label: 'Soft credit pulls',
      detail: cp.enabled
        ? `${Math.round(pulls).toLocaleString()} pulls x ${money2(cp.pricePerPull)} — ${cp.pullsPerBilledTransfer} per billed transfer`
        : 'Disabled — no pull cost is being charged to the model',
      formula: `${Math.round(ctx.totalTransfers).toLocaleString()} billed transfers x ${cp.pullsPerBilledTransfer} x ${money2(cp.pricePerPull)}`,
      amount: pullSpend,
    },
  ];
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
    note: `${money2(cp.pricePerPull)} per soft pull, one on every billed qualified transfer. Duds never reach a pull — they disconnect before the buffer and are never invoiced.`,
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
    headcount,
  };
}
