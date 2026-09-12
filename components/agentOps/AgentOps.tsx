'use client';
import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { DashboardData } from '../../lib/agentOps/types';
import { p } from '../../lib/paths';
import { Btn, Callout, G, T, inputStyle } from '../operatingModel/ui';
import { ScorecardPanel } from './ScorecardPanel';
import { AttendancePanel } from './AttendancePanel';
import { CallsPanel } from './CallsPanel';
import { ReconPanel } from './ReconPanel';
import { AdminPanel } from './AdminPanel';

/**
 * Agent Ops — attendance, call detail and the backend cross-check.
 *
 * The three questions in order: was the agent working, what did they do, and
 * did it turn into money the backend confirms. Everything is one period, set
 * once at the top; each tab is a different cut of it.
 */

type Tab = 'scorecard' | 'attendance' | 'calls' | 'recon' | 'admin';

const TABS: Array<{ key: Tab; label: string; blurb: string }> = [
  { key: 'scorecard', label: 'Scorecard', blurb: 'Value per agent' },
  { key: 'attendance', label: 'Attendance', blurb: 'Who was working' },
  { key: 'calls', label: 'Calls', blurb: 'Every call' },
  { key: 'recon', label: 'Reconciliation', blurb: 'Claims vs. backends' },
  { key: 'admin', label: 'Imports & log', blurb: 'Setup, uploads, overrides' },
];

export default function AgentOps({ data }: { data: DashboardData }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('scorecard');
  const [from, setFrom] = useState(data.period.from);
  const [to, setTo] = useState(data.period.to);
  const [pending, startTransition] = useTransition();

  const applyPeriod = (f = from, t = to) => {
    setFrom(f); setTo(t);
    startTransition(() => router.push(`${p('/agent-ops')}?from=${f}&to=${t}`));
  };

  const quick = (days: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - (days - 1) * 86400_000);
    applyPeriod(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
  };

  const override = async (payload: { entity: string; entityId: string; field: string; newValue: string; reason: string }) => {
    const res = await fetch(p('/api/agent-ops/override'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error ?? 'Override failed.');
    router.refresh();
  };

  return (
    <div style={{ background: T.shell, minHeight: '100vh', fontFamily: T.sans, color: T.body }}>
      <header style={{ background: G.header, color: '#fff', padding: '18px 20px 16px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, opacity: 0.75 }}>
          ADMIN · AGENT PERFORMANCE
        </div>
        <h1 style={{ margin: '4px 0 2px', fontSize: 21, fontWeight: 800 }}>Agent Ops</h1>
        <div style={{ fontSize: 12, opacity: 0.85 }}>
          Attendance from GoHighLevel activity, every call, and enrollments checked against what the backends actually paid.
        </div>
      </header>

      <div style={{
        position: 'sticky', top: 0, zIndex: 5, background: T.bg, borderBottom: `1px solid ${T.line}`,
        padding: '8px 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <span style={{ display: 'flex', gap: 4 }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} title={t.blurb}
              style={{
                border: 'none', cursor: 'pointer', borderRadius: 8, padding: '6px 11px',
                fontFamily: T.sans, fontWeight: 700, fontSize: 12,
                background: tab === t.key ? T.brandSoft : 'transparent',
                color: tab === t.key ? T.brandDark : T.muted,
              }}>{t.label}</button>
          ))}
        </span>

        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            style={{ ...inputStyle, width: 140, fontSize: 12 }} />
          <span style={{ color: T.faint, fontSize: 12 }}>→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            style={{ ...inputStyle, width: 140, fontSize: 12 }} />
          <Btn onClick={() => applyPeriod()} size="sm" tone="primary">{pending ? 'Loading…' : 'Apply'}</Btn>
          <Btn onClick={() => quick(7)} size="sm">7d</Btn>
          <Btn onClick={() => quick(30)} size="sm">30d</Btn>
        </span>
      </div>

      <main style={{ padding: 16, maxWidth: 1560, margin: '0 auto' }}>
        {data.demo && (
          <Callout tone="warn">
            <strong>Sample data.</strong> No database or GoHighLevel credentials are configured yet, so these numbers
            are generated for layout review — not your floor. Set <code>DATABASE_URL</code>, <code>GHL_TOKENS</code> and{' '}
            <code>GHL_LOCATION_IDS</code>, then run a sync from Imports &amp; log, and this banner disappears.
          </Callout>
        )}

        {tab === 'scorecard' && <ScorecardPanel data={data} />}
        {tab === 'attendance' && <AttendancePanel data={data} />}
        {tab === 'calls' && <CallsPanel data={data} />}
        {tab === 'recon' && <ReconPanel data={data} onOverride={override} />}
        {tab === 'admin' && <AdminPanel data={data} onRefresh={() => router.refresh()} />}
      </main>
    </div>
  );
}
