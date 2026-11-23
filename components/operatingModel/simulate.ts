import type {
  BackendKey, CapacityDetail, Employee, EmployeeCost, HiringEvent, ModelInputs,
  ModelResults, MonthRow, PartnerMonthDetail, PartnerRollup,
} from './types';
import { BACKEND_KEYS } from './types';
import { BRANDS, makeEmployee } from './config';
import { computeEmployeeCost, summariseRosterForMonth } from './labor';
import {
  agentCommissionForDeal, agentPayoutMonth, buildSurvivalCurve, isPerpetuity,
  maxRevenueMonth, revenueForDealMonth, revenueModelLabel, tierRate, shield,
} from './backends';
import { resolveMarketingMonth } from './marketing';
import { buildMonthlyCosts } from './costs';
import { computeFunnel, blendedCloseRateOnBilled } from './funnel';
import { computeBonuses } from './bonuses';

/** Split a total into integer parts by percentage, preserving the total. */
function allocate(total: number, pcts: Record<BackendKey, number>): Record<BackendKey, number> {
  const sumPct = BACKEND_KEYS.reduce((s, k) => s + (pcts[k] || 0), 0) || 1;
  const raw = BACKEND_KEYS.map((k) => ({ k, v: (total * (pcts[k] || 0)) / sumPct }));
  const floors = raw.map((r) => ({ ...r, f: Math.floor(r.v), rem: r.v - Math.floor(r.v) }));
  let remaining = Math.round(total) - floors.reduce((s, r) => s + r.f, 0);
  floors.sort((a, b) => b.rem - a.rem);
  const out = {} as Record<BackendKey, number>;
  floors.forEach((r) => { out[r.k] = r.f; });
  for (const r of floors) { if (remaining <= 0) break; out[r.k] += 1; remaining -= 1; }
  return out;
}

interface Cohort {
  backendKey: BackendKey;
  startMonth: number;
  dealCount: number;
  avgDebt: number;
  /**
   * Draw-system scenario only: the rate resolved at ORIGINATION from that
   * month's combined cross-program rep volume, locked in like avgDebt so a
   * headcount change before payout can't retroactively re-tier a deal that
   * already closed. Applies uniformly to whichever backend this cohort is —
   * Level Debt, Consumer Shield, or Legacy Capital all use the same resolved
   * rate in draw mode. Undefined for the BPO-attributed share of a cohort
   * (always contract-priced) or in contract mode generally.
   */
  repDrawRate?: number;
  /**
   * Ramp/probation scenario only: the deal-month this cohort's commission is
   * earned at, overriding the backend's normal agentPayoutMonth. Set when
   * this slice of the cohort was produced by a US-based closer still inside
   * their ramp window at origination — locked in at origination like avgDebt,
   * so a later hire/fire or the rep's own ramp ending doesn't retroactively
   * change already-closed deals.
   */
  payoutDealMonthOverride?: number;
  /**
   * Deals closed by the owner-operator (paid through the distribution
   * agreement) or by hourly offshore / BPO closers (hourly only). No % of
   * enrolled debt, no flat per-deal commission, no bonuses — this slice of a
   * cohort carries no rep commission at payout.
   */
  noCommission?: boolean;
  /** Shield files only: buyout share for this cohort (launch-period election). */
  buyoutSharePct?: number;
}

