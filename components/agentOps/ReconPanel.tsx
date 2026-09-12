'use client';
import React, { useState } from 'react';
import type { DashboardData, MatchStatus } from '../../lib/agentOps/types';
import { BACKEND_LABEL } from '../../lib/agentOps/types';
import { Btn, Callout, Panel, T, fmtMoney, fmtNum, inputStyle, td, tdNum, th } from '../operatingModel/ui';
import { Empty, OverrideFlag, Pill, Tile, Tiles } from './parts';

/**
 * The cross-check. What the rep entered in GoHighLevel, against what the
 * backend's own report says happened to that file and what they paid.
 *
 * A clean row is a deal you have actually been paid for. Everything else is a
 * question with a name attached to it.
 */

const STATUS_META: Record<MatchStatus, { label: string; tone: 'good' | 'warn' | 'bad' | 'plain'; blurb: string }> = {
  matched: { label: 'Matched', tone: 'good', blurb: 'GoHighLevel and the backend agree.' },
  amount_mismatch: { label: 'Amount differs', tone: 'warn', blurb: 'Matched, but the enrolled debt does not agree.' },
  status_mismatch: { label: 'Status differs', tone: 'warn', blurb: 'The backend cancelled or refunded a file still showing as won.' },
  missing_at_backend: { label: 'Not at backend', tone: 'bad', blurb: 'A rep is credited with a deal the backend has no record of.' },
  unclaimed_at_backend: { label: 'Nobody credited', tone: 'bad', blurb: 'The backend has the file and paid on it, but no rep is credited.' },
};

