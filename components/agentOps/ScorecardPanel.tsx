'use client';
import React from 'react';
import type { DashboardData } from '../../lib/agentOps/types';
import { Panel, T, fmtMoney, fmtNum, td, tdNum, th } from '../operatingModel/ui';
import { Bar, Empty, Pill, Tile, Tiles } from './parts';

/**
 * The value question, one row per agent:
 *   hours paid → calls made → people reached → deals claimed →
 *   deals the backend confirmed → what each of those cost.
 *
 * The two right-hand columns are the point. Cost per claimed deal is what
 * GoHighLevel could tell you; cost per CONFIRMED deal is what the backends'
 * own reports say you actually bought.
 */
export function ScorecardPanel({ data }: { data: DashboardData }) {
  const cards = data.scorecards.filter((s) => s.days > 0 || s.calls > 0 || s.enrollments > 0);

  const total = cards.reduce((acc, s) => ({
    cost: acc.cost + s.paidCost,
    calls: acc.calls + s.calls,
    talk: acc.talk + s.talkHours,
    deals: acc.deals + s.enrollments,
    confirmed: acc.confirmed + s.confirmedByBackend,
    payout: acc.payout + s.confirmedPayout,
    active: acc.active + s.activeHours,
    scheduled: acc.scheduled + s.scheduledHours,
  }), { cost: 0, calls: 0, talk: 0, deals: 0, confirmed: 0, payout: 0, active: 0, scheduled: 0 });

  const margin = total.payout - total.cost;

  return (
    <>
      <Tiles>
        <Tile label="Labor cost" value={fmtMoney(total.cost)} note={`${fmtNum(total.scheduled || total.active, 0)} paid hrs`} />
        <Tile label="Deals claimed" value={fmtNum(total.deals, 0)} note="entered in GoHighLevel" />
        <Tile label="Confirmed by backend" value={fmtNum(total.confirmed, 0)}
          note={total.deals ? `${fmtNum((total.confirmed / total.deals) * 100, 0)}% of claims` : 'no claims yet'}
          tone={total.deals && total.confirmed / total.deals < 0.8 ? 'warn' : 'good'} />
        <Tile label="Confirmed payout" value={fmtMoney(total.payout)} note="per the backends' own reports" />
        <Tile label="Gross of labor" value={fmtMoney(margin)} note="confirmed payout − labor cost"
          tone={margin >= 0 ? 'good' : 'bad'} />
        <Tile label="Cost per confirmed deal" value={total.confirmed ? fmtMoney(total.cost / total.confirmed) : '—'}
          note={total.deals ? `${fmtMoney(total.deals ? total.cost / total.deals : 0)} per claimed` : ''} />
      </Tiles>

      <Panel
        title="Agent scorecard"
        accent={T.accent}
        tooltip="One row per person for the selected period. Paid hours come from the schedule where one is set, and from observed activity where it is not. Confirmed deals are the ones a backend report matched — the rest are still claims."
        subtitle="Hours in, work done, deals out — and what the backends actually confirmed."
      >
        {cards.length === 0 ? <Empty>No activity in this period.</Empty> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1100 }}>
              <thead>
                <tr>
                  <th style={th}>Agent</th>
                  <th style={th}>Type</th>
                  <th style={{ ...th, textAlign: 'right' }}>Days</th>
                  <th style={{ ...th, textAlign: 'right' }}>Active hrs</th>
                  <th style={{ ...th, textAlign: 'right' }}>Paid hrs</th>
                  <th style={th}>Utilization</th>
                  <th style={{ ...th, textAlign: 'right' }}>Calls</th>
                  <th style={{ ...th, textAlign: 'right' }}>Connects</th>
                  <th style={{ ...th, textAlign: 'right' }}>Talk hrs</th>
                  <th style={{ ...th, textAlign: 'right' }}>Deals</th>
                  <th style={{ ...th, textAlign: 'right' }}>Confirmed</th>
                  <th style={{ ...th, textAlign: 'right' }}>Enrolled debt</th>
                  <th style={{ ...th, textAlign: 'right' }}>Payout</th>
                  <th style={{ ...th, textAlign: 'right' }}>Labor</th>
                  <th style={{ ...th, textAlign: 'right' }}>Cost / confirmed</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((s) => {
                  const paid = s.scheduledHours || s.activeHours;
                  const util = paid > 0 ? (s.activeHours / paid) * 100 : 0;
                  const shortfall = s.enrollments > 0 && s.confirmedByBackend < s.enrollments;
                  return (
                    <tr key={s.agent.id}>
                      <td style={{ ...td, fontWeight: 700, color: T.ink }}>
                        {s.agent.name}
                        {s.agent.team && <span style={{ color: T.faint, fontWeight: 400 }}> · {s.agent.team}</span>}
                      </td>
                      <td style={{ ...td, fontSize: 11, color: T.muted }}>
                        {s.agent.employmentType ?? '—'}{s.agent.role ? ` · ${s.agent.role}` : ''}
                      </td>
                      <td style={tdNum}>{fmtNum(s.days, 0)}</td>
                      <td style={tdNum}>{fmtNum(s.activeHours, 1)}</td>
                      <td style={tdNum}>{fmtNum(paid, 1)}</td>
                      <td style={td}>
                        <Bar pct={util} tone={util < 65 ? 'bad' : util < 80 ? 'warn' : 'brand'} />
                        <span style={{ fontSize: 10.5, color: T.muted, marginLeft: 6, fontFamily: T.mono }}>
                          {fmtNum(util, 0)}%
                        </span>
                      </td>
                      <td style={tdNum}>{fmtNum(s.calls, 0)}</td>
                      <td style={tdNum}>{fmtNum(s.connects, 0)}</td>
                      <td style={tdNum}>{fmtNum(s.talkHours, 1)}</td>
                      <td style={tdNum}>{fmtNum(s.enrollments, 0)}</td>
                      <td style={tdNum}>
                        {fmtNum(s.confirmedByBackend, 0)}
                        {shortfall && (
                          <span style={{ marginLeft: 5 }}>
                            <Pill tone="warn" title={`${s.enrollments - s.confirmedByBackend} claimed deal(s) have no matching backend file yet.`}>
                              −{s.enrollments - s.confirmedByBackend}
                            </Pill>
                          </span>
                        )}
                      </td>
                      <td style={tdNum}>{fmtMoney(s.enrolledDebt)}</td>
                      <td style={tdNum}>{fmtMoney(s.confirmedPayout)}</td>
                      <td style={tdNum}>{fmtMoney(s.paidCost)}</td>
                      <td style={{ ...tdNum, fontWeight: 800, color: T.ink }}>
                        {s.costPerConfirmed != null ? fmtMoney(s.costPerConfirmed) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ ...td, borderTop: `2px solid ${T.ink}`, fontWeight: 800, color: T.ink }} colSpan={3}>
                    TOTAL — {cards.length} agents
                  </td>
                  <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 700 }}>{fmtNum(total.active, 1)}</td>
                  <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 700 }}>{fmtNum(total.scheduled || total.active, 1)}</td>
                  <td style={{ ...td, borderTop: `2px solid ${T.ink}` }} />
                  <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 700 }}>{fmtNum(total.calls, 0)}</td>
                  <td style={{ ...td, borderTop: `2px solid ${T.ink}` }} />
                  <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 700 }}>{fmtNum(total.talk, 1)}</td>
                  <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 700 }}>{fmtNum(total.deals, 0)}</td>
                  <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 700 }}>{fmtNum(total.confirmed, 0)}</td>
                  <td style={{ ...td, borderTop: `2px solid ${T.ink}` }} />
                  <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 700 }}>{fmtMoney(total.payout)}</td>
                  <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 700 }}>{fmtMoney(total.cost)}</td>
                  <td style={{ ...tdNum, borderTop: `2px solid ${T.ink}`, fontWeight: 800 }}>
                    {total.confirmed ? fmtMoney(total.cost / total.confirmed) : '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
