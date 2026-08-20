import type {
  BackendBrand, BackendKey, Employee, EmployeeType, ModelInputs, WeekShifts, DayKey,
} from './types';
import { TEAM_UNASSIGNED } from './types';
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

export const EMPLOYEE_TYPE_LABEL: Record<EmployeeType, string> = {
  inhouse: 'In-House / CA',
  bpo: 'BPO / Overseas',
  owner: 'Owner Operator',
  manager: 'Manager / Team Lead',
};

/** Types that earn an override on their team's closed deals. */
export const OVERRIDE_TYPES: EmployeeType[] = ['manager', 'owner'];

let seq = 0;
export function newEmployeeId(): string {
  seq += 1;
  return `emp_${seq}_${Math.round(seq * 7919) % 99991}`;
}

const DEFAULT_NAME: Record<EmployeeType, string> = {
  inhouse: 'In-House Closer',
  bpo: 'BPO Agent',
  owner: 'Owner Operator',
  manager: 'Team Lead',
};

/** Per-type defaults, so switching type in the roster does the sensible thing. */
export function typeDefaults(type: EmployeeType) {
  switch (type) {
    case 'owner':
      // Owner-operators take no hourly wage — they are paid by the business.
      return { hourlyRate: 0, unpaidBreakMinutes: 0, otEligible: false, commissionOnly: true, overridePct: 0.25, role: 'closer' as const };
    case 'manager':
      return { hourlyRate: IN_HOUSE_MIN_WAGE, unpaidBreakMinutes: 60, otEligible: true, commissionOnly: false, overridePct: 0.15, role: 'closer' as const };
    case 'bpo':
      return { hourlyRate: 5, unpaidBreakMinutes: 0, otEligible: false, commissionOnly: false, overridePct: 0, role: 'opener' as const };
    default:
      return { hourlyRate: IN_HOUSE_MIN_WAGE, unpaidBreakMinutes: 60, otEligible: true, commissionOnly: false, overridePct: 0, role: 'closer' as const };
  }
}

export function makeEmployee(partial: Partial<Employee> = {}): Employee {
  const type = partial.type ?? 'inhouse';
  const d = typeDefaults(type);
  return {
    id: partial.id ?? newEmployeeId(),
    name: partial.name ?? DEFAULT_NAME[type],
    type,
    role: partial.role ?? d.role,
    hourlyRate: partial.hourlyRate ?? d.hourlyRate,
    unpaidBreakMinutes: partial.unpaidBreakMinutes ?? d.unpaidBreakMinutes,
    otEligible: partial.otEligible ?? d.otEligible,
    hybridCloserSharePct: partial.hybridCloserSharePct ?? 50,
    startMonth: partial.startMonth ?? 1,
    endMonth: partial.endMonth ?? null,
    shifts: partial.shifts ?? defaultShifts(),
    commissionOnly: partial.commissionOnly ?? d.commissionOnly,
    overridePct: partial.overridePct ?? d.overridePct,
    teamId: partial.teamId ?? TEAM_UNASSIGNED,
  };
}

// ── Default roster ───────────────────────────────────────────────────────────
// Mirrors the current live model's starting position: 2 seats, one of which is
// commission-only, expressed as real people instead of abstract "seats".
export function defaultRoster(): Employee[] {
  return [
    makeEmployee({ name: 'Owner Operator', type: 'owner', role: 'closer', teamId: 'team-a' }),
    makeEmployee({ name: 'Closer 1 — In-House', type: 'inhouse', role: 'closer', teamId: 'team-a' }),
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
    // Which denominator the close rates below are quoted against. Check one
    // vendor invoice (billed transfers) against the CRM (raw transfers taken)
    // and set this once — it decides whether transfer spend falls.
    closeRateBasis: 'billed',
    buffers: [
      // price: 2-min corrected from $15 to $14.
      // passRatePct: share of raw transfers that survive the buffer and get
      // billed. ESTIMATES — the longer the buffer, the fewer survive, which is
      // exactly what the higher price buys. Calibrate from vendor invoices.
      { key: 'buffer1min', label: '1-minute buffer', bufferMinutes: 1, price: 8, mixPct: 40, passRatePct: 85, closeRatePct: 15 },
      { key: 'buffer2min', label: '2-minute buffer', bufferMinutes: 2, price: 14, mixPct: 60, passRatePct: 70, closeRatePct: 15 },
      { key: 'buffer5min', label: '5-minute buffer', bufferMinutes: 5, price: 55, mixPct: 0, passRatePct: 40, closeRatePct: 15 },
    ],
    avgHandleMinutes: 65,
    openerTransfersPerHour: 2,
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

  overridePolicy: {
    enabled: true,
    // Percentage of the enrolled debt volume the manager's team closed. Same
    // basis as Level Debt's own graduated commission, and the only base where
    // 0.1%-0.25% produces a number that matters.
    base: 'enrolledVolume',
    minPct: 0.1,
    maxPct: 0.25,
    includeOwnDeals: true,
    payoutLagMonths: 1,
  },

  // Straight from the agent incentive reference.
  bonusPolicy: {
    enabled: true,
    workingDaysPerMonth: 21.7,
    dealConcentration: 1.6,
    manualHitDays3Plus: 0,
    manualHitDays5Plus: 0,
    dailyDeal: [
      { minDealsPerDay: 3, bonusPerDeal: 50 },
      { minDealsPerDay: 5, bonusPerDeal: 75 },
    ],
    monthlyVolume: [
      { minDealsPerMonth: 8, bonus: 300 },
      { minDealsPerMonth: 12, bonus: 600 },
      { minDealsPerMonth: 17, bonus: 1000 },
      { minDealsPerMonth: 23, bonus: 1500 },
      { minDealsPerMonth: 30, bonus: 2250 },
    ],
    balancedBook: {
      minDeals: 5,
      tiers: [
        { minMixPct: 30, bonus: 100 },
        { minMixPct: 50, bonus: 250 },
        { minMixPct: 70, bonus: 500 },
      ],
    },
    ldEnrollment: [
      { minEnrolledPerDay: 75000, bonus: 75 },
      { minEnrolledPerDay: 100000, bonus: 125 },
    ],
    // Bonuses are provisional until the files clear the clawback and
    // chargeback windows, so a share is withheld from the month's payout.
    provisionalHoldbackPct: 0,
    payoutLagMonths: 1,
  },

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
      overridePct: 0,
      teamId: TEAM_UNASSIGNED,
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
