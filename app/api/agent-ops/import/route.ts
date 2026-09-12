import { NextRequest, NextResponse } from 'next/server';
import { parseBackendReport } from '../../../../lib/agentOps/imports';
import { query } from '../../../../lib/agentOps/db';
import { requireAdmin } from '../../../../lib/agentOps/guard';
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
         first_payment_at, payout_amount, payout_at, period, batch_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       on conflict (backend, coalesce(external_id, ''), coalesce(client_phone, ''), coalesce(client_name, ''))
       do update set file_status = excluded.file_status,
                     enrolled_debt = excluded.enrolled_debt,
                     first_payment_at = excluded.first_payment_at,
                     payout_amount = excluded.payout_amount,
                     payout_at = excluded.payout_at,
                     period = excluded.period,
                     batch_id = excluded.batch_id,
                     imported_at = now()`,
      [r.backend, r.externalId, r.clientName, r.clientPhone, r.clientLast4, r.fileStatus, r.enrolledDebt,
        r.firstPaymentAt, r.payoutAmount, r.payoutAt, r.period, batchId],
    );
    imported += 1;
  }

  await query(`update ao_import_batches set rows_imported = $2 where id = $1`, [batchId, imported]);
  return NextResponse.json({ ok: true, batchId, imported, ...summary(parsed) });
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
    sample: parsed.rows.slice(0, 3),
  };
}
