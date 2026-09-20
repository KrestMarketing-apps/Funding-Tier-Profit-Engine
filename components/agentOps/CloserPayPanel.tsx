'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { p } from '../../lib/paths';
import { BACKEND_LABEL, type BackendKey } from '../../lib/agentOps/types';
import { Btn, Callout, Panel, T, fmtMoney2, inputStyle, td, tdNum, th } from '../operatingModel/ui';
import { Empty, Pill, Tile, Tiles } from './parts';

/**
 * Closer Pay — what every US commissioned closer is owed, when, and the record
 * of what was actually paid.
 *
 * Three jobs on one screen:
 *   1. Pay on time    — every deal with its pay date and the reason for it.
 *   2. Pay correctly  — a payment is recorded against the exact deals it
 *                       covers, lines must add up to the amount, clawbacks
 *                       net out of the same payment.
 *   3. Prove it       — per-closer reconciliation of rules vs ledger, and
 *                       any payment whose lines do not balance is flagged.
 */

type Deal = {
  deal_id: string; agent_id: string | null; agent_email: string | null; client_name: string | null;
  backend: BackendKey; enrolled_at: string | null; enrolled_debt: number | null; commission: number;
  commission_basis: string | null; state: string; schedule: string | null; program_payments: number;
  drafts_cleared: number; owed: number; paid: number; clawback: number; next_pay_date: string | null;
  chargeback_free_at: string | null; backend_paid_at: string | null; reason: string; backend_file_id: number | null;
};
type Run = {
  id: number; agent_id: string; pay_date: string; amount: number; method: string | null; reference: string | null;
  note: string | null; recorded_by: string; recorded_at: string; voided_at: string | null; balanced: boolean;
  linesNet: number; lines: Array<{ deal_id: string; kind: string; amount: number; client_name: string | null }>;
};
type Recon = {
  agentId: string; name: string; email: string | null; due: number; scheduled: number; awaitingBackend: number;
  paid: number; atRisk: number; clawbackOwed: number; overpaidDeals: string[]; unbalancedRuns: number[];
};
type Payload = {
  deals: Deal[]; payRuns: Run[]; recon: Recon[];
  agents: Array<{ id: string; name: string; email: string | null; pay_plan: string | null; separated_at: string | null; separation_type: string | null }>;
  timing: Record<string, { label: string; timing: string; chargebackFreeAfter: number }>;
};

export const STATE_META: Record<string, { label: string; tone: 'good' | 'warn' | 'bad' | 'plain' | 'brand' }> = {
  unmatched: { label: 'No backend file yet', tone: 'plain' },
  held: { label: 'Held — confirm plan type', tone: 'warn' },
  awaiting_first_payment: { label: 'Waiting on 1st payment', tone: 'plain' },
  awaiting_backend: { label: 'Waiting on backend payout', tone: 'brand' },
  scheduled: { label: 'Scheduled', tone: 'brand' },
  due: { label: 'Due now', tone: 'good' },
  paid_at_risk: { label: 'Paid — chargeback window', tone: 'warn' },
  paid: { label: 'Paid', tone: 'good' },
  clawback: { label: 'Clawback owed', tone: 'bad' },
  cancelled: { label: 'Cancelled — none owed', tone: 'plain' },
  forfeited: { label: 'Forfeited', tone: 'bad' },
};

