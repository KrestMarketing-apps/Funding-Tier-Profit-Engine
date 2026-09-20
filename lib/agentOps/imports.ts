import type { BackendFile, BackendKey } from './types';

/**
 * Backend report ingestion.
 *
 * Level Debt, Shield and Legacy each send a different spreadsheet with
 * different column names for the same five facts: who the client is, what the
 * file's status is, how much debt was enrolled, and what they paid Funding
 * Tier and when. Rather than one parser per backend that breaks when they
 * rename a column, the header row is matched against synonym lists and the
 * mapping it resolved is reported back, so a failed match is visible instead
 * of silently producing nulls.
 *
 * CSV and TSV are parsed here. For .xlsx, export to CSV first — adding a
 * spreadsheet parser is a dependency this app does not otherwise need.
 */

/**
 * Header synonyms, most specific first — the first synonym that appears in a
 * header wins, so order matters. Written against the real exports: Forth's
 * draft schedule, Consumer Shield's payment-level pull and its First Cleared /
 * Member Cleared reports, and ELP's Salesforce "Total Enrollments" report.
 */
export const FIELD_SYNONYMS: Record<string, string[]> = {
  externalId: ['file ref', 'file id', 'fileid', 'file #', 'client id', 'account id', 'account number', 'case id', 'case number', 'reference'],
  clientName: ['applicant full name', 'client name', 'customer name', 'debtor name', 'member name', 'full name', 'client', 'customer', 'debtor', 'name'],
  firstName: ['member first name', 'first name', 'firstname'],
  lastName: ['member last name', 'last name', 'lastname'],
  clientPhone: ['phone number', 'primary phone', 'mobile', 'cell', 'phone', 'contact number'],
  clientLast4: ['ssn last 4', 'last 4', 'last4', 'last four'],
  fileStatus: ['file status', 'member status', 'account status', 'applicant stage', 'status', 'stage', 'current status', 'disposition'],
  enrolledDebt: ['current enrolled debt', 'enrolled debt amount', 'enrolled debt', 'total debt amount', 'total enrolled', 'total debt', 'enrolled amount', 'debt amount'],
  enrolledAt: ['applicant enrolled date', 'enrolled date', 'enrollment date', 'date enrolled'],
  firstPaymentAt: ['first payment date', 'first draft date', 'first payment', 'first draft', 'initial payment'],
  payoutAmount: ['payout amount', 'commission paid', 'payout', 'commission', 'remittance', 'amount paid to affiliate'],
  payoutAt: ['payout date', 'commission date', 'remittance date', 'date paid'],
  repName: ['applicant contact owner full name', 'representative name', 'repname', 'rep name', 'sales rep', 'sales agent', 'assigned to', 'contact owner', 'closer', 'rep', 'agent', 'salesperson'],
  affiliate: ['affiliate name', 'affiliate'],
};

