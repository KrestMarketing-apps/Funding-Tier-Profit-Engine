// ─────────────────────────────────────────────────────────────────────────────
// Funding Tier — Operating Model :: Staffing profiles
//
// A staffing profile is a saved agent template: vendor, rate, weekly schedule,
// break, overtime rule, role and team. Applying one writes every one of those
// fields onto a roster row at once, so modelling "three more openers from the
// Egypt vendor at 45 hrs a week" is one click instead of fifteen inputs.
//
// Built-in profiles ship in code. Anything the user saves is kept in the
// browser (localStorage) and merged on top of the built-ins.
// ─────────────────────────────────────────────────────────────────────────────
import type { Employee, EmployeeRole, EmployeeType, LaborPolicy, WeekShifts } from './types';
import { DAY_KEYS } from './types';
import { defaultShifts, makeEmployee, typeDefaults, IN_HOUSE_MIN_WAGE } from './config';
import { computeEmployeeCost } from './labor';

export interface StaffingProfile {
  id: string;
  /** What the button says. Keep it short: "Egypt BPO — 45 hr". */
  label: string;
  /** Vendor or partner this rate comes from. Free text. */
  vendor: string;
  /** Country / region, shown as a chip. Free text. */
  region: string;
  /** Anything worth remembering: contract terms, invoicing, contact. */
  notes: string;
  /** true for the shipped library — can be duplicated but not edited away. */
  builtIn: boolean;

  /** How many people to add when this profile is applied. */
  seats: number;

  type: EmployeeType;
  role: EmployeeRole;
  hybridCloserSharePct: number;
  hourlyRate: number;
  unpaidBreakMinutes: number;
  otEligible: boolean;
  commissionOnly: boolean;
  overridePct: number;
  /** Empty string = inherit the team already used by the roster. */
  teamId: string;
  startMonth: number;
  shifts: WeekShifts;
}

// ── Schedule helper ──────────────────────────────────────────────────────────
//
// Clock window is Mon–Fri 6:00–19:00 and Sat 6:00–15:00 PST; anything outside
// is clamped so a profile can never create a shift the editor would reject.
export function weekShifts(opts: {
  days?: Array<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'>;
  start: number;
  end: number;
  /** Saturday runs on its own hours when the window will not take `end`. */
  satStart?: number;
  satEnd?: number;
}): WeekShifts {
  const days = opts.days ?? ['mon', 'tue', 'wed', 'thu', 'fri'];
  const base = defaultShifts();
  const out = { ...base } as WeekShifts;
  DAY_KEYS.forEach((d) => {
    const on = (days as string[]).includes(d);
    const isSat = d === 'sat';
    const max = isSat ? 15 : 19;
    const start = isSat ? (opts.satStart ?? opts.start) : opts.start;
    const rawEnd = isSat ? (opts.satEnd ?? opts.end) : opts.end;
    out[d] = {
      enabled: on,
      start: Math.min(Math.max(start, 6), max - 0.5),
      end: Math.min(Math.max(rawEnd, start + 0.5), max),
    };
  });
  return out;
}

let pseq = 0;
export function newProfileId(): string {
  pseq += 1;
  return `sp_${Date.now().toString(36)}_${pseq}`;
}

function profile(p: Partial<StaffingProfile> & { id: string; label: string }): StaffingProfile {
  const type = p.type ?? 'bpo';
  const d = typeDefaults(type);
  return {
    vendor: '', region: '', notes: '', builtIn: true, seats: 1,
    type,
    role: p.role ?? d.role,
    hybridCloserSharePct: 50,
    hourlyRate: p.hourlyRate ?? d.hourlyRate,
    unpaidBreakMinutes: p.unpaidBreakMinutes ?? d.unpaidBreakMinutes,
    otEligible: p.otEligible ?? d.otEligible,
    commissionOnly: p.commissionOnly ?? d.commissionOnly,
    overridePct: p.overridePct ?? d.overridePct,
    teamId: '',
    startMonth: 1,
    shifts: p.shifts ?? defaultShifts(),
    ...p,
  } as StaffingProfile;
}

