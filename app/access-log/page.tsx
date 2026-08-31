import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Who opened which tool, and when.
 *
 * Admin-only by virtue of middleware: this path is not in the OPEN list, so a
 * session with role "admin" is required to reach it at all.
 */

type Row = {
  id: string;
  at: string;
  event: string;
  tool: string;
  email: string | null;
  name: string | null;
  role: string | null;
  location: string | null;
  path: string | null;
  ip: string | null;
};

const EVENT_LABEL: Record<string, string> = {
  signin: "Signed in",
  denied_role: "Blocked — role",
  denied_tenant: "Blocked — wrong account",
  denied_norole: "Blocked — no role",
};

const EVENT_COLOR: Record<string, string> = {
  signin: "#0f766e",
  denied_role: "#b45309",
  denied_tenant: "#b91c1c",
  denied_norole: "#b91c1c",
};

const C = {
  ink: "#0f172a",
  muted: "#64748b",
  line: "#e2e8f0",
  panel: "#ffffff",
};

async function fetchRows(days: number, who: string, event: string): Promise<Row[] | null> {
  const url = (process.env.DATABASE_URL || process.env.POSTGRES_URL)?.trim();
  if (!url) return null;
  const sql = neon(url);
  const rows = (await sql(
    `select id, at, event, tool, email, name, role, location, path, ip
       from access_log
      where at > now() - ($1 || ' days')::interval
        and ($2 = '' or email ilike '%' || $2 || '%')
        and ($3 = '' or event = $3)
      order by at desc
      limit 500`,
    [String(days), who, event]
  )) as unknown as Row[];
  return rows;
}

function fmt(at: string) {
  const d = new Date(at);
  return d.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AccessLog({
  searchParams,
}: {
  searchParams: { days?: string; who?: string; event?: string };
}) {
  const days = Math.min(Math.max(Number(searchParams?.days) || 30, 1), 365);
  const who = (searchParams?.who || "").slice(0, 120);
  const event = ["signin", "denied_role", "denied_tenant", "denied_norole"].includes(
    searchParams?.event || ""
  )
    ? searchParams!.event!
    : "";

  let rows: Row[] | null = null;
  let error: string | null = null;
  try {
    rows = await fetchRows(days, who, event);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const signins = rows?.filter((r) => r.event === "signin").length ?? 0;
  const people = new Set(rows?.filter((r) => r.email).map((r) => r.email)).size;

  return (
    <div style={{minHeight:"100vh",background:"#f8fafc",padding:"32px 20px",
      fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",color:C.ink}}>
      <div style={{maxWidth:1080,margin:"0 auto"}}>
        <h1 style={{margin:"0 0 4px",fontSize:22,fontWeight:800}}>Access log</h1>
        <p style={{margin:"0 0 24px",fontSize:13,color:C.muted}}>
          Sign-ins and blocked attempts across both Funding Tier tools. Times in Pacific.
        </p>

        <form method="GET" style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:20,alignItems:"center"}}>
          <input name="who" defaultValue={who} placeholder="Filter by email"
            style={{padding:"9px 12px",fontSize:13,border:`1px solid ${C.line}`,borderRadius:8,
              minWidth:220,background:C.panel}} />
          <select name="event" defaultValue={event}
            style={{padding:"9px 12px",fontSize:13,border:`1px solid ${C.line}`,borderRadius:8,background:C.panel}}>
            <option value="">All events</option>
            <option value="signin">Signed in</option>
            <option value="denied_role">Blocked — role</option>
            <option value="denied_tenant">Blocked — wrong account</option>
            <option value="denied_norole">Blocked — no role</option>
          </select>
          <select name="days" defaultValue={String(days)}
            style={{padding:"9px 12px",fontSize:13,border:`1px solid ${C.line}`,borderRadius:8,background:C.panel}}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
          <button type="submit"
            style={{padding:"9px 18px",fontSize:13,fontWeight:700,color:"#fff",background:"#0f766e",
              border:"none",borderRadius:8,cursor:"pointer"}}>
            Apply
          </button>
          {rows && (
            <span style={{fontSize:12,color:C.muted,marginLeft:"auto"}}>
              {rows.length} entries · {signins} sign-ins · {people} people
            </span>
          )}
        </form>

        {!rows && !error && (
          <Panel>
            No database connected yet. Add a Postgres store from the Vercel dashboard
            (Storage → Neon); it sets <code>DATABASE_URL</code> automatically, and the
            table is created on the first write.
          </Panel>
        )}
        {error && <Panel tone="error">Could not read the log: {error}</Panel>}
        {rows && rows.length === 0 && <Panel>No entries match those filters.</Panel>}

        {rows && rows.length > 0 && (
          <div style={{overflowX:"auto",background:C.panel,border:`1px solid ${C.line}`,borderRadius:12}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:760}}>
              <thead>
                <tr>
                  {["When","Person","Role","Tool","Event","Detail"].map((h) => (
                    <th key={h} style={{textAlign:"left",padding:"11px 14px",fontSize:11,
                      textTransform:"uppercase",letterSpacing:".04em",color:C.muted,
                      borderBottom:`1px solid ${C.line}`,fontWeight:700,whiteSpace:"nowrap"}}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={cell()}>{fmt(r.at)}</td>
                    <td style={cell()}>
                      <div style={{fontWeight:600}}>{r.name || "—"}</div>
                      <div style={{color:C.muted,fontSize:12}}>{r.email || "—"}</div>
                    </td>
                    <td style={cell()}>{r.role || "—"}</td>
                    <td style={cell()}>{r.tool}</td>
                    <td style={{...cell(),color:EVENT_COLOR[r.event] || C.ink,fontWeight:600,whiteSpace:"nowrap"}}>
                      {EVENT_LABEL[r.event] || r.event}
                    </td>
                    <td style={{...cell(),color:C.muted,fontSize:12}}>{r.path || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p style={{margin:"18px 0 0",fontSize:11,color:"#94a3b8",lineHeight:1.6}}>
          Sessions last 12 hours, so this records when someone opened a tool rather than
          every page they viewed. Newest 500 entries for the selected range.
        </p>
      </div>
    </div>
  );
}

function cell(): React.CSSProperties {
  return { padding: "11px 14px", borderBottom: `1px solid ${C.line}`, verticalAlign: "top" };
}

function Panel({ children, tone }: { children: React.ReactNode; tone?: "error" }) {
  return (
    <div style={{background:C.panel,border:`1px solid ${tone === "error" ? "#fecaca" : C.line}`,
      borderRadius:12,padding:20,fontSize:13,lineHeight:1.6,
      color:tone === "error" ? "#b91c1c" : C.muted}}>
      {children}
    </div>
  );
}
