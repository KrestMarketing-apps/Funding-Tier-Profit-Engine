'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { BackendKey } from './types';
import { BRANDS } from './config';

// ── Design tokens — Funding Tier ─────────────────────────────────────────────
//
// Brand values are the ones already in use across the Funding Tier apps:
// teal #0f9d8a, deep teal #0b7d6e, and the navy→teal header gradient.
//
// The three servicing-partner accents are a categorical set. They were checked
// with the palette validator (lightness band, chroma floor, colour-vision
// separation, normal-vision floor, contrast) and pass on all counts:
//   #0f9d8a ↔ #1a6ed8 ↔ #d97706 — worst adjacent pair ΔE 19.9 (protan).
// The previous blue/purple pairing failed CVD separation at ΔE 5.0.
export const T = {
  // brand
  brand: '#0f9d8a', brandDark: '#0b7d6e', brandDeep: '#0f766e',
  brandSoft: '#e6f7f4', brandLine: '#99e5da',
  navy: '#0f172a', navyMid: '#0b3b50',

  // ink
  ink: '#0f172a', body: '#334155', muted: '#64748b', faint: '#94a3b8',

  // surfaces
  line: '#e2e8f0', lineSoft: '#f1f5f9', bg: '#ffffff', panel: '#f8fafc',
  shell: '#f1f5f9',

  // status — reserved, never reused as a series colour
  accent: '#0b7d6e', warn: '#b45309', warnBg: '#fffbeb', warnLine: '#fde68a',
  bad: '#b91c1c', badBg: '#fef2f2', good: '#15803d', goodBg: '#f0fdf4',

  radius: 12,
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

export const G = {
  header: `linear-gradient(135deg, ${T.navy} 0%, ${T.navyMid} 45%, ${T.brandDeep} 100%)`,
  brand: `linear-gradient(135deg, ${T.brand} 0%, ${T.brandDark} 100%)`,
  tile: 'linear-gradient(180deg, #ffffff 0%, #fbfdfd 100%)',
  panel: 'linear-gradient(180deg, #ffffff 0%, #fcfdfd 100%)',
  rule: `linear-gradient(90deg, ${T.brand} 0%, rgba(15,157,138,0) 100%)`,
  shell: 'linear-gradient(180deg, #f1f5f9 0%, #eef4f5 100%)',
};

export const FT_LOGO =
  'https://assets.cdn.filesafe.space/S4ztIlDxBovAboldwbOR/media/68783cf82035bab4d790ae7e.png';

export const fmtMoney = (n: number) =>
  (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
export const fmtMoney2 = (n: number) =>
  (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtNum = (n: number, d = 0) =>
  n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtPct = (n: number, d = 1) => `${n.toFixed(d)}%`;

// ── Tooltip ──────────────────────────────────────────────────────────────────
//
// Rendered into a portal with fixed positioning so it can never be clipped by a
// panel's overflow or by the top of the viewport, and so it cannot inherit the
// uppercase / letter-spaced styling of the label it sits inside.
const TIP_W = 330;

export function Info({ text, label }: { text: string; label?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [box, setBox] = useState<{ left: number; top: number; below: boolean } | null>(null);

  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const M = 10;
    const left = Math.max(M, Math.min(
      r.left + r.width / 2 - TIP_W / 2,
      window.innerWidth - TIP_W - M,
    ));
    // Flip below when there is not enough room above (top rows, sticky header).
    const below = r.top < 210;
    setBox({ left, top: below ? r.bottom + 9 : r.top - 9, below });
  }, []);

  useEffect(() => {
    if (!box) return;
    const hide = () => setBox(null);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [box]);

  return (
    <>
      <span
        ref={ref}
        tabIndex={0}
        aria-label={label ?? 'Explain this number'}
        onMouseEnter={place}
        onMouseLeave={() => setBox(null)}
        onFocus={place}
        onBlur={() => setBox(null)}
        style={{
          width: 14, height: 14, minWidth: 14, borderRadius: '50%',
          background: T.brandSoft, border: `1px solid ${T.brandLine}`, color: T.brandDark,
          fontSize: 9.5, lineHeight: '12px', textAlign: 'center', cursor: 'help',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, userSelect: 'none', marginLeft: 5, flex: '0 0 auto',
          textTransform: 'none', letterSpacing: 0, verticalAlign: 'middle',
        }}
      >?</span>
      {box && typeof document !== 'undefined' && createPortal(
        <div
          role="tooltip"
          style={{
            position: 'fixed', left: box.left, top: box.top, width: TIP_W,
            transform: box.below ? 'none' : 'translateY(-100%)',
            background: T.navy, color: '#fff', padding: '10px 12px',
            borderRadius: 10, zIndex: 4000, pointerEvents: 'none',
            boxShadow: '0 14px 38px rgba(15,23,42,.32)',
            border: '1px solid rgba(255,255,255,.08)',
            // Hard reset: the anchor often lives inside an uppercase, letter-spaced label.
            fontFamily: T.sans, fontSize: 12, lineHeight: 1.6, fontWeight: 400,
            textTransform: 'none', letterSpacing: 'normal', textAlign: 'left',
            whiteSpace: 'normal', wordBreak: 'normal',
          }}
        >{text}</div>,
        document.body,
      )}
    </>
  );
}

// ── Section icons ────────────────────────────────────────────────────────────
//
// One stroked glyph per navigation item. Inline SVG rather than an icon
// dependency or emoji: it inherits currentColor, stays crisp at 16px, and adds
// nothing to the bundle.
export type IconName =
  | 'gauge' | 'trend' | 'users' | 'phone' | 'briefcase' | 'wallet' | 'receipt'
  | 'award' | 'shield' | 'ledger' | 'clipboard' | 'layers' | 'bars' | 'calendar'
  | 'card';

const ICONS: Record<IconName, React.ReactNode> = {
  gauge: <><path d="M3.5 15a8.5 8.5 0 0 1 17 0" /><path d="M12 15l4.2-4.2" /><circle cx="12" cy="15" r="1.3" /></>,
  trend: <><path d="M3 17.5l5.5-5.5 3.5 3.5L21 6.5" /><path d="M15.5 6.5H21v5.5" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" /><path d="M16.2 5.2a3.2 3.2 0 0 1 0 5.9" /><path d="M17.6 14.4A6.2 6.2 0 0 1 21.2 20" /></>,
  phone: <><path d="M21.5 16.9v2.7a2 2 0 0 1-2.2 2 19.6 19.6 0 0 1-8.5-3 19.3 19.3 0 0 1-6-6 19.6 19.6 0 0 1-3-8.6 2 2 0 0 1 2-2.2h2.7a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L9.6 9.4a16 16 0 0 0 6 6l1.2-1.1a2 2 0 0 1 2.1-.5c.8.3 1.7.6 2.6.7a2 2 0 0 1 1.7 2z" /></>,
  briefcase: <><rect x="2.8" y="7.5" width="18.4" height="12.7" rx="2" /><path d="M8.2 7.5V5.8a2 2 0 0 1 2-2h3.6a2 2 0 0 1 2 2v1.7" /><path d="M2.8 12.8h18.4" /></>,
  wallet: <><path d="M3 7.4A2.4 2.4 0 0 1 5.4 5h11.2v2.4" /><rect x="3" y="7.4" width="18" height="12.6" rx="2.2" /><path d="M21 11.6h-3.6a2.2 2.2 0 0 0 0 4.4H21" /></>,
  receipt: <><path d="M5.2 3.2h13.6v17.6l-2.7-1.6-2.6 1.6-2.5-1.6-2.6 1.6-3.2-1.6z" /><path d="M8.6 8.2h6.8" /><path d="M8.6 12.2h6.8" /></>,
  award: <><circle cx="12" cy="8.6" r="5.4" /><path d="M8.4 12.9L7.2 21l4.8-2.8 4.8 2.8-1.2-8.1" /></>,
  shield: <><path d="M12 3l8 2.9v5.8c0 4.8-3.3 8.1-8 9.3-4.7-1.2-8-4.5-8-9.3V5.9z" /><path d="M9.2 12.2l2 2 3.6-3.9" /></>,
  ledger: <><path d="M14 2.8H6.6a2 2 0 0 0-2 2v14.4a2 2 0 0 0 2 2h10.8a2 2 0 0 0 2-2V8.3z" /><path d="M14 2.8v5.5h5.4" /><path d="M8.6 13h6.8" /><path d="M8.6 16.6h4.6" /></>,
  clipboard: <><rect x="8.6" y="2.6" width="6.8" height="3.6" rx="1.2" /><path d="M15.4 4.4h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6.6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h2" /><path d="M8.4 11.6h7.2" /><path d="M8.4 15.4h4.8" /></>,
  layers: <><path d="M12 2.8l9 4.6-9 4.6-9-4.6z" /><path d="M3 12.4l9 4.6 9-4.6" /><path d="M3 16.9l9 4.6 9-4.6" /></>,
  bars: <><path d="M3 20.5h18" /><rect x="4.6" y="11" width="3.4" height="7" rx="1" /><rect x="10.3" y="6" width="3.4" height="12" rx="1" /><rect x="16" y="13.4" width="3.4" height="4.6" rx="1" /></>,
  calendar: <><rect x="3.2" y="5" width="17.6" height="16" rx="2" /><path d="M8.2 2.8v4" /><path d="M15.8 2.8v4" /><path d="M3.2 10.2h17.6" /></>,
  card: <><rect x="2.6" y="5.2" width="18.8" height="13.6" rx="2.2" /><path d="M2.6 10h18.8" /><path d="M6.4 14.8h3.4" /></>,
};

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false"
      style={{ display: 'block', flex: '0 0 auto' }}
    >{ICONS[name]}</svg>
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
// Panels are NOT accordions. The page shows one section at a time, chosen from
// the left menu, so everything inside the section you picked is visible — no
// collapsed panel to hunt for, and no panel that opens itself. `collapsible`
// stays available for anything that genuinely needs to fold, but it is off by
// default and nothing in the Operating Model turns it on.
export function Panel({ title, tooltip, subtitle, right, children, accent, defaultOpen = true, collapsible = false }: {
  title: React.ReactNode; tooltip?: string; subtitle?: string; right?: React.ReactNode;
  children: React.ReactNode; accent?: string; defaultOpen?: boolean; collapsible?: boolean;
}) {
  const [open, setOpen] = useState(collapsible ? defaultOpen : true);
  return (
    <section style={{
      border: `1px solid ${T.line}`, borderRadius: T.radius, background: G.panel,
      marginBottom: 14, overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(15,23,42,.04), 0 8px 24px -18px rgba(15,23,42,.28)',
    }}>
      {accent && <div style={{ height: 3, background: `linear-gradient(90deg, ${accent} 0%, ${accent}00 78%)` }} />}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px',
        borderBottom: open ? `1px solid ${T.lineSoft}` : 'none', background: 'transparent',
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
              border: `1px solid ${T.line}`, background: T.bg, width: 27, height: 27,
              borderRadius: 8, cursor: 'pointer', color: T.muted, fontSize: 15, lineHeight: 1,
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
    plain: { bg: T.bg, fg: T.body, bd: T.line, sh: 'none' },
    primary: { bg: G.brand, fg: '#fff', bd: 'transparent', sh: '0 2px 10px -2px rgba(15,157,138,.55)' },
    danger: { bg: T.bg, fg: T.bad, bd: '#fecaca', sh: 'none' },
  }[tone];
  return (
    <button
      onClick={onClick} title={title}
      style={{
        background: tones.bg, color: tones.fg, border: `1px solid ${tones.bd}`,
        boxShadow: tones.sh,
        borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontFamily: T.sans,
        padding: size === 'sm' ? '3px 8px' : '7px 13px', fontSize: size === 'sm' ? 11 : 12.5,
        lineHeight: 1.3, whiteSpace: 'nowrap',
      }}
    >{children}</button>
  );
}

export const th: React.CSSProperties = {
  textAlign: 'left', fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5,
  textTransform: 'uppercase', color: T.muted, padding: '8px 9px',
  borderBottom: `1px solid ${T.line}`, whiteSpace: 'nowrap',
  background: 'linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%)',
  position: 'sticky', top: 0, zIndex: 2,
};
export const td: React.CSSProperties = {
  padding: '6px 8px', fontSize: 12, color: T.body, borderBottom: `1px solid ${T.lineSoft}`,
  whiteSpace: 'nowrap',
};
export const tdNum: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: T.mono, fontVariantNumeric: 'tabular-nums' };
