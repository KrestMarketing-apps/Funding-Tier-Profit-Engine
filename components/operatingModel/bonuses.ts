import type {
  BackendKey, BonusLine, BonusResult, EmployeeCost, ModelInputs,
} from './types';

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const n1 = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 });

export interface BonusContext {
  dealsByBackend: Record<BackendKey, number>;
  avgDebt: Record<BackendKey, number>;
  /** Closers on the roster this month — the people who can earn a bonus. */
  closers: EmployeeCost[];
}

/**
 * Bonuses and spiffs, per the agent incentive reference.
 *
 * Two of the four programs trigger on DAILY thresholds while this model runs
 * monthly, so daily volume has to be inferred. Deals do not arrive evenly — a
 * rep writes three on a good day and none on a slow one — and a flat spread
 * would never cross the 3-deals-in-a-day line at realistic volumes, which
 * would understate real payouts badly.
 *
 * The concentration factor k models that clumping: a rep is productive on
 * (working days ÷ k) days and writes k × their daily average on each of those.
 * k = 1.0 is a perfectly even spread. Set the manual hit-day inputs above zero
 * to bypass the model entirely and state observed reality.
 *
 * Every figure here is provisional: bonuses are subject to the clawback and
 * chargeback policy, so a holdback share is withheld from the month's payout.
 */
