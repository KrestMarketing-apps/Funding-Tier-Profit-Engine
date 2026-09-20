import { headers } from "next/headers";
import ToolShell from "../../components/ToolShell";
import { getRole } from "../../lib/role";
import { payQuery } from "../../lib/payDb";

/**
 * My Deals & Pay — a closer's own deals, when each one pays, and why.
 *
 * Everything shown is read from what the Profit Engine computed; nothing here
 * decides pay. A closer sees only rows credited to their own email. An admin
 * can look at any closer with ?as=<email>.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATE: Record<string, { label: string; color: string; bg: string; group: string }> = {
  due: { label: "Being paid now", color: "#15803d", bg: "#f0fdf4", group: "next" },
  scheduled: { label: "Scheduled", color: "#0f766e", bg: "#f0fdfa", group: "next" },
  awaiting_backend: { label: "Waiting on backend payout", color: "#1d4ed8", bg: "#eff6ff", group: "pipeline" },
  awaiting_first_payment: { label: "Waiting on 1st payment", color: "#475569", bg: "#f8fafc", group: "pipeline" },
  unmatched: { label: "Not at the backend yet", color: "#475569", bg: "#f8fafc", group: "pipeline" },
  held: { label: "On hold — being confirmed", color: "#b45309", bg: "#fffbeb", group: "pipeline" },
  paid_at_risk: { label: "Paid — final after 2nd payment", color: "#b45309", bg: "#fffbeb", group: "paid" },
  paid: { label: "Paid", color: "#15803d", bg: "#f0fdf4", group: "paid" },
  clawback: { label: "Clawback", color: "#b91c1c", bg: "#fef2f2", group: "paid" },
  cancelled: { label: "Cancelled — no commission", color: "#64748b", bg: "#f8fafc", group: "closed" },
  forfeited: { label: "Forfeited", color: "#b91c1c", bg: "#fef2f2", group: "closed" },
};
const BACKEND: Record<string, string> = { LEVEL: "Level Debt", CS: "Shield Services", LEGACY: "Elite Legal Practice", UNKNOWN: "—" };

const money = (v: any) => `$${Number(v ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (v: any) => (v ? new Date(`${String(v instanceof Date ? v.toISOString() : v).slice(0, 10)}T12:00:00Z`)
  .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "—");

export default async function MyPayPage({ searchParams }: { searchParams: { as?: string } }) {
  const role = getRole();
  const me = headers().get("x-ft-user") ?? "";
  const email = (role === "admin" && searchParams.as ? searchParams.as : me).toLowerCase();

  let deals: any[] = [];
  let runs: any[] = [];
  let problem: string | null = null;
  try {
    deals = await payQuery(`select * from ao_closer_pay where lower(agent_email) = $1
                             order by next_pay_date nulls last, enrolled_at desc`, [email]);
    runs = await payQuery(
      `select r.id, r.pay_date, r.amount, r.method, r.reference,
              coalesce(json_agg(json_build_object('client', p.client_name, 'kind', l.kind, 'amount', l.amount))
                       filter (where l.id is not null and coalesce(l.note, '') not like 'void%'), '[]') as lines
         from ao_pay_runs r
         join ao_agents a on a.id = r.agent_id and lower(a.email) = $1
         left join ao_comp_ledger l on l.run_id = r.id
         left join ao_closer_pay p on p.deal_id = l.deal_id
        where r.voided_at is null
        group by r.id order by r.pay_date desc limit 50`, [email]);
  } catch (e: any) {
    problem = /does not exist/.test(String(e?.message)) ? "Pay tracking is being set up — check back soon." : "Pay data could not be loaded right now.";
  }

  const next = deals.filter((d) => STATE[d.state]?.group === "next");
  const nextDate = next.map((d) => String(d.next_pay_date).slice(0, 10)).sort()[0] ?? null;
  const nextTotal = next.filter((d) => String(d.next_pay_date).slice(0, 10) === nextDate).reduce((s, d) => s + Number(d.owed), 0);
  const pipeline = deals.filter((d) => STATE[d.state]?.group === "pipeline");
  const pipelineValue = pipeline.reduce((s, d) => s + Number(d.commission ?? 0), 0);
  const paidTotal = deals.reduce((s, d) => s + Number(d.paid ?? 0), 0);
  const clawback = deals.reduce((s, d) => s + Number(d.clawback ?? 0), 0);

  const card = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, marginBottom: 14 } as const;
  const th = { textAlign: "left" as const, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" as const, color: "#64748b", padding: "8px 10px", borderBottom: "1px solid #e2e8f0" };
  const td = { padding: "9px 10px", borderBottom: "1px solid #f1f5f9", fontSize: 13, verticalAlign: "top" as const };

  const Metric = ({ label, value, sub }: { label: string; value: string; sub: string }) => (
    <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", opacity: 0.8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 11, opacity: 0.8 }}>{sub}</div>
    </div>
  );

  const Table = ({ rows, empty }: { rows: any[]; empty: string }) => rows.length === 0
    ? <div style={{ color: "#94a3b8", fontSize: 13 }}>{empty}</div>
    : (
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720 }}>
          <thead><tr>{["Client", "Program", "Status", "Commission", "Pay date", "What's happening"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((d) => {
            const s = STATE[d.state] ?? { label: d.state, color: "#475569", bg: "#f8fafc" };
            return (
              <tr key={d.deal_id}>
                <td style={{ ...td, fontWeight: 700 }}>{d.client_name ?? "—"}<div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>enrolled {day(d.enrolled_at)}</div></td>
                <td style={td}>{BACKEND[d.backend] ?? d.backend}</td>
                <td style={td}><span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{s.label}</span></td>
                <td style={{ ...td, fontFamily: "ui-monospace, monospace" }}>{money(d.commission)}{Number(d.clawback) > 0 && <div style={{ color: "#b91c1c", fontSize: 11 }}>−{money(d.clawback)} owed back</div>}</td>
                <td style={{ ...td, fontWeight: 700, whiteSpace: "nowrap" }}>{["due", "scheduled", "awaiting_backend"].includes(d.state) ? day(d.next_pay_date) : "—"}
                  {d.state === "awaiting_backend" && <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>projected</div>}</td>
                <td style={{ ...td, fontSize: 12, color: "#475569", maxWidth: 420 }}>{d.reason}</td>
              </tr>);
          })}</tbody>
        </table>
      </div>
    );

  return (
    <ToolShell mode={role} tool="My Deals & Pay" eyebrow="AGENT · COMMISSION" title="My Deals & Pay"
      subtitle={role === "admin" && searchParams.as ? `Viewing ${email}` : "Every deal you closed, when you get paid on it, and why."}
      heroSlot={(
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginTop: 12, color: "#fff" }}>
          <Metric label="Next pay date" value={nextDate ? day(nextDate).replace(/^\w+, /, "") : "—"} sub={nextDate ? `${money(nextTotal)} on that date` : "nothing scheduled yet"} />
          <Metric label="Coming up" value={money(next.reduce((s, d) => s + Number(d.owed), 0))} sub={`${next.length} deal${next.length === 1 ? "" : "s"} scheduled`} />
          <Metric label="In the pipeline" value={money(pipelineValue)} sub={`${pipeline.length} deal${pipeline.length === 1 ? "" : "s"} not yet payable`} />
          <Metric label="Paid to date" value={money(paidTotal)} sub={clawback ? `${money(clawback)} clawback to net out` : "on these deals"} />
        </div>
      )}>
      <div style={{ padding: "16px 0", fontFamily: "Inter, system-ui, sans-serif", color: "#0f172a" }}>
        {problem && <div style={{ ...card, background: "#fffbeb", borderColor: "#fde68a" }}>{problem}</div>}

        <div style={card}>
          <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Getting paid</h3>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>The backend has paid Funding Tier on these. The date is when you are paid.</div>
          <Table rows={next} empty="Nothing scheduled right now." />
        </div>

        <div style={card}>
          <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>In the pipeline</h3>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>Closed, but not payable yet — each row says exactly what it is waiting on.</div>
          <Table rows={pipeline} empty="No deals waiting." />
        </div>

        <div style={card}>
          <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Paid and closed out</h3>
          <Table rows={deals.filter((d) => ["paid", "closed"].includes(STATE[d.state]?.group ?? ""))} empty="No paid deals yet." />
        </div>

        <div style={card}>
          <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>Payments you have received</h3>
          {runs.length === 0 ? <div style={{ color: "#94a3b8", fontSize: 13 }}>No payments recorded yet.</div> : (
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead><tr>{["Date", "Amount", "Method", "Deals covered"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>{runs.map((r) => (
                <tr key={r.id}>
                  <td style={{ ...td, fontWeight: 700 }}>{day(r.pay_date)}</td>
                  <td style={{ ...td, fontFamily: "ui-monospace, monospace" }}>{money(r.amount)}</td>
                  <td style={td}>{r.method ?? "—"}{r.reference ? ` · ${r.reference}` : ""}</td>
                  <td style={{ ...td, fontSize: 12 }}>{(r.lines as any[]).map((l, i) => (
                    <span key={i}>{i ? ", " : ""}{l.client ?? "deal"} {l.kind === "clawback_recovered" ? `(−${money(l.amount)} clawback)` : money(l.amount)}</span>))}</td>
                </tr>))}
              </tbody>
            </table>
          )}
        </div>

        <div style={card}>
          <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>How and when you get paid</h3>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6, color: "#334155" }}>
            <li>You are paid on a deal once <strong>the client&apos;s first program payment clears</strong> and <strong>the backend has paid Funding Tier</strong> on it.</li>
            <li>A program payment is one month of the client&apos;s plan. On a split, bi-weekly or semi-monthly plan, <strong>both</strong> drafts for the month must clear — two drafts count as one payment.</li>
            <li><strong>Level Debt:</strong> first payment clears 1st–15th → paid the 1st of next month; clears 16th–end of month → paid the 15th of next month. Final once the 2nd program payment clears — if the client cancels before that, Level takes its payout back and the commission is deducted from your next payment.</li>
            <li><strong>Shield Services:</strong> first payment clears → paid the 20th of the following month. An ordinary cancellation does not take it back.</li>
            <li><strong>Elite Legal Practice:</strong> first payment clears → paid the 20th of the following month. An ordinary cancellation does not take it back.</li>
            <li><strong>Disputes:</strong> if a client formally disputes or charges back any payment, at any point, all commission and any bonus already paid on that file is clawed back.</li>
            <li>If a backend pays Funding Tier late, your date moves to its next pay day at least 5 days after the money arrives — you will see the new date here.</li>
          </ul>
        </div>
      </div>
    </ToolShell>
  );
}
