"use client";

import dynamic from "next/dynamic";

const FundingTierCommissionSimulator = dynamic(
  () => import("../../components/FundingTierCommissionSimulator"),
  { ssr: false }
);

export default function CommissionSimulatorPage() {
  return <FundingTierCommissionSimulator />;
}
