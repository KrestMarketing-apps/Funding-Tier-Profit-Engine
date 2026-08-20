import type {
  BackendBrand, BackendKey, Employee, ModelInputs, WeekShifts, DayKey,
} from './types';
import { sharedCosts, sharedLegacy, sharedLevelDebt, sharedShield } from './sharedTerms';

export const WEEKS_PER_MONTH = 52 / 12; // 4.3333…

// ── Brand identity for the three servicing partners ──────────────────────────
export const BRANDS: Record<BackendKey, BackendBrand> = {
  LEVEL: {
    key: 'LEVEL', name: 'Level Debt', legalName: 'Level Debt',
    monogram: 'LD', accent: '#0f9d8a', accentSoft: '#e6f7f4',
    // "level." wordmark — transparent PNG/WebP, dark type with a green accent.
    logoUrl: 'https://assets.cdn.filesafe.space/S4ztIlDxBovAboldwbOR/media/69c35b2cab2203b0fc83186d.webp',
    logoAspect: 224 / 84,
  },
  CS: {
    key: 'CS', name: 'Shield Services', legalName: 'Consumer Shield',
    monogram: 'SS', accent: '#1a6ed8', accentSoft: '#dbeafe',
    // Stacked CONSUMER / SHIELD lockup — square, ships on a white plate.
    logoUrl: 'https://assets.cdn.filesafe.space/S4ztIlDxBovAboldwbOR/media/69c35b2c25c6995d2d2d21fa.png',
    logoAspect: 1,
    logoHasWhitePlate: true,
  },
  LEGACY: {
    key: 'LEGACY', name: 'Elite Legal Practice', legalName: 'Legacy Capital Services',
    monogram: 'ELP', accent: '#d97706', accentSoft: '#fef3c7',
    // LEGACY CAPITAL SERVICES wordmark with the pillar mark — ships on a white plate.
    logoUrl: 'https://assets.cdn.filesafe.space/S4ztIlDxBovAboldwbOR/media/69e1c95dc56ad279084b3141.png',
    logoAspect: 400 / 150,
    logoHasWhitePlate: true,
  },
};

// ── Schedule helpers ─────────────────────────────────────────────────────────

/** Allowed clock window: Mon-Fri 6:00-19:00 PST, Sat 6:00-15:00 PST. */
export const WINDOW_WEEKDAY = { start: 6, end: 19 };
export const WINDOW_SATURDAY = { start: 6, end: 15 };

/** Default shift: 9:00am-6:00pm PST, Mon-Fri. Saturday off. */
export function defaultShifts(opts?: { saturday?: boolean }): WeekShifts {
  const weekday = { enabled: true, start: 9, end: 18 };
  const off = { enabled: false, start: 9, end: 18 };
  return {
    mon: { ...weekday }, tue: { ...weekday }, wed: { ...weekday },
    thu: { ...weekday }, fri: { ...weekday },
    sat: opts?.saturday ? { enabled: true, start: 6, end: 15 } : { ...off, start: 6, end: 15 },
    sun: { ...off },
  };
}

export const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

// ── Employee factory ─────────────────────────────────────────────────────────

export const IN_HOUSE_MIN_WAGE = 16.9;
export const BPO_RATE_MIN = 3;
export const BPO_RATE_MAX = 8;

let seq = 0;
export function newEmployeeId(): string {
  seq += 1;
  return `emp_${seq}_${Math.round(seq * 7919) % 99991}`;
}

export function makeEmployee(partial: Partial<Employee> = {}): Employee {
  const type = partial.type ?? 'inhouse';
  const isInHouse = type === 'inhouse';
  return {
    id: partial.id ?? newEmployeeId(),
    name: partial.name ?? (isInHouse ? 'In-House Closer' : 'BPO Agent'),
    type,
    role: partial.role ?? (isInHouse ? 'closer' : 'opener'),
    hourlyRate: partial.hourlyRate ?? (isInHouse ? IN_HOUSE_MIN_WAGE : 5),
    unpaidBreakMinutes: partial.unpaidBreakMinutes ?? (isInHouse ? 60 : 0),
    otEligible: partial.otEligible ?? isInHouse,
    hybridCloserSharePct: partial.hybridCloserSharePct ?? 50,
    startMonth: partial.startMonth ?? 1,
    endMonth: partial.endMonth ?? null,
    shifts: partial.shifts ?? defaultShifts(),
    commissionOnly: partial.commissionOnly ?? false,
  };
}

