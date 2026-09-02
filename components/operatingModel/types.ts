// ─────────────────────────────────────────────────────────────────────────────
// Funding Tier — Operating Model :: Type definitions
// Drop-in for the Next.js app. No React, no DOM — pure types.
// ─────────────────────────────────────────────────────────────────────────────

export type BackendKey = 'LEVEL' | 'CS' | 'LEGACY';

export const BACKEND_KEYS: BackendKey[] = ['LEVEL', 'CS', 'LEGACY'];

export interface BackendBrand {
  key: BackendKey;
  name: string;
  legalName: string;
  /** Monogram used by the logo badge when no artwork is supplied. */
  monogram: string;
  accent: string;
  accentSoft: string;
  /** Optional URL to real logo artwork; falls back to the monogram badge. */
  logoUrl?: string;
  /** width ÷ height of the artwork, so the badge reserves the right box. */
  logoAspect?: number;
  /** Artwork ships with a solid white plate rather than transparency. */
  logoHasWhitePlate?: boolean;
}

// ── Employees / roster ───────────────────────────────────────────────────────

export type EmployeeType = 'inhouse' | 'bpo' | 'owner' | 'manager';
export type EmployeeRole = 'opener' | 'closer' | 'hybrid';
export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export interface DayShift {
  enabled: boolean;
  /** Decimal hours, PST. 9.5 = 9:30am. */
  start: number;
  end: number;
}

export type WeekShifts = Record<DayKey, DayShift>;

export interface Employee {
  id: string;
  name: string;
  type: EmployeeType;
  role: EmployeeRole;
  hourlyRate: number;
  /** Unpaid meal break deducted per worked day. */
  unpaidBreakMinutes: number;
  /** Only In-House / CA staff accrue the 1.5x premium by default. */
  otEligible: boolean;
  /** For role === 'hybrid': share of paid hours spent closing (0-100). */
  hybridCloserSharePct: number;
  /** First simulation month this person is on payroll. */
  startMonth: number;
  /** Last simulation month, or null for open-ended. */
  endMonth: number | null;
  shifts: WeekShifts;
  /** Commission-only reps cost $0 in labor but still consume capacity. */
  commissionOnly: boolean;
  /**
   * Managers and owner-operators earn an override on the deals their team
   * closes, on top of anything they close themselves. 0.1%-0.25% is the band.
   */
  overridePct: number;
  /** Team this person belongs to. Managers earn the override on their own team. */
  teamId: string;
}

export const TEAM_UNASSIGNED = 'house';

export type OverrideBase = 'enrolledVolume' | 'repCommission' | 'ftRevenue';

export interface OverridePolicy {
  enabled: boolean;
  base: OverrideBase;
  minPct: number;
  maxPct: number;
  /** Managers earn the override on deals they personally closed too. */
  includeOwnDeals: boolean;
  /** Months between a deal closing and the override reaching the manager. */
  payoutLagMonths: number;
}

export interface LaborPolicy {
  otThresholdHrsPerWeek: number;
  otMultiplier: number;
  inHouseMinWage: number;
  bpoRateMin: number;
  bpoRateMax: number;
  weeksPerMonth: number;
  /** Allowed clock-in window, enforced by the UI. */
  windowWeekday: { start: number; end: number };
  windowSaturday: { start: number; end: number };
}

export interface EmployeeCost {
  employee: Employee;
  weeklyPaidHours: number;
  regularHoursPerWeek: number;
  otHoursPerWeek: number;
  monthlyPaidHours: number;
  monthlyCloserHours: number;
  monthlyOpenerHours: number;
  regularCostPerMonth: number;
  otCostPerMonth: number;
  monthlyCost: number;
  effectiveHourlyCost: number;
  warnings: string[];
}

// ── Volume / operations ──────────────────────────────────────────────────────

export interface VolumeInputs {
  mode: 'derived' | 'override';
  /** Deals produced per 8 paid CLOSER hours. Business rule: 1.0 - 1.5. */
  dealsPer8CloserHours: number;
  overrideTotalDealsPerMonth: number;
  /** Percentage split of total volume across the three backends. Sums to 100. */
  mixPct: Record<BackendKey, number>;
  avgDebt: Record<BackendKey, number>;
}