/** Words that disqualify a header from being the CLIENT name column. */
const NOT_CLIENT = /\b(owner|rep|agent|affiliate|servicing|plan|product|company|first|last)\b/;
/** Short synonyms that must match a whole header, never a fragment of one. */
const EXACT_ONLY = new Set(['rep', 'agent', 'name', 'client', 'status', 'stage', 'phone', 'cell', 'closer', 'reference', 'payout', 'commission']);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** RFC4180-ish: quoted fields, embedded commas, doubled quotes, CRLF. */
export function parseDelimited(text: string): string[][] {
  const first = text.split(/\r?\n/)[0] ?? '';
  const delim = (first.match(/\t/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === delim) { row.push(field); field = ''; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    if (ch === '\r') continue;
    field += ch;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export interface ColumnMap { [field: string]: number }

export function mapColumns(header: string[]): { map: ColumnMap; unmapped: string[]; missing: string[] } {
  const map: ColumnMap = {};
  const normalised = header.map(norm);
  const used = new Set<number>();

  // Pass 1: whole-header matches, synonym order. Pass 2: a multi-word synonym
  // inside a longer header ("Applicant: Enrolled Date"). A column is only
  // ever claimed once, so "Contact Owner: Full Name" cannot also be the client.
  for (const pass of [1, 2]) {
    for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS)) {
      if (field in map) continue;
      for (const syn of synonyms) {
        if (pass === 2 && EXACT_ONLY.has(syn)) continue;
        const idx = normalised.findIndex((h, i) => !used.has(i)
          && (pass === 1 ? h === syn : h.includes(syn))
          && !(field === 'clientName' && NOT_CLIENT.test(h) && h !== 'applicant full name'));
        if (idx !== -1) { map[field] = idx; used.add(idx); break; }
      }
    }
  }
  const hasName = 'clientName' in map || ('firstName' in map && 'lastName' in map);
  return {
    map,
    unmapped: header.filter((_, i) => !used.has(i)),
    missing: [!hasName && !('externalId' in map) ? 'client name or file id' : '', !('fileStatus' in map) ? 'fileStatus' : '']
      .filter(Boolean),
  };
}

const toNumber = (v: string | undefined): number | null => {
  if (!v) return null;
  const neg = /^\(.*\)$/.test(v.trim());
  const n = Number(v.replace(/[()]/g, '').replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
};

const toDate = (v: string | undefined): string | null => {
  if (!v || !v.trim()) return null;
  const d = new Date(v.trim().replace(/,\s*/, ' '));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

export interface ParsedImport {
  backend: BackendKey;
  rows: Array<Omit<BackendFile, 'id' | 'batchId'>>;
  columnMap: ColumnMap;
  unmapped: string[];
  missing: string[];
  errors: string[];
  /** Not blocking — things the uploader should know about this file. */
  warnings: string[];
  parsed: number;
  /** Rows dropped because the affiliate column named someone other than us. */
  otherAffiliate: number;
  /** Draft/payment rows folded into one file row per client. */
  collapsed: number;
}

/** Which affiliate rows belong to us, in reports that cover every affiliate. */
const OUR_AFFILIATE = new RegExp(process.env.AO_AFFILIATE_PATTERN || 'funding\\s*tier', 'i');

/**
 * Parse one backend report into FILE-level rows.
 *
 * Several of these exports are payment- or draft-level: one row per draft, so
 * a client appears once per payment. Reconciliation works on files, so rows
 * are folded per client (file id, else name): first non-empty value per
 * field, the earliest first-payment date, the latest status. The draft rows
 * themselves are the vesting engine's input, not this one's.
 */
export function parseBackendReport(backend: BackendKey, filename: string, text: string, period?: string): ParsedImport {
  const grid = parseDelimited(text.replace(/^\uFEFF/, ''));
  const empty = { backend, rows: [], columnMap: {}, unmapped: [], missing: [], warnings: [], parsed: 0, otherAffiliate: 0, collapsed: 0 };
  if (grid.length < 2) return { ...empty, errors: ['File has no data rows.'] };

  // Some backends prefix the sheet with title and filter rows; the header is
  // the row, within the first 30, that maps the most known fields.
  let best = { idx: 0, hits: -1 };
  for (let i = 0; i < Math.min(grid.length, 30); i += 1) {
    const hits = Object.keys(mapColumns(grid[i]).map).length;
    if (hits > best.hits) best = { idx: i, hits };
  }
  const headerIdx = best.idx;
  const header = grid[headerIdx];
  const { map, unmapped, missing } = mapColumns(header);
  const errors: string[] = [];
  const warnings: string[] = [];
  const byKey = new Map<string, Omit<BackendFile, 'id' | 'batchId'>>();
  let otherAffiliate = 0;
  let dataRows = 0;
  let lastStage: string | null = null;

  for (let i = headerIdx + 1; i < grid.length; i += 1) {
    const r = grid[i];
    const at = (field: string): string | undefined => {
      const v = map[field] === undefined ? undefined : r[map[field]]?.trim();
      return v ? v : undefined;
    };
    // Salesforce summary reports print a grouping value (the stage) once and
    // leave it blank beneath; carry it down.
    const stageRaw = at('fileStatus');
    if (stageRaw) lastStage = stageRaw;

    const affiliate = at('affiliate');
    if (affiliate && !OUR_AFFILIATE.test(affiliate)) { otherAffiliate += 1; continue; }

    const joined = [at('firstName'), at('lastName')].filter(Boolean).join(' ').trim();
    const clientName = at('clientName') ?? (joined || null);
    const externalId = at('externalId') ?? null;
    if (!clientName && !externalId) continue;                     // blank row
    if (/^(total|sum|avg|count|subtotal)$/i.test(r.find((c) => c.trim())?.trim() ?? '')) continue;
    dataRows += 1;

    const row: Omit<BackendFile, 'id' | 'batchId'> = {
      backend,
      externalId,
      clientName,
      clientPhone: (at('clientPhone') ?? '').replace(/\D/g, '').slice(-10) || null,
      clientLast4: at('clientLast4') ?? null,
      repName: at('repName') ?? null,
      fileStatus: stageRaw ?? lastStage,
      enrolledDebt: toNumber(at('enrolledDebt')),
      enrolledAt: toDate(at('enrolledAt')),
      firstPaymentAt: toDate(at('firstPaymentAt')),
      payoutAmount: toNumber(at('payoutAmount')),
      payoutAt: toDate(at('payoutAt')),
      period: period ?? null,
    };

    const key = (externalId ?? clientName ?? '').toLowerCase();
    const prev = byKey.get(key);
    if (!prev) { byKey.set(key, row); continue; }
    for (const k of Object.keys(row) as Array<keyof typeof row>) {
      if ((prev as any)[k] == null && (row as any)[k] != null) (prev as any)[k] = (row as any)[k];
    }
    if (row.firstPaymentAt && prev.firstPaymentAt && row.firstPaymentAt < prev.firstPaymentAt) prev.firstPaymentAt = row.firstPaymentAt;
    if (row.fileStatus) prev.fileStatus = row.fileStatus;          // later rows carry the current status
  }

  const rows = Array.from(byKey.values());
  if (otherAffiliate) warnings.push(`${otherAffiliate} rows belonged to other affiliates and were skipped.`);
  if (dataRows > rows.length) warnings.push(`${dataRows} payment rows folded into ${rows.length} client files.`);
  if (!('repName' in map)) warnings.push('No rep/agent column — the rep cross-check will not run for this file.');
  if (missing.length) errors.push(`Could not find a column for: ${missing.join(', ')}. Check the header row in ${filename}.`);
  if (rows.length && rows.every((x) => !x.clientPhone) && rows.some((x) => !x.externalId)) {
    warnings.push('No phone column — these files can only match on a file id entered in GHL, or on name plus debt/date.');
  }
  return {
    backend, rows, columnMap: map, unmapped, missing, errors, warnings,
    parsed: dataRows + otherAffiliate, otherAffiliate, collapsed: dataRows - rows.length,
  };
}
