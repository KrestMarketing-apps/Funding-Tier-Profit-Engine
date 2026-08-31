export const dynamic = "force-dynamic";

// This page runs inside GoHighLevel's iframe and is the only route reachable
// without a session besides /login. Everything it needs is inline: middleware
// keeps /_next/* gated, so a page that loaded a React bundle here would force
// us to make the app's JavaScript publicly downloadable. A <script> tag costs
// nothing and keeps that door shut.
const BRIDGE = `
(function () {
  var params = new URLSearchParams(window.location.search);
  var next = params.get("next") || "/";
  if (next.charAt(0) !== "/" || next.charAt(1) === "/") next = "/";

  function fail(title, detail) {
    document.getElementById("ft-title").textContent = title;
    document.getElementById("ft-detail").textContent = detail;
    document.getElementById("ft-spinner").style.display = "none";
  }

  if (window.parent === window) {
    fail(
      "Open this from the sidebar",
      "This tool signs you in using your Krest Marketing App session. Open it from the menu inside the app rather than by URL."
    );
    return;
  }

  var settled = false;
  var timer = setTimeout(function () {
    if (settled) return;
    settled = true;
    fail("No response from the app", "The Krest Marketing App did not return your user details. Reload the page, and if it keeps happening tell an admin the app may need reinstalling.");
  }, 10000);

  window.addEventListener("message", function (event) {
    if (!event.data || event.data.message !== "REQUEST_USER_DATA_RESPONSE") return;
    if (settled) return;
    settled = true;
    clearTimeout(timer);

    fetch("/api/ghl-sso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: event.data.payload })
    })
      .then(function (res) {
        return res.json().then(function (body) { return { status: res.status, body: body }; });
      })
      .then(function (r) {
        if (r.status === 200 && r.body && r.body.ok) {
          window.location.replace(next);
          return;
        }
        if (r.status === 403 && r.body && r.body.error === "no_role") {
          fail("No access for this account", "Your Krest Marketing App user does not have a role that can open this tool. Ask an admin to check your user role.");
        } else if (r.status === 403) {
          fail("Wrong account", "This tool is not enabled for the sub-account you are signed in to.");
        } else if (r.status === 503 && r.body && r.body.error === "tenant_not_configured") {
          fail("Almost set up", "Sign-in works. The last step is recording this account's IDs — companyId " + (r.body.companyId || "?") + ", location " + (r.body.activeLocation || "n/a") + ".");
        } else if (r.status === 503) {
          fail("Not configured yet", "Sign-in is not switched on for this tool. An admin needs to finish setup.");
        } else {
          fail("Could not sign you in", "Your session could not be verified. Reload the page and try once more.");
        }
      })
      .catch(function () {
        fail("Could not sign you in", "The sign-in request did not go through. Check your connection and reload.");
      });
  });

  window.parent.postMessage({ message: "REQUEST_USER_DATA" }, "*");
})();
`;

export default function GhlBridge() {
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
      <div style={{ textAlign: "center", maxWidth: 380 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/apple-touch-icon.png"
          alt="Funding Tier"
          width={56}
          height={56}
          style={{ display: "block", margin: "0 auto 20px" }}
        />
        <h1 id="ft-title" style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
          Signing you in
        </h1>
        <p id="ft-detail" style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
          One moment while we check your Krest Marketing App access.
        </p>
        <div
          id="ft-spinner"
          style={{
            width: 22,
            height: 22,
            margin: "22px auto 0",
            border: "2px solid #cbd5e1",
            borderTopColor: "#0f766e",
            borderRadius: "50%",
            animation: "ftspin .7s linear infinite",
          }}
        />
        <style>{"@keyframes ftspin{to{transform:rotate(360deg)}}"}</style>
      </div>
      <script dangerouslySetInnerHTML={{ __html: BRIDGE }} />
    </div>
  );
}