export function computeBonuses(inputs: ModelInputs, ctx: BonusContext): BonusResult {
  const P = inputs.bonusPolicy;
  const lines: BonusLine[] = [];
  const empty: BonusResult = { lines, total: 0, heldBack: 0, paid: 0 };
  if (!P.enabled) return empty;

  const repCount = ctx.closers.length;
  if (repCount === 0) return empty;

  const validationResolutionDeals = ctx.dealsByBackend.CS + ctx.dealsByBackend.LEGACY;
  const levelDeals = ctx.dealsByBackend.LEVEL;
  const totalDeals = validationResolutionDeals + levelDeals;

  const vrPerRep = validationResolutionDeals / repCount;
  const levelPerRep = levelDeals / repCount;

  const workDays = Math.max(1, P.workingDaysPerMonth);
  const k = Math.max(1, P.dealConcentration);
  const activeDays = workDays / k;
  const vrPerActiveDay = vrPerRep / activeDays;

  // ── Daily Deal Bonus — Shield Services + Elite Legal Practice ─────────────
  const useManual = P.manualHitDays3Plus > 0 || P.manualHitDays5Plus > 0;
  if (useManual) {
    const t5 = P.dailyDeal.find((t) => t.minDealsPerDay >= 5);
    const t3 = P.dailyDeal.find((t) => t.minDealsPerDay === 3);
    if (t5 && P.manualHitDays5Plus > 0) {
      const amt = P.manualHitDays5Plus * Math.max(5, vrPerActiveDay) * t5.bonusPerDeal * repCount;
      lines.push({
        id: 'daily-5', label: 'Daily Deal Bonus — 5+ deals/day',
        detail: `${P.manualHitDays5Plus} hit-days × ${repCount} rep${repCount === 1 ? '' : 's'}`,
        formula: `${P.manualHitDays5Plus} days × ${n1(Math.max(5, vrPerActiveDay))} deals × ${money(t5.bonusPerDeal)} × ${repCount}`,
        amount: amt,
      });
    }
    if (t3 && P.manualHitDays3Plus > 0) {
      const amt = P.manualHitDays3Plus * Math.max(3, vrPerActiveDay) * t3.bonusPerDeal * repCount;
      lines.push({
        id: 'daily-3', label: 'Daily Deal Bonus — 3 deals/day',
        detail: `${P.manualHitDays3Plus} hit-days × ${repCount} rep${repCount === 1 ? '' : 's'}`,
        formula: `${P.manualHitDays3Plus} days × ${n1(Math.max(3, vrPerActiveDay))} deals × ${money(t3.bonusPerDeal)} × ${repCount}`,
        amount: amt,
      });
    }
  } else {
    // Highest tier the rep's productive-day rate clears. The bonus is per deal
    // on every deal written on those days.
    const tier = [...P.dailyDeal]
      .sort((a, b) => b.minDealsPerDay - a.minDealsPerDay)
      .find((t) => vrPerActiveDay >= t.minDealsPerDay);
    if (tier) {
      const amt = vrPerActiveDay * activeDays * tier.bonusPerDeal * repCount;
      lines.push({
        id: 'daily', label: `Daily Deal Bonus — ${tier.minDealsPerDay}+ deals/day`,
        detail: `${n1(vrPerActiveDay)} deals on each of ${n1(activeDays)} productive days, ${repCount} rep${repCount === 1 ? '' : 's'}`,
        formula: `${n1(vrPerActiveDay)} × ${n1(activeDays)} × ${money(tier.bonusPerDeal)} × ${repCount}`,
        amount: amt,
      });
    } else {
      lines.push({
        id: 'daily', label: 'Daily Deal Bonus', amount: 0,
        detail: `Not reached — ${n1(vrPerActiveDay)} deals on a productive day, threshold is ${Math.min(...P.dailyDeal.map((t) => t.minDealsPerDay))}`,
        formula: `${n1(vrPerRep)} deals ÷ ${n1(activeDays)} productive days`,
      });
    }
  }

  // ── Monthly Volume Bonus ─────────────────────────────────────────────────
  const mv = [...P.monthlyVolume]
    .sort((a, b) => b.minDealsPerMonth - a.minDealsPerMonth)
    .find((t) => vrPerRep >= t.minDealsPerMonth);
  lines.push({
    id: 'monthly',
    label: mv ? `Monthly Volume Bonus — ${mv.minDealsPerMonth}+ deals` : 'Monthly Volume Bonus',
    detail: mv
      ? `${n1(vrPerRep)} validation + resolution deals per rep × ${repCount} rep${repCount === 1 ? '' : 's'}`
      : `Not reached — ${n1(vrPerRep)} deals per rep, lowest tier is ${Math.min(...P.monthlyVolume.map((t) => t.minDealsPerMonth))}`,
    formula: mv ? `${money(mv.bonus)} × ${repCount}` : '—',
    amount: mv ? mv.bonus * repCount : 0,
  });

  // ── Balanced Book Bonus ──────────────────────────────────────────────────
  const mixPct = totalDeals > 0 ? (validationResolutionDeals / totalDeals) * 100 : 0;
  const bb = [...P.balancedBook.tiers]
    .sort((a, b) => b.minMixPct - a.minMixPct)
    .find((t) => mixPct >= t.minMixPct);
  const bbQualifies = bb != null && levelPerRep >= P.balancedBook.minDeals;
  lines.push({
    id: 'balanced',
    label: bbQualifies ? `Balanced Book Bonus — ${bb!.minMixPct}%+ mix` : 'Balanced Book Bonus',
    detail: bbQualifies
      ? `${mixPct.toFixed(0)}% validation + resolution mix, ${n1(levelPerRep)} Level DS deals per rep`
      : bb == null
        ? `Not reached — ${mixPct.toFixed(0)}% mix, lowest tier is ${Math.min(...P.balancedBook.tiers.map((t) => t.minMixPct))}%`
        : `Mix qualifies at ${mixPct.toFixed(0)}% but Level DS deals per rep (${n1(levelPerRep)}) is under the ${P.balancedBook.minDeals} minimum`,
    formula: bbQualifies ? `${money(bb!.bonus)} × ${repCount}` : '—',
    amount: bbQualifies ? bb!.bonus * repCount : 0,
  });

  // ── Level Debt Enrollment Bonus — daily enrolled volume ──────────────────
  const enrolledPerRepPerActiveDay = (levelPerRep * ctx.avgDebt.LEVEL) / activeDays;
  const ld = [...P.ldEnrollment]
    .sort((a, b) => b.minEnrolledPerDay - a.minEnrolledPerDay)
    .find((t) => enrolledPerRepPerActiveDay >= t.minEnrolledPerDay);
  lines.push({
    id: 'ld',
    label: ld ? `LD Enrollment Bonus — ${money(ld.minEnrolledPerDay)}+/day` : 'LD Enrollment Bonus',
    detail: ld
      ? `${money(enrolledPerRepPerActiveDay)} enrolled on each of ${n1(activeDays)} productive days`
      : `Not reached — ${money(enrolledPerRepPerActiveDay)} enrolled per productive day, lowest tier is ${money(Math.min(...P.ldEnrollment.map((t) => t.minEnrolledPerDay)))}`,
    formula: ld ? `${money(ld.bonus)} × ${n1(activeDays)} days × ${repCount}` : '—',
    amount: ld ? ld.bonus * activeDays * repCount : 0,
  });

  const total = lines.reduce((s, l) => s + l.amount, 0);
  const heldBack = total * (P.provisionalHoldbackPct / 100);
  return { lines, total, heldBack, paid: total - heldBack };
}
