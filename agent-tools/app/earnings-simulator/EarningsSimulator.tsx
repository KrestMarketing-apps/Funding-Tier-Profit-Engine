"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import ToolShell, { Metric, MetricsGrid } from "../../components/ToolShell";
import {
  DEFAULT_EARNINGS_INPUTS, simulateEarnings, firstPaymentTimeline, scheduledPayDate,
  SHIELD_PROGRAMS, ELP_BANDS, LEVEL_TIERS, MONTHLY_VOLUME_BONUS, DAILY_DEAL_BONUS, BALANCED_BOOK, LEVEL_ENROLLMENT_BONUS,
  PROGRAMS, POLICY, PAY_RULES_VERSION, WORK_DAYS_PER_MONTH,
  type EarningsInputs, type ProgramKey,
} from "../../lib/payRules";

const G = "#0f9d8a", GD = "#0b7d6e", DARK = "#0f172a", BLUE = "#1a6ed8", AMBER = "#b45309", RED = "#b91c1c", PURPLE = "#7c3aed";
const BORDER = "#e2e8f0", MUTED = "#64748b", BG = "#f8fafc";

const usd = (n: number, dp = 0) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: dp }).format(n);
const num = (n: number, dp = 1) => n.toLocaleString("en-US", { maximumFractionDigits: dp, minimumFractionDigits: 0 });
const pct = (n: number) => `${Math.round(n * 100)}%`;
const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const dayY = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ── Small UI pieces ────────────────────────────────────────────────────────

function Card({ title, sub, accent = G, children, style, right }: { title: string; sub?: string; accent?: string; children: React.ReactNode; style?: React.CSSProperties; right?: React.ReactNode }) {
  return (
    <section style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, borderLeft: `4px solid ${accent}`, ...style }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 16, color: DARK }}>{title}</div>
          {sub && <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>{sub}</div>}
        </div>
        {right}
      </div>
      <div style={{ height: 12 }} />
      {children}
    </section>
  );
}

/** Number box with a unit. `scale` converts between the stored value and the displayed one (0.15 ↔ 15). */
function NumberField({ label, value, min, max, step, unit, onChange, help, scale = 1, dp = 0 }: {
  label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void; help?: string; scale?: number; dp?: number;
}) {
  const shown = +(value * scale).toFixed(dp + 2);
  const [draft, setDraft] = useState<string>(String(shown));
  useEffect(() => { setDraft(String(shown)); }, [shown]);
  const commit = () => {
    const n = Number(draft);
    if (!Number.isFinite(n)) { setDraft(String(shown)); return; }
    onChange(clamp(n, min, max) / scale);
  };
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: DARK }}>{label}</span>
        <span style={{ display: "inline-flex", alignItems: "center", border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden", background: "#fff" }}>
          <input type="number" value={draft} min={min} max={max} step={step}
            onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            style={{ width: 84, padding: "7px 8px", border: "none", outline: "none", fontWeight: 900, fontSize: 15, color: GD, textAlign: "right", fontVariantNumeric: "tabular-nums", background: "transparent" }} />
          {unit && <span style={{ padding: "0 9px 0 4px", fontSize: 12, fontWeight: 800, color: MUTED, background: BG, alignSelf: "stretch", display: "flex", alignItems: "center", borderLeft: `1px solid ${BORDER}` }}>{unit}</span>}
        </span>
      </div>
      {help && <div style={{ fontSize: 11, color: MUTED, marginTop: 3, lineHeight: 1.4 }}>{help}</div>}
    </label>
  );
}

