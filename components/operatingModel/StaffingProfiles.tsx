'use client';
import React, { useEffect, useMemo, useState } from 'react';
import type { Employee, EmployeeRole, EmployeeType, LaborPolicy } from './types';
import { EMPLOYEE_TYPE_LABEL } from './config';
import { ScheduleEditor } from './ScheduleEditor';
import {
  BUILT_IN_PROFILES, ProfileView, StaffingProfile, loadCustomProfiles, loadProfileView, newProfileId,
  previewProfile, profileFromEmployee, saveCustomProfiles, saveProfileView,
} from './profiles';
import { Btn, Callout, Field, Info, NumberInput, T, fmtMoney, fmtMoney2, fmtNum, inputStyle, td, tdNum, th } from './ui';

// ── Hook: the merged library plus its persistence ────────────────────────────

export interface ProfileStore {
  profiles: StaffingProfile[];
  ready: boolean;
  storageOk: boolean;
  upsert: (p: StaffingProfile) => void;
  remove: (id: string) => void;
  duplicate: (p: StaffingProfile) => StaffingProfile;
}

export function useProfileStore(): ProfileStore {
  const [custom, setCustom] = useState<StaffingProfile[]>([]);
  const [ready, setReady] = useState(false);
  const [storageOk, setStorageOk] = useState(true);

  useEffect(() => {
    setCustom(loadCustomProfiles());
    setReady(true);
  }, []);

  const commit = (next: StaffingProfile[]) => {
    setCustom(next);
    setStorageOk(saveCustomProfiles(next));
  };

  return {
    profiles: useMemo(() => [...custom, ...BUILT_IN_PROFILES], [custom]),
    ready,
    storageOk,
    upsert: (p) => {
      const clean = { ...p, builtIn: false };
      commit(custom.some((c) => c.id === clean.id)
        ? custom.map((c) => (c.id === clean.id ? clean : c))
        : [clean, ...custom]);
    },
    remove: (id) => commit(custom.filter((c) => c.id !== id)),
    duplicate: (p) => {
      const copy: StaffingProfile = {
        ...JSON.parse(JSON.stringify(p)),
        id: newProfileId(),
        label: `${p.label} (copy)`,
        builtIn: false,
      };
      commit([copy, ...custom]);
      return copy;
    },
  };
}

// ── Small parts ──────────────────────────────────────────────────────────────

