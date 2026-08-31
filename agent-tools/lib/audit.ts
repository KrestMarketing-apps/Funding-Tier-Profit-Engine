import { neon } from "@neondatabase/serverless";
import { TOOL_NAME } from "./paths";

/**
 * Access logging.
 *
 * Every way into these tools carries a real person's identity, so it gets
 * recorded. Entries go to a Postgres table (Neon, provisioned through the
 * Vercel Marketplace) and to the platform log as a fallback trail.
 *
 * Postgres rather than the runtime log because Vercel keeps runtime logs for
 * one day on Pro — fine for debugging, useless as an audit trail. The table
 * is append-only and outlives deployments.
 *
 * Uses Neon's HTTP driver, which works on both the edge and Node runtimes —
 * middleware needs the former.
 */
export type AccessEvent = {
  /** signin | denied_role | denied_tenant | denied_norole */
  event: string;
  email?: string;
  name?: string;
  role?: string;
  /** GHL sub-account */
  location?: string;
  /** Path they were trying to reach, when relevant. */
  path?: string;
  ip?: string;
};

const DDL = `
  create table if not exists access_log (
    id bigserial primary key,
    at timestamptz not null default now(),
    event text not null,
    tool text not null,
    email text,
    name text,
    role text,
    location text,
    path text,
    ip text
  )`;

function connectionString(): string | undefined {
  return (process.env.DATABASE_URL || process.env.POSTGRES_URL)?.trim() || undefined;
}

// One CREATE TABLE IF NOT EXISTS per cold start, so there is no manual
// migration step to forget. Cheap, and idempotent by definition.
let ready: Promise<void> | null = null;
function ensureTable(sql: ReturnType<typeof neon>): Promise<void> {
  if (!ready) ready = sql(DDL).then(() => undefined);
  return ready;
}

export async function logAccess(e: AccessEvent): Promise<void> {
  const entry = { ...e, tool: TOOL_NAME, at: new Date().toISOString() };

  // Always emit a line: if the database write fails, this is the trail.
  console.log(`[access] ${JSON.stringify(entry)}`);

  const url = connectionString();
  if (!url) return;

  try {
    const sql = neon(url);
    await ensureTable(sql);
    await sql(
      `insert into access_log (event, tool, email, name, role, location, path, ip)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        entry.event,
        entry.tool,
        entry.email ?? null,
        entry.name ?? null,
        entry.role ?? null,
        entry.location ?? null,
        entry.path ?? null,
        entry.ip ?? null,
      ]
    );
  } catch (err) {
    // Logging must never break or slow a sign-in. The console line above
    // already recorded the event.
    ready = null; // let the next call retry the DDL
    console.error(`[access] write failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
