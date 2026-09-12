import { hasDatabase, query } from './db';
import { reconcile, reconSummary } from './recon';
import { buildScorecards } from './scorecards';
import { demoDashboard } from './demo';
import type {
  Agent, AttendanceDay, BackendFile, BackendKey, CallRecord, DashboardData, Enrollment, Period,
} from './types';

/**
 * Read layer for the dashboard. One call assembles the whole period, because
 * every panel is a different cut of the same window and the reconciliation
 * needs enrollments and backend files side by side anyway.
 *
 * With no DATABASE_URL configured the demo payload is returned instead, so the
 * page can be reviewed and shaped before any credentials exist. It is labelled
 * as sample data in the UI — never silently.
 */

const CALL_PAGE = 500;

export type { DashboardData, Period };

export async function loadDashboard(period: Period): Promise<DashboardData> {
  if (!hasDatabase()) return demoDashboard(period);

  const [agentRows, attendanceRows, callRows, callCount, enrollmentRows, fileRows, overrideRows, syncRows] =
    await Promise.all([
      query<any>(`select * from ao_agents order by name`),
      query<any>(
        `select * from ao_attendance_days where day between $1 and $2 order by day desc, agent_id`,
        [period.from, period.to],
      ),
      query<any>(
        `select * from ao_calls where started_at >= $1 and started_at < ($2::date + 1)
         order by started_at desc limit ${CALL_PAGE}`,
        [period.from, period.to],
      ),
      query<any>(
        `select count(*)::int as n from ao_calls where started_at >= $1 and started_at < ($2::date + 1)`,
        [period.from, period.to],
      ),
      query<any>(
        `select * from ao_enrollments where enrolled_at >= $1 and enrolled_at < ($2::date + 1)
         order by enrolled_at desc`,
        [period.from, period.to],
      ),
      query<any>(
        `select * from ao_backend_files
         where coalesce(payout_at, first_payment_at, imported_at::date) between $1 and $2
         order by coalesce(payout_at, first_payment_at) desc nulls last`,
        [period.from, period.to],
      ),
      query<any>(
        `select entity, entity_id, count(*)::int as n from ao_overrides
         where reverted_at is null group by entity, entity_id`,
      ),
      query<any>(`select * from ao_sync_runs order by started_at desc limit 1`),
    ]);

  const agents = agentRows.map(toAgent);
  const attendance = attendanceRows.map(toAttendance);
  const calls = callRows.map(toCall);
  const enrollments = enrollmentRows.map(toEnrollment);
  const files = fileRows.map(toFile);
  const recon = reconcile({ enrollments, files });

  const overrideFlags: Record<string, number> = {};
  overrideRows.forEach((r: any) => { overrideFlags[`${r.entity}|${r.entity_id}`] = r.n; });

  const sync = syncRows[0];

  return {
    demo: false,
    period,
    agents,
    attendance,
    calls,
    callTotal: callCount[0]?.n ?? calls.length,
    enrollments,
    files,
    recon,
    reconTotals: reconSummary(recon),
    scorecards: buildScorecards({ agents, attendance, calls, enrollments, recon }),
    overrideFlags,
    lastSync: sync
      ? {
        at: new Date(sync.finished_at ?? sync.started_at).toISOString(),
        ok: sync.ok, counts: sync.counts, error: sync.error,
      }
      : null,
  };
}

// ── Row mappers ──────────────────────────────────────────────────────────────

const num = (v: any): number | null => (v === null || v === undefined ? null : Number(v));

function toAgent(r: any): Agent {
  return {
    id: r.id, locationId: r.location_id, name: r.name ?? '(unnamed)', email: r.email,
    role: r.role, employmentType: r.employment_type,
    hourlyRate: num(r.hourly_rate), scheduledHoursPerWeek: num(r.scheduled_hours_per_week),
    team: r.team, active: r.active !== false,
  };
}

function toAttendance(r: any): AttendanceDay {
  return {
    agentId: r.agent_id,
    day: typeof r.day === 'string' ? r.day.slice(0, 10) : new Date(r.day).toISOString().slice(0, 10),
    firstEvent: r.first_event ? new Date(r.first_event).toISOString() : null,
    lastEvent: r.last_event ? new Date(r.last_event).toISOString() : null,
    activeMinutes: Number(r.active_minutes ?? 0),
    spanMinutes: Number(r.span_minutes ?? 0),
    gapMinutes: Number(r.gap_minutes ?? 0),
    sessions: Number(r.sessions ?? 0),
    calls: Number(r.calls ?? 0),
    talkMinutes: Number(r.talk_minutes ?? 0),
    enrollments: Number(r.enrollments ?? 0),
    scheduledMinutes: Number(r.scheduled_minutes ?? 0),
  };
}

function toCall(r: any): CallRecord {
  return {
    id: r.id, locationId: r.location_id, agentId: r.agent_id, contactId: r.contact_id,
    contactName: r.contact_name, direction: r.direction,
    startedAt: new Date(r.started_at).toISOString(),
    durationSeconds: Number(r.duration_seconds ?? 0),
    talkSeconds: Number(r.talk_seconds ?? 0),
    status: r.status, disposition: r.disposition,
    fromNumber: r.from_number, toNumber: r.to_number, recordingUrl: r.recording_url,
  };
}

function toEnrollment(r: any): Enrollment {
  return {
    id: r.id, locationId: r.location_id, agentId: r.agent_id, contactId: r.contact_id,
    clientName: r.client_name, clientPhone: r.client_phone, clientEmail: r.client_email,
    backend: (r.backend ?? 'UNKNOWN') as BackendKey,
    pipeline: r.pipeline, stage: r.stage, status: r.status,
    enrolledDebt: num(r.enrolled_debt),
    enrolledAt: r.enrolled_at ? new Date(r.enrolled_at).toISOString() : null,
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
  };
}

function toFile(r: any): BackendFile {
  return {
    id: Number(r.id), backend: (r.backend ?? 'UNKNOWN') as BackendKey, externalId: r.external_id,
    clientName: r.client_name, clientPhone: r.client_phone, clientLast4: r.client_last4,
    fileStatus: r.file_status, enrolledDebt: num(r.enrolled_debt),
    firstPaymentAt: r.first_payment_at ? String(r.first_payment_at).slice(0, 10) : null,
    payoutAmount: num(r.payout_amount),
    payoutAt: r.payout_at ? String(r.payout_at).slice(0, 10) : null,
    period: r.period, batchId: r.batch_id ? Number(r.batch_id) : null,
  };
}
