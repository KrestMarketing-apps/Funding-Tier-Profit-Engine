import type { ActivityEvent, AttendanceDay, CallRecord } from './types';

/**
 * Attendance, inferred from what the agent actually did in GoHighLevel.
 *
 * Nobody clocks in. A day is reconstructed from the timestamps of their real
 * work — calls placed and taken, outbound messages, opportunities created —
 * grouped into sessions. Two events closer together than the idle threshold
 * belong to the same session; a longer silence ends it and starts a new one.
 *
 *   span   = first event → last event, gaps included ("at the desk")
 *   active = the sessions only, gaps removed ("actually working")
 *   gap    = span − active ("paid, produced nothing")
 *
 * That third number is the one worth having. It is an estimate, not a
 * time clock, and the UI says so — a rep on a 50-minute enrollment call logs
 * one event at the end of it, which is why call duration is credited
 * explicitly below rather than left to the gap logic.
 */

/** A silence longer than this ends the session. */
export const IDLE_GAP_MINUTES = Number(process.env.AO_IDLE_GAP_MINUTES || 45);

/** Credit for a session's trailing event, which has no "end" of its own. */
export const TAIL_MINUTES = Number(process.env.AO_TAIL_MINUTES || 5);

/** Time zone the business runs on. Days break here, not at UTC midnight. */
export const TZ = process.env.AO_TIMEZONE || 'America/Los_Angeles';

const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Local calendar day (YYYY-MM-DD) for an instant, in the business time zone. */
export function localDay(iso: string): string {
  return dayFmt.format(new Date(iso));
}

export interface Session {
  start: string;
  end: string;
  minutes: number;
  events: number;
}

/** Group one agent-day's events into working sessions. */
export function sessionsFor(events: ActivityEvent[], callSecondsByRef: Map<string, number>): Session[] {
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  const out: Session[] = [];
  let cur: { start: number; end: number; events: number } | null = null;

  for (const e of sorted) {
    const t = new Date(e.at).getTime();
    // A call's timestamp is when it ended; credit its duration backwards so a
    // long call reads as worked time rather than as a gap.
    const callSecs = e.kind === 'call' ? (callSecondsByRef.get(e.ref ?? '') ?? 0) : 0;
    const startT = t - callSecs * 1000;

    if (cur && startT - cur.end <= IDLE_GAP_MINUTES * 60_000) {
      cur.end = Math.max(cur.end, t);
      cur.events += 1;
    } else {
      if (cur) out.push(finish(cur));
      cur = { start: startT, end: t, events: 1 };
    }
  }
  if (cur) out.push(finish(cur));
  return out;

  function finish(s: { start: number; end: number; events: number }): Session {
    const minutes = Math.max(TAIL_MINUTES, Math.round((s.end - s.start) / 60_000) + TAIL_MINUTES);
    return { start: new Date(s.start).toISOString(), end: new Date(s.end).toISOString(), minutes, events: s.events };
  }
}

export interface DayInput {
  agentId: string;
  locationId: string | null;
  day: string;
  events: ActivityEvent[];
  calls: CallRecord[];
  enrollments: number;
  scheduledMinutes: number;
}

export function buildAttendanceDay(input: DayInput): AttendanceDay {
  const callSeconds = new Map<string, number>();
  input.calls.forEach((c) => callSeconds.set(c.id, c.durationSeconds || 0));

  const sessions = sessionsFor(input.events, callSeconds);
  const active = sessions.reduce((s, x) => s + x.minutes, 0);

  const times = input.events.map((e) => new Date(e.at).getTime()).sort((a, b) => a - b);
  const first = times[0] ?? null;
  const last = times[times.length - 1] ?? null;
  const span = first != null && last != null ? Math.round((last - first) / 60_000) + TAIL_MINUTES : 0;

  return {
    agentId: input.agentId,
    day: input.day,
    firstEvent: first != null ? new Date(first).toISOString() : null,
    lastEvent: last != null ? new Date(last).toISOString() : null,
    activeMinutes: active,
    spanMinutes: Math.max(span, active),
    gapMinutes: Math.max(0, Math.max(span, active) - active),
    sessions: sessions.length,
    calls: input.calls.length,
    talkMinutes: Math.round(input.calls.reduce((s, c) => s + (c.talkSeconds || 0), 0) / 60),
    enrollments: input.enrollments,
    scheduledMinutes: input.scheduledMinutes,
  };
}

/** Roll a window of events and calls into one row per agent per day. */
export function buildAttendance(
  events: ActivityEvent[],
  calls: CallRecord[],
  enrollmentsByAgentDay: Map<string, number>,
  scheduledMinutesByAgent: Map<string, number>,
): AttendanceDay[] {
  const byKey = new Map<string, { agentId: string; locationId: string | null; day: string; events: ActivityEvent[]; calls: CallRecord[] }>();

  const slot = (agentId: string | null, locationId: string | null, at: string) => {
    if (!agentId) return null;
    const day = localDay(at);
    const key = `${agentId}|${day}`;
    if (!byKey.has(key)) byKey.set(key, { agentId, locationId, day, events: [], calls: [] });
    return byKey.get(key)!;
  };

  events.forEach((e) => slot(e.agentId, e.locationId, e.at)?.events.push(e));
  calls.forEach((c) => slot(c.agentId, c.locationId, c.startedAt)?.calls.push(c));

  return [...byKey.values()].map((v) => buildAttendanceDay({
    ...v,
    enrollments: enrollmentsByAgentDay.get(`${v.agentId}|${v.day}`) ?? 0,
    // A daily target from the weekly schedule: five working days a week.
    scheduledMinutes: Math.round((scheduledMinutesByAgent.get(v.agentId) ?? 0) / 5),
  }));
}
