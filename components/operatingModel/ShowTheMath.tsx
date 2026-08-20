'use client';
import React, { useMemo, useState } from 'react';
import type { ModelInputs, ModelResults } from './types';
import { buildTrace } from './trace';
import { Btn, Callout, T, td, tdNum, th } from './ui';

export function ShowTheMath({ inputs, results, month, setMonth }: {
  inputs: ModelInputs; results: ModelResults; month: number; setMonth: (m: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const sections = useMemo(
    () => (open ? buildTrace(inputs, results, month) : []),
    [open, inputs, results, month],
  );

  return (
    <section style={{
      border: `1px solid ${open ? T.accent : T.line}`, borderRadius: T.radius,
      background: T.bg, marginBottom: 14, overflow: 'hidden',
    }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
        background: open ? '#f0fdfa' : T.bg, borderBottom: open ? `1px solid ${T.line}` : 'none',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: T.ink }}>
            Show the math — every number, derived
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
            Opens a full audit trail: each figure on this page, the formula behind it, and the values substituted in.
            Built to hand to an investor.
          </div>
        </div>
        {open && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.muted, fontWeight: 700 }}>
            MONTH
            <input
              type="number" min={1} max={results.months.length} value={month}
              onChange={(e) => setMonth(Math.min(results.months.length, Math.max(1, Number(e.target.value))))}
              style={{
                width: 60, padding: '5px 7px', border: `1px solid ${T.line}`,
                borderRadius: 6, fontFamily: T.mono, fontSize: 13,
              }}
            />
          </label>
        )}
        <Btn onClick={() => setOpen((v) => !v)} tone={open ? 'plain' : 'primary'}>
          {open ? 'Hide the math' : 'Show the math'}
        </Btn>
      </header>

      {open && (
        <div style={{ padding: 14 }}>
          <Callout>
            Reading order: labor sets the hours, hours set the deal volume, deal volume sets revenue and cost,
            and the difference is cash. Nothing on this page comes from anywhere else.
          </Callout>
          {sections.map((s) => (
            <div key={s.id} style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: T.ink }}>{s.title}</div>
              <div style={{ fontSize: 11, color: T.muted, margin: '3px 0 8px' }}>{s.intro}</div>
              <div style={{ overflowX: 'auto', border: `1px solid ${T.line}`, borderRadius: 8 }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900 }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, width: 120 }}>Step</th>
                      <th style={{ ...th, width: 220 }}>What it is</th>
                      <th style={th}>Formula</th>
                      <th style={th}>Values used</th>
                      <th style={{ ...th, textAlign: 'right', width: 120 }}>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.rows.map((r, i) => (
                      <React.Fragment key={i}>
                        <tr>
                          <td style={{ ...td, fontWeight: 700, color: T.ink, fontSize: 11 }}>{r.step}</td>
                          <td style={{ ...td, whiteSpace: 'normal' }}>{r.what}</td>
                          <td style={{ ...td, fontFamily: T.mono, fontSize: 11, color: T.muted, whiteSpace: 'normal' }}>{r.formula}</td>
                          <td style={{ ...td, fontFamily: T.mono, fontSize: 11, whiteSpace: 'normal' }}>{r.substitution}</td>
                          <td style={{ ...tdNum, fontWeight: 800, color: T.ink }}>{r.result}</td>
                        </tr>
                        {r.note && (
                          <tr>
                            <td />
                            <td colSpan={4} style={{
                              ...td, whiteSpace: 'normal', fontSize: 10.5, color: T.muted,
                              paddingTop: 0, paddingBottom: 8, borderBottom: `1px solid ${T.lineSoft}`,
                            }}>↳ {r.note}</td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
