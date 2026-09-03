import { ReactNode } from "react";
import styles from "./ToolShell.module.css";

type Mode = "admin" | "agent";
type BadgeStyle = "admin" | "agent" | "wip";

interface ToolShellProps {
  /** Drives the accent color (green for admin, blue for agent) across icon, badge, metric accents, and left-edge on cards */
  mode: Mode;
  /** Shown in the top bar breadcrumb, e.g. "Profit Engine" */
  tool: string;
  /** Small label above the title, e.g. "ADMIN · BACKEND ROUTING" */
  eyebrow: string;
  /** Optional pill next to the eyebrow, e.g. { text: "ADMIN ONLY" } or { text: "WIP", style: "wip" } */
  badge?: { text: string; style?: BadgeStyle };
  title: string;
  subtitle: string;
  toolsHref?: string;
  crmHref?: string;
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
  toolsHref = "/agent-tools",
  crmHref = "https://app.gohighlevel.com",
  heroSlot,
  children,
}: ToolShellProps) {
  return (
    <div className={styles.frame}>
      {/* TOP BAR — identical on every page, no page-specific props except `tool` */}
      <div className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <div className={styles.ftLogo}>
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9.5" stroke="#0b1622" strokeWidth="2.2" />
              <path d="M12 2.5V12L18 15.5" stroke="#0b1622" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </div>
          <span className={styles.topbarTitle}>Funding Tier Tools</span>
          <span className={styles.topbarSep}>/</span>
          <span className={styles.topbarTool}>{tool}</span>
        </div>
        <div className={styles.topbarRight}>
          <a className={styles.pillBtn} href={toolsHref}>Tools ⌄</a>
          <a className={styles.pillBtn} href={crmHref} target="_blank" rel="noreferrer">CRM ↗</a>
          <div className={styles.avatar}>NP</div>
        </div>
      </div>

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

export function Control({ label, value, onChange }: { label: string; value: string; onChange?: (v: string) => void }) {
  return (
    <div className={styles.control}>
      <label>{label}</label>
      <input value={value} onChange={(e) => onChange?.(e.target.value)} />
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