// ── The shipped library ──────────────────────────────────────────────────────
//
// Rates are STARTING POINTS, not quotes. Overwrite each one with what the
// vendor actually bills and save it back — that is what makes the number in
// the cost per deal column real.
export const BUILT_IN_PROFILES: StaffingProfile[] = [
  profile({
    id: 'bi_bpo_eg_45', label: 'Egypt BPO — 45 hr', region: 'Egypt', type: 'bpo', role: 'opener',
    hourlyRate: 6, unpaidBreakMinutes: 0, otEligible: false, seats: 1,
    shifts: weekShifts({ start: 9, end: 18 }),
    notes: 'Mon–Fri 9am–6pm PST, no unpaid break, flat rate with no overtime premium.',
  }),
  profile({
    id: 'bi_bpo_eg_40', label: 'Egypt BPO — 40 hr', region: 'Egypt', type: 'bpo', role: 'opener',
    hourlyRate: 6, unpaidBreakMinutes: 0, otEligible: false,
    shifts: weekShifts({ start: 9, end: 17 }),
    notes: 'Mon–Fri 9am–5pm PST. The standard five-day, eight-hour contractor week.',
  }),
  profile({
    id: 'bi_bpo_ph_40', label: 'Philippines BPO — 40 hr', region: 'Philippines', type: 'bpo', role: 'opener',
    hourlyRate: 6.5, unpaidBreakMinutes: 0, otEligible: false,
    shifts: weekShifts({ start: 9, end: 17 }),
    notes: 'Mon–Fri 9am–5pm PST. Night shift on their clock — confirm the shift differential is in the rate.',
  }),
  profile({
    id: 'bi_bpo_latam_40', label: 'LATAM BPO — 40 hr', region: 'Colombia / Mexico', type: 'bpo', role: 'opener',
    hourlyRate: 7.5, unpaidBreakMinutes: 0, otEligible: false,
    shifts: weekShifts({ start: 8, end: 16 }),
    notes: 'Mon–Fri 8am–4pm PST. Nearshore time zone overlap, priced above Asia-based desks.',
  }),
  profile({
    id: 'bi_bpo_sa_48', label: 'South Asia BPO — 48 hr, 6 days', region: 'Pakistan / India', type: 'bpo', role: 'opener',
    hourlyRate: 5, unpaidBreakMinutes: 0, otEligible: false,
    shifts: weekShifts({ days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], start: 9, end: 17, satStart: 6, satEnd: 14 }),
    notes: 'Mon–Fri 9am–5pm plus Saturday 6am–2pm PST. Six-day weeks are normal on these contracts.',
  }),
  profile({
    id: 'bi_bpo_pt_25', label: 'BPO part-time — 25 hr', region: 'Any', type: 'bpo', role: 'opener',
    hourlyRate: 6, unpaidBreakMinutes: 0, otEligible: false,
    shifts: weekShifts({ start: 9, end: 14 }),
    notes: 'Mon–Fri 9am–2pm PST. Peak-hours-only coverage for testing a vendor before committing.',
  }),
  profile({
    id: 'bi_ih_closer_40', label: 'In-House CA closer — 40 hr', region: 'California', type: 'inhouse', role: 'closer',
    hourlyRate: IN_HOUSE_MIN_WAGE, unpaidBreakMinutes: 60, otEligible: true,
    shifts: weekShifts({ start: 9, end: 18 }),
    notes: 'Mon–Fri 9am–6pm PST less a 60-minute unpaid meal = 40 paid hours, no overtime.',
  }),
  profile({
    id: 'bi_ih_closer_sat', label: 'In-House CA closer — 6 days (OT)', region: 'California', type: 'inhouse', role: 'closer',
    hourlyRate: IN_HOUSE_MIN_WAGE, unpaidBreakMinutes: 60, otEligible: true,
    shifts: weekShifts({ days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], start: 9, end: 18, satStart: 6, satEnd: 15 }),
    notes: 'Adds Saturday 6am–3pm. Paid hours cross 40, so the Saturday block bills at 1.5×.',
  }),
  profile({
    id: 'bi_mgr_40', label: 'Team Lead — 40 hr + override', region: 'California', type: 'manager', role: 'closer',
    hourlyRate: IN_HOUSE_MIN_WAGE, unpaidBreakMinutes: 60, otEligible: true, overridePct: 0.15,
    shifts: weekShifts({ start: 9, end: 18 }),
    notes: 'Carries a 0.15% override on the enrolled volume their team closes, on top of their own deals.',
  }),
  profile({
    id: 'bi_owner', label: 'Owner Operator — commission only', region: 'California', type: 'owner', role: 'closer',
    hourlyRate: 0, unpaidBreakMinutes: 0, otEligible: false, commissionOnly: true, overridePct: 0.25,
    shifts: weekShifts({ start: 9, end: 18 }),
    notes: 'No hourly labor cost. Still occupies closing capacity and still earns the 0.25% override.',
  }),
];

// ── Persistence ──────────────────────────────────────────────────────────────

const LS_KEY = 'ft_om_staffing_profiles_v1';

export function loadCustomProfiles(): StaffingProfile[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p: any) => p && typeof p.id === 'string' && p.shifts)
      .map((p: any) => ({ ...profile({ id: p.id, label: p.label ?? 'Untitled' }), ...p, builtIn: false }));
  } catch {
    return [];
  }
}

