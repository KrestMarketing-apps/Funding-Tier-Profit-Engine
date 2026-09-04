'use client';
import React, { useEffect, useMemo } from 'react';
import type { ModelInputs, ModelResults } from './types';
import { buildTrace } from './trace';
import { Btn, G, T, td, tdNum, th } from './ui';

/**
 * Full-screen derivation overlay. Opened from the sticky header so it is
 * reachable from anywhere on the page without scrolling.
 */
export function ShowTheMath({ inputs, results, month, setMonth, open, onClose }: {
  inputs: ModelInputs; results: ModelResults;
  month: number; setMonth: (m: number) => void;
  open: boolean; onClose: () => void;
}) {
  const sections = useMemo(
    () => (open ? buildTrace(inputs, results, month) : []),
    [open, inputs, results, month],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Show the math"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        // toolkit.js's bar is fixed at the top of every page and sits above
        // this overlay, so opening at inset 0 clipped the modal's own header —
        // its title and the MONTH control disappeared behind the bar. Start
        // below the bar instead, and give back the height that costs.
        padding: 'calc(var(--ft-toolkit-height, 0px) + 2vh) 16px 2vh',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.bg, borderRadius: 16, width: 'min(1180px, 100%)',
          maxHeight: 'calc(96vh - var(--ft-toolkit-height, 0px))',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', boxShadow: '0 30px 80px rgba(15,23,42,.45)',
        }}
      >
        <header style={{
          background: G.header, color: '#fff', padding: '14px 18px',
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', flex: '0 0 auto',
        }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.2px' }}>
              Show the math — every number, derived
            </div>
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.62)', marginTop: 2 }}>
              Labor sets the hours · hours set the volume · volume sets revenue and cost · the difference is cash
            </div>
          </div>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 10,
            fontWeight: 800, letterSpacing: 0.6, color: 'rgba(255,255,255,.72)',
          }}>
            MONTH
            <input
              type="number" min={1} max={results.months.length} value={month}
              onChange={(e) => setMonth(Math.min(results.months.length, Math.max(1, Number(e.target.value))))}
              style={{
                width: 64, padding: '6px 8px', borderRadius: 8, fontFamily: T.mono, fontSize: 14,
                border: '1px solid rgba(255,255,255,.22)', background: 'rgba(255,255,255,.12)',
                color: '#fff', fontWeight: 700,
              }}
            />
          </label>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 34, height: 34, borderRadius: 10, cursor: 'pointer', fontSize: 19,
              border: '1px solid rgba(255,255,255,.22)', background: 'rgba(255,255,255,.12)',
              color: '#fff', lineHeight: 1, flex: '0 0 auto',
            }}
          >×</button>
        </header>

        <div style={{ overflowY: 'auto', padding: '4px 18px 22px', background: T.shell }}>
          {sections.map((s) => (
            <div key={s.id} style={{ marginTop: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.ink }}>{s.title}</div>
              <div style={{ fontSize: 11.5, color: T.muted, margin: '3px 0 9px', maxWidth: 900 }}>{s.intro}</div>
              <div style={{
                overflowX: 'auto', border: `1px solid ${T.line}`, borderRadius: 10, background: T.bg,
              }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900 }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, width: 128 }}>Step</th>
                      <th style={{ ...th, width: 225 }}>What it is</th>
                      <th style={th}>Formula</th>
                      <th style={th}>Values used</th>
                      <th style={{ ...th, textAlign: 'right', width: 130 }}>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.rows.map((r, i) => (
                      <React.Fragment key={i}>
                        <tr>
                          <td style={{ ...td, fontWeight: 700, color: T.brandDark, fontSize: 11 }}>{r.step}</td>
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
                              paddingTop: 0, paddingBottom: 9, borderBottom: `1px solid ${T.lineSoft}`,
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
          <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
            <Btn onClick={onClose}>Close</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
