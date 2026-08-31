export const dynamic = "force-dynamic";

export default function Login({
  searchParams,
}: {
  searchParams: { e?: string; next?: string };
}) {
  const failed = searchParams?.e === "1";
  const next = searchParams?.next || "/";
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
      background:"linear-gradient(180deg,#ecfeff 0%,#ffffff 40%,#f8fafc 100%)",
      fontFamily:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",padding:24}}>
      <form method="POST" action="/api/login"
        style={{width:"100%",maxWidth:380,background:"#fff",border:"1px solid #e2e8f0",
          borderRadius:16,padding:32,boxShadow:"0 10px 30px rgba(15,23,42,.08)"}}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/apple-touch-icon.png" alt="Funding Tier" width={56} height={56}
          style={{display:"block",margin:"0 auto 20px"}} />
        <h1 style={{margin:"0 0 6px",fontSize:19,fontWeight:800,color:"#0f172a",textAlign:"center"}}>
          Funding Tier
        </h1>
        <p style={{margin:"0 0 22px",fontSize:13,color:"#64748b",textAlign:"center",lineHeight:1.5}}>
          Internal tool. Enter the access password to continue.
        </p>
        <input type="hidden" name="next" value={next} />
        <input name="password" type="password" required autoFocus autoComplete="current-password"
          placeholder="Access password"
          style={{width:"100%",boxSizing:"border-box",padding:"12px 14px",fontSize:15,
            border:`1px solid ${failed ? "#ef4444" : "#cbd5e1"}`,borderRadius:10,
            outline:"none",marginBottom:12}} />
        {failed && (
          <div style={{color:"#dc2626",fontSize:13,marginBottom:12,fontWeight:600}}>
            Incorrect password.
          </div>
        )}
        <button type="submit"
          style={{width:"100%",padding:"12px 14px",fontSize:15,fontWeight:700,color:"#fff",
            background:"#0f766e",border:"none",borderRadius:10,cursor:"pointer"}}>
          Continue
        </button>
        <p style={{margin:"18px 0 0",fontSize:11,color:"#94a3b8",textAlign:"center",lineHeight:1.5}}>
          Do not share this password outside Funding Tier.
        </p>
      </form>
    </div>
  );
}