export function saveCustomProfiles(list: StaffingProfile[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(list.filter((p) => !p.builtIn)));
    return true;
  } catch {
    return false;
  }
}

/** How the library is laid out. Rows read like a rate sheet; cards show more. */
export type ProfileView = 'rows' | 'cards';

const LS_VIEW = 'ft_om_staffing_profile_view_v1';

export function loadProfileView(): ProfileView {
  if (typeof window === 'undefined') return 'rows';
  try {
    return window.localStorage.getItem(LS_VIEW) === 'cards' ? 'cards' : 'rows';
  } catch {
    return 'rows';
  }
}

export function saveProfileView(v: ProfileView): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(LS_VIEW, v); } catch { /* non-fatal */ }
}

// ── Conversions ──────────────────────────────────────────────────────────────

/** Fields a profile writes onto an employee. Identity and name are excluded. */
export function profilePatch(p: StaffingProfile, fallbackTeam: string): Partial<Employee> {
  return {
    type: p.type,
    role: p.role,
    hybridCloserSharePct: p.hybridCloserSharePct,
    hourlyRate: p.hourlyRate,
    unpaidBreakMinutes: p.unpaidBreakMinutes,
    otEligible: p.otEligible,
    commissionOnly: p.commissionOnly,
    overridePct: p.overridePct,
    startMonth: p.startMonth,
    teamId: p.teamId || fallbackTeam,
    shifts: JSON.parse(JSON.stringify(p.shifts)) as WeekShifts,
  };
}

/** Build `seats` new people from a profile, numbered off the existing roster. */
export function employeesFromProfile(
  p: StaffingProfile,
  roster: Employee[],
  fallbackTeam: string,
  seats = p.seats,
): Employee[] {
  const patch = profilePatch(p, fallbackTeam);
  const stem = p.label.split('—')[0].trim() || p.label;
  let taken = roster.filter((e) => e.name.startsWith(stem)).length;
  const out: Employee[] = [];
  for (let i = 0; i < Math.max(1, seats); i += 1) {
    taken += 1;
    out.push(makeEmployee({ ...patch, name: `${stem} ${taken}` }));
  }
  return out;
}

/** Turn a roster row into a saveable profile. */
export function profileFromEmployee(e: Employee, label: string): StaffingProfile {
  return {
    id: newProfileId(),
    label,
    vendor: '',
    region: '',
    notes: '',
    builtIn: false,
    seats: 1,
    type: e.type,
    role: e.role,
    hybridCloserSharePct: e.hybridCloserSharePct,
    hourlyRate: e.hourlyRate,
    unpaidBreakMinutes: e.unpaidBreakMinutes,
    otEligible: e.otEligible,
    commissionOnly: e.commissionOnly,
    overridePct: e.overridePct,
    teamId: '',
    startMonth: e.startMonth,
    shifts: JSON.parse(JSON.stringify(e.shifts)) as WeekShifts,
  };
}

// ── Preview maths ────────────────────────────────────────────────────────────

export interface ProfilePreview {
  weeklyPaidHours: number;
  otHoursPerWeek: number;
  monthlyCostPerSeat: number;
  effectiveHourlyCost: number;
  daysPerWeek: number;
  scheduleLabel: string;
  warnings: string[];
}

const DAY_INITIAL: Record<string, string> = {
  mon: 'M', tue: 'T', wed: 'W', thu: 'T', fri: 'F', sat: 'S', sun: 'S',
};

const hhmm = (h: number) => {
  const hr = Math.floor(h); const mn = Math.round((h - hr) * 60);
  const ampm = hr >= 12 ? 'pm' : 'am'; const disp = hr % 12 === 0 ? 12 : hr % 12;
  return `${disp}${mn ? ':' + String(mn).padStart(2, '0') : ''}${ampm}`;
};

export function previewProfile(p: StaffingProfile, policy: LaborPolicy): ProfilePreview {
  const emp = makeEmployee({ ...profilePatch(p, 'team-a'), name: p.label });
  const c = computeEmployeeCost(emp, policy);
  const on = DAY_KEYS.filter((d) => p.shifts[d].enabled);
  const first = on[0];
  return {
    weeklyPaidHours: c.weeklyPaidHours,
    otHoursPerWeek: c.otHoursPerWeek,
    monthlyCostPerSeat: c.monthlyCost,
    effectiveHourlyCost: c.effectiveHourlyCost,
    daysPerWeek: on.length,
    scheduleLabel: first
      ? `${on.map((d) => DAY_INITIAL[d]).join('')} · ${hhmm(p.shifts[first].start)}–${hhmm(p.shifts[first].end)}`
      : 'No shifts',
    warnings: c.warnings.filter((w) => !w.includes('paid hrs/wk exceeds')),
  };
}