export function computeCapacity(
  inputs: ModelInputs,
  closerHoursAll: number,
  openerHours: number,
  rampFactor: number,
  marketing?: { callMinutes: number; deals: number; handledCalls: number },
): CapacityDetail {
  const ops = inputs.operations;
  // Inbound marketing calls are handled first; the transfer funnel below is
  // derived from whatever closer time is left.
  const mkMinutes = marketing?.callMinutes ?? 0;
  const closerHours = Math.max(0, closerHoursAll - mkMinutes / 60);
  // The capacity model works in BILLED transfers, because those are the calls a
  // closer actually spends handle time on.
  const closeRate = blendedCloseRateOnBilled(inputs);

  // Rule the business runs on: 1.0-1.5 deals per 8 paid closer hours.
  const ruleCapacityDeals = (closerHours / 8) * inputs.volume.dealsPer8CloserHours;

  // Physical ceiling: talk time available / handle time, converted at close rate.
  const availableCallMinutes = closerHours * 60;
  const talkTimeCapacityDeals = ops.avgHandleMinutes > 0
    ? (availableCallMinutes / ops.avgHandleMinutes) * closeRate
    : 0;

  let fullTarget: number;
  let bindingConstraint: CapacityDetail['bindingConstraint'];
  if (inputs.volume.mode === 'override') {
    fullTarget = inputs.volume.overrideTotalDealsPerMonth;
    bindingConstraint = 'override';
  } else if (ops.capDealsAtCapacity && talkTimeCapacityDeals < ruleCapacityDeals) {
    fullTarget = talkTimeCapacityDeals;
    bindingConstraint = 'talk-time';
  } else {
    fullTarget = ruleCapacityDeals;
    bindingConstraint = 'rule';
  }

  let targetDeals = fullTarget * rampFactor;
  const ruleDemandMinutes = closeRate > 0
    ? ((ruleCapacityDeals * rampFactor) / closeRate) * ops.avgHandleMinutes : 0;
  let totalTransfers = closeRate > 0 ? targetDeals / closeRate : 0;
  const openerRawSupply = openerHours * ops.openerTransfersPerHour;
  let openerSuppliedTransfers = Math.min(totalTransfers, openerRawSupply);
  let purchasedTransfers = Math.max(0, totalTransfers - openerSuppliedTransfers);

  // Transfer budget: when it binds, buy only what it affords and let the
  // target fall with it. Opener-supplied transfers are free of the budget.
  const budget = ops.transferBudgetPerMonth ?? 0;
  if (budget > 0 && purchasedTransfers > 0) {
    const mixTotal = ops.buffers.reduce((s, b) => s + b.mixPct, 0) || 100;
    const blendedPrice = ops.buffers.reduce((s, b) => s + b.price * b.mixPct, 0) / mixTotal;
    const affordable = blendedPrice > 0 ? budget / blendedPrice : purchasedTransfers;
    if (affordable < purchasedTransfers) {
      purchasedTransfers = affordable;
      totalTransfers = openerSuppliedTransfers + purchasedTransfers;
      targetDeals = totalTransfers * closeRate;
      bindingConstraint = 'budget';
    }
  }
  const requiredCallMinutes = totalTransfers * ops.avgHandleMinutes;

  const allMinutes = closerHoursAll * 60;
  return {
    closerHours: closerHoursAll, openerHours, paidHours: closerHoursAll + openerHours,
    ruleCapacityDeals, talkTimeCapacityDeals, bindingConstraint,
    targetDeals,
    // Utilisation counts marketing minutes too — they are real closer time.
    utilizationPct: allMinutes > 0 ? ((requiredCallMinutes + mkMinutes) / allMinutes) * 100 : 0,
    ruleUtilizationPct: allMinutes > 0 ? ((ruleDemandMinutes + mkMinutes) / allMinutes) * 100 : 0,
    requiredCallMinutes: requiredCallMinutes + mkMinutes, availableCallMinutes: allMinutes,
    openerRawSupply, openerSuppliedTransfers, purchasedTransfers, totalTransfers,
    marketingCallsHandled: marketing?.handledCalls ?? 0,
    marketingDeals: marketing?.deals ?? 0,
  };
}

