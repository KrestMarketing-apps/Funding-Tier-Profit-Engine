import { query } from './db';
import { fetchAgents, fetchCallsAndActivity, fetchEnrollments, ghlConfigs, type GhlConfig } from './ghl';
import { buildAttendance, localDay } from './attendance';
import { recomputeCloserPay } from './closerPayJob';
import type { ActivityEvent, CallRecord, Enrollment, SyncCounts } from './types';

/**
 * The sync: pull a window of GoHighLevel activity and write it down.
 *
 * Everything is upserted on a natural key, so re-running the same window
 * corrects rather than duplicates — which is what makes a 15-minute cron and a
 * manual backfill safe to run over each other.
 */

const CHUNK = 200;

/** Multi-row INSERT ... ON CONFLICT, chunked so no statement gets enormous. */
async function upsert(
  table: string,
  columns: string[],
  rows: any[][],
  conflict: string,
  updateColumns: string[],
): Promise<number> {
  let written = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const params: any[] = [];
    const values = chunk.map((row) => {
      const placeholders = row.map((v) => { params.push(v); return `$${params.length}`; });
      return `(${placeholders.join(',')})`;
    }).join(',');
    // An entry containing "=" is a raw assignment (for columns that must not be
    // blindly overwritten); anything else is copied from the incoming row.
    const setClause = updateColumns.length
      ? `do update set ${updateColumns.map((c) => (c.includes('=') ? c : `${c} = excluded.${c}`)).join(', ')}`
      : 'do nothing';
    await query(
      `insert into ${table} (${columns.join(',')}) values ${values} on conflict ${conflict} ${setClause}`,
      params,
    );
    written += chunk.length;
  }
  return written;
}

export interface SyncOptions {
  /** How far back to pull. Default 2 days — the cron overlaps itself on purpose. */
  sinceHours?: number;
  configs?: GhlConfig[];
}

export async function runSync(opts: SyncOptions = {}): Promise<{ counts: SyncCounts; runId: number | null; errors: string[] }> {
  const sinceHours = opts.sinceHours ?? Number(process.env.AO_SYNC_WINDOW_HOURS || 48);
  const since = new Date(Date.now() - sinceHours * 3600_000);
  const configs = opts.configs ?? ghlConfigs();
  const errors: string[] = [];
  const counts: SyncCounts = { agents: 0, events: 0, calls: 0, enrollments: 0, attendanceDays: 0 };

  const runRows = await query<{ id: number }>(
    `insert into ao_sync_runs (source, window_from, window_to) values ($1, $2, $3) returning id`,
    ['ghl', since.toISOString(), new Date().toISOString()],
  );
  const runId = runRows[0]?.id ?? null;

  const allEvents: ActivityEvent[] = [];
  const allCalls: CallRecord[] = [];
  const allEnrollments: Enrollment[] = [];

  for (const cfg of configs) {
    try {
      const agents = await fetchAgents(cfg);
      if (agents.length) {
        counts.agents += await upsert(
          'ao_agents',
          ['id', 'location_id', 'name', 'email', 'active', 'updated_at'],
          agents.map((a) => [a.id, a.locationId, a.name, a.email, a.active, new Date().toISOString()]),
          '(id)',
          // Only fields GHL owns are refreshed. Rate, role, team and schedule
          // are set here in the app and must survive every sync.
          ['location_id', 'name', 'email', 'active', 'updated_at'],
        );
      }

      const { calls, events } = await fetchCallsAndActivity(cfg, since);
      allCalls.push(...calls);
      allEvents.push(...events);

      const { enrollments, events: oppEvents } = await fetchEnrollments(cfg, since);
      allEnrollments.push(...enrollments);
      allEvents.push(...oppEvents);
    } catch (e: any) {
      errors.push(`${cfg.locationId}: ${e?.message ?? String(e)}${e?.body ? ` — ${String(e.body).slice(0, 300)}` : ''}`);
    }
  }

  if (allCalls.length) {
    counts.calls = await upsert(
      'ao_calls',
      ['id', 'location_id', 'agent_id', 'contact_id', 'contact_name', 'direction', 'started_at',
        'duration_seconds', 'talk_seconds', 'status', 'disposition', 'from_number', 'to_number', 'recording_url'],
      allCalls.map((c) => [c.id, c.locationId, c.agentId, c.contactId, c.contactName, c.direction, c.startedAt,
        c.durationSeconds, c.talkSeconds, c.status, c.disposition, c.fromNumber, c.toNumber, c.recordingUrl]),
      '(id)',
      ['agent_id', 'contact_name', 'direction', 'duration_seconds', 'talk_seconds', 'status', 'disposition', 'recording_url'],
    );
  }

  if (allEvents.length) {
    counts.events = await upsert(
      'ao_events',
      ['id', 'location_id', 'agent_id', 'at', 'kind', 'ref'],
      allEvents.map((e) => [e.id, e.locationId, e.agentId, e.at, e.kind, e.ref]),
      '(id)',
      ['agent_id', 'at', 'kind'],
    );
  }

  if (allEnrollments.length) {
    counts.enrollments = await upsert(
      'ao_enrollments',
      ['id', 'location_id', 'agent_id', 'contact_id', 'client_name', 'client_phone', 'client_email',
        'backend', 'pipeline', 'stage', 'status', 'enrolled_debt', 'enrolled_at', 'updated_at',
        'closer_agent_id', 'closer_source', 'is_enrolled', 'first_enrolled_at', 'backend_file_ref'],
      allEnrollments.map((e) => [e.id, e.locationId, e.agentId, e.contactId, e.clientName, e.clientPhone, e.clientEmail,
        e.backend, e.pipeline, e.stage, e.status, e.enrolledDebt, e.enrolledAt, e.updatedAt,
        e.closerId, e.closerSource, e.isEnrolled, e.firstEnrolledAt, e.backendFileRef]),
      '(id)',
      [
        'agent_id', 'client_name', 'client_phone', 'client_email', 'pipeline', 'stage', 'status',
        'enrolled_debt', 'updated_at',
        // A later stage with no backend in its name ("FIRST PAYMENT MADE") must
        // not erase the backend learned from the enrollment stage.
        `backend = case when excluded.backend <> 'UNKNOWN' then excluded.backend else ao_enrollments.backend end`,
        // Once enrolled, always enrolled — a cancelled deal was still a deal.
        'is_enrolled = ao_enrollments.is_enrolled or excluded.is_enrolled',
        'first_enrolled_at = coalesce(ao_enrollments.first_enrolled_at, excluded.first_enrolled_at)',
        'backend_file_ref = coalesce(excluded.backend_file_ref, ao_enrollments.backend_file_ref)',
        // Credit is frozen at the first stamp. Only an explicit Closer field in
        // GHL can replace it, and nothing replaces an admin override.
        `closer_agent_id = case
           when ao_enrollments.closer_source = 'override' then ao_enrollments.closer_agent_id
           when excluded.closer_source = 'ghl_field' then excluded.closer_agent_id
           else coalesce(ao_enrollments.closer_agent_id, excluded.closer_agent_id) end`,
        `closer_source = case
           when ao_enrollments.closer_source = 'override' then ao_enrollments.closer_source
           when excluded.closer_source = 'ghl_field' then excluded.closer_source
           when ao_enrollments.closer_agent_id is not null then ao_enrollments.closer_source
           else excluded.closer_source end`,
      ],
    );
  }

  counts.attendanceDays = await rebuildAttendance(since);

  // Credit and stage changes feed closer pay — keep it current on every sync.
  try { await recomputeCloserPay(); } catch (e: any) { errors.push(`closer pay: ${e?.message ?? String(e)}`); }

  await query(
    `update ao_sync_runs set finished_at = now(), ok = $2, counts = $3, error = $4 where id = $1`,
    [runId, errors.length === 0, JSON.stringify(counts), errors.join(' | ') || null],
  );

  return { counts, runId, errors };
}