const day = (s: string | null) => (s ? new Date(`${String(s).slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const n = (v: any) => Number(v ?? 0);

export function CloserPayPanel({ onOverride }: {
  onOverride: (payload: { entity: string; entityId: string; field: string; newValue: string; reason: string }) => Promise<void>;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agent, setAgent] = useState('');
  const [state, setState] = useState('');
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState<{ agentId: string; payDate: string; method: string; reference: string; note: string; picked: Record<string, number> } | null>(null);
  const [edit, setEdit] = useState<{ entity: string; entityId: string; field: string; value: string; reason: string; label: string } | null>(null);

  const load = async () => {
    setError(null);
    const res = await fetch(p('/api/agent-ops/pay'));
    const json = await res.json();
    if (!json.ok) setError(json.error ?? 'Could not load closer pay.');
    else setData(json);
  };
  useEffect(() => { load(); }, []);

  const post = async (body: any) => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(p('/api/agent-ops/pay'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Failed.');
      await load();
      return true;
    } catch (e: any) { setError(e.message); return false; } finally { setBusy(false); }
  };

  const agentName = (id: string | null) => data?.agents.find((a) => a.id === id)?.name ?? id ?? '—';
  const deals = useMemo(() => (data?.deals ?? []).filter((d) => (!agent || d.agent_id === agent) && (!state || d.state === state)), [data, agent, state]);

  if (!data) return <Panel title="Closer pay">{error ? <Callout tone="bad">{error}</Callout> : <Empty>Loading…</Empty>}</Panel>;

  const all = data.deals.filter((d) => !agent || d.agent_id === agent);
  const sum = (f: (d: Deal) => number) => all.reduce((s, d) => s + f(d), 0);
  const in30 = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);

  const startPay = (agentId: string) => {
    const mine = data.deals.filter((d) => d.agent_id === agentId);
    const picked: Record<string, number> = {};
    mine.filter((d) => d.state === 'due').forEach((d) => { picked[d.deal_id] = n(d.owed); });
    mine.filter((d) => d.state === 'clawback').forEach((d) => { picked[`cb:${d.deal_id}`] = -n(d.clawback); });
    const today = new Date().toISOString().slice(0, 10);
    setPay({ agentId, payDate: today, method: 'ACH', reference: '', note: '', picked });
  };
  const payTotal = pay ? Object.values(pay.picked).reduce((s, v) => s + v, 0) : 0;

  const savePay = async () => {
    if (!pay) return;
    const lines = Object.entries(pay.picked).filter(([, v]) => v !== 0).map(([k, v]) => (k.startsWith('cb:')
      ? { dealId: k.slice(3), amount: Math.abs(v), kind: 'clawback_recovered' }
      : { dealId: k, amount: v, kind: 'commission_paid' }));
    const ok = await post({ action: 'record', agentId: pay.agentId, payDate: pay.payDate, amount: Math.round(payTotal * 100) / 100,
      method: pay.method, reference: pay.reference, note: pay.note, lines });
    if (ok) setPay(null);
  };

  return (
    <>
      <Tiles>
        <Tile label="Due now" value={fmtMoney2(sum((d) => (d.state === 'due' ? n(d.owed) : 0)))} tone="good" note="pay date reached" />
        <Tile label="Scheduled (30 days)" value={fmtMoney2(sum((d) => (d.state === 'scheduled' && (d.next_pay_date ?? '') <= in30 ? n(d.owed) : 0)))} note="backend has paid FT" />
        <Tile label="Waiting on backend" value={fmtMoney2(sum((d) => (d.state === 'awaiting_backend' ? n(d.commission) : 0)))} note="1st payment cleared" />
        <Tile label="Paid, at risk" value={fmtMoney2(sum((d) => (d.state === 'paid_at_risk' ? n(d.paid) : 0)))} tone="warn" note="Level, before payment 2" />
        <Tile label="Clawbacks owed" value={fmtMoney2(sum((d) => n(d.clawback)))} tone={sum((d) => n(d.clawback)) ? 'bad' : 'good'} note="nets out of next payment" />
        <Tile label="Held" value={String(all.filter((d) => d.state === 'held').length)} tone={all.some((d) => d.state === 'held') ? 'warn' : 'good'} note="plan type to confirm" />
      </Tiles>

      {error && <Callout tone="bad">{error}</Callout>}

      <Panel title="Reconciliation by closer" accent={T.accent}
        tooltip="What the pay rules say each closer is owed, against what the ledger says was paid. Overpaid deals and payments whose lines do not add up are flagged."
        right={<Btn size="sm" onClick={() => post({ action: 'recompute' })}>{busy ? 'Working…' : 'Recompute'}</Btn>}>
        {data.recon.length === 0 ? <Empty>No enrolled deals credited to a commissioned closer yet.</Empty> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 960 }}>
              <thead><tr>
                {['Closer', 'Due now', 'Scheduled', 'Waiting on backend', 'Paid to date', 'At risk', 'Clawback owed', 'Checks', ''].map((h) => (
                  <th key={h} style={{ ...th, textAlign: h === 'Closer' || h === 'Checks' || !h ? 'left' : 'right' }}>{h}</th>))}
              </tr></thead>
              <tbody>{data.recon.map((r) => (
                <tr key={r.agentId}>
                  <td style={{ ...td, fontWeight: 700, color: T.ink }}>{r.name}</td>
                  <td style={tdNum}>{fmtMoney2(r.due)}</td>
                  <td style={tdNum}>{fmtMoney2(r.scheduled)}</td>
                  <td style={tdNum}>{fmtMoney2(r.awaitingBackend)}</td>
                  <td style={tdNum}>{fmtMoney2(r.paid)}</td>
                  <td style={tdNum}>{fmtMoney2(r.atRisk)}</td>
                  <td style={{ ...tdNum, color: r.clawbackOwed ? T.bad : T.body }}>{fmtMoney2(r.clawbackOwed)}</td>
                  <td style={{ ...td, fontSize: 11 }}>
                    {!r.overpaidDeals.length && !r.unbalancedRuns.length ? <Pill tone="good">Balanced</Pill> : null}
                    {r.overpaidDeals.length > 0 && <Pill tone="bad" title={r.overpaidDeals.join(', ')}>{r.overpaidDeals.length} overpaid</Pill>}{' '}
                    {r.unbalancedRuns.length > 0 && <Pill tone="bad" title={`Payments #${r.unbalancedRuns.join(', #')}`}>{r.unbalancedRuns.length} unbalanced payment</Pill>}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}><Btn size="sm" tone="primary" onClick={() => startPay(r.agentId)}>Record payment</Btn></td>
                </tr>))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {pay && (
        <Panel title={`Record a payment to ${agentName(pay.agentId)}`} accent={T.good}
          subtitle="Tick the deals this payment covers. Due deals and any clawback owed are pre-selected; the total must be what you actually sent.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 10 }}>
            <label style={{ display: 'grid', gap: 3 }}><small style={{ color: T.muted, fontWeight: 700 }}>Pay date</small>
              <input type="date" value={pay.payDate} onChange={(e) => setPay({ ...pay, payDate: e.target.value })} style={inputStyle} /></label>
            <label style={{ display: 'grid', gap: 3 }}><small style={{ color: T.muted, fontWeight: 700 }}>Method</small>
              <select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })} style={inputStyle}>
                {['ACH', 'Payroll', 'Wire', 'Check', 'Zelle', 'Other'].map((m) => <option key={m}>{m}</option>)}</select></label>
            <label style={{ display: 'grid', gap: 3 }}><small style={{ color: T.muted, fontWeight: 700 }}>Reference / confirmation #</small>
              <input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} style={inputStyle} /></label>
            <label style={{ display: 'grid', gap: 3 }}><small style={{ color: T.muted, fontWeight: 700 }}>Note</small>
              <input value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} style={inputStyle} /></label>
          </div>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr>{['', 'Client', 'Backend', 'Status', 'Pay date', 'Amount'].map((h) => <th key={h} style={{ ...th, textAlign: h === 'Amount' ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
            <tbody>{data.deals.filter((d) => d.agent_id === pay.agentId && ['due', 'scheduled', 'clawback'].includes(d.state)).map((d) => {
              const key = d.state === 'clawback' ? `cb:${d.deal_id}` : d.deal_id;
              const amount = d.state === 'clawback' ? -n(d.clawback) : n(d.owed);
              const on = key in pay.picked;
              return (
                <tr key={key}>
                  <td style={td}><input type="checkbox" checked={on} onChange={() => {
                    const picked = { ...pay.picked };
                    if (on) delete picked[key]; else picked[key] = amount;
                    setPay({ ...pay, picked });
                  }} /></td>
                  <td style={{ ...td, fontWeight: 600 }}>{d.client_name ?? d.deal_id}</td>
                  <td style={td}>{BACKEND_LABEL[d.backend] ?? d.backend}</td>
                  <td style={td}><Pill tone={STATE_META[d.state]?.tone}>{STATE_META[d.state]?.label ?? d.state}</Pill></td>
                  <td style={td}>{day(d.next_pay_date)}</td>
                  <td style={{ ...tdNum, color: amount < 0 ? T.bad : T.ink }}>{fmtMoney2(amount)}</td>
                </tr>);
            })}</tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, alignItems: 'center', marginTop: 10 }}>
            <strong style={{ fontFamily: T.mono }}>Payment total {fmtMoney2(payTotal)}</strong>
            <Btn size="sm" onClick={() => setPay(null)}>Cancel</Btn>
            <Btn size="sm" tone="primary" onClick={savePay}>{busy ? 'Saving…' : 'Record payment'}</Btn>
          </div>
        </Panel>
      )}

      <Panel title="Every deal" accent={T.accent}
        tooltip="One row per enrolled deal credited to a commissioned closer. The reason column is exactly what the closer sees on their My Deals & Pay page."
        subtitle="When each closer gets paid on each deal, and why.">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <select value={agent} onChange={(e) => setAgent(e.target.value)} style={{ ...inputStyle, width: 200, fontSize: 12 }}>
            <option value="">Every closer</option>
            {data.agents.filter((a) => data.deals.some((d) => d.agent_id === a.id)).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={state} onChange={(e) => setState(e.target.value)} style={{ ...inputStyle, width: 220, fontSize: 12 }}>
            <option value="">Every status</option>
            {Object.entries(STATE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        {deals.length === 0 ? <Empty>No deals with those filters.</Empty> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1250 }}>
              <thead><tr>{['Status', 'Client', 'Closer', 'Backend', 'Payments', 'Commission', 'Paid', 'Next pay date', 'Why', ''].map((h) => (
                <th key={h} style={{ ...th, textAlign: ['Commission', 'Paid'].includes(h) ? 'right' : 'left' }}>{h}</th>))}</tr></thead>
              <tbody>{deals.map((d) => (
                <tr key={d.deal_id}>
                  <td style={td}><Pill tone={STATE_META[d.state]?.tone}>{STATE_META[d.state]?.label ?? d.state}</Pill></td>
                  <td style={{ ...td, fontWeight: 600, color: T.ink }}>{d.client_name ?? '—'}
                    <div style={{ fontSize: 10, color: T.faint, fontWeight: 400 }}>enrolled {day(d.enrolled_at)}</div></td>
                  <td style={{ ...td, fontSize: 11.5 }}>{agentName(d.agent_id)}</td>
                  <td style={{ ...td, fontSize: 11.5 }}>{BACKEND_LABEL[d.backend] ?? d.backend}</td>
                  <td style={{ ...td, fontSize: 11.5 }}>{d.program_payments} program
                    <div style={{ fontSize: 10, color: T.faint }}>{d.drafts_cleared} drafts · {d.schedule === 'split' ? 'split/bi-weekly' : d.schedule === 'standard' ? 'monthly' : 'plan unknown'}</div></td>
                  <td style={tdNum} title={d.commission_basis ?? ''}>{fmtMoney2(n(d.commission))}</td>
                  <td style={tdNum}>{fmtMoney2(n(d.paid))}{n(d.clawback) > 0 && <div style={{ color: T.bad, fontSize: 10 }}>−{fmtMoney2(n(d.clawback))} owed back</div>}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{day(d.next_pay_date)}</td>
                  <td style={{ ...td, fontSize: 11, color: T.muted, whiteSpace: 'normal', maxWidth: 360 }}>{d.reason}</td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {d.backend_file_id != null && (
                      <>
                        <Btn size="sm" title="Record when the backend paid Funding Tier on this file"
                          onClick={() => setEdit({ entity: 'backend_file', entityId: String(d.backend_file_id), field: 'payout_at', value: d.backend_paid_at ?? '', reason: '', label: 'Backend paid Funding Tier on' })}>Backend paid</Btn>{' '}
                        <Btn size="sm" title="Monthly or split/bi-weekly"
                          onClick={() => setEdit({ entity: 'backend_file', entityId: String(d.backend_file_id), field: 'declared_schedule', value: d.schedule === 'unknown' ? 'standard' : d.schedule ?? 'standard', reason: '', label: 'Plan type (standard = monthly, split = split/bi-weekly)' })}>Plan</Btn>{' '}
                      </>
                    )}
                    <Btn size="sm" onClick={() => setEdit({ entity: 'enrollment', entityId: d.deal_id, field: 'commission_override', value: String(d.commission ?? ''), reason: '', label: 'Commission amount' })}>$</Btn>
                  </td>
                </tr>))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {edit && (
        <Panel title="Change a pay input" accent={T.warn} subtitle="Logged with your name and reason; closer pay recomputes immediately.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: 3 }}><small style={{ color: T.muted, fontWeight: 700 }}>{edit.label}</small>
              {edit.field === 'declared_schedule' ? (
                <select value={edit.value} onChange={(e) => setEdit({ ...edit, value: e.target.value })} style={inputStyle}>
                  <option value="standard">Monthly</option><option value="split">Split / bi-weekly / semi-monthly</option></select>
              ) : (
                <input type={edit.field === 'payout_at' ? 'date' : 'text'} value={edit.value}
                  onChange={(e) => setEdit({ ...edit, value: e.target.value })} style={inputStyle} />
              )}</label>
            <label style={{ display: 'grid', gap: 3, gridColumn: 'span 2' }}><small style={{ color: T.muted, fontWeight: 700 }}>Reason (required)</small>
              <input value={edit.reason} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} style={inputStyle}
                placeholder="e.g. Level ACH received 9/25 — statement #4471" /></label>
            <span style={{ display: 'flex', gap: 7 }}>
              <Btn size="sm" onClick={() => setEdit(null)}>Cancel</Btn>
              <Btn size="sm" tone="primary" onClick={async () => {
                try { await onOverride({ entity: edit.entity, entityId: edit.entityId, field: edit.field, newValue: edit.value, reason: edit.reason }); setEdit(null); await load(); }
                catch (e: any) { setError(e.message); }
              }}>Save</Btn>
            </span>
          </div>
        </Panel>
      )}

      <Panel title="Payments made" accent={T.accent}
        tooltip="Every payment recorded to a closer, with the deals it covered. Voiding reverses it in the ledger — nothing is deleted."
        subtitle="What was paid, to whom, when, and on which deals.">
        {data.payRuns.length === 0 ? <Empty>No payments recorded yet.</Empty> : (
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr>{['#', 'Closer', 'Pay date', 'Amount', 'Method / ref', 'Deals', 'Recorded', ''].map((h) => (
              <th key={h} style={{ ...th, textAlign: h === 'Amount' ? 'right' : 'left' }}>{h}</th>))}</tr></thead>
            <tbody>{data.payRuns.map((r) => (
              <tr key={r.id} style={{ opacity: r.voided_at ? 0.5 : 1 }}>
                <td style={td}>{r.id}</td>
                <td style={{ ...td, fontWeight: 600 }}>{agentName(r.agent_id)}</td>
                <td style={td}>{day(r.pay_date)}</td>
                <td style={tdNum}>{fmtMoney2(n(r.amount))}{!r.balanced && !r.voided_at && <div><Pill tone="bad">lines {fmtMoney2(r.linesNet)}</Pill></div>}</td>
                <td style={{ ...td, fontSize: 11 }}>{r.method ?? '—'} {r.reference ? `· ${r.reference}` : ''}</td>
                <td style={{ ...td, fontSize: 11, whiteSpace: 'normal', maxWidth: 420 }}>
                  {r.lines.map((l, i) => <span key={i}>{i ? ', ' : ''}{l.client_name ?? l.deal_id} {l.kind === 'clawback_recovered' ? `(−${fmtMoney2(n(l.amount))})` : fmtMoney2(n(l.amount))}</span>)}
                </td>
                <td style={{ ...td, fontSize: 10.5, color: T.faint }}>{r.recorded_by}<br />{day(r.recorded_at)}{r.voided_at ? <><br /><strong style={{ color: T.bad }}>VOID</strong></> : null}</td>
                <td style={{ ...td, textAlign: 'right' }}>{!r.voided_at && (
                  <Btn size="sm" onClick={() => { const reason = prompt('Why is this payment being voided?'); if (reason) post({ action: 'void', runId: r.id, reason }); }}>Void</Btn>)}</td>
              </tr>))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="Closers: pay plan and separation" accent={T.accent} collapsible defaultOpen={false}
        tooltip="Pay plan blank = US-based fully commissioned (paid by these rules). Separation: for cause forfeits anything unpaid; performance keeps the first payout on each deal they closed.">
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr>{['Closer', 'Email', 'Pay plan', 'Separated', 'Type', ''].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{data.agents.map((a) => (
            <tr key={a.id}>
              <td style={{ ...td, fontWeight: 600 }}>{a.name}</td>
              <td style={{ ...td, fontSize: 11 }}>{a.email ?? '—'}</td>
              <td style={td}>{a.pay_plan ?? 'US commission'}</td>
              <td style={td}>{day(a.separated_at)}</td>
              <td style={td}>{a.separation_type === 'for_cause' ? 'For cause' : a.separation_type === 'performance' ? 'Performance' : '—'}</td>
              <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                <Btn size="sm" onClick={() => setEdit({ entity: 'agent', entityId: a.id, field: 'pay_plan', value: a.pay_plan ?? 'us_commission', reason: '', label: 'Pay plan: us_commission, hourly, bpo or none' })}>Plan</Btn>{' '}
                <Btn size="sm" onClick={() => setEdit({ entity: 'agent', entityId: a.id, field: 'separated_at', value: a.separated_at?.slice(0, 10) ?? '', reason: '', label: 'Separation date (YYYY-MM-DD)' })}>Separation date</Btn>{' '}
                <Btn size="sm" onClick={() => setEdit({ entity: 'agent', entityId: a.id, field: 'separation_type', value: a.separation_type ?? 'performance', reason: '', label: 'Separation type: for_cause or performance' })}>Type</Btn>
              </td>
            </tr>))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Pay timing rules" accent={T.accent} collapsible defaultOpen={false}>
        {Object.entries(data.timing).map(([k, t]) => (
          <div key={k} style={{ fontSize: 12, marginBottom: 6 }}>
            <strong>{t.label}:</strong> {t.timing} Free of chargeback after program payment {t.chargebackFreeAfter}.
          </div>))}
        <div style={{ fontSize: 11.5, color: T.muted, marginTop: 6 }}>
          A program payment is one month of the client&apos;s plan. On split, bi-weekly or semi-monthly plans both drafts
          for the month must clear before it counts — two drafts are never two payments. If the backend pays Funding Tier
          late, the pay date moves to the backend&apos;s next pay day at least 5 days after the money arrives.
        </div>
      </Panel>
    </>
  );
}
