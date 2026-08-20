'use client';
//
// Funding Tier — Operating Model
//
// Entry point for app/operating-model/page.tsx. The page keeps importing this
// exact path, so nothing outside components/ has to change.
//
// Everything this component needs lives in ./operatingModel/. Nothing here
// touches components/fundingTierEngine.ts, which is shared with the Commission
// Simulator and the Profitability Balancer.
//
import OperatingModel from './operatingModel/OperatingModel';

export default function FundingTierOperatingModel() {
  return <OperatingModel />;
}
