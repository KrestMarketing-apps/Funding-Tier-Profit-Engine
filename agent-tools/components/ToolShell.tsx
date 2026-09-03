import { ReactNode } from "react";
import styles from "./ToolShell.module.css";

type Mode = "admin" | "agent";
type BadgeStyle = "admin" | "agent" | "wip";

interface ToolShellProps {
  /** Drives the accent color (green for admin, blue for agent) across icon, badge, metric accents, and left-edge on cards */
  mode: Mode;
  /**
   * Tool name. The top bar lives in toolkit.js (loaded from
   * ai.fundingtier.com on every Funding Tier page, in shadow DOM, already
   * role-aware) rather than here — two bars stacked was the alternative. This
   * is published as data-ft-tool so that bar can show the breadcrumb.
   */
  tool: string;
  /** Small label above the title, e.g. "ADMIN · BACKEND ROUTING" */
  eyebrow: string;
  /** Optional pill next to the eyebrow, e.g. { text: "ADMIN ONLY" } or { text: "WIP", style: "wip" } */
  badge?: { text: string; style?: BadgeStyle };
  title: string;
  subtitle: string;
  /** Metrics grid / control row / tab strip that sits inside the hero, under the subtitle */
  heroSlot?: ReactNode;
  /** Page body content below the hero */
  children?: ReactNode;
}

export default function ToolShell({
  mode,
  tool,
  eyebrow,
  badge,
  title,
  subtitle,
  heroSlot,
  children,
}: ToolShellProps) {
  return (
    <div className={styles.frame} data-ft-tool={tool}>
      {/* HERO — same shell, `mode` sets the accent color, `heroSlot` carries the page-specific content */}
      <div className={styles.hero} data-mode={mode}>
        <div className={styles.heroTop}>
          <div className={styles.eyebrow}>
            <div className={styles.eyebrowIcon}>◆</div>
            <span className={styles.eyebrowText}>{eyebrow}</span>
          </div>
          {badge && (
            <span className={`${styles.badge} ${styles[badge.style ?? mode]}`}>
              {badge.text}
            </span>
          )}
        </div>
        <h1 className={styles.heroTitle}>{title}</h1>
        <p className={styles.heroSub}>{subtitle}</p>
        {heroSlot && <div className={styles.slot}>{heroSlot}</div>}
      </div>

      {/* BODY — existing page content, unchanged */}
      <div className={styles.bodyContent}>{children}</div>
    </div>
  );
}

/**
 * Optional helper components for the three hero-slot patterns seen across the tools.
 * Not required — heroSlot accepts any ReactNode — but these keep markup consistent.
 */
export function MetricsGrid({ children }: { children: ReactNode }) {
  return <div className={styles.metricsGrid}>{children}</div>;
}

export function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={styles.metricCard}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={`${styles.metricValue} ${accent ? styles.accent : ""}`}>{value}</div>
    </div>
  );
}

export function ControlRow({ children, result }: { children: ReactNode; result?: { label: string; value: string } }) {
  return (
    <div className={styles.controlRow}>
      {children}
      {result && (
        <div className={styles.controlResult}>
          <div className={styles.metricLabel}>{result.label}</div>
          <div className={`${styles.metricValue} ${styles.accent}`}>{result.value}</div>
        </div>
      )}
    </div>
  );
}

export function Control({
  label, value, onChange, type = "text", min, max, step, hint,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  /** Pages with numeric inputs should keep them numeric — steppers and all. */
  type?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Small note under the field, e.g. an eligibility warning. */
  hint?: ReactNode;
}) {
  return (
    <div className={styles.control}>
      <label>{label}</label>
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange?.(e.target.value)}
      />
      {hint}
    </div>
  );
}

export function TabStrip({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className={styles.tabstrip}>
      {tabs.map((t) => (
        <button key={t} className={t === active ? styles.active : ""} onClick={() => onChange(t)}>
          {t}
        </button>
      ))}
    </div>
  );
}
