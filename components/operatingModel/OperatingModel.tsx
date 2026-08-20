'use client';
import React, { useMemo, useState } from 'react';
import type { BackendKey, ModelInputs } from './types';
import { BACKEND_KEYS } from './types';
import { BRANDS, cloneDefaults } from './config';
import { runModel } from './simulate';
import { blendedTransferCost } from './costs';
import { legacy, shield } from './backends';
import { RosterEditor } from './RosterEditor';
import { ShowTheMath } from './ShowTheMath';
import { MonthEndReport } from './MonthEndReport';
import {
  Btn, Callout, Field, FT_LOGO, G, Info, NumberInput, Panel, PartnerName, PartnerMark, Row, T,
  fmtMoney, fmtMoney2, fmtNum, fmtPct, inputStyle, td, tdNum, th,
} from './ui';

// ── Column tooltips for the month-by-month table ─────────────────────────────
const MONTH_COL_HELP: Record<string, string> = {
  mo: 'Simulation month, counting from the first month of operation.',
  deals: 'New deals submitted this month. Derived from paid closer hours ÷ 8 × deals-per-8-hours, capped by available talk time and scaled by the ramp factor, then split across the three servicing partners by the volume mix.',
  revenue: 'Cash actually received from the servicing partners this month — not deals signed. Every backend pays in arrears, so this lags enrollment. Computed as: for each live cohort, surviving deals × revenue per payment × (1 − dispute rate).',
  commission: 'Commission Funding Tier PAYS OUT to its own reps. This is money leaving the business, not money coming in. Booked in the month the backend releases payout, which is why month 1 is always zero.',
  override: 'Override earned by Managers and Owner Operators on the deals their team closed, on top of anything they closed themselves. Another outflow.',
  bonuses: 'Daily deal, monthly volume, balanced book and Level Debt enrolment bonuses paid this month, net of any provisional holdback. Daily thresholds are inferred from monthly volume using the deal-concentration setting.',
  overhead: 'Total monthly operating cost: fixed tools + per-user tools + usage rates + Trackdrive + transfer acquisition + labor. Transfer acquisition is included here — in the previous model it was deducted from cash but omitted from this column.',
  netcf: 'Revenue − commission paid to reps − overhead. The cash the business generated or burned this month.',
  cash: 'Running cash on hand: prior month cash position + this month net cash flow. Negative means capital has to be funded from outside.',
  reserve: 'Whether cash on hand covers the reserve target, which is monthly overhead × the reserve months setting.',
  seats: 'Agents on payroll this month, counted from the roster.',
  util: 'Share of available closer talk time consumed: (qualified transfers × average handle time) ÷ (closer hours × 60). Above 100% means the roster is booked beyond what it can physically service.',
  event: 'Staffing or policy events that changed the model this month.',
  notes: 'Plain-English explanation of anything unusual about this month — most importantly why month 1 collects nothing.',
};

