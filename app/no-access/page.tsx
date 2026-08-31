import { p as path } from "../../lib/paths";

export const dynamic = "force-dynamic";

export default function NoAccess() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(180deg,#ecfeff 0%,#ffffff 40%,#f8fafc 100%)",
        fontFamily: "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",
        padding: 24,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={path("/apple-touch-icon.png")}
          alt="Funding Tier"
          width={56}
          height={56}
          style={{ display: "block", margin: "0 auto 20px" }}
        />
        <h1 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
          Admin access only
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
          The Profit Engine is limited to admin users. Your agent tools are in the
          Krest Marketing App sidebar. If you think you should have admin access here,
          ask an admin to change your user role.
        </p>
      </div>
    </div>
  );
}
