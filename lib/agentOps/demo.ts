import { reconcile, reconSummary } from './recon';
import { buildScorecards } from './scorecards';
import type {
  Agent, AttendanceDay, BackendFile, BackendKey, CallRecord, DashboardData, Enrollment, Period,
} from './types';

/**
 * Sample data, for looking at the dashboard before GoHighLevel credentials and
 * a database exist. Deterministic, so screenshots and review comments line up
 * between reloads. The UI labels every panel as sample data while this is in
 * use — it is never mistaken for the floor.
 */

// Small deterministic PRNG (mulberry32) — no dependency, same numbers every run.
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Marisol', 'Andre', 'Fatima', 'Kwame', 'Rosa', 'Youssef', 'Lena', 'Diego', 'Priya', 'Tomas'];
const LAST = ['Guerrero', 'Whitfield', 'Nasser', 'Boateng', 'Delgado', 'Haddad', 'Kovac', 'Marín', 'Rao', 'Silva'];

const AGENTS: Agent[] = [
  { id: 'u_closer_1', locationId: 'loc_ft', name: 'Alicia Romero', email: 'alicia@example.com', role: 'closer', employmentType: 'inhouse', hourlyRate: 16.9, scheduledHoursPerWeek: 40, team: 'team-a', active: true },
  { id: 'u_closer_2', locationId: 'loc_ft', name: 'Dominic Hale', email: 'dominic@example.com', role: 'closer', employmentType: 'inhouse', hourlyRate: 18.5, scheduledHoursPerWeek: 40, team: 'team-a', active: true },
  { id: 'u_bpo_1', locationId: 'loc_ft', name: 'Hassan Ibrahim', email: 'hassan@example.com', role: 'opener', employmentType: 'bpo', hourlyRate: 6, scheduledHoursPerWeek: 45, team: 'team-a', active: true },
  { id: 'u_bpo_2', locationId: 'loc_ft', name: 'Nour Farouk', email: 'nour@example.com', role: 'opener', employmentType: 'bpo', hourlyRate: 6, scheduledHoursPerWeek: 45, team: 'team-a', active: true },
  { id: 'u_bpo_3', locationId: 'loc_ft', name: 'Samir Adel', email: 'samir@example.com', role: 'opener', employmentType: 'bpo', hourlyRate: 6, scheduledHoursPerWeek: 45, team: 'team-b', active: true },
  { id: 'u_mgr_1', locationId: 'loc_ft', name: 'Priya Raman', email: 'priya@example.com', role: 'manager', employmentType: 'manager', hourlyRate: 22, scheduledHoursPerWeek: 40, team: 'team-a', active: true },
];

const BACKENDS: BackendKey[] = ['LEVEL', 'CS', 'LEGACY'];
const STATUSES = ['completed', 'no-answer', 'voicemail', 'busy', 'completed', 'completed'];

