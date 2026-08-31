import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * The handshake now lives on /login, which serves both ways in. This route is
 * kept as an alias so any custom page or menu link already pointing at /ghl
 * keeps working.
 */
export default function GhlAlias({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const next = searchParams?.next;
  redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
}