function Row({ label, value, sub, strong, color }: { label: string; value: string; sub?: string; strong?: boolean; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div>
        <div style={{ fontWeight: strong ? 900 : 600, fontSize: strong ? 15 : 13, color: DARK }}>{label}</div>
        {sub && <div style={{ fontSize: 11.5, color: MUTED, marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ fontWeight: 900, fontSize: strong ? 18 : 14, color: color ?? DARK, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function Pill({ children, color = G }: { children: React.ReactNode; color?: string }) {
  return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: color + "18", color, border: `1px solid ${color}44` }}>{children}</span>;
}

/** Left-to-right process: boxes joined by arrows. */
function Flow({ steps }: { steps: { label: string; value: string; color: string; sub?: string }[] }) {
  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 0, overflowX: "auto", paddingBottom: 4 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 150 }}>
          <div style={{ flex: 1, background: BG, border: `1px solid ${BORDER}`, borderTop: `3px solid ${s.color}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 11, color: MUTED, fontWeight: 700 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color, fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
            {s.sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{s.sub}</div>}
          </div>
          {i < steps.length - 1 && <div style={{ padding: "0 6px", color: "#94a3b8", fontSize: 18, fontWeight: 900 }}>→</div>}
        </div>
      ))}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function EarningsSimulator({ mode }: { mode: "admin" | "agent" }) {
  const [inp, setInp] = useState<EarningsInputs>(DEFAULT_EARNINGS_INPUTS);
  const set = <K extends keyof EarningsInputs>(k: K, v: EarningsInputs[K]) => setInp((s) => ({ ...s, [k]: v }));
  const setMix = (k: "SHIELD" | "ELP" | "LEVEL", v: number) => setInp((s) => ({ ...s, mix: { ...s.mix, [k]: v } }));
  const setDebt = (k: "SHIELD" | "ELP" | "LEVEL", v: number) => setInp((s) => ({ ...s, avgDebt: { ...s.avgDebt, [k]: v } }));

  const r = useMemo(() => simulateEarnings(inp), [inp]);

  // Pay-timing what-if
  const [tlProgram, setTlProgram] = useState<ProgramKey>("SHIELD");
  const [tlDay, setTlDay] = useState(5);
  const [tlNsf, setTlNsf] = useState(true);
  const [tlRedraft, setTlRedraft] = useState(14);
  const [tlSplit, setTlSplit] = useState(false);
  const tl = useMemo(() => {
    const now = new Date();
    const sched = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, tlDay));
    return firstPaymentTimeline(tlProgram, sched, { nsf: tlNsf, nsfDays: 3, redraftDays: tlRedraft, split: tlSplit, splitGapDays: 14 });
  }, [tlProgram, tlDay, tlNsf, tlRedraft, tlSplit]);

  const mixTotal = inp.mix.SHIELD + inp.mix.ELP + inp.mix.LEVEL;
  const mixWarn = inp.clearedOnAllPrograms && Math.abs(mixTotal - 1) > 0.01;

  // Sticky inputs sit under the sticky hero: measure the hero so the offset is exact.
  const [stickyTop, setStickyTop] = useState(140);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const calc = () => {
      const hero = document.querySelector<HTMLElement>("[data-ft-hero]");
      const tk = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ft-toolkit-height")) || 0;
      // The hero is sticky at `tk`, so the inputs must start below tk + hero height.
      setStickyTop(tk + (hero?.getBoundingClientRect().height ?? 120) + 18);
    };
    calc();
    window.addEventListener("resize", calc);
    const t = setInterval(calc, 1500); // toolkit mounts late; settle after it does
    setTimeout(() => clearInterval(t), 8000);
    return () => { window.removeEventListener("resize", calc); clearInterval(t); };
  }, []);

  const tlColor = (kind: string) => kind === "nsf" ? RED : kind === "scheduled" ? MUTED : kind === "half_cleared" ? BLUE : GD;
  const timelineSteps = [
    ...tl.events.map((e) => ({ date: e.date, label: e.label, color: tlColor(e.kind), strong: false })),
    { date: tl.payDate, label: "You are paid", color: DARK, strong: true },
  ];

  return (
    <ToolShell
      mode={mode}
      tool="Earnings Simulator"
      compact
      sticky
      eyebrow={mode === "admin" ? "ADMIN · AGENT TOOLS" : "AGENT TOOLS"}
      badge={{ text: `PAY RULES ${PAY_RULES_VERSION}` }}
      title="What Could You Make?"
      subtitle="Set your hours, qualified calls and close rate. The simulator applies the published commission and bonus rules."
      heroSlot={
        <MetricsGrid>
          <Metric label="Per month" value={usd(r.monthlyTotal)} accent />
          <Metric label="Per year" value={usd(r.annualTotal)} />
          <Metric label="Per hour worked" value={usd(r.perHour, 2)} />
          <Metric label="Paid deals / month" value={num(r.paidDealsPerMonth)} />
        </MetricsGrid>
      }
    >
      <div ref={bodyRef} className="es-grid" style={{ display: "grid", gridTemplateColumns: "minmax(300px, 360px) minmax(0, 1fr)", gap: 18, alignItems: "start" }}>

        {/* ── Inputs (sticky) ── */}
        <div className="es-side" style={{ display: "grid", gap: 16, alignContent: "start", position: "sticky", top: stickyTop, maxHeight: `calc(100vh - ${stickyTop + 16}px)`, overflowY: "auto", paddingRight: 2 }}>
          <Card title="Your Activity" sub="Realistic numbers beat optimistic ones. Start with what a trained rep does in a normal week.">
            <NumberField label="Hours per week" value={inp.hoursPerWeek} min={5} max={70} step={1} unit="hrs" onChange={(v) => set("hoursPerWeek", v)} />
            <NumberField label="Qualified calls per hour" value={inp.qualifiedCallsPerHour} min={0.25} max={6} step={0.25} unit="calls" dp={2} onChange={(v) => set("qualifiedCallsPerHour", v)}
              help="Live transfers or inbound calls that reach a real pitch. Not dials." />
            <NumberField label="Close rate" value={inp.closeRate} min={1} max={60} step={1} unit="%" scale={100} onChange={(v) => set("closeRate", v)}
              help="Share of qualified calls that enroll. New reps: 8 to 12%. Strong reps: 15%+." />
            <NumberField label="First payment clears" value={1 - inp.firstPaymentFallout} min={10} max={100} step={5} unit="%" scale={100} onChange={(v) => set("firstPaymentFallout", 1 - v)}
              help="Share of enrollments whose first program payment clears. Commission is earned on these only. Plan on 50 to 60%." />
            <NumberField label="Second payment clears" value={inp.secondPaymentClears} min={50} max={100} step={5} unit="%" scale={100} onChange={(v) => set("secondPaymentClears", v)}
              help="Share of paid deals whose second payment clears. Drives the Monthly Volume Bonus and makes Level Debt commission final." />
          </Card>

          <Card title="Your Programs" accent={BLUE} sub="Shield Services is the primary program. The others unlock once you are trained and cleared on their enrollment systems.">
            <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: inp.clearedOnAllPrograms ? BLUE + "12" : BG, border: `1px solid ${inp.clearedOnAllPrograms ? BLUE + "55" : BORDER}`, marginBottom: 14, cursor: "pointer" }}>
              <input type="checkbox" checked={inp.clearedOnAllPrograms} onChange={(e) => set("clearedOnAllPrograms", e.target.checked)} style={{ accentColor: BLUE, width: 18, height: 18 }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 13, color: DARK }}>Cleared on Debt Resolution and Level Debt</div>
                <div style={{ fontSize: 11.5, color: MUTED }}>{inp.clearedOnAllPrograms ? "Full program mix and Balanced Book Bonus available." : "Shield Services only (first 30 to 60 days)."}</div>
              </div>
            </label>

            {inp.clearedOnAllPrograms && (
              <>
                <div style={{ fontWeight: 800, fontSize: 12, color: MUTED, letterSpacing: 0.4, marginBottom: 6 }}>PROGRAM MIX OF YOUR DEALS</div>
                <NumberField label="Shield Services" value={inp.mix.SHIELD} min={0} max={100} step={5} unit="%" scale={100} onChange={(v) => setMix("SHIELD", v)} />
                <NumberField label="Debt Resolution" value={inp.mix.ELP} min={0} max={100} step={5} unit="%" scale={100} onChange={(v) => setMix("ELP", v)} />
                <NumberField label="Level Debt" value={inp.mix.LEVEL} min={0} max={100} step={5} unit="%" scale={100} onChange={(v) => setMix("LEVEL", v)} />
                {mixWarn && <div style={{ fontSize: 12, color: AMBER, fontWeight: 700, marginBottom: 10 }}>Mix adds to {pct(mixTotal)}; it is scaled to 100% in the math.</div>}
              </>
            )}

            <div style={{ fontWeight: 800, fontSize: 12, color: MUTED, letterSpacing: 0.4, margin: "6px 0" }}>AVERAGE ENROLLED DEBT</div>
            <NumberField label="Shield Services deal" value={inp.avgDebt.SHIELD} min={4000} max={60000} step={500} unit="$" onChange={(v) => setDebt("SHIELD", v)} help={r.byProgram.SHIELD.basis} />
            {inp.clearedOnAllPrograms && inp.mix.ELP > 0 && <NumberField label="Debt Resolution deal" value={inp.avgDebt.ELP} min={6000} max={60000} step={500} unit="$" onChange={(v) => setDebt("ELP", v)} help={r.byProgram.ELP.basis} />}
            {inp.clearedOnAllPrograms && inp.mix.LEVEL > 0 && <NumberField label="Level Debt deal" value={inp.avgDebt.LEVEL} min={7000} max={80000} step={500} unit="$" onChange={(v) => setDebt("LEVEL", v)} help={r.byProgram.LEVEL.basis} />}
          </Card>
        </div>

        {/* ── Results ── */}
        <div style={{ display: "grid", gap: 16, alignContent: "start", minWidth: 0 }}>

          <Card title="How A Month Breaks Down" sub="Hours in, paid deals out. Each step applies one of your inputs.">
            <Flow steps={[
              { label: "Hours worked", value: num(r.hoursPerMonth, 0), color: MUTED, sub: `${inp.hoursPerWeek} hrs × 4.33 weeks` },
              { label: "Qualified calls", value: num(r.qualifiedCallsPerMonth, 0), color: MUTED, sub: `${num(inp.qualifiedCallsPerHour, 2)} per hour` },
              { label: "Enrollments", value: num(r.enrollmentsPerMonth), color: BLUE, sub: `${pct(inp.closeRate)} close rate` },
              { label: "Lost before 1st payment", value: `−${num(r.lostToFallout)}`, color: RED, sub: `${pct(inp.firstPaymentFallout)} never clear` },
              { label: "Paid deals", value: num(r.paidDealsPerMonth), color: GD, sub: `${pct(1 - inp.firstPaymentFallout)} first payment clears` },
            ]} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 16 }} className="es-two">
              <div>
                <div style={{ fontWeight: 800, fontSize: 12, color: MUTED, letterSpacing: 0.4, marginBottom: 2 }}>COMMISSION</div>
                {r.byProgram.SHIELD.deals > 0 && <Row label="Shield Services" sub={`${num(r.byProgram.SHIELD.deals)} deals × ${usd(r.byProgram.SHIELD.perDeal)} · ${r.byProgram.SHIELD.basis}`} value={usd(r.byProgram.SHIELD.commission)} />}
                {r.byProgram.ELP.deals > 0 && <Row label="Debt Resolution" sub={`${num(r.byProgram.ELP.deals)} deals × ${usd(r.byProgram.ELP.perDeal)} · ${r.byProgram.ELP.basis}`} value={usd(r.byProgram.ELP.commission)} />}
                {r.byProgram.LEVEL.deals > 0 && <Row label="Level Debt" sub={`${num(r.byProgram.LEVEL.deals)} deals · ${usd(r.levelMonthlyVolume)} enrolled this month · ${r.levelTier.label} (${(r.levelTier.rate * 100).toFixed(2)}%)`} value={usd(r.byProgram.LEVEL.commission)} />}
                <Row label="Commission total" value={usd(r.commissionTotal)} strong color={GD} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 12, color: MUTED, letterSpacing: 0.4, marginBottom: 2 }}>BONUSES AND SPIFFS</div>
                <Row label="Daily Deal Bonus" sub={r.dailyBonusNote} value={usd(r.dailyBonus)} color={r.dailyBonus > 0 ? AMBER : MUTED} />
                <Row label="Monthly Volume Bonus"
                  sub={r.monthlyBonusNext ? `${num(r.pooledDealsP2)} pooled deals with 2nd payment cleared. ${r.monthlyBonusNext.minDeals} unlocks ${usd(r.monthlyBonusNext.bonus)}.` : `${num(r.pooledDealsP2)} pooled deals with 2nd payment cleared — top tier.`}
                  value={usd(r.monthlyBonus)} color={r.monthlyBonus > 0 ? AMBER : MUTED} />
                <Row label="Balanced Book Bonus" sub={r.balancedBook.reason} value={usd(r.balancedBook.bonus)} color={r.balancedBook.bonus > 0 ? PURPLE : MUTED} />
                {inp.clearedOnAllPrograms && <Row label="Level Debt Enrollment Bonus" sub={`${usd(r.levelMonthlyVolume / WORK_DAYS_PER_MONTH)} Level Debt enrolled per day on average; pays at $75,000 and $100,000 a day.`} value={usd(r.levelEnrollment)} color={r.levelEnrollment > 0 ? PURPLE : MUTED} />}
                <Row label="Bonus total" value={usd(r.bonusTotal)} strong color={AMBER} />
              </div>
            </div>

            <div style={{ marginTop: 14, padding: 14, borderRadius: 12, background: DARK, color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 700 }}>ESTIMATED MONTHLY EARNINGS</div>
                <div style={{ fontSize: 30, fontWeight: 900 }}>{usd(r.monthlyTotal)}</div>
              </div>
              <div style={{ textAlign: "right", fontSize: 13, opacity: 0.9 }}>
                <div>{usd(r.annualTotal)} a year</div>
                <div>{usd(r.perHour, 2)} an hour · {usd(r.perQualifiedCall, 2)} per qualified call</div>
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: MUTED, marginTop: 8 }}>
              Estimates only. Commission is paid per deal after the first program payment clears and the program provider pays Funding Tier. {POLICY.provisional} {POLICY.dispute}
            </div>
          </Card>

          <Card title="Revenue / Payout Timeline (Estimated)" accent={AMBER}
            sub="You are paid on a deal after the client's first program payment clears and the provider has paid Funding Tier. Change the scenario to see how the date moves."
            right={<Pill color={tl.slipDays > 0 ? AMBER : G}>{tl.slipDays > 0 ? `Pay date slips ${tl.slipDays} days` : "On schedule"}</Pill>}>

            {/* Scenario controls in one row */}
            <div className="es-controls" style={{ display: "grid", gridTemplateColumns: "minmax(160px,1fr) minmax(140px,180px) auto auto", gap: 14, alignItems: "end", marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: MUTED }}>PROGRAM
                <select value={tlProgram} onChange={(e) => setTlProgram(e.target.value as ProgramKey)} style={{ display: "block", width: "100%", marginTop: 4, padding: 8, borderRadius: 8, border: `1px solid ${BORDER}`, fontWeight: 700, color: DARK, background: "#fff" }}>
                  <option value="SHIELD">Shield Services</option>
                  <option value="ELP">Debt Resolution</option>
                  <option value="LEVEL">Level Debt</option>
                </select>
              </label>
              <label style={{ fontSize: 12, fontWeight: 800, color: MUTED }}>FIRST DRAFT ON DAY
                <input type="number" min={1} max={28} value={tlDay} onChange={(e) => setTlDay(clamp(Number(e.target.value) || 1, 1, 28))} style={{ display: "block", width: "100%", marginTop: 4, padding: 8, borderRadius: 8, border: `1px solid ${BORDER}`, fontWeight: 800, color: GD }} />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", paddingBottom: 8 }}>
                <input type="checkbox" checked={tlSplit} onChange={(e) => setTlSplit(e.target.checked)} style={{ accentColor: BLUE, width: 18, height: 18 }} />
                <span style={{ fontWeight: 800, fontSize: 13, color: DARK }}>Split plan (twice a month)</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", paddingBottom: 8 }}>
                <input type="checkbox" checked={tlNsf} onChange={(e) => setTlNsf(e.target.checked)} style={{ accentColor: RED, width: 18, height: 18 }} />
                <span style={{ fontWeight: 800, fontSize: 13, color: DARK }}>{tlSplit ? "First half returns NSF" : "First draft returns NSF"}</span>
              </label>
            </div>
            {tlNsf && (
              <div style={{ maxWidth: 360, marginBottom: 12 }}>
                <NumberField label="Days until the re-draft clears" value={tlRedraft} min={3} max={45} step={1} unit="days" onChange={setTlRedraft} help="Most providers re-present within 7 to 14 days. Some clients ask to move it to their next payday." />
              </div>
            )}
            {tlSplit && <div style={{ fontSize: 12.5, color: DARK, background: BLUE + "10", border: `1px solid ${BLUE}44`, borderRadius: 8, padding: "8px 10px", marginBottom: 12 }}><strong>Split plan:</strong> a program payment is one month of the plan. Half a month clearing is not a first program payment. Nothing is owed, and the pay clock does not start, until the second half clears.</div>}

            {/* Left-to-right process illustration */}
            <div style={{ overflowX: "auto", paddingBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "flex-start", minWidth: timelineSteps.length * 170 }}>
                {timelineSteps.map((s, i) => {
                  const last = i === timelineSteps.length - 1;
                  return (
                    <div key={i} style={{ flex: 1, minWidth: 150, position: "relative" }}>
                      {/* connector */}
                      {!last && <div style={{ position: "absolute", top: 29, left: "50%", right: "-50%", height: 3, background: `linear-gradient(90deg, ${s.color}, ${timelineSteps[i + 1].color})`, opacity: 0.55 }} />}
                      <div style={{ textAlign: "center", padding: "0 8px" }}>
                        <div style={{ fontSize: 11.5, fontWeight: 800, color: MUTED, height: 18 }}>{day(s.date)}</div>
                        <div style={{ position: "relative", zIndex: 1, width: 22, height: 22, borderRadius: 999, margin: "0 auto", background: s.strong ? DARK : "#fff", border: `4px solid ${s.color}`, boxShadow: "0 0 0 3px #fff" }} />
                        <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 10, background: s.strong ? DARK : BG, border: `1px solid ${s.strong ? DARK : BORDER}`, borderTop: `3px solid ${s.color}`, minHeight: 58 }}>
                          <div style={{ fontSize: s.strong ? 14 : 12.5, fontWeight: s.strong ? 900 : 700, color: s.strong ? "#fff" : s.color, lineHeight: 1.3 }}>{s.label}</div>
                          {s.strong && <div style={{ fontSize: 11, color: "rgba(255,255,255,.75)", marginTop: 3 }}>{PROGRAMS[tlProgram].timing}</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: tl.slipDays > 0 ? "#fff7ed" : "#f0fdf4", border: `1px solid ${tl.slipDays > 0 ? "#fdba74" : "#86efac"}`, fontSize: 13, color: DARK }}>
              {tl.slipDays > 0
                ? <><strong>Pay date moves {tl.slipDays} days later</strong> (from {dayY(tl.onTimePayDate)} to {dayY(tl.payDate)}). {tlSplit ? "The first half never counted on its own, and the NSF pushed it; program payment 1 was complete only when the second half cleared, and the pay schedule runs from that date." : "The NSF draft never counts; the re-draft's clear date is program payment 1, and the pay schedule runs from that date."}</>
                : tlSplit && !tlNsf
                  ? <><strong>Both halves cleared on schedule.</strong> Program payment 1 completed {dayY(tl.clearedAt)} when the second half cleared; you are paid {dayY(tl.payDate)}. The first half clearing on {dayY(tl.events[0].date)} did not start anything.</>
                : tlNsf
                  ? <><strong>No change to your pay date.</strong> The re-draft cleared inside the same pay window, so you are still paid {dayY(tl.payDate)}. The NSF still shows on the file and the client's 2nd payment is now the one that makes {tlProgram === "LEVEL" ? "a Level Debt commission final" : "the Monthly Volume Bonus count"}.</>
                  : <><strong>On time.</strong> First payment clears {dayY(tl.clearedAt)}; you are paid {dayY(tl.payDate)}.</>}
            </div>
            <div style={{ fontSize: 11.5, color: MUTED, marginTop: 8 }}>{POLICY.nsf} {POLICY.programPayment} {POLICY.lateBackend}</div>
          </Card>

          <Card title="The Rules Behind These Numbers" accent={PURPLE} sub="Same tables the commission tracker and the Commission, Bonuses & SPIFFs page use. If a number changes there, it changes here.">
            <details>
              <summary style={{ cursor: "pointer", fontWeight: 800, color: DARK, fontSize: 13 }}>Commission tables</summary>
              <div className="es-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 10, fontSize: 12.5 }}>
                <div>
                  <div style={{ fontWeight: 800, color: GD, marginBottom: 4 }}>Shield Services (flat per deal)</div>
                  {SHIELD_PROGRAMS.map((b) => <div key={b.code} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${BORDER}` }}><span>{b.label} · {usd(b.minDebt)}{b.maxDebt === Infinity ? "+" : ` – ${usd(b.maxDebt)}`}</span><strong>{usd(b.commission)}</strong></div>)}
                </div>
                <div>
                  <div style={{ fontWeight: 800, color: BLUE, marginBottom: 4 }}>Debt Resolution (flat per deal)</div>
                  {ELP_BANDS.map((b) => <div key={b.code} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${BORDER}` }}><span>{b.label} · {usd(b.minDebt)}{b.maxDebt === Infinity ? "+" : ` – ${usd(b.maxDebt)}`}</span><strong>{usd(b.commission)}</strong></div>)}
                  <div style={{ fontWeight: 800, color: PURPLE, margin: "12px 0 4px" }}>Level Debt (% of enrolled debt, by your monthly Level volume)</div>
                  {LEVEL_TIERS.map((t) => <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${BORDER}` }}><span>{t.label} · from {usd(t.minMonthlyVolume)} / month</span><strong>{(t.rate * 100).toFixed(2)}%</strong></div>)}
                </div>
              </div>
            </details>
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", fontWeight: 800, color: DARK, fontSize: 13 }}>Bonus tables</summary>
              <div className="es-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 10, fontSize: 12.5 }}>
                <div>
                  <div style={{ fontWeight: 800, color: AMBER, marginBottom: 4 }}>Daily Deal Bonus <Pill color={AMBER}>Shield + Debt Resolution pooled</Pill></div>
                  {DAILY_DEAL_BONUS.map((t) => <div key={t.minDeals} style={{ padding: "3px 0", borderBottom: `1px solid ${BORDER}` }}>{t.minDeals}+ deals in a day → <strong>{usd(t.perDeal)} per deal</strong> that day</div>)}
                  <div style={{ fontWeight: 800, color: AMBER, margin: "12px 0 4px" }}>Monthly Volume Bonus <Pill color={AMBER}>2nd payment cleared</Pill></div>
                  {MONTHLY_VOLUME_BONUS.map((t) => <div key={t.minDeals} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${BORDER}` }}><span>{t.minDeals}+ deals</span><strong>{usd(t.bonus)}</strong></div>)}
                </div>
                <div>
                  <div style={{ fontWeight: 800, color: PURPLE, marginBottom: 4 }}>Balanced Book Bonus <Pill color={PURPLE}>cleared reps only</Pill></div>
                  <div style={{ color: MUTED, marginBottom: 6 }}>{BALANCED_BOOK.description}</div>
                  {BALANCED_BOOK.tiers.map((t) => <div key={t.minLevelShare} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${BORDER}` }}><span>Level Debt {pct(t.minLevelShare)}+ of your book</span><strong>{usd(t.bonus)}</strong></div>)}
                  <div style={{ fontWeight: 800, color: PURPLE, margin: "12px 0 4px" }}>Level Debt Enrollment Bonus</div>
                  {LEVEL_ENROLLMENT_BONUS.map((t) => <div key={t.minDailyEnrolled} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${BORDER}` }}><span>{usd(t.minDailyEnrolled)}+ enrolled in a day</span><strong>{usd(t.bonus)}</strong></div>)}
                </div>
              </div>
            </details>
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", fontWeight: 800, color: DARK, fontSize: 13 }}>Payout timing and clawback policy</summary>
              <div style={{ fontSize: 12.5, marginTop: 10, color: DARK, display: "grid", gap: 6 }}>
                {(["SHIELD", "ELP", "LEVEL"] as ProgramKey[]).map((k) => <div key={k}><strong>{PROGRAMS[k].short}:</strong> {PROGRAMS[k].timing} Chargeback-free after program payment {PROGRAMS[k].chargebackFreeAfter}.{PROGRAMS[k].blockedStates.length ? ` Not available in ${PROGRAMS[k].blockedStates.join(", ")}.` : ""}</div>)}
                <div>{POLICY.programPayment}</div>
                <div>{POLICY.nsf}</div>
                <div>{POLICY.lateBackend}</div>
                <div>{POLICY.provisional}</div>
                <div>{POLICY.dispute}</div>
                <div style={{ color: MUTED }}>{POLICY.modification}</div>
              </div>
            </details>
          </Card>
        </div>
      </div>
      <style>{`
        @media (max-width: 960px) {
          .es-grid { grid-template-columns: 1fr !important; }
          .es-side { position: static !important; max-height: none !important; overflow: visible !important; }
          .es-two { grid-template-columns: 1fr !important; }
          .es-controls { grid-template-columns: 1fr 1fr !important; }
        }
        input[type=number]::-webkit-inner-spin-button { opacity: 1; }
      `}</style>
    </ToolShell>
  );
}

// Keep the import used so a future "pay date per program" table is one line away.
void scheduledPayDate;
