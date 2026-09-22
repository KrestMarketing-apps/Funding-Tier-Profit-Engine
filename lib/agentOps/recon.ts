import type { Agent, BackendFile, Enrollment, MatchStatus, ReconMatch } from './types';
import { BACKEND_LABEL } from './types';

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
 *   rep_mismatch         the backend's rep column names a different agent
 *   payout_mismatch      Shield: the deal is marked buyout / perpetual in GHL but the
 *                        file came in under the other Consumer Shield login
 *   missing_at_backend   the rep is credited with a deal the backend never got
 *   unclaimed_at_backend the backend paid on a file no rep is credited with
 *
 * Matching is deliberately conservative: the backend file id (when entered on
 * the deal) and the phone number are strong keys; a name is not, and only
 * counts alongside a second agreeing fact. Anything below the confidence floor is left unmatched and
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
  /** Used to read a backend's rep column back to one of our agents. */
  agents?: Agent[];
}

export interface ReconRow extends Omit<ReconMatch, 'id'> {
  enrollment: Enrollment | null;
  file: BackendFile | null;
  /** Why this row is what it is, in one line, for the UI. */
  explanation: string;
}

/** The rep who gets credit: the frozen closer, else the current owner. */
export const creditedAgent = (e: Enrollment | null | undefined): string | null =>
  (e ? e.closerId ?? e.agentId : null);

/** Enrolled date proximity allowed for a name-only match, in days. */
const NAME_DATE_WINDOW_DAYS = Number(process.env.AO_NAME_DATE_WINDOW_DAYS || 45);

const dayGap = (a: string | null, b: string | null): number | null => {
  if (!a || !b) return null;
  const d = Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400_000;
  return Number.isFinite(d) ? d : null;
};

/**
 * A backend's rep column only counts if it names one of our agents. Backends
 * put the file owner or a desk label there ("Forth Team", "Unassigned",
 * "Member Servces", "agent 104") far more often than the closer, and a label
 * that names nobody is not evidence of anything.
 */
function repToAgent(repName: string | null, agents: Agent[]): Agent | null {
  if (!repName) return null;
  // Vendor desks tag their reps: "Alexia Mcallister-Foggy", "Michael Germino-foggy1".
  const variants = [repName, repName.replace(/\s*[-–]\s*[A-Za-z]+\d*\s*$/, '')];
  for (const v of variants) {
    const key = nameKey(v);
    if (!key || !key.includes(' ')) continue;
    const hit = agents.find((a) => nameKey(a.name) === key);
    if (hit) return hit;
  }
  return null;
}

export function reconcile({ enrollments: all, files, agents = [] }: ReconInput): ReconRow[] {
  const rows: ReconRow[] = [];
  const usedFiles = new Set<number>();
  // Only deals that reached an enrolled stage are reconciled. Pitched and
  // in-progress opportunities have no backend file yet by definition.
  const enrollments = all.filter((e) => e.isEnrolled);

  const byPhone = new Map<string, BackendFile[]>();
  const byName = new Map<string, BackendFile[]>();
  const byExternal = new Map<string, BackendFile[]>();
  const push = (m: Map<string, BackendFile[]>, k: string, f: BackendFile) =>
    (m.get(k) ?? m.set(k, []).get(k)!).push(f);

  for (const f of files) {
    const p = digits(f.clientPhone);
    if (p) push(byPhone, p, f);
    const n = nameKey(f.clientName);
    if (n) push(byName, n, f);
    if (f.externalId) push(byExternal, f.externalId.trim().toLowerCase(), f);
  }

  const sameBackend = (e: Enrollment) => (f: BackendFile) => f.backend === e.backend || e.backend === 'UNKNOWN';
  const matchedBy = new Map<string, { enrollment: Enrollment; phone: string; name: string }>();

  for (const e of enrollments) {
    const candidates: Array<{ file: BackendFile; method: ReconMatch['method']; confidence: number }> = [];
    const fits = sameBackend(e);

    // 1. The backend's own file id, entered on the deal in GHL. Definitive.
    if (e.backendFileRef) {
      (byExternal.get(e.backendFileRef.trim().toLowerCase()) ?? []).filter(fits)
        .forEach((f) => candidates.push({ file: f, method: 'file_ref', confidence: 0.99 }));
    }

    // 2. Phone number.
    const p = digits(e.clientPhone);
    if (candidates.length === 0 && p) {
      (byPhone.get(p) ?? []).filter(fits)
        .forEach((f) => candidates.push({ file: f, method: 'phone', confidence: 0.95 }));
    }

    // 3. Name, only with a second fact agreeing — the enrolled debt, or the
    //    enrollment date. A name alone is never enough to pay someone on.
    if (candidates.length === 0) {
      const n = nameKey(e.clientName);
      for (const f of (byName.get(n) ?? []).filter(fits)) {
        if (e.enrolledDebt && f.enrolledDebt && withinTolerance(e.enrolledDebt, f.enrolledDebt)) {
          candidates.push({ file: f, method: 'name_debt', confidence: 0.8 });
          continue;
        }
        const gap = dayGap(e.firstEnrolledAt ?? e.enrolledAt, f.enrolledAt ?? f.firstPaymentAt);
        if (gap !== null && gap <= NAME_DATE_WINDOW_DAYS) {
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
        explanation: `Credited to the rep in GoHighLevel, but no ${e.backend === 'UNKNOWN' ? 'backend' : BACKEND_LABEL[e.backend]} file matches this client.`
          + (e.backend === 'UNKNOWN' ? ' The deal has no backend set, so every backend was searched.' : ''),
      });
      continue;
    }

    usedFiles.add(best.file.id);
    matchedBy.set(String(best.file.id), { enrollment: e, phone: p ?? '', name: nameKey(e.clientName) });
    rows.push(judge(e, best.file, best.method, best.confidence, agents));
  }

  // Extra files for a client who is already matched. ELP cancels and
  // re-enrolls after an NSF, and Shield has been seen to duplicate a member,
  // so one GHL deal can legitimately own several backend files. They are
  // attached to the same deal, never shown as "nobody credited".
  const matchedList = Array.from(matchedBy.values());
  for (const f of files) {
    if (usedFiles.has(f.id)) continue;
    const fp = digits(f.clientPhone);
    const fn = nameKey(f.clientName);
    const owner = matchedList.find((m) => sameBackend(m.enrollment)(f)
      && ((fp && m.phone && fp === m.phone) || (fn && m.name && fn === m.name
        && (m.enrollment.backend === 'LEGACY' || f.backend === 'LEGACY'))));
    if (!owner) continue;
    usedFiles.add(f.id);
    const row = judge(owner.enrollment, f, 'reenrollment', 0.9, agents);
    row.explanation = `Additional ${BACKEND_LABEL[f.backend]} file for the same client (re-enrollment). ${row.explanation}`;
    rows.push(row);
  }

  // Files the backend has that nobody is credited with. These are the
  // expensive ones: revenue with no rep attached, or a rep who never logged it.
  for (const f of files) {
    if (usedFiles.has(f.id)) continue;
    rows.push({
      enrollmentId: null, backendFileId: f.id, status: 'unclaimed_at_backend',
      method: null, confidence: 0, deltaAmount: null,
      enrollment: null, file: f,
      explanation: 'The backend has this file, but no enrolled GoHighLevel deal matches it — nobody is credited.'
        + (f.repName ? ` The backend lists "${f.repName}" on it.` : ''),
    });
  }

  return rows;
}