/**
 * Recompute attendance for every day touched by the window. Reads back from
 * the tables rather than the fetch result, so a backfill and a cron run both
 * produce the same rows.
 */
export async function rebuildAttendance(since: Date): Promise<number> {
  const events = await query<any>(
    `select id, location_id, agent_id, at, kind, ref from ao_events where at >= $1 and agent_id is not null`,
    [since.toISOString()],
  );
  if (events.length === 0) return 0;

  const calls = await query<any>(
    `select id, location_id, agent_id, started_at, duration_seconds, talk_seconds from ao_calls where started_at >= $1`,
    [since.toISOString()],
  );
  const enrollments = await query<any>(
    `select coalesce(closer_agent_id, agent_id) as agent_id, coalesce(first_enrolled_at, enrolled_at) as enrolled_at
       from ao_enrollments
      where is_enrolled and coalesce(first_enrolled_at, enrolled_at) >= $1
        and coalesce(closer_agent_id, agent_id) is not null`,
    [since.toISOString()],
  );
  const agents = await query<any>(`select id, scheduled_hours_per_week from ao_agents`);

  const enrollmentsByAgentDay = new Map<string, number>();
  enrollments.forEach((e) => {
    const key = `${e.agent_id}|${localDay(new Date(e.enrolled_at).toISOString())}`;
    enrollmentsByAgentDay.set(key, (enrollmentsByAgentDay.get(key) ?? 0) + 1);
  });

  const scheduled = new Map<string, number>();
  agents.forEach((a) => scheduled.set(a.id, Number(a.scheduled_hours_per_week ?? 0) * 60));

  const days = buildAttendance(
    events.map((e) => ({
      id: e.id, locationId: e.location_id, agentId: e.agent_id,
      at: new Date(e.at).toISOString(), kind: e.kind, ref: e.ref,
    })),
    calls.map((c) => ({
      id: c.id, locationId: c.location_id, agentId: c.agent_id, contactId: null, contactName: null,
      direction: null, startedAt: new Date(c.started_at).toISOString(),
      durationSeconds: Number(c.duration_seconds ?? 0), talkSeconds: Number(c.talk_seconds ?? 0),
      status: null, disposition: null, fromNumber: null, toNumber: null, recordingUrl: null,
    })),
    enrollmentsByAgentDay,
    scheduled,
  );

  if (days.length === 0) return 0;
  return upsert(
    'ao_attendance_days',
    ['agent_id', 'day', 'first_event', 'last_event', 'active_minutes', 'span_minutes', 'gap_minutes',
      'sessions', 'calls', 'talk_minutes', 'enrollments', 'scheduled_minutes', 'computed_at'],
    days.map((d) => [d.agentId, d.day, d.firstEvent, d.lastEvent, d.activeMinutes, d.spanMinutes, d.gapMinutes,
      d.sessions, d.calls, d.talkMinutes, d.enrollments, d.scheduledMinutes, new Date().toISOString()]),
    '(agent_id, day)',
    ['first_event', 'last_event', 'active_minutes', 'span_minutes', 'gap_minutes', 'sessions', 'calls',
      'talk_minutes', 'enrollments', 'scheduled_minutes', 'computed_at'],
  );
}
