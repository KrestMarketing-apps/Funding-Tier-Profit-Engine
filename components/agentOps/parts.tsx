'use client';
import React from 'react';
import { T, fmtMoney, fmtNum } from '../operatingModel/ui';

/** Small shared pieces for the Agent Ops panels. */

export function Tile({ label, value, note, tone = 'plain' }: {
  label: string; value: string; note?: string; tone?: 'plain' | 'good' | 'warn' | 'bad';
}) {
  const color = tone === 'good' ? T.good : tone === 'warn' ? T.warn : tone === 'bad' ? T.bad : T.ink;
  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 9, padding: '9px 11px', background: T.panel }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: T.muted }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: T.mono, marginTop: 3 }}>{value}</div>
      {note && <div style={{ fontSize: 10, color: T.faint, marginTop: 1 }}>{note}</div>}
    </div>
  );
}

export function Tiles({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 12 }}>
      {children}
    </div>
  );
}

export function Pill({ children, tone = 'plain', title }: {
  children: React.ReactNode; tone?: 'plain' | 'good' | 'warn' | 'bad' | 'brand'; title?: string;
}) {
  const map = {
    plain: { bg: T.lineSoft, fg: T.muted, bd: T.line },
    brand: { bg: T.brandSoft, fg: T.brandDark, bd: T.brandLine },
    good: { bg: T.goodBg, fg: T.good, bd: '#bbf7d0' },
    warn: { bg: T.warnBg, fg: T.warn, bd: T.warnLine },
    bad: { bg: T.badBg, fg: T.bad, bd: '#fecaca' },
  }[tone];
  return (
    <span title={title} style={{
      background: map.bg, color: map.fg, border: `1px solid ${map.bd}`, borderRadius: 999,
      padding: '1px 7px', fontSize: 9.5, fontWeight: 700, whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

/** Marks a value a human changed. Hover says who, when and why. */
export function OverrideFlag({ count, title }: { count: number; title?: string }) {
  if (!count) return null;
  return (
    <span title={title ?? `Hand-edited ${count} time${count === 1 ? '' : 's'} — see the override log.`}
      style={{
        display: 'inline-block', width: 7, height: 7, borderRadius: 999,
        background: T.bad, marginLeft: 5, verticalAlign: 'middle',
      }} />
  );
}

export const hours = (mins: number) => `${fmtNum(mins / 60, 1)}h`;
export const money = fmtMoney;

export function Bar({ pct, tone = 'brand' }: { pct: number; tone?: 'brand' | 'warn' | 'bad' }) {
  const color = tone === 'warn' ? T.warn : tone === 'bad' ? T.bad : T.brand;
  return (
    <span style={{ display: 'inline-block', width: 62, height: 6, background: T.lineSoft, borderRadius: 999, overflow: 'hidden' }}>
      <span style={{ display: 'block', width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', background: color }} />
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '18px 4px', fontSize: 12, color: T.faint }}>{children}</div>;
}

export const clock = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles',
  }).toLowerCase().replace(' ', '');
};

export const dayLabel = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
};

export const mmss = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};
