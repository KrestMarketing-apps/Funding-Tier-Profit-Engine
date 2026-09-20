'use client';
import React, { useState } from 'react';
import type { DashboardData, OverrideRecord } from '../../lib/agentOps/types';
import { p } from '../../lib/paths';
import { Btn, Callout, Panel, T, fmtNum, inputStyle, td, tdNum, th } from '../operatingModel/ui';
import { Empty, Pill } from './parts';

/**
 * Setup and housekeeping: pull a backend report in, see what the parser made
 * of it, run a sync by hand, and read the override log.
 */
export function AdminPanel({ data, onRefresh }: { data: DashboardData; onRefresh: () => void }) {
  const [backend, setBackend] = useState('LEVEL');
  const [period, setPeriod] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<OverrideRecord[] | null>(null);
  const [probeResult, setProbeResult] = useState<any>(null);

  const upload = async () => {
    if (!file) return;
    setBusy('upload');
    setResult(null);
    try {
      const body = new FormData();
      body.set('backend', backend);
      body.set('file', file);
      if (period) body.set('period', period);
      body.set('dryRun', String(dryRun));
      const res = await fetch(p('/api/agent-ops/import'), { method: 'POST', body });
      setResult(await res.json());
      if (!dryRun) onRefresh();
    } catch (e: any) {
      setResult({ error: e?.message ?? String(e) });
    } finally {
      setBusy(null);
    }
  };

  const run = async (what: 'sync' | 'probe' | 'overrides') => {
    setBusy(what);
    try {
      if (what === 'sync') {
        const res = await fetch(p('/api/agent-ops/sync'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
        });
        setResult(await res.json());
        onRefresh();
      } else if (what === 'probe') {
        setProbeResult(await (await fetch(p('/api/agent-ops/probe'))).json());
      } else {
        const json = await (await fetch(p('/api/agent-ops/override'))).json();
        setOverrides(json.overrides ?? []);
      }
    } catch (e: any) {
      setResult({ error: e?.message ?? String(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Panel
        title="Import a backend report"
        accent={T.accent}
        tooltip="Level Debt, Shield and Legacy each send a different spreadsheet. The header row is matched against known column names, and the mapping it found is reported back — so a renamed column shows up here rather than as missing money later."
        subtitle="CSV or TSV. Export an Excel file to CSV first."
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={lbl}>Backend</span>
            <select value={backend} onChange={(e) => setBackend(e.target.value)} style={{ ...inputStyle, fontSize: 12 }}>
              <option value="LEVEL">Level Debt</option>
              <option value="CS">Shield Services</option>
              <option value="LEGACY">Elite Legal Practice</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={lbl}>Period label</span>
            <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-09"
              style={{ ...inputStyle, fontSize: 12 }} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={lbl}>File</span>
            <input type="file" accept=".csv,.tsv,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              style={{ ...inputStyle, fontFamily: T.sans, fontSize: 11.5, padding: 4 }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.body }}>
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
            Check it first, do not import
          </label>
          <Btn onClick={upload} tone="primary" size="sm">
            {busy === 'upload' ? 'Reading…' : dryRun ? 'Check file' : 'Import'}
          </Btn>
        </div>

        {result && (
          <div style={{ marginTop: 12 }}>
            {result.error
              ? <Callout tone="bad"><strong>Failed.</strong> {result.error}</Callout>
              : (
                <>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <Pill tone="brand">{result.rowsUsable ?? result.counts?.calls ?? 0} usable rows</Pill>
                    {result.rowsParsed != null && <Pill>{result.rowsParsed} rows read</Pill>}
                    {result.dryRun && <Pill tone="warn">nothing written</Pill>}
                    {result.imported != null && <Pill tone="good">{result.imported} imported</Pill>}
                    {(result.missingColumns?.length ?? 0) > 0 && <Pill tone="bad">missing: {result.missingColumns.join(', ')}</Pill>}
                  </div>
                  {result.recognisedColumns && (
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>
                      <strong>Recognised:</strong> {Object.keys(result.recognisedColumns).join(', ') || 'nothing'}
                      {result.ignoredColumns?.length ? <> · <strong>ignored:</strong> {result.ignoredColumns.join(', ')}</> : null}
                    </div>
                  )}
                  {(result.errors ?? []).map((e: string, i: number) => (
                    <Callout key={i} tone="warn">{e}</Callout>
                  ))}
                  {(result.warnings ?? []).map((w: string, i: number) => (
                    <div key={`w${i}`} style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>• {w}</div>
                  ))}
                  {result.sample?.length > 0 && (
                    <pre style={pre}>{JSON.stringify(result.sample, null, 2)}</pre>
                  )}
                </>
              )}
          </div>
        )}
      </Panel>

      <Panel
        title="Sync and connection"
        accent={T.accent}
        subtitle="The scheduled job runs on its own. These are for setting it up and for forcing a refresh."
        tooltip="Probe asks GoHighLevel what this token can actually reach and what shape it answers with. Run it once after setting the environment variables, before trusting a sync."
        right={
          <span style={{ display: 'flex', gap: 6 }}>
            <Btn onClick={() => run('probe')} size="sm">{busy === 'probe' ? 'Checking…' : 'Test connection'}</Btn>
            <Btn onClick={() => run('sync')} size="sm" tone="primary">{busy === 'sync' ? 'Syncing…' : 'Sync now'}</Btn>
          </span>
        }
      >
        {data.lastSync ? (
          <div style={{ fontSize: 12, color: T.body }}>
            Last sync {new Date(data.lastSync.at ?? '').toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} ·{' '}
            <Pill tone={data.lastSync.ok ? 'good' : 'bad'}>{data.lastSync.ok ? 'ok' : 'failed'}</Pill>
            {data.lastSync.counts && (
              <span style={{ color: T.muted }}> · {Object.entries(data.lastSync.counts).map(([k, v]) => `${v} ${k}`).join(', ')}</span>
            )}
            {data.lastSync.error && <Callout tone="bad">{data.lastSync.error}</Callout>}
          </div>
        ) : <Empty>No sync has run yet.</Empty>}

        {probeResult && <pre style={pre}>{JSON.stringify(probeResult, null, 2)}</pre>}
      </Panel>

      <Panel
        title="Override log"
        accent={T.warn}
        subtitle="Every hand-edit to synced data: what changed, who changed it, and why."
        tooltip="This is the check and balance on being able to correct the data. Nothing here can be deleted from the app."
        right={<Btn onClick={() => run('overrides')} size="sm">{busy === 'overrides' ? 'Loading…' : 'Load log'}</Btn>}
      >
        {overrides === null ? <Empty>Load the log to see hand-edits.</Empty>
          : overrides.length === 0 ? <Empty>Nothing has been overridden.</Empty> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900 }}>
                <thead>
                  <tr>
                    <th style={th}>When</th>
                    <th style={th}>Who</th>
                    <th style={th}>Record</th>
                    <th style={th}>Field</th>
                    <th style={th}>From</th>
                    <th style={th}>To</th>
                    <th style={th}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {overrides.map((o) => (
                    <tr key={o.id}>
                      <td style={{ ...td, fontSize: 11, fontFamily: T.mono }}>
                        {new Date(o.at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}
                      </td>
                      <td style={{ ...td, fontSize: 11.5 }}>{o.adminEmail}</td>
                      <td style={{ ...td, fontSize: 11 }}>{o.entity} #{o.entityId}</td>
                      <td style={{ ...td, fontSize: 11.5 }}>{o.field}</td>
                      <td style={{ ...tdNum, color: T.muted }}>{o.oldValue ?? '—'}</td>
                      <td style={{ ...tdNum, fontWeight: 700, color: T.bad }}>{o.newValue ?? '—'}</td>
                      <td style={{ ...td, fontSize: 11, whiteSpace: 'normal', maxWidth: 320 }}>{o.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Panel>

      <Panel title="Agents on file" accent={T.accent}
        subtitle="Rate and scheduled hours drive cost per deal. Set them once per person."
        tooltip="Names come from GoHighLevel and refresh on every sync. Rate, role, team and scheduled hours are set here and are never overwritten by a sync.">
        {data.agents.length === 0 ? <Empty>No agents synced yet.</Empty> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={th}>Agent</th>
                  <th style={th}>Email</th>
                  <th style={th}>Type</th>
                  <th style={th}>Role</th>
                  <th style={th}>Team</th>
                  <th style={{ ...th, textAlign: 'right' }}>Rate</th>
                  <th style={{ ...th, textAlign: 'right' }}>Hrs / wk</th>
                </tr>
              </thead>
              <tbody>
                {data.agents.map((a) => (
                  <tr key={a.id}>
                    <td style={{ ...td, fontWeight: 600 }}>{a.name}</td>
                    <td style={{ ...td, fontSize: 11, color: T.muted }}>{a.email ?? '—'}</td>
                    <td style={{ ...td, fontSize: 11.5 }}>{a.employmentType ?? <span style={{ color: T.bad }}>not set</span>}</td>
                    <td style={{ ...td, fontSize: 11.5 }}>{a.role ?? <span style={{ color: T.bad }}>not set</span>}</td>
                    <td style={{ ...td, fontSize: 11.5 }}>{a.team ?? '—'}</td>
                    <td style={tdNum}>{a.hourlyRate != null ? `$${a.hourlyRate.toFixed(2)}` : <span style={{ color: T.bad }}>not set</span>}</td>
                    <td style={tdNum}>{a.scheduledHoursPerWeek != null ? fmtNum(a.scheduledHoursPerWeek, 0) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Callout>
              Until a rate and weekly hours are set for a person, their cost columns read as zero — the activity is
              still counted, but there is nothing to divide by.
            </Callout>
          </div>
        )}
      </Panel>
    </>
  );
}

const lbl: React.CSSProperties = {
  fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.muted,
};

const pre: React.CSSProperties = {
  background: T.panel, border: `1px solid ${T.line}`, borderRadius: 8, padding: 10,
  fontSize: 10.5, fontFamily: T.mono, color: T.body, overflowX: 'auto', maxHeight: 320, marginTop: 8,
};