export interface RampInputs {
  rampMonths: number;
  horizonMonths: number;
}

export type BufferKey = 'buffer1min' | 'buffer2min' | 'buffer5min';

export interface TransferMix {
  buffer1min: number;
  buffer2min: number;
  buffer5min: number;
}

/**
 * One buffer tier of the transfer funnel.
 *
 * A vendor routes a live call. If it disconnects before the buffer elapses it
 * is a "dud" and is never billed — which is exactly why a longer buffer costs
 * more per transfer. So each tier carries its own pass rate and its own close
 * rate, and the only comparison that means anything is cost per CLOSED deal.
 */
export interface TransferBuffer {
  key: BufferKey;
  label: string;
  /** Minutes a call must survive before it becomes billable. */
  bufferMinutes: number;
  /** Price per BILLED transfer. */
  price: number;
  /** Share of raw transfers routed on this tier (the three sum to 100). */
  mixPct: number;
  /** Share of raw transfers on this tier that survive the buffer and get billed. */
  passRatePct: number;
  /** Close rate on this tier, on the basis set by closeRateBasis. */
  closeRatePct: number;
}

/** Which denominator the close rate is quoted against. */
export type CloseRateBasis = 'billed' | 'all';

export interface OperationsInputs {
  /** Legacy blended close rate. Kept in sync with the per-buffer tiers. */
  closeRatePct: number;
  closeRateBasis: CloseRateBasis;
  buffers: TransferBuffer[];
  avgHandleMinutes: number;
  /** Qualified transfers an opener produces per paid hour. */
  openerTransfersPerHour: number;
  smsPerTransfer: number;
  emailPerTransfer: number;
  emailMonthlyCap: number;
  /** When true, deals are capped by closer talk-time capacity. */
  capDealsAtCapacity: boolean;
}

export interface BufferFunnel {
  key: BufferKey;
  label: string;
  price: number;
  mixPct: number;
  passRatePct: number;
  closeRatePct: number;
  rawTransfers: number;
  duds: number;
  billedTransfers: number;
  deals: number;
  cost: number;
  costPerDeal: number;
}

export interface TransferFunnel {
  buffers: BufferFunnel[];
  rawTransfers: number;
  duds: number;
  billedTransfers: number;
  /** Billed ÷ raw, across the mix. */
  blendedPassRatePct: number;
  dudRatePct: number;
  /** deals ÷ raw transfers taken. */
  closeRateOnAllPct: number;
  /** deals ÷ billed transfers. */
  closeRateOnBilledPct: number;
  /** Cost ÷ billed transfers. */
  blendedPricePerBilled: number;
  costPerClosedDeal: number;
  totalCost: number;
  /** Transfers the in-house opener pool covered, which are never purchased. */
  openerCoveredRaw: number;
}

// ── Backend contract terms ───────────────────────────────────────────────────

export interface CommissionTier { threshold: number; rate: number }

export interface LevelDebtTerms {
  minDebt: number;
  revenueSharePct: number;
  revenueRecognizedMonth: number;
  agentPayoutMonth: number;
  commissionTiers: CommissionTier[];
  /** Months of cleared client payments required to clear chargeback liability. */
  chargebackClearMonths: number;
}

export interface ShieldProgram {
  code: string; min: number; max: number;
  payment: number; term: number; commission: number;
}

export interface ShieldTerms {
  minDebt: number;
  servicingDeductionPerPayment: number;
  frontMonths: number;
  frontCaptureRate: number;
  backendCaptureRate: number;
  agentPayoutMonth: number;
  programs: ShieldProgram[];
}

export interface LegacyBand { code: string; min: number; max: number; total: number }

export interface LegacyTerms {
  minDebt: number;
  /** Floor on the CLIENT DRAFT, not on the service fee. This is what caps the term. */
  minMonthlyPayment: number;
  /** Payment-processing fee per draft. A split schedule drafts twice, so it is charged twice. */
  draftFee: number;
  /** Flat monthly program maintenance. Charged once a month even on a split schedule. */
  maintenanceFee: number;
  splitSchedule: boolean;
  maxTerm: number;
  /** Program length actually written, clamped by the $250 draft floor. */
  targetTerm: number;
  tier1Rate: number;
  tier2Rate: number;
  tier2FileThreshold: number;
  agentPayoutMonth: number;
  feeRate: number;
  bands: LegacyBand[];
}

