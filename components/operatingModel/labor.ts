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
  const otHours = otApplies ? Math.max(0, weekly - policy.otThresholdHrsPerWeek) : 0;
  const regularHours = weekly - otHours;

  const rate = emp.commissionOnly ? 0 : emp.hourlyRate;
  const regularCostPerWeek = regularHours * rate;
  const otCostPerWeek = otHours * rate * policy.otMultiplier;

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
  if (otHours > 0) {
    warnings.push(
      `${emp.name}: ${weekly.toFixed(1)} paid hrs/wk exceeds ${policy.otThresholdHrsPerWeek} — ${otHours.toFixed(1)} hrs billed at ${policy.otMultiplier}x.`,
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
