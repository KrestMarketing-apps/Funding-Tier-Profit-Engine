"use client";
import { useState } from "react";
import { p } from "../../lib/paths";

const GRADE_COLOR: Record<string, string> = { A: "#15803d", B: "#0f766e", C: "#b45309", D: "#b91c1c" };

export function GradeBadge({ grade, auto }: { grade: string | null; auto?: boolean }) {
  if (!grade) return <span style={{ color: "#94a3b8" }}>—</span>;
  const c = GRADE_COLOR[grade] ?? "#475569";
  return (
    <span title={auto ? "Calculated from payment history; an admin can override it." : "Set by an admin."}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, background: c + "18", color: c, border: `1px solid ${c}55`, fontWeight: 900, fontSize: 14 }}>
      {grade}{auto && <span style={{ fontSize: 8, marginLeft: 1, opacity: 0.7 }}>auto</span>}
    </span>
  );
}

/**
 * Notes column. Agents see the note read-only; admins get an inline editor
 * (note + grade) that posts to /api/deal-notes.
 */
export default function NotesCell({ dealId, note, grade, autoGrade, canEdit }: {
  dealId: string; note: string | null; grade: string | null; autoGrade: string | null; canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [n, setN] = useState(note ?? "");
  const [g, setG] = useState(grade ?? "");
  const [saved, setSaved] = useState<{ note: string; grade: string }>({ note: note ?? "", grade: grade ?? "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(p("/api/deal-notes"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dealId, note: n, grade: g }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setSaved({ note: n, grade: g }); setEditing(false);
    } catch (e: any) { setErr(e.message || "Could not save."); }
    finally { setBusy(false); }
  };

  const shownGrade = saved.grade || autoGrade;
  if (!editing) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <GradeBadge grade={shownGrade} auto={!saved.grade && !!autoGrade} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: saved.note ? "#334155" : "#94a3b8", whiteSpace: "pre-wrap" }}>{saved.note || (canEdit ? "No note yet." : "—")}</div>
          {canEdit && <button onClick={() => setEditing(true)} style={{ marginTop: 4, fontSize: 11, fontWeight: 800, color: "#0f766e", background: "none", border: "none", padding: 0, cursor: "pointer" }}>{saved.note || saved.grade ? "Edit" : "Add note / grade"}</button>}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 6, minWidth: 220 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>GRADE</span>
        {["", "A", "B", "C", "D"].map((x) => (
          <button key={x || "none"} onClick={() => setG(x)} style={{ width: 28, height: 26, borderRadius: 6, fontWeight: 900, fontSize: 12, cursor: "pointer", border: `1px solid ${g === x ? (GRADE_COLOR[x] ?? "#475569") : "#e2e8f0"}`, background: g === x ? (GRADE_COLOR[x] ?? "#475569") + "22" : "#fff", color: GRADE_COLOR[x] ?? "#475569" }}>{x || "–"}</button>
        ))}
        {autoGrade && <span style={{ fontSize: 10.5, color: "#94a3b8" }}>auto: {autoGrade}</span>}
      </div>
      <textarea value={n} onChange={(e) => setN(e.target.value)} rows={3} placeholder="Note for this deal (the agent can read it)"
        style={{ width: "100%", fontSize: 12, padding: 6, borderRadius: 6, border: "1px solid #e2e8f0", fontFamily: "inherit", resize: "vertical" }} />
      {err && <div style={{ fontSize: 11, color: "#b91c1c" }}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={save} disabled={busy} style={{ fontSize: 12, fontWeight: 800, padding: "5px 10px", borderRadius: 6, border: "none", background: "#0f766e", color: "#fff", cursor: "pointer" }}>{busy ? "Saving…" : "Save"}</button>
        <button onClick={() => { setN(saved.note); setG(saved.grade); setEditing(false); }} style={{ fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer" }}>Cancel</button>
      </div>
    </div>
  );
}
