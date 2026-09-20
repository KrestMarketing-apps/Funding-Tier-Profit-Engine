/* Reconciliation + rep credit rules — run with: npx tsx scripts/recon.test.ts
 * Weighted toward the cases that pay the wrong rep or hide a real problem:
 * credit following a reassignment, pitched deals drowning the report, and a
 * backend rep label that names nobody being read as a dispute.
 */
import { reconcile, reconSummary } from '../lib/agentOps/recon';
import { backendFromText, isEnrolledStage, isInitialEnrollmentStage } from '../lib/agentOps/ghl';
import { parseBackendReport } from '../lib/agentOps/imports';
import type { Agent, BackendFile, Enrollment } from '../lib/agentOps/types';

let failures = 0;
function check(name: string, pass: boolean, detail = '') {
  if (!pass) failures += 1;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

const agent = (id: string, name: string): Agent => ({
  id, locationId: 'loc', name, email: null, role: null, employmentType: null,
  hourlyRate: null, scheduledHoursPerWeek: null, team: null, active: true,
});
const AGENTS = [agent('u_alexia', 'Alexia Mcallister'), agent('u_dan', 'Daniel Rivera'), agent('u_wc', 'Welcome Desk')];

let eSeq = 0;
const deal = (o: Partial<Enrollment>): Enrollment => ({
  id: `opp_${++eSeq}`, locationId: 'loc', agentId: 'u_alexia', closerId: 'u_alexia', closerSource: 'stamped',
  isEnrolled: true, firstEnrolledAt: '2026-06-01T17:00:00Z', backendFileRef: null,
  contactId: null, clientName: 'Soeng Go', clientPhone: null, clientEmail: null,
  backend: 'LEGACY', pipeline: 'Sales Pipeline', stage: 'ENROLLED - ELP - DEBT WAIVER', status: 'open',
  enrolledDebt: 39670, enrolledAt: '2026-05-20T17:00:00Z', updatedAt: null, ...o,
});
let fSeq = 0;
const file = (o: Partial<BackendFile>): BackendFile => ({
  id: ++fSeq, backend: 'LEGACY', externalId: null, clientName: 'Soeng Go', clientPhone: null,
  clientLast4: null, repName: null, fileStatus: 'Enrolled', enrolledDebt: 39670,
  enrolledAt: '2026-05-22', firstPaymentAt: '2026-06-15', payoutAmount: null, payoutAt: null,
  period: null, batchId: null, ...o,
});
const run = (enrollments: Enrollment[], files: BackendFile[]) => reconcile({ enrollments, files, agents: AGENTS });

console.log('\n=== Which deals are reconciled at all ===');
check('pitched deal is not an enrollment', !isEnrolledStage('PITCHED - SETTLEMENT', 'open'));
check('ENROLLED - LEVEL / SETTLEMENT is', isEnrolledStage('ENROLLED - LEVEL / SETTLEMENT', 'open'));
check('stage names are matched case- and space-insensitively', isEnrolledStage('enrolled -  elp - debt waiver', 'open'));
check('post-enrollment stages count (FIRST PAYMENT MADE)', isEnrolledStage('FIRST PAYMENT MADE', 'open'));
check('welcome-call-completed variants count', isEnrolledStage('WELCOME CALL COMPLETED - LEVEL', 'open'));
check('status won counts regardless of stage', isEnrolledStage('Anything', 'won'));
{
  const rows = run([deal({ isEnrolled: false, stage: 'PITCHED - RESOLUTION' })], []);
  check('a pitched deal never shows as "not at backend"', rows.length === 0, `${rows.length} rows`);
}

console.log('\n=== Credit is stamped at enrollment, not at every later stage ===');
check('ENROLLED - LEVEL / SETTLEMENT stamps the closer', isInitialEnrollmentStage('ENROLLED - LEVEL / SETTLEMENT'));
check('FIRST PAYMENT MADE does not (owner may be the welcome desk)', !isInitialEnrollmentStage('FIRST PAYMENT MADE'));
check('ENROLLED - NSF does not', !isInitialEnrollmentStage('ENROLLED - NSF'));
{
  // Deal was closed by Alexia, since reassigned to the welcome desk.
  const rows = run([deal({ agentId: 'u_wc', closerId: 'u_alexia' })], [file({})]);
  check('reassigned deal still credits the closer, not the new owner',
    rows[0].status === 'matched' && (rows[0].enrollment?.closerId === 'u_alexia'));
}

console.log('\n=== Backend from stage names ===');
check('ELP stage → Legacy', backendFromText('Sales Pipeline', 'ENROLLED - ELP - DEBT WAIVER') === 'LEGACY');
check('Consumer Shield stage → CS', backendFromText('Sales Pipeline', 'ENROLLED - CONSUMER SHIELD - DEBT VALIDATION') === 'CS');
check('Level stage → Level', backendFromText('Sales Pipeline', 'ENROLLED - LEVEL / SETTLEMENT') === 'LEVEL');
check('Pinnacle → Level (same partner)', backendFromText('Pinnacle Legal P.C.') === 'LEVEL');
check('plain ENROLLED → unknown', backendFromText('Sales Pipeline', 'ENROLLED') === 'UNKNOWN');

console.log('\n=== Matching ===');
{
  const rows = run([deal({ backendFileRef: 'FT-96BB1530AF8F', backend: 'LEVEL', clientName: 'Somebody Else' })],
    [file({ backend: 'LEVEL', externalId: 'FT-96BB1530AF8F', clientName: null })]);
  check('file id entered in GHL matches a nameless Forth row', rows[0].method === 'file_ref' && rows[0].status === 'matched');
}
{
  const rows = run([deal({ clientPhone: '2135550101', clientName: 'Different Name' })], [file({ clientPhone: '2135550101' })]);
  check('phone matches despite a different name', rows[0].method === 'phone');
}
{
  const rows = run([deal({ enrolledDebt: 39000 })], [file({ enrolledDebt: 39670 })]);
  check('name + debt within 2% matches', rows[0].method === 'name_debt', rows[0].explanation);
}
{
  const rows = run([deal({ enrolledDebt: 12000, firstEnrolledAt: '2026-05-21T17:00:00Z' })], [file({ enrolledDebt: 39670 })]);
  check('name + enrollment date within window matches even if debt differs',
    rows[0].method === 'name_debt' && rows[0].status === 'amount_mismatch', rows[0].status);
}
{
  const rows = run([deal({ enrolledDebt: 12000, firstEnrolledAt: '2025-01-01T17:00:00Z', enrolledAt: '2025-01-01T17:00:00Z' })],
    [file({ enrolledDebt: 39670 })]);
  check('name alone is not enough — no match', rows[0].status === 'missing_at_backend' && rows.length === 2,
    rows.map((r) => r.status).join(','));
}
{
  const rows = run([deal({ backend: 'CS' })], [file({ backend: 'LEGACY' })]);
  check('a CS deal never matches a Legacy file', rows[0].status === 'missing_at_backend');
}

console.log('\n=== ELP re-enrollment: one deal, several files ===');
{
  const rows = run([deal({})], [file({ enrolledAt: '2026-05-22' }), file({ enrolledAt: '2026-08-02', fileStatus: 'Enrolled' })]);
  const s = reconSummary(rows);
  check('second ELP file attaches to the same deal', rows.length === 2 && rows[1].method === 'reenrollment'
    && rows[1].enrollmentId === rows[0].enrollmentId, rows.map((r) => r.method).join(','));
  check('…and is not reported as nobody credited', s.unclaimedAtBackend === 0);
}

console.log('\n=== Backend rep cross-check ===');
{
  const rows = run([deal({})], [file({ repName: 'Daniel Rivera' })]);
  check('backend naming a different agent → rep_mismatch', rows[0].status === 'rep_mismatch', rows[0].explanation);
}
{
  const rows = run([deal({})], [file({ repName: 'Alexia Mcallister-Foggy' })]);
  check('vendor-tagged rep name ("-Foggy") resolves to the same agent', rows[0].status === 'matched', rows[0].status);
}
for (const label of ['Forth Team', 'Unassigned', 'Member Servces', 'agent 104', 'ACS Admin', 'OCC Rep (DZA)']) {
  const rows = run([deal({})], [file({ repName: label })]);
  check(`label "${label}" names nobody → not a dispute`, rows[0].status === 'matched', rows[0].status);
}

console.log('\n=== Importer against real headers ===');
{
  const shield = [
    'Member First Name,Member Last Name,Cleared Amount,Cleared Date,Member Status,Payment Status,Enrolled Date,Representative Name,Affiliate Name,Client ID,Total Debt Amount',
    'Armand,Blais,$320.00,2025-09-16,Membership Active,,04/30/2025,Andrew Chavarria-Foggy,Funding Tier LLC,17093735,8072.79',
    'Armand,Blais,$320.00,2025-10-16,Membership Active,,04/30/2025,Andrew Chavarria-Foggy,Funding Tier LLC,17093735,8072.79',
    'Angeles,Wilds,$320.00,2025-09-16,Membership Active,,05/29/2025,OCC Rep (DZA),DZA,17127328,20484.08',
  ].join('\n');
  const p = parseBackendReport('CS', 'shield.csv', shield);
  check('other affiliates are dropped', p.otherAffiliate === 1);
  check('payment rows fold into one file per client', p.rows.length === 1 && p.collapsed === 1);
  check('rep, id, debt and enrolled date are read', p.rows[0].repName === 'Andrew Chavarria-Foggy'
    && p.rows[0].externalId === '17093735' && p.rows[0].enrolledDebt === 8072.79 && p.rows[0].enrolledAt === '2025-04-30',
    JSON.stringify(p.rows[0]));
}
{
  const elp = [
    ',Funding Tier - Total Enrollments,,,,',
    ',Applicant: Stage  ↑,,Applicant: Contact Owner: Full Name,Applicant: Enrolled Date,Applicant: Full Name,Enrolled Debt Amount,First Payment Date',
    ',Enrolled,,Nathan Pottish,"5/22/2026, 9:07 AM",Soeng Go,39670,6/15/2026',
    ',,,Daniel Pottish,"6/3/2026, 3:57 PM",Gloria Ochoa,89164,9/28/2026',
  ].join('\n');
  const p = parseBackendReport('LEGACY', 'elp.csv', elp);
  check('Salesforce: client is the applicant, not the contact owner', p.rows[0]?.clientName === 'Soeng Go', JSON.stringify(p.rows[0]));
  check('Salesforce: owner goes to rep', p.rows[0]?.repName === 'Nathan Pottish');
  check('Salesforce: grouped stage carries down to the next row', p.rows[1]?.fileStatus === 'Enrolled');
  check('Salesforce: "5/22/2026, 9:07 AM" parses', p.rows[0]?.enrolledAt === '2026-05-22', String(p.rows[0]?.enrolledAt));
}

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
