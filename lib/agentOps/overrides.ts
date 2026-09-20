import { query } from './db';
import type { OverrideRecord } from './types';

/**
 * Admin overrides — editable, but never quiet.
 *
 * An admin can correct a synced value (a backend's report has the wrong payout,
 * a rep is credited to the wrong person). Every such edit writes the old and
 * new value, who made it and why into ao_overrides, and the affected row is
 * flagged in the UI from then on. The point is not to prevent the edit; it is
 * that a number a human changed can never again be mistaken for one the
 * backend reported.
 */

/** Only these fields may be overridden, and only on these tables. */
const EDITABLE: Record<string, { table: string; idColumn: string; fields: Record<string, 'text' | 'number' | 'date'> }> = {
  backend_file: {
    table: 'ao_backend_files',
    idColumn: 'id',
    fields: {
      file_status: 'text',
      enrolled_debt: 'number',
      payout_amount: 'number',
      payout_at: 'date',
      first_payment_at: 'date',
      client_name: 'text',
      client_phone: 'text',
    },
  },
  enrollment: {
    table: 'ao_enrollments',
    idColumn: 'id',
    fields: {
      closer_agent_id: 'text',
      agent_id: 'text',
      backend: 'text',
      backend_file_ref: 'text',
      status: 'text',
      enrolled_debt: 'number',
      client_phone: 'text',
    },
  },
  attendance_day: {
    table: 'ao_attendance_days',
    idColumn: 'agent_id',
    fields: { active_minutes: 'number', scheduled_minutes: 'number' },
  },
  agent: {
    table: 'ao_agents',
    idColumn: 'id',
    fields: {
      role: 'text', employment_type: 'text', team: 'text',
      hourly_rate: 'number', scheduled_hours_per_week: 'number', active: 'text',
    },
  },
};

export interface OverrideInput {
  entity: keyof typeof EDITABLE | string;
  entityId: string;
  field: string;
  newValue: string | null;
  reason: string;
  adminEmail: string;
  /** attendance_day needs a day as well as an agent id. */
  day?: string;
}

export async function applyOverride(input: OverrideInput): Promise<OverrideRecord> {
  const spec = EDITABLE[input.entity];
  if (!spec) throw new Error(`"${input.entity}" is not an overridable record.`);
  const kind = spec.fields[input.field];
  if (!kind) throw new Error(`"${input.field}" is not an overridable field on ${input.entity}.`);
  if (!input.reason?.trim()) throw new Error('An override needs a reason — it goes on the record.');

  const where = input.entity === 'attendance_day'
    ? `${spec.idColumn} = $1 and day = $3`
    : `${spec.idColumn} = $1`;
  const whereParams = input.entity === 'attendance_day' ? [input.entityId, input.day] : [input.entityId];

  const existing = await query<any>(
    `select ${input.field} as v from ${spec.table} where ${input.entity === 'attendance_day' ? `${spec.idColumn} = $1 and day = $2` : `${spec.idColumn} = $1`}`,
    whereParams.filter((x) => x !== undefined),
  );
  if (existing.length === 0) throw new Error('That record no longer exists.');
  const oldValue = existing[0].v;

  const cast = kind === 'number' ? '::numeric' : kind === 'date' ? '::date' : '';
  await query(
    `update ${spec.table} set ${input.field} = $2${cast} where ${where}`,
    input.entity === 'attendance_day'
      ? [input.entityId, input.newValue, input.day]
      : [input.entityId, input.newValue],
  );

  // A hand-set closer must survive every later sync — mark it as an override
  // so the sync's credit-freezing rule leaves it alone.
  if (input.entity === 'enrollment' && input.field === 'closer_agent_id') {
    await query(`update ao_enrollments set closer_source = 'override' where id = $1`, [input.entityId]);
  }

  const rows = await query<any>(
    `insert into ao_overrides (entity, entity_id, field, old_value, new_value, reason, admin_email)
     values ($1,$2,$3,$4,$5,$6,$7) returning *`,
    [input.entity, input.entityId + (input.day ? `|${input.day}` : ''), input.field,
      oldValue === null || oldValue === undefined ? null : String(oldValue),
      input.newValue, input.reason.trim(), input.adminEmail],
  );
  return toRecord(rows[0]);
}

export async function listOverrides(limit = 200): Promise<OverrideRecord[]> {
  const rows = await query<any>(
    `select * from ao_overrides order by at desc limit $1`, [limit],
  );
  return rows.map(toRecord);
}

/** entity|entityId → how many times it has been hand-edited. Drives the flag. */
export async function overrideFlags(): Promise<Record<string, number>> {
  const rows = await query<any>(
    `select entity, entity_id, count(*)::int as n from ao_overrides
     where reverted_at is null group by entity, entity_id`,
  );
  const out: Record<string, number> = {};
  rows.forEach((r) => { out[`${r.entity}|${r.entity_id}`] = r.n; });
  return out;
}

function toRecord(r: any): OverrideRecord {
  return {
    id: Number(r.id),
    entity: r.entity,
    entityId: r.entity_id,
    field: r.field,
    oldValue: r.old_value,
    newValue: r.new_value,
    reason: r.reason,
    adminEmail: r.admin_email,
    at: new Date(r.at).toISOString(),
    revertedAt: r.reverted_at ? new Date(r.reverted_at).toISOString() : null,
  };
}
