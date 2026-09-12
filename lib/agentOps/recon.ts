import type { BackendFile, Enrollment, MatchStatus, ReconMatch } from './types';

/**
 * Reconciliation — the rep's claim against the backend's record.
 *
 * What a rep enters in GoHighLevel is a claim. What Level Debt, Shield and
 * Legacy report — file status, first payment, payout to Funding Tier — is the
 * money. This matches one to the other and names the difference:
 *
 *   matched              both agree
 *   amount_mismatch      matched, but enrolled debt differs beyond tolerance
 *   status_mismatch      backend says cancelled / refunded; GHL still says won
 *   missing_at_backend   the rep is credited with a deal the backend never got
 *   unclaimed_at_backend the backend paid on a file no rep is credited with
 *
 * Matching is deliberately conservative: a phone number is a strong key, a
 * name is not. Anything below the confidence floor is left unmatched and
 * surfaces for a human rather than being quietly paired.
 */

/** Enrolled-debt difference allowed before a match is called a mismatch. */
export const AMOUNT_TOLERANCE_PCT = Number(process.env.AO_AMOUNT_TOLERANCE_PCT || 2);

const CANCELLED = /cancel|refund|chargeback|void|nsf|withdraw/i;
const WON = /won|enrolled|active|funded/i;

const digits = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '').slice(-10) || '';

/** "Robert J. Smith Jr." → "robert smith" — enough to compare, not to trust alone. */
function nameKey(v: string | null | undefined): string {
  const cleaned = (v ?? '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\b(jr|sr|ii|iii|iv|mr|mrs|ms|dr)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = cleaned.split(' ').filter(Boolean);
  if (parts.length <= 1) return cleaned;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

export interface ReconInput {
  enrollments: Enrollment[];
  files: BackendFile[];
}

export interface ReconRow extends Omit<ReconMatch, 'id'> {
  enrollment: Enrollment | null;
  file: BackendFile | null;
  /** Why this row is what it is, in one line, for the UI. */
  explanation: string;
}

export function reconcile({ enrollments, files }: ReconInput): ReconRow[] {
  const rows: ReconRow[] = [];
  const usedFiles = new Set<number>();

  const byPhone = new Map<string, BackendFile[]>();
  const byName = new Map<string, BackendFile[]>();
  const byExternal = new Map<string, BackendFile>();

  for (const f of files) {
    const p = digits(f.clientPhone);
    if (p) (byPhone.get(p) ?? byPhone.set(p, []).get(p)!).push(f);
    const n = nameKey(f.clientName);
    if (n) (byName.get(n) ?? byName.set(n, []).get(n)!).push(f);
    if (f.externalId) byExternal.set(f.externalId, f);
  }

  for (const e of enrollments) {
    const candidates: Array<{ file: BackendFile; method: ReconMatch['method']; confidence: number }> = [];

    const p = digits(e.clientPhone);
    if (p) (byPhone.get(p) ?? []).filter((f) => f.backend === e.backend || e.backend === 'UNKNOWN')
      .forEach((f) => candidates.push({ file: f, method: 'phone', confidence: 0.95 }));

    if (candidates.length === 0) {
      const n = nameKey(e.clientName);
      const sameName = (byName.get(n) ?? []).filter((f) => f.backend === e.backend || e.backend === 'UNKNOWN');
      for (const f of sameName) {
        const last4 = (f.clientLast4 ?? '').slice(-4);
        const phoneLast4 = p.slice(-4);
        if (last4 && phoneLast4 && last4 === phoneLast4) {
          candidates.push({ file: f, method: 'last4_name', confidence: 0.85 });
        } else if (e.enrolledDebt && f.enrolledDebt && withinTolerance(e.enrolledDebt, f.enrolledDebt)) {
          candidates.push({ file: f, method: 'name_debt', confidence: 0.7 });
        }
      }
    }

    const best = candidates.sort((a, b) => b.confidence - a.confidence)
      .find((c) => !usedFiles.has(c.file.id));

    if (!best) {
      rows.push({
        enrollmentId: e.id, backendFileId: null, status: 'missing_at_backend',
        method: null, confidence: 0, deltaAmount: null,
        enrollment: e, file: null,
        explanation: `Credited to the rep in GoHighLevel, but no ${e.backend === 'UNKNOWN' ? 'backend' : e.backend} file matches this client.`,
      });
      continue;
    }

    usedFiles.add(best.file.id);
    const delta = e.enrolledDebt != null && best.file.enrolledDebt != null
      ? Number((best.file.enrolledDebt - e.enrolledDebt).toFixed(2))
      : null;

    let status: MatchStatus = 'matched';
    let explanation = 'GoHighLevel and the backend agree on this file.';

    if (CANCELLED.test(best.file.fileStatus ?? '') && WON.test(e.status ?? e.stage ?? '')) {
      status = 'status_mismatch';
      explanation = `Backend reports "${best.file.fileStatus}" while GoHighLevel still shows ${e.status ?? e.stage}.`;
    } else if (delta != null && !withinTolerance(e.enrolledDebt!, best.file.enrolledDebt!)) {
      status = 'amount_mismatch';
      explanation = `Enrolled debt differs by ${delta >= 0 ? '+' : ''}${delta.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}.`;
    }

    rows.push({
      enrollmentId: e.id, backendFileId: best.file.id, status,
      method: best.method, confidence: best.confidence, deltaAmount: delta,
      enrollment: e, file: best.file, explanation,
    });
  }

  // Files the backend paid on that nobody is credited with. These are the
  // expensive ones: revenue with no rep attached, or a rep who never logged it.
  for (const f of files) {
    if (usedFiles.has(f.id)) continue;
    rows.push({
      enrollmentId: null, backendFileId: f.id, status: 'unclaimed_at_backend',
      method: null, confidence: 0, deltaAmount: null,
      enrollment: null, file: f,
      explanation: 'The backend has this file, but no GoHighLevel enrollment matches it — nobody is credited.',
    });
  }

  return rows;
}

function withinTolerance(a: number, b: number): boolean {
  if (!a && !b) return true;
  const base = Math.max(Math.abs(a), Math.abs(b), 1);
  return (Math.abs(a - b) / base) * 100 <= AMOUNT_TOLERANCE_PCT;
}

export function reconSummary(rows: ReconRow[]) {
  const count = (s: MatchStatus) => rows.filter((r) => r.status === s).length;
  const money = (s: MatchStatus) => rows.filter((r) => r.status === s)
    .reduce((sum, r) => sum + (r.file?.payoutAmount ?? 0), 0);
  return {
    total: rows.length,
    matched: count('matched'),
    amountMismatch: count('amount_mismatch'),
    statusMismatch: count('status_mismatch'),
    missingAtBackend: count('missing_at_backend'),
    unclaimedAtBackend: count('unclaimed_at_backend'),
    confirmedPayout: money('matched') + money('amount_mismatch'),
    unclaimedPayout: money('unclaimed_at_backend'),
  };
}
