import { getRole } from "../../lib/role";
import FundingTierOperatingModel from "../../components/FundingTierOperatingModel";

/** force-dynamic: the render depends on the role, so it must not be cached. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
  return <FundingTierOperatingModel mode={getRole()} />;
}
