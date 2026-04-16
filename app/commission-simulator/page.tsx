"use client";
import dynamic from "next/dynamic";
import type { Metadata } from "next";

const FundingTierCommissionSimulator = dynamic(
  () => import("../../components/FundingTierCommissionSimulator"),
  { ssr: false }
);

export default function CommissionSimulatorPage() {
  return <FundingTierCommissionSimulator />;
}