export function runModel(inputs: ModelInputs): ModelResults {
  const horizon = Math.max(1, Math.round(inputs.ramp.horizonMonths));
  const rampMonths = Math.max(1, Math.round(inputs.ramp.rampMonths));
  const warnings: string[] = [];

  // Survival curves need to reach the longest possible program term.
  const curveLen = Math.max(
    horizon + 6,
    ...BACKEND_KEYS.map((k) => maxRevenueMonth(k, inputs.volume.avgDebt[k], inputs) + 1),
  );
  const survival: Record<BackendKey, number[]> = {
    LEVEL: buildSurvivalCurve(inputs.survivalCurves.LEVEL, curveLen),
    CS: buildSurvivalCurve(inputs.survivalCurves.CS, curveLen),
    LEGACY: buildSurvivalCurve(inputs.survivalCurves.LEGACY, curveLen),
  };

  const roster: Employee[] = inputs.roster.map((e) => ({ ...e }));
  const cohorts: Cohort[] = [];
  const months: MonthRow[] = [];
  const hiringEvents: HiringEvent[] = [];

  const rollup: Record<BackendKey, PartnerRollup> = {} as any;
  BACKEND_KEYS.forEach((k) => {
    rollup[k] = {
      key: k, dealsSubmitted: 0, avgDebt: inputs.volume.avgDebt[k], enrolledVolume: 0,
      revenue: 0, repCommission: 0, netRevenue: 0,
      revenueModel: revenueModelLabel(k, inputs.volume.avgDebt[k], inputs),
      perpetuity: isPerpetuity(k, inputs),
    };
  });

  let cash = 0;
  let peakCapital = 0;
  let firstCashPositive: number | null = null;
  const startingCash = inputs.startingCash ?? 0;
  // Tax resolution: cash arriving per simulation month, scheduled as deals close.
  const tax = inputs.taxResolution;
  const taxOn = !!(tax && tax.enabled && tax.attachPct > 0);
  const taxRevenueByMonth: number[] = new Array(horizon + 64).fill(0);
  const taxP1ByMonth: number[] = new Array(horizon + 64).fill(0);
  const taxP2ByMonth: number[] = new Array(horizon + 64).fill(0);
  let cashOutMonth: number | null = null;
  let lowestCash = startingCash;
  let reserveFirstMet: number | null = null;
  let peakUtilization = 0;
  let sustainedHighUtil = 0;
  let pendingHireMonth: number | null = null;
  const startingSeatCount = roster.filter((e) => e.startMonth <= 1).length;
  const disputeRate = inputs.reservePolicy.disputeRatePct / 100;
  const trailingCommission12mo: number[] = [];
  // Compensation earned on a month's production but paid with a later payroll.
  const overrideDue = new Map<number, number>();
  const bonusDue = new Map<number, number>();

  // Mail/social are meant to fill occupancy: target 25% of volume, never above 50%.

  let maxMarketingShare = 0;

  for (let m = 1; m <= horizon; m++) {
    // ── Materialise an auto-hire that came due this month ────────────────────
    if (pendingHireMonth != null && m >= pendingHireMonth) {
      for (let i = 0; i < inputs.hiringPolicy.seatsAddedPerHire; i++) {
        const seatNo = roster.length + 1;
        roster.push(makeEmployee({
          ...inputs.hiringPolicy.template,
          name: `Closer ${seatNo} — auto-hire (mo ${m})`,
          startMonth: m,
          endMonth: null,
        }));
      }
      hiringEvents.push({
        month: m, seatsAfter: roster.filter((e) => e.startMonth <= m).length,
        label: `Hire → ${roster.filter((e) => e.startMonth <= m).length} seats`,
      });
      pendingHireMonth = null;
    }

    const employeeCosts: EmployeeCost[] = roster.map((e) => computeEmployeeCost(e, inputs.laborPolicy));
    const rosterMonth = summariseRosterForMonth(employeeCosts, m);

    // ── Volume ───────────────────────────────────────────────────────────────
    const launchFactors = inputs.ramp.launchFactors ?? [];
    const rampFactor = m <= launchFactors.length ? Math.max(0, Math.min(1, launchFactors[m - 1])) : Math.min(1, m / rampMonths);
    // Growth marketing: inbound calls take closer time first, then transfers.
    const marketing = resolveMarketingMonth(inputs, m, rosterMonth.closerHours * 60);
    const capacity = computeCapacity(inputs, rosterMonth.closerHours, rosterMonth.openerHours, rampFactor, marketing);
    // Learning curve: more deals from the same calls as closers improve.
    const lc = inputs.volume.learningCurve;
    if (lc && lc.enabled && m >= lc.startMonth) {
      const gain = Math.min(lc.maxGainPct, lc.gainPctPerMonth * (m - lc.startMonth + 1)) / 100;
      capacity.targetDeals *= 1 + gain;
    }
    const launch = inputs.volume.launchMix;
    const inLaunch = !!launch && launch.months > 0 && m <= launch.months;
    const monthMix = inLaunch ? launch!.mixPct : inputs.volume.mixPct;
    const transferDealsByBackend = allocate(capacity.targetDeals, monthMix);
    const marketingDealsByBackend = allocate(marketing.deals, inLaunch ? monthMix : (inputs.marketing.mixPct ?? inputs.volume.mixPct));
    const totalDealsM = capacity.targetDeals + marketing.deals;
    if (totalDealsM > 0) maxMarketingShare = Math.max(maxMarketingShare, marketing.deals / totalDealsM);
    const dealsByBackend = {} as Record<BackendKey, number>;
    // Average enrolled debt this month blends transfer deals (base assumption)
    // with marketing deals (the channel's own, typically larger, debt load).
    const avgDebtM = {} as Record<BackendKey, number>;
    const mkAvgDebt = marketing.deals > 0 ? marketing.enrolledVolume / marketing.deals : 0;
    BACKEND_KEYS.forEach((k) => {
      const tx = transferDealsByBackend[k];
      const mk = marketingDealsByBackend[k];
      dealsByBackend[k] = tx + mk;
      avgDebtM[k] = tx + mk > 0
        ? (tx * inputs.volume.avgDebt[k] + mk * mkAvgDebt) / (tx + mk)
        : inputs.volume.avgDebt[k];
    });
    const totalDeals = BACKEND_KEYS.reduce((s, k) => s + dealsByBackend[k], 0);

    // In the draw scenario, one rate is resolved per month from each US-based
    // rep's COMBINED enrolled volume across all three programs, then locked
    // onto every US-attributed cohort created this month regardless of
    // backend — a rep who diversifies into Shield/Legacy raises the volume
    // that also lifts their Level Debt rate. BPO/overseas closer hours (if
    // any — the default roster has none) are excluded from this population
    // and always price on the contract schedule; their share of each
    // backend's deals is split off by closer-hour share, the same technique
    // used for manager overrides below.
    // Commission-eligible closers are US W-2 staff only (in-house closers and
    // managers who close). The owner-operator is paid through the members'
    // distribution agreement — no commission, no bonus — and offshore / BPO
    // closers are hourly only, so both groups' deals carry no rep commission.
    const usClosers = rosterMonth.closers.filter((c) => c.employee.type === 'inhouse' || c.employee.type === 'manager');
    const bpoClosers = rosterMonth.closers.filter((c) => c.employee.type === 'bpo' || c.employee.type === 'owner');
    const usCloserHours = usClosers.reduce((s, c) => s + c.monthlyCloserHours, 0);
    const bpoCloserHours = bpoClosers.reduce((s, c) => s + c.monthlyCloserHours, 0);
    const totalDrawEligibleHours = usCloserHours + bpoCloserHours;
    const usShare = totalDrawEligibleHours > 0 ? usCloserHours / totalDrawEligibleHours : 1;

    let repDrawRate: number | undefined;
    let usRampShare = 0; // share of US closer HOURS still inside their ramp window this month
    if (inputs.repPay.mode === 'draw') {
      const repCount = Math.max(1, usClosers.length);
      const combinedEnrolled = BACKEND_KEYS.reduce(
        (s, k) => s + dealsByBackend[k] * avgDebtM[k], 0,
      );
      const perRepCombinedEnrolled = (combinedEnrolled * usShare) / repCount;
      repDrawRate = tierRate(perRepCombinedEnrolled, inputs.repPay.drawTiers);

      if (inputs.repPay.ramp.enabled && usCloserHours > 0) {
        const rampHours = usClosers
          .filter((c) => m - c.employee.startMonth < inputs.repPay.ramp.rampMonths)
          .reduce((s, c) => s + c.monthlyCloserHours, 0);
        usRampShare = rampHours / usCloserHours;
      }
    }

    BACKEND_KEYS.forEach((k) => {
      if (dealsByBackend[k] <= 0) {
        rollup[k].dealsSubmitted += dealsByBackend[k];
        rollup[k].enrolledVolume += dealsByBackend[k] * avgDebtM[k];
        return;
      }
      if (inputs.repPay.mode === 'draw') {
        // US-attributed share, split again into ramping vs tenured so ramping
        // reps' deals carry the probation payout-month override while
        // tenured reps' deals use the backend's normal schedule.
        const usDealCount = dealsByBackend[k] * usShare;
        const rampDealCount = usDealCount * usRampShare;
        const tenuredDealCount = usDealCount - rampDealCount;
        const bpoDealCount = dealsByBackend[k] - usDealCount;

        if (rampDealCount > 0) {
          cohorts.push({
            backendKey: k, startMonth: m, dealCount: rampDealCount,
            avgDebt: avgDebtM[k], repDrawRate,
            payoutDealMonthOverride: inputs.repPay.ramp.probationPayoutDealMonth,
          });
        }
        if (tenuredDealCount > 0) {
          cohorts.push({
            backendKey: k, startMonth: m, dealCount: tenuredDealCount,
            avgDebt: avgDebtM[k], repDrawRate,
          });
        }
        if (bpoDealCount > 0) {
          // Offshore / BPO closers are hourly only: no commission on their deals.
          cohorts.push({
            backendKey: k, startMonth: m, dealCount: bpoDealCount,
            avgDebt: avgDebtM[k], noCommission: true,
          });
        }
      } else {
        const usDealCount = dealsByBackend[k] * usShare;
        const bpoDealCount = dealsByBackend[k] - usDealCount;
        if (bpoDealCount > 0) {
          cohorts.push({
            backendKey: k, startMonth: m, dealCount: bpoDealCount,
            avgDebt: avgDebtM[k], noCommission: true,
          });
        }
        if (usDealCount > 0) cohorts.push({
          backendKey: k, startMonth: m, dealCount: usDealCount,
          avgDebt: avgDebtM[k],
        });
      }
      if (k === 'CS' && inLaunch && launch!.buyoutSharePct != null) {
        for (const c of cohorts) if (c.backendKey === 'CS' && c.startMonth === m) c.buyoutSharePct = launch!.buyoutSharePct;
      }
      rollup[k].dealsSubmitted += dealsByBackend[k];
      rollup[k].enrolledVolume += dealsByBackend[k] * avgDebtM[k];
    });

    // ── Revenue & commission from every live cohort ──────────────────────────
    let revenue = 0;
    let commission = 0;
    const partnerDetail: Record<BackendKey, PartnerMonthDetail> = {} as any;
    BACKEND_KEYS.forEach((k) => {
      partnerDetail[k] = {
        key: k, dealsSubmitted: dealsByBackend[k], activeDeals: 0, revenue: 0, repCommission: 0,
      };
    });

    for (const cohort of cohorts) {
      const lag = inputs.remittanceLag[cohort.backendKey];
      // Deal-month whose client payment is being remitted to Funding Tier now.
      const dealMonth = m - cohort.startMonth + 1 - lag;

      const surviving = dealMonth >= 1 ? (survival[cohort.backendKey][dealMonth] ?? 0) * cohort.dealCount : 0;
      const perDeal = dealMonth < 1 ? 0
        : cohort.backendKey === 'CS' && cohort.buyoutSharePct != null
          ? shield.revenueForDealMonth(cohort.avgDebt, dealMonth, { ...inputs.consumerShield, buyoutSharePct: cohort.buyoutSharePct })
          : revenueForDealMonth(cohort.backendKey, cohort.avgDebt, dealMonth, inputs);
      if (perDeal > 0) {
        const gross = surviving * perDeal;
        revenue += gross;
        partnerDetail[cohort.backendKey].revenue += gross;
        partnerDetail[cohort.backendKey].activeDeals += surviving;
        rollup[cohort.backendKey].revenue += gross;
      }

      // Rep commission — paid when the backend pays us, not at signing.
      // agentPayoutMonth already encodes the arrears timing (e.g. "by the 15th
      // of the following month"), so it is measured WITHOUT the remittance lag.
      const unlaggedDealMonth = m - cohort.startMonth + 1;
      const payoutDealMonth = cohort.payoutDealMonthOverride ?? agentPayoutMonth(cohort.backendKey, inputs);
      if (unlaggedDealMonth === payoutDealMonth && !cohort.noCommission) {
        const survivingAtPayout = (survival[cohort.backendKey][unlaggedDealMonth] ?? 0) * cohort.dealCount;
        const monthlyEnrolled = cohort.dealCount * cohort.avgDebt;
        const perDealComm = cohort.repDrawRate != null
          ? cohort.avgDebt * cohort.repDrawRate
          : agentCommissionForDeal(cohort.backendKey, cohort.avgDebt, monthlyEnrolled, inputs);
        const amount = survivingAtPayout * perDealComm;
        commission += amount;
        partnerDetail[cohort.backendKey].repCommission += amount;
        rollup[cohort.backendKey].repCommission += amount;
      }
    }

    // ── Tax resolution layer (sold on the same calls) ────────────────────────
    let taxRow = { phase1Deals: 0, phase2Deals: 0, revenue: 0, repCommission: 0 };
    if (taxOn && tax && m >= (tax.startMonth ?? 1)) {
      const p1 = totalDeals * (tax.attachPct / 100);
      const p2 = p1 * (tax.phase2ConversionPct / 100);
      const keep = 1 - tax.refundPct / 100;
      const p1Cash = p1 * tax.phase1Fee * (tax.phase1SharePct / 100) * keep;
      const p2Cash = p2 * tax.phase2Fee * (tax.phase2SharePct / 100) * keep;
      const m1 = m + Math.max(0, tax.phase1LagMonths);
      if (m1 < taxRevenueByMonth.length) { taxRevenueByMonth[m1] += p1Cash; taxP1ByMonth[m1] += p1; }
      const n = Math.max(1, Math.round(tax.phase2InstallmentMonths));
      for (let i = 0; i < n; i++) {
        const mi = m + Math.max(0, tax.phase1LagMonths) + Math.max(0, tax.phase2LagMonths) + i;
        if (mi < taxRevenueByMonth.length) { taxRevenueByMonth[mi] += p2Cash / n; if (i === 0) taxP2ByMonth[mi] += p2; }
      }
      const taxRev = taxRevenueByMonth[m];
      // Tax commission is owed only on the US W-2 closers' share of calls (owner / offshore earn none).
      const taxComm = taxRev * (tax.repCommissionPct / 100) * usShare;
      taxRow = { phase1Deals: taxP1ByMonth[m], phase2Deals: taxP2ByMonth[m], revenue: taxRev, repCommission: taxComm };
      revenue += taxRev;
      commission += taxComm;
    }

    // ── Transfer funnel ──────────────────────────────────────────────────────
    const funnel = computeFunnel(inputs, capacity.targetDeals, capacity.openerSuppliedTransfers);

    // ── Manager / owner overrides on their team's closed deals ───────────────
    let overrideAccrued = 0;
    if (inputs.overridePolicy.enabled) {
      const totalCloserHours = rosterMonth.closerHours;
      const enrolledThisMonth = BACKEND_KEYS.reduce(
        (s, k) => s + dealsByBackend[k] * avgDebtM[k], 0,
      );
      for (const mgr of rosterMonth.managers) {
        if (mgr.employee.overridePct <= 0) continue;
        const team = rosterMonth.active.filter(
          (c) => c.employee.teamId === mgr.employee.teamId
            && c.monthlyCloserHours > 0
            && (inputs.overridePolicy.includeOwnDeals || c.employee.id !== mgr.employee.id),
        );
        const teamHours = team.reduce((s, c) => s + c.monthlyCloserHours, 0);
        const share = totalCloserHours > 0 ? teamHours / totalCloserHours : 0;
        let base = 0;
        if (inputs.overridePolicy.base === 'enrolledVolume') base = enrolledThisMonth * share;
        else if (inputs.overridePolicy.base === 'repCommission') base = commission * share;
        else base = revenue * share;
        overrideAccrued += base * (mgr.employee.overridePct / 100);
      }
    }

    // ── Bonuses and spiffs ───────────────────────────────────────────────────
    // Bonuses and SPIFFs apply to US W-2 closers only; the owner-operator is
    // on the distribution agreement and offshore / BPO closers are hourly.
    const bonuses = computeBonuses(inputs, {
      dealsByBackend: { LEVEL: dealsByBackend.LEVEL * usShare, CS: dealsByBackend.CS * usShare, LEGACY: dealsByBackend.LEGACY * usShare },
      avgDebt: inputs.volume.avgDebt,
      closers: usClosers,
    });

    // Compensation is paid in arrears, exactly like backend-driven commission —
    // which is why month 1 carries no commission, no override and no bonus.
    const oLag = Math.max(0, Math.round(inputs.overridePolicy.payoutLagMonths));
    overrideDue.set(m + oLag, (overrideDue.get(m + oLag) ?? 0) + overrideAccrued);
    const managerOverride = overrideDue.get(m) ?? 0;

    const bLag = Math.max(0, Math.round(inputs.bonusPolicy.payoutLagMonths));
    bonusDue.set(m + bLag, (bonusDue.get(m + bLag) ?? 0) + bonuses.paid);
    const bonusPaid = bonusDue.get(m) ?? 0;

    // ── Cost ledger ──────────────────────────────────────────────────────────
    const costs = buildMonthlyCosts(inputs, {
      totalTransfers: funnel.billedTransfers,
      purchasedTransfers: funnel.billedTransfers - capacity.openerSuppliedTransfers,
      totalCallMinutes: capacity.requiredCallMinutes,
      transferCost: funnel.totalCost,
      deals: totalDeals,
      dealsByBackend,
      roster: rosterMonth,
      marketing,
      month: m,
    });
    const overhead = costs.total;
    const marketingCost = costs.groups.find((g) => g.id === 'marketing')?.subtotal ?? 0;
    const transferCost = costs.groups.find((g) => g.id === 'transfers')?.subtotal ?? 0;
    const laborCost = costs.groups.find((g) => g.id === 'labor')?.subtotal ?? 0;

    const netCashFlow = revenue - commission - managerOverride - bonusPaid - overhead;
    cash += netCashFlow;
    if (cash < peakCapital) peakCapital = cash;
    if (firstCashPositive == null && cash > 0) firstCashPositive = m;
    const bank = startingCash + cash;
    if (bank < lowestCash) lowestCash = bank;
    if (cashOutMonth == null && bank < 0) cashOutMonth = m;

    // Reserve = months of overhead, plus a chargeback buffer sized off the
    // trailing 12 months of commission actually paid out. Matches the shared
    // engine's definition exactly.
    trailingCommission12mo.push(commission);
    if (trailingCommission12mo.length > 12) trailingCommission12mo.shift();
    const disputeBuffer = trailingCommission12mo.reduce((a, b) => a + b, 0) * disputeRate;
    const reserveTarget = overhead * inputs.reservePolicy.targetMonthsOfOverhead + disputeBuffer;
    const reserveMet = startingCash + cash >= reserveTarget;
    if (reserveMet && reserveFirstMet == null) reserveFirstMet = m;

    const seats = rosterMonth.headcount;
    const util = capacity.utilizationPct;
    if (util > peakUtilization) peakUtilization = util;

    // ── Hiring policy ────────────────────────────────────────────────────────
    let event = hiringEvents.find((h) => h.month === m)?.label ?? '';
    if (inputs.hiringPolicy.enabled) {
      sustainedHighUtil = util >= inputs.hiringPolicy.utilizationThresholdPct ? sustainedHighUtil + 1 : 0;
      const capOk = inputs.hiringPolicy.maxSeats === 0 || seats < inputs.hiringPolicy.maxSeats;
      if (
        pendingHireMonth == null && capOk && reserveMet &&
        sustainedHighUtil >= inputs.hiringPolicy.sustainMonths
      ) {
        pendingHireMonth = m + inputs.hiringPolicy.hireLagMonths;
        sustainedHighUtil = 0;
        event = event || `Hire approved → seat lands month ${pendingHireMonth}`;
      }
    }

    months.push({
      month: m,
      deals: totalDeals,
      dealsByBackend,
      revenue, repCommission: commission,
      tax: taxRow,
      managerOverride, managerOverrideAccrued: overrideAccrued,
      bonuses, bonusPaid,
      overhead, transferCost, laborCost, marketingCost, marketing,
      netCashFlow, cashPosition: startingCash + cash, cumulativeNet: cash,
      reserveTarget, reserveMet,
      seats, utilizationPct: util,
      event,
      notes: buildNote(m, inputs, revenue, commission, capacity, reserveMet, months[months.length - 1]),
      capacity, funnel, costs,
      partners: BACKEND_KEYS.map((k) => partnerDetail[k]),
    });
  }

  BACKEND_KEYS.forEach((k) => { rollup[k].netRevenue = rollup[k].revenue - rollup[k].repCommission; });

  const totals = {
    revenue: months.reduce((s, r) => s + r.revenue, 0),
    repCommission: months.reduce((s, r) => s + r.repCommission, 0),
    managerOverride: months.reduce((s, r) => s + r.managerOverride, 0),
    bonuses: months.reduce((s, r) => s + r.bonusPaid, 0),
    overhead: months.reduce((s, r) => s + r.overhead, 0),
    transferCost: months.reduce((s, r) => s + r.transferCost, 0),
    laborCost: months.reduce((s, r) => s + r.laborCost, 0),
    marketingCost: months.reduce((s, r) => s + r.marketingCost, 0),
    marketingDeals: months.reduce((s, r) => s + r.marketing.deals, 0),
    marketingEnrolledVolume: months.reduce((s, r) => s + r.marketing.enrolledVolume, 0),
    finalCash: startingCash + cash,
    distributableAboveReserve: Math.max(0, startingCash + cash - (months[months.length - 1]?.reserveTarget ?? 0)),
    firstCashPositiveMonth: firstCashPositive,
    peakCapitalRequired: Math.abs(Math.min(0, peakCapital)),
    cashOutMonth,
    lowestCash,
    reserveTargetFirstMet: reserveFirstMet,
    finalSeatCount: months[months.length - 1]?.seats ?? 0,
    startingSeatCount,
    peakUtilizationPct: peakUtilization,
    hiringEvents,
  };

  // ── Model-level warnings ───────────────────────────────────────────────────
  const finalEmployeeCosts = roster.map((e) => computeEmployeeCost(e, inputs.laborPolicy));
  finalEmployeeCosts.forEach((e) => warnings.push(...e.warnings));

  const mixTotal = inputs.operations.buffers.reduce((s, b) => s + b.mixPct, 0);
  if (Math.abs(mixTotal - 100) > 0.01) {
    warnings.push(`Transfer buffer mix totals ${mixTotal.toFixed(2)}% — it must total 100%.`);
  }
  if (maxMarketingShare > 0.5) {
    warnings.push(`Mail/social reach ${(maxMarketingShare * 100).toFixed(0)}% of monthly deals — keep them at 25% of volume (target) and never above 50%; add transfers or closers instead.`);
  }
  const mixPctTotal = BACKEND_KEYS.reduce((s, k) => s + inputs.volume.mixPct[k], 0);
  if (Math.abs(mixPctTotal - 100) > 0.01) {
    warnings.push(`Backend volume split totals ${mixPctTotal.toFixed(1)}% — it must total 100%.`);
  }
  const sample = months[months.length - 1];
  if (sample && sample.capacity.bindingConstraint === 'talk-time') {
    warnings.push(
      `Capacity is limited by talk time, not by the deals-per-hour rule: ${inputs.volume.dealsPer8CloserHours} deals per 8 closer hours needs ${(8 * 60 / (inputs.volume.dealsPer8CloserHours / (inputs.operations.closeRatePct / 100))).toFixed(0)} min average handle time, but AHT is set to ${inputs.operations.avgHandleMinutes} min. Deals are capped at ${sample.capacity.talkTimeCapacityDeals.toFixed(1)}/mo instead of ${sample.capacity.ruleCapacityDeals.toFixed(1)}/mo.`,
    );
  }
  if (inputs.volume.mode === 'override') {
    warnings.push('Deal volume is on manual override — it is no longer derived from employed hours.');
  }
  const unanswered = months.reduce((s, r) => s + r.marketing.unansweredCalls, 0);
  if (unanswered > 0.5) {
    const worst = months.reduce((w, r) => (r.marketing.unansweredCalls > w.marketing.unansweredCalls ? r : w), months[0]);
    warnings.push(
      `Marketing is producing more qualified inbound calls than the roster can answer: ${Math.round(unanswered).toLocaleString()} calls went unanswered over the horizon (worst month ${worst.month}: ${Math.round(worst.marketing.unansweredCalls)}). Add closer hours — overtime first, then a seat — or reduce the mail drop.`,
    );
  }

  return {
    months,
    partners: BACKEND_KEYS.map((k) => rollup[k]),
    employeeCosts: finalEmployeeCosts,
    totals,
    warnings,
  };
}

