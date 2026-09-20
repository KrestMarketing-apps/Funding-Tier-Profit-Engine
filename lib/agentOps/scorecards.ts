import type { Agent, AttendanceDay, CallRecord, Enrollment, Scorecard } from './types';
import type { ReconRow } from './recon';
import { creditedAgent } from './recon';

/**
 * One row per agent: hours on, work done, deals claimed, deals the backend
 * confirmed, and what each of those cost.
 */
export function buildScorecards(d: {
  agents: Agent[]; attendance: AttendanceDay[]; calls: CallRecord[];
  enrollments: Enrollment[]; recon: ReconRow[];
}): Scorecard[] {
  // A deal can own several backend files (re-enrollments); the first row is
  // its primary match and is the one that decides confirmed vs disputed.
  const confirmedByEnrollment = new Map<string, ReconRow>();
  d.recon.forEach((r) => {
    if (r.enrollmentId && !confirmedByEnrollment.has(r.enrollmentId)) confirmedByEnrollment.set(r.enrollmentId, r);
  });
  const enrolled = d.enrollments.filter((e) => e.isEnrolled);

  return d.agents.map((agent) => {
    const days = d.attendance.filter((a) => a.agentId === agent.id);
    const calls = d.calls.filter((c) => c.agentId === agent.id);
    // Credit goes to the frozen closer, not whoever owns the deal today.
    const enrollments = enrolled.filter((e) => creditedAgent(e) === agent.id);

    const activeHours = days.reduce((s, x) => s + x.activeMinutes, 0) / 60;
    const scheduledHours = days.reduce((s, x) => s + x.scheduledMinutes, 0) / 60;
    // Paid on scheduled hours where a schedule is known, on observed activity
    // where it is not — an overseas desk billing a flat week is the former.
    const paidHours = scheduledHours > 0 ? scheduledHours : activeHours;
    const paidCost = (agent.hourlyRate ?? 0) * paidHours;

    let confirmed = 0;
    let confirmedPayout = 0;
    let disputed = 0;
    enrollments.forEach((e) => {
      const r = confirmedByEnrollment.get(e.id);
      if (!r) return;
      if (r.status === 'matched' || r.status === 'amount_mismatch') {
        confirmed += 1;
        confirmedPayout += r.file?.payoutAmount ?? 0;
        if (r.status === 'amount_mismatch') disputed += 1;
      } else disputed += 1;
    });

    return {
      agent,
      days: days.length,
      activeHours,
      scheduledHours,
      paidCost,
      calls: calls.length,
      talkHours: calls.reduce((s, c) => s + c.talkSeconds, 0) / 3600,
      connects: calls.filter((c) => c.talkSeconds > 0).length,
      enrollments: enrollments.length,
      enrolledDebt: enrollments.reduce((s, e) => s + (e.enrolledDebt ?? 0), 0),
      confirmedByBackend: confirmed,
      confirmedPayout,
      disputed,
      costPerEnrollment: enrollments.length ? paidCost / enrollments.length : null,
      costPerConfirmed: confirmed ? paidCost / confirmed : null,
    };
  }).sort((a, b) => b.confirmedByBackend - a.confirmedByBackend || b.enrollments - a.enrollments);
}

