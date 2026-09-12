'use client';
import React from 'react';
import type { DayKey, WeekShifts } from './types';
import { DAY_KEYS } from './types';
import { DAY_LABELS } from './config';
import { Field, Info, NumberInput, T, inputStyle } from './ui';

export const hhmm = (h: number) => {
  const hr = Math.floor(h); const mn = Math.round((h - hr) * 60);
  const ampm = hr >= 12 ? 'pm' : 'am'; const disp = hr % 12 === 0 ? 12 : hr % 12;
  return `${disp}${mn ? ':' + String(mn).padStart(2, '0') : ''}${ampm}`;
};

export const TIME_OPTS: number[] = [];
for (let h = 6; h <= 19; h += 0.5) TIME_OPTS.push(h);

/** Compact "MTWTF · 9am–6pm" label for a week of shifts. */
export function scheduleLabel(shifts: WeekShifts): string {
  const days = DAY_KEYS.filter((d) => shifts[d].enabled);
  if (days.length === 0) return 'None';
  const f = days[0];
  return `${days.map((d) => DAY_LABELS[d][0]).join('')} · ${hhmm(shifts[f].start)}–${hhmm(shifts[f].end)}`;
}

/**
 * Weekly shift grid + unpaid break. Used by the roster row drawer and by the
 * staffing-profile editor, so one schedule UI serves both.
 */
export function ScheduleEditor({ shifts, unpaidBreakMinutes, onChange, compact = false }: {
  shifts: WeekShifts;
  unpaidBreakMinutes: number;
  onChange: (next: { shifts: WeekShifts; unpaidBreakMinutes: number }) => void;
  compact?: boolean;
}) {
  const set = (day: DayKey, patch: Partial<WeekShifts[DayKey]>) =>
    onChange({ unpaidBreakMinutes, shifts: { ...shifts, [day]: { ...shifts[day], ...patch } } });

  const total = DAY_KEYS.reduce((s, d) => {
    const sh = shifts[d];
    return s + (sh.enabled ? Math.max(0, sh.end - sh.start - unpaidBreakMinutes / 60) : 0);
  }, 0);

  return (
    <div style={{ padding: compact ? '8px 10px' : '10px 12px', background: T.panel, borderRadius: 8, border: `1px solid ${T.line}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: T.muted, marginBottom: 8, display: 'flex', alignItems: 'center' }}>
        Weekly schedule — all times PST
        <Info text="Allowed clock window is Monday–Friday 6:00am–7:00pm PST and Saturday 6:00am–3:00pm PST. The default shift is 9:00am–6:00pm Monday–Friday, which is 9 clock hours less a 1-hour unpaid meal break = 8 paid hours per day." />
        <span style={{ marginLeft: 'auto', fontFamily: T.mono, color: T.ink, textTransform: 'none', letterSpacing: 0 }}>
          {total.toFixed(1)} hrs/wk
        </span>
      </div>
      <div style={{ display: 'grid', gap: 5 }}>
        {DAY_KEYS.filter((d) => d !== 'sun').map((day) => {
          const s = shifts[day];
          const isSat = day === 'sat';
          const max = isSat ? 15 : 19;
          const paid = s.enabled ? Math.max(0, s.end - s.start - unpaidBreakMinutes / 60) : 0;
          return (
            <div key={day} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr 78px', gap: 8, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: T.body, fontWeight: 600 }}>
                <input type="checkbox" checked={s.enabled} onChange={(e) => set(day, { enabled: e.target.checked })} />
                {DAY_LABELS[day]}
              </label>
              <select
                value={s.start} disabled={!s.enabled}
                onChange={(e) => set(day, { start: Number(e.target.value) })}
                style={{ ...inputStyle, fontSize: 11.5, opacity: s.enabled ? 1 : 0.4 }}
              >
                {TIME_OPTS.filter((t) => t >= 6 && t < max).map((t) => <option key={t} value={t}>{hhmm(t)}</option>)}
              </select>
              <select
                value={s.end} disabled={!s.enabled}
                onChange={(e) => set(day, { end: Number(e.target.value) })}
                style={{ ...inputStyle, fontSize: 11.5, opacity: s.enabled ? 1 : 0.4 }}
              >
                {TIME_OPTS.filter((t) => t > s.start && t <= max).map((t) => <option key={t} value={t}>{hhmm(t)}</option>)}
              </select>
              <span style={{ fontSize: 11, color: paid > 0 ? T.body : T.faint, fontFamily: T.mono, textAlign: 'right' }}>
                {paid.toFixed(1)} paid
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 10, maxWidth: 210 }}>
        <Field label="Unpaid meal break (min/day)" tooltip="Deducted from every worked day. California practice is a 60-minute unpaid meal break on a 9-hour span, leaving 8 paid hours. BPO contractors normally have none.">
          <NumberInput value={unpaidBreakMinutes} min={0} max={120} step={15}
            onChange={(v) => onChange({ shifts, unpaidBreakMinutes: v })} suffix="min" />
        </Field>
      </div>
    </div>
  );
}
