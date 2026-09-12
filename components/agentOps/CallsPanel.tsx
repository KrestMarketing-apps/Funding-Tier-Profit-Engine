'use client';
import React, { useMemo, useState } from 'react';
import type { DashboardData } from '../../lib/agentOps/types';
import { Btn, Panel, T, fmtNum, inputStyle, td, tdNum, th } from '../operatingModel/ui';
import { Empty, Pill, Tile, Tiles, mmss } from './parts';

/**
 * Every call, with the detail GoHighLevel's own reporting will not give you in
 * one place: who made it, how long they were actually talking, how it ended,
 * and the recording.
 */
export function CallsPanel({ data }: { data: DashboardData }) {
  const [agent, setAgent] = useState('');
  const [direction, setDirection] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(100);

  const agentName = useMemo(() => {
    const m = new Map(data.agents.map((a) => [a.id, a.name]));
    return (id: string | null) => (id ? m.get(id) ?? id : '— unassigned —');
  }, [data.agents]);

  const statuses = useMemo(
    () => [...new Set(data.calls.map((c) => c.status).filter(Boolean) as string[])].sort(),
    [data.calls],
  );

  const filtered = data.calls.filter((c) => {
    if (agent && c.agentId !== agent) return false;
    if (direction && c.direction !== direction) return false;
    if (status && c.status !== status) return false;
    if (q.trim()) {
      const hay = `${c.contactName ?? ''} ${c.toNumber ?? ''} ${c.fromNumber ?? ''} ${c.disposition ?? ''}`.toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  });

  const connects = filtered.filter((c) => c.talkSeconds > 0);
  const talkSeconds = filtered.reduce((s, c) => s + c.talkSeconds, 0);

  const csv = () => {
    const header = ['Started (PT)', 'Agent', 'Direction', 'Contact', 'To', 'From', 'Duration (s)', 'Talk (s)', 'Status', 'Disposition', 'Recording'];
    const lines = filtered.map((c) => [
      new Date(c.startedAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }),
      agentName(c.agentId), c.direction ?? '', c.contactName ?? '', c.toNumber ?? '', c.fromNumber ?? '',
      String(c.durationSeconds), String(c.talkSeconds), c.status ?? '', c.disposition ?? '', c.recordingUrl ?? '',
    ].map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(','));
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calls-${data.period.from}-to-${data.period.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Tiles>
        <Tile label="Calls" value={fmtNum(filtered.length, 0)}
          note={data.callTotal > data.calls.length ? `newest ${data.calls.length} of ${fmtNum(data.callTotal, 0)} loaded` : 'all calls in period'} />
        <Tile label="Connected" value={fmtNum(connects.length, 0)}
          note={filtered.length ? `${fmtNum((connects.length / filtered.length) * 100, 0)}% connect rate` : ''} />
        <Tile label="Talk time" value={`${fmtNum(talkSeconds / 3600, 1)}h`} note="connected calls only" />
        <Tile label="Average talk" value={connects.length ? mmss(talkSeconds / connects.length) : '—'} note="per connected call" />
        <Tile label="Longest" value={connects.length ? mmss(Math.max(...connects.map((c) => c.talkSeconds))) : '—'} note="single call" />
        <Tile label="Outbound share" value={filtered.length
          ? `${fmtNum((filtered.filter((c) => c.direction === 'outbound').length / filtered.length) * 100, 0)}%`
          : '—'} note="of calls shown" />
      </Tiles>

      <Panel
        title="Call detail"
        accent={T.accent}
        tooltip="Every call synced from GoHighLevel for this period. Talk time counts only calls that connected — an unanswered call is a dial, not a conversation."
        subtitle="Filter, then export what you are looking at."
        right={<Btn onClick={csv} size="sm">Export CSV</Btn>}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <select value={agent} onChange={(e) => setAgent(e.target.value)} style={{ ...inputStyle, fontFamily: T.sans, fontSize: 12, width: 190 }}>
            <option value="">All agents</option>
            {data.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={direction} onChange={(e) => setDirection(e.target.value)} style={{ ...inputStyle, fontFamily: T.sans, fontSize: 12, width: 130 }}>
            <option value="">Both ways</option>
            <option value="outbound">Outbound</option>
            <option value="inbound">Inbound</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...inputStyle, fontFamily: T.sans, fontSize: 12, width: 150 }}>
            <option value="">Any outcome</option>
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Contact, number, disposition…"
            style={{ ...inputStyle, fontFamily: T.sans, fontSize: 12, width: 240 }} />
        </div>

        {filtered.length === 0 ? <Empty>No calls match those filters.</Empty> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1000 }}>
              <thead>
                <tr>
                  <th style={th}>Started (PT)</th>
                  <th style={th}>Agent</th>
                  <th style={th}>Dir</th>
                  <th style={th}>Contact</th>
                  <th style={th}>Number</th>
                  <th style={{ ...th, textAlign: 'right' }}>Duration</th>
                  <th style={{ ...th, textAlign: 'right' }}>Talk</th>
                  <th style={th}>Outcome</th>
                  <th style={th}>Disposition</th>
                  <th style={th}>Recording</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, limit).map((c) => (
                  <tr key={c.id}>
                    <td style={{ ...td, fontFamily: T.mono, fontSize: 11 }}>
                      {new Date(c.startedAt).toLocaleString('en-US', {
                        timeZone: 'America/Los_Angeles', month: 'numeric', day: 'numeric',
                        hour: 'numeric', minute: '2-digit',
                      })}
                    </td>
                    <td style={{ ...td, fontWeight: 600 }}>{agentName(c.agentId)}</td>
                    <td style={{ ...td, fontSize: 11, color: T.muted }}>{c.direction === 'inbound' ? '←in' : 'out→'}</td>
                    <td style={td}>{c.contactName ?? '—'}</td>
                    <td style={{ ...td, fontFamily: T.mono, fontSize: 11 }}>
                      {c.direction === 'inbound' ? c.fromNumber ?? '—' : c.toNumber ?? '—'}
                    </td>
                    <td style={tdNum}>{mmss(c.durationSeconds)}</td>
                    <td style={{ ...tdNum, fontWeight: c.talkSeconds > 0 ? 700 : 400, color: c.talkSeconds > 0 ? T.ink : T.faint }}>
                      {c.talkSeconds > 0 ? mmss(c.talkSeconds) : '—'}
                    </td>
                    <td style={td}>
                      <Pill tone={c.talkSeconds > 0 ? 'good' : 'plain'}>{c.status ?? 'unknown'}</Pill>
                    </td>
                    <td style={{ ...td, fontSize: 11, color: T.muted }}>{c.disposition ?? '—'}</td>
                    <td style={td}>
                      {c.recordingUrl
                        ? <a href={c.recordingUrl} target="_blank" rel="noreferrer" style={{ color: T.brandDark, fontWeight: 700, fontSize: 11 }}>Listen</a>
                        : <span style={{ color: T.faint, fontSize: 11 }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > limit && (
              <div style={{ marginTop: 10 }}>
                <Btn onClick={() => setLimit(limit + 200)} size="sm">
                  Show 200 more ({fmtNum(filtered.length - limit, 0)} left)
                </Btn>
              </div>
            )}
          </div>
        )}
      </Panel>
    </>
  );
}
