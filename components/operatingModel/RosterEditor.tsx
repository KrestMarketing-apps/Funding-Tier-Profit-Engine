'use client';
import React, { useState } from 'react';
import type { DayKey, Employee, ModelInputs, MonthRow } from './types';
import { DAY_KEYS } from './types';
import { computeEmployeeCost, employeeActiveInMonth } from './labor';
import { DAY_LABELS, IN_HOUSE_MIN_WAGE, BPO_RATE_MIN, BPO_RATE_MAX, defaultShifts, makeEmployee } from './config';
import {
  Btn, Callout, Field, Info, NumberInput, Panel, T, fmtMoney, fmtMoney2, fmtNum, inputStyle, td, tdNum, th,
} from './ui';

const hhmm = (h: number) => {
  const hr = Math.floor(h); const mn = Math.round((h - hr) * 60);
  const ampm = hr >= 12 ? 'pm' : 'am'; const disp = hr % 12 === 0 ? 12 : hr % 12;
  return `${disp}${mn ? ':' + String(mn).padStart(2, '0') : ''}${ampm}`;
};

const TIME_OPTS: number[] = [];
for (let h = 6; h <= 19; h += 0.5) TIME_OPTS.push(h);

function ScheduleEditor({ emp, onChange }: { emp: Employee; onChange: (e: Employee) => void }) {
  const set = (day: DayKey, patch: Partial<Employee['shifts'][DayKey]>) =>
    onChange({ ...emp, shifts: { ...emp.shifts, [day]: { ...emp.shifts[day], ...patch } } });

  return (
    <div style={{ padding: '10px 12px', background: T.panel, borderRadius: 8, border: `1px solid ${T.line}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: T.muted, marginBottom: 8 }}>
        Weekly schedule — all times PST
        <Info text="Allowed clock window is Monday–Friday 6:00am–7:00pm PST and Saturday 6:00am–3:00pm PST. The default shift is 9:00am–6:00pm Monday–Friday, which is 9 clock hours less a 1-hour unpaid meal break = 8 paid hours per day." />
      </div>
      <div style={{ display: 'grid', gap: 5 }}>
        {DAY_KEYS.filter((d) => d !== 'sun').map((day) => {
          const s = emp.shifts[day];
          const isSat = day === 'sat';
          const max = isSat ? 15 : 19;
          const paid = s.enabled ? Math.max(0, s.end - s.start - emp.unpaidBreakMinutes / 60) : 0;
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
          <NumberInput value={emp.unpaidBreakMinutes} min={0} max={120} step={15}
            onChange={(v) => onChange({ ...emp, unpaidBreakMinutes: v })} suffix="min" />
        </Field>
      </div>
    </div>
  );
}

export function RosterEditor({ inputs, setInputs, month }: {
  inputs: ModelInputs; setInputs: (i: ModelInputs) => void; month: MonthRow | undefined;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const policy = inputs.laborPolicy;
  const costs = inputs.roster.map((e) => computeEmployeeCost(e, policy));

  const update = (id: string, patch: Partial<Employee>) => setInputs({
    ...inputs,
    roster: inputs.roster.map((e) => {
      if (e.id !== id) return e;
      const next = { ...e, ...patch };
      if (patch.type === 'inhouse' && e.type !== 'inhouse') {
        next.hourlyRate = Math.max(IN_HOUSE_MIN_WAGE, e.hourlyRate);
        next.unpaidBreakMinutes = 60; next.otEligible = true;
      }
      if (patch.type === 'bpo' && e.type !== 'bpo') {
        next.hourlyRate = Math.min(BPO_RATE_MAX, Math.max(BPO_RATE_MIN, 5));
        next.unpaidBreakMinutes = 0; next.otEligible = false;
      }
      return next;
    }),
  });

  const add = (type: 'inhouse' | 'bpo') => {
    const n = inputs.roster.filter((e) => e.type === type).length + 1;
    setInputs({
      ...inputs,
      roster: [...inputs.roster, makeEmployee({
        type,
        name: type === 'inhouse' ? `In-House Closer ${n}` : `BPO Agent ${n}`,
        role: type === 'inhouse' ? 'closer' : 'opener',
        shifts: defaultShifts(),
      })],
    });
  };
  const remove = (id: string) =>
    setInputs({ ...inputs, roster: inputs.roster.filter((e) => e.id !== id) });

  // Allocate the month's actual output across the people who produced it.
  const totalCloserHrs = costs.reduce((s, c) => s + (employeeActiveInMonth(c.employee, month?.month ?? 1) ? c.monthlyCloserHours : 0), 0);
  const totalOpenerHrs = costs.reduce((s, c) => s + (employeeActiveInMonth(c.employee, month?.month ?? 1) ? c.monthlyOpenerHours : 0), 0);
  const monthDeals = month?.deals ?? 0;
  const monthTransfers = month?.capacity.totalTransfers ?? 0;
  const openerTransfers = month?.capacity.openerSuppliedTransfers ?? 0;

  const totals = costs.reduce((acc, c) => {
    acc.weekly += c.weeklyPaidHours; acc.ot += c.otHoursPerWeek;
    acc.cost += c.monthlyCost;
    acc.inhouse += c.employee.type === 'inhouse' ? c.monthlyCost : 0;
    acc.bpo += c.employee.type === 'bpo' ? c.monthlyCost : 0;
    return acc;
  }, { weekly: 0, ot: 0, cost: 0, inhouse: 0, bpo: 0 });

  const anyWarn = costs.some((c) => c.warnings.length > 0);

  return (
    <Panel
      title="Staffing & Labor — the roster"
      accent={T.accent}
      tooltip="One row per real person. Left to right: how many hours they are on the clock, at what rate, and what that costs per month. Deal capacity and transfer supply are computed from these same hours, so headcount and volume can never drift apart."
      subtitle="Agents × rate × weekly hours = monthly labor. Add or remove people with + / −."
      right={
        <span style={{ display: 'flex', gap: 6 }}>
          <Btn onClick={() => add('inhouse')} size="sm" tone="primary">+ In-House</Btn>
          <Btn onClick={() => add('bpo')} size="sm">+ BPO</Btn>
        </span>
      }
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1080 }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 26 }} />
              <th style={th}>Agent</th>
              <th style={th}>Type<Info text="In-House / CA employees are W2 staff paid at or above the $16.90 California minimum wage, with 1.5× overtime above 40 hours per week. BPO agents are overseas contractors billed at a flat $3–$8 per hour with no overtime premium." /></th>
              <th style={th}>Role<Info text="Openers qualify raw calls and hand off qualified transfers. Closers convert those transfers into enrolled deals. Hybrid agents split their paid hours between the two. Only CLOSER hours generate deals; opener hours generate transfer supply and reduce what you buy from the vendor." /></th>
              <th style={th}>Schedule</th>
              <th style={{ ...th, textAlign: 'right' }}>Hrs / wk<Info text="Paid hours: the clock span of every enabled shift, minus the unpaid meal break for each worked day." /></th>
              <th style={{ ...th, textAlign: 'right' }}>OT hrs<Info text="Paid hours above the 40 hr/week threshold. Billed at 1.5× the base rate. Applies to In-House / CA staff only unless overridden on the row." /></th>
              <th style={{ ...th, textAlign: 'right' }}>Rate</th>
              <th style={{ ...th, textAlign: 'right' }}>Monthly cost<Info text="(regular hrs × rate + OT hrs × rate × 1.5) × 52/12 weeks per month." /></th>
              <th style={{ ...th, textAlign: 'right' }}>Deals<Info text="Share of this month's deals attributable to this person's closer hours." /></th>
              <th style={{ ...th, textAlign: 'right' }}>Transfers<Info text="Qualified transfers this person produces (openers) or consumes (closers) in the selected month." /></th>
              <th style={{ ...th, textAlign: 'right' }}>Cost / deal<Info text="This person's monthly labor cost divided by the deals their closer hours produced. Openers show no cost per deal because they produce transfers, not deals." /></th>
              <th style={{ ...th, width: 30 }} />
            </tr>
          </thead>
          <tbody>
            {costs.map((c) => {
              const e = c.employee;
              const dealShare = totalCloserHrs > 0 ? (c.monthlyCloserHours / totalCloserHrs) * monthDeals : 0;
              const openShare = totalOpenerHrs > 0 ? (c.monthlyOpenerHours / totalOpenerHrs) * openerTransfers : 0;
              const closeShare = totalCloserHrs > 0 ? (c.monthlyCloserHours / totalCloserHrs) * monthTransfers : 0;
              const rateBad = !e.commissionOnly && (
                (e.type === 'inhouse' && e.hourlyRate < policy.inHouseMinWage) ||
                (e.type === 'bpo' && (e.hourlyRate < policy.bpoRateMin || e.hourlyRate > policy.bpoRateMax))
              );
              const days = DAY_KEYS.filter((d) => e.shifts[d].enabled);
              const scheduleLabel = days.length === 0 ? 'None'
                : `${days.map((d) => DAY_LABELS[d][0]).join('')} · ${hhmm(e.shifts[days[0]].start)}–${hhmm(e.shifts[days[0]].end)}`;
              return (
                <React.Fragment key={e.id}>
                  <tr style={{ background: expanded === e.id ? T.panel : undefined }}>
                    <td style={{ ...td, padding: '4px 2px 4px 6px' }}>
                      <button
                        onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                        aria-label="Edit schedule"
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.faint, fontSize: 11 }}
                      >{expanded === e.id ? '▾' : '▸'}</button>
                    </td>
                    <td style={{ ...td, minWidth: 160 }}>
                      <input value={e.name} onChange={(ev) => update(e.id, { name: ev.target.value })}
                        style={{ ...inputStyle, fontFamily: T.sans, fontSize: 12, padding: '4px 6px' }} />
                    </td>
                    <td style={td}>
                      <select value={e.type} onChange={(ev) => update(e.id, { type: ev.target.value as any })}
                        style={{ ...inputStyle, fontSize: 11.5, padding: '4px 6px', width: 132 }}>
                        <option value="inhouse">In-House / CA</option>
                        <option value="bpo">BPO / Overseas</option>
                      </select>
                    </td>
                    <td style={td}>
                      <select value={e.role} onChange={(ev) => update(e.id, { role: ev.target.value as any })}
                        style={{ ...inputStyle, fontSize: 11.5, padding: '4px 6px', width: 96 }}>
                        <option value="opener">Opener</option>
                        <option value="closer">Closer</option>
                        <option value="hybrid">Hybrid</option>
                      </select>
                      {e.role === 'hybrid' && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 3 }}>
                          <input type="number" value={e.hybridCloserSharePct} min={0} max={100}
                            onChange={(ev) => update(e.id, { hybridCloserSharePct: Number(ev.target.value) })}
                            style={{ ...inputStyle, width: 52, fontSize: 11, padding: '2px 4px' }} />
                          <span style={{ fontSize: 9.5, color: T.faint }}>% closing</span>
                        </span>
                      )}
                    </td>
                    <td style={{ ...td, fontSize: 11, color: T.muted }}>{scheduleLabel}</td>
                    <td style={tdNum}>{fmtNum(c.weeklyPaidHours, 1)}</td>
                    <td style={{ ...tdNum, color: c.otHoursPerWeek > 0 ? T.warn : T.faint, fontWeight: c.otHoursPerWeek > 0 ? 700 : 400 }}>
                      {c.otHoursPerWeek > 0 ? fmtNum(c.otHoursPerWeek, 1) : '—'}
                    </td>
                    <td style={{ ...tdNum, width: 160, minWidth: 160 }}>
                      {e.commissionOnly ? <span style={{ color: T.faint }}>comm-only</span> : (
                        <NumberInput value={e.hourlyRate} step={0.05} invalid={rateBad}
                          min={e.type === 'bpo' ? policy.bpoRateMin : policy.inHouseMinWage}
                          max={e.type === 'bpo' ? policy.bpoRateMax : undefined}
                          onChange={(v) => update(e.id, { hourlyRate: v })} prefix="$" />
                      )}
                    </td>
                    <td style={{ ...tdNum, fontWeight: 700, color: T.ink }}>{fmtMoney(c.monthlyCost)}</td>
                    <td style={tdNum}>{c.monthlyCloserHours > 0 ? fmtNum(dealShare, 1) : '—'}</td>
                    <td style={tdNum}>
                      {c.monthlyOpenerHours > 0 && <span style={{ color: T.accent }}>+{fmtNum(openShare, 0)}</span>}
                      {c.monthlyOpenerHours > 0 && c.monthlyCloserHours > 0 && ' / '}
                      {c.monthlyCloserHours > 0 && <span>{fmtNum(closeShare, 0)}</span>}
                      {c.monthlyOpenerHours === 0 && c.monthlyCloserHours === 0 && '—'}
                    </td>
                    <td style={tdNum}>{dealShare > 0.01 && c.monthlyCost > 0 ? fmtMoney(c.monthlyCost / dealShare) : '—'}</td>
                    <td style={{ ...td, textAlign: 'center', padding: '4px 6px' }}>
                      <button onClick={() => remove(e.id)} aria-label={`Remove ${e.name}`} title="Remove this agent"
                        style={{
                          border: `1px solid ${T.line}`, background: T.bg, color: T.bad, width: 22, height: 22,
                          borderRadius: 5, cursor: 'pointer', fontSize: 14, lineHeight: 1,
                        }}>−</button>
                    </td>
                  </tr>
                  {expanded === e.id && (
                    <tr>
                      <td colSpan={13} style={{ padding: '4px 10px 12px 34px', borderBottom: `1px solid ${T.lineSoft}` }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 460px) 1fr', gap: 14 }}>
                          <ScheduleEditor emp={e} onChange={(next) => setInputs({
                            ...inputs, roster: inputs.roster.map((x) => (x.id === e.id ? next : x)),
                          })} />
                          <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
                            <Field label="Overtime eligible" tooltip="California W2 employees accrue a 1.5× premium above 40 paid hours per week. BPO contractors normally bill a flat rate with no premium.">
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.body }}>
                                <input type="checkbox" checked={e.otEligible} onChange={(ev) => update(e.id, { otEligible: ev.target.checked })} />
                                {e.otEligible ? `1.5× above ${policy.otThresholdHrsPerWeek} hrs/wk` : 'Flat rate, no premium'}
                              </label>
                            </Field>
                            <Field label="Commission only" tooltip="A commission-only rep costs nothing in hourly labor but still occupies capacity and still earns deal commission.">
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.body }}>
                                <input type="checkbox" checked={e.commissionOnly} onChange={(ev) => update(e.id, { commissionOnly: ev.target.checked })} />
                                $0 hourly labor
                              </label>
                            </Field>
                            <Field label="Starts month" tooltip="First simulation month this person is on payroll.">
                              <NumberInput value={e.startMonth} min={1} onChange={(v) => update(e.id, { startMonth: Math.max(1, v) })} />
                            </Field>
                            {c.warnings.length > 0 && (
                              <Callout tone="warn">{c.warnings.map((w, i) => <div key={i}>{w}</div>)}</Callout>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ ...td, borderTop: `2px solid ${T.ink}`, borderBottom: 'none' }} />
              <td style={{ ...td, borderTop: `2px solid ${T.ink}`, borderBottom: 'none', fontWeight: 800, color: T.ink }}>
                TOTAL — {inputs.roster.length} agent{inputs.roster.length === 1 ? '' : 's'}
              </td>
              <td style={{ ...td, borderTop: `2px solid ${T.ink}`, borderBottom: 'none', fontSize: 11, color: T.muted }}>
                {inputs.roster.filter((e) => e.type === 'inhouse').length} in-house · {inputs.roster.filter((e) => e.type === 'bpo').length} BPO
              </td>
              <td style={{ ...td, borderTop: `2px solid ${T.ink}`, borderBottom: 'none', fontSize: 11, color: T.muted }}>
                {fmtNum(totalCloserHrs, 0)} closer hrs
              </td>
              <td style={{ ...td, borderTop: `2px solid ${T.ink}`, borderBottom: 'none', fontSize: 11, color: T.muted }}>
                {fmtNum(totalOpenerHrs, 0)} opener hrs
              </td>
              <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, borderBottom: 'none', fontWeight: 700 }}>{fmtNum(totals.weekly, 1)}</td>
              <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, borderBottom: 'none', fontWeight: 700, color: totals.ot > 0 ? T.warn : T.faint }}>
                {totals.ot > 0 ? fmtNum(totals.ot, 1) : '—'}
              </td>
              <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, borderBottom: 'none' }} />
              <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, borderBottom: 'none', fontWeight: 800, fontSize: 13.5, color: T.ink }}>
                {fmtMoney(totals.cost)}
              </td>
              <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, borderBottom: 'none', fontWeight: 700 }}>{fmtNum(monthDeals, 0)}</td>
              <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, borderBottom: 'none', fontWeight: 700 }}>{fmtNum(monthTransfers, 0)}</td>
              <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, borderBottom: 'none', fontWeight: 700 }}>
                {monthDeals > 0 ? fmtMoney(totals.cost / monthDeals) : '—'}
              </td>
              <td style={{ ...td, borderTop: `2px solid ${T.ink}`, borderBottom: 'none' }} />
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 12 }}>
        {[
          { k: 'In-House / CA spend', v: fmtMoney(totals.inhouse), n: `${inputs.roster.filter((e) => e.type === 'inhouse').length} people` },
          { k: 'BPO / Overseas spend', v: fmtMoney(totals.bpo), n: `${inputs.roster.filter((e) => e.type === 'bpo').length} people` },
          { k: 'Blended cost / paid hour', v: totals.weekly > 0 ? fmtMoney2(totals.cost / (totals.weekly * policy.weeksPerMonth)) : '—', n: `${fmtNum(totals.weekly * policy.weeksPerMonth, 0)} paid hrs/mo` },
          { k: 'Blended cost / deal', v: monthDeals > 0 ? fmtMoney(totals.cost / monthDeals) : '—', n: `${fmtNum(monthDeals, 0)} deals this month` },
        ].map((s) => (
          <div key={s.k} style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: '9px 11px', background: T.panel }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: T.muted }}>{s.k}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.ink, fontFamily: T.mono, marginTop: 3 }}>{s.v}</div>
            <div style={{ fontSize: 10, color: T.faint, marginTop: 1 }}>{s.n}</div>
          </div>
        ))}
      </div>

      {anyWarn && (
        <Callout tone="warn">
          {[...new Set(costs.flatMap((c) => c.warnings))].map((w, i) => <div key={i}>⚠ {w}</div>)}
        </Callout>
      )}
      <Callout>
        <strong>Rate rules.</strong> In-House / CA agents cannot be paid below the ${IN_HOUSE_MIN_WAGE.toFixed(2)} California minimum wage,
        and accrue 1.5× on paid hours above {policy.otThresholdHrsPerWeek} per week. BPO agents bill a flat
        ${BPO_RATE_MIN}–${BPO_RATE_MAX} per hour with no overtime premium. Deal volume is driven by
        <strong> closer hours only</strong> — openers feed the transfer pool, which reduces what you buy from the vendor.
      </Callout>
    </Panel>
  );
}