// ── Default roster ───────────────────────────────────────────────────────────
// Mirrors the current live model's starting position: 2 seats, one of which is
// commission-only, expressed as real people instead of abstract "seats".
export function defaultRoster(): Employee[] {
  return [
    makeEmployee({ name: 'Closer 1 — In-House', type: 'inhouse', role: 'closer', hourlyRate: IN_HOUSE_MIN_WAGE }),
    makeEmployee({
      name: 'Closer 2 — Commission Only', type: 'inhouse', role: 'closer',
      hourlyRate: 0, commissionOnly: true, otEligible: false,
    }),
  ];
}

// ── Contract terms (verified against the production bundle) ──────────────────

export const DEFAULT_INPUTS: ModelInputs = {
  ramp: {
    rampMonths: 1,        // CHANGED: was 12
    horizonMonths: 24,    // CHANGED: was 36
  },

  volume: {
    mode: 'derived',      // CHANGED: volume now derives from employed closer hours
    dealsPer8CloserHours: 1.25,
    overrideTotalDealsPerMonth: 75,
    mixPct: { LEVEL: 33, CS: 40, LEGACY: 27 },
    avgDebt: { LEVEL: 16000, CS: 15000, LEGACY: 14000 },
  },

  operations: {
    closeRatePct: 15,
    avgHandleMinutes: 65,
    openerTransfersPerHour: 2,
    // CHANGED: was 33.34 / 33.33 / 33.33
    transferMix: { buffer1min: 40, buffer2min: 60, buffer5min: 0 },
    smsPerTransfer: 2,
    emailPerTransfer: 3,
    emailMonthlyCap: 5000,
    capDealsAtCapacity: true,
  },

  roster: defaultRoster(),

  laborPolicy: {
    otThresholdHrsPerWeek: 40,
    otMultiplier: 1.5,
    inHouseMinWage: IN_HOUSE_MIN_WAGE,
    bpoRateMin: BPO_RATE_MIN,
    bpoRateMax: BPO_RATE_MAX,
    weeksPerMonth: WEEKS_PER_MONTH,
    windowWeekday: WINDOW_WEEKDAY,
    windowSaturday: WINDOW_SATURDAY,
  },

  // Contract terms come from the shared engine — never duplicated here.
  // chargebackClearMonths is the one term the shared engine does not carry:
  // Level Debt deals are free of chargeback liability after this many
  // completed client payments.
  levelDebt: sharedLevelDebt(2),
  consumerShield: sharedShield(),
  legacy: sharedLegacy(),

  // FIX: every backend remits in arrears. Level Debt already recognised at
  // deal-month 2; Shield and Legacy previously recognised in the same month the
  // client paid, which manufactured revenue in month 1.
  remittanceLag: { LEVEL: 0, CS: 1, LEGACY: 1 },

  // Rates, tiers and per-user tools also come from the shared engine. The only
  // additions are stable row ids and the DID provisioning policy, which
  // replaces the old fixed activeDIDs count with agents x N + extra.
  costs: sharedCosts(),

  reservePolicy: { targetMonthsOfOverhead: 6, disputeRatePct: 0.5 },

  hiringPolicy: {
    // OFF by default. Volume now derives from employed closer hours, so adding
    // a seat adds volume — utilization sits at ~100% by construction and an
    // automatic trigger would hire every time the reserve is met. Growth is a
    // roster decision: add people in the Staffing & Labor roster instead.
    enabled: false,
    utilizationThresholdPct: 85,
    sustainMonths: 2,
    seatsAddedPerHire: 1,
    hireLagMonths: 1,
    maxSeats: 0,
    template: {
      type: 'inhouse',
      role: 'closer',
      hourlyRate: IN_HOUSE_MIN_WAGE,
      unpaidBreakMinutes: 60,
      otEligible: true,
      hybridCloserSharePct: 50,
      shifts: defaultShifts(),
      commissionOnly: false,
    },
  },

  survivalCurves: {
    // Level Debt is a settlement product: Funding Tier is paid once, after the
    // first payment clears, and is free of chargeback liability once the second
    // completed payment clears. Only months 1-2 matter.
    LEVEL: { firstPayPct: 50, cancelPctByMonth: [15], steadyStateMonthlyCancelPct: 15 },
    CS: { firstPayPct: 50, cancelPctByMonth: [15, 15, 15, 15, 15], steadyStateMonthlyCancelPct: 15 },
    LEGACY: { firstPayPct: 50, cancelPctByMonth: [15, 15, 15, 15, 15], steadyStateMonthlyCancelPct: 15 },
  },
};

export function cloneDefaults(): ModelInputs {
  return JSON.parse(JSON.stringify(DEFAULT_INPUTS, (k, v) => (v === Infinity ? '__INF__' : v)), (k, v) =>
    v === '__INF__' ? Infinity : v);
}