/**
 * Months of lag between a client payment clearing and the backend remitting
 * to Funding Tier. Every backend pays in arrears — this is why month 1 is
 * always a zero-revenue month.
 */
export interface RemittanceLag {
  LEVEL: number;
  CS: number;
  LEGACY: number;
}

// ── Costs ────────────────────────────────────────────────────────────────────

export interface FixedCost { id: string; label: string; amount: number }
export interface PerUserCost { id: string; label: string; amountPerUser: number; enabled: boolean }

export interface UsageRates {
  inboundForwardPerMin: number;
  smsPerSegment: number;
  emailPer1000: number;
  didRentalPerMonth: number;
}

export interface TrackdriveTier {
  key: string; threshold: number; did: number; inbound: number;
  api: number; reject: number;
}

export interface TransferCosts { buffer1min: number; buffer2min: number; buffer5min: number }

export interface DidPolicy {
  /** DIDs provisioned per active agent. */
  perAgent: number;
  /** Flat additional DIDs on top of the per-agent allocation. */
  additional: number;
}

export interface CostInputs {
  fixedCosts: FixedCost[];
  perUserCosts: PerUserCost[];
  usageRates: UsageRates;
  trackdriveTiers: TrackdriveTier[];
  trackdriveOutboundPerMin: number;
  transferCost: TransferCosts;
  dids: DidPolicy;
}

// ── Policy ───────────────────────────────────────────────────────────────────

export interface DailyDealTier { minDealsPerDay: number; bonusPerDeal: number }
export interface MonthlyVolumeTier { minDealsPerMonth: number; bonus: number }
export interface BalancedBookTier { minMixPct: number; bonus: number }
export interface LdEnrollmentTier { minEnrolledPerDay: number; bonus: number }

export interface BonusPolicy {
  enabled: boolean;
  /** Working days per month used to convert monthly volume into daily rates. */
  workingDaysPerMonth: number;
  /**
   * Deals do not arrive evenly. This multiplies a rep's average daily deal
   * count on their good days, so daily thresholds can actually be reached.
   * 1.0 = perfectly even. Raise it to match observed clumping.
   */
  dealConcentration: number;
  /** Set > 0 to bypass the concentration model and state hit-days directly. */
  manualHitDays3Plus: number;
  manualHitDays5Plus: number;
  dailyDeal: DailyDealTier[];
  monthlyVolume: MonthlyVolumeTier[];
  balancedBook: { minDeals: number; tiers: BalancedBookTier[] };
  ldEnrollment: LdEnrollmentTier[];
  /**
   * Bonuses are provisional until the related files clear the clawback and
   * chargeback windows. This holds back a share of accrued bonus.
   */
  provisionalHoldbackPct: number;
  /**
   * Months between the production month and the bonus hitting cash. Bonuses are
   * earned on deals written, but paid with a later payroll — same arrears
   * principle that keeps month 1 free of commission.
   */
  payoutLagMonths: number;
}

export interface BonusLine {
  id: string;
  label: string;
  detail: string;
  formula: string;
  amount: number;
}

export interface BonusResult {
  lines: BonusLine[];
  total: number;
  heldBack: number;
  paid: number;
}

export interface ReservePolicy {
  targetMonthsOfOverhead: number;
  disputeRatePct: number;
}

export interface HiringPolicy {
  enabled: boolean;
  utilizationThresholdPct: number;
  sustainMonths: number;
  seatsAddedPerHire: number;
  hireLagMonths: number;
  maxSeats: number;
  /** Template used to materialise an auto-hired employee. */
  template: Omit<Employee, 'id' | 'name' | 'startMonth' | 'endMonth'>;
}

export interface SurvivalCurveInputs {
  firstPayPct: number;
  cancelPctByMonth: number[];
  steadyStateMonthlyCancelPct: number;
}

// ── Root ─────────────────────────────────────────────────────────────────────

