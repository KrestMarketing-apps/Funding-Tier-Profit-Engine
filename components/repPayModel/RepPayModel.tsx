'use client';
import React from 'react';
import { DEFAULT_INPUTS, BRANDS } from '../operatingModel/config';
import {
  Panel, Callout, Row, T, fmtMoney, fmtPct, th, td,
} from '../operatingModel/ui';
import ToolShell from '../ToolShell';
import { p } from '../../lib/paths';

// This page is reference/explainer material for the rep-pay decision, not a
// simulator — so it reads its numbers straight from the Operating Model's own
// defaults rather than keeping a second, hand-typed copy that could drift out
// of sync. If the tiers or ramp settings change in operatingModel/config.ts,
// this page updates itself.
const REP_PAY = DEFAULT_INPUTS.repPay;
const BPO_PAY = DEFAULT_INPUTS.bpoPay;

function tierRangeLabel(tiers: typeof REP_PAY.drawTiers, i: number): string {
  const from = tiers[i].threshold;
  const next = tiers[i + 1]?.threshold;
  if (next == null) return `${fmtMoney(from)}+`;
  return `${fmtMoney(from)} – ${fmtMoney(next - 1)}`;
}

function MechanismCard({
  tag, title, accent, children, footNote,
}: {
  tag: string; title: string; accent?: boolean; children: React.ReactNode; footNote: React.ReactNode;
}) {
  return (
    <div style={{
      border: `1px solid ${accent ? T.brandLine : T.line}`,
      borderLeft: accent ? `4px solid ${T.brand}` : `1px solid ${T.line}`,
      borderRadius: 10, padding: '16px 18px', background: accent ? T.brandSoft : '#fff',
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, color: accent ? T.brandDark : T.muted,
        letterSpacing: 0.3, marginBottom: 4,
      }}>{tag}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 12 }}>{title}</div>
      {children}
      <div style={{ fontSize: 12, color: T.muted, marginTop: 12, lineHeight: 1.55 }}>{footNote}</div>
    </div>
  );
}

function BarRow({ label, value, pct, tone }: { label: string; value: string; pct: number; tone: 'mid' | 'high' | 'light' }) {
  const colors = { mid: T.brandLine, high: T.brand, light: '#bfe9e1' } as const;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.muted, marginBottom: 5 }}>
        <span>{label}</span><span>{value}</span>
      </div>
      <div style={{ height: 20, borderRadius: 5, background: T.lineSoft, overflow: 'hidden', display: 'flex' }}>
        <div style={{ width: `${pct}%`, background: colors[tone] }} />
      </div>
    </div>
  );
}

