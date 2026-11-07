import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { payQuery } from "../../../lib/payDb";

/**
 * Admin-written note and quality grade on one deal, shown on My Deals & Pay.
 *
 * Admin only (middleware forwards the role). Writes go to ao_deal_notes, a
 * table the Profit Engine owns but never rebuilds, so notes survive every pay
 * recompute. Grade is free text but the UI offers A / B / C / D / blank.
 */
export const dynamic = "force-dynamic";

const GRADES = new Set(["", "A", "B", "C", "D"]);

export async function POST(req: NextRequest) {
  const h = headers();
  if (h.get("x-ft-role") !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  const by = h.get("x-ft-user") ?? "admin";

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Bad JSON." }, { status: 400 }); }
  const dealId = String(body?.dealId ?? "").trim();
  const note = String(body?.note ?? "").slice(0, 2000);
  const grade = String(body?.grade ?? "").trim().toUpperCase();
  if (!dealId) return NextResponse.json({ ok: false, error: "dealId is required." }, { status: 400 });
  if (!GRADES.has(grade)) return NextResponse.json({ ok: false, error: "Grade must be A, B, C, D or blank." }, { status: 400 });

  await payQuery(
    `create table if not exists ao_deal_notes (
       deal_id text primary key, note text, grade text, updated_by text, updated_at timestamptz not null default now())`,
  );
  if (!note && !grade) {
    await payQuery(`delete from ao_deal_notes where deal_id = $1`, [dealId]);
  } else {
    await payQuery(
      `insert into ao_deal_notes (deal_id, note, grade, updated_by, updated_at) values ($1, $2, $3, $4, now())
       on conflict (deal_id) do update set note = excluded.note, grade = excluded.grade, updated_by = excluded.updated_by, updated_at = now()`,
      [dealId, note || null, grade || null, by],
    );
  }
  return NextResponse.json({ ok: true });
}
