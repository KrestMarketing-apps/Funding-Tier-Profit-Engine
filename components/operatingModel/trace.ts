import type { BackendKey, ModelInputs, ModelResults, MonthRow } from './types';
import { BACKEND_KEYS } from './types';
import { BRANDS } from './config';
import { blendedTransferCost, money, money2 } from './costs';
import { legacy, shield } from './backends';

export interface TraceRow {
  step: string;
  what: string;
  formula: string;
  substitution: string;
  result: string;
  note?: string;
}

export interface TraceSection {
  id: string;
  title: string;
  intro: string;
  rows: TraceRow[];
}

const pct = (n: number) => `${n.toFixed(1)}%`;
const num = (n: number, d = 1) => n.toLocaleString('en-US', { maximumFractionDigits: d });

/**
 * Full derivation of one month, from raw inputs to cash position. This is the
 * "where do these numbers come from" view — every figure on the page traces
 * back to a formula and its substituted values.
 */
export function buildTrace(inputs: ModelInputs, results: ModelResults, monthIndex: number): TraceSection[] {
  const row: MonthRow | undefined = results.months[monthIndex - 1];
  if (!row) return [];
  const cap = row.capacity;
  const ops = inputs.operations;
  const closeRate = ops.closeRatePct / 100;
  const wpm = inputs.laborPolicy.weeksPerMonth;
  const sections: TraceSection[] = [];

  // ── 1. Labor ───────────────────────────────────────────────────────────────
  const laborRows: TraceRow[] = [];
  const active = row.costs.groups.find((g) => g.id === 'labor')?.lines ?? [];
  results.employeeCosts
    .filter((e) => e.employee.startMonth <= monthIndex && (e.employee.endMonth == null || e.employee.endMonth >= monthIndex))
    .forEach((e) => {
      const emp = e.employee;
      laborRows.push({
        step: 'Paid hours',
        what: `${emp.name} — weekly paid hours`,
        formula: 'Σ (shift end − shift start) − unpaid break',
        substitution: `${num(e.weeklyPaidHours + (emp.unpaidBreakMinutes / 60) * daysWorked(emp))} clock hrs − ${num((emp.unpaidBreakMinutes / 60) * daysWorked(emp))} break hrs over ${daysWorked(emp)} day${daysWorked(emp) === 1 ? '' : 's'}`,
        result: `${num(e.weeklyPaidHours)} hrs/wk`,
      });
      if (e.otHoursPerWeek > 0) {
        laborRows.push({
          step: 'Overtime',
          what: `${emp.name} — hours above ${inputs.laborPolicy.otThresholdHrsPerWeek}/wk`,
          formula: 'max(0, weekly paid hrs − OT threshold)',
          substitution: `max(0, ${num(e.weeklyPaidHours)} − ${inputs.laborPolicy.otThresholdHrsPerWeek})`,
          result: `${num(e.otHoursPerWeek)} OT hrs/wk`,
          note: emp.type === 'inhouse' ? 'In-House / CA — 1.5× premium applies' : 'BPO — premium applied because OT was enabled on this row',
        });
      }
      laborRows.push({
        step: 'Monthly cost',
        what: `${emp.name} — labor cost`,
        formula: '(regular hrs × rate + OT hrs × rate × 1.5) × 52/12',
        substitution: `(${num(e.regularHoursPerWeek)} × ${money2(emp.commissionOnly ? 0 : emp.hourlyRate)}${e.otHoursPerWeek > 0 ? ` + ${num(e.otHoursPerWeek)} × ${money2(emp.hourlyRate)} × ${inputs.laborPolicy.otMultiplier}` : ''}) × ${wpm.toFixed(4)}`,
        result: money(e.monthlyCost),
        note: emp.commissionOnly ? 'Commission-only — $0 hourly labor, still consumes capacity' : undefined,
      });
    });
  laborRows.push({
    step: 'Total',
    what: 'Monthly labor spend',
    formula: 'Σ all active employees',
    substitution: active.map((l) => money(l.amount)).join(' + ') || '$0',
    result: money(row.laborCost),
  });
  sections.push({
    id: 'labor', title: '1 · Labor — what each person costs',
    intro: 'Hours are paid hours: the clock span of each enabled shift, minus the unpaid meal break. A month is 52/12 = 4.3333 weeks.',
    rows: laborRows,
  });

  // ── 2. Capacity → volume ───────────────────────────────────────────────────
  const capRows: TraceRow[] = [
    {
      step: 'Closer hours', what: 'Paid closer hours available this month',
      formula: 'Σ (weekly paid hrs × closer share) × 52/12',
      substitution: `${num(cap.closerHours / wpm)} closer hrs/wk × ${wpm.toFixed(4)}`,
      result: `${num(cap.closerHours)} hrs/mo`,
    },
    {
      step: 'Rule target', what: 'Deals the roster should produce',
      formula: 'closer hours ÷ 8 × deals per 8 hrs',
      substitution: `${num(cap.closerHours)} ÷ 8 × ${inputs.volume.dealsPer8CloserHours}`,
      result: `${num(cap.ruleCapacityDeals)} deals/mo`,
      note: 'Business rule: 1.0–1.5 deals per rep per 8 paid hours.',
    },
    {
      step: 'Physical ceiling', what: 'Deals the available talk time allows',
      formula: '(closer hours × 60 ÷ AHT) × close rate',
      substitution: `(${num(cap.closerHours)} × 60 ÷ ${ops.avgHandleMinutes}) × ${pct(ops.closeRatePct)}`,
      result: `${num(cap.talkTimeCapacityDeals)} deals/mo`,
      note: `At ${ops.avgHandleMinutes} min average handle time and a ${pct(ops.closeRatePct)} close rate.`,
    },
    {
      step: 'Binding constraint', what: 'Which limit actually applies',
      formula: inputs.volume.mode === 'override' ? 'manual override' : 'min(rule target, physical ceiling)',
      substitution: inputs.volume.mode === 'override'
        ? `override = ${num(inputs.volume.overrideTotalDealsPerMonth)}`
        : `min(${num(cap.ruleCapacityDeals)}, ${num(cap.talkTimeCapacityDeals)})`,
      result: cap.bindingConstraint === 'rule' ? 'Deals-per-hour rule'
        : cap.bindingConstraint === 'talk-time' ? 'Talk time' : 'Manual override',
      note: cap.bindingConstraint === 'talk-time'
        ? `To hit ${inputs.volume.dealsPer8CloserHours} deals per 8 hrs, average handle time would need to fall to ${num((8 * 60 * closeRate) / inputs.volume.dealsPer8CloserHours, 0)} min.`
        : undefined,
    },
    {
      step: 'Ramp', what: 'Ramp factor for this month',
      formula: 'min(1, month ÷ ramp months)',
      substitution: `min(1, ${monthIndex} ÷ ${inputs.ramp.rampMonths})`,
      result: num(Math.min(1, monthIndex / inputs.ramp.rampMonths), 3),
    },
    {
      step: 'Deals', what: 'Deals submitted this month',
      formula: 'binding constraint × ramp factor',
      substitution: `${num(cap.bindingConstraint === 'talk-time' ? cap.talkTimeCapacityDeals : cap.ruleCapacityDeals)} × ${num(Math.min(1, monthIndex / inputs.ramp.rampMonths), 3)}`,
      result: `${row.deals} deals`,
      note: BACKEND_KEYS.map((k) => `${BRANDS[k].name} ${row.dealsByBackend[k]} (${inputs.volume.mixPct[k]}%)`).join(' · '),
    },
    {
      step: 'Transfers', what: 'Qualified transfers required',
      formula: 'deals ÷ close rate',
      substitution: `${num(cap.targetDeals)} ÷ ${pct(ops.closeRatePct)}`,
      result: `${num(cap.totalTransfers, 0)} transfers`,
    },
    {
      step: 'Opener supply', what: 'Transfers produced in-house by openers',
      formula: 'min(transfers required, opener hours × transfers per opener hour)',
      substitution: `min(${num(cap.totalTransfers, 0)}, ${num(cap.openerHours)} × ${ops.openerTransfersPerHour} = ${num(cap.openerRawSupply, 0)})`,
      result: `${num(cap.openerSuppliedTransfers, 0)} transfers`,
      note: cap.openerHours === 0
        ? 'No openers on the roster — every transfer is purchased from the vendor.'
        : cap.openerRawSupply > cap.totalTransfers
          ? `Openers can produce ${num(cap.openerRawSupply, 0)} transfers but only ${num(cap.totalTransfers, 0)} are needed — ${num(cap.openerRawSupply - cap.totalTransfers, 0)} of opener capacity is idle. Trim opener hours or add closers to use it.`
          : undefined,
    },
    {
      step: 'Purchased', what: 'Transfers bought from the vendor',
      formula: 'max(0, required − opener supply)',
      substitution: `max(0, ${num(cap.totalTransfers, 0)} − ${num(cap.openerSuppliedTransfers, 0)})`,
      result: `${num(cap.purchasedTransfers, 0)} transfers`,
    },
    {
      step: 'Utilization', what: 'Share of closer talk time consumed',
      formula: '(transfers × AHT) ÷ (closer hours × 60)',
      substitution: `(${num(cap.totalTransfers, 0)} × ${ops.avgHandleMinutes}) ÷ (${num(cap.closerHours)} × 60)`,
      result: pct(cap.utilizationPct),
      note: cap.ruleUtilizationPct > 100
        ? `The unconstrained rule target would need ${pct(cap.ruleUtilizationPct)} of available talk time.`
        : undefined,
    },
  ];
  sections.push({
    id: 'capacity', title: '2 · Capacity — how hours become deals',
    intro: 'Deal volume is a function of employed closer hours, capped by the talk time those hours actually provide.',
    rows: capRows,
  });

  // ── 3. Revenue ─────────────────────────────────────────────────────────────
  const revRows: TraceRow[] = [];
  BACKEND_KEYS.forEach((k) => {
    const brand = BRANDS[k];
    const debt = inputs.volume.avgDebt[k];
    const lag = inputs.remittanceLag[k];
    const partner = row.partners.find((p) => p.key === k)!;
    if (k === 'LEVEL') {
      revRows.push({
        step: brand.name, what: 'Revenue per enrolled deal',
        formula: 'enrolled debt × revenue share',
        substitution: `${money(debt)} × ${pct(inputs.levelDebt.revenueSharePct * 100)}`,
        result: money(debt * inputs.levelDebt.revenueSharePct),
        note: `One-time. Recognised at deal-month ${inputs.levelDebt.revenueRecognizedMonth}, once the first client payment clears. Chargeback liability clears after ${inputs.levelDebt.chargebackClearMonths} completed payments. Nothing recurs.`,
      });
    } else if (k === 'CS') {
      const p = shield.getProgram(debt, inputs.consumerShield);
      revRows.push({
        step: brand.name, what: `Revenue per payment (program ${p?.code ?? '?'})`,
        formula: '(client payment − servicing deduction) × capture rate',
        substitution: `(${money(p?.payment ?? 0)} − ${money(inputs.consumerShield.servicingDeductionPerPayment)}) × ${pct(inputs.consumerShield.frontCaptureRate * 100)} for months 1–${inputs.consumerShield.frontMonths}, then ${pct(inputs.consumerShield.backendCaptureRate * 100)}`,
        result: `${money((p?.payment ?? 0) - inputs.consumerShield.servicingDeductionPerPayment)} front / ${money(((p?.payment ?? 0) - inputs.consumerShield.servicingDeductionPerPayment) * inputs.consumerShield.backendCaptureRate)} back`,
        note: `Monthly perpetuity across the full ${p?.term ?? '?'}-month program.`,
      });
    } else {
      const L = inputs.legacy;
      const term = legacy.getMaxTerm(debt, L);
      const fee = legacy.totalFee(debt, L);
      const pay = legacy.getScheduledPayment(debt, L);
      const last = legacy.getFinalPayment(debt, L);
      const draftFee = legacy.draftFeePerMonth(L);
      const headroom = L.minMonthlyPayment - L.maintenanceFee - draftFee;
      const cap = legacy.getTermCap(debt, L);
      revRows.push({
        step: brand.name, what: 'Program term and scheduled draft',
        formula: 'term = written term, capped at ⌊fee ÷ (min draft − maintenance − processing)⌋ · draft = service fee + maintenance + processing',
        substitution: `written ${L.targetTerm} mo, cap ⌊${money2(fee)} ÷ ${money(headroom)}⌋ = ${cap} mo → ${term} mo; draft = ${money2(pay - L.maintenanceFee - draftFee)} + ${money(L.maintenanceFee)} + ${money(draftFee)} = ${money2(pay)}`,
        result: `${term} × ${money2(pay)}`,
        note: `The ${money(L.minMonthlyPayment)} floor is a minimum on the client draft, not the term — it only caps how long the fee can be spread. A shorter term earns more and earns it sooner, since months 1–2 pass through in full.${L.splitSchedule ? ' Split schedule: two drafts a month, so processing is charged twice and maintenance once.' : ''}${Math.abs(last - pay) >= 0.005 ? ` The final draft is ${money2(last)} so the client is billed exactly ${money2(fee)} in fees.` : ''}`,
      });
      revRows.push({
        step: brand.name, what: 'Revenue per payment',
        formula: 'months 1–2: draft − processing · months 3+: (draft − maintenance − processing) × tier rate',
        substitution: `${money2(pay)} − ${money2(draftFee)}  ·  (${money2(pay)} − ${money2(L.maintenanceFee)} − ${money2(draftFee)}) × ${pct(L.tier1Rate * 100)}`,
        result: `${money2(legacy.revenueForDealMonth(debt, 1, L))} / ${money2(legacy.revenueForDealMonth(debt, 3, L))}`,
        note: `Maintenance is not backed out until month 3, which is why the first two months are worth several times any later month. Monthly perpetuity across ${term} months.`,
      });
    }
    revRows.push({
      step: brand.name, what: 'Remittance timing',
      formula: 'cash month = deal month + remittance lag',
      substitution: `lag = ${lag} month${lag === 1 ? '' : 's'}`,
      result: lag === 0 ? 'Paid at the recognised deal-month' : 'Paid the month after each client payment clears',
      note: 'This is why month 1 always collects $0.',
    });
    revRows.push({
      step: brand.name, what: 'Revenue collected this month',
      formula: 'Σ over live cohorts: surviving deals × revenue per payment',
      substitution: `${num(partner.activeDeals)} surviving deals still paying this month`,
      result: money(partner.revenue),
    });
  });
  revRows.push({
    step: 'Total', what: 'Company revenue this month',
    formula: 'Σ all three servicing partners',
    substitution: row.partners.map((p) => money(p.revenue)).join(' + '),
    result: money(row.revenue),
  });
  sections.push({
    id: 'revenue', title: '3 · Revenue — what each backend pays and when',
    intro: 'Survival curves shrink each cohort every month: first-pay conversion in month 1, then the monthly cancel rate.',
    rows: revRows,
  });

  // ── 4. Commission ──────────────────────────────────────────────────────────
  // Attribution comes first: it decides which pay model each deal is priced on.
  const commRows: TraceRow[] = [];
  const usSharePct = row.deals > 0 ? (row.usDeals / row.deals) * 100 : 100;
  commRows.push({
    step: 'Attribution', what: 'Who wrote this month\u2019s deals',
    formula: 'deals × (that pool\u2019s closer hours ÷ total closer hours)',
    substitution: `${num(row.deals, 0)} deals × ${pct(usSharePct)} US closer hours`,
    result: `${num(row.usDeals, 1)} US · ${num(row.bpoDeals, 1)} BPO`,
    note: 'Only the US share is priced on the per-deal contract schedule below. BPO-written deals carry no per-deal commission at all — that production is paid through the monthly volume bonus instead. Nothing in this model tracks named individuals, so closer hours are the attribution key, the same one manager overrides use.',
  });
  commRows.push(...BACKEND_KEYS.map((k) => {
    const partner = row.partners.find((p) => p.key === k)!;
    return {
      step: BRANDS[k].name, what: 'Commission paid out to Funding Tier reps',
      formula: k === 'LEVEL'
        ? 'enrolled debt × graduated tier rate × surviving deals'
        : k === 'CS' ? 'program commission × surviving deals'
          : 'band total × (fee rate ÷ 0.40) × surviving deals',
      substitution: k === 'LEVEL'
        ? `${money(inputs.volume.avgDebt.LEVEL)} × tier rate`
        : k === 'CS' ? `${money(shield.agentCommission(inputs.volume.avgDebt.CS, inputs.consumerShield))} per surviving deal`
          : `${money(legacy.agentCommission(inputs.volume.avgDebt.LEGACY, inputs.legacy))} per surviving deal`,
      result: money(partner.repCommission),
      note: `Paid at deal-month ${k === 'LEVEL' ? inputs.levelDebt.agentPayoutMonth : k === 'CS' ? inputs.consumerShield.agentPayoutMonth : inputs.legacy.agentPayoutMonth}. US-attributed deals only. This is money leaving Funding Tier, not money received.`,
    };
  }));
  commRows.push({
    step: 'Subtotal', what: 'Per-deal commission paid this month',
    formula: 'Σ all three servicing partners, US-attributed deals only',
    substitution: row.partners.map((p) => money(p.repCommission)).join(' + '),
    result: money(row.repCommission),
  });

  // BPO volume bonus — a different pay model, so it derives separately.
  if (inputs.bpoPay.enabled && row.bpoBonus.lines.length > 0) {
    const cliffs = [...inputs.bpoPay.tiers]
      .sort((a, b) => a.minDealsPerMonth - b.minDealsPerMonth)
      .map((t) => `${t.minDealsPerMonth}+ → ${(t.rate * 100).toFixed(2)}%`)
      .join(' · ');
    row.bpoBonus.lines.forEach((l) => {
      commRows.push({
        step: 'BPO bonus', what: `${l.name} — monthly volume bonus`,
        formula: l.qualified
          ? 'that rep\u2019s enrolled dollars × the rate their deal count unlocks'
          : 'no threshold cleared → no bonus',
        substitution: l.qualified
          ? `${money(l.bonusBase)} × ${(l.rate * 100).toFixed(2)}%`
          : `${num(l.deals, 1)} deals against a ${cliffs.split(' ')[0]} cliff`,
        result: money(l.amount),
        note: l.qualified
          ? `${num(l.deals, 1)} deals written (${l.tierLabel}). It is a cliff, not a ladder: the rate pays on the rep\u2019s WHOLE month of enrolled volume, not just the deals above the line.${inputs.bpoPay.netOfClawbacks ? ` Base is net of NSF / clawback — ${money(l.bonusBase)} of ${money(l.enrolledVolume)} gross survives to payout.` : ' Base is gross enrolled dollars; clawbacks are handled outside the model.'}`
          : `${num(l.deals, 1)} deals is under the ${cliffs.split('+')[0]}-deal threshold, so this rep earns nothing above their hourly rate this month. Tiers: ${cliffs}.`,
      });
    });
    commRows.push({
      step: 'BPO bonus', what: 'Accrued on this month\u2019s BPO production',
      formula: 'Σ every BPO closer',
      substitution: row.bpoBonus.lines.map((l) => money(l.amount)).join(' + ') || '$0',
      result: money(row.bpoBonus.accrued),
      note: `Paid ${inputs.bpoPay.payoutLagMonths === 0 ? 'the same month' : `${inputs.bpoPay.payoutLagMonths} month${inputs.bpoPay.payoutLagMonths === 1 ? '' : 's'} later`}, which is why the cash line below can differ from this accrual.`,
    });
    commRows.push({
      step: 'BPO bonus', what: 'BPO bonus cash leaving this month',
      formula: 'accrual from the production month, released on the payout lag',
      substitution: `month ${Math.max(1, monthIndex - inputs.bpoPay.payoutLagMonths)} accrual`,
      result: money(row.bpoBonusPaid),
    });
  }

  commRows.push({
    step: 'Total', what: 'All variable comp on deals, this month',
    formula: 'US per-deal commission + BPO volume bonus',
    substitution: `${money(row.repCommission)} + ${money(row.bpoBonusPaid)}`,
    result: money(row.repCommission + row.bpoBonusPaid),
  });
  sections.push({
    id: 'commission', title: '4 · Commission — what Funding Tier pays its reps',
    intro: inputs.bpoPay.enabled
      ? 'Commission is an outflow, booked in the month the backend pays out, so month 1 pays nothing. Two pay models run side by side: US closers on the per-deal contract schedule, BPO closers on a single monthly volume bonus. Which one a deal is priced on depends on who wrote it.'
      : 'Commission is an outflow. It is booked in the month the backend pays out, so month 1 pays nothing. BPO pay is currently switched to the US contract schedule, so every deal is priced the same way regardless of who wrote it.',
    rows: commRows,
  });

  // ── 5. Costs ───────────────────────────────────────────────────────────────
  const costRows: TraceRow[] = [];
  row.costs.groups.forEach((g) => {
    g.lines.forEach((l) => costRows.push({
      step: g.label, what: l.label, formula: l.detail, substitution: l.formula, result: money(l.amount),
    }));
    costRows.push({
      step: g.label, what: `${g.label} — subtotal`, formula: 'Σ lines above',
      substitution: g.lines.map((l) => money(l.amount)).join(' + '), result: money(g.subtotal),
    });
  });
  costRows.push({
    step: 'Total', what: 'Monthly overhead',
    formula: 'Σ all cost groups',
    substitution: row.costs.groups.map((g) => money(g.subtotal)).join(' + '),
    result: money(row.overhead),
    note: `Includes ${money(row.transferCost)} of transfer acquisition — the largest single line, and the one the previous model left out of this total.`,
  });
  sections.push({
    id: 'costs', title: '5 · Cost stack — every dollar out the door',
    intro: `Blended transfer cost is ${money2(blendedTransferCost(inputs))} per qualified transfer across the buffer mix.`,
    rows: costRows,
  });

  // ── 6. Cash ────────────────────────────────────────────────────────────────
  const prev = results.months[monthIndex - 2];
  sections.push({
    id: 'cash', title: '6 · Cash — the bottom line',
    intro: 'Net cash flow is revenue less every compensation line less total overhead. Nothing else is netted anywhere.',
    rows: [
      {
        step: 'Net cash flow', what: 'Cash generated this month',
        formula: 'revenue − US commission − BPO volume bonus − override − bonuses − overhead',
        substitution: `${money(row.revenue)} − ${money(row.repCommission)} − ${money(row.bpoBonusPaid)} − ${money(row.managerOverride)} − ${money(row.bonusPaid)} − ${money(row.overhead)}`,
        result: money(row.netCashFlow),
      },
      {
        step: 'Cash position', what: 'Cumulative cash on hand',
        formula: 'prior cash position + net cash flow',
        substitution: `${money(prev?.cashPosition ?? 0)} + ${money(row.netCashFlow)}`,
        result: money(row.cashPosition),
      },
      {
        step: 'Reserve target', what: 'Cash the policy wants on hand',
        formula: 'monthly overhead × reserve months + trailing-12-month commission × dispute rate',
        substitution: `${money(row.overhead)} × ${inputs.reservePolicy.targetMonthsOfOverhead} + chargeback buffer @ ${pct(inputs.reservePolicy.disputeRatePct)}`,
        result: money(row.reserveTarget),
      },
      {
        step: 'Reserve met', what: 'Is the reserve target satisfied?',
        formula: 'cash position ≥ reserve target',
        substitution: `${money(row.cashPosition)} ≥ ${money(row.reserveTarget)}`,
        result: row.reserveMet ? 'Yes' : 'No',
      },
    ],
  });

  return sections;
}

function daysWorked(emp: { shifts: Record<string, { enabled: boolean }> }): number {
  return Object.values(emp.shifts).filter((d) => d.enabled).length;
}

/** Flatten every month's derivation for an export-to-investor view. */
export function buildFullTrace(inputs: ModelInputs, results: ModelResults): { month: number; sections: TraceSection[] }[] {
  return results.months.map((m) => ({ month: m.month, sections: buildTrace(inputs, results, m.month) }));
}
