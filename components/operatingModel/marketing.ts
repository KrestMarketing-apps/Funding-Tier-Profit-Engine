import type {
  MarketingChannelMonth, MarketingInputs, MarketingMonthDetail, ModelInputs,
} from './types';

/**
 * Growth marketing — direct mail, credit-bureau data, paid social.
 *
 * Each channel turns spend into INBOUND qualified calls. Those calls are handled
 * by the same closers who take purchased transfers, so they consume closer talk
 * time first (they are higher intent and larger debt) and purchased transfers
 * fill whatever talk time is left. A channel's close rate and average enrolled
 * debt stay attached to the deals it produces.
 *
 * Nothing here is a forecast. The default rates are the Tier 1 planning
 * assumptions from the Growth Marketing Budget Plan and are meant to be
 * replaced by observed numbers from app.krestmarketing.com (campaign code on the
 * contact → opportunity → paid deal) once a campaign has run.
 */

function channelDemand(inputs: ModelInputs, month: number): MarketingChannelMonth[] {
  const mk: MarketingInputs = inputs.marketing;
  const out: MarketingChannelMonth[] = [];

  const dm = mk.directMail;
  {
    const active = dm.enabled && month >= dm.startMonth;
    const units = active ? dm.piecesPerMonth : 0;
    const spend = active ? units * dm.costPerPiece + dm.dataCostPerMonth : 0;
    const inbound = units * (dm.responsePct / 100);
    const qualified = inbound * (dm.qualifiedPct / 100);
    out.push({
      key: 'mail', label: 'Direct mail + bureau data', active, spend, units,
      inboundCalls: inbound, qualifiedCalls: qualified, handledCalls: qualified,
      deals: 0, closeRatePct: dm.closeRatePct, avgDebt: dm.avgDebt, enrolledVolume: 0,
      costPerQualifiedCall: 0, costPerDeal: 0,
    });
  }

  const ps = mk.paidSocial;
  {
    const active = ps.enabled && month >= ps.startMonth;
    const spend = active ? ps.spendPerMonth : 0;
    const leads = ps.costPerLead > 0 ? spend / ps.costPerLead : 0;
    const qualified = leads * (ps.qualifiedPct / 100);
    out.push({
      key: 'social', label: 'Paid social', active, spend, units: leads,
      inboundCalls: leads, qualifiedCalls: qualified, handledCalls: qualified,
      deals: 0, closeRatePct: ps.closeRatePct, avgDebt: ps.avgDebt, enrolledVolume: 0,
      costPerQualifiedCall: 0, costPerDeal: 0,
    });
  }
  return out;
}

/**
 * Resolve the month's marketing demand against the closer talk time available.
 *
 * @param availableCallMinutes closer minutes this month before any transfers
 * @returns the detail, with handledCalls / deals filled in and callMinutes =
 *          minutes the marketing calls consumed (to be removed from the pool
 *          the transfer capacity is derived from).
 */
export function resolveMarketingMonth(
  inputs: ModelInputs,
  month: number,
  availableCallMinutes: number,
): MarketingMonthDetail {
  const channels = channelDemand(inputs, month);
  const aht = Math.max(1, inputs.operations.avgHandleMinutes);
  const anyActive = channels.some((c) => c.active);
  const creative = anyActive ? inputs.marketing.creativeAndTrackingPerMonth : 0;

  const demandCalls = channels.reduce((s, c) => s + c.qualifiedCalls, 0);
  const capacityCalls = availableCallMinutes / aht;
  // Marketing calls are handled first; if they exceed the whole roster's talk
  // time, they are scaled down pro rata and the shortfall is reported.
  const fill = demandCalls > 0 ? Math.min(1, capacityCalls / demandCalls) : 1;

  let qualified = 0, handled = 0, deals = 0, enrolled = 0, spend = 0;
  for (const c of channels) {
    c.handledCalls = c.qualifiedCalls * fill;
    c.deals = c.handledCalls * (c.closeRatePct / 100);
    c.enrolledVolume = c.deals * c.avgDebt;
    c.costPerQualifiedCall = c.qualifiedCalls > 0 ? c.spend / c.qualifiedCalls : 0;
    c.costPerDeal = c.deals > 0 ? c.spend / c.deals : 0;
    qualified += c.qualifiedCalls; handled += c.handledCalls; deals += c.deals;
    enrolled += c.enrolledVolume; spend += c.spend;
  }

  return {
    channels,
    spend: spend + creative,
    creativeAndTracking: creative,
    qualifiedCalls: qualified,
    handledCalls: handled,
    unansweredCalls: Math.max(0, qualified - handled),
    deals,
    enrolledVolume: enrolled,
    callMinutes: handled * aht,
  };
}

export function marketingIsOn(inputs: ModelInputs): boolean {
  const mk = inputs.marketing;
  return !!(mk && ((mk.directMail && mk.directMail.enabled) || (mk.paidSocial && mk.paidSocial.enabled)));
}
