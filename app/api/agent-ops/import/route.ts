import { NextRequest, NextResponse } from 'next/server';
import { fileKeyFor, parseBackendReport } from '../../../../lib/agentOps/imports';
import { query } from '../../../../lib/agentOps/db';
import { requireAdmin } from '../../../../lib/agentOps/guard';
import { recomputeCloserPay } from '../../../../lib/agentOps/closerPayJob';
import type { BackendKey } from '../../../../lib/agentOps/types';

/**
 * Backend report upload. The parse result is always returned — which columns
 * were recognised, which were ignored, which rows failed — so a spreadsheet
 * whose headers changed is visible immediately rather than after the numbers
 * look wrong. `dryRun` parses and reports without writing.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const VALID: BackendKey[] = ['LEVEL', 'CS', 'LEGACY'];

export async function POST(req: NextRequest) {
  const admin = requireAdmin();
  if (admin.ok === false) return NextResponse.json({ error: admin.error }, { status: 403 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Send the report as multipart/form-data.' }, { status: 400 });

  const backend = String(form.get('backend') ?? '') as BackendKey;
  if (!VALID.includes(backend)) {
    return NextResponse.json({ error: `backend must be one of ${VALID.join(', ')}.` }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file attached.' }, { status: 400 });
  if (/\.xlsx?$/i.test(file.name)) {
    return NextResponse.json({
      error: 'Excel files are not parsed here — open it and "Save As" CSV, then upload that.',
    }, { status: 415 });
  }

  const period = String(form.get('period') ?? '') || undefined;
  const dryRun = String(form.get('dryRun') ?? '') === 'true';
  const text = await file.text();
  const parsed = parseBackendReport(backend, file.name, text, period);

  if (dryRun || parsed.rows.length === 0) {
    return NextResponse.json({ ok: parsed.errors.length === 0, dryRun: true, ...summary(parsed) });
  }

  const batch = await query<{ id: number }>(
    `insert into ao_import_batches (backend, filename, period, uploaded_by, rows_parsed, errors)
     values ($1,$2,$3,$4,$5,$6) returning id`,
    [backend, file.name, period ?? null, admin.email, parsed.parsed, JSON.stringify(parsed.errors)],
  );
  const batchId = batch[0]?.id ?? null;

  let imported = 0;
  for (const r of parsed.rows) {
    await query(
      `insert into ao_backend_files
        (backend, external_id, client_name, client_phone, client_last4, file_status, enrolled_debt,
         first_payment_at, payout_amount, payout_at, period, batch_id, rep_name, enrolled_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       on conflict (backend, coalesce(external_id, ''), coalesce(client_phone, ''), coalesce(client_name, ''))
       do update set file_status = excluded.file_status,
                     enrolled_debt = excluded.enrolled_debt,
                     first_payment_at = excluded.first_payment_at,
                     payout_amount = excluded.payout_amount,
                     payout_at = excluded.payout_at,
                     period = excluded.period,
                     rep_name = coalesce(excluded.rep_name, ao_backend_files.rep_name),
                     enrolled_at = coalesce(excluded.enrolled_at, ao_backend_files.enrolled_at),
                     batch_id = excluded.batch_id,
                     imported_at = now()`,
      [r.backend, r.externalId, r.clientName, r.clientPhone, r.clientLast4, r.fileStatus, r.enrolledDebt,
        r.firstPaymentAt, r.payoutAmount, r.payoutAt, r.period, batchId, r.repName, r.enrolledAt],
    );
    imported += 1;
  }

  // Plan type stated by the report, and the date a file was first seen cancelled.
  if (Object.keys(parsed.declared).length) {
    const existing = await query<any>(`select id, external_id, client_name, declared_schedule from ao_backend_files where backend = $1`, [backend]);
    for (const f of existing) {
      const schedule = parsed.declared[fileKeyFor(f.external_id, f.external_id ? null : f.client_name)];
      if (schedule && f.declared_schedule !== schedule) {
        await query(`update ao_backend_files set declared_schedule = $2 where id = $1`, [f.id, schedule]);
      }
    }
  }
  await query(
    `update ao_backend_files set cancelled_at = current_date
      where backend = $1 and cancelled_at is null
        and file_status ~* '(cancel|refund|chargeback|void|dropped|withdraw)'`,
    [backend],
  );

  // Draft history. The same draft arriving in two reports is one row; a later
  // report can only move a draft forward (scheduled → cleared / NSF), and an
  // inferred row never overwrites a reported one.
  let drafts = 0;
  for (const d of parsed.drafts) {
    await query(
      `insert into ao_backend_drafts
         (backend, file_key, draft_key, draft_number, due_at, cleared_at, returned_at, status, amount, source, batch_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (backend, file_key, draft_key) do update set
         due_at = coalesce(excluded.due_at, ao_backend_drafts.due_at),
         cleared_at = coalesce(excluded.cleared_at, ao_backend_drafts.cleared_at),
         returned_at = coalesce(excluded.returned_at, ao_backend_drafts.returned_at),
         amount = coalesce(excluded.amount, ao_backend_drafts.amount),
         status = case when ao_backend_drafts.source = 'backend_report' and excluded.source = 'inferred'
                       then ao_backend_drafts.status
                       when excluded.status = 'scheduled' then ao_backend_drafts.status
                       else excluded.status end,
         source = case when ao_backend_drafts.source = 'backend_report' then 'backend_report' else excluded.source end,
         batch_id = excluded.batch_id`,
      [d.backend, d.fileKey, d.draftKey, d.draftNumber, d.dueAt, d.clearedAt, d.returnedAt, d.status, d.amount, d.source, batchId],
    );
    drafts += 1;
  }

  await query(`update ao_import_batches set rows_imported = $2 where id = $1`, [batchId, imported]);
  const pay = await recomputeCloserPay().catch((e) => ({ error: String(e?.message ?? e) }));
  return NextResponse.json({ ok: true, batchId, imported, drafts, pay, ...summary(parsed) });
}

function summary(parsed: ReturnType<typeof parseBackendReport>) {
  return {
    backend: parsed.backend,
    rowsParsed: parsed.parsed,
    rowsUsable: parsed.rows.length,
    recognisedColumns: parsed.columnMap,
    ignoredColumns: parsed.unmapped,
    missingColumns: parsed.missing,
    errors: parsed.errors,
    warnings: parsed.warnings,
    otherAffiliateRows: parsed.otherAffiliate,
    collapsedRows: parsed.collapsed,
    sample: parsed.rows.slice(0, 3),
  };
}