function buildNote(
  m: number, inputs: ModelInputs, revenue: number, commission: number,
  capacity: CapacityDetail, reserveMet: boolean, prev?: MonthRow,
): string {
  const parts: string[] = [];
  if (m === 1) {
    parts.push(
      'No revenue and no commission in month 1 by design. Every backend pays Funding Tier in arrears — ' +
      `${BRANDS.LEVEL.name} remits only after the client's first payment clears, and ` +
      `${BRANDS.CS.name} and ${BRANDS.LEGACY.name} remit the month after each client payment. ` +
      'Month 1 is all cost, no collection.',
    );
  }
  if (m === 2) parts.push('First collections land: month-1 enrollments that survived to their first cleared payment.');
  if (m === inputs.levelDebt.chargebackClearMonths + 1) {
    parts.push(`Month-1 ${BRANDS.LEVEL.name} deals are now clear of chargeback liability.`);
  }
  // Only surface state CHANGES, so the column stays readable instead of
  // repeating the same sentence on every row.
  if (capacity.bindingConstraint === 'talk-time' && prev?.capacity.bindingConstraint !== 'talk-time') {
    parts.push(
      `Volume is capped by available closer talk time rather than the deals-per-hour rule: ${inputs.volume.dealsPer8CloserHours} deals per 8 hrs would need ${((8 * 60 * (inputs.operations.closeRatePct / 100)) / inputs.volume.dealsPer8CloserHours).toFixed(0)} min handle time against the ${inputs.operations.avgHandleMinutes} min set.`,
    );
  }
  if (capacity.utilizationPct > 100 && (prev?.capacity.utilizationPct ?? 0) <= 100) {
    parts.push('Utilization crosses 100% — closers are now oversubscribed.');
  }
  if (reserveMet && !prev?.reserveMet) parts.push('Cash reserve target met for the first time.');
  if (!reserveMet && prev?.reserveMet) parts.push('Cash fell back below the reserve target.');
  
  return parts.join(' ');
}
