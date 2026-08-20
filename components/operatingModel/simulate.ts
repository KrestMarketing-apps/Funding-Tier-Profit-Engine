import type {
  BackendKey, CapacityDetail, Employee, EmployeeCost, HiringEvent, ModelInputs,
  ModelResults, MonthRow, PartnerMonthDetail, PartnerRollup,
} from './types';
import { BACKEND_KEYS } from './types';
import { BRANDS, makeEmployee } from './config';
import { computeEmployeeCost, summariseRosterForMonth } from './labor';
import {
  agentCommissionForDeal, agentPayoutMonth, buildSurvivalCurve, isPerpetuity,
  maxRevenueMonth, revenueForDealMonth, revenueModelLabel,
} from './backends';
import { buildMonthlyCosts } from './costs';

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

interface Cohort { backendKey: BackendKey; startMonth: number; dealCount: number; avgDebt: number }

export function computeCapacity(
  inputs: ModelInputs,
  closerHours: number,
  openerHours: number,
  rampFactor: number,
): CapacityDetail {
  const ops = inputs.operations;
  const closeRate = ops.closeRatePct / 100;

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

  const targetDeals = fullTarget * rampFactor;
  const ruleDemandMinutes = closeRate > 0
    ? ((ruleCapacityDeals * rampFactor) / closeRate) * ops.avgHandleMinutes : 0;
  const totalTransfers = closeRate > 0 ? targetDeals / closeRate : 0;
  const requiredCallMinutes = totalTransfers * ops.avgHandleMinutes;
  const openerRawSupply = openerHours * ops.openerTransfersPerHour;
  const openerSuppliedTransfers = Math.min(totalTransfers, openerRawSupply);
  const purchasedTransfers = Math.max(0, totalTransfers - openerSuppliedTransfers);

  return {
    closerHours, openerHours, paidHours: closerHours + openerHours,
    ruleCapacityDeals, talkTimeCapacityDeals, bindingConstraint,
    targetDeals,
    utilizationPct: availableCallMinutes > 0 ? (requiredCallMinutes / availableCallMinutes) * 100 : 0,
    ruleUtilizationPct: availableCallMinutes > 0 ? (ruleDemandMinutes / availableCallMinutes) * 100 : 0,
    requiredCallMinutes, availableCallMinutes,
    openerRawSupply, openerSuppliedTransfers, purchasedTransfers, totalTransfers,
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
      perpetuity: isPerpetuity(k),
    };
  });

  let cash = 0;
  let peakCapital = 0;
  let firstCashPositive: number | null = null;
  let reserveFirstMet: number | null = null;
  let peakUtilization = 0;
  let sustainedHighUtil = 0;
  let pendingHireMonth: number | null = null;
  const startingSeatCount = roster.filter((e) => e.startMonth <= 1).length;
  const disputeRate = inputs.reservePolicy.disputeRatePct / 100;
  const trailingCommission12mo: number[] = [];

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
    const rampFactor = Math.min(1, m / rampMonths);
    const capacity = computeCapacity(inputs, rosterMonth.closerHours, rosterMonth.openerHours, rampFactor);
    const dealsByBackend = allocate(capacity.targetDeals, inputs.volume.mixPct);
    const totalDeals = BACKEND_KEYS.reduce((s, k) => s + dealsByBackend[k], 0);

    BACKEND_KEYS.forEach((k) => {
      if (dealsByBackend[k] > 0) {
        cohorts.push({ backendKey: k, startMonth: m, dealCount: dealsByBackend[k], avgDebt: inputs.volume.avgDebt[k] });
      }
      rollup[k].dealsSubmitted += dealsByBackend[k];
      rollup[k].enrolledVolume += dealsByBackend[k] * inputs.volume.avgDebt[k];
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
      const perDeal = dealMonth >= 1 ? revenueForDealMonth(cohort.backendKey, cohort.avgDebt, dealMonth, inputs) : 0;
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
      const payoutDealMonth = agentPayoutMonth(cohort.backendKey, inputs);
      if (unlaggedDealMonth === payoutDealMonth) {
        const survivingAtPayout = (survival[cohort.backendKey][unlaggedDealMonth] ?? 0) * cohort.dealCount;
        const monthlyEnrolled = cohort.dealCount * cohort.avgDebt;
        const perDealComm = agentCommissionForDeal(cohort.backendKey, cohort.avgDebt, monthlyEnrolled, inputs);
        const amount = survivingAtPayout * perDealComm;
        commission += amount;
        partnerDetail[cohort.backendKey].repCommission += amount;
        rollup[cohort.backendKey].repCommission += amount;
      }
    }

    // ── Cost ledger ──────────────────────────────────────────────────────────
    const costs = buildMonthlyCosts(inputs, {
      totalTransfers: capacity.totalTransfers,
      purchasedTransfers: capacity.purchasedTransfers,
      totalCallMinutes: capacity.requiredCallMinutes,
      roster: rosterMonth,
    });
    const overhead = costs.total;
    const transferCost = costs.groups.find((g) => g.id === 'transfers')?.subtotal ?? 0;
    const laborCost = costs.groups.find((g) => g.id === 'labor')?.subtotal ?? 0;

    const netCashFlow = revenue - commission - overhead;
    cash += netCashFlow;
    if (cash < peakCapital) peakCapital = cash;
    if (firstCashPositive == null && cash > 0) firstCashPositive = m;

    // Reserve = months of overhead, plus a chargeback buffer sized off the
    // trailing 12 months of commission actually paid out. Matches the shared
    // engine's definition exactly.
    trailingCommission12mo.push(commission);
    if (trailingCommission12mo.length > 12) trailingCommission12mo.shift();
    const disputeBuffer = trailingCommission12mo.reduce((a, b) => a + b, 0) * disputeRate;
    const reserveTarget = overhead * inputs.reservePolicy.targetMonthsOfOverhead + disputeBuffer;
    const reserveMet = cash >= reserveTarget;
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
      revenue, repCommission: commission, overhead, transferCost, laborCost,
      netCashFlow, cashPosition: cash,
      reserveTarget, reserveMet,
      seats, utilizationPct: util,
      event,
      notes: buildNote(m, inputs, revenue, commission, capacity, reserveMet, months[months.length - 1]),
      capacity, costs,
      partners: BACKEND_KEYS.map((k) => partnerDetail[k]),
    });
  }

  BACKEND_KEYS.forEach((k) => { rollup[k].netRevenue = rollup[k].revenue - rollup[k].repCommission; });

  const totals = {
    revenue: months.reduce((s, r) => s + r.revenue, 0),
    repCommission: months.reduce((s, r) => s + r.repCommission, 0),
    overhead: months.reduce((s, r) => s + r.overhead, 0),
    transferCost: months.reduce((s, r) => s + r.transferCost, 0),
    laborCost: months.reduce((s, r) => s + r.laborCost, 0),
    finalCash: cash,
    distributableAboveReserve: Math.max(0, cash - (months[months.length - 1]?.reserveTarget ?? 0)),
    firstCashPositiveMonth: firstCashPositive,
    peakCapitalRequired: Math.abs(Math.min(0, peakCapital)),
    reserveTargetFirstMet: reserveFirstMet,
    finalSeatCount: months[months.length - 1]?.seats ?? 0,
    startingSeatCount,
    peakUtilizationPct: peakUtilization,
    hiringEvents,
  };

  // ── Model-level warnings ───────────────────────────────────────────────────
  const finalEmployeeCosts = roster.map((e) => computeEmployeeCost(e, inputs.laborPolicy));
  finalEmployeeCosts.forEach((e) => warnings.push(...e.warnings));

  const mix = inputs.operations.transferMix;
  const mixTotal = mix.buffer1min + mix.buffer2min + mix.buffer5min;
  if (Math.abs(mixTotal - 100) > 0.01) {
    warnings.push(`Transfer buffer mix totals ${mixTotal.toFixed(2)}% — it must total 100%.`);
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
