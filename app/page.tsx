import { getRole } from "../lib/role";
import FundingTierProfitabilityBalancer from "../components/FundingTierProfitabilityBalancer";

/**
 * Server component so the role can be read from the request headers edge
 * middleware forwards. The tool is a client component and takes `mode`.
 *
 * force-dynamic is load-bearing, not boilerplate: without it Next serves this
 * route from the full route cache (x-nextjs-cache: HIT, s-maxage of a year),
 * which means one visitor's role-rendered HTML can be handed to the next.
 * Every page that reads the role needs this.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
  return <FundingTierProfitabilityBalancer mode={getRole()} />;
}
