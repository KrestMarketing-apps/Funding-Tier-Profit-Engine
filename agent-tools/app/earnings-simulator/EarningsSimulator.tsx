"use client";
import { useMemo, useState } from "react";
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
const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

// ── Small UI pieces ────────────────────────────────────────────────────────

function Card({ title, sub, accent = G, children, style }: { title: string; sub?: string; accent?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, borderLeft: `4px solid ${accent}`, ...style }}>
      <div style={{ fontWeight: 900, fontSize: 16, color: DARK }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: MUTED, marginTop: 2, marginBottom: 12 }}>{sub}</div>}
      {!sub && <div style={{ height: 12 }} />}
      {children}
    </section>
  );
}

function Slider({ label, value, min, max, step, onChange, format, help }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string; help?: string;
}) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: DARK }}>{label}</span>
        <span style={{ fontWeight: 900, fontSize: 16, color: GD, fontVariantNumeric: "tabular-nums" }}>{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: G, marginTop: 4 }} />
      {help && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{help}</div>}
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

  return (
    <ToolShell
      mode={mode}
      tool="Earnings Simulator"
      eyebrow={mode === "admin" ? "ADMIN · AGENT TOOLS" : "AGENT TOOLS"}
      badge={{ text: `PAY RULES ${PAY_RULES_VERSION}` }}
      title="What Could You Make?"
      subtitle="Set your hours, how many qualified calls you take, and your close rate. The simulator applies the published commission and bonus rules and shows what a month looks like, when the money lands, and what happens when a first payment bounces."
      heroSlot={
        <MetricsGrid>
          <Metric label="Per month" value={usd(r.monthlyTotal)} accent />
          <Metric label="Per year" value={usd(r.annualTotal)} />
          <Metric label="Per hour worked" value={usd(r.perHour, 2)} />
          <Metric label="Paid deals / month" value={num(r.paidDealsPerMonth)} />
        </MetricsGrid>
      }
    >
      <div style={{ padding: 20, background: BG, display: "grid", gridTemplateColumns: "minmax(280px, 380px) 1fr", gap: 18 }}>

        {/* ── Inputs ── */}
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <Card title="Your Activity" sub="Realistic numbers beat optimistic ones. Start with what a trained rep does in a normal week.">
            <Slider label="Hours per week" value={inp.hoursPerWeek} min={10} max={60} step={1} onChange={(v) => set("hoursPerWeek", v)} format={(v) => `${v} hrs`} />
            <Slider label="Qualified calls per hour" value={inp.qualifiedCallsPerHour} min={0.25} max={4} step={0.25} onChange={(v) => set("qualifiedCallsPerHour", v)} format={(v) => num(v, 2)}
              help="Live transfers or inbound calls that reach a real pitch. Not dials." />
            <Slider label="Close rate" value={inp.closeRate} min={0.02} max={0.4} step={0.01} onChange={(v) => set("closeRate", v)} format={pct}
              help="Share of qualified calls that enroll. New reps: 8 to 12%. Strong reps: 15%+." />
            <Slider label="First payment never clears" value={inp.firstPaymentFallout} min={0} max={0.8} step={0.05} onChange={(v) => set("firstPaymentFallout", v)} format={pct}
              help="NSF, cancel, or no-show before the first program payment. No commission on these. Plan on 40 to 50%." />
            <Slider label="Second payment clears" value={inp.secondPaymentClears} min={0.5} max={1} step={0.05} onChange={(v) => set("secondPaymentClears", v)} format={pct}
              help="Drives the Monthly Volume Bonus and makes Level Debt commission final." />
          </Card>

          <Card title="Your Programs" accent={BLUE} sub="Shield Services is the primary program. The other programs unlock once you are trained and cleared on their enrollment systems.">
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
                <Slider label="Shield Services" value={inp.mix.SHIELD} min={0} max={1} step={0.05} onChange={(v) => setMix("SHIELD", v)} format={pct} />
                <Slider label="Debt Resolution" value={inp.mix.ELP} min={0} max={1} step={0.05} onChange={(v) => setMix("ELP", v)} format={pct} />
                <Slider label="Level Debt" value={inp.mix.LEVEL} min={0} max={1} step={0.05} onChange={(v) => setMix("LEVEL", v)} format={pct} />
                {mixWarn && <div style={{ fontSize: 12, color: AMBER, fontWeight: 700, marginBottom: 10 }}>Mix adds to {pct(mixTotal)}; it is scaled to 100% in the math.</div>}
              </>
            )}

            <div style={{ fontWeight: 800, fontSize: 12, color: MUTED, letterSpacing: 0.4, margin: "6px 0" }}>AVERAGE ENROLLED DEBT</div>
            <Slider label="Shield Services deal" value={inp.avgDebt.SHIELD} min={4000} max={60000} step={500} onChange={(v) => setDebt("SHIELD", v)} format={(v) => usd(v)} help={r.byProgram.SHIELD.basis} />
            {inp.clearedOnAllPrograms && inp.mix.ELP > 0 && <Slider label="Debt Resolution deal" value={inp.avgDebt.ELP} min={6000} max={60000} step={500} onChange={(v) => setDebt("ELP", v)} format={(v) => usd(v)} help={r.byProgram.ELP.basis} />}
            {inp.clearedOnAllPrograms && inp.mix.LEVEL > 0 && <Slider label="Level Debt deal" value={inp.avgDebt.LEVEL} min={7000} max={80000} step={500} onChange={(v) => setDebt("LEVEL", v)} format={(v) => usd(v)} help={r.byProgram.LEVEL.basis} />}
          </Card>
        </div>

        {/* ── Results ── */}
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>

          <Card title="How A Month Breaks Down" sub={`${num(r.hoursPerMonth, 0)} hours → ${num(r.qualifiedCallsPerMonth, 0)} qualified calls → ${num(r.enrollmentsPerMonth)} enrollments → ${num(r.paidDealsPerMonth)} deals that actually pay.`}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
              {[
                ["Qualified calls", num(r.qualifiedCallsPerMonth, 0), MUTED],
                ["Enrollments", num(r.enrollmentsPerMonth), BLUE],
                ["Lost before 1st payment", `−${num(r.lostToFallout)}`, RED],
                ["Paid deals", num(r.paidDealsPerMonth), GD],
              ].map(([l, v, c]) => (
                <div key={l as string} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, color: MUTED, fontWeight: 700 }}>{l}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: c as string }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ fontWeight: 800, fontSize: 12, color: MUTED, letterSpacing: 0.4, marginBottom: 2 }}>COMMISSION</div>
            {r.byProgram.SHIELD.deals > 0 && <Row label="Shield Services" sub={`${num(r.byProgram.SHIELD.deals)} deals × ${usd(r.byProgram.SHIELD.perDeal)} · ${r.byProgram.SHIELD.basis}`} value={usd(r.byProgram.SHIELD.commission)} />}
            {r.byProgram.ELP.deals > 0 && <Row label="Debt Resolution" sub={`${num(r.byProgram.ELP.deals)} deals × ${usd(r.byProgram.ELP.perDeal)} · ${r.byProgram.ELP.basis}`} value={usd(r.byProgram.ELP.commission)} />}
            {r.byProgram.LEVEL.deals > 0 && <Row label="Level Debt" sub={`${num(r.byProgram.LEVEL.deals)} deals · ${usd(r.levelMonthlyVolume)} enrolled this month · ${r.levelTier.label} (${(r.levelTier.rate * 100).toFixed(2)}%)`} value={usd(r.byProgram.LEVEL.commission)} />}
            <Row label="Commission total" value={usd(r.commissionTotal)} strong color={GD} />

            <div style={{ fontWeight: 800, fontSize: 12, color: MUTED, letterSpacing: 0.4, margin: "14px 0 2px" }}>BONUSES AND SPIFFS</div>
            <Row label="Daily Deal Bonus" sub={r.dailyBonusNote} value={usd(r.dailyBonus)} color={r.dailyBonus > 0 ? AMBER : MUTED} />
            <Row label="Monthly Volume Bonus"
              sub={r.monthlyBonusNext ? `${num(r.pooledDealsP2)} pooled deals with 2nd payment cleared. ${r.monthlyBonusNext.minDeals} unlocks ${usd(r.monthlyBonusNext.bonus)}.` : `${num(r.pooledDealsP2)} pooled deals with 2nd payment cleared — top tier.`}
              value={usd(r.monthlyBonus)} color={r.monthlyBonus > 0 ? AMBER : MUTED} />
            <Row label="Balanced Book Bonus" sub={r.balancedBook.reason} value={usd(r.balancedBook.bonus)} color={r.balancedBook.bonus > 0 ? PURPLE : MUTED} />
            {inp.clearedOnAllPrograms && <Row label="Level Debt Enrollment Bonus" sub={`${usd(r.levelMonthlyVolume / WORK_DAYS_PER_MONTH)} Level Debt enrolled per day on average; pays at $75,000 and $100,000 a day.`} value={usd(r.levelEnrollment)} color={r.levelEnrollment > 0 ? PURPLE : MUTED} />}
            <Row label="Bonus total" value={usd(r.bonusTotal)} strong color={AMBER} />

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

          <Card title="When The Money Lands" accent={AMBER} sub="You are paid on a deal after the client's first program payment clears and the provider has paid Funding Tier. Here is what an NSF on that first payment does to the date.">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: DARK }}>Program
                <select value={tlProgram} onChange={(e) => setTlProgram(e.target.value as ProgramKey)} style={{ display: "block", width: "100%", marginTop: 4, padding: 8, borderRadius: 8, border: `1px solid ${BORDER}`, fontWeight: 700 }}>
                  <option value="SHIELD">Shield Services</option>
                  <option value="ELP">Debt Resolution</option>
                  <option value="LEVEL">Level Debt</option>
                </select>
              </label>
              <label style={{ fontSize: 13, fontWeight: 700, color: DARK }}>First draft scheduled on day
                <input type="number" min={1} max={28} value={tlDay} onChange={(e) => setTlDay(Math.min(28, Math.max(1, Number(e.target.value))))} style={{ display: "block", width: "100%", marginTop: 4, padding: 8, borderRadius: 8, border: `1px solid ${BORDER}`, fontWeight: 700 }} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={tlSplit} onChange={(e) => setTlSplit(e.target.checked)} style={{ accentColor: BLUE, width: 18, height: 18 }} />
                <span style={{ fontWeight: 800, fontSize: 13, color: DARK }}>Client pays twice a month (split plan)</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={tlNsf} onChange={(e) => setTlNsf(e.target.checked)} style={{ accentColor: RED, width: 18, height: 18 }} />
                <span style={{ fontWeight: 800, fontSize: 13, color: DARK }}>{tlSplit ? "First half returns NSF" : "First draft returns NSF"}</span>
              </label>
            </div>
            {tlSplit && <div style={{ fontSize: 12.5, color: DARK, background: BLUE + "10", border: `1px solid ${BLUE}44`, borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}><strong>Split plan:</strong> a program payment is one month of the plan. Half a month clearing is not a first program payment. Nothing is owed, and the pay clock does not start, until the second half clears. Two half-drafts are one program payment, never two.</div>}
            {tlNsf && <Slider label="Days until the re-draft clears" value={tlRedraft} min={3} max={45} step={1} onChange={setTlRedraft} format={(v) => `${v} days`} help="Most providers re-present within 7 to 14 days. Some clients ask to move it to their next payday." />}

            <div style={{ borderLeft: `3px solid ${BORDER}`, marginLeft: 8, paddingLeft: 16, marginTop: 6 }}>
              {tl.events.map((e, i) => {
                const c = e.kind === "nsf" ? RED : e.kind === "scheduled" ? MUTED : e.kind === "half_cleared" ? BLUE : GD;
                return (
                  <div key={i} style={{ position: "relative", paddingBottom: 12 }}>
                    <span style={{ position: "absolute", left: -23, top: 3, width: 11, height: 11, borderRadius: 999, background: c, border: "2px solid #fff", boxShadow: `0 0 0 1px ${c}` }} />
                    <div style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>{day(e.date)}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: c }}>{e.label}</div>
                  </div>
                );
              })}
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: -23, top: 3, width: 11, height: 11, borderRadius: 999, background: DARK, border: "2px solid #fff", boxShadow: `0 0 0 1px ${DARK}` }} />
                <div style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>{day(tl.payDate)}</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: DARK }}>You are paid</div>
                <div style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>{PROGRAMS[tlProgram].timing}</div>
              </div>
            </div>

            <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: tl.slipDays > 0 ? "#fff7ed" : "#f0fdf4", border: `1px solid ${tl.slipDays > 0 ? "#fdba74" : "#86efac"}`, fontSize: 13, color: DARK }}>
              {tl.slipDays > 0
                ? <><strong>Pay date moves {tl.slipDays} days later</strong> (from {day(tl.onTimePayDate)} to {day(tl.payDate)}). {tlSplit ? "The first half never counted on its own, and the NSF pushed it; program payment 1 was complete only when the second half cleared, and the pay schedule runs from that date." : "The NSF draft never counts; the re-draft's clear date is program payment 1, and the pay schedule runs from that date."}</>
                : tlSplit && !tlNsf
                  ? <><strong>Both halves cleared on schedule.</strong> Program payment 1 completed {day(tl.clearedAt)} when the second half cleared; you are paid {day(tl.payDate)}. Note the first half clearing on {day(tl.events[0].date)} did not start anything.</>
                : tlNsf
                  ? <><strong>No change to your pay date.</strong> The re-draft cleared inside the same pay window, so you are still paid {day(tl.payDate)}. The NSF still shows on the file and the client's 2nd payment is now the one that makes {tlProgram === "LEVEL" ? "a Level Debt commission final" : "the Monthly Volume Bonus count"}.</>
                  : <><strong>On time.</strong> First payment clears {day(tl.clearedAt)}; you are paid {day(tl.payDate)}.</>}
            </div>
            <div style={{ fontSize: 11.5, color: MUTED, marginTop: 8 }}>{POLICY.nsf} {POLICY.programPayment} {POLICY.lateBackend}</div>
          </Card>

          <Card title="The Rules Behind These Numbers" accent={PURPLE} sub="Same tables the commission tracker and the Commission, Bonuses & SPIFFs page use. If a number changes there, it changes here.">
            <details>
              <summary style={{ cursor: "pointer", fontWeight: 800, color: DARK, fontSize: 13 }}>Commission tables</summary>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 10, fontSize: 12.5 }}>
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 10, fontSize: 12.5 }}>
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
      <style>{`@media (max-width: 860px){ [data-ft-tool="Earnings Simulator"] > div:last-child > div { grid-template-columns: 1fr !important; } }`}</style>
    </ToolShell>
  );
}

// Keep the import used so a future "pay date per program" table is one line away.
void scheduledPayDate;