export function ReconPanel({ data, onOverride }: {
  data: DashboardData;
  onOverride: (payload: { entity: string; entityId: string; field: string; newValue: string; reason: string }) => Promise<void>;
}) {
  const [status, setStatus] = useState<MatchStatus | ''>('');
  const [backend, setBackend] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<{ fileId: number; field: string; value: string; reason: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const t = data.reconTotals;

  const agentName = (id: string | null | undefined) =>
    (id ? data.agents.find((a) => a.id === id)?.name ?? id : '— unassigned —');

  const rows = data.recon.filter((r) => {
    if (status && r.status !== status) return false;
    if (backend && (r.file?.backend ?? r.enrollment?.backend) !== backend) return false;
    if (q.trim()) {
      const hay = `${r.enrollment?.clientName ?? ''} ${r.file?.clientName ?? ''} ${r.file?.externalId ?? ''} ${agentName(r.enrollment?.agentId)}`.toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  });

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await onOverride({
        entity: 'backend_file',
        entityId: String(editing.fileId),
        field: editing.field,
        newValue: editing.value,
        reason: editing.reason,
      });
      setEditing(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Tiles>
        <Tile label="Files compared" value={fmtNum(t.total, 0)} note="enrollments + backend rows" />
        <Tile label="Clean" value={fmtNum(t.matched, 0)} tone="good"
          note={t.total ? `${fmtNum((t.matched / t.total) * 100, 0)}% of rows` : ''} />
        <Tile label="Not at backend" value={fmtNum(t.missingAtBackend, 0)} tone={t.missingAtBackend ? 'bad' : 'good'}
          note="claimed, no file found" />
        <Tile label="Nobody credited" value={fmtNum(t.unclaimedAtBackend, 0)} tone={t.unclaimedAtBackend ? 'bad' : 'good'}
          note={`${fmtMoney(t.unclaimedPayout)} paid`} />
        <Tile label="Disagreements" value={fmtNum(t.amountMismatch + t.statusMismatch, 0)}
          tone={t.amountMismatch + t.statusMismatch ? 'warn' : 'good'} note="amount or status" />
        <Tile label="Confirmed payout" value={fmtMoney(t.confirmedPayout)} note="on matched files" />
      </Tiles>

      <Panel
        title="GoHighLevel ↔ backend reconciliation"
        accent={T.accent}
        tooltip="Enrollments are matched to backend report rows on phone number first, then on name with a last-four or an enrolled-debt agreement. Anything below the confidence floor is left unmatched and shown rather than quietly paired."
        subtitle="What the rep claims, against what Level Debt, Shield and Legacy actually report."
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <select value={status} onChange={(e) => setStatus(e.target.value as MatchStatus | '')}
            style={{ ...inputStyle, fontFamily: T.sans, fontSize: 12, width: 190 }}>
            <option value="">Every row</option>
            {(Object.keys(STATUS_META) as MatchStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
          <select value={backend} onChange={(e) => setBackend(e.target.value)}
            style={{ ...inputStyle, fontFamily: T.sans, fontSize: 12, width: 190 }}>
            <option value="">All backends</option>
            {(['LEVEL', 'CS', 'LEGACY'] as const).map((b) => (
              <option key={b} value={b}>{BACKEND_LABEL[b]}</option>
            ))}
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Client, file id, rep…"
            style={{ ...inputStyle, fontFamily: T.sans, fontSize: 12, width: 240 }} />
        </div>

        {rows.length === 0 ? <Empty>Nothing to reconcile with those filters.</Empty> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1080 }}>
              <thead>
                <tr>
                  <th style={th}>Status</th>
                  <th style={th}>Client</th>
                  <th style={th}>Backend</th>
                  <th style={th}>Rep credited</th>
                  <th style={{ ...th, textAlign: 'right' }}>Debt in GHL</th>
                  <th style={{ ...th, textAlign: 'right' }}>Debt at backend</th>
                  <th style={th}>File status</th>
                  <th style={{ ...th, textAlign: 'right' }}>Payout</th>
                  <th style={th}>What it means</th>
                  <th style={{ ...th, width: 60 }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const meta = STATUS_META[r.status];
                  const be = r.file?.backend ?? r.enrollment?.backend ?? 'UNKNOWN';
                  const flags = r.file ? data.overrideFlags[`backend_file|${r.file.id}`] ?? 0 : 0;
                  return (
                    <tr key={`${r.enrollmentId ?? 'x'}-${r.backendFileId ?? i}`}>
                      <td style={td}><Pill tone={meta.tone} title={meta.blurb}>{meta.label}</Pill></td>
                      <td style={{ ...td, fontWeight: 600, color: T.ink }}>
                        {r.enrollment?.clientName ?? r.file?.clientName ?? '—'}
                        {r.file?.externalId && (
                          <div style={{ fontSize: 10, color: T.faint, fontWeight: 400, fontFamily: T.mono }}>{r.file.externalId}</div>
                        )}
                      </td>
                      <td style={{ ...td, fontSize: 11.5 }}>{BACKEND_LABEL[be]}</td>
                      <td style={{ ...td, fontSize: 11.5 }}>{agentName(r.enrollment?.agentId)}</td>
                      <td style={tdNum}>{r.enrollment?.enrolledDebt != null ? fmtMoney(r.enrollment.enrolledDebt) : '—'}</td>
                      <td style={tdNum}>
                        {r.file?.enrolledDebt != null ? fmtMoney(r.file.enrolledDebt) : '—'}
                        <OverrideFlag count={flags} />
                      </td>
                      <td style={{ ...td, fontSize: 11.5, color: /cancel|refund|charge/i.test(r.file?.fileStatus ?? '') ? T.bad : T.body }}>
                        {r.file?.fileStatus ?? '—'}
                      </td>
                      <td style={{ ...tdNum, fontWeight: 700 }}>{r.file?.payoutAmount != null ? fmtMoney(r.file.payoutAmount) : '—'}</td>
                      <td style={{ ...td, fontSize: 11, color: T.muted, whiteSpace: 'normal', maxWidth: 300 }}>{r.explanation}</td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        {r.file && (
                          <Btn size="sm" onClick={() => setEditing({
                            fileId: r.file!.id, field: 'payout_amount',
                            value: String(r.file!.payoutAmount ?? ''), reason: '',
                          })}>Edit</Btn>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Callout tone="warn">
          <strong>Overrides are logged.</strong> Correcting a backend figure here writes the old value, the new value,
          who changed it and why into the override log, and the row carries a red mark from then on. A number a human
          changed never again looks like one the backend reported.
        </Callout>
      </Panel>

      {editing && (
        <Panel title="Override a backend figure" accent={T.warn}
          subtitle="Use this when the backend's report is wrong and you have confirmed the real number.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.muted }}>Field</span>
              <select value={editing.field} onChange={(e) => setEditing({ ...editing, field: e.target.value })}
                style={{ ...inputStyle, fontSize: 12 }}>
                <option value="payout_amount">Payout amount</option>
                <option value="enrolled_debt">Enrolled debt</option>
                <option value="file_status">File status</option>
                <option value="payout_at">Payout date</option>
                <option value="first_payment_at">First payment date</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.muted }}>New value</span>
              <input value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                style={{ ...inputStyle, fontSize: 12 }} />
            </label>
            <label style={{ display: 'grid', gap: 4, gridColumn: 'span 2' }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.muted }}>Reason (required)</span>
              <input value={editing.reason} onChange={(e) => setEditing({ ...editing, reason: e.target.value })}
                placeholder="Confirmed with the backend on a call — their report had the draft date, not the payout date."
                style={{ ...inputStyle, fontFamily: T.sans, fontSize: 12 }} />
            </label>
            <span style={{ display: 'flex', gap: 7 }}>
              <Btn onClick={() => setEditing(null)} size="sm">Cancel</Btn>
              <Btn onClick={save} size="sm" tone="primary">{busy ? 'Saving…' : 'Save override'}</Btn>
            </span>
          </div>
        </Panel>
      )}
    </>
  );
}