export function demoDashboard(period: Period): DashboardData {
  const rand = rng(20260912);
  const from = new Date(`${period.from}T00:00:00Z`);
  const to = new Date(`${period.to}T00:00:00Z`);
  const dayCount = Math.max(1, Math.min(31, Math.round((to.getTime() - from.getTime()) / 86400_000) + 1));

  const attendance: AttendanceDay[] = [];
  const calls: CallRecord[] = [];
  const enrollments: Enrollment[] = [];
  const files: BackendFile[] = [];

  let callSeq = 0;
  let oppSeq = 0;
  let fileSeq = 0;

  for (let d = 0; d < dayCount; d += 1) {
    const day = new Date(from.getTime() + d * 86400_000);
    const dow = day.getUTCDay();
    if (dow === 0) continue;                       // closed Sunday
    const dayKey = day.toISOString().slice(0, 10);

    for (const agent of AGENTS) {
      const skips = rand();
      if (skips < 0.06) continue;                  // a no-show day, on purpose

      const startHour = 9 + (rand() < 0.25 ? 1 : 0) + (rand() < 0.1 ? 1 : 0);
      const scheduledMinutes = Math.round(((agent.scheduledHoursPerWeek ?? 40) * 60) / 5);
      const activeMinutes = Math.round(scheduledMinutes * (0.62 + rand() * 0.33));
      const gapMinutes = Math.round(scheduledMinutes * rand() * 0.28);

      const callsToday = agent.role === 'opener' ? 28 + Math.floor(rand() * 34) : 9 + Math.floor(rand() * 12);
      let talkSeconds = 0;

      for (let c = 0; c < callsToday; c += 1) {
        callSeq += 1;
        const status = STATUSES[Math.floor(rand() * STATUSES.length)];
        const connected = status === 'completed';
        const duration = connected
          ? (agent.role === 'closer' ? 900 + Math.floor(rand() * 3600) : 60 + Math.floor(rand() * 420))
          : Math.floor(rand() * 30);
        talkSeconds += connected ? duration : 0;
        const at = new Date(day.getTime() + (startHour * 3600 + c * 420 + Math.floor(rand() * 300)) * 1000);
        calls.push({
          id: `call_${callSeq}`,
          locationId: 'loc_ft',
          agentId: agent.id,
          contactId: `c_${callSeq}`,
          contactName: `${FIRST[callSeq % FIRST.length]} ${LAST[(callSeq * 7) % LAST.length]}`,
          direction: rand() < 0.8 ? 'outbound' : 'inbound',
          startedAt: at.toISOString(),
          durationSeconds: duration,
          talkSeconds: connected ? duration : 0,
          status,
          disposition: connected ? (rand() < 0.3 ? 'transferred' : 'spoke with client') : status,
          fromNumber: '+18888394640',
          toNumber: `+1${String(2000000000 + Math.floor(rand() * 7999999999)).slice(0, 10)}`,
          recordingUrl: connected ? `https://example.invalid/recording/${callSeq}` : null,
        });
      }

      const enrolledToday = agent.role === 'closer' && rand() < 0.75 ? 1 + Math.floor(rand() * 3) : 0;
      for (let e = 0; e < enrolledToday; e += 1) {
        oppSeq += 1;
        const backend = BACKENDS[Math.floor(rand() * BACKENDS.length)];
        const debt = 9000 + Math.floor(rand() * 24000);
        const phone = String(2130000000 + Math.floor(rand() * 8000000)).slice(0, 10);
        const name = `${FIRST[(oppSeq * 3) % FIRST.length]} ${LAST[(oppSeq * 5) % LAST.length]}`;
        enrollments.push({
          id: `opp_${oppSeq}`,
          locationId: 'loc_ft',
          agentId: agent.id,
          contactId: `c_opp_${oppSeq}`,
          clientName: name,
          clientPhone: phone,
          clientEmail: null,
          backend,
          pipeline: backend === 'LEVEL' ? 'Debt Settlement' : backend === 'CS' ? 'Debt Validation' : 'Debt Resolution',
          stage: 'Enrolled',
          status: 'won',
          enrolledDebt: debt,
          enrolledAt: new Date(day.getTime() + (startHour + 2) * 3600_000).toISOString(),
          updatedAt: new Date(day.getTime() + (startHour + 2) * 3600_000).toISOString(),
        });

        // The backend's side of the same file — mostly agreeing, sometimes not.
        const roll = rand();
        if (roll < 0.72) {
          fileSeq += 1;
          files.push(backendFile(fileSeq, backend, name, phone, debt, 'funded', day, rand));
        } else if (roll < 0.82) {
          fileSeq += 1;                                     // amount disagrees
          files.push(backendFile(fileSeq, backend, name, phone, Math.round(debt * 0.84), 'funded', day, rand));
        } else if (roll < 0.9) {
          fileSeq += 1;                                     // backend cancelled it
          files.push(backendFile(fileSeq, backend, name, phone, debt, 'cancelled', day, rand, 0));
        }
        // the remainder: no backend file at all — missing_at_backend
      }

      attendance.push({
        agentId: agent.id,
        day: dayKey,
        firstEvent: new Date(day.getTime() + startHour * 3600_000).toISOString(),
        lastEvent: new Date(day.getTime() + (startHour * 3600 + (activeMinutes + gapMinutes) * 60) * 1000).toISOString(),
        activeMinutes,
        spanMinutes: activeMinutes + gapMinutes,
        gapMinutes,
        sessions: 1 + Math.floor(rand() * 3),
        calls: callsToday,
        talkMinutes: Math.round(talkSeconds / 60),
        enrollments: enrolledToday,
        scheduledMinutes,
      });
    }
  }

  // A couple of files the backend paid that nobody is credited with.
  for (let i = 0; i < 3; i += 1) {
    fileSeq += 1;
    const name = `${FIRST[(i * 4) % FIRST.length]} ${LAST[(i * 6) % LAST.length]}`;
    files.push(backendFile(fileSeq, BACKENDS[i % 3], name, String(3105550000 + i), 14000 + i * 900, 'funded', to, rand));
  }

  const recon = reconcile({ enrollments, files });

  return {
    demo: true,
    period,
    agents: AGENTS,
    attendance,
    calls: calls.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 500),
    callTotal: calls.length,
    enrollments,
    files,
    recon,
    reconTotals: reconSummary(recon),
    scorecards: buildScorecards({ agents: AGENTS, attendance, calls, enrollments, recon }),
    overrideFlags: { 'backend_file|2': 1 },
    lastSync: null,
  };
}

function backendFile(
  id: number, backend: BackendKey, name: string, phone: string, debt: number,
  status: string, day: Date, rand: () => number, payout?: number,
): BackendFile {
  const paid = payout ?? Math.round(debt * (backend === 'LEVEL' ? 0.08 : 0.055));
  return {
    id,
    backend,
    externalId: `${backend}-${100000 + id}`,
    clientName: name,
    clientPhone: phone,
    clientLast4: phone.slice(-4),
    fileStatus: status,
    enrolledDebt: debt,
    firstPaymentAt: new Date(day.getTime() + 14 * 86400_000).toISOString().slice(0, 10),
    payoutAmount: paid,
    payoutAt: new Date(day.getTime() + 20 * 86400_000).toISOString().slice(0, 10),
    period: day.toISOString().slice(0, 7),
    batchId: null,
  };
}