function Chip({ children, tone = 'plain' }: { children: React.ReactNode; tone?: 'plain' | 'brand' | 'warn' }) {
  const map = {
    plain: { bg: T.lineSoft, fg: T.muted, bd: T.line },
    brand: { bg: T.brandSoft, fg: T.brandDark, bd: T.brandLine },
    warn: { bg: T.warnBg, fg: T.warn, bd: T.warnLine },
  }[tone];
  return (
    <span style={{
      background: map.bg, color: map.fg, border: `1px solid ${map.bd}`, borderRadius: 999,
      padding: '1px 7px', fontSize: 9.5, fontWeight: 700, letterSpacing: 0.3, whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

const iconBtn: React.CSSProperties = {
  border: `1px solid ${T.line}`, background: T.bg, color: T.muted, borderRadius: 6,
  cursor: 'pointer', fontSize: 10.5, fontWeight: 700, padding: '2px 6px', lineHeight: 1.4,
};

// ── Profile editor ───────────────────────────────────────────────────────────

function ProfileEditor({ draft, policy, onChange, onSave, onCancel }: {
  draft: StaffingProfile; policy: LaborPolicy;
  onChange: (p: StaffingProfile) => void; onSave: () => void; onCancel: () => void;
}) {
  const pv = previewProfile(draft, policy);
  const set = (patch: Partial<StaffingProfile>) => onChange({ ...draft, ...patch });
  const isOverrideRole = draft.type === 'manager' || draft.type === 'owner';

  return (
    <div style={{
      border: `1px solid ${T.brandLine}`, background: T.bg, borderRadius: 10,
      padding: 12,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 420px) 1fr', gap: 14 }}>
        <ScheduleEditor
          shifts={draft.shifts}
          unpaidBreakMinutes={draft.unpaidBreakMinutes}
          onChange={(n) => set({ shifts: n.shifts, unpaidBreakMinutes: n.unpaidBreakMinutes })}
          compact
        />
        <div style={{ display: 'grid', gap: 9, alignContent: 'start' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
            <Field label="Profile name" tooltip="What the card says. Keep it short — the vendor and region get their own fields.">
              <input value={draft.label} onChange={(e) => set({ label: e.target.value })}
                placeholder="Egypt BPO — 45 hr"
                style={{ ...inputStyle, fontFamily: T.sans, fontSize: 12 }} />
            </Field>
            <Field label="Vendor / partner" tooltip="Who bills you for these people. Free text — it only labels the card.">
              <input value={draft.vendor} onChange={(e) => set({ vendor: e.target.value })}
                placeholder="Cairo desk"
                style={{ ...inputStyle, fontFamily: T.sans, fontSize: 12 }} />
            </Field>
            <Field label="Region" tooltip="Country or city the seats sit in.">
              <input value={draft.region} onChange={(e) => set({ region: e.target.value })}
                placeholder="Egypt"
                style={{ ...inputStyle, fontFamily: T.sans, fontSize: 12 }} />
            </Field>
            <Field label="Default seats" tooltip="How many people this profile drops into the roster when you press Add. You can change the count on the card before adding.">
              <NumberInput value={draft.seats} min={1} max={50} onChange={(v) => set({ seats: Math.max(1, v) })} />
            </Field>
            <Field label="Type">
              <select value={draft.type} onChange={(e) => set({ type: e.target.value as EmployeeType })}
                style={{ ...inputStyle, fontSize: 12 }}>
                {(['inhouse', 'bpo', 'manager', 'owner'] as const).map((t) => (
                  <option key={t} value={t}>{EMPLOYEE_TYPE_LABEL[t]}</option>
                ))}
              </select>
            </Field>
            <Field label="Role" tooltip="Openers feed the transfer pool. Closers turn transfers into deals. Only closer hours create deal volume.">
              <select value={draft.role} onChange={(e) => set({ role: e.target.value as EmployeeRole })}
                style={{ ...inputStyle, fontSize: 12 }}>
                <option value="opener">Opener</option>
                <option value="closer">Closer</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </Field>
            {draft.role === 'hybrid' && (
              <Field label="% of hours closing">
                <NumberInput value={draft.hybridCloserSharePct} min={0} max={100}
                  onChange={(v) => set({ hybridCloserSharePct: v })} suffix="%" />
              </Field>
            )}
            <Field label="Hourly rate" tooltip="What this seat costs per paid hour. For BPO seats it is the flat billed rate; for in-house staff it is the wage before the overtime premium.">
              <NumberInput value={draft.hourlyRate} min={0} step={0.25}
                onChange={(v) => set({ hourlyRate: v })} prefix="$" />
            </Field>
            <Field label="Starts month" tooltip="First simulation month these seats are on payroll. Use it to model a vendor you bring on in month 4.">
              <NumberInput value={draft.startMonth} min={1} onChange={(v) => set({ startMonth: Math.max(1, v) })} />
            </Field>
            <Field label="Team" tooltip="Leave blank to inherit whatever team the roster is already using. Set it to put every seat from this profile on a named team.">
              <input value={draft.teamId} onChange={(e) => set({ teamId: e.target.value })}
                placeholder="inherit"
                style={{ ...inputStyle, fontFamily: T.sans, fontSize: 12 }} />
            </Field>
            {isOverrideRole && (
              <Field label="Override %" tooltip="Percentage of the enrolled debt volume this person's team closes. Policy band is 0.1%–0.25%.">
                <NumberInput value={draft.overridePct} min={0} max={5} step={0.05}
                  onChange={(v) => set({ overridePct: v })} suffix="%" />
              </Field>
            )}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.body }}>
              <input type="checkbox" checked={draft.otEligible} onChange={(e) => set({ otEligible: e.target.checked })} />
              Overtime eligible (1.5× above {policy.otThresholdHrsPerWeek} hrs/wk)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.body }}>
              <input type="checkbox" checked={draft.commissionOnly} onChange={(e) => set({ commissionOnly: e.target.checked })} />
              Commission only ($0 hourly)
            </label>
          </div>
          <Field label="Notes" tooltip="Contract terms, invoicing cadence, contact — anything you will want to see the next time you price this vendor.">
            <textarea value={draft.notes} onChange={(e) => set({ notes: e.target.value })} rows={2}
              style={{ ...inputStyle, fontFamily: T.sans, fontSize: 12, resize: 'vertical' }} />
          </Field>
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.lineSoft}`,
      }}>
        <span style={{ fontSize: 11.5, color: T.muted }}>
          <strong style={{ color: T.ink, fontFamily: T.mono }}>{fmtNum(pv.weeklyPaidHours, 1)}</strong> paid hrs/wk
          {pv.otHoursPerWeek > 0 && <span style={{ color: T.warn }}> · {fmtNum(pv.otHoursPerWeek, 1)} OT</span>}
          {' · '}
          <strong style={{ color: T.ink, fontFamily: T.mono }}>{fmtMoney(pv.monthlyCostPerSeat)}</strong>/mo per seat
          {' · '}
          <strong style={{ color: T.ink, fontFamily: T.mono }}>{fmtMoney(pv.monthlyCostPerSeat * draft.seats)}</strong> for {draft.seats} seat{draft.seats === 1 ? '' : 's'}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 7 }}>
          <Btn onClick={onCancel} size="sm">Cancel</Btn>
          <Btn onClick={onSave} size="sm" tone="primary">Save profile</Btn>
        </span>
      </div>
      {pv.warnings.length > 0 && <Callout tone="warn">{pv.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}</Callout>}
    </div>
  );
}

// ── The library drawer ───────────────────────────────────────────────────────

export function ProfileLibrary({ store, policy, onApply, onClose, seed, onSeedUsed }: {
  store: ProfileStore;
  policy: LaborPolicy;
  /** Add `seats` people built from this profile to the roster. */
  onApply: (p: StaffingProfile, seats: number) => void;
  onClose: () => void;
  /** A profile handed in from elsewhere (Save as profile on a roster row). */
  seed?: StaffingProfile | null;
  onSeedUsed?: () => void;
}) {
  const [draft, setDraft] = useState<StaffingProfile | null>(null);

  useEffect(() => {
    if (!seed) return;
    setDraft(seed);
    onSeedUsed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);
  const [seats, setSeats] = useState<Record<string, number>>({});
  const [q, setQ] = useState('');
  const [view, setView] = useState<ProfileView>('rows');

  // Remember the layout choice between visits — it is a per-person habit.
  useEffect(() => { setView(loadProfileView()); }, []);
  const switchView = (v: ProfileView) => { setView(v); saveProfileView(v); };

  const blank = (): StaffingProfile => ({
    ...profileFromEmployee(
      {
        id: 'x', name: '', type: 'bpo', role: 'opener', hourlyRate: 6, unpaidBreakMinutes: 0,
        otEligible: false, hybridCloserSharePct: 50, startMonth: 1, endMonth: null,
        shifts: BUILT_IN_PROFILES[0].shifts, commissionOnly: false, overridePct: 0, teamId: 'team-a',
      } as Employee,
      '',
    ),
    label: '',
  });

  const list = store.profiles.filter((p) => {
    if (!q.trim()) return true;
    const hay = `${p.label} ${p.vendor} ${p.region} ${p.notes} ${EMPLOYEE_TYPE_LABEL[p.type]} ${p.role}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  return (
    <div style={{
      border: `1px solid ${T.line}`, borderRadius: 10, background: T.panel, padding: 12, marginBottom: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: T.ink, display: 'flex', alignItems: 'center' }}>
          Staffing profiles
          <Info text="A profile is a saved agent template — vendor rate, weekly schedule, break, overtime rule, role and team. Applying one writes all of those onto new roster rows at once, so you never re-enter a vendor's terms by hand. Your own profiles are saved in this browser; the shipped ones are always available." />
        </div>
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vendor, region, role…"
          style={{ ...inputStyle, fontFamily: T.sans, fontSize: 12, width: 230 }}
        />
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 7, alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', border: `1px solid ${T.line}`, borderRadius: 7, overflow: 'hidden' }}
            title="Rows read like a rate sheet; cards show more per profile at a glance.">
            {(['rows', 'cards'] as const).map((v) => (
              <button key={v} onClick={() => switchView(v)}
                style={{
                  border: 'none', cursor: 'pointer', fontFamily: T.sans, fontWeight: 700, fontSize: 11,
                  padding: '4px 10px', textTransform: 'capitalize',
                  background: view === v ? T.brandSoft : T.bg,
                  color: view === v ? T.brandDark : T.muted,
                }}>{v}</button>
            ))}
          </span>
          <Btn onClick={() => setDraft(blank())} size="sm" tone="primary">+ New profile</Btn>
          <Btn onClick={onClose} size="sm">Close</Btn>
        </span>
      </div>

      {draft && (
        <div style={{ marginBottom: 10 }}>
          <ProfileEditor
            draft={draft} policy={policy} onChange={setDraft}
            onCancel={() => setDraft(null)}
            onSave={() => {
              store.upsert({ ...draft, label: draft.label.trim() || 'Untitled profile' });
              setDraft(null);
            }}
          />
        </div>
      )}

      {view === 'rows' ? (
        <div style={{ overflowX: 'auto', border: `1px solid ${T.line}`, borderRadius: 9, background: T.bg }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 880 }}>
            <thead>
              <tr>
                <th style={th}>Profile</th>
                <th style={th}>Type</th>
                <th style={th}>Role</th>
                <th style={th}>Schedule</th>
                <th style={{ ...th, textAlign: 'right' }}>Hrs / wk</th>
                <th style={{ ...th, textAlign: 'right' }}>Rate</th>
                <th style={{ ...th, textAlign: 'right' }}>$ / mo per seat<Info text="What one seat on this profile costs per month at the current labor policy: (regular hrs × rate + OT hrs × rate × multiplier) × 52/12." /></th>
                <th style={{ ...th, textAlign: 'right' }}>Seats</th>
                <th style={{ ...th, width: 70 }} />
                <th style={{ ...th, width: 118 }} />
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const pv = previewProfile(p, policy);
                const n = seats[p.id] ?? p.seats;
                const rateBad = pv.warnings.some((w) => w.includes('band') || w.includes('minimum wage'));
                return (
                  <tr key={p.id}>
                    <td style={{ ...td, minWidth: 210, whiteSpace: 'normal' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontWeight: 700, color: T.ink, fontSize: 12.5 }}>{p.label}</span>
                        {!p.builtIn && <Chip tone="brand">saved</Chip>}
                      </span>
                      {(p.vendor || p.region) && (
                        <span style={{ fontSize: 10.5, color: T.faint }}>
                          {[p.vendor, p.region].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </td>
                    <td style={{ ...td, fontSize: 11.5, color: T.muted }}>{EMPLOYEE_TYPE_LABEL[p.type]}</td>
                    <td style={{ ...td, fontSize: 11.5, color: T.muted }}>
                      {p.role}{p.role === 'hybrid' ? ` · ${p.hybridCloserSharePct}%` : ''}
                    </td>
                    <td style={{ ...td, fontSize: 11, color: T.muted, fontFamily: T.mono }}>{pv.scheduleLabel}</td>
                    <td style={tdNum}>
                      {fmtNum(pv.weeklyPaidHours, 1)}
                      {pv.otHoursPerWeek > 0 && (
                        <span style={{ color: T.warn, fontSize: 10 }}> +{fmtNum(pv.otHoursPerWeek, 1)} OT</span>
                      )}
                    </td>
                    <td style={{ ...tdNum, color: rateBad ? T.warn : T.body, fontWeight: rateBad ? 700 : 400 }}
                      title={rateBad ? pv.warnings[0] : undefined}>
                      {p.commissionOnly ? 'comm-only' : fmtMoney2(p.hourlyRate)}
                    </td>
                    <td style={{ ...tdNum, fontWeight: 800, color: T.ink, fontSize: 13 }}>
                      {fmtMoney(pv.monthlyCostPerSeat)}
                    </td>
                    <td style={{ ...tdNum, width: 74 }}>
                      <NumberInput value={n} min={1} max={50}
                        onChange={(v) => setSeats({ ...seats, [p.id]: Math.max(1, v) })} />
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <Btn onClick={() => onApply(p, n)} size="sm" tone="primary"
                        title={`Add ${n} agent${n === 1 ? '' : 's'} — ${fmtMoney(pv.monthlyCostPerSeat * n)}/mo`}>
                        Add{n > 1 ? ` ${n}` : ''}
                      </Btn>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <span style={{ display: 'inline-flex', gap: 4 }}>
                        <button style={iconBtn} title="Duplicate into an editable copy"
                          onClick={() => setDraft(store.duplicate(p))}>Copy</button>
                        {!p.builtIn && (
                          <>
                            <button style={iconBtn} title="Edit this profile"
                              onClick={() => setDraft(JSON.parse(JSON.stringify(p)))}>Edit</button>
                            <button style={{ ...iconBtn, color: T.bad, borderColor: '#fecaca' }} title="Delete this profile"
                              onClick={() => store.remove(p.id)}>Del</button>
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr>
                  <td style={{ ...td, color: T.faint }} colSpan={10}>No profile matches that search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(252px, 1fr))', gap: 10 }}>
          {list.map((p) => {
            const pv = previewProfile(p, policy);
            const n = seats[p.id] ?? p.seats;
            return (
              <div key={p.id} style={{
                border: `1px solid ${T.line}`, borderRadius: 10, background: T.bg, padding: '10px 11px',
                display: 'flex', flexDirection: 'column', gap: 7,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: T.ink, lineHeight: 1.3, flex: 1 }}>
                    {p.label}
                  </div>
                  {!p.builtIn && <Chip tone="brand">saved</Chip>}
                </div>

                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <Chip>{EMPLOYEE_TYPE_LABEL[p.type]}</Chip>
                  <Chip>{p.role}</Chip>
                  {p.region && <Chip>{p.region}</Chip>}
                  {p.vendor && <Chip>{p.vendor}</Chip>}
                  {pv.otHoursPerWeek > 0 && <Chip tone="warn">{fmtNum(pv.otHoursPerWeek, 1)} OT hrs</Chip>}
                </div>

                <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>
                  {pv.scheduleLabel} · {fmtNum(pv.weeklyPaidHours, 1)} hrs/wk
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.mono }}>
                    {fmtMoney(pv.monthlyCostPerSeat)}
                  </span>
                  <span style={{ fontSize: 10.5, color: T.faint }}>
                    /mo per seat · {p.commissionOnly ? 'comm-only' : `${fmtMoney2(p.hourlyRate)}/hr`}
                  </span>
                </div>

                {pv.warnings.length > 0 && (
                  <div style={{ fontSize: 10, color: T.warn }}>⚠ {pv.warnings[0]}</div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto', paddingTop: 4 }}>
                  <span style={{ width: 62 }}>
                    <NumberInput value={n} min={1} max={50}
                      onChange={(v) => setSeats({ ...seats, [p.id]: Math.max(1, v) })} />
                  </span>
                  <Btn onClick={() => onApply(p, n)} size="sm" tone="primary"
                    title={`Add ${n} agent${n === 1 ? '' : 's'} from this profile — ${fmtMoney(pv.monthlyCostPerSeat * n)}/mo`}>
                    Add{n > 1 ? ` ${n}` : ''}
                  </Btn>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    <button style={iconBtn} title="Duplicate into an editable copy"
                      onClick={() => setDraft(store.duplicate(p))}>Copy</button>
                    {!p.builtIn && (
                      <>
                        <button style={iconBtn} title="Edit this profile"
                          onClick={() => setDraft(JSON.parse(JSON.stringify(p)))}>Edit</button>
                        <button style={{ ...iconBtn, color: T.bad, borderColor: '#fecaca' }} title="Delete this profile"
                          onClick={() => store.remove(p.id)}>Del</button>
                      </>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!store.storageOk && (
        <Callout tone="warn">
          This browser refused to save profiles (private window or blocked site data). Profiles you create will
          work for this session but will be gone on reload.
        </Callout>
      )}
      <Callout>
        Built-in profiles are <strong>starting points, not quotes</strong> — copy one, set the rate your vendor
        actually bills and the hours they actually work, then save it. Applying a profile writes rate, schedule,
        break, overtime, role, team and start month onto the new rows in one step; everything stays editable in
        the roster afterwards.
      </Callout>
    </div>
  );
}

// ── Row-level "apply a profile to this person" ───────────────────────────────

export function ApplyProfileSelect({ store, onApply }: {
  store: ProfileStore; onApply: (p: StaffingProfile) => void;
}) {
  return (
    <select
      value="" style={{ ...inputStyle, fontFamily: T.sans, fontSize: 11.5, padding: '4px 6px' }}
      onChange={(e) => {
        const p = store.profiles.find((x) => x.id === e.target.value);
        if (p) onApply(p);
      }}
    >
      <option value="">Apply a profile…</option>
      {store.profiles.map((p) => (
        <option key={p.id} value={p.id}>{p.label}</option>
      ))}
    </select>
  );
}
