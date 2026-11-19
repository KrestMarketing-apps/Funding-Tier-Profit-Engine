import type { DayKey, Employee, EmployeeCost, LaborPolicy } from './types';
import { DAY_KEYS } from './types';

/** Paid hours for a single day: clock span minus the unpaid meal break. */
export function paidHoursForDay(emp: Employee, day: DayKey): number {
  const shift = emp.shifts[day];
  if (!shift || !shift.enabled) return 0;
  const span = shift.end - shift.start;
  if (span <= 0) return 0;
  return Math.max(0, span - emp.unpaidBreakMinutes / 60);
}

export function weeklyPaidHours(emp: Employee): number {
  return DAY_KEYS.reduce((sum, d) => sum + paidHoursForDay(emp, d), 0);
}

/**
 * Full cost + capacity picture for one person.
 *
 *   regular hrs  = min(weekly paid hrs, OT threshold)
 *   OT hrs       = max(0, weekly paid hrs - OT threshold)   [In-House/CA only]
 *   weekly cost  = regular x rate + OT x rate x 1.5
 *   monthly cost = weekly cost x 52/12
 */
export function computeEmployeeCost(emp: Employee, policy: LaborPolicy): EmployeeCost {
  const warnings: string[] = [];
  const weekly = weeklyPaidHours(emp);
  const otApplies = emp.otEligible && !emp.commissionOnly;
  const rate = emp.commissionOnly ? 0 : emp.hourlyRate;

  // Overtime, California style when enabled: each paid hour is classified once
  // at the highest rate that applies — daily (>8 → 1.5x, >12 → 2x), 7th
  // consecutive day (first 8 hrs → 1.5x), then whatever remains over 40 in the
  // week → 1.5x. The weekly rule alone is the legacy behaviour.
  let otHours = 0;
  let dtHours = 0;
  if (otApplies) {
    if (policy.californiaDailyOt) {
      const dailyT = policy.dailyOtThresholdHrs ?? 8;
      const dtT = policy.doubleTimeThresholdHrs ?? 12;
      const perDay = DAY_KEYS.map((d) => paidHoursForDay(emp, d));
      const daysWorked = perDay.filter((h) => h > 0).length;
      let dailyOt = 0, dailyDt = 0, straight = 0;
      perDay.forEach((h) => {
        if (h <= 0) return;
        dailyDt += Math.max(0, h - dtT);
        dailyOt += Math.max(0, Math.min(h, dtT) - dailyT);
        straight += Math.min(h, dailyT);
      });
      if (daysWorked >= 7) {
        // 7th consecutive day: first 8 hours at 1.5x regardless of daily total.
        const seventh = Math.min(perDay.filter((h) => h > 0).slice(-1)[0] ?? 0, dailyT);
        dailyOt += seventh; straight -= seventh;
      }
      // Remaining straight-time hours over the weekly threshold are also 1.5x.
      const weeklyOt = Math.max(0, straight - policy.otThresholdHrsPerWeek);
      otHours = dailyOt + weeklyOt;
      dtHours = dailyDt;
    } else {
      otHours = Math.max(0, weekly - policy.otThresholdHrsPerWeek);
    }
  }
  const regularHours = weekly - otHours - dtHours;
  const regularCostPerWeek = regularHours * rate;
  const otCostPerWeek = otHours * rate * policy.otMultiplier
    + dtHours * rate * (policy.doubleTimeMultiplier ?? 2);
  const regularCostPerMonth = regularCostPerWeek * policy.weeksPerMonth;
  const otCostPerMonth = otCostPerWeek * policy.weeksPerMonth;
  const monthlyCost = regularCostPerMonth + otCostPerMonth;
  const monthlyPaidHours = weekly * policy.weeksPerMonth;

  // Role split.
  let closerShare = 0;
  if (emp.role === 'closer') closerShare = 1;
  else if (emp.role === 'opener') closerShare = 0;
  else closerShare = Math.min(1, Math.max(0, emp.hybridCloserSharePct / 100));

  // Validation.
  const wageFloorApplies = emp.type === 'inhouse' || emp.type === 'manager';
  if (!emp.commissionOnly && wageFloorApplies && emp.hourlyRate < policy.inHouseMinWage) {
    warnings.push(
      `${emp.name}: $${emp.hourlyRate.toFixed(2)}/hr is below the $${policy.inHouseMinWage.toFixed(2)} California minimum wage.`,
    );
  }
  if (emp.type === 'bpo' && (emp.hourlyRate < policy.bpoRateMin || emp.hourlyRate > policy.bpoRateMax)) {
    warnings.push(
      `${emp.name}: BPO rate $${emp.hourlyRate.toFixed(2)}/hr is outside the $${policy.bpoRateMin}-$${policy.bpoRateMax} band.`,
    );
  }
  if (otHours > 0 || dtHours > 0) {
    warnings.push(
      `${emp.name}: ${weekly.toFixed(1)} paid hrs/wk — ${otHours.toFixed(1)} hrs at ${policy.otMultiplier}x${dtHours > 0 ? ` and ${dtHours.toFixed(1)} hrs at ${(policy.doubleTimeMultiplier ?? 2)}x` : ''}${policy.californiaDailyOt ? ' (California daily + weekly overtime)' : ''}.`,
    );
  }
  if (emp.type === 'bpo' && emp.otEligible && weekly > policy.otThresholdHrsPerWeek) {
    warnings.push(`${emp.name}: overtime is enabled on a BPO contractor — confirm that is intended.`);
  }

  return {
    employee: emp,
    weeklyPaidHours: weekly,
    regularHoursPerWeek: regularHours,
    otHoursPerWeek: otHours,
    doubleTimeHoursPerWeek: dtHours,
    monthlyPaidHours,
    monthlyCloserHours: monthlyPaidHours * closerShare,
    monthlyOpenerHours: monthlyPaidHours * (1 - closerShare),
    regularCostPerMonth,
    otCostPerMonth,
    monthlyCost,
    effectiveHourlyCost: weekly > 0 ? monthlyCost / monthlyPaidHours : 0,
    warnings,
  };
}

export function employeeActiveInMonth(emp: Employee, month: number): boolean {
  if (month < emp.startMonth) return false;
  if (emp.endMonth != null && month > emp.endMonth) return false;
  return true;
}

export interface RosterMonthSummary {
  active: EmployeeCost[];
  headcount: number;
  laborCost: number;
  closerHours: number;
  openerHours: number;
  paidHours: number;
  inHouseCost: number;
  bpoCost: number;
  managers: EmployeeCost[];
  closers: EmployeeCost[];
}

export function summariseRosterForMonth(
  costs: EmployeeCost[],
  month: number,
): RosterMonthSummary {
  const active = costs.filter((c) => employeeActiveInMonth(c.employee, month));
  return {
    active,
    headcount: active.length,
    laborCost: active.reduce((s, c) => s + c.monthlyCost, 0),
    closerHours: active.reduce((s, c) => s + c.monthlyCloserHours, 0),
    openerHours: active.reduce((s, c) => s + c.monthlyOpenerHours, 0),
    paidHours: active.reduce((s, c) => s + c.monthlyPaidHours, 0),
    inHouseCost: active.filter((c) => c.employee.type !== 'bpo').reduce((s, c) => s + c.monthlyCost, 0),
    bpoCost: active.filter((c) => c.employee.type === 'bpo').reduce((s, c) => s + c.monthlyCost, 0),
    managers: active.filter((c) => c.employee.type === 'manager' || c.employee.type === 'owner'),
    closers: active.filter((c) => c.monthlyCloserHours > 0),
  };
}
