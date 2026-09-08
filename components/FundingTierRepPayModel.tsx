'use client';
//
// Funding Tier — Rep Pay Model
//
// Entry point for app/rep-pay-model/page.tsx. Reference/explainer material for
// the draw + tiered-scale compensation decision — mechanism, trade-offs, the
// 90-day ramp safeguard, and the live tier schedule. Not a simulator; for the
// numbers, see the Operating Model (components/operatingModel/), which this
// page links to and reads its tier/ramp defaults from.
//
import RepPayModel from './repPayModel/RepPayModel';

export default function FundingTierRepPayModel({ mode = 'admin' }: { mode?: 'admin' | 'agent' }) {
  return <RepPayModel mode={mode} />;
}