function judge(
  e: Enrollment, file: BackendFile, method: ReconMatch['method'], confidence: number, agents: Agent[],
): ReconRow {
  const delta = e.enrolledDebt != null && file.enrolledDebt != null
    ? Number((file.enrolledDebt - e.enrolledDebt).toFixed(2))
    : null;

  let status: MatchStatus = 'matched';
  let explanation = 'GoHighLevel and the backend agree on this file.';
  const backendRep = repToAgent(file.repName, agents);
  const credited = creditedAgent(e);

  if (CANCELLED.test(file.fileStatus ?? '') && WON.test(e.status ?? e.stage ?? '')) {
    status = 'status_mismatch';
    explanation = `Backend reports "${file.fileStatus}" while GoHighLevel still shows ${e.status ?? e.stage}.`;
  } else if (backendRep && credited && backendRep.id !== credited) {
    const creditedName = agents.find((a) => a.id === credited)?.name ?? credited;
    status = 'rep_mismatch';
    explanation = `The backend has ${backendRep.name} on this file; GoHighLevel credits ${creditedName}.`;
  } else if (file.backend === 'CS' && e.csPayout && file.csPayout && e.csPayout !== file.csPayout) {
    status = 'payout_mismatch';
    const lbl = (x: string) => (x === 'buyout' ? 'File Buyout' : 'Perpetual');
    explanation = `GoHighLevel has this Shield deal as ${lbl(e.csPayout)}, but Consumer Shield reported it under the ${lbl(file.csPayout)} login. It pays ${file.csPayout === 'buyout' ? 'one advance, not a monthly share' : 'monthly, not an advance'} — fix whichever is wrong.`;
  } else if (delta != null && !withinTolerance(e.enrolledDebt!, file.enrolledDebt!)) {
    status = 'amount_mismatch';
    explanation = `Enrolled debt differs by ${delta >= 0 ? '+' : ''}${delta.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}.`;
  }
  if (method === 'name_debt' && status === 'matched') {
    explanation = 'Matched on client name plus debt or enrollment date — no phone or file id to confirm it.';
  }
  if (e.closerSource === 'backfill') explanation += ' Rep credit is the owner at first sync, not a stamped closer.';

  return {
    enrollmentId: e.id, backendFileId: file.id, status,
    method, confidence, deltaAmount: delta,
    enrollment: e, file, explanation,
  };
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
    repMismatch: count('rep_mismatch'),
    payoutMismatch: count('payout_mismatch'),
    missingAtBackend: count('missing_at_backend'),
    unclaimedAtBackend: count('unclaimed_at_backend'),
    confirmedPayout: money('matched') + money('amount_mismatch') + money('rep_mismatch') + money('payout_mismatch'),
    unclaimedPayout: money('unclaimed_at_backend'),
  };
}
