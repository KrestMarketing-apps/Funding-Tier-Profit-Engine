import { neon } from '@neondatabase/serverless';

/**
 * Agent Ops storage.
 *
 * Same Neon database and same idempotent-DDL habit as lib/audit.ts: every
 * table is created on first use, so there is no migration step to forget.
 * All tables are prefixed `ao_` so they never collide with the access log or
 * anything the other tools add later.
 *
 * Why a database at all, when the data lives in GoHighLevel: GHL's reporting
 * cannot answer "what did this rep cost per confirmed deal", it thins out
 * historically, and it has no idea what the backends actually paid. Pulling
 * the raw records here once and keeping them is what makes the cross-check
 * possible.
 */

export type Sql = ReturnType<typeof neon>;

export function connectionString(): string | undefined {
  return (process.env.DATABASE_URL || process.env.POSTGRES_URL)?.trim() || undefined;
}

export function hasDatabase(): boolean {
  return Boolean(connectionString());
}

let client: Sql | null = null;
export function db(): Sql {
  const cs = connectionString();
  if (!cs) throw new Error('DATABASE_URL is not set — Agent Ops cannot reach Postgres.');
  if (!client) client = neon(cs);
  return client;
}

const DDL: string[] = [
  `create table if not exists ao_agents (
     id text primary key,
     location_id text not null,
     name text,
     email text,
     role text,
     employment_type text,
     hourly_rate numeric(10,2),
     scheduled_hours_per_week numeric(6,2),
     team text,
     active boolean not null default true,
     updated_at timestamptz not null default now()
   )`,

  // Raw attendance material: one row per timestamped thing an agent did.
  `create table if not exists ao_events (
     id text primary key,
     location_id text not null,
     agent_id text,
     at timestamptz not null,
     kind text not null,
     ref text
   )`,
  `create index if not exists ao_events_agent_at on ao_events (agent_id, at)`,

  `create table if not exists ao_calls (
     id text primary key,
     location_id text not null,
     agent_id text,
     contact_id text,
     contact_name text,
     direction text,
     started_at timestamptz not null,
     duration_seconds integer not null default 0,
     talk_seconds integer not null default 0,
     status text,
     disposition text,
     from_number text,
     to_number text,
     recording_url text,
     raw jsonb
   )`,
  `create index if not exists ao_calls_agent_started on ao_calls (agent_id, started_at)`,
  `create index if not exists ao_calls_started on ao_calls (started_at)`,

  `create table if not exists ao_enrollments (
     id text primary key,
     location_id text not null,
     agent_id text,
     contact_id text,
     client_name text,
     client_phone text,
     client_email text,
     backend text not null default 'UNKNOWN',
     pipeline text,
     stage text,
     status text,
     enrolled_debt numeric(12,2),
     enrolled_at timestamptz,
     updated_at timestamptz,
     raw jsonb
   )`,
  `create index if not exists ao_enrollments_agent on ao_enrollments (agent_id, enrolled_at)`,

  `create table if not exists ao_import_batches (
     id bigserial primary key,
     backend text not null,
     filename text,
     period text,
     uploaded_by text,
     uploaded_at timestamptz not null default now(),
     rows_parsed integer not null default 0,
     rows_imported integer not null default 0,
     errors jsonb
   )`,

  // A backend's own report of a file. This is the money source of truth —
  // what the rep entered in GHL is only a claim until one of these matches it.
  `create table if not exists ao_backend_files (
     id bigserial primary key,
     backend text not null,
     external_id text,
     client_name text,
     client_phone text,
     client_last4 text,
     file_status text,
     enrolled_debt numeric(12,2),
     first_payment_at date,
     payout_amount numeric(12,2),
     payout_at date,
     period text,
     batch_id bigint,
     raw jsonb,
     imported_at timestamptz not null default now()
   )`,
  `create unique index if not exists ao_backend_files_key
     on ao_backend_files (backend, coalesce(external_id, ''), coalesce(client_phone, ''), coalesce(client_name, ''))`,

  `create table if not exists ao_matches (
     id bigserial primary key,
     enrollment_id text,
     backend_file_id bigint,
     status text not null,
     method text,
     confidence numeric(4,3) not null default 0,
     delta_amount numeric(12,2),
     computed_at timestamptz not null default now()
   )`,
  `create unique index if not exists ao_matches_pair
     on ao_matches (coalesce(enrollment_id, ''), coalesce(backend_file_id, 0))`,

  // Every admin edit to synced data — the check and balance on overrides.
  `create table if not exists ao_overrides (
     id bigserial primary key,
     entity text not null,
     entity_id text not null,
     field text not null,
     old_value text,
     new_value text,
     reason text,
     admin_email text not null,
     at timestamptz not null default now(),
     reverted_at timestamptz
   )`,
  `create index if not exists ao_overrides_entity on ao_overrides (entity, entity_id)`,

  `create table if not exists ao_attendance_days (
     agent_id text not null,
     day date not null,
     location_id text,
     first_event timestamptz,
     last_event timestamptz,
     active_minutes integer not null default 0,
     span_minutes integer not null default 0,
     gap_minutes integer not null default 0,
     sessions integer not null default 0,
     calls integer not null default 0,
     talk_minutes integer not null default 0,
     enrollments integer not null default 0,
     scheduled_minutes integer not null default 0,
     computed_at timestamptz not null default now(),
     primary key (agent_id, day)
   )`,

  `create table if not exists ao_sync_runs (
     id bigserial primary key,
     started_at timestamptz not null default now(),
     finished_at timestamptz,
     ok boolean,
     source text,
     window_from timestamptz,
     window_to timestamptz,
     counts jsonb,
     error text
   )`,
];

let ready: Promise<void> | null = null;

/** Create every table once per cold start. Idempotent by construction. */
export function ensureSchema(): Promise<void> {
  if (!ready) {
    const sql = db();
    ready = (async () => {
      for (const stmt of DDL) await sql(stmt);
    })().catch((e) => {
      ready = null;          // let the next request retry rather than latch a failure
      throw e;
    });
  }
  return ready;
}

/** Run a query with the schema guaranteed to exist. */
export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  await ensureSchema();
  const sql = db();
  return (await sql(text, params)) as unknown as T[];
}
