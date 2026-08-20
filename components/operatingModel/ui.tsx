'use client';
import React, { useState, useRef, useEffect } from 'react';
import type { BackendKey } from './types';
import { BRANDS } from './config';

// ── Design tokens ────────────────────────────────────────────────────────────
export const T = {
  ink: '#0f172a', body: '#334155', muted: '#64748b', faint: '#94a3b8',
  line: '#e2e8f0', lineSoft: '#f1f5f9', bg: '#ffffff', panel: '#f8fafc',
  accent: '#0f766e', warn: '#b45309', warnBg: '#fffbeb', warnLine: '#fde68a',
  bad: '#b91c1c', badBg: '#fef2f2', good: '#15803d', goodBg: '#f0fdf4',
  radius: 10,
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif',
};

export const fmtMoney = (n: number) =>
  (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
export const fmtMoney2 = (n: number) =>
  (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtNum = (n: number, d = 0) =>
  n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtPct = (n: number, d = 1) => `${n.toFixed(d)}%`;

// ── Tooltip ──────────────────────────────────────────────────────────────────
export function Info({ text, label }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [flip, setFlip] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      setFlip(r.left > window.innerWidth - 340);
    }
  }, [open]);

  return (
    <span
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 5 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span
        tabIndex={0}
        aria-label={label ?? 'Explain this number'}
        style={{
          width: 14, height: 14, borderRadius: '50%', border: `1px solid ${T.faint}`,
          color: T.muted, fontSize: 9, lineHeight: '12px', textAlign: 'center',
          cursor: 'help', display: 'inline-block', fontWeight: 700, userSelect: 'none',
          background: T.bg,
        }}
      >?</span>
      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute', bottom: '150%', [flip ? 'right' : 'left']: -8,
            width: 320, background: T.ink, color: '#fff', padding: '9px 11px',
            borderRadius: 8, fontSize: 11.5, lineHeight: 1.5, zIndex: 90,
            boxShadow: '0 10px 30px rgba(15,23,42,.28)', fontWeight: 400,
            whiteSpace: 'normal', textAlign: 'left', fontFamily: T.sans,
          } as React.CSSProperties}
        >{text}</span>
      )}
    </span>
  );
}

// ── Partner logo badge ───────────────────────────────────────────────────────
export function PartnerMark({ k, size = 20 }: { k: BackendKey; size?: number }) {
  const b = BRANDS[k];
  const [broken, setBroken] = useState(false);

  if (b.logoUrl && !broken) {
    const aspect = b.logoAspect ?? 1;
    return (
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          height: size, width: size * aspect, flex: '0 0 auto',
          // Artwork that ships on a white plate gets a hairline so it does not
          // float on the panel background.
          background: b.logoHasWhitePlate ? '#fff' : 'transparent',
          border: b.logoHasWhitePlate ? `1px solid ${T.line}` : 'none',
          borderRadius: b.logoHasWhitePlate ? 4 : 0,
          overflow: 'hidden',
        }}
      >
        <img
          src={b.logoUrl} alt={b.legalName} onError={() => setBroken(true)}
          style={{ height: '100%', width: '100%', objectFit: 'contain', display: 'block' }}
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: b.monogram.length > 2 ? size * 1.5 : size, height: size,
        borderRadius: 5, background: b.accent, color: '#fff',
        fontSize: size * (b.monogram.length > 2 ? 0.42 : 0.48), fontWeight: 800,
        letterSpacing: 0.2, flex: '0 0 auto', fontFamily: T.sans,
      }}
    >{b.monogram}</span>
  );
}

export function PartnerName({ k, size = 20, sub, style }: {
  k: BackendKey; size?: number; sub?: boolean; style?: React.CSSProperties;
}) {
  const b = BRANDS[k];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, ...style }}>
      <PartnerMark k={k} size={size} />
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
        <span style={{ fontWeight: 650, color: T.ink }}>{b.name}</span>
        {sub && <span style={{ fontSize: 10, color: T.faint, fontWeight: 500 }}>{b.legalName}</span>}
      </span>
    </span>
  );
}