function Stat({ label, value, sub, tooltip, tone }: {
  label: string; value: string; sub?: string; tooltip: string; tone?: 'good' | 'bad';
}) {
  return (
    <div style={{
      border: `1px solid ${T.line}`, borderRadius: 11, padding: '11px 13px', background: G.tile,
      boxShadow: '0 1px 2px rgba(15,23,42,.04)',
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
        color: T.muted, display: 'flex', alignItems: 'center',
      }}>{label}<Info text={tooltip} /></div>
      <div style={{
        fontSize: 20, fontWeight: 800, marginTop: 5, fontFamily: T.mono, letterSpacing: '-0.5px',
        color: tone === 'bad' ? T.bad : tone === 'good' ? T.good : T.ink,
      }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: T.faint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function LedgerRow({ label, detail, amount, level = 0, bold, top, help }: {
  label: string; detail?: string; amount: number; level?: number;
  bold?: boolean; top?: boolean; help?: string;
}) {
  return (
    <tr>
      <td style={{
        ...td, paddingLeft: 10 + level * 18, whiteSpace: 'normal',
        fontWeight: bold ? 800 : 400, color: bold ? T.ink : T.body,
        borderTop: top ? `2px solid ${T.ink}` : undefined,
        borderBottom: bold ? 'none' : `1px solid ${T.lineSoft}`,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>{label}{help && <Info text={help} />}</span>
        {detail && <div style={{ fontSize: 10, color: T.faint, marginTop: 1 }}>{detail}</div>}
      </td>
      <td style={{
        ...tdNum, fontWeight: bold ? 800 : 500, color: bold ? T.ink : T.body,
        borderTop: top ? `2px solid ${T.ink}` : undefined,
        borderBottom: bold ? 'none' : `1px solid ${T.lineSoft}`,
        fontSize: bold ? 13.5 : 12,
      }}>{fmtMoney(amount)}</td>
    </tr>
  );
}

export default function OperatingModel() {
  const [inputs, setInputs] = useState<ModelInputs>(() => cloneDefaults());
  const results = useMemo(() => runModel(inputs), [inputs]);
  const horizon = results.months.length;
  const [stmtMonth, setStmtMonth] = useState(1);
  const [mathOpen, setMathOpen] = useState(false);
  const month = results.months[Math.min(stmtMonth, horizon) - 1];
  const patch = (p: Partial<ModelInputs>) => setInputs({ ...inputs, ...p });
  const blended = blendedTransferCost(inputs);
  const mixTotal = inputs.operations.buffers.reduce((a, b) => a + b.mixPct, 0);
  const setBuffer = (key: string, patch: Record<string, number>) => patch && setInputs({
    ...inputs,
    operations: {
      ...inputs.operations,
      buffers: inputs.operations.buffers.map((b) => (b.key === key ? { ...b, ...patch } : b)),
    },
  });
  const volMixTotal = BACKEND_KEYS.reduce((s, k) => s + inputs.volume.mixPct[k], 0);
  const derivedCap = results.months[0]?.capacity;

  const MonthPicker = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.muted }}>
        Statement month
      </span>
      <input
        type="number" min={1} max={horizon} value={stmtMonth}
        onChange={(e) => setStmtMonth(Math.min(horizon, Math.max(1, Number(e.target.value))))}
        style={{ width: 62, padding: '5px 7px', border: `1px solid ${T.line}`, borderRadius: 6, fontFamily: T.mono, fontSize: 13 }}
      />
      <span style={{ fontSize: 10.5, color: T.faint }}>of {horizon}</span>
    </label>
  );

  return (
    <div style={{ fontFamily: T.sans, color: T.body, background: G.shell, minHeight: '100vh' }}>
      {/* ── Sticky brand header — always in view ─────────────────────────── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 900, padding: '10px 16px 0' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{
            background: G.header, borderRadius: 14, padding: '11px 18px',
            display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            boxShadow: '0 10px 30px -12px rgba(15,23,42,.55)',
            border: '1px solid rgba(255,255,255,.07)',
          }}>
            <img src={FT_LOGO} alt="Funding Tier" style={{ height: 26, width: 'auto', flex: '0 0 auto' }} />
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, flex: 1, minWidth: 150 }}>
              <span style={{ fontWeight: 800, fontSize: 18, color: '#fff', letterSpacing: '-0.4px' }}>
                Operating Model
              </span>
              <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,.55)', fontWeight: 600 }}>
                Cash flow, staffing, and profitability — month by month
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              {[
                { k: 'Revenue', v: fmtMoney(results.totals.revenue) },
                { k: `Cash (mo ${horizon})`, v: fmtMoney(results.totals.finalCash) },
                { k: 'Peak capital', v: fmtMoney(results.totals.peakCapitalRequired) },
              ].map((x) => (
                <div key={x.k} style={{ lineHeight: 1.2 }}>
                  <div style={{
                    fontSize: 8.5, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase',
                    color: 'rgba(255,255,255,.5)',
                  }}>{x.k}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', fontFamily: T.mono }}>{x.v}</div>
                </div>
              ))}
              <button
                onClick={() => setMathOpen(true)}
                style={{
                  background: '#fff', color: T.brandDark, border: 'none', borderRadius: 9,
                  padding: '9px 15px', fontWeight: 800, fontSize: 12.5, cursor: 'pointer',
                  fontFamily: T.sans, whiteSpace: 'nowrap',
                  boxShadow: '0 3px 12px -3px rgba(0,0,0,.4)',
                }}
              >Show the math</button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 16px 60px' }}>
      {/* ── Results ───────────────────────────────────────────────────────── */}
      <Panel title="Results — based on everything set below" collapsible={false}
        tooltip="Headline outputs of the simulation. Every one of these traces back to a formula in Show the math.">
        <Row cols="repeat(auto-fit, minmax(178px, 1fr))" gap={10}>
          <Stat label="Total revenue" value={fmtMoney(results.totals.revenue)} sub={`Over ${horizon} months`}
            tooltip="Sum of cash received from all three servicing partners across the simulation, timed to when they actually remit — not when a deal is signed." />
          <Stat label={`Final cash (mo ${horizon})`} value={fmtMoney(results.totals.finalCash)}
            sub={`Distributable above reserve: ${fmtMoney(results.totals.distributableAboveReserve)}`}
            tooltip="Cash on hand at the end of the simulation. Distributable is what sits above the reserve target." />
          <Stat label="First cash-positive month"
            value={results.totals.firstCashPositiveMonth ? `Month ${results.totals.firstCashPositiveMonth}` : 'Never'}
            tooltip="First month the cumulative cash position crosses zero." />
          <Stat label="Total commission paid" value={fmtMoney(results.totals.repCommission)}
            sub="Paid out to Funding Tier reps"
            tooltip="Total commission Funding Tier pays its own reps over the simulation. This is an outflow." />
          <Stat label="Overrides + bonuses"
            value={fmtMoney(results.totals.managerOverride + results.totals.bonuses)}
            sub={`${fmtMoney(results.totals.managerOverride)} override · ${fmtMoney(results.totals.bonuses)} bonuses`}
            tooltip="Manager and owner-operator overrides plus every bonus and spiff paid across the simulation. Both are outflows on top of base commission." />
          <Stat label="Peak capital required" value={fmtMoney(results.totals.peakCapitalRequired)} tone="bad"
            sub="Most capital needed before revenue catches up"
            tooltip="The deepest the cash position goes. This is the money that has to be funded from outside before the business self-sustains." />
          <Stat label="Reserve target first met"
            value={results.totals.reserveTargetFirstMet ? `Month ${results.totals.reserveTargetFirstMet}` : 'Not met'}
            tooltip="First month cash on hand covers monthly overhead × the reserve months setting." />
          <Stat label="Headcount" value={String(results.totals.finalSeatCount)}
            sub={`Started at ${results.totals.startingSeatCount}`}
            tooltip="Agents on payroll at the end of the simulation, taken from the roster." />
          <Stat label="Peak utilization" value={fmtPct(results.totals.peakUtilizationPct)}
            tone={results.totals.peakUtilizationPct > 100 ? 'bad' : undefined}
            tooltip="Highest share of closer talk time consumed in any month. Above 100% means the model booked more work than the roster can physically service." />
        </Row>
        {results.warnings.length > 0 && (
          <Callout tone="warn">
            {[...new Set(results.warnings)].map((w, i) => <div key={i} style={{ marginTop: i ? 5 : 0 }}>⚠ {w}</div>)}
          </Callout>
        )}
      </Panel>


      <ShowTheMath
        inputs={inputs} results={results} month={stmtMonth} setMonth={setStmtMonth}
        open={mathOpen} onClose={() => setMathOpen(false)}
      />

      {/* ── 1 · Ramp planner: five columns across ─────────────────────────── */}
      <Panel title="1 · Deal Volume Ramp Planner" accent={T.accent}
        subtitle="Start here — volume is a function of the hours you employ"
        tooltip="Deal volume is derived from paid closer hours rather than typed in: hours ÷ 8 × deals-per-8-hours. Add or remove people in the roster and the target moves with them.">
        <Row cols={5} gap={12}>
          <Field label="Ramp period (months)" tooltip="How long it takes to reach full volume. At 1, the roster runs at full output from month 1.">
            <NumberInput value={inputs.ramp.rampMonths} min={1} max={36}
              onChange={(v) => patch({ ramp: { ...inputs.ramp, rampMonths: Math.max(1, v) } })} />
          </Field>
          <Field label="Simulation horizon (months)" tooltip="How many months the model projects.">
            <NumberInput value={inputs.ramp.horizonMonths} min={1} max={60}
              onChange={(v) => patch({ ramp: { ...inputs.ramp, horizonMonths: Math.max(1, v) } })} />
          </Field>
          <Field label="Deals per rep / 8 hrs" tooltip="The production rule: one rep produces 1.0–1.5 deals per 8 paid hours. Multiplied across every closer hour on the roster to give the monthly volume target.">
            <NumberInput value={inputs.volume.dealsPer8CloserHours} min={0.1} max={5} step={0.05}
              onChange={(v) => patch({ volume: { ...inputs.volume, dealsPer8CloserHours: v } })}
              suffix="deals" />
          </Field>
          <Field label="Volume target (deals/mo)"
            tooltip="Derived from employed closer hours. Switch to Override to type a number in directly and break the link to the roster."
            hint={inputs.volume.mode !== 'derived' ? 'Manual — not linked to the roster'
              : derivedCap?.bindingConstraint === 'talk-time'
                ? `Capped by talk time: ${fmtNum(derivedCap?.closerHours ?? 0, 0)} closer hrs × 60 ÷ ${inputs.operations.avgHandleMinutes} min × ${fmtPct(inputs.operations.closeRatePct, 0)}`
                : `${fmtNum(derivedCap?.closerHours ?? 0, 0)} closer hrs ÷ 8 × ${inputs.volume.dealsPer8CloserHours}`}>
            {inputs.volume.mode === 'derived' ? (
              <div style={{ ...inputStyle, background: T.panel, fontWeight: 800, color: T.ink }}>
                {fmtNum(derivedCap?.targetDeals ?? 0, 1)}
              </div>
            ) : (
              <NumberInput value={inputs.volume.overrideTotalDealsPerMonth} min={0}
                onChange={(v) => patch({ volume: { ...inputs.volume, overrideTotalDealsPerMonth: v } })} />
            )}
          </Field>
          <Field label="Override" tooltip="Turn on to ignore the hours-based calculation and set the monthly deal target by hand.">
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: T.body, paddingTop: 6 }}>
              <input type="checkbox" checked={inputs.volume.mode === 'override'}
                onChange={(e) => patch({ volume: { ...inputs.volume, mode: e.target.checked ? 'override' : 'derived' } })} />
              {inputs.volume.mode === 'override' ? 'Manual target' : 'Driven by hours'}
            </label>
          </Field>
        </Row>

        <div style={{ marginTop: 14, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.muted }}>
          Volume split & average enrolled debt, per servicing partner
        </div>
        <Row cols={5} gap={12} style={{ marginTop: 8 }}>
          {BACKEND_KEYS.map((k) => (
            <div key={k} style={{ gridColumn: 'span 1' }}>
              <div style={{ marginBottom: 6 }}><PartnerName k={k} size={17} /></div>
              <Field label="Share of volume" tooltip={`Percentage of total monthly deals routed to ${BRANDS[k].name}. The three shares must total 100%.`}>
                <NumberInput value={inputs.volume.mixPct[k]} min={0} max={100} step={1}
                  invalid={Math.abs(volMixTotal - 100) > 0.01}
                  onChange={(v) => patch({ volume: { ...inputs.volume, mixPct: { ...inputs.volume.mixPct, [k]: v } } })}
                  suffix="%" />
              </Field>
              <div style={{ height: 8 }} />
              <Field label="Avg enrolled debt" tooltip={`Average enrolled debt per ${BRANDS[k].name} deal. Drives which program band or fee applies.`}>
                <NumberInput value={inputs.volume.avgDebt[k]} min={0} step={500}
                  onChange={(v) => patch({ volume: { ...inputs.volume, avgDebt: { ...inputs.volume.avgDebt, [k]: v } } })}
                  prefix="$" />
              </Field>
              <div style={{ fontSize: 10, color: T.faint, marginTop: 4 }}>
                {fmtNum((month?.dealsByBackend[k] ?? 0), 0)} deals in month {stmtMonth}
              </div>
            </div>
          ))}
          <div style={{ gridColumn: 'span 2', border: `1px solid ${T.line}`, borderRadius: 8, padding: '10px 12px', background: T.panel }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.muted }}>
              Capacity reconciliation<Info text="Two different limits govern how many deals the roster can produce. The rule says 1.0–1.5 deals per 8 paid closer hours. The physical ceiling says available talk time ÷ average handle time × close rate. The model takes the lower of the two so it can never book work the roster cannot service." />
            </div>
            <table style={{ width: '100%', marginTop: 6, borderCollapse: 'collapse' }}>
              <tbody>
                <tr><td style={{ ...td, borderBottom: 'none', padding: '2px 0' }}>Deals-per-hour rule</td>
                  <td style={{ ...tdNum, borderBottom: 'none', padding: '2px 0' }}>{fmtNum(derivedCap?.ruleCapacityDeals ?? 0, 1)}</td></tr>
                <tr><td style={{ ...td, borderBottom: 'none', padding: '2px 0' }}>Talk-time ceiling</td>
                  <td style={{ ...tdNum, borderBottom: 'none', padding: '2px 0' }}>{fmtNum(derivedCap?.talkTimeCapacityDeals ?? 0, 1)}</td></tr>
                <tr><td style={{ ...td, borderTop: `1px solid ${T.line}`, borderBottom: 'none', padding: '4px 0', fontWeight: 800, color: T.ink }}>Binding</td>
                  <td style={{ ...tdNum, borderTop: `1px solid ${T.line}`, borderBottom: 'none', padding: '4px 0', fontWeight: 800, color: T.ink }}>
                    {derivedCap?.bindingConstraint === 'rule' ? 'Rule' : derivedCap?.bindingConstraint === 'talk-time' ? 'Talk time' : 'Override'}
                  </td></tr>
              </tbody>
            </table>
            <div style={{ fontSize: 10, color: T.faint, marginTop: 5, lineHeight: 1.45 }}>
              {inputs.volume.dealsPer8CloserHours} deals per 8 hrs at a {fmtPct(inputs.operations.closeRatePct, 0)} close
              rate needs {fmtNum((8 * 60 * (inputs.operations.closeRatePct / 100)) / inputs.volume.dealsPer8CloserHours, 0)} min
              average handle time. AHT is set to {inputs.operations.avgHandleMinutes} min.
            </div>
          </div>
        </Row>
        {Math.abs(volMixTotal - 100) > 0.01 && (
          <Callout tone="bad">Volume split totals {volMixTotal.toFixed(1)}% — it must total 100%.</Callout>
        )}
      </Panel>

      {/* ── 2 · Roster ─────────────────────────────────────────────────────── */}
      <RosterEditor inputs={inputs} setInputs={setInputs} month={month} />

      {/* ── 3 · Operations ─────────────────────────────────────────────────── */}
      <Panel title="2 · Operations — how calls turn into deals"
        subtitle="Close rate, handle time, opener productivity, and the transfer funnel"
        tooltip="These settings convert transfers into deals and set what each transfer costs to acquire.">
        <Row cols={5} gap={12}>
          <Field label="Close rate" tooltip="Share of qualified transfers that become enrolled deals. Applies to every transfer, including the ones that do not close — the time spent on those is still counted in labor and routing cost.">
            <NumberInput value={inputs.operations.closeRatePct} min={0} max={100} step={0.5}
              onChange={(v) => patch({ operations: { ...inputs.operations, closeRatePct: v } })} suffix="%" />
          </Field>
          <Field label="Avg handle time" tooltip="Average closer minutes consumed per qualified transfer, across calls that close and calls that do not.">
            <NumberInput value={inputs.operations.avgHandleMinutes} min={1} max={240}
              onChange={(v) => patch({ operations: { ...inputs.operations, avgHandleMinutes: v } })} suffix="min" />
          </Field>
          <Field label="Opener output" tooltip="Qualified transfers one opener produces per paid hour. Every transfer an opener produces is a transfer you do not buy from the vendor.">
            <NumberInput value={inputs.operations.openerTransfersPerHour} min={0} max={20} step={0.25}
              onChange={(v) => patch({ operations: { ...inputs.operations, openerTransfersPerHour: v } })} suffix="/hr" />
          </Field>
          <Field label="SMS per transfer" tooltip="Text segments sent per qualified transfer.">
            <NumberInput value={inputs.operations.smsPerTransfer} min={0} step={1}
              onChange={(v) => patch({ operations: { ...inputs.operations, smsPerTransfer: v } })} />
          </Field>
          <Field label="Cap deals at capacity" tooltip="When on, deals can never exceed what the roster's talk time physically allows. Turn this off only if you want to model demand the team cannot yet service.">
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: T.body, paddingTop: 6 }}>
              <input type="checkbox" checked={inputs.operations.capDealsAtCapacity}
                onChange={(e) => patch({ operations: { ...inputs.operations, capDealsAtCapacity: e.target.checked } })} />
              {inputs.operations.capDealsAtCapacity ? 'Capped' : 'Uncapped'}
            </label>
          </Field>
        </Row>

        <div style={{ marginTop: 16, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.muted, display: 'flex', alignItems: 'center' }}>
          Transfer funnel — raw · duds · billed
          <Info text="A vendor routes a live call. If it disconnects before the buffer elapses it is a dud and is never invoiced — which is precisely what the higher price of a longer buffer buys you. Each tier therefore carries its own pass rate and its own close rate, and the only figure that compares one buffer with another is cost per CLOSED deal." />
        </div>

        <div style={{ overflowX: 'auto', marginTop: 8, border: `1px solid ${T.line}`, borderRadius: 9 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 860 }}>
            <thead>
              <tr>
                <th style={th}>Buffer</th>
                <th style={{ ...th, textAlign: 'right', width: 108 }}>Price / billed</th>
                <th style={{ ...th, textAlign: 'right', width: 96 }}>Mix of raw</th>
                <th style={{ ...th, textAlign: 'right', width: 108 }}>Pass rate<Info text="Share of raw transfers on this tier that survive the buffer and become billable. Longer buffer, fewer survivors — that is the whole point of paying more for it. These defaults are estimates; calibrate from a vendor invoice." /></th>
                <th style={{ ...th, textAlign: 'right', width: 100 }}>Close rate</th>
                <th style={{ ...th, textAlign: 'right' }}>Raw</th>
                <th style={{ ...th, textAlign: 'right' }}>Duds</th>
                <th style={{ ...th, textAlign: 'right' }}>Billed</th>
                <th style={{ ...th, textAlign: 'right' }}>Cost</th>
                <th style={{ ...th, textAlign: 'right' }}>Cost / deal<Info text="Transfer spend on this tier divided by the deals it produced. This is the number that decides which buffer is actually cheapest — not the price per transfer." /></th>
              </tr>
            </thead>
            <tbody>
              {inputs.operations.buffers.map((b) => {
                const row = month?.funnel.buffers.find((x) => x.key === b.key);
                const off = b.mixPct <= 0;
                return (
                  <tr key={b.key} style={{ opacity: off ? 0.5 : 1 }}>
                    <td style={{ ...td, fontWeight: 600, color: T.ink }}>{b.label}</td>
                    <td style={tdNum}>
                      <NumberInput value={b.price} min={0} step={0.5} prefix="$"
                        onChange={(v) => setBuffer(b.key, { price: v })} />
                    </td>
                    <td style={tdNum}>
                      <NumberInput value={b.mixPct} min={0} max={100} step={1} suffix="%"
                        invalid={Math.abs(mixTotal - 100) > 0.01}
                        onChange={(v) => setBuffer(b.key, { mixPct: v })} />
                    </td>
                    <td style={tdNum}>
                      <NumberInput value={b.passRatePct} min={0} max={100} step={1} suffix="%"
                        onChange={(v) => setBuffer(b.key, { passRatePct: v })} />
                    </td>
                    <td style={tdNum}>
                      <NumberInput value={b.closeRatePct} min={0} max={100} step={0.5} suffix="%"
                        onChange={(v) => setBuffer(b.key, { closeRatePct: v })} />
                    </td>
                    <td style={tdNum}>{fmtNum(row?.rawTransfers ?? 0, 0)}</td>
                    <td style={{ ...tdNum, color: T.faint }}>{fmtNum(row?.duds ?? 0, 0)}</td>
                    <td style={tdNum}>{fmtNum(row?.billedTransfers ?? 0, 0)}</td>
                    <td style={tdNum}>{fmtMoney(row?.cost ?? 0)}</td>
                    <td style={{ ...tdNum, fontWeight: 700, color: T.ink }}>
                      {(row?.deals ?? 0) > 0 ? fmtMoney(row!.costPerDeal) : '—'}
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td style={{ ...td, borderTop: `2px solid ${T.ink}`, fontWeight: 800, color: T.ink }}>Total</td>
                <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 700 }}>{fmtMoney2(blended)}</td>
                <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 800, color: Math.abs(mixTotal - 100) > 0.01 ? T.bad : T.ink }}>
                  {mixTotal.toFixed(0)}%
                </td>
                <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 700 }}>{fmtPct(month?.funnel.blendedPassRatePct ?? 0, 0)}</td>
                <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}` }} />
                <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 800 }}>{fmtNum(month?.funnel.rawTransfers ?? 0, 0)}</td>
                <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 800, color: T.faint }}>{fmtNum(month?.funnel.duds ?? 0, 0)}</td>
                <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 800 }}>{fmtNum(month?.funnel.billedTransfers ?? 0, 0)}</td>
                <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 800 }}>{fmtMoney(month?.funnel.totalCost ?? 0)}</td>
                <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 800 }}>{fmtMoney(month?.funnel.costPerClosedDeal ?? 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <Row cols={5} gap={12} style={{ marginTop: 12 }}>
          <Field label="Close rate measured against" tooltip="Check one vendor invoice (billed transfers) against your CRM (every transfer routed to you). Divide that month's deals by each. Whichever denominator lands on your quoted close rate is your convention. This setting decides whether transfer spend falls.">
            <select
              value={inputs.operations.closeRateBasis}
              onChange={(e) => patch({ operations: { ...inputs.operations, closeRateBasis: e.target.value as 'billed' | 'all' } })}
              style={{ ...inputStyle, fontSize: 12 }}
            >
              <option value="billed">Billed transfers</option>
              <option value="all">All transfers taken</option>
            </select>
          </Field>
          <Field label="Dud rate" tooltip="Share of raw transfers that dropped before the buffer and were never invoiced. This is the money the old model was spending that you never actually owed.">
            <div style={{ ...inputStyle, background: T.panel, fontWeight: 800, color: T.ink }}>
              {fmtPct(month?.funnel.dudRatePct ?? 0, 1)}
            </div>
          </Field>
          <Field label="Close rate — all transfers" tooltip="Deals ÷ every transfer taken, duds included.">
            <div style={{ ...inputStyle, background: T.panel, fontWeight: 800, color: T.ink }}>
              {fmtPct(month?.funnel.closeRateOnAllPct ?? 0, 1)}
            </div>
          </Field>
          <Field label="Close rate — billed only" tooltip="Deals ÷ transfers you were actually invoiced for.">
            <div style={{ ...inputStyle, background: T.panel, fontWeight: 800, color: T.ink }}>
              {fmtPct(month?.funnel.closeRateOnBilledPct ?? 0, 1)}
            </div>
          </Field>
          <Field label="Cost per closed deal" tooltip="Total transfer spend ÷ deals closed. The only figure that compares buffers honestly.">
            <div style={{ ...inputStyle, background: T.panel, fontWeight: 800, color: T.ink }}>
              {fmtMoney(month?.funnel.costPerClosedDeal ?? 0)}
            </div>
          </Field>
        </Row>
        {Math.abs(mixTotal - 100) > 0.01 && (
          <Callout tone="bad">Buffer mix totals {mixTotal.toFixed(1)}% — it must total 100%.</Callout>
        )}
      </Panel>

      {/* ── 4 · Backend terms, compact ─────────────────────────────────────── */}
      <Panel title="3 · How each backend pays Funding Tier and its reps"
        tooltip="Contract terms, five across per partner. Level Debt is a one-time settlement payment; Shield Services and Elite Legal Practice are monthly perpetuities.">
        {BACKEND_KEYS.map((k) => {
          const debt = inputs.volume.avgDebt[k];
          const terms: { label: string; value: string; help: string }[] =
            k === 'LEVEL' ? [
              { label: 'Revenue share', value: fmtPct(inputs.levelDebt.revenueSharePct * 100, 0), help: 'Percentage of enrolled debt Funding Tier is paid, per the affiliate agreement.' },
              { label: 'Revenue recognized', value: `Deal-month ${inputs.levelDebt.revenueRecognizedMonth}`, help: 'Advance-fee model: paid once, after the first client payment clears.' },
              { label: 'Rep payout', value: `Deal-month ${inputs.levelDebt.agentPayoutMonth}`, help: 'When Funding Tier pays its rep. Set by real payout timing, not policy.' },
              { label: 'Chargeback clear', value: `${inputs.levelDebt.chargebackClearMonths} payments`, help: 'Chargeback liability is extinguished once this many completed client payments clear. Only these months matter for this backend.' },
              { label: 'Per deal', value: fmtMoney(debt * inputs.levelDebt.revenueSharePct), help: `${fmtMoney(debt)} enrolled debt × ${fmtPct(inputs.levelDebt.revenueSharePct * 100, 0)}. Paid once — nothing recurs.` },
            ] : k === 'CS' ? (() => {
              const p = shield.getProgram(debt, inputs.consumerShield);
              const net = (p?.payment ?? 0) - inputs.consumerShield.servicingDeductionPerPayment;
              return [
                { label: 'Program', value: `${p?.code ?? '—'} · ${fmtMoney(p?.payment ?? 0)}/mo`, help: `Program band resolved from ${fmtMoney(debt)} enrolled debt. Client pays ${fmtMoney(p?.payment ?? 0)} per month for ${p?.term ?? '—'} months.` },
                { label: 'Servicing deduction', value: `${fmtMoney(inputs.consumerShield.servicingDeductionPerPayment)}/pmt`, help: 'Taken off every client payment before Funding Tier’s share is calculated.' },
                { label: 'Front capture', value: `${fmtPct(inputs.consumerShield.frontCaptureRate * 100, 0)} × ${inputs.consumerShield.frontMonths} mo`, help: `Funding Tier keeps ${fmtPct(inputs.consumerShield.frontCaptureRate * 100, 0)} of ${fmtMoney(net)} for the first ${inputs.consumerShield.frontMonths} months.` },
                { label: 'Backend capture', value: fmtPct(inputs.consumerShield.backendCaptureRate * 100, 0), help: `From month ${inputs.consumerShield.frontMonths + 1} to the end of the program, Funding Tier keeps ${fmtPct(inputs.consumerShield.backendCaptureRate * 100, 0)} of ${fmtMoney(net)} = ${fmtMoney(net * inputs.consumerShield.backendCaptureRate)} per payment.` },
                { label: 'Rep payout', value: `${fmtMoney(p?.commission ?? 0)} · mo ${inputs.consumerShield.agentPayoutMonth}`, help: 'Flat commission per enrolled deal, released by the 15th of the following month.' },
              ];
            })() : (() => {
              const term = legacy.getMaxTerm(debt, inputs.legacy);
              const fee = legacy.totalFee(debt, inputs.legacy);
              const pay = legacy.getScheduledPayment(debt, inputs.legacy);
              const last = legacy.getFinalPayment(debt, inputs.legacy);
              const trueUp = Math.abs(last - pay) >= 0.005;
              return [
                { label: 'Sliding fee', value: `${fmtPct(inputs.legacy.feeRate * 100, 0)} · ${fmtMoney2(fee)}`, help: `Total fee as a share of enrolled debt, 35%–49%. ${fmtMoney(debt)} × ${fmtPct(inputs.legacy.feeRate * 100, 0)} = ${fmtMoney2(fee)}, exact to the penny.` },
                { label: 'Term & draft', value: `${term} mo · ${fmtMoney2(pay)}`, help: `${fmtMoney2(fee)} fee ÷ ${fmtMoney(inputs.legacy.minMonthlyPayment)} floor = ${term} months. Elite Legal Practice drafts to the exact penny — no rounding to the dollar.` },
                { label: 'Final draft', value: trueUp ? fmtMoney2(last) : 'even', help: trueUp ? `The last draft carries the remainder so the client is billed exactly ${fmtMoney2(fee)}: ${term - 1} × ${fmtMoney2(pay)} + ${fmtMoney2(last)} = ${fmtMoney2(fee)}.` : `${term} × ${fmtMoney2(pay)} divides evenly into the ${fmtMoney2(fee)} fee — no true-up needed.` },
                { label: 'FT keeps', value: `${fmtMoney2(pay - inputs.legacy.draftFee)} → ${fmtMoney2((pay - inputs.legacy.adminMonthlyFee) * inputs.legacy.tier1Rate)}`, help: `Months 1–2: ${fmtMoney2(pay)} less the ${fmtMoney(inputs.legacy.draftFee)} draft fee = ${fmtMoney2(pay - inputs.legacy.draftFee)}. Month 3 on: (${fmtMoney2(pay)} − ${fmtMoney(inputs.legacy.adminMonthlyFee)} admin fee) × ${fmtPct(inputs.legacy.tier1Rate * 100, 0)} = ${fmtMoney2((pay - inputs.legacy.adminMonthlyFee) * inputs.legacy.tier1Rate)}.` },
                { label: 'Rep payout', value: `${fmtMoney(legacy.agentCommission(debt, inputs.legacy))} · mo ${inputs.legacy.agentPayoutMonth}`, help: 'Band commission scaled by the sliding fee rate, released the month after enrollment.' },
              ];
            })();

          return (
            <div key={k} style={{
              border: `1px solid ${T.line}`, borderLeft: `3px solid ${BRANDS[k].accent}`,
              borderRadius: 8, padding: '10px 12px', marginBottom: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9, flexWrap: 'wrap' }}>
                <PartnerName k={k} size={20} sub />
                <span style={{
                  fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
                  color: k === 'LEVEL' ? T.warn : T.good,
                  background: k === 'LEVEL' ? T.warnBg : T.goodBg,
                  border: `1px solid ${k === 'LEVEL' ? T.warnLine : '#bbf7d0'}`,
                  padding: '2px 7px', borderRadius: 20,
                }}>
                  {k === 'LEVEL' ? 'One-time payment' : 'Monthly perpetuity'}
                </span>
              </div>
              <Row cols={5} gap={10}>
                {terms.map((t) => (
                  <div key={t.label} style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: T.muted, display: 'flex', alignItems: 'center' }}>
                      {t.label}<Info text={t.help} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, fontFamily: T.mono, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.value}
                    </div>
                  </div>
                ))}
              </Row>
            </div>
          );
        })}
        <Callout>
          <strong>Why the timing differs.</strong> {BRANDS.CS.name} and {BRANDS.LEGACY.name} collect on a
          <strong> monthly perpetuity</strong> — Funding Tier earns a share of every client payment for the life of the program.
          {' '}{BRANDS.LEVEL.name} pays <strong>once</strong>, after the first client payment clears, and the deal is free of
          chargeback liability after the second completed payment. Comparing the three on a single cumulative revenue line
          flatters the perpetuities and understates how quickly Level Debt de-risks.
        </Callout>
      </Panel>

      {/* ── 5 · Cost stack as a ledger ─────────────────────────────────────── */}
      <Panel title="4 · Cost stack" subtitle="Rates and multipliers — an accounting ledger, not a wall of inputs"
        tooltip="Every cost line, its rate, its multiplier, and the resulting monthly amount for the selected statement month."
        right={MonthPicker}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
            <thead>
              <tr>
                <th style={th}>Account</th>
                <th style={{ ...th, width: 130, textAlign: 'right' }}>Rate</th>
                <th style={{ ...th, width: 150, textAlign: 'right' }}>Multiplier</th>
                <th style={{ ...th, width: 120, textAlign: 'right' }}>Month {stmtMonth}</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={4} style={{ ...td, background: T.panel, fontWeight: 800, fontSize: 10.5, letterSpacing: 0.5, textTransform: 'uppercase', color: T.ink }}>Fixed monthly tools</td></tr>
              {inputs.costs.fixedCosts.map((f) => (
                <tr key={f.id}>
                  <td style={{ ...td, paddingLeft: 20 }}>{f.label}</td>
                  <td style={tdNum}>
                    <NumberInput value={f.amount} min={0} prefix="$"
                      onChange={(v) => patch({ costs: { ...inputs.costs, fixedCosts: inputs.costs.fixedCosts.map((x) => (x.id === f.id ? { ...x, amount: v } : x)) } })} />
                  </td>
                  <td style={{ ...tdNum, color: T.faint }}>flat</td>
                  <td style={tdNum}>{fmtMoney(f.amount)}</td>
                </tr>
              ))}
              <tr><td colSpan={4} style={{ ...td, background: T.panel, fontWeight: 800, fontSize: 10.5, letterSpacing: 0.5, textTransform: 'uppercase', color: T.ink }}>
                Per-user tools<Info text="Seat licences. The multiplier is active headcount from the roster, so these scale automatically as you add or remove agents." />
              </td></tr>
              {inputs.costs.perUserCosts.map((p) => (
                <tr key={p.id}>
                  <td style={{ ...td, paddingLeft: 20 }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={p.enabled}
                        onChange={(e) => patch({ costs: { ...inputs.costs, perUserCosts: inputs.costs.perUserCosts.map((x) => (x.id === p.id ? { ...x, enabled: e.target.checked } : x)) } })} />
                      {p.label}
                    </label>
                  </td>
                  <td style={tdNum}>
                    <NumberInput value={p.amountPerUser} min={0} prefix="$" suffix="/user"
                      onChange={(v) => patch({ costs: { ...inputs.costs, perUserCosts: inputs.costs.perUserCosts.map((x) => (x.id === p.id ? { ...x, amountPerUser: v } : x)) } })} />
                  </td>
                  <td style={{ ...tdNum, color: T.body }}>× {month?.costs.headcount ?? 0} users</td>
                  <td style={tdNum}>{fmtMoney(p.enabled ? p.amountPerUser * (month?.costs.headcount ?? 0) : 0)}</td>
                </tr>
              ))}
              <tr><td colSpan={4} style={{ ...td, background: T.panel, fontWeight: 800, fontSize: 10.5, letterSpacing: 0.5, textTransform: 'uppercase', color: T.ink }}>Usage rates — Krest Marketing App</td></tr>
              <tr>
                <td style={{ ...td, paddingLeft: 20 }}>Inbound forwarding</td>
                <td style={tdNum}>
                  <NumberInput value={inputs.costs.usageRates.inboundForwardPerMin} step={0.001} prefix="$" suffix="/min"
                    onChange={(v) => patch({ costs: { ...inputs.costs, usageRates: { ...inputs.costs.usageRates, inboundForwardPerMin: v } } })} />
                </td>
                <td style={{ ...tdNum, color: T.body }}>× {fmtNum(month?.costs.totalCallMinutes ?? 0, 0)} min</td>
                <td style={tdNum}>{fmtMoney((month?.costs.totalCallMinutes ?? 0) * inputs.costs.usageRates.inboundForwardPerMin)}</td>
              </tr>
              <tr>
                <td style={{ ...td, paddingLeft: 20 }}>SMS</td>
                <td style={tdNum}>
                  <NumberInput value={inputs.costs.usageRates.smsPerSegment} step={0.0001} prefix="$" suffix="/seg"
                    onChange={(v) => patch({ costs: { ...inputs.costs, usageRates: { ...inputs.costs.usageRates, smsPerSegment: v } } })} />
                </td>
                <td style={{ ...tdNum, color: T.body }}>× {fmtNum(month?.costs.totalSmsSegments ?? 0, 0)} segments</td>
                <td style={tdNum}>{fmtMoney((month?.costs.totalSmsSegments ?? 0) * inputs.costs.usageRates.smsPerSegment)}</td>
              </tr>
              <tr>
                <td style={{ ...td, paddingLeft: 20 }}>Email</td>
                <td style={tdNum}>
                  <NumberInput value={inputs.costs.usageRates.emailPer1000} step={0.005} prefix="$" suffix="/1k"
                    onChange={(v) => patch({ costs: { ...inputs.costs, usageRates: { ...inputs.costs.usageRates, emailPer1000: v } } })} />
                </td>
                <td style={{ ...tdNum, color: T.body }}>× {fmtNum(month?.costs.totalEmails ?? 0, 0)} sent</td>
                <td style={tdNum}>{fmtMoney(((month?.costs.totalEmails ?? 0) / 1000) * inputs.costs.usageRates.emailPer1000)}</td>
              </tr>
              <tr>
                <td style={{ ...td, paddingLeft: 20 }}>
                  DID rental<Info text="Phone numbers. Provisioned as a multiple of active agents, plus any flat additional numbers you need on top." />
                </td>
                <td style={tdNum}>
                  <NumberInput value={inputs.costs.usageRates.didRentalPerMonth} step={0.05} prefix="$" suffix="/mo"
                    onChange={(v) => patch({ costs: { ...inputs.costs, usageRates: { ...inputs.costs.usageRates, didRentalPerMonth: v } } })} />
                </td>
                <td style={{ ...tdNum }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                    <NumberInput value={inputs.costs.dids.perAgent} min={0} step={1}
                      onChange={(v) => patch({ costs: { ...inputs.costs, dids: { ...inputs.costs.dids, perAgent: v } } })} />
                    <span style={{ fontSize: 10, color: T.faint, whiteSpace: 'nowrap' }}>/agent +</span>
                    <NumberInput value={inputs.costs.dids.additional} min={0} step={1}
                      onChange={(v) => patch({ costs: { ...inputs.costs, dids: { ...inputs.costs.dids, additional: v } } })} />
                  </span>
                  <div style={{ fontSize: 10, color: T.faint, marginTop: 2 }}>= {month?.costs.didCount ?? 0} numbers</div>
                </td>
                <td style={tdNum}>{fmtMoney((month?.costs.didCount ?? 0) * inputs.costs.usageRates.didRentalPerMonth)}</td>
              </tr>
              <tr><td colSpan={4} style={{ ...td, background: T.panel, fontWeight: 800, fontSize: 10.5, letterSpacing: 0.5, textTransform: 'uppercase', color: T.ink }}>
                Trackdrive — call routing<Info text="You do not pick a tier. The model resolves it each month from simulated call volume: the richest tier whose spend threshold the month's inbound cost actually clears. More volume means a cheaper per-minute rate." />
              </td></tr>
              <tr>
                <td style={{ ...td, paddingLeft: 20 }}>
                  Inbound routing
                  <div style={{ fontSize: 10, color: T.faint, marginTop: 1 }}>Resolved tier "{month?.costs.trackdriveTierKey ?? '—'}"</div>
                </td>
                <td style={tdNum}>
                  {inputs.costs.trackdriveTiers.map((t) => (
                    <div key={t.key} style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, alignItems: 'center', opacity: t.key === month?.costs.trackdriveTierKey ? 1 : 0.4 }}>
                      <span style={{ fontSize: 9.5, color: T.faint }}>{t.key}</span>
                      <input type="number" value={t.inbound} step={0.005}
                        onChange={(e) => patch({ costs: { ...inputs.costs, trackdriveTiers: inputs.costs.trackdriveTiers.map((x) => (x.key === t.key ? { ...x, inbound: Number(e.target.value) } : x)) } })}
                        style={{ ...inputStyle, width: 74, fontSize: 11, padding: '2px 4px' }} />
                    </div>
                  ))}
                </td>
                <td style={{ ...tdNum, color: T.body }}>× {fmtNum(month?.costs.totalCallMinutes ?? 0, 0)} min</td>
                <td style={tdNum}>{fmtMoney(month?.costs.groups.find((g) => g.id === 'trackdrive')?.subtotal ?? 0)}</td>
              </tr>
              <tr>
                <td style={{ ...td, paddingLeft: 20 }}>Outbound routing</td>
                <td style={tdNum}>
                  <NumberInput value={inputs.costs.trackdriveOutboundPerMin} step={0.005} prefix="$" suffix="/min"
                    onChange={(v) => patch({ costs: { ...inputs.costs, trackdriveOutboundPerMin: v } })} />
                </td>
                <td style={{ ...tdNum, color: T.faint }}>included above</td>
                <td style={{ ...tdNum, color: T.faint }}>—</td>
              </tr>
              <tr><td colSpan={4} style={{ ...td, background: T.panel, fontWeight: 800, fontSize: 10.5, letterSpacing: 0.5, textTransform: 'uppercase', color: T.ink }}>
                Transfer acquisition<Info text="The largest variable cost in the business. This was previously deducted from cash flow but omitted from the overhead total." />
              </td></tr>
              <tr>
                <td style={{ ...td, paddingLeft: 20 }}>Purchased qualified transfers</td>
                <td style={{ ...tdNum, fontWeight: 700 }}>{fmtMoney2(blended)}<div style={{ fontSize: 10, color: T.faint }}>blended</div></td>
                <td style={{ ...tdNum, color: T.body }}>× {fmtNum(month?.funnel.billedTransfers ?? 0, 0)} billed</td>
                <td style={{ ...tdNum, fontWeight: 700 }}>{fmtMoney(month?.transferCost ?? 0)}</td>
              </tr>
              <tr><td colSpan={4} style={{ ...td, background: T.panel, fontWeight: 800, fontSize: 10.5, letterSpacing: 0.5, textTransform: 'uppercase', color: T.ink }}>Labor</td></tr>
              <tr>
                <td style={{ ...td, paddingLeft: 20 }}>Roster — {month?.costs.headcount ?? 0} agents</td>
                <td style={{ ...tdNum, color: T.faint }}>per person</td>
                <td style={{ ...tdNum, color: T.body }}>× {fmtNum((month?.capacity.paidHours ?? 0), 0)} paid hrs</td>
                <td style={{ ...tdNum, fontWeight: 700 }}>{fmtMoney(month?.laborCost ?? 0)}</td>
              </tr>
              <tr>
                <td style={{ ...td, borderTop: `2px solid ${T.ink}`, fontWeight: 800, color: T.ink, fontSize: 13 }}>TOTAL MONTHLY OVERHEAD</td>
                <td style={{ ...td, borderTop: `2px solid ${T.ink}` }} />
                <td style={{ ...td, borderTop: `2px solid ${T.ink}` }} />
                <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 800, color: T.ink, fontSize: 14 }}>{fmtMoney(month?.overhead ?? 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ── 6 · Monthly operating expense statement ────────────────────────── */}
      <Panel title="Monthly Operating Expense Statement"
        subtitle={`Month ${stmtMonth} · ${month?.costs.headcount ?? 0} agents · ${fmtNum(month?.capacity.totalTransfers ?? 0, 0)} qualified transfers · Trackdrive tier "${month?.costs.trackdriveTierKey ?? '—'}"`}
        tooltip="A proper statement of the month's operating costs, in ledger form. Every group subtotals, and the grand total is the Overhead figure used in the month-by-month table."
        right={MonthPicker}>
        <div style={{ border: `1px solid ${T.line}`, borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={th}>Account</th>
                <th style={{ ...th, textAlign: 'right', width: 140 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {month?.costs.groups.map((g) => (
                <React.Fragment key={g.id}>
                  <tr>
                    <td colSpan={2} style={{
                      ...td, background: T.panel, fontWeight: 800, fontSize: 10.5,
                      letterSpacing: 0.5, textTransform: 'uppercase', color: T.ink, whiteSpace: 'normal',
                    }}>
                      {g.label}
                      <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: 0, textTransform: 'none', color: T.muted, marginTop: 1 }}>{g.note}</div>
                    </td>
                  </tr>
                  {g.lines.map((l) => (
                    <LedgerRow key={l.id} label={l.label} detail={l.detail} amount={l.amount} level={1} help={`Formula: ${l.formula}`} />
                  ))}
                  <LedgerRow label={`${g.label} — subtotal`} amount={g.subtotal} level={0} bold />
                  <tr><td colSpan={2} style={{ borderBottom: `1px solid ${T.line}`, height: 1, padding: 0 }} /></tr>
                </React.Fragment>
              ))}
              <LedgerRow label="GRAND TOTAL — MONTHLY OVERHEAD" amount={month?.overhead ?? 0} bold top />
            </tbody>
          </table>
        </div>
        <Callout>
          This total is the <strong>Overhead</strong> column in the month-by-month table below, and it now includes
          transfer acquisition — {fmtMoney(month?.transferCost ?? 0)} this month, or
          {' '}{month && month.overhead > 0 ? fmtPct((month.transferCost / month.overhead) * 100, 0) : '0%'} of the total.
        </Callout>
      </Panel>

      {/* ── Incentive policy ───────────────────────────────────────────────── */}
      <Panel title="Overrides, bonuses &amp; spiffs" accent={T.brand} defaultOpen={false}
        subtitle="Manager override, and the four incentive programs from the agent reference"
        tooltip="Compensation on top of base commission. Overrides go to Managers and Owner Operators on their team's closed deals; bonuses go to the closers who write the volume.">
        <Row cols={5} gap={12}>
          <Field label="Override enabled" tooltip="Turn the manager / owner override off entirely.">
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: T.body, paddingTop: 6 }}>
              <input type="checkbox" checked={inputs.overridePolicy.enabled}
                onChange={(e) => patch({ overridePolicy: { ...inputs.overridePolicy, enabled: e.target.checked } })} />
              {inputs.overridePolicy.enabled ? 'On' : 'Off'}
            </label>
          </Field>
          <Field label="Override base" tooltip="What the override percentage is applied to. Enrolled debt volume mirrors how Level Debt's own graduated commission works and is the only base where 0.1%-0.25% produces a meaningful number.">
            <select value={inputs.overridePolicy.base}
              onChange={(e) => patch({ overridePolicy: { ...inputs.overridePolicy, base: e.target.value as any } })}
              style={{ ...inputStyle, fontSize: 12 }}>
              <option value="enrolledVolume">Team enrolled debt volume</option>
              <option value="repCommission">Team rep commission</option>
              <option value="ftRevenue">Funding Tier revenue from team</option>
            </select>
          </Field>
          <Field label="Band minimum" tooltip="Lower end of the override band. Rates outside the band are flagged in the roster.">
            <NumberInput value={inputs.overridePolicy.minPct} min={0} max={5} step={0.05} suffix="%"
              onChange={(v) => patch({ overridePolicy: { ...inputs.overridePolicy, minPct: v } })} />
          </Field>
          <Field label="Band maximum" tooltip="Upper end of the override band.">
            <NumberInput value={inputs.overridePolicy.maxPct} min={0} max={5} step={0.05} suffix="%"
              onChange={(v) => patch({ overridePolicy: { ...inputs.overridePolicy, maxPct: v } })} />
          </Field>
          <Field label="Include own deals" tooltip="Whether a manager earns the override on deals they personally closed, as well as on their team's.">
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: T.body, paddingTop: 6 }}>
              <input type="checkbox" checked={inputs.overridePolicy.includeOwnDeals}
                onChange={(e) => patch({ overridePolicy: { ...inputs.overridePolicy, includeOwnDeals: e.target.checked } })} />
              {inputs.overridePolicy.includeOwnDeals ? 'Yes' : 'Team only'}
            </label>
          </Field>
        </Row>

        <div style={{ marginTop: 16, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.muted, display: 'flex', alignItems: 'center' }}>
          Bonus programs
          <Info text="Two of the four programs trigger on DAILY thresholds while this model runs monthly, so daily volume has to be inferred. Deals arrive in clumps, and a flat spread would never cross the 3-deals-in-a-day line at realistic volumes, understating real payouts." />
        </div>
        <Row cols={5} gap={12} style={{ marginTop: 8 }}>
          <Field label="Bonuses enabled" tooltip="Turn every bonus program off.">
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: T.body, paddingTop: 6 }}>
              <input type="checkbox" checked={inputs.bonusPolicy.enabled}
                onChange={(e) => patch({ bonusPolicy: { ...inputs.bonusPolicy, enabled: e.target.checked } })} />
              {inputs.bonusPolicy.enabled ? 'On' : 'Off'}
            </label>
          </Field>
          <Field label="Working days / month" tooltip="Used to convert monthly volume into a daily rate.">
            <NumberInput value={inputs.bonusPolicy.workingDaysPerMonth} min={1} max={31} step={0.1}
              onChange={(v) => patch({ bonusPolicy: { ...inputs.bonusPolicy, workingDaysPerMonth: v } })} />
          </Field>
          <Field label="Deal concentration" tooltip="How much deals clump. 1.0 spreads them perfectly evenly across every working day. 1.6 means a rep is productive on about 62% of days and writes 1.6x their daily average on those. Raise it to match what you actually see."
            hint={`${fmtNum(inputs.bonusPolicy.workingDaysPerMonth / Math.max(1, inputs.bonusPolicy.dealConcentration), 1)} productive days`}>
            <NumberInput value={inputs.bonusPolicy.dealConcentration} min={1} max={5} step={0.1} suffix="×"
              onChange={(v) => patch({ bonusPolicy: { ...inputs.bonusPolicy, dealConcentration: v } })} />
          </Field>
          <Field label="Manual hit-days 3+" tooltip="Set above zero to bypass the concentration model and state observed days per month where a rep wrote 3+ deals.">
            <NumberInput value={inputs.bonusPolicy.manualHitDays3Plus} min={0} max={31} step={1}
              onChange={(v) => patch({ bonusPolicy: { ...inputs.bonusPolicy, manualHitDays3Plus: v } })} />
          </Field>
          <Field label="Provisional holdback" tooltip="Share of accrued bonus withheld from this month's cash, pending clawback and chargeback clearance. Accrual is unaffected — only the timing of cash.">
            <NumberInput value={inputs.bonusPolicy.provisionalHoldbackPct} min={0} max={100} step={5} suffix="%"
              onChange={(v) => patch({ bonusPolicy: { ...inputs.bonusPolicy, provisionalHoldbackPct: v } })} />
          </Field>
        </Row>

        <div style={{ overflowX: 'auto', marginTop: 12, border: `1px solid ${T.line}`, borderRadius: 9 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 620 }}>
            <thead>
              <tr>
                <th style={th}>Program</th>
                <th style={th}>Status in month {stmtMonth}</th>
                <th style={{ ...th, textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {(month?.bonuses.lines ?? []).map((b) => (
                <tr key={b.id}>
                  <td style={{ ...td, fontWeight: 600, color: b.amount > 0 ? T.ink : T.muted }}>{b.label}</td>
                  <td style={{ ...td, whiteSpace: 'normal', fontSize: 11, color: T.muted }}>{b.detail}</td>
                  <td style={{ ...tdNum, fontWeight: b.amount > 0 ? 700 : 400, color: b.amount > 0 ? T.ink : T.faint }}>
                    {b.amount > 0 ? fmtMoney(b.amount) : '—'}
                  </td>
                </tr>
              ))}
              <tr>
                <td style={{ ...td, borderTop: `2px solid ${T.ink}`, fontWeight: 800, color: T.ink }}>Total accrued</td>
                <td style={{ ...td, borderTop: `2px solid ${T.ink}`, fontSize: 11, color: T.muted }}>
                  {(month?.bonuses.heldBack ?? 0) > 0 ? `${fmtMoney(month!.bonuses.heldBack)} held back as provisional` : 'No holdback applied'}
                </td>
                <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 800 }}>{fmtMoney(month?.bonuses.total ?? 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Callout tone="warn">
          All bonus payouts are subject to Funding Tier clawback and chargeback policy. Chargeback liability is enforced
          daily and any open risk period can delay or reverse a payout — treat these as provisional until the related
          files have cleared their windows.
        </Callout>
      </Panel>

      <MonthEndReport inputs={inputs} results={results} month={stmtMonth} setMonth={setStmtMonth} />

      {/* ── 7 · Risk & attrition ───────────────────────────────────────────── */}
      <Panel title="5 · Risk, reserve, and attrition" defaultOpen={false}
        tooltip="Cash reserve policy and the client attrition curves that shrink each cohort over time.">
        <Row cols={5} gap={12}>
          <Field label="Reserve target (months)" tooltip="How many months of overhead the business wants on hand before it considers itself safe.">
            <NumberInput value={inputs.reservePolicy.targetMonthsOfOverhead} min={0} max={24}
              onChange={(v) => patch({ reservePolicy: { ...inputs.reservePolicy, targetMonthsOfOverhead: v } })} />
          </Field>
          <Field label="Dispute / chargeback buffer" tooltip="Haircut applied to recognised revenue to cover disputes and chargebacks.">
            <NumberInput value={inputs.reservePolicy.disputeRatePct} min={0} max={20} step={0.1}
              onChange={(v) => patch({ reservePolicy: { ...inputs.reservePolicy, disputeRatePct: v } })} suffix="%" />
          </Field>
          <div style={{ gridColumn: 'span 3' }}>
            <Callout>
              Auto-hiring is <strong>off</strong>. Volume is now derived from employed closer hours, so adding a seat adds
              volume and utilization sits near 100% by construction — an automatic trigger would hire on every month the
              reserve is met. Headcount is a roster decision: add or remove people above.
            </Callout>
          </div>
        </Row>

        <div style={{ marginTop: 14 }}>
          {BACKEND_KEYS.map((k) => (
            <div key={k} style={{ borderTop: `1px solid ${T.lineSoft}`, paddingTop: 10, marginTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <PartnerName k={k} size={18} />
                <span style={{ fontSize: 11, color: T.muted }}>
                  {k === 'LEVEL'
                    ? 'Settlement product — only the first two payments matter. Funding Tier is paid after payment 1 clears and is free of chargeback liability after payment 2.'
                    : 'Perpetuity product — attrition compounds for the life of the program.'}
                </span>
              </div>
              <Row cols={k === 'LEVEL' ? 3 : 7} gap={10}>
                <Field label="First-pay conversion" tooltip="Share of enrolled deals whose first client payment actually clears. Everything downstream is a fraction of this.">
                  <NumberInput value={inputs.survivalCurves[k].firstPayPct} min={0} max={100} step={1}
                    onChange={(v) => patch({ survivalCurves: { ...inputs.survivalCurves, [k]: { ...inputs.survivalCurves[k], firstPayPct: v } } })} suffix="%" />
                </Field>
                {(k === 'LEVEL' ? [0] : [0, 1, 2, 3, 4]).map((i) => (
                  <Field key={i} label={`Mo ${i + 2} cancel`} tooltip={`Share of the surviving cohort that cancels in deal-month ${i + 2}.`}>
                    <NumberInput value={inputs.survivalCurves[k].cancelPctByMonth[i] ?? 15} min={0} max={100} step={1}
                      onChange={(v) => {
                        const arr = [...inputs.survivalCurves[k].cancelPctByMonth];
                        arr[i] = v;
                        patch({ survivalCurves: { ...inputs.survivalCurves, [k]: { ...inputs.survivalCurves[k], cancelPctByMonth: arr } } });
                      }} suffix="%" />
                  </Field>
                ))}
                {k !== 'LEVEL' && (
                  <Field label="Steady state (mo 7+)" tooltip="Monthly cancel rate from deal-month 7 to the end of the program.">
                    <NumberInput value={inputs.survivalCurves[k].steadyStateMonthlyCancelPct} min={0} max={100} step={1}
                      onChange={(v) => patch({ survivalCurves: { ...inputs.survivalCurves, [k]: { ...inputs.survivalCurves[k], steadyStateMonthlyCancelPct: v } } })} suffix="%" />
                  </Field>
                )}
                {k === 'LEVEL' && (
                  <div style={{ display: 'flex', alignItems: 'flex-end', fontSize: 10.5, color: T.faint, lineHeight: 1.4 }}>
                    No months 3+ inputs — this backend collects nothing after payment 2.
                  </div>
                )}
              </Row>
            </div>
          ))}
        </div>
        <Callout tone="warn">
          These curves are illustrative, not observed data. Industry completion rates are contested: the trade association
          reports 35–60% full-program completion, while government and state investigations found completion often in the
          single digits. Calibrate toward real performance as it accumulates.
        </Callout>
      </Panel>

      {/* ── 8 · Single-month partner detail — statement month on the LEFT ──── */}
      <Panel title="Single-month detail — active deals, revenue, and rep commission by partner"
        tooltip="What each servicing partner produced in one specific month. Revenue is cash received; commission is cash paid out to reps.">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
          <div style={{
            flex: '0 0 190px', border: `1px solid ${T.line}`, borderRadius: 8,
            padding: '11px 12px', background: T.panel,
          }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.muted, marginBottom: 6 }}>
              Statement month
            </div>
            <input
              type="number" min={1} max={horizon} value={stmtMonth}
              onChange={(e) => setStmtMonth(Math.min(horizon, Math.max(1, Number(e.target.value))))}
              style={{ ...inputStyle, fontSize: 20, fontWeight: 800, textAlign: 'center', padding: '6px 8px' }}
            />
            <input
              type="range" min={1} max={horizon} value={stmtMonth}
              onChange={(e) => setStmtMonth(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8 }}
            />
            <div style={{ fontSize: 10, color: T.faint, marginTop: 4 }}>1 – {horizon}</div>
            <div style={{ marginTop: 10, borderTop: `1px solid ${T.line}`, paddingTop: 8, display: 'grid', gap: 5 }}>
              {[
                ['Deals submitted', fmtNum(month?.deals ?? 0, 0)],
                ['Revenue collected', fmtMoney(month?.revenue ?? 0)],
                ['Commission to reps', fmtMoney(month?.repCommission ?? 0)],
                ['Overhead', fmtMoney(month?.overhead ?? 0)],
                ['Net cash flow', fmtMoney(month?.netCashFlow ?? 0)],
              ].map(([a, b]) => (
                <div key={a} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: T.muted }}>{a}</span>
                  <span style={{ fontFamily: T.mono, fontWeight: 700, color: T.ink }}>{b}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 400, overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={th}>Servicing partner</th>
                  <th style={{ ...th, textAlign: 'right' }}>New deals<Info text="Deals submitted to this partner in the selected month." /></th>
                  <th style={{ ...th, textAlign: 'right' }}>Active paying deals<Info text="Survival-adjusted count of deals from every prior cohort still generating a payment this month — not raw deals submitted." /></th>
                  <th style={{ ...th, textAlign: 'right' }}>Revenue received<Info text="Cash actually remitted to Funding Tier by this partner in the selected month." /></th>
                  <th style={{ ...th, textAlign: 'right' }}>
                    Commission paid to reps
                    <Info text="Money Funding Tier PAYS OUT to its own sales reps for deals this partner released payout on. This is an expense, not income." />
                  </th>
                </tr>
              </thead>
              <tbody>
                {(month?.partners ?? []).map((p) => (
                  <tr key={p.key}>
                    <td style={td}><PartnerName k={p.key} size={18} /></td>
                    <td style={tdNum}>{fmtNum(p.dealsSubmitted, 0)}</td>
                    <td style={tdNum}>{fmtNum(p.activeDeals, 0)}</td>
                    <td style={tdNum}>{fmtMoney(p.revenue)}</td>
                    <td style={{ ...tdNum, color: p.repCommission > 0 ? T.bad : T.faint }}>
                      {p.repCommission > 0 ? `(${fmtMoney(p.repCommission)})` : '$0'}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td style={{ ...td, borderTop: `2px solid ${T.ink}`, fontWeight: 800, color: T.ink }}>TOTAL</td>
                  <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 800 }}>{fmtNum(month?.deals ?? 0, 0)}</td>
                  <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 800 }}>
                    {fmtNum((month?.partners ?? []).reduce((s, p) => s + p.activeDeals, 0), 0)}
                  </td>
                  <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 800 }}>{fmtMoney(month?.revenue ?? 0)}</td>
                  <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 800, color: T.bad }}>
                    {(month?.repCommission ?? 0) > 0 ? `(${fmtMoney(month?.repCommission ?? 0)})` : '$0'}
                  </td>
                </tr>
              </tbody>
            </table>
            {month?.notes && <Callout>{month.notes}</Callout>}
          </div>
        </div>
      </Panel>

      {/* ── 9 · Revenue forecast by partner — moved down, timing made explicit */}
      <Panel title="Revenue Forecast by Servicing Partner" defaultOpen={false}
        subtitle={`Cumulative over ${horizon} months — read with the timing caveat below`}
        tooltip="Cumulative totals by partner. Read this last: the three partners pay on structurally different timetables, so a single cumulative column is not an apples-to-apples comparison.">
        <Callout tone="warn">
          <strong>Read this before the table.</strong> {BRANDS.CS.name} and {BRANDS.LEGACY.name} collect a share of
          <strong> every client payment, every month, for the life of the program</strong> — their cumulative totals keep
          compounding as long as clients stay. {BRANDS.LEVEL.name} is paid <strong>once</strong>, after the client's first
          payment clears, and the deal is clear of chargeback liability after the second completed payment — its total stops
          growing per deal immediately. A longer horizon inflates the perpetuities and does nothing for Level Debt, so the
          ranking below is an artefact of the timetable as much as of deal quality. Compare <em>revenue per deal</em> and
          <em> time to de-risk</em>, not just the cumulative column.
        </Callout>
        <div style={{ overflowX: 'auto', marginTop: 10 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900 }}>
            <thead>
              <tr>
                <th style={th}>Servicing partner</th>
                <th style={th}>Payment structure</th>
                <th style={{ ...th, textAlign: 'right' }}>Deals</th>
                <th style={{ ...th, textAlign: 'right' }}>Enrolled volume</th>
                <th style={{ ...th, textAlign: 'right' }}>Revenue</th>
                <th style={{ ...th, textAlign: 'right' }}>Rev / deal</th>
                <th style={{ ...th, textAlign: 'right' }}>Commission paid</th>
                <th style={{ ...th, textAlign: 'right' }}>Net revenue</th>
              </tr>
            </thead>
            <tbody>
              {results.partners.map((p) => (
                <tr key={p.key}>
                  <td style={td}><PartnerName k={p.key} size={18} sub /></td>
                  <td style={{ ...td, whiteSpace: 'normal', maxWidth: 250, fontSize: 11, color: T.muted }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
                      color: p.perpetuity ? T.good : T.warn, background: p.perpetuity ? T.goodBg : T.warnBg,
                      border: `1px solid ${p.perpetuity ? '#bbf7d0' : T.warnLine}`, padding: '1px 6px',
                      borderRadius: 20, marginRight: 6, display: 'inline-block',
                    }}>{p.perpetuity ? 'Perpetuity' : 'One-time'}</span>
                    {p.revenueModel}
                  </td>
                  <td style={tdNum}>{fmtNum(p.dealsSubmitted, 0)}</td>
                  <td style={tdNum}>{fmtMoney(p.enrolledVolume)}</td>
                  <td style={tdNum}>{fmtMoney(p.revenue)}</td>
                  <td style={tdNum}>{p.dealsSubmitted > 0 ? fmtMoney(p.revenue / p.dealsSubmitted) : '—'}</td>
                  <td style={{ ...tdNum, color: T.bad }}>({fmtMoney(p.repCommission)})</td>
                  <td style={{ ...tdNum, fontWeight: 700, color: T.ink }}>{fmtMoney(p.netRevenue)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...td, borderTop: `2px solid ${T.ink}`, fontWeight: 800, color: T.ink }}>TOTAL</td>
                <td style={{ ...td, borderTop: `2px solid ${T.ink}` }} />
                <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 800 }}>{fmtNum(results.partners.reduce((s, p) => s + p.dealsSubmitted, 0), 0)}</td>
                <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 800 }}>{fmtMoney(results.partners.reduce((s, p) => s + p.enrolledVolume, 0))}</td>
                <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 800 }}>{fmtMoney(results.totals.revenue)}</td>
                <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}` }} />
                <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 800, color: T.bad }}>({fmtMoney(results.totals.repCommission)})</td>
                <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 800 }}>{fmtMoney(results.totals.revenue - results.totals.repCommission)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ── 10 · Month-by-month ────────────────────────────────────────────── */}
      <Panel title="Month-by-Month Detail"
        tooltip="The full simulation output. Hover any column header for the exact calculation behind it.">
        <div style={{ overflowX: 'auto', maxHeight: 620, border: `1px solid ${T.line}`, borderRadius: 8 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1360 }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 42 }}>Mo<Info text={MONTH_COL_HELP.mo} /></th>
                <th style={{ ...th, textAlign: 'right' }}>Deals<Info text={MONTH_COL_HELP.deals} /></th>
                <th style={{ ...th, textAlign: 'right' }}>Revenue<Info text={MONTH_COL_HELP.revenue} /></th>
                <th style={{ ...th, textAlign: 'right' }}>Commission<Info text={MONTH_COL_HELP.commission} /></th>
                <th style={{ ...th, textAlign: 'right' }}>Override<Info text={MONTH_COL_HELP.override} /></th>
                <th style={{ ...th, textAlign: 'right' }}>Bonuses<Info text={MONTH_COL_HELP.bonuses} /></th>
                <th style={{ ...th, textAlign: 'right' }}>Overhead<Info text={MONTH_COL_HELP.overhead} /></th>
                <th style={{ ...th, textAlign: 'right' }}>Net CF<Info text={MONTH_COL_HELP.netcf} /></th>
                <th style={{ ...th, textAlign: 'right' }}>Cash position<Info text={MONTH_COL_HELP.cash} /></th>
                <th style={{ ...th, textAlign: 'center' }}>Reserve met<Info text={MONTH_COL_HELP.reserve} /></th>
                <th style={{ ...th, textAlign: 'right' }}>Seats<Info text={MONTH_COL_HELP.seats} /></th>
                <th style={{ ...th, textAlign: 'right' }}>Utilization<Info text={MONTH_COL_HELP.util} /></th>
                <th style={th}>Event<Info text={MONTH_COL_HELP.event} /></th>
                <th style={{ ...th, minWidth: 260 }}>Notes<Info text={MONTH_COL_HELP.notes} /></th>
              </tr>
            </thead>
            <tbody>
              {results.months.map((r) => (
                <tr key={r.month}
                  onClick={() => setStmtMonth(r.month)}
                  style={{ cursor: 'pointer', background: r.month === stmtMonth ? '#f0fdfa' : r.month === 1 ? T.warnBg : undefined }}>
                  <td style={{ ...td, fontWeight: 700, color: T.ink }}>{r.month}</td>
                  <td style={tdNum}>{fmtNum(r.deals, 0)}</td>
                  <td style={tdNum}>{r.revenue > 0 ? fmtMoney(r.revenue) : <span style={{ color: T.warn, fontWeight: 700 }}>$0</span>}</td>
                  <td style={{ ...tdNum, color: r.repCommission > 0 ? T.bad : T.faint }}>{r.repCommission > 0 ? `(${fmtMoney(r.repCommission)})` : '$0'}</td>
                  <td style={{ ...tdNum, color: r.managerOverride > 0 ? T.bad : T.faint }}>{r.managerOverride > 0 ? `(${fmtMoney(r.managerOverride)})` : '$0'}</td>
                  <td style={{ ...tdNum, color: r.bonusPaid > 0 ? T.bad : T.faint }}>{r.bonusPaid > 0 ? `(${fmtMoney(r.bonusPaid)})` : '$0'}</td>
                  <td style={{ ...tdNum, color: T.bad }}>({fmtMoney(r.overhead)})</td>
                  <td style={{ ...tdNum, fontWeight: 700, color: r.netCashFlow >= 0 ? T.good : T.bad }}>{fmtMoney(r.netCashFlow)}</td>
                  <td style={{ ...tdNum, fontWeight: 700, color: r.cashPosition >= 0 ? T.ink : T.bad }}>{fmtMoney(r.cashPosition)}</td>
                  <td style={{ ...td, textAlign: 'center', color: r.reserveMet ? T.good : T.faint, fontWeight: 700 }}>{r.reserveMet ? 'Yes' : 'No'}</td>
                  <td style={tdNum}>{r.seats}</td>
                  <td style={{ ...tdNum, color: r.utilizationPct > 100 ? T.bad : T.body, fontWeight: r.utilizationPct > 100 ? 700 : 400 }}>{fmtPct(r.utilizationPct)}</td>
                  <td style={{ ...td, fontSize: 11, color: T.accent, fontWeight: 600 }}>{r.event || ''}</td>
                  <td style={{ ...td, whiteSpace: 'normal', fontSize: 10.5, color: r.month === 1 ? T.warn : T.muted, lineHeight: 1.45 }}>{r.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout tone="warn">
          <strong>Month 1 collects nothing, by design.</strong> Every backend pays Funding Tier in arrears.
          {' '}{BRANDS.LEVEL.name} remits only after the client's first payment clears;
          {' '}{BRANDS.CS.name} and {BRANDS.LEGACY.name} remit the month after each client payment.
          No commission is paid in month 1 either, because commission follows the backend payout. Month 1 is all cost —
          that is the peak-capital number at the top of the page, not a modelling error.
        </Callout>
      </Panel>

        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <Btn onClick={() => setInputs(cloneDefaults())}>Reset to defaults</Btn>
          <span style={{ fontSize: 11, color: T.faint, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Servicing partners:
            {BACKEND_KEYS.map((k) => <PartnerName key={k} k={k} size={15} style={{ fontSize: 11 }} />)}
          </span>
        </div>
      </div>
    </div>
  );
}
