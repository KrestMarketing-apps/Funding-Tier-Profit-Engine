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

export const FIELD_SYNONYMS: Record<string, string[]> = {
  externalId: ['file id', 'fileid', 'file #', 'account id', 'account number', 'client id', 'case id', 'case number', 'id', 'reference', 'ref'],
  clientName: ['client', 'client name', 'customer', 'customer name', 'name', 'debtor', 'debtor name', 'full name'],
  clientPhone: ['phone', 'phone number', 'mobile', 'cell', 'primary phone', 'contact number'],
  clientLast4: ['last 4', 'last4', 'ssn last 4', 'last four'],
  fileStatus: ['status', 'file status', 'account status', 'stage', 'disposition', 'current status'],
  enrolledDebt: ['enrolled debt', 'debt', 'total debt', 'enrolled amount', 'balance', 'total enrolled', 'debt amount'],
  firstPaymentAt: ['first payment', 'first payment date', 'first draft', 'first draft date', 'initial payment'],
  payoutAmount: ['payout', 'payout amount', 'commission', 'commission paid', 'paid', 'amount paid', 'revenue', 'remittance'],
  payoutAt: ['payout date', 'paid date', 'date paid', 'remittance date', 'commission date'],
};

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

  for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    let idx = normalised.findIndex((h) => synonyms.includes(h));
    if (idx === -1) idx = normalised.findIndex((h) => synonyms.some((s) => h.includes(s)));
    if (idx !== -1) map[field] = idx;
  }
  const used = new Set(Object.values(map));
  return {
    map,
    unmapped: header.filter((_, i) => !used.has(i)),
    missing: ['clientName', 'fileStatus'].filter((f) => !(f in map)),
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
  const d = new Date(v.trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

export interface ParsedImport {
  backend: BackendKey;
  rows: Array<Omit<BackendFile, 'id' | 'batchId'>>;
  columnMap: ColumnMap;
  unmapped: string[];
  missing: string[];
  errors: string[];
  parsed: number;
}

export function parseBackendReport(backend: BackendKey, filename: string, text: string, period?: string): ParsedImport {
  const grid = parseDelimited(text);
  if (grid.length < 2) {
    return { backend, rows: [], columnMap: {}, unmapped: [], missing: [], errors: ['File has no data rows.'], parsed: 0 };
  }
  // Some backends prefix the sheet with a title row; the header is the first
  // row that maps at least three known fields.
  let headerIdx = 0;
  let best = { idx: 0, hits: -1 };
  for (let i = 0; i < Math.min(grid.length, 8); i += 1) {
    const hits = Object.keys(mapColumns(grid[i]).map).length;
    if (hits > best.hits) best = { idx: i, hits };
  }
  headerIdx = best.idx;

  const header = grid[headerIdx];
  const { map, unmapped, missing } = mapColumns(header);
  const errors: string[] = [];
  const rows: ParsedImport['rows'] = [];

  for (let i = headerIdx + 1; i < grid.length; i += 1) {
    const r = grid[i];
    const at = (field: string): string | undefined => (map[field] === undefined ? undefined : r[map[field]]?.trim());
    const clientName = at('clientName') ?? null;
    const externalId = at('externalId') ?? null;
    if (!clientName && !externalId) continue;      // blank or total row

    rows.push({
      backend,
      externalId,
      clientName,
      clientPhone: (at('clientPhone') ?? '').replace(/\D/g, '').slice(-10) || null,
      clientLast4: at('clientLast4') ?? null,
      fileStatus: at('fileStatus') ?? null,
      enrolledDebt: toNumber(at('enrolledDebt')),
      firstPaymentAt: toDate(at('firstPaymentAt')),
      payoutAmount: toNumber(at('payoutAmount')),
      payoutAt: toDate(at('payoutAt')),
      period: period ?? null,
    });
  }

  if (missing.length) errors.push(`Could not find a column for: ${missing.join(', ')}. Check the header row in ${filename}.`);
  return { backend, rows, columnMap: map, unmapped, missing, errors, parsed: grid.length - headerIdx - 1 };
}
