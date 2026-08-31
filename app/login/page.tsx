import { BASE_PATH, p as path } from "../../lib/paths";

export const dynamic = "force-dynamic";

/**
 * The only way in.
 *
 * Inside the Krest Marketing App this page is an iframe: it asks the parent
 * window who is signed in, exchanges that for a session, and forwards on.
 * There is no password — every session carries a real person's email and
 * role, which is what makes the access log worth anything.
 *
 * The script is inline and runs before paint: middleware keeps /_next/*
 * gated, so a page needing a JS bundle here would make the app's compiled
 * code public.
 */
const BRIDGE = `
(function () {
  var d = document.documentElement;
  var BASE = "${BASE_PATH}";
  var params = new URLSearchParams(window.location.search);
  var next = params.get("next") || "/";
  if (next.charAt(0) !== "/" || next.charAt(1) === "/") next = "/";

  function show(title, detail) {
    d.setAttribute("data-state", "message");
    document.getElementById("ft-title").textContent = title;
    document.getElementById("ft-detail").textContent = detail;
  }

  if (window.parent === window) {
    show(
      "Open this from the sidebar",
      "This tool signs you in with your Krest Marketing App account. Open it from the menu inside the app — there is no separate password."
    );
    return;
  }

  var settled = false;
  var timer = setTimeout(function () {
    if (settled) return;
    settled = true;
    show("No response from the app", "The Krest Marketing App did not return your user details. Reload the page, and if it keeps happening tell an admin the app may need reinstalling.");
  }, 10000);

  window.addEventListener("message", function (event) {
    if (!event.data || event.data.message !== "REQUEST_USER_DATA_RESPONSE") return;
    if (settled) return;
    settled = true;
    clearTimeout(timer);

    fetch(BASE + "/api/ghl-sso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: event.data.payload })
    })
      .then(function (res) { return res.json().then(function (b) { return { status: res.status, body: b }; }); })
      .then(function (r) {
        if (r.status === 200 && r.body && r.body.ok) {
          window.location.replace(BASE + next);
          return;
        }
        if (r.status === 403 && r.body && r.body.error === "no_role") {
          show("No access for this account", "Your Krest Marketing App user does not have a role that can open this tool. Ask an admin to check your user role.");
        } else if (r.status === 403) {
          show("Wrong account", "This tool is not enabled for the sub-account you are signed in to.");
        } else if (r.status === 503 && r.body && r.body.error === "tenant_not_configured") {
          show("Almost set up", "Sign-in works. The last step is recording this account's IDs — companyId " + (r.body.companyId || "?") + ", location " + (r.body.activeLocation || "n/a") + ".");
        } else if (r.status === 503) {
          show("Not configured yet", "Sign-in is not switched on for this tool. An admin needs to finish setup.");
        } else {
          show("Could not sign you in", "Your session could not be verified. Reload the page and try once more.");
        }
      })
      .catch(function () {
        show("Could not sign you in", "The sign-in request did not go through. Check your connection and reload.");
      });
  });

  window.parent.postMessage({ message: "REQUEST_USER_DATA" }, "*");
})();
`;

const CSS = `
  [data-state="message"] .ft-spin { display: none; }
  @keyframes ftspin { to { transform: rotate(360deg) } }
`;

export default function Login() {
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
      background:"linear-gradient(180deg,#ecfeff 0%,#ffffff 40%,#f8fafc 100%)",
      fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",padding:24}}>
      <style>{CSS}</style>
      <script dangerouslySetInnerHTML={{ __html: BRIDGE }} />
      <div style={{textAlign:"center",maxWidth:400}}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={path("/apple-touch-icon.png")} alt="Funding Tier" width={56} height={56}
          style={{display:"block",margin:"0 auto 20px"}} />
        <h1 id="ft-title" style={{margin:"0 0 8px",fontSize:18,fontWeight:800,color:"#0f172a"}}>
          Signing you in
        </h1>
        <p id="ft-detail" style={{margin:0,fontSize:13,color:"#64748b",lineHeight:1.55}}>
          One moment while we check your Krest Marketing App access.
        </p>
        <div className="ft-spin" style={{width:22,height:22,margin:"22px auto 0",
          border:"2px solid #cbd5e1",borderTopColor:"#0f766e",borderRadius:"50%",
          animation:"ftspin .7s linear infinite"}} />
        <p style={{margin:"26px 0 0",fontSize:11,color:"#94a3b8",lineHeight:1.5}}>
          Profit Engine · access is recorded against your Krest Marketing App account
        </p>
      </div>
    </div>
  );
}
