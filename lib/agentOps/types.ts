// ─────────────────────────────────────────────────────────────────────────────
// Agent Ops — shared types
//
// One vocabulary for three questions:
//   1. Was the agent working?          (attendance, inferred from GHL activity)
//   2. What did they actually do?      (call detail)
//   3. Did it turn into paid business? (enrollments, cross-checked against the
//                                       backends' own file status and payouts)
// ─────────────────────────────────────────────────────────────────────────────

export type BackendKey = 'LEVEL' | 'CS' | 'LEGACY' | 'UNKNOWN';

export const BACKEND_LABEL: Record<BackendKey, string> = {
  LEVEL: 'Level Debt',
  CS: 'Shield Services',
  LEGACY: 'Elite Legal Practice',
  UNKNOWN: 'Unassigned',
};

export interface Agent {
  id: string;                 // GoHighLevel userId
  locationId: string;
  name: string;
  email: string | null;
  role: string | null;        // opener | closer | hybrid | manager
  employmentType: string | null; // inhouse | bpo | manager | owner
  hourlyRate: number | null;
  scheduledHoursPerWeek: number | null;
  team: string | null;
  active: boolean;
}

/** Any timestamped thing an agent did. The raw material for attendance. */
export interface ActivityEvent {
  id: string;
  locationId: string;
  agentId: string | null;
  at: string;                 // ISO
  kind: 'call' | 'message' | 'note' | 'opportunity' | 'contact' | 'appointment';
  ref: string | null;
}

export interface CallRecord {
  id: string;
  locationId: string;
  agentId: string | null;
  contactId: string | null;
  contactName: string | null;
  direction: 'inbound' | 'outbound' | null;
  startedAt: string;
  durationSeconds: number;
  talkSeconds: number;
  status: string | null;      // completed | no-answer | busy | voicemail | failed | canceled
  disposition: string | null;
  fromNumber: string | null;
  toNumber: string | null;
  recordingUrl: string | null;
}

export interface Enrollment {
  id: string;                 // GHL opportunityId
  locationId: string;
  agentId: string | null;
  contactId: string | null;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  backend: BackendKey;
  pipeline: string | null;
  stage: string | null;
  status: string | null;      // open | won | lost | abandoned
  enrolledDebt: number | null;
  enrolledAt: string | null;
  updatedAt: string | null;
}

/** A row from a backend's own report — the source of truth for money. */
export interface BackendFile {
  id: number;
  backend: BackendKey;
  externalId: string | null;
  clientName: string | null;
  clientPhone: string | null;
  clientLast4: string | null;
  fileStatus: string | null;  // funded | active | pending | cancelled | refunded | chargeback
  enrolledDebt: number | null;
  firstPaymentAt: string | null;
  payoutAmount: number | null;
  payoutAt: string | null;
  period: string | null;
  batchId: number | null;
}

export type MatchStatus =
  | 'matched'                 // GHL enrollment and backend file agree
  | 'amount_mismatch'         // matched, but enrolled debt or payout differs
  | 'status_mismatch'         // backend says cancelled/refunded, GHL says won
  | 'missing_at_backend'      // rep claims it; the backend has no such file
  | 'unclaimed_at_backend';   // backend paid for a file no rep is credited with

export interface ReconMatch {
  id: number;
  enrollmentId: string | null;
  backendFileId: number | null;
  status: MatchStatus;
  method: 'phone' | 'last4_name' | 'name_debt' | 'external_id' | 'manual' | null;
  confidence: number;
  deltaAmount: number | null;
}

export interface AttendanceDay {
  agentId: string;
  day: string;                // YYYY-MM-DD
  firstEvent: string | null;
  lastEvent: string | null;
  /** Minutes inside working sessions — idle gaps over the threshold removed. */
  activeMinutes: number;
  /** First event to last event, gaps included. */
  spanMinutes: number;
  gapMinutes: number;
  sessions: number;
  calls: number;
  talkMinutes: number;
  enrollments: number;
  scheduledMinutes: number;
}

/** Every admin edit to synced data. Nothing is changed quietly. */
export interface OverrideRecord {
  id: number;
  entity: string;
  entityId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  adminEmail: string;
  at: string;
  revertedAt: string | null;
}

/** One agent, one period: hours in, work done, money out the other end. */
export interface Scorecard {
  agent: Agent;
  days: number;
  activeHours: number;
  scheduledHours: number;
  paidCost: number;
  calls: number;
  talkHours: number;
  connects: number;
  enrollments: number;
  enrolledDebt: number;
  confirmedByBackend: number;
  confirmedPayout: number;
  disputed: number;
  costPerEnrollment: number | null;
  costPerConfirmed: number | null;
}

export interface SyncCounts {
  agents: number;
  events: number;
  calls: number;
  enrollments: number;
  attendanceDays: number;
}

// ── Dashboard payload ────────────────────────────────────────────────────────

export interface Period { from: string; to: string }

export interface ReconTotals {
  total: number;
  matched: number;
  amountMismatch: number;
  statusMismatch: number;
  missingAtBackend: number;
  unclaimedAtBackend: number;
  confirmedPayout: number;
  unclaimedPayout: number;
}

export interface ReconRowLike {
  enrollmentId: string | null;
  backendFileId: number | null;
  status: MatchStatus;
  method: ReconMatch['method'];
  confidence: number;
  deltaAmount: number | null;
  enrollment: Enrollment | null;
  file: BackendFile | null;
  explanation: string;
}

export interface DashboardData {
  /** true when the numbers are sample data, not the floor. Always shown. */
  demo: boolean;
  period: Period;
  agents: Agent[];
  attendance: AttendanceDay[];
  calls: CallRecord[];
  callTotal: number;
  enrollments: Enrollment[];
  files: BackendFile[];
  recon: ReconRowLike[];
  reconTotals: ReconTotals;
  scorecards: Scorecard[];
  overrideFlags: Record<string, number>;
  lastSync: { at: string | null; ok: boolean | null; counts: any; error: string | null } | null;
}
