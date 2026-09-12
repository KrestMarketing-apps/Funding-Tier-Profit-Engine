'use client';
import React, { useMemo, useState } from 'react';
import type { DashboardData } from '../../lib/agentOps/types';
import { Callout, Panel, T, fmtNum, td, tdNum, th } from '../operatingModel/ui';
import { Empty, Pill, Tile, Tiles, clock, dayLabel } from './parts';

/**
 * Attendance, reconstructed from GoHighLevel activity. Nobody clocks in, so a
 * day is the span between an agent's first and last real action, with idle
 * gaps longer than the threshold removed.
 *
 * Read the grid as: how much of the day did work actually happen in. The
 * colour is the share of scheduled minutes that came back as active.
 */
export function AttendancePanel({ data }: { data: DashboardData }) {
  const [selected, setSelected] = useState<string | null>(null);

  const days = useMemo(
    () => [...new Set(data.attendance.map((a) => a.day))].sort(),
    [data.attendance],
  );
  const agents = useMemo(
    () => data.agents.filter((a) => data.attendance.some((d) => d.agentId === a.id)),
    [data.agents, data.attendance],
  );
  const byKey = useMemo(() => {
    const m = new Map<string, typeof data.attendance[number]>();
    data.attendance.forEach((a) => m.set(`${a.agentId}|${a.day}`, a));
    return m;
  }, [data.attendance]);

  const totals = data.attendance.reduce((acc, a) => ({
    active: acc.active + a.activeMinutes,
    scheduled: acc.scheduled + a.scheduledMinutes,
    gap: acc.gap + a.gapMinutes,
    late: acc.late + (isLate(a.firstEvent) ? 1 : 0),
    shifts: acc.shifts + 1,
  }), { active: 0, scheduled: 0, gap: 0, late: 0, shifts: 0 });

  const expectedShifts = agents.length * days.length;
  const missed = Math.max(0, expectedShifts - totals.shifts);

  const detail = selected ? data.attendance.filter((a) => a.day === selected) : [];

  return (
    <>
      <Tiles>
        <Tile label="Active hours" value={fmtNum(totals.active / 60, 0)} note="idle gaps removed" />
        <Tile label="Scheduled hours" value={fmtNum(totals.scheduled / 60, 0)} note={`${agents.length} agents · ${days.length} days`} />
        <Tile label="Idle inside the day" value={fmtNum(totals.gap / 60, 0)}
          note="paid span that produced nothing" tone={totals.gap > totals.active * 0.25 ? 'warn' : 'plain'} />
        <Tile label="Late starts" value={String(totals.late)} note="first action after 9:30am PT"
          tone={totals.late > 0 ? 'warn' : 'good'} />
        <Tile label="Days with no activity" value={String(missed)} note="agent-days with nothing logged"
          tone={missed > 0 ? 'bad' : 'good'} />
        <Tile label="Utilization" value={totals.scheduled ? `${fmtNum((totals.active / totals.scheduled) * 100, 0)}%` : '—'}
          note="active ÷ scheduled" />
      </Tiles>

      <Panel
        title="Attendance grid"
        accent={T.accent}
        tooltip="Each cell is one agent-day: active hours, with the colour showing how much of the scheduled day that covered. Click a column heading to open that day."
        subtitle="Inferred from GoHighLevel activity — calls, outbound messages, opportunities. Not a time clock."
      >
        {days.length === 0 ? <Empty>No attendance in this period.</Empty> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...th, minWidth: 160 }}>Agent</th>
                  {days.map((d) => (
                    <th key={d} style={{ ...th, textAlign: 'center', cursor: 'pointer' }}
                      onClick={() => setSelected(selected === d ? null : d)}
                      title="Open this day">
                      {dayLabel(d)}
                    </th>
                  ))}
                  <th style={{ ...th, textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => {
                  const row = days.map((d) => byKey.get(`${agent.id}|${d}`));
                  const total = row.reduce((s, a) => s + (a?.activeMinutes ?? 0), 0);
                  return (
                    <tr key={agent.id}>
                      <td style={{ ...td, fontWeight: 700, color: T.ink }}>
                        {agent.name}
                        <div style={{ fontSize: 10, color: T.faint, fontWeight: 400 }}>
                          {agent.employmentType ?? '—'}{agent.scheduledHoursPerWeek ? ` · ${agent.scheduledHoursPerWeek} hr/wk` : ''}
                        </div>
                      </td>
                      {row.map((a, i) => <Cell key={days[i]} a={a} />)}
                      <td style={{ ...tdNum, fontWeight: 800, color: T.ink }}>{fmtNum(total / 60, 1)}h</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Callout>
          <strong>How a day is built.</strong> Events closer together than the idle threshold (45 minutes by default)
          belong to the same session; a longer silence ends it. Active time is the sessions only. A long enrollment
          call is credited at its full duration, so a rep on a 50-minute call does not read as idle.
        </Callout>
      </Panel>

      {selected && (
        <Panel title={`${dayLabel(selected)} — by agent`} accent={T.brand} collapsible defaultOpen
          subtitle="First and last action, sessions, and what came out of the day.">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={th}>Agent</th>
                  <th style={th}>First</th>
                  <th style={th}>Last</th>
                  <th style={{ ...th, textAlign: 'right' }}>Active</th>
                  <th style={{ ...th, textAlign: 'right' }}>Span</th>
                  <th style={{ ...th, textAlign: 'right' }}>Idle</th>
                  <th style={{ ...th, textAlign: 'right' }}>Sessions</th>
                  <th style={{ ...th, textAlign: 'right' }}>Calls</th>
                  <th style={{ ...th, textAlign: 'right' }}>Talk</th>
                  <th style={{ ...th, textAlign: 'right' }}>Deals</th>
                  <th style={th}>Flags</th>
                </tr>
              </thead>
              <tbody>
                {detail.map((a) => {
                  const agent = data.agents.find((x) => x.id === a.agentId);
                  return (
                    <tr key={a.agentId}>
                      <td style={{ ...td, fontWeight: 600 }}>{agent?.name ?? a.agentId}</td>
                      <td style={td}>{clock(a.firstEvent)}</td>
                      <td style={td}>{clock(a.lastEvent)}</td>
                      <td style={tdNum}>{fmtNum(a.activeMinutes / 60, 1)}h</td>
                      <td style={tdNum}>{fmtNum(a.spanMinutes / 60, 1)}h</td>
                      <td style={{ ...tdNum, color: a.gapMinutes > 60 ? T.warn : T.body }}>{fmtNum(a.gapMinutes / 60, 1)}h</td>
                      <td style={tdNum}>{a.sessions}</td>
                      <td style={tdNum}>{a.calls}</td>
                      <td style={tdNum}>{fmtNum(a.talkMinutes / 60, 1)}h</td>
                      <td style={tdNum}>{a.enrollments}</td>
                      <td style={td}>
                        <span style={{ display: 'flex', gap: 4 }}>
                          {isLate(a.firstEvent) && <Pill tone="warn">late start</Pill>}
                          {a.scheduledMinutes > 0 && a.activeMinutes < a.scheduledMinutes * 0.6 && <Pill tone="bad">short day</Pill>}
                          {a.calls === 0 && <Pill tone="bad">no calls</Pill>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}

function Cell({ a }: { a: { activeMinutes: number; scheduledMinutes: number; gapMinutes: number } | undefined }) {
  if (!a) {
    return <td style={{ ...td, textAlign: 'center', background: T.badBg, color: T.bad, fontSize: 11 }} title="Nothing logged that day">—</td>;
  }
  const share = a.scheduledMinutes > 0 ? a.activeMinutes / a.scheduledMinutes : 1;
  const bg = share >= 0.9 ? '#e9f7f3' : share >= 0.7 ? '#f3faf8' : share >= 0.5 ? T.warnBg : T.badBg;
  const fg = share >= 0.7 ? T.ink : share >= 0.5 ? T.warn : T.bad;
  return (
    <td style={{ ...td, textAlign: 'center', background: bg, color: fg, fontFamily: T.mono, fontSize: 11.5 }}
      title={`${fmtNum(a.activeMinutes / 60, 1)}h active of ${fmtNum(a.scheduledMinutes / 60, 1)}h scheduled · ${fmtNum(a.gapMinutes / 60, 1)}h idle`}>
      {fmtNum(a.activeMinutes / 60, 1)}
    </td>
  );
}

/** First action after 9:30am Pacific counts as a late start. */
function isLate(firstEvent: string | null): boolean {
  if (!firstEvent) return false;
  const local = new Date(firstEvent).toLocaleTimeString('en-GB', { timeZone: 'America/Los_Angeles', hour12: false });
  return local > '09:30:00';
}