// ── Layout primitives ────────────────────────────────────────────────────────
export function Panel({ title, tooltip, subtitle, right, children, accent, defaultOpen = true, collapsible = true }: {
  title: React.ReactNode; tooltip?: string; subtitle?: string; right?: React.ReactNode;
  children: React.ReactNode; accent?: string; defaultOpen?: boolean; collapsible?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section style={{
      border: `1px solid ${T.line}`, borderRadius: T.radius, background: T.bg,
      marginBottom: 14, overflow: 'hidden',
      borderTop: accent ? `2px solid ${accent}` : `1px solid ${T.line}`,
    }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
        borderBottom: open ? `1px solid ${T.lineSoft}` : 'none', background: T.bg,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 13.5, fontWeight: 700, color: T.ink }}>
            {title}{tooltip && <Info text={tooltip} />}
          </div>
          {subtitle && <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{subtitle}</div>}
        </div>
        {right}
        {collapsible && (
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            style={{
              border: `1px solid ${T.line}`, background: T.bg, width: 26, height: 26,
              borderRadius: 6, cursor: 'pointer', color: T.muted, fontSize: 15, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto',
            }}
          >{open ? '−' : '+'}</button>
        )}
      </header>
      {open && <div style={{ padding: 14 }}>{children}</div>}
    </section>
  );
}

export function Field({ label, tooltip, children, hint, error }: {
  label: string; tooltip?: string; children: React.ReactNode; hint?: string; error?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
        color: T.muted, display: 'flex', alignItems: 'center',
      }}>
        {label}{tooltip && <Info text={tooltip} />}
      </span>
      {children}
      {hint && <span style={{ fontSize: 10, color: T.faint }}>{hint}</span>}
      {error && <span style={{ fontSize: 10, color: T.bad, fontWeight: 600 }}>{error}</span>}
    </label>
  );
}

export const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', border: `1px solid ${T.line}`, borderRadius: 6,
  fontSize: 13, fontFamily: T.mono, color: T.ink, background: T.bg, boxSizing: 'border-box',
};

export function NumberInput({ value, onChange, min, max, step = 1, prefix, suffix, invalid }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number;
  step?: number; prefix?: string; suffix?: string; invalid?: boolean;
}) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {prefix && <span style={{ fontSize: 12, color: T.faint }}>{prefix}</span>}
      <input
        type="number" value={Number.isFinite(value) ? value : 0}
        min={min} max={max} step={step}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        style={{ ...inputStyle, borderColor: invalid ? T.bad : T.line, background: invalid ? T.badBg : T.bg }}
      />
      {suffix && <span style={{ fontSize: 11, color: T.faint, whiteSpace: 'nowrap' }}>{suffix}</span>}
    </span>
  );
}

export function Row({ cols, gap = 12, children, style }: {
  cols: number | string; gap?: number; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: typeof cols === 'number' ? `repeat(${cols}, minmax(0, 1fr))` : cols,
      gap, alignItems: 'start', ...style,
    }}>{children}</div>
  );
}

export function Callout({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'bad' | 'good'; children: React.ReactNode }) {
  const map = {
    info: { bg: T.panel, line: T.line, fg: T.body },
    warn: { bg: T.warnBg, line: T.warnLine, fg: T.warn },
    bad: { bg: T.badBg, line: '#fecaca', fg: T.bad },
    good: { bg: T.goodBg, line: '#bbf7d0', fg: T.good },
  }[tone];
  return (
    <div style={{
      background: map.bg, border: `1px solid ${map.line}`, color: map.fg,
      borderRadius: 8, padding: '9px 11px', fontSize: 11.5, lineHeight: 1.55, marginTop: 10,
    }}>{children}</div>
  );
}

export function Btn({ onClick, children, tone = 'plain', size = 'md', title }: {
  onClick: () => void; children: React.ReactNode; tone?: 'plain' | 'primary' | 'danger';
  size?: 'sm' | 'md'; title?: string;
}) {
  const tones = {
    plain: { bg: T.bg, fg: T.body, bd: T.line },
    primary: { bg: T.accent, fg: '#fff', bd: T.accent },
    danger: { bg: T.bg, fg: T.bad, bd: '#fecaca' },
  }[tone];
  return (
    <button
      onClick={onClick} title={title}
      style={{
        background: tones.bg, color: tones.fg, border: `1px solid ${tones.bd}`,
        borderRadius: 6, cursor: 'pointer', fontWeight: 650, fontFamily: T.sans,
        padding: size === 'sm' ? '3px 8px' : '7px 13px', fontSize: size === 'sm' ? 11 : 12.5,
        lineHeight: 1.3, whiteSpace: 'nowrap',
      }}
    >{children}</button>
  );
}

export const th: React.CSSProperties = {
  textAlign: 'left', fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5,
  textTransform: 'uppercase', color: T.muted, padding: '7px 8px',
  borderBottom: `1px solid ${T.line}`, whiteSpace: 'nowrap', background: T.panel,
  position: 'sticky', top: 0, zIndex: 2,
};
export const td: React.CSSProperties = {
  padding: '6px 8px', fontSize: 12, color: T.body, borderBottom: `1px solid ${T.lineSoft}`,
  whiteSpace: 'nowrap',
};
export const tdNum: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: T.mono, fontVariantNumeric: 'tabular-nums' };
