import AgentOps from '../../components/agentOps/AgentOps';
import { loadDashboard } from '../../lib/agentOps/queries';

/** Admin-only, like the rest of this app — middleware admits admins and nobody else. */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function defaultPeriod() {
  const to = new Date();
  const from = new Date(to.getTime() - 13 * 86400_000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export default async function Page({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const fallback = defaultPeriod();
  const period = {
    from: isDate(searchParams.from) ? searchParams.from : fallback.from,
    to: isDate(searchParams.to) ? searchParams.to : fallback.to,
  };

  let data;
  try {
    data = await loadDashboard(period);
  } catch (e: any) {
    // A database that is configured but unreachable should say so, not render
    // sample data as though it were real.
    return (
      <main style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: 32, color: '#334155' }}>
        <h1 style={{ fontSize: 18, color: '#0f172a' }}>Agent Ops cannot reach its database</h1>
        <p style={{ fontSize: 13, maxWidth: 620 }}>
          The page is configured to use Postgres but the connection failed. Nothing is shown rather than showing
          numbers that might be stale or invented.
        </p>
        <pre style={{ fontSize: 11, background: '#f8fafc', padding: 12, borderRadius: 8, overflowX: 'auto' }}>
          {String(e?.message ?? e)}
        </pre>
      </main>
    );
  }

  return <AgentOps data={data} />;
}
