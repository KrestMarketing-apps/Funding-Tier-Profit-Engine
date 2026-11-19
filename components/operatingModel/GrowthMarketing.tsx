import React from 'react';
import type { ModelInputs, ModelResults, MarketingChannelMonth } from './types';
import { Callout, Field, NumberInput, Panel, Row, T, fmtMoney, fmtNum, td, tdNum, th } from './ui';
import { marketingIsOn } from './marketing';
import { runModel } from './simulate';
import { makeEmployee } from './config';
import { computeEmployeeCost } from './labor';

const MK_CLOSER_PREFIX = 'mk-closer-';

/**
 * 2b · Growth Marketing — direct mail, credit-bureau data, paid social.
 *
 * Inputs on the left are planning assumptions; the right side shows what they
 * do inside the cash model for the selected month, and the bottom explains how
 * the same numbers are measured penny for penny once a campaign is live in
 * app.krestmarketing.com.
 */
export default function GrowthMarketing({ inputs, setInputs, results, month, setMonth, horizon }: {
  inputs: ModelInputs;
  setInputs: (i: ModelInputs) => void;
  results: ModelResults;
  month: number;
  setMonth: (m: number) => void;
  horizon: number;
}) {
  const mk = inputs.marketing;
  const setMail = (p: Partial<typeof mk.directMail>) =>
    setInputs({ ...inputs, marketing: { ...mk, directMail: { ...mk.directMail, ...p } } });
  const setSocial = (p: Partial<typeof mk.paidSocial>) =>
    setInputs({ ...inputs, marketing: { ...mk, paidSocial: { ...mk.paidSocial, ...p } } });
  const setCreative = (v: number) =>
    setInputs({ ...inputs, marketing: { ...mk, creativeAndTrackingPerMonth: v } });

  const row = results.months[Math.min(month, horizon) - 1];
  const det = row?.marketing;
  const on = marketingIsOn(inputs);

  // Incremental view vs the same model with marketing off — the only honest
  // way to show what the spend bought. Computed here, not in the engine, so
  // the engine stays a single pass.
  const baseline = React.useMemo(() => {
    if (!on) return null;
    const off: ModelInputs = {
      ...inputs,
      // The plan before marketing: no channels AND none of the closers hired to answer them.
      roster: inputs.roster.filter((e) => !e.id.startsWith(MK_CLOSER_PREFIX)),
      marketing: {
        ...inputs.marketing,
        directMail: { ...inputs.marketing.directMail, enabled: false },
        paidSocial: { ...inputs.marketing.paidSocial, enabled: false },
      },
    };
    return runModel(off);
  }, [inputs, on]);

  const horizonDelta = baseline ? {
    revenue: results.totals.revenue - baseline.totals.revenue,
    transfers: baseline.totals.transferCost - results.totals.transferCost,
    commission: results.totals.repCommission - baseline.totals.repCommission,
    spend: results.totals.marketingCost,
    cash: results.totals.finalCash - baseline.totals.finalCash,
    labor: results.totals.laborCost - baseline.totals.laborCost,
    deals: results.months.reduce((s, r) => s + r.deals, 0) - baseline.months.reduce((s, r) => s + r.deals, 0),
    enrolled: results.partners.reduce((s, p) => s + p.enrolledVolume, 0) - baseline.partners.reduce((s, p) => s + p.enrolledVolume, 0),
  } : null;

  const tierPresets = [
    { label: 'Off', mail: 0, social: 0 },
    { label: 'Tier 1 · Test ($15k)', mail: 10000, cpp: 0.8, data: 1500, social: 4000, creative: 1500 },
    { label: 'Tier 2 · Growth ($40k)', mail: 30000, cpp: 0.75, data: 3000, social: 12000, creative: 2500 },
    { label: 'Tier 3 · Scale ($90k)', mail: 75000, cpp: 0.7, data: 6000, social: 27000, creative: 4500 },
  ] as const;
  // A tier is a budget AND the closers to answer what it generates. Marketing
  // is only ever added alongside headcount — calls nobody can take are wasted
  // spend — so each preset hires enough in-house closers to absorb its
  // qualified calls at the model's handle time, and "Off" lets them go.
  const closersNeededFor = (pieces: number, social: number) => {
    const dm = mk.directMail, ps = mk.paidSocial;
    const calls = pieces * (dm.responsePct / 100) * (dm.qualifiedPct / 100)
      + (ps.costPerLead > 0 ? social / ps.costPerLead : 0) * (ps.qualifiedPct / 100);
    const minutes = calls * Math.max(1, inputs.operations.avgHandleMinutes);
    const template = inputs.roster.find((e) => e.type === 'inhouse' && e.role === 'closer');
    const one = computeEmployeeCost(makeEmployee({ ...(template ?? {}), id: 'probe', type: 'inhouse', role: 'closer', startMonth: 1, endMonth: null }), inputs.laborPolicy);
    const perCloser = Math.max(1, one.monthlyCloserHours * 60);
    return Math.ceil(minutes / perCloser);
  };
  const rosterWithMarketingClosers = (n: number) => {
    const base = inputs.roster.filter((e) => !e.id.startsWith(MK_CLOSER_PREFIX));
    const template = base.find((e) => e.type === 'inhouse' && e.role === 'closer');
    const start = Math.min(mk.directMail.startMonth, mk.paidSocial.startMonth) || 1;
    const added = Array.from({ length: n }, (_, i) => makeEmployee({
      ...(template ?? {}), id: `${MK_CLOSER_PREFIX}${i + 1}`, name: `Closer (marketing) ${i + 1} — In-House`,
      type: 'inhouse', role: 'closer', startMonth: start, endMonth: null, teamId: template?.teamId ?? 'team-a',
    }));
    return [...base, ...added];
  };
  const mkClosersOnRoster = inputs.roster.filter((e) => e.id.startsWith(MK_CLOSER_PREFIX)).length;

  const applyTier = (t: typeof tierPresets[number]) => {
    if (t.mail === 0) {
      setInputs({
        ...inputs,
        roster: rosterWithMarketingClosers(0),
        marketing: { ...mk, directMail: { ...mk.directMail, enabled: false }, paidSocial: { ...mk.paidSocial, enabled: false } },
      });
      return;
    }
    setInputs({
      ...inputs,
      roster: rosterWithMarketingClosers(closersNeededFor(t.mail, t.social)),
      marketing: {
        ...mk,
        directMail: { ...mk.directMail, enabled: true, piecesPerMonth: t.mail, costPerPiece: t.cpp, dataCostPerMonth: t.data },
        paidSocial: { ...mk.paidSocial, enabled: true, spendPerMonth: t.social },
        creativeAndTrackingPerMonth: t.creative,
      },
    });
  };
  const closersNeededNow = on ? closersNeededFor(mk.directMail.enabled ? mk.directMail.piecesPerMonth : 0, mk.paidSocial.enabled ? mk.paidSocial.spendPerMonth : 0) : 0;

  return (
    <>
      <Panel title="2b · Growth Marketing — direct mail, bureau data, paid social" accent={T.accent}
        tooltip="Channels that generate INBOUND qualified calls Funding Tier controls, instead of buying transfers. Inbound calls are handled first; purchased transfers fill the closer time that is left. Every rate here is a planning assumption until a campaign has run and the CRM has measured it.">

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.muted }}>Budget tier presets:</span>
          {tierPresets.map((t) => (
            <button key={t.label} onClick={() => applyTier(t)} style={{
              padding: '6px 10px', borderRadius: 8, border: `1px solid ${T.line}`, background: '#fff',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', color: T.ink,
            }}>{t.label}{t.mail > 0 ? ` · +${closersNeededFor(t.mail, t.social)} closers` : ''}</button>
          ))}
          <span style={{ fontSize: 11.5, color: T.muted }}>Each tier hires the in-house closers needed to answer the calls it generates; Off lets them go.</span>
        </div>

        <Row cols={2} gap={16}>
          {/* ── Direct mail ── */}
          <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 13, marginBottom: 10 }}>
              <input type="checkbox" checked={mk.directMail.enabled} onChange={(e) => setMail({ enabled: e.target.checked })} />
              Direct mail + credit-bureau prescreen data
            </label>
            <Row cols={2}>
              <Field label="Pieces per month"><NumberInput value={mk.directMail.piecesPerMonth} min={0} step={1000} onChange={(v) => setMail({ piecesPerMonth: v })} /></Field>
              <Field label="Cost per piece (all-in)" tooltip="Print + postage + data append + mail house handling. Letters in a #10 envelope with a tracking number typically land at $0.65–$0.95."><NumberInput value={mk.directMail.costPerPiece} min={0} step={0.05} prefix="$" onChange={(v) => setMail({ costPerPiece: v })} /></Field>
              <Field label="Prescreen data / month" tooltip="Tri-bureau prescreen or modeled list from a reseller (Altair Data CreditReady, CRS LeadsIQ, Deluxe tri-bureau, Data Axle). $0.03–$0.10 per record plus a monthly minimum. Prescreen lists require a firm offer of credit — the personal-loan pre-approval structure."><NumberInput value={mk.directMail.dataCostPerMonth} min={0} step={250} prefix="$" onChange={(v) => setMail({ dataCostPerMonth: v })} /></Field>
              <Field label="Start month"><NumberInput value={mk.directMail.startMonth} min={1} max={60} onChange={(v) => setMail({ startMonth: v })} /></Field>
              <Field label="Response rate" tooltip="Share of pieces that produce an inbound call. Debt relief mail to prescreened high-utilization households runs roughly 0.75%–2%."><NumberInput value={mk.directMail.responsePct} min={0} max={20} step={0.05} suffix="%" onChange={(v) => setMail({ responsePct: v })} /></Field>
              <Field label="Qualified share" tooltip="Share of inbound mail calls that reach a real pitch (right person, debt above the floor, not in bankruptcy)."><NumberInput value={mk.directMail.qualifiedPct} min={0} max={100} step={1} suffix="%" onChange={(v) => setMail({ qualifiedPct: v })} /></Field>
              <Field label="Close rate (inbound)" tooltip="Inbound callers close higher than transfers — they picked up the phone themselves."><NumberInput value={mk.directMail.closeRatePct} min={0} max={100} step={0.5} suffix="%" onChange={(v) => setMail({ closeRatePct: v })} /></Field>
              <Field label="Avg enrolled debt" tooltip="The targeting dividend: you choose who gets mailed, so the debt load is yours to set."><NumberInput value={mk.directMail.avgDebt} min={0} step={500} prefix="$" onChange={(v) => setMail({ avgDebt: v })} /></Field>
            </Row>
          </div>

          {/* ── Paid social ── */}
          <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 13, marginBottom: 10 }}>
              <input type="checkbox" checked={mk.paidSocial.enabled} onChange={(e) => setSocial({ enabled: e.target.checked })} />
              Paid social (Meta, YouTube) — including retargeting of mailed ZIPs
            </label>
            <Row cols={2}>
              <Field label="Spend per month"><NumberInput value={mk.paidSocial.spendPerMonth} min={0} step={500} prefix="$" onChange={(v) => setSocial({ spendPerMonth: v })} /></Field>
              <Field label="Cost per lead" tooltip="Form fill or click-to-call. Debt relief CPL on Meta runs $25–$60; retargeting mailed households is the cheap end."><NumberInput value={mk.paidSocial.costPerLead} min={1} step={1} prefix="$" onChange={(v) => setSocial({ costPerLead: v })} /></Field>
              <Field label="Lead → qualified call"><NumberInput value={mk.paidSocial.qualifiedPct} min={0} max={100} step={1} suffix="%" onChange={(v) => setSocial({ qualifiedPct: v })} /></Field>
              <Field label="Start month"><NumberInput value={mk.paidSocial.startMonth} min={1} max={60} onChange={(v) => setSocial({ startMonth: v })} /></Field>
              <Field label="Close rate"><NumberInput value={mk.paidSocial.closeRatePct} min={0} max={100} step={0.5} suffix="%" onChange={(v) => setSocial({ closeRatePct: v })} /></Field>
              <Field label="Avg enrolled debt"><NumberInput value={mk.paidSocial.avgDebt} min={0} step={500} prefix="$" onChange={(v) => setSocial({ avgDebt: v })} /></Field>
            </Row>
            <div style={{ marginTop: 10 }}>
              <Field label="Creative, landing pages, call tracking, compliance review / month" tooltip="Flat monthly while any channel is on: creative refresh, landing pages, tracking numbers per drop, attorney review of each mail piece against FCRA prescreen rules and the TSR.">
                <NumberInput value={mk.creativeAndTrackingPerMonth} min={0} step={250} prefix="$" onChange={setCreative} />
              </Field>
            </div>
          </div>
        </Row>

        {/* ── What it does this month ── */}
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 13 }}>What the channels do in month</strong>
          <NumberInput value={month} min={1} max={horizon} onChange={setMonth} />
          {!on && <span style={{ fontSize: 12, color: T.muted }}>Switch a channel on or pick a tier preset to see the effect.</span>}
        </div>
        {on && det && (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, fontSize: 12.5 }}>
              <thead><tr>
                <th style={th}>Channel</th><th style={{ ...th, textAlign: 'right' }}>Spend</th><th style={{ ...th, textAlign: 'right' }}>Pieces / leads</th>
                <th style={{ ...th, textAlign: 'right' }}>Inbound</th><th style={{ ...th, textAlign: 'right' }}>Qualified</th><th style={{ ...th, textAlign: 'right' }}>Handled</th>
                <th style={{ ...th, textAlign: 'right' }}>Deals</th><th style={{ ...th, textAlign: 'right' }}>Avg debt</th><th style={{ ...th, textAlign: 'right' }}>Enrolled debt</th>
                <th style={{ ...th, textAlign: 'right' }}>$ / qualified call</th><th style={{ ...th, textAlign: 'right' }}>$ / deal</th>
              </tr></thead>
              <tbody>
                {det.channels.filter((c: MarketingChannelMonth) => c.active).map((c) => (
                  <tr key={c.key}>
                    <td style={td}>{c.label}</td>
                    <td style={tdNum}>{fmtMoney(c.spend)}</td>
                    <td style={tdNum}>{fmtNum(c.units)}</td>
                    <td style={tdNum}>{fmtNum(c.inboundCalls)}</td>
                    <td style={tdNum}>{fmtNum(c.qualifiedCalls)}</td>
                    <td style={tdNum}>{fmtNum(c.handledCalls)}</td>
                    <td style={tdNum}>{fmtNum(c.deals, 1)}</td>
                    <td style={tdNum}>{fmtMoney(c.avgDebt)}</td>
                    <td style={tdNum}>{fmtMoney(c.enrolledVolume)}</td>
                    <td style={tdNum}>{fmtMoney(c.costPerQualifiedCall)}</td>
                    <td style={tdNum}>{fmtMoney(c.costPerDeal)}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 800 }}>
                  <td style={td}>Total (incl. creative / tracking {fmtMoney(det.creativeAndTracking)})</td>
                  <td style={tdNum}>{fmtMoney(det.spend)}</td><td style={tdNum} /><td style={tdNum} />
                  <td style={tdNum}>{fmtNum(det.qualifiedCalls)}</td><td style={tdNum}>{fmtNum(det.handledCalls)}</td>
                  <td style={tdNum}>{fmtNum(det.deals, 1)}</td><td style={tdNum}>{fmtMoney(det.deals > 0 ? det.enrolledVolume / det.deals : 0)}</td>
                  <td style={tdNum}>{fmtMoney(det.enrolledVolume)}</td><td style={tdNum} />
                  <td style={tdNum}>{fmtMoney(det.deals > 0 ? det.spend / det.deals : 0)}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ fontSize: 12.5, color: T.body, marginTop: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>
                Occupancy: marketing calls use <strong>{fmtNum(row.capacity.availableCallMinutes > 0 ? (det.callMinutes / row.capacity.availableCallMinutes) * 100 : 0)}%</strong> of closer talk time this month;
                roster is <strong>{fmtNum(row.utilizationPct)}%</strong> utilised with {fmtNum(det.unansweredCalls)} qualified calls unanswered.
                Closers needed for this spend: <strong>{closersNeededNow}</strong>{mkClosersOnRoster > 0 ? ` (${mkClosersOnRoster} marketing closers on the roster)` : ''}.
              </span>
              {closersNeededNow !== mkClosersOnRoster && (
                <button onClick={() => setInputs({ ...inputs, roster: rosterWithMarketingClosers(closersNeededNow) })} style={{
                  padding: '4px 10px', borderRadius: 8, border: `1px solid ${T.brandLine}`, background: T.brandSoft, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: T.brandDeep,
                }}>Size roster to this spend ({closersNeededNow} closers)</button>
              )}
            </div>
            {det.unansweredCalls > 0.5 && (
              <Callout tone="warn">
                {fmtNum(det.unansweredCalls)} qualified inbound calls went unanswered in month {month} — the roster is out of talk time ({fmtNum(row.utilizationPct)}% utilised). Marketing spend is buying calls nobody can take. Add closer hours (overtime first, then a seat in Staffing &amp; Labor) or reduce the drop.
              </Callout>
            )}
            {det.unansweredCalls <= 0.5 && row.utilizationPct >= 99 && mkClosersOnRoster < closersNeededNow && (
              <Callout tone="warn">
                Closers are at {fmtNum(row.utilizationPct)}% utilisation, so inbound marketing calls are <em>replacing</em> purchased transfers rather than adding deals. The spend buys larger debt loads and lower transfer bills, not volume — to grow volume, add closer hours alongside the budget.
              </Callout>
            )}
          </>
        )}

        {/* ── Horizon ROI vs the same plan with marketing off ── */}
        {on && horizonDelta && (
          <div style={{ marginTop: 14, border: `1px solid ${T.line}`, borderRadius: 10, padding: 12, background: '#fafcfb' }}>
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Over the {horizon}-month horizon, versus the plan before marketing (no channels, none of the {mkClosersOnRoster} closers hired for them)</div>
            <Row cols={7} gap={10}>
              {[
                ['Marketing spend', -horizonDelta.spend],
                ['Added closer labor', -horizonDelta.labor],
                ['Added revenue', horizonDelta.revenue],
                ['Transfer spend saved', horizonDelta.transfers],
                ['Added rep commission', -horizonDelta.commission],
                ['Added deals', horizonDelta.deals, 'n'],
                ['Net cash effect', horizonDelta.cash],
              ].map(([l, v, kind]) => (
                <div key={String(l)} style={{ background: '#fff', border: `1px solid ${T.line}`, borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>{l}</div>
                  <div style={{ fontFamily: T.mono, fontWeight: 800, fontSize: 15, color: Number(v) < 0 ? '#b91c1c' : '#0f766e' }}>
                    {kind === 'n' ? fmtNum(Number(v), 1) : fmtMoney(Number(v))}
                  </div>
                </div>
              ))}
            </Row>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 8 }}>
              Added enrolled debt over the horizon: <strong>{fmtMoney(horizonDelta.enrolled)}</strong>. Net cash is the only number that matters: it is revenue the channels added, plus transfers they replaced, minus their cost, the closers hired to answer them and the commission on the extra deals.
            </div>
          </div>
        )}
      </Panel>

      {/* ── How ROI is measured once live ── */}
      <Panel title="How ROI is tracked penny for penny in app.krestmarketing.com" collapsible defaultOpen={false}
        tooltip="The model above uses assumptions. This is how the same funnel is measured from real campaigns, so every assumption gets replaced by an observed number.">
        <Row cols={2} gap={16}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>Attribution — every call and lead carries a campaign code</div>
            <ol style={{ fontSize: 12.5, lineHeight: 1.55, paddingLeft: 18, color: T.ink }}>
              <li><strong>One tracking number per mail drop</strong> (LC Phone number pool). The piece says "call 888-xxx-1234"; that number is tagged <em>MAIL-2026-12-A</em>. Every inbound call on it lands as a contact with Source = Direct Mail, Campaign = that code.</li>
              <li><strong>Social leads</strong> arrive by form or click-to-call with UTM parameters; the workflow writes Source = Paid Social and Campaign = the ad set name onto the contact.</li>
              <li><strong>Transfers</strong> already carry the vendor and buffer as Source, so all three channels sit side by side on the same contact fields.</li>
              <li><strong>The opportunity inherits the code</strong> when the rep enrolls the client, so the pipeline board can be filtered by campaign at every stage: qualified → pitched → enrolled → first payment cleared.</li>
              <li><strong>The pay engine ties the deal to the backend file</strong> (Shield, ELP, Level) and records first-payment clear, NSF, second payment and every dollar the provider remits — all keyed to the same campaign code.</li>
            </ol>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>The ROI ledger per campaign</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <tbody>
                {[
                  ['Spend', 'Mail house + data + postage invoice (or ad spend) entered against the campaign code'],
                  ['Inbound calls', 'Calls on the campaign tracking number (CRM call log)'],
                  ['Qualified calls', 'Calls with handle time above the pitch threshold and a contact created'],
                  ['Enrollments', 'Opportunities with that campaign code reaching Enrolled'],
                  ['Paid deals', 'Deals whose first program payment cleared at the backend'],
                  ['Revenue', 'Provider remittances matched to those deals by the reconciliation engine, month by month'],
                  ['Commission + bonuses', 'From the monthly commission run, same deals'],
                  ['Net', 'Revenue − commission − spend, cumulative, with payback month'],
                ].map(([k, v]) => (
                  <tr key={k}><td style={{ ...td, fontWeight: 700, whiteSpace: 'nowrap' }}>{k}</td><td style={td}>{v}</td></tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 8 }}>
              Observed response, qualified share, close rate and average debt per campaign feed straight back into the inputs above, so after the first drop the model stops being an assumption and becomes last month's numbers.
            </div>
          </div>
        </Row>
      </Panel>
    </>
  );
}