function TradeoffColumn({
  title, sub, accent, strengths, costs,
}: {
  title: string; sub: string; accent?: boolean; strengths: string[]; costs: string[];
}) {
  return (
    <div style={{
      border: `1px solid ${T.line}`, borderTop: accent ? `4px solid ${T.brand}` : `1px solid ${T.line}`,
      borderRadius: 10, padding: '16px 18px', background: '#fff',
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>{title}</div>
      <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 14 }}>{sub}</div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, letterSpacing: 0.3, marginBottom: 8 }}>STRENGTHS</div>
      <ul style={{ margin: '0 0 14px', padding: 0, listStyle: 'none' }}>
        {strengths.map((s, i) => (
          <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.55, marginBottom: 8, color: T.ink }}>
            <span style={{ color: T.good, flex: '0 0 auto' }}>✓</span><span>{s}</span>
          </li>
        ))}
      </ul>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, letterSpacing: 0.3, marginBottom: 8 }}>COSTS</div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {costs.map((s, i) => (
          <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.55, marginBottom: 8, color: T.ink }}>
            <span style={{ color: T.warn, flex: '0 0 auto' }}>✗</span><span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RiskItem({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, padding: '14px 0', borderTop: `1px solid ${T.lineSoft}` }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{term}</div>
      <div style={{ fontSize: 13, color: T.body, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

export default function RepPayModel({ mode = 'admin' }: { mode?: 'admin' | 'agent' }) {
  const tiers = REP_PAY.drawTiers;
  const baseRate = tiers[0]?.rate ?? 0;
  const topTier = tiers[tiers.length - 1];

  const heroSlot = (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <a
        href={p('/operating-model')}
        style={{
          background: '#fff', color: T.brandDark, border: 'none', borderRadius: 9,
          padding: '9px 15px', fontWeight: 800, fontSize: 12.5, textDecoration: 'none',
          fontFamily: T.sans, whiteSpace: 'nowrap', boxShadow: '0 3px 12px -3px rgba(0,0,0,.4)',
        }}
      >Open the Operating Model →</a>
      <span style={{ fontSize: 12, color: '#cfe0e8' }}>
        Run these numbers live against the actual roster and volume assumptions.
      </span>
    </div>
  );

  return (
    <div style={{ fontFamily: T.sans, color: T.body, background: T.shell, minHeight: '100vh' }}>
      <ToolShell
        mode={mode}
        tool="Rep Pay Model"
        eyebrow="ADMIN · SALES COMPENSATION"
        badge={{ text: 'ADMIN ONLY' }}
        title="Rep Pay Model"
        subtitle="Why Funding Tier is evaluating a shift from per-program commission to an individual draw plus tiered scale — the mechanism, the trade-offs, and the built-in 90-day safeguard for new US-based closers."
        heroSlot={heroSlot}
      >
        <div>

          {/* ── 1 · Mechanism ─────────────────────────────────────────────── */}
          <Panel title="1 · The mechanism" accent={T.accent}
            tooltip="Both models pay hourly. The difference is how the commission rate is set, and when it's treated as earned.">
            <Callout>
              Every rep is paid an hourly wage plus commission, in <strong>both</strong> models. This isn't "hourly vs.
              commission" — it's about how the commission rate is set, and whether it's reviewed against the team or the
              individual.
            </Callout>
            <Row cols={2} gap={16} style={{ marginTop: 14 }}>
              <MechanismCard tag="CURRENT" title="Per-program commission schedules"
                footNote={<>Each servicing partner pays its own separate schedule. {BRANDS.LEVEL.name}'s rate is set by
                  the <em>company's</em> total monthly settlement volume — a strong individual is capped by a slow team
                  month. {BRANDS.CS.name} and {BRANDS.LEGACY.name} commission doesn't move with volume at all.</>}>
                <BarRow label={BRANDS.LEVEL.name} value="Company-wide tiered %" pct={45} tone="mid" />
                <BarRow label={`${BRANDS.CS.name} + ${BRANDS.LEGACY.name}`} value="Flat per-deal / band" pct={45} tone="mid" />
              </MechanismCard>
              <MechanismCard tag="PROPOSED" title="Individual draw + tiered scale, all 3 programs" accent
                footNote={<>Wage is paid as a non-recoverable draw — a floor, not a clawback. One rate, set by each rep's
                  <strong> combined {BRANDS.LEVEL.name} + {BRANDS.CS.name} + {BRANDS.LEGACY.name} volume</strong>, applies
                  to their commission on all three — closing a diverse mix raises the rate on everything.</>}>
                <BarRow label="Rep A — high combined volume" value={`${fmtPct((topTier?.rate ?? 0) * 100, 2)} on everything`} pct={65} tone="high" />
                <BarRow label="Rep B — lower combined volume" value={`${fmtPct(baseRate * 100, 2)} on everything`} pct={30} tone="light" />
              </MechanismCard>
            </Row>
          </Panel>

          {/* ── 2 · Trade-offs ────────────────────────────────────────────── */}
          <Panel title="2 · What Funding Tier gains, and gives up" accent={T.accent}>
            <Row cols={2} gap={16}>
              <TradeoffColumn
                title="Per-program schedules" sub="Current structure"
                strengths={[
                  'Simple to administer — no cross-program volume tracking needed in payroll.',
                  `Rewards team behavior on ${BRANDS.LEVEL.name} — a hot month lifts every rep's settlement rate together.`,
                ]}
                costs={[
                  `A top individual performer is rate-capped by a slow team month, on ${BRANDS.LEVEL.name} specifically.`,
                  'Underperformance is masked inside the team average — no individual signal.',
                  `No incentive to sell a diversified mix — ${BRANDS.CS.name} and ${BRANDS.LEGACY.name} commission don't move with volume at all.`,
                  'Wage exposure on a non-producer has no built-in review checkpoint.',
                ]}
              />
              <TradeoffColumn
                title="Individual draw + tiered scale" sub="Proposed structure" accent
                strengths={[
                  "Commission rate reflects each rep's own combined volume across all three programs — pay tracks total output, not one product alone.",
                  `Rewards a diversified book — closing ${BRANDS.CS.name} or ${BRANDS.LEGACY.name} business raises the rate on ${BRANDS.LEVEL.name} too.`,
                  'Underperformance is visible immediately, rep by rep, not hidden in an average.',
                  'A 90-day earning window on new-hire production confirms a deal has stuck before commission is owed.',
                  'Paired with the 2-month employment checkpoint, wage exposure per hire is bounded and known in advance.',
                ]}
                costs={[
                  "Payroll must track and tier each rep's combined volume across three programs monthly — more moving parts.",
                  'The risk benefit depends on consistently enforcing both the ramp window and the 2-month checkpoint.',
                ]}
              />
            </Row>
          </Panel>

          {/* ── 3 · Risk case ─────────────────────────────────────────────── */}
          <Panel title="3 · Why this narrows Funding Tier's exposure per hire" accent={T.accent}>
            <div>
              <RiskItem term="Bounded downside">
                A non-producing hire costs, at most, <strong>two months</strong> of wage floor before the position is
                re-evaluated — not an open-ended labor liability.
              </RiskItem>
              <RiskItem term="Wider hiring pool">
                A guaranteed wage lets Funding Tier hire on sales aptitude rather than who can afford to work
                commission-only during ramp-up.
              </RiskItem>
              <RiskItem term="Predictable cost ceiling">
                Hourly labor cost is fixed and forecastable per rep; the review window caps how long an underperforming
                rate can run before it's addressed.
              </RiskItem>
              <RiskItem term="Diversification, not concentration">
                Tiering on combined volume across all three programs means no single product carries the company's
                exposure — reps are paid to build a balanced book, not to chase {BRANDS.LEVEL.name} alone.
              </RiskItem>
              <RiskItem term="Upside without added risk">
                Because the wage floor already covers downside protection, the tiered scale can be pure growth
                incentive — no clawbacks or holdbacks needed on the commission side.
              </RiskItem>
            </div>
          </Panel>

          {/* ── 4 · 90-day ramp window ────────────────────────────────────── */}
          <Panel title="4 · The new-hire safeguard — 90-day ramp window" accent={T.accent}
            tooltip="US-based closers only. Not a clawback: a delay in when commission is earned, applied only going forward.">
            <Callout tone="good">
              <strong>Currently configured:</strong> a US-based closer's first <strong>{REP_PAY.ramp.rampMonths} months</strong> on
              the team are the ramp window. Commission on deals closed during that window is earned at{' '}
              <strong>deal-month {REP_PAY.ramp.probationPayoutDealMonth}</strong>, instead of the standard deal-month 2
              schedule every backend uses today. Same rate, same money — one extra payment cycle before it's owed.
              {REP_PAY.ramp.enabled ? '' : ' (Ramp policy is currently OFF in the default model — this describes what enabling it would do.)'}
            </Callout>

            <Row cols={2} gap={16} style={{ marginTop: 14 }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, marginBottom: 8 }}>Why 90 days, in this industry specifically</div>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: T.body, margin: 0 }}>
                  This isn't borrowed from another industry's playbook — it's sized to debt settlement's own documented
                  attrition curve. Published industry research (FTC / TASC) has found that a majority of clients who
                  eventually cancel a debt-settlement program do so within the first several months of enrollment, well
                  before the program reaches its later stages. That's the same window this policy targets: give a new
                  closer's deal enough time to clear the period where debt-settlement cancellations concentrate, before
                  the commission is treated as earned.
                </p>
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, marginBottom: 8 }}>Why this holds up legally, and is easy to explain</div>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: T.body, margin: 0 }}>
                  This is a delay in <em>when</em> a commission is earned, not a clawback of money already paid — a
                  distinction California courts have drawn consistently, upholding earning-delay windows far longer than
                  90 days when the terms are written down and applied before any payout. New agents hear one sentence:
                  {' '}<em>"Your first {REP_PAY.ramp.rampMonths * 30} days of deals pay out on the {REP_PAY.ramp.probationPayoutDealMonth}rd
                  payment instead of the 2nd, so we can confirm it stuck before we owe you the commission — same rate,
                  same money, one extra check-in."</em>
                </p>
              </div>
            </Row>

            <Callout tone="warn">
              <strong>Scope: US-based closers only.</strong> This window — and the draw-plus-tiered-scale structure
              generally — applies to Funding Tier's US-based sales team. BPO/overseas production is compensated
              separately and is not subject to either the tiered scale or the ramp window. BPO closers earn one
              monthly volume bonus instead — a share of the dollars that rep enrolled in the calendar month, unlocked
              only by clearing a deal-count threshold ({BPO_PAY.tiers.map((t, i) => (
                <React.Fragment key={t.minDealsPerMonth}>
                  {i > 0 ? ', ' : ''}{t.minDealsPerMonth}+ deals &rarr; {(t.rate * 100).toFixed(2)}%
                </React.Fragment>
              ))}), paid {BPO_PAY.payoutLagMonths === 1 ? 'at the end of the following month' : `${BPO_PAY.payoutLagMonths} months in arrears`} and
              subject to the same clawback and NSF exposure as every other payout. Miss the threshold and no bonus is
              owed at all.
            </Callout>
            <Callout>
              Not legal advice. FTC/TASC figures above are paraphrased from public industry research — verify with
              counsel before citing exact numbers externally.
            </Callout>
          </Panel>

          {/* ── 5 · Proposed scale ────────────────────────────────────────── */}
          <Panel title="5 · The proposed scale" accent={T.accent}
            tooltip="Pulled live from the Operating Model's rep-pay defaults — if the tiers change there, this table updates automatically.">
            <p style={{ fontSize: 13, color: T.muted, margin: '0 0 12px' }}>
              Applied to each rep's own monthly enrolled volume across {BRANDS.LEVEL.name}, {BRANDS.CS.name}, and{' '}
              {BRANDS.LEGACY.name} together, then paid on their production in all three. The base rate below{' '}
              {fmtMoney(tiers[1]?.threshold ?? 0)} is a placeholder pending final sign-off.
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Individual combined monthly enrolled volume</th>
                  <th style={{ ...th, textAlign: 'right' }}>Commission rate</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((tier, i) => (
                  <tr key={i} style={i === tiers.length - 1 ? { background: T.brandSoft } : undefined}>
                    <td style={{ ...td, fontWeight: i === tiers.length - 1 ? 700 : 400, whiteSpace: 'normal' }}>
                      {tierRangeLabel(tiers, i)}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: i === tiers.length - 1 ? 700 : 400, fontFamily: T.mono }}>
                      {fmtPct(tier.rate * 100, 2)}{i === 0 ? ' (placeholder base)' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 11.5, color: T.faint, marginTop: 10 }}>
              Hourly wage rates, capacity, and staffing are unchanged from the current model. Mode is currently{' '}
              <strong>{REP_PAY.mode === 'draw' ? 'DRAW (live)' : 'CONTRACT (original — draw is off by default)'}</strong>{' '}
              in the Operating Model's default inputs. Adjust tiers and toggle the mode there.
            </p>
          </Panel>

          {/* ── Bottom line ───────────────────────────────────────────────── */}
          <Panel title="Bottom line" collapsible={false}>
            <p style={{ fontSize: 15, fontWeight: 700, color: T.ink, lineHeight: 1.5, margin: '0 0 10px' }}>
              This isn't a pay cut or a new cost — it's the same wage and commission dollars, re-pointed so risk sits on
              individual, diversified, time-tested production instead of an unmeasured team average.
            </p>
            <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, margin: 0 }}>
              The relevant signal for leadership isn't the commission math itself — it's that Funding Tier has a defined,
              enforceable, legally-grounded mechanism for keeping sales labor cost proportional to sales output, across
              every servicing partner, as headcount scales.
            </p>
          </Panel>

        </div>
      </ToolShell>
    </div>
  );
}
