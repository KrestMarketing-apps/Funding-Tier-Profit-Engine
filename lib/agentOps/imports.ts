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
  // Draft-level fields — present on payment-level exports only.
  draftNumber: ['draft number', 'draft no', 'draft #', 'payment number'],
  draftDueAt: ['draft due date', 'due date', 'scheduled date'],
  draftClearedAt: ['draft cleared date', 'date cleared', 'cleared date'],
  draftReturnedAt: ['draft returned date', 'returned date'],
  draftStatus: ['draft status', 'cleared status', 'payment status'],
  draftAmount: ['draft total amount', 'draft amount', 'cleared amount'],
  frequency: ['payment frequency', 'declared frequency'],
  clearedCount: ['applicant total cleared payments', 'total cleared payments'],
  programLength: ['program length'],
  paymentCount: ['payment count'],
};

/** Words that disqualify a header from being the CLIENT name column. */
const NOT_CLIENT = /\b(owner|rep|agent|affiliate|servicing|plan|product|company|first|last)\b/;
/** Short synonyms that must match a whole header, never a fragment of one. */
const EXACT_ONLY = new Set(['payment number', 'rep', 'agent', 'name', 'client', 'status', 'stage', 'phone', 'cell', 'closer', 'reference', 'payout', 'commission']);

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

/** One client draft, as a backend reported it. */
export interface ParsedDraft {
  backend: BackendKey;
  fileKey: string;
  draftKey: string;
  draftNumber: number | null;
  dueAt: string | null;
  clearedAt: string | null;
  returnedAt: string | null;
  /** 'disputed' = the client disputed or charged back the payment (ACH unauthorized returns included). */
  status: 'scheduled' | 'cleared' | 'nsf' | 'returned' | 'skipped' | 'cancelled' | 'disputed';
  amount: number | null;
  source: 'backend_report' | 'inferred';
}

export type DeclaredSchedule = 'standard' | 'split' | null;

/** "Monthly" → standard; "Bi-Weekly", "Semi-Monthly", "Split" → split. Anything else: not stated. */
export function scheduleFromText(v: string | null | undefined): DeclaredSchedule {
  const t = (v ?? '').toLowerCase();
  if (!t.trim()) return null;
  if (/bi-?\s?weekly|semi-?\s?monthly|split|twice|every other/.test(t)) return 'split';
  if (/month/.test(t)) return 'standard';
  return null;
}

function draftStatus(raw: string | undefined, clearedAt: string | null, returnedAt: string | null): ParsedDraft['status'] {
  const t = (raw ?? '').toLowerCase();
  if (/dispute|chargeback|charge back|unauthori|\br(05|07|10|29)\b/.test(t)) return 'disputed';
  if (/nsf|insufficient/.test(t)) return 'nsf';
  if (/return|reject|fail|declin/.test(t) || returnedAt) return 'returned';
  if (/cancel|void/.test(t)) return 'cancelled';
  if (/skip/.test(t)) return 'skipped';
  if (/clear|paid|processed|success|complete/.test(t) || clearedAt) return 'cleared';
  return 'scheduled';
}

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
  /** Individual drafts, when the report is payment-level. */
  drafts: ParsedDraft[];
  /** Plan type per file key, where the report states or implies it. */
  declared: Record<string, DeclaredSchedule>;
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
  const empty = { backend, rows: [], columnMap: {}, unmapped: [], missing: [], warnings: [], parsed: 0, otherAffiliate: 0, collapsed: 0, drafts: [], declared: {} };
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
  const drafts = new Map<string, ParsedDraft>();
  const declared: Record<string, DeclaredSchedule> = {};
  const isDraftLevel = ['draftClearedAt', 'draftDueAt', 'draftNumber', 'draftStatus'].some((f) => f in map);
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
    const fileKey = fileKeyFor(externalId, clientName);

    // Plan type, where stated: a frequency column, or (Salesforce) a payment
    // count that is the program length or twice it.
    const freq = scheduleFromText(at('frequency'));
    if (freq) declared[fileKey] = freq;
    const len = toNumber(at('programLength'));
    const cnt = toNumber(at('paymentCount'));
    if (!declared[fileKey] && len && cnt) {
      if (cnt === len) declared[fileKey] = 'standard';
      else if (cnt === len * 2) declared[fileKey] = 'split';
    }

    if (isDraftLevel) {
      const clearedAt = toDate(at('draftClearedAt'));
      const returnedAt = toDate(at('draftReturnedAt'));
      const dueAt = toDate(at('draftDueAt'));
      const num = toNumber(at('draftNumber'));
      const status = draftStatus(at('draftStatus'), clearedAt, returnedAt);
      // A row with no draft information at all (a client with no plan yet) is not a draft.
      if (num != null || clearedAt || dueAt || returnedAt) {
        const draftKey = num != null ? `#${num}` : (clearedAt ?? dueAt ?? returnedAt) as string;
        const prevDraft = drafts.get(`${fileKey}|${draftKey}`);
        // The same draft reported twice keeps its most final state.
        if (!prevDraft || rank(status) > rank(prevDraft.status)) {
          drafts.set(`${fileKey}|${draftKey}`, {
            backend, fileKey, draftKey, draftNumber: num, dueAt, clearedAt, returnedAt, status,
            amount: toNumber(at('draftAmount')), source: 'backend_report',
          });
        }
      }
    } else {
      // Count-only reports (Salesforce): N cleared payments and a first payment
      // date. Reconstruct the cleared drafts and MARK them inferred — only the
      // first date is real, so only the count and first date are relied on.
      const cleared = toNumber(at('clearedCount'));
      const firstAt = toDate(at('firstPaymentAt'));
      if (cleared && cleared > 0 && firstAt) {
        const step = declared[fileKey] === 'split' ? 14 : 30;
        for (let k = 0; k < cleared; k += 1) {
          const dt = new Date(Date.parse(`${firstAt}T00:00:00Z`) + k * step * 86_400_000).toISOString().slice(0, 10);
          drafts.set(`${fileKey}|#${k + 1}`, {
            backend, fileKey, draftKey: `#${k + 1}`, draftNumber: k + 1, dueAt: dt, clearedAt: dt, returnedAt: null,
            status: 'cleared', amount: null, source: 'inferred',
          });
        }
      }
    }
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
  if (drafts.size) warnings.push(`${drafts.size} individual drafts recorded for payment tracking.`);
  if (!('repName' in map)) warnings.push('No rep/agent column — the rep cross-check will not run for this file.');
  if (missing.length) errors.push(`Could not find a column for: ${missing.join(', ')}. Check the header row in ${filename}.`);
  if (rows.length && rows.every((x) => !x.clientPhone) && rows.some((x) => !x.externalId)) {
    warnings.push('No phone column — these files can only match on a file id entered in GHL, or on name plus debt/date.');
  }
  return {
    backend, rows, columnMap: map, unmapped, missing, errors, warnings,
    drafts: Array.from(drafts.values()), declared,
    parsed: dataRows + otherAffiliate, otherAffiliate, collapsed: dataRows - rows.length,
  };
}

/** The key a backend file's drafts are stored under: its id, else its name. */
export function fileKeyFor(externalId: string | null | undefined, clientName: string | null | undefined): string {
  const id = (externalId ?? '').trim();
  if (id) return `id:${id.toLowerCase()}`;
  return `name:${(clientName ?? '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()}`;
}

const rank = (s: ParsedDraft['status']) => ({ scheduled: 0, skipped: 1, cleared: 2, cancelled: 2, returned: 3, nsf: 3, disputed: 4 }[s]);
