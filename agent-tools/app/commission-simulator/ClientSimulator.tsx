"use client";
import dynamic from "next/dynamic";

// ssr:false as before — the simulator is client-only. This wrapper exists so
// the page above it can stay a server component and read the role.
// The simulator is .jsx, so its props are typed here at the boundary.
const FundingTierCommissionSimulator = dynamic<{ mode: "admin" | "agent" }>(
  () => import("../../components/FundingTierCommissionSimulator"),
  { ssr: false }
);

export default function ClientSimulator({ mode }: { mode: "admin" | "agent" }) {
  return <FundingTierCommissionSimulator mode={mode} />;
}