export interface ModelInputs {
  ramp: RampInputs;
  volume: VolumeInputs;
  operations: OperationsInputs;
  roster: Employee[];
  laborPolicy: LaborPolicy;
  levelDebt: LevelDebtTerms;
  consumerShield: ShieldTerms;
  legacy: LegacyTerms;
  remittanceLag: RemittanceLag;
  costs: CostInputs;
  reservePolicy: ReservePolicy;
  hiringPolicy: HiringPolicy;
  overridePolicy: OverridePolicy;
  bonusPolicy: BonusPolicy;
  survivalCurves: Record<BackendKey, SurvivalCurveInputs>;
}

// ── Outputs ──────────────────────────────────────────────────────────────────

export interface CostBreakdownLine {
  id: string;
  label: string;
  detail: string;
  formula: string;
  amount: number;
}

export interface CostBreakdownGroup {
  id: string;
  label: string;
  note: string;
  lines: CostBreakdownLine[];
  subtotal: number;
}

export interface MonthlyCostBreakdown {
  groups: CostBreakdownGroup[];
  total: number;
  trackdriveTierKey: string;
  totalCallMinutes: number;
  totalSmsSegments: number;
  totalEmails: number;
  didCount: number;
  headcount: number;
}

export interface CapacityDetail {
  closerHours: number;
  openerHours: number;
  paidHours: number;
  /** Deals the closer pool can produce under the deals-per-8-hours rule. */
  ruleCapacityDeals: number;
  /** Deals the closer pool can produce under AHT x close-rate arithmetic. */
  talkTimeCapacityDeals: number;
  bindingConstraint: 'rule' | 'talk-time' | 'override';
  targetDeals: number;
  utilizationPct: number;
  /** Utilization implied by the deals-per-hour rule before any capacity cap. */
  ruleUtilizationPct: number;
  requiredCallMinutes: number;
  availableCallMinutes: number;
  openerRawSupply: number;
  openerSuppliedTransfers: number;
  purchasedTransfers: number;
  totalTransfers: number;
}

export interface PartnerMonthDetail {
  key: BackendKey;
  dealsSubmitted: number;
  activeDeals: number;
  revenue: number;
  repCommission: number;
}

export interface MonthRow {
  month: number;
  deals: number;
  dealsByBackend: Record<BackendKey, number>;
  revenue: number;
  repCommission: number;
  /** Override paid out in cash this month (accrued payoutLagMonths earlier). */
  managerOverride: number;
  /** Override accrued on this month's production. */
  managerOverrideAccrued: number;
  /** Bonuses accrued on this month's production. */
  bonuses: BonusResult;
  /** Bonus cash actually leaving the business this month. */
  bonusPaid: number;
  overhead: number;
  transferCost: number;
  laborCost: number;
  netCashFlow: number;
  cashPosition: number;
  reserveTarget: number;
  reserveMet: boolean;
  seats: number;
  utilizationPct: number;
  event: string;
  notes: string;
  capacity: CapacityDetail;
  funnel: TransferFunnel;
  costs: MonthlyCostBreakdown;
  partners: PartnerMonthDetail[];
}

export interface PartnerRollup {
  key: BackendKey;
  dealsSubmitted: number;
  avgDebt: number;
  enrolledVolume: number;
  revenue: number;
  repCommission: number;
  netRevenue: number;
  revenueModel: string;
  perpetuity: boolean;
}

export interface HiringEvent { month: number; seatsAfter: number; label: string }

export interface ModelResults {
  months: MonthRow[];
  partners: PartnerRollup[];
  employeeCosts: EmployeeCost[];
  totals: {
    revenue: number;
    repCommission: number;
    managerOverride: number;
    bonuses: number;
    overhead: number;
    transferCost: number;
    laborCost: number;
    finalCash: number;
    distributableAboveReserve: number;
    firstCashPositiveMonth: number | null;
    peakCapitalRequired: number;
    reserveTargetFirstMet: number | null;
    finalSeatCount: number;
    startingSeatCount: number;
    peakUtilizationPct: number;
    hiringEvents: HiringEvent[];
  };
  warnings: string[];
}
