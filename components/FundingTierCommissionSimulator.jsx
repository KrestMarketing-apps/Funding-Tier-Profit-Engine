import { useState, useMemo, useRef } from "react";

// ─── BRAND ──────────────────────────────────────────────
const G      = "#0f9d8a";
const GD     = "#0b7d6e";
const DARK   = "#0f172a";
const BLUE   = "#1a6ed8";
const AMBER  = "#f59e0b";
const RED    = "#ef4444";
const PURPLE = "#7c3aed";
const BG     = "#f8fafc";
const BORDER = "#e2e8f0";

const FT_LOGO = "https://assets.cdn.filesafe.space/S4ztIlDxBovAboldwbOR/media/68783cf82035bab4d790ae7e.png";
const LD_LOGO = "https://assets.cdn.filesafe.space/S4ztIlDxBovAboldwbOR/media/69c35b2cab2203b0fc83186d.webp";
const CS_LOGO = "https://assets.cdn.filesafe.space/S4ztIlDxBovAboldwbOR/media/69c35b2c25c6995d2d2d21fa.png";

const fmt = n => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n);

// ─── DATA ───────────────────────────────────────────────
const LD_TIERS = [
  { id:1, label:"Tier 1", range:"$0 – $999,999 / mo",  rate:0.010,  rateLabel:"1.00%" },
  { id:2, label:"Tier 2", range:"$1M – $1.99M / mo",   rate:0.0115, rateLabel:"1.15%" },
  { id:3, label:"Tier 3", range:"$2M+ / mo",           rate:0.013,  rateLabel:"1.30%" },
];

const CS_PROGS = [
  { key:"A", label:"Program A", range:"$4,000 – $4,999",   total:150, p2:150, p4:0   },
  { key:"B", label:"Program B", range:"$5,000 – $8,799",   total:150, p2:150, p4:0   },
  { key:"C", label:"Program C", range:"$8,800 – $9,999",   total:150, p2:150, p4:0   },
  { key:"D", label:"Program D", range:"$10,000 – $14,999", total:225, p2:175, p4:50  },
  { key:"E", label:"Program E", range:"$15,000 – $19,999", total:275, p2:200, p4:75  },
  { key:"F", label:"Program F", range:"$20,000 – $24,999", total:350, p2:250, p4:100 },
  { key:"G", label:"Program G", range:"$25,000 – $29,999", total:400, p2:300, p4:100 },
  { key:"H", label:"Program H", range:"$30,000 – $49,999", total:500, p2:375, p4:125 },
  { key:"I", label:"Program I", range:"$50,000+",          total:600, p2:450, p4:150 },
];

function getCSProg(debt){ return CS_PROGS.find(p=>{
  const mins={A:4000,B:5000,C:8800,D:10000,E:15000,F:20000,G:25000,H:30000,I:50000};
  const maxs={A:4999,B:8799,C:9999,D:14999,E:19999,F:24999,G:29999,H:49999,I:Infinity};
  return debt>=mins[p.key]&&debt<=maxs[p.key];
})??null; }

function getDailySpiff(n){ return n>=5?75:n>=3?50:0; }
function getMonthlyBonus(n){
  if(n>=30)return 2250; if(n>=23)return 1500; if(n>=17)return 1000;
  if(n>=12)return 600;  if(n>=8)return 300;   return 0;
}
function getNextBonus(n){
  const t=[{t:8,b:300},{t:12,b:600},{t:17,b:1000},{t:23,b:1500},{t:30,b:2250}];
  return t.find(x=>n<x.t)??null;
}
function getBalanceBonus(ld,cs){
  const total=ld+cs;
  if(total<5)return{bonus:0,label:"Need at least 5 total deals to qualify",pct:0};
  const bal=Math.min(cs/total,ld/total)*2;
  if(bal>=0.7)return{bonus:500,label:"Balanced book — 35/65 mix or better",pct:bal};
  if(bal>=0.5)return{bonus:250,label:"Mixed book bonus — working toward balance",pct:bal};
  if(bal>=0.3)return{bonus:100,label:"Starter mix bonus",pct:bal};
  return{bonus:0,label:"Enroll in both products to earn a balance bonus",pct:bal};
}

// ─── SHARED UI ──────────────────────────────────────────
const card={background:"#fff",border:`1px solid ${BORDER}`,borderRadius:16,padding:20,boxShadow:"0 3px 12px rgba(15,23,42,0.05)"};

function Card({children,style}){ return <div style={{...card,...style}}>{children}</div>; }

function MetricCard({title,value,sub,accent,large}){
  return(
    <div style={{...card,position:"relative",overflow:"hidden"}}>
      {accent&&<div style={{position:"absolute",top:0,left:0,right:0,height:3,background:accent,borderRadius:"16px 16px 0 0"}}/>}
      <div style={{fontSize:12,fontWeight:800,color:"#64748b",marginBottom:8,textTransform:"uppercase",letterSpacing:0.5,marginTop:accent?6:0,lineHeight:1.3}}>{title}</div>
      <div style={{fontSize:large?28:22,fontWeight:900,color:DARK,lineHeight:1.1,wordBreak:"break-word"}}>{value}</div>
      {sub&&<div style={{fontSize:13,color:"#475569",marginTop:8,lineHeight:1.6,fontWeight:500}}>{sub}</div>}
    </div>
  );
}

function Lbl({children}){
  return <div style={{fontSize:14,fontWeight:800,color:"#1e293b",marginBottom:8,letterSpacing:"-0.1px"}}>{children}</div>;
}

function SectionHead({children,color=G,logo}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18,paddingBottom:12,borderBottom:`2px solid ${color}`}}>
      {logo&&<img src={logo} alt="" style={{height:30,width:"auto",objectFit:"contain"}}/>}
      <div style={{fontWeight:900,fontSize:18,color:DARK}}>{children}</div>
    </div>
  );
}

function ProgressBar({value,max,color}){
  return(
    <div style={{height:9,background:"#f1f5f9",borderRadius:99,overflow:"hidden"}}>
      <div style={{height:"100%",borderRadius:99,width:`${Math.min(100,(value/Math.max(max,1))*100)}%`,background:color,transition:"width 0.4s ease"}}/>
    </div>
  );
}

// Tooltip wrapper
function Tip({tip,children}){
  const [show,setShow]=useState(false);
  return(
    <div style={{position:"relative",display:"inline-block"}}
      onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}>
      {children}
      {show&&(
        <div style={{position:"absolute",bottom:"calc(100% + 8px)",left:"50%",transform:"translateX(-50%)",
          background:DARK,color:"#fff",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,
          whiteSpace:"nowrap",zIndex:200,boxShadow:"0 4px 16px rgba(0,0,0,0.25)",pointerEvents:"none"}}>
          {tip}
          <div style={{position:"absolute",top:"100%",left:"50%",transform:"translateX(-50%)",
            width:0,height:0,borderLeft:"5px solid transparent",borderRight:"5px solid transparent",
            borderTop:`5px solid ${DARK}`}}/>
        </div>
      )}
    </div>
  );
}

// Accordion
function Accordion({title,color=G,children}){
  const [open,setOpen]=useState(false);
  return(
    <div style={{border:`1px solid ${BORDER}`,borderRadius:14,overflow:"hidden",background:"#fff",marginBottom:8}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",display:"flex",justifyContent:"space-between",
        alignItems:"center",padding:"16px 20px",border:"none",background:"#fff",cursor:"pointer",
        textAlign:"left"}}>
        <span style={{fontWeight:800,fontSize:15,color:DARK}}>{title}</span>
        <span style={{fontSize:20,fontWeight:900,color,transition:"transform 0.2s",
          transform:open?"rotate(45deg)":"rotate(0deg)"}}>+</span>
      </button>
      {open&&(
        <div style={{borderTop:`1px solid ${BORDER}`,padding:"20px 24px",background:"#fafcff"}}>
          {children}
        </div>
      )}
    </div>
  );
}

function PolicySection({heading,children}){
  return(
    <div style={{marginBottom:20}}>
      <div style={{fontWeight:800,fontSize:15,color:DARK,marginBottom:8,paddingBottom:6,
        borderBottom:`1px solid ${BORDER}`}}>{heading}</div>
      <div style={{fontSize:14,color:"#374151",lineHeight:1.85,fontWeight:400}}>{children}</div>
    </div>
  );
}

function PolicyTable({headers,rows}){
  return(
    <div style={{overflowX:"auto",borderRadius:10,border:`1px solid ${BORDER}`,marginTop:10,marginBottom:10}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}>
        <thead>
          <tr style={{background:DARK}}>
            {headers.map(h=>(
              <th key={h} style={{padding:"10px 14px",color:"#fff",fontWeight:700,fontSize:13,
                textAlign:"left",borderRight:"1px solid rgba(255,255,255,0.15)"}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row,i)=>(
            <tr key={i} style={{background:i%2?"#f8fafc":"#fff"}}>
              {row.map((cell,j)=>(
                <td key={j} style={{padding:"10px 14px",borderRight:`1px solid ${BORDER}`,
                  borderBottom:`1px solid ${BORDER}`,color:"#374151",fontWeight:j===0?700:400}}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AlertBox({color,bg,children}){
  return(
    <div style={{background:bg,border:`1px solid ${color}44`,borderRadius:10,
      padding:"12px 16px",marginTop:10,marginBottom:10,fontSize:14,color:"#374151",
      lineHeight:1.7,borderLeft:`4px solid ${color}`}}>
      {children}
    </div>
  );
}

// Tab bar with tooltips on first two tabs
function TabBar({tabs,active,onSelect}){
  return(
    <div style={{display:"flex",gap:3,background:"#f1f5f9",borderRadius:12,padding:4,marginBottom:20}}>
      {tabs.map(t=>(
        t.tip
          ? <Tip key={t.id} tip={t.tip}>
              <button onClick={()=>onSelect(t.id)} style={{
                padding:"10px 8px",borderRadius:9,border:"none",fontWeight:800,fontSize:13,cursor:"pointer",
                background:active===t.id?DARK:"transparent",
                color:active===t.id?"#fff":"#64748b",transition:"all 0.15s",whiteSpace:"nowrap",
              }}>{t.label}</button>
            </Tip>
          : <button key={t.id} onClick={()=>onSelect(t.id)} style={{
              flex:1,padding:"10px 8px",borderRadius:9,border:"none",fontWeight:800,fontSize:13,cursor:"pointer",
              background:active===t.id?DARK:"transparent",
              color:active===t.id?"#fff":"#64748b",transition:"all 0.15s",
            }}>{t.label}</button>
      ))}
    </div>
  );
}

// ─── LEVEL DEBT TAB ─────────────────────────────────────
function LevelDebtTab(){
  const [ldTier,setLdTier]=useState(1);
  const [debt,setDebt]=useState(18000);
  const tier=LD_TIERS.find(t=>t.id===ldTier);
  const comm=Math.round(debt*tier.rate);

  return(
    <div style={{display:"grid",gap:16}}>
      <Card>
        <SectionHead logo={LD_LOGO} color={G}>Level Debt — Debt Settlement</SectionHead>

        {/* Tier selector */}
        <div style={{marginBottom:22}}>
          <Lbl>Your Current Commission Tier</Lbl>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            {LD_TIERS.map(t=>(
              <button key={t.id} onClick={()=>setLdTier(t.id)} style={{
                padding:"14px 10px",borderRadius:12,cursor:"pointer",
                border:ldTier===t.id?`2px solid ${G}`:`1px solid ${BORDER}`,
                background:ldTier===t.id?G+"12":"#fff",textAlign:"center",transition:"all 0.15s",
              }}>
                <div style={{fontWeight:900,fontSize:22,color:ldTier===t.id?GD:DARK}}>{t.rateLabel}</div>
                <div style={{fontSize:13,fontWeight:800,color:ldTier===t.id?G:"#64748b",marginTop:4}}>{t.label}</div>
                <div style={{fontSize:12,color:"#94a3b8",marginTop:3,lineHeight:1.4}}>{t.range}</div>
              </button>
            ))}
          </div>
          <div style={{fontSize:13,color:"#64748b",marginTop:10,fontWeight:500,lineHeight:1.6,
            background:"#f8fafc",borderRadius:8,padding:"8px 12px",border:`1px solid ${BORDER}`}}>
            Your tier is based on <strong style={{color:DARK}}>your total monthly enrolled debt volume</strong>. Check with your manager if you are unsure which tier applies to you.
          </div>
        </div>

        {/* Debt input */}
        <div style={{marginBottom:22}}>
          <Lbl>Total Enrolled Debt ($)</Lbl>
          <input type="number" value={debt} min={7000} step={500}
            onChange={e=>setDebt(Number(e.target.value))}
            style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`1px solid ${BORDER}`,
              fontSize:17,fontWeight:800,color:DARK,background:"#fff",boxSizing:"border-box"}}/>
          {debt<7000&&<div style={{color:RED,fontWeight:700,fontSize:13,marginTop:7}}>⚠ Minimum $7,000 enrolled debt required for Level Debt enrollment.</div>}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
          <MetricCard title="Your Commission" value={debt>=7000?fmt(comm):"—"}
            sub={`${tier.rateLabel} of Total Cleared Enrolled Debt`} accent={G} large/>
          <MetricCard title="When You Get Paid" value="20th of Month 3"
            sub="After 2 successful program payments clear" accent={G}/>
          <MetricCard title="Commission Formula"
            value={`${fmt(debt)} × ${tier.rateLabel}`}
            sub={`= ${fmt(comm)} total commission`} accent="#94a3b8"/>
        </div>
      </Card>

      {/* Tier table */}
      <Card>
        <div style={{fontWeight:800,fontSize:16,color:DARK,marginBottom:14}}>All Commission Rate Tiers</div>
        <div style={{overflowX:"auto",borderRadius:12,border:`1px solid ${BORDER}`}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}>
            <thead>
              <tr style={{background:DARK}}>
                {["Tier","Monthly Enrolled Debt Volume","Your Rate","Example — $20k Deal","Example — $50k Deal"].map(h=>(
                  <th key={h} style={{padding:"11px 14px",color:"#fff",fontWeight:700,fontSize:13,
                    textAlign:"left",borderRight:"1px solid rgba(255,255,255,0.15)"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LD_TIERS.map((t,i)=>{
                const isActive=ldTier===t.id;
                return(
                  <tr key={t.id} style={{background:isActive?G+"10":i%2?"#f8fafc":"#fff",
                    borderLeft:isActive?`3px solid ${G}`:"3px solid transparent"}}>
                    <td style={{padding:"11px 14px",fontWeight:900,fontSize:15,color:isActive?GD:DARK,
                      borderRight:`1px solid ${BORDER}`}}>
                      {t.label} {isActive&&<span style={{fontSize:11,background:G+"22",color:G,
                        padding:"1px 7px",borderRadius:99,marginLeft:6,fontWeight:700}}>current</span>}
                    </td>
                    <td style={{padding:"11px 14px",color:"#475569",fontWeight:600,borderRight:`1px solid ${BORDER}`}}>{t.range}</td>
                    <td style={{padding:"11px 14px",fontWeight:900,fontSize:18,color:G,borderRight:`1px solid ${BORDER}`}}>{t.rateLabel}</td>
                    <td style={{padding:"11px 14px",fontWeight:700,color:GD,borderRight:`1px solid ${BORDER}`}}>{fmt(Math.round(20000*t.rate))}</td>
                    <td style={{padding:"11px 14px",fontWeight:700,color:GD}}>{fmt(Math.round(50000*t.rate))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Policy accordion */}
      <Accordion title="Funding Tier Debt Settlement Agent Commissions — Full Policy Explained" color={G}>
        <PolicySection heading="What is Debt Settlement?">
          Level Debt is Funding Tier's debt settlement partner. When you enroll a client into a debt settlement program, the client makes monthly payments into a dedicated account. Level Debt works with their creditors to negotiate and settle their outstanding unsecured debts over time. Your commission is earned when those program payments begin clearing successfully.
        </PolicySection>

        <PolicySection heading="Minimum Enrollment Requirement">
          <AlertBox color={RED} bg="#fef2f2">
            <strong>Level Debt requires a minimum of $7,000 in total enrolled unsecured debt.</strong> Any deal below $7,000 is ineligible for Level Debt enrollment and cannot be submitted. These deals must be evaluated for Consumer Shield Debt Validation instead.
          </AlertBox>
        </PolicySection>

        <PolicySection heading="Commission Rate — How It's Calculated">
          Your commission is calculated as a percentage of the client's <strong>Total Cleared Enrolled Debt</strong>. "Total Cleared Enrolled Debt" means the total dollar amount of debt enrolled in the program that has no remaining chargeback liability attached to it.
          <PolicyTable
            headers={["Tier","Your Monthly Enrolled Volume","Commission Rate","Example: $25,000 Deal"]}
            rows={[
              ["Tier 1","$0 – $999,999 / month","1.00%",fmt(250)],
              ["Tier 2","$1,000,000 – $1,999,999 / month","1.15%",fmt(287.50)],
              ["Tier 3","$2,000,000+ / month","1.30%",fmt(325)],
            ]}
          />
          Your tier is determined by <strong>your own total monthly enrolled debt volume</strong>, not the team's. As your monthly volume grows, your rate automatically increases. Contact your manager to confirm which tier you are currently on.
        </PolicySection>

        <PolicySection heading="When You Get Paid — Payout Timing">
          Commission payouts follow a specific vesting schedule designed to protect against early cancellations and chargeback liability:
          <AlertBox color={G} bg="#f0fdf9">
            <strong>Payout date:</strong> After the client successfully completes <strong>2 monthly program payments</strong> (or 4 bi-weekly deposits), commissions are paid on the <strong>20th of the following month</strong>.<br/><br/>
            <strong>Example:</strong> Client enrolled January 1. Payment 1 clears February 1. Payment 2 clears March 1. <strong>Your commission is paid March 20.</strong>
          </AlertBox>
        </PolicySection>

        <PolicySection heading="Chargebacks and Clawbacks">
          Debt resolution programs operate under an advance fee model administered by third-party servicing partners. This means chargeback exposure exists if a client cancels early.
          <AlertBox color={RED} bg="#fef2f2">
            <strong>Chargeback Rule:</strong> A client must complete a minimum of <strong>3 program payments</strong> to be fully outside the chargeback liability window. If a client cancels or fails to complete at least 3 program payments, the associated enrollment may trigger a chargeback from the servicing partner — and you as the agent may be responsible for the commission chargeback or clawback.<br/><br/>
            <strong>NSF / Returned Payments:</strong> Chargebacks also apply if a client's bank account returns NSF (Non-Sufficient Funds).<br/><br/>
            <strong>Recovery:</strong> Any chargeback amounts may be deducted from future commission payouts owed to you.
          </AlertBox>
          <PolicyTable
            headers={["Scenario","Chargeback Risk","Your Liability"]}
            rows={[
              ["Client completes 2 payments — then cancels","Yes — within liability window","Possible clawback of commission"],
              ["Client completes 3+ payments","No — outside liability window","No clawback"],
              ["Client returns NSF on any payment","Yes","Possible clawback"],
              ["Client completes full program","No","Commission fully earned"],
            ]}
          />
        </PolicySection>

        <PolicySection heading="Verification of Deposits">
          Funding Tier reserves the right to verify all client deposit activity through backend reporting from servicing partners <strong>before approving and issuing any commission payout</strong>. Do not assume a commission is confirmed until the payout has been formally processed and deposited.
        </PolicySection>

        <PolicySection heading="Important Terms">
          <ul style={{paddingLeft:20,margin:0,lineHeight:2.2}}>
            <li><strong>Total Cleared Enrolled Debt</strong> — The dollar amount enrolled in the program with no chargeback liability remaining attached to it.</li>
            <li><strong>Program Payments</strong> — Monthly (or bi-weekly) client deposits into their dedicated debt settlement savings account.</li>
            <li><strong>Chargeback Window</strong> — The period during which a returned or cancelled payment can result in a clawback of your commission.</li>
            <li><strong>Verification Period</strong> — The time Funding Tier uses to confirm that program payments have cleared through the servicing partner before releasing commissions.</li>
            <li><strong>Independent Contractor</strong> — You participate in this program as an independent contractor. You are responsible for your own tax obligations and marketing expenses.</li>
          </ul>
        </PolicySection>

        <PolicySection heading="Commission Modifications">
          Funding Tier reserves the right to modify commission structures at its sole discretion at any time. Material changes will be communicated. Continued participation in the program constitutes acceptance of any updated terms.
        </PolicySection>
      </Accordion>
    </div>
  );
}

// ─── CS TAB ─────────────────────────────────────────────
function CSTab(){
  const [debt,setDebt]=useState(20000);
  const prog=getCSProg(debt);
  const mins={A:4000,B:5000,C:8800,D:10000,E:15000,F:20000,G:25000,H:30000,I:50000};

  return(
    <div style={{display:"grid",gap:16}}>
      <Card>
        <SectionHead logo={CS_LOGO} color={BLUE}>Consumer Shield — Debt Validation</SectionHead>
        <div style={{marginBottom:18}}>
          <Lbl>Total Enrolled Debt ($)</Lbl>
          <input type="number" value={debt} min={4000} step={500}
            onChange={e=>setDebt(Number(e.target.value))}
            style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`1px solid ${BORDER}`,
              fontSize:17,fontWeight:800,color:DARK,background:"#fff",boxSizing:"border-box"}}/>
          {debt<4000&&<div style={{color:RED,fontWeight:700,fontSize:13,marginTop:7}}>⚠ Minimum $4,000 debt required for Consumer Shield enrollment.</div>}
        </div>

        {!prog?(
          <div style={{background:"#fef2f2",borderRadius:12,padding:"12px 16px",color:RED,fontWeight:700,fontSize:14}}>
            Debt amount is below the $4,000 minimum — not eligible for Consumer Shield enrollment.
          </div>
        ):(
          <>
            <div style={{display:"inline-flex",alignItems:"center",gap:10,background:BLUE+"12",
              borderRadius:10,padding:"9px 16px",border:`1px solid ${BLUE}33`,marginBottom:16}}>
              <span style={{fontWeight:900,fontSize:15,color:BLUE}}>{prog.label}</span>
              <span style={{fontSize:13,color:"#64748b",fontWeight:600}}>{prog.range}</span>
              {prog.p4===0&&<span style={{fontSize:11,fontWeight:800,background:G+"22",color:GD,
                padding:"2px 8px",borderRadius:99}}>Full payout at P2</span>}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
              <MetricCard title="Total Commission" value={fmt(prog.total)} sub="Full amount for this deal" accent={BLUE} large/>
              <MetricCard title="Paid at Payment 2" value={fmt(prog.p2)} sub="20th of Month 3" accent={BLUE}/>
              <MetricCard
                title={prog.p4>0?"Paid at Payment 4":"Second Payout"}
                value={prog.p4>0?fmt(prog.p4):"—"}
                sub={prog.p4>0?"20th of Month 5":"Single payout — no split on this tier"}
                accent={prog.p4>0?BLUE:"#e2e8f0"}/>
            </div>

            {/* Timeline */}
            <div style={{background:"#f8fafc",borderRadius:12,padding:"16px 18px"}}>
              <div style={{fontSize:12,fontWeight:800,color:"#64748b",textTransform:"uppercase",
                letterSpacing:0.5,marginBottom:14}}>Your Payout Timeline</div>
              <div style={{display:"flex",alignItems:"flex-start"}}>
                {[
                  {label:"Deal Enrolled",month:"Month 1",amt:null},
                  {label:"Payment 2 Clears",month:"Month 2",amt:fmt(prog.p2)},
                  ...(prog.p4>0?[{label:"Payment 4 Clears",month:"Month 4",amt:fmt(prog.p4)}]:[]),
                ].map((step,i,arr)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",flex:i<arr.length-1?1:0}}>
                    <div style={{textAlign:"center",minWidth:110}}>
                      <div style={{width:40,height:40,borderRadius:"50%",margin:"0 auto 7px",
                        background:step.amt?BLUE:"#e2e8f0",display:"flex",alignItems:"center",
                        justifyContent:"center",fontSize:14,fontWeight:900,
                        color:step.amt?"#fff":"#94a3b8"}}>{i+1}</div>
                      <div style={{fontSize:12,fontWeight:800,color:step.amt?DARK:"#94a3b8"}}>{step.label}</div>
                      <div style={{fontSize:11,color:"#94a3b8",marginTop:2,fontWeight:600}}>{step.month}</div>
                      {step.amt&&<div style={{fontSize:16,fontWeight:900,color:BLUE,marginTop:5}}>{step.amt}</div>}
                    </div>
                    {i<arr.length-1&&<div style={{flex:1,height:2,background:"#e2e8f0",margin:"0 4px",marginBottom:26}}/>}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Full schedule */}
      <Card>
        <div style={{fontWeight:800,fontSize:16,color:DARK,marginBottom:14}}>Full Commission Schedule — Debt Validation</div>
        <div style={{overflowX:"auto",borderRadius:12,border:`1px solid ${BORDER}`}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}>
            <thead>
              <tr style={{background:DARK}}>
                {["Program","Debt Range","At Payment 2","At Payment 4","Total Commission"].map(h=>(
                  <th key={h} style={{padding:"11px 14px",color:"#fff",fontWeight:700,fontSize:13,
                    textAlign:"left",borderRight:"1px solid rgba(255,255,255,0.15)"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CS_PROGS.map((p,i)=>{
                const isActive=prog?.key===p.key;
                return(
                  <tr key={p.key} style={{background:isActive?BLUE+"10":i%2?"#f8fafc":"#fff",
                    borderLeft:isActive?`3px solid ${BLUE}`:"3px solid transparent"}}>
                    <td style={{padding:"10px 14px",fontWeight:900,fontSize:14,color:isActive?BLUE:DARK,
                      borderRight:`1px solid ${BORDER}`}}>
                      {p.label}
                      {isActive&&<span style={{fontSize:11,background:BLUE+"22",color:BLUE,
                        padding:"1px 7px",borderRadius:99,marginLeft:6,fontWeight:700}}>current</span>}
                    </td>
                    <td style={{padding:"10px 14px",color:"#475569",fontWeight:600,borderRight:`1px solid ${BORDER}`}}>{p.range}</td>
                    <td style={{padding:"10px 14px",fontWeight:800,color:BLUE,fontSize:14,borderRight:`1px solid ${BORDER}`}}>{fmt(p.p2)}</td>
                    <td style={{padding:"10px 14px",color:p.p4>0?BLUE:"#94a3b8",fontWeight:p.p4>0?800:500,borderRight:`1px solid ${BORDER}`}}>{p.p4>0?fmt(p.p4):"—"}</td>
                    <td style={{padding:"10px 14px",fontWeight:900,fontSize:16,color:GD}}>{fmt(p.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{fontSize:13,color:"#64748b",marginTop:10,fontWeight:600}}>
          * Programs A, B, and C: $150 guaranteed minimum paid in full at Payment 2. No split.
        </div>
      </Card>

      {/* Policy accordion */}
      <Accordion title="Consumer Shield Debt Validation Agent Commissions — Full Policy Explained" color={BLUE}>
        <PolicySection heading="What is Debt Validation?">
          Consumer Shield is Funding Tier's debt validation partner. Debt validation is a legal process where a client's debts are formally challenged and creditors are required to provide proof that the debt is valid, legally collectible, and accurately reported. Unlike debt settlement, debt validation focuses on disputing and verifying debt accuracy. Your commission is earned as the client progresses through their program payments.
        </PolicySection>

        <PolicySection heading="Minimum Enrollment Requirement">
          <AlertBox color={BLUE} bg="#eff6ff">
            Consumer Shield accepts enrolled debt starting at <strong>$4,000</strong>. There is no upper limit. All deals between $4,000 and $6,999 can <strong>only</strong> go to Consumer Shield — Level Debt will not accept them.
          </AlertBox>
        </PolicySection>

        <PolicySection heading="Commission Structure — Flat Rates by Program">
          Unlike Level Debt which pays a percentage of enrolled debt, Consumer Shield commissions are <strong>flat dollar amounts</strong> tied to the program tier assigned to the client's enrolled debt. Your commission is the same regardless of where within the tier the exact debt amount falls.
          <PolicyTable
            headers={["Program","Debt Range","Paid at Payment 2","Paid at Payment 4","Your Total"]}
            rows={CS_PROGS.map(p=>[p.label,p.range,fmt(p.p2),p.p4>0?fmt(p.p4):"—",fmt(p.total)])}
          />
          <div style={{fontSize:13,color:"#64748b",marginTop:8,fontWeight:600}}>
            * Programs A–C ($4,000–$9,999): $150 flat, paid in full at Payment 2. No second payment split.
          </div>
        </PolicySection>

        <PolicySection heading="When You Get Paid — Payout Timing">
          Consumer Shield commissions are paid in up to two installments depending on the program tier:
          <AlertBox color={BLUE} bg="#eff6ff">
            <strong>Payment 2 Payout:</strong> Paid on the <strong>20th of Month 3</strong> after the client's 2nd successful monthly payment clears.<br/><br/>
            <strong>Payment 4 Payout (Programs D–I only):</strong> Paid on the <strong>20th of Month 5</strong> after the client's 4th successful monthly payment clears.<br/><br/>
            <strong>Example (Program F — $20,000 deal):</strong> Client enrolled January 1. Payment 2 clears March 1 → <strong>$250 paid March 20</strong>. Payment 4 clears May 1 → <strong>$100 paid May 20</strong>. Total earned: $350.
          </AlertBox>
          <PolicyTable
            headers={["Program Tier","First Payout","Second Payout","Payout Timing"]}
            rows={[
              ["Programs A, B, C",fmt(150),"None","20th of Month 3 (full payment)"],
              ["Program D",fmt(175),fmt(50),"P2: 20th of Month 3 · P4: 20th of Month 5"],
              ["Program E",fmt(200),fmt(75),"P2: 20th of Month 3 · P4: 20th of Month 5"],
              ["Program F",fmt(250),fmt(100),"P2: 20th of Month 3 · P4: 20th of Month 5"],
              ["Program G",fmt(300),fmt(100),"P2: 20th of Month 3 · P4: 20th of Month 5"],
              ["Program H",fmt(375),fmt(125),"P2: 20th of Month 3 · P4: 20th of Month 5"],
              ["Program I",fmt(450),fmt(150),"P2: 20th of Month 3 · P4: 20th of Month 5"],
            ]}
          />
        </PolicySection>

        <PolicySection heading="Chargebacks and Clawbacks">
          <AlertBox color={RED} bg="#fef2f2">
            <strong>Clawback Rule (Programs D–I):</strong> If a client enrolled in Programs D through I cancels or defaults <strong>before Payment 4 clears</strong>, and you have already received the Payment 2 payout, that Payment 2 commission is subject to clawback within <strong>60 days of cancellation</strong>.<br/><br/>
            <strong>Programs A, B, C:</strong> Not subject to clawback. The single $150 payment triggers only when Payment 2 clears — if it never clears, no commission is issued. Nothing to claw back.<br/><br/>
            <strong>NSF / Returned Payments:</strong> If a client's bank account returns NSF or the payment reverses, the qualifying payment milestone is not considered met. Commission is not triggered until valid, cleared payments are confirmed.
          </AlertBox>
          <PolicyTable
            headers={["Scenario","Program","Clawback?"]}
            rows={[
              ["Client cancels before Payment 2","Any","No commission ever issued"],
              ["Client cancels after P2, before P4","Programs D–I","P2 commission clawed back within 60 days"],
              ["Client cancels after P2, before P4","Programs A–C","No clawback — P4 doesn't apply"],
              ["Client completes through Payment 4","Programs D–I","Both payouts fully earned — no clawback"],
              ["NSF on any payment","Any","Payment not counted as cleared"],
            ]}
          />
        </PolicySection>

        <PolicySection heading="Daily Hustle Bonus — CS Deals Only">
          Close 3 or more Consumer Shield Debt Validation deals in a single calendar day and every deal closed that day earns a bonus on top of base commission. This resets at midnight every day.
          <PolicyTable
            headers={["CS Deals Closed in One Day","Bonus Per Deal","Example (5 deals avg $275 each)"]}
            rows={[
              ["3 deals","+$50 per deal",fmt(275*3+50*3)+" total for the day"],
              ["5+ deals","+$75 per deal",fmt(275*5+75*5)+" total for the day"],
            ]}
          />
          The daily SPIFF is paid on the same schedule as the deal commission — triggered when Payment 2 of each deal clears. If a deal does not reach Payment 2, no SPIFF is paid on that deal.
        </PolicySection>

        <PolicySection heading="Monthly Volume Bonus — CS Deals Only">
          Earn a monthly lump-sum bonus based on how many CS Debt Validation deals you enroll with Payment 2 cleared within the calendar month. Paid on the <strong>20th of the following month</strong>.
          <PolicyTable
            headers={["CS Deals with P2 Cleared","Monthly Bonus"]}
            rows={[
              ["8 – 11 deals",fmt(300)],
              ["12 – 16 deals",fmt(600)],
              ["17 – 22 deals",fmt(1000)],
              ["23 – 29 deals",fmt(1500)],
              ["30+ deals",fmt(2250)],
            ]}
          />
        </PolicySection>

        <PolicySection heading="Balanced Book Bonus">
          Funding Tier incentivizes agents who enroll clients in <strong>both</strong> Level Debt and Consumer Shield. If your monthly closed deals include a healthy mix of both products, you earn an additional monthly bonus.
          <PolicyTable
            headers={["Mix","Bonus","Description"]}
            rows={[
              ["30%+ balance (one product is at least 30%)","$100","Starter mix — beginning to diversify"],
              ["50%+ balance (closer to even split)","$250","Mixed book — good balance"],
              ["70%+ balance (35/65 or better)","$500","Balanced book — maximum incentive"],
            ]}
          />
          This bonus is paid monthly and requires a minimum of 5 total deals (combined LD + CS) to qualify.
        </PolicySection>

        <PolicySection heading="Verification of Payments">
          Funding Tier verifies all client payment activity through backend reporting from Consumer Shield before approving and releasing any commission payout. Payments are not considered cleared until confirmed through the servicing partner's reporting system.
        </PolicySection>

        <PolicySection heading="Commission Modifications">
          Funding Tier reserves the right to modify CS commission rates, program tiers, SPIFF structures, and bonus amounts at its sole discretion at any time. Material changes will be communicated. Continued participation constitutes acceptance of updated terms.
        </PolicySection>
      </Accordion>
    </div>
  );
}

// ─── SPIFF TAB ──────────────────────────────────────────
function SpiffTab(){
  const [dealsToday,setDealsToday]=useState(3);
  const [csMonthly,setCsMonthly]=useState(12);
  const spiff=getDailySpiff(dealsToday);
  const spiffTotal=spiff*dealsToday;
  const monthlyBonus=getMonthlyBonus(csMonthly);
  const next=getNextBonus(csMonthly);
  const tiers=[{min:8,label:"8–11",bonus:300},{min:12,label:"12–16",bonus:600},
    {min:17,label:"17–22",bonus:1000},{min:23,label:"23–29",bonus:1500},{min:30,label:"30+",bonus:2250}];

  return(
    <div style={{display:"grid",gap:16}}>
      <Card>
        <SectionHead color={AMBER}>Daily Hustle Bonus — CS Deals</SectionHead>
        <div style={{fontSize:14,color:"#475569",marginBottom:18,lineHeight:1.7,fontWeight:500}}>
          Close 3 or more Consumer Shield Debt Validation deals in a single calendar day and every deal that day earns a bonus on top of base commission. Resets at midnight every day.
        </div>
        <div style={{marginBottom:18}}>
          <Lbl>CS Deals Closed Today</Lbl>
          <input type="range" min={0} max={10} step={1} value={dealsToday}
            onChange={e=>setDealsToday(Number(e.target.value))}
            style={{width:"100%",accentColor:AMBER}}/>
          <div style={{textAlign:"center",fontWeight:900,color:AMBER,fontSize:17,marginTop:5}}>
            {dealsToday} deal{dealsToday!==1?"s":""}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          <MetricCard title="Bonus Per Deal Today"
            value={spiff>0?`+${fmt(spiff)}/deal`:"—"}
            sub={dealsToday<3?`${3-dealsToday} more deal${3-dealsToday>1?"s":""} to unlock +$50/deal`:
                 dealsToday<5?`${5-dealsToday} more to jump to +$75/deal`:"Max daily tier — well done!"}
            accent={spiff>0?AMBER:"#e2e8f0"}/>
          <MetricCard title="Total Daily SPIFF" value={spiffTotal>0?fmt(spiffTotal):"—"}
            sub="Added on top of your base commissions" accent={AMBER} large/>
          <div style={{...card,background:AMBER+"0f",border:`1px solid ${AMBER}33`}}>
            <div style={{fontSize:12,fontWeight:800,color:"#92400e",textTransform:"uppercase",letterSpacing:0.5,marginBottom:10}}>Thresholds</div>
            <div style={{fontSize:14,lineHeight:2.2,color:"#374151",fontWeight:600}}>
              <div style={{display:"flex",justifyContent:"space-between"}}><span>3+ deals</span><strong style={{color:AMBER}}>+$50 / deal</strong></div>
              <div style={{display:"flex",justifyContent:"space-between"}}><span>5+ deals</span><strong style={{color:AMBER}}>+$75 / deal</strong></div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionHead color={G}>Monthly Volume Bonus — CS Deals</SectionHead>
        <div style={{fontSize:14,color:"#475569",marginBottom:18,lineHeight:1.7,fontWeight:500}}>
          Paid on the 20th of the following month. Requires Payment 2 cleared on qualifying CS Debt Validation deals within the calendar month.
        </div>
        <div style={{marginBottom:18}}>
          <Lbl>CS Deals This Month (P2 Cleared)</Lbl>
          <input type="range" min={0} max={40} step={1} value={csMonthly}
            onChange={e=>setCsMonthly(Number(e.target.value))}
            style={{width:"100%",accentColor:G}}/>
          <div style={{textAlign:"center",fontWeight:900,color:G,fontSize:17,marginTop:5}}>
            {csMonthly} deal{csMonthly!==1?"s":""}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
          <MetricCard title="Monthly Volume Bonus"
            value={monthlyBonus>0?fmt(monthlyBonus):"—"}
            sub={next?`${next.t-csMonthly} more deal${next.t-csMonthly!==1?"s":""} to unlock ${fmt(next.b)}`:"Maximum tier — great work!"}
            accent={monthlyBonus>0?G:"#e2e8f0"} large/>
          <div style={{...card,background:G+"0a",border:`1px solid ${G}33`}}>
            <div style={{fontSize:12,fontWeight:800,color:GD,textTransform:"uppercase",letterSpacing:0.5,marginBottom:12}}>All Bonus Tiers</div>
            {tiers.map(t=>{
              const isActive=getMonthlyBonus(csMonthly)===t.bonus;
              return(
                <div key={t.min} style={{display:"flex",justifyContent:"space-between",padding:"4px 0"}}>
                  <span style={{fontSize:13,color:isActive?DARK:"#94a3b8",fontWeight:isActive?800:600}}>{t.label} deals</span>
                  <span style={{fontSize:14,fontWeight:isActive?900:600,color:isActive?G:"#94a3b8"}}>{fmt(t.bonus)}</span>
                </div>
              );
            })}
          </div>
        </div>
        {tiers.map(t=>{
          const isActive=getMonthlyBonus(csMonthly)===t.bonus;
          return(
            <div key={t.min} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{fontSize:13,fontWeight:800,color:isActive?GD:"#94a3b8"}}>{t.label} deals</span>
                <span style={{fontSize:14,fontWeight:800,color:isActive?G:"#94a3b8"}}>{fmt(t.bonus)}</span>
              </div>
              <ProgressBar value={csMonthly} max={t.label.includes("+")?t.min+10:t.min+4}
                color={isActive?G:csMonthly>=t.min?GD:"#e2e8f0"}/>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// ─── FORECAST TAB ───────────────────────────────────────
function ForecastTab(){
  const [ldTier,setLdTier]=useState(1);
  const [ldDeals,setLdDeals]=useState(8);
  const [ldAvgDebt,setLdAvgDebt]=useState(18000);
  const [csCounts,setCsCounts]=useState({A:0,B:0,C:2,D:2,E:2,F:2,G:1,H:1,I:0});

  const tier=LD_TIERS.find(t=>t.id===ldTier);
  const ldComm=Math.round(ldDeals*ldAvgDebt*tier.rate);
  const csBreakdown=CS_PROGS.map(p=>{
    const count=csCounts[p.key]||0;
    return{...p,count,comm:count*p.total};
  });
  const csDeals=csBreakdown.reduce((s,p)=>s+p.count,0);
  const csComm=csBreakdown.reduce((s,p)=>s+p.comm,0);
  const monthBonus=getMonthlyBonus(csDeals);
  const balData=getBalanceBonus(ldDeals,csDeals);
  const total=ldComm+csComm+monthBonus+balData.bonus;
  const totalDeals=ldDeals+csDeals;
  const next=getNextBonus(csDeals);

  const breakdown=[
    {label:"Level Debt commissions",value:ldComm,color:G},
    {label:"CS Debt Validation commissions",value:csComm,color:BLUE},
    {label:"CS monthly volume bonus",value:monthBonus,color:AMBER},
    {label:"Balanced book bonus",value:balData.bonus,color:PURPLE},
  ].filter(b=>b.value>0);
  const maxBar=Math.max(...breakdown.map(b=>b.value),1);

  return(
    <div style={{display:"grid",gap:16}}>
      {/* Big total */}
      <div style={{background:`linear-gradient(135deg,${DARK} 0%,#0b3b50 50%,#0f766e 100%)`,
        borderRadius:18,padding:"24px 28px"}}>
        <div style={{fontSize:12,fontWeight:800,color:"rgba(255,255,255,0.5)",
          textTransform:"uppercase",letterSpacing:1.5,marginBottom:6}}>Projected Monthly Earnings</div>
        <div style={{fontSize:52,fontWeight:900,color:"#fff",letterSpacing:"-2px",lineHeight:1}}>{fmt(total)}</div>
        <div style={{fontSize:14,color:"rgba(255,255,255,0.55)",marginTop:10,fontWeight:600}}>
          {totalDeals} total deals · {totalDeals>0?fmt(Math.round(total/totalDeals)):"$0"} avg per deal
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        {/* LD */}
        <Card>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,
            paddingBottom:10,borderBottom:`2px solid ${G}`}}>
            <img src={LD_LOGO} alt="" style={{height:26,objectFit:"contain"}}/>
            <span style={{fontWeight:900,fontSize:15,color:DARK}}>Level Debt</span>
          </div>
          <div style={{marginBottom:14}}>
            <Lbl>Commission Tier</Lbl>
            <div style={{display:"flex",gap:6}}>
              {LD_TIERS.map(t=>(
                <button key={t.id} onClick={()=>setLdTier(t.id)} style={{
                  flex:1,padding:"9px 4px",borderRadius:8,
                  border:ldTier===t.id?`2px solid ${G}`:`1px solid ${BORDER}`,
                  background:ldTier===t.id?G+"15":"#fff",cursor:"pointer",
                  fontWeight:900,fontSize:13,color:ldTier===t.id?GD:"#94a3b8",
                }}>{t.rateLabel}</button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:14}}>
            <Lbl>LD Deals This Month</Lbl>
            <input type="range" min={0} max={40} value={ldDeals}
              onChange={e=>setLdDeals(Number(e.target.value))} style={{width:"100%",accentColor:G}}/>
            <div style={{textAlign:"center",fontWeight:800,color:G,fontSize:15,marginTop:4}}>{ldDeals} deals</div>
          </div>
          <div style={{marginBottom:14}}>
            <Lbl>Avg Enrolled Debt</Lbl>
            <input type="range" min={7000} max={100000} step={500} value={ldAvgDebt}
              onChange={e=>setLdAvgDebt(Number(e.target.value))} style={{width:"100%",accentColor:G}}/>
            <div style={{textAlign:"center",fontWeight:800,color:G,fontSize:15,marginTop:4}}>{fmt(ldAvgDebt)}</div>
          </div>
          <div style={{background:G+"0f",borderRadius:10,padding:"11px 14px",
            display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:14,fontWeight:700,color:"#374151"}}>LD Commission Total</span>
            <span style={{fontSize:20,fontWeight:900,color:GD}}>{fmt(ldComm)}</span>
          </div>
        </Card>

        {/* CS per-tier */}
        <Card>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,
            paddingBottom:10,borderBottom:`2px solid ${BLUE}`}}>
            <img src={CS_LOGO} alt="" style={{height:26,objectFit:"contain"}}/>
            <span style={{fontWeight:900,fontSize:15,color:DARK}}>Consumer Shield — Debt Validation</span>
          </div>
          <div style={{fontSize:13,color:"#64748b",marginBottom:12,fontWeight:600}}>Deals per program tier this month:</div>
          <div style={{display:"grid",gap:6}}>
            {CS_PROGS.map(p=>{
              const count=csCounts[p.key]||0;
              return(
                <div key={p.key} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                  gap:8,padding:"7px 10px",borderRadius:9,
                  background:count>0?BLUE+"0a":"#f8fafc",border:`1px solid ${count>0?BLUE+"33":BORDER}`}}>
                  <div style={{flex:1}}>
                    <span style={{fontSize:13,fontWeight:800,color:count>0?BLUE:"#94a3b8"}}>{p.label}</span>
                    <span style={{fontSize:12,color:"#94a3b8",marginLeft:6,fontWeight:500}}>{p.range}</span>
                  </div>
                  <span style={{fontSize:13,fontWeight:800,color:count>0?GD:"#94a3b8",marginRight:8}}>
                    {count>0?fmt(count*p.total):fmt(p.total)+"/ea"}
                  </span>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <button onClick={()=>setCsCounts(prev=>({...prev,[p.key]:Math.max(0,(prev[p.key]||0)-1)}))}
                      style={{width:26,height:26,borderRadius:6,border:`1px solid ${BORDER}`,
                        background:"#fff",cursor:"pointer",fontWeight:900,fontSize:14,color:DARK}}>−</button>
                    <span style={{width:26,textAlign:"center",fontWeight:900,fontSize:15,
                      color:count>0?BLUE:"#94a3b8"}}>{count}</span>
                    <button onClick={()=>setCsCounts(prev=>({...prev,[p.key]:(prev[p.key]||0)+1}))}
                      style={{width:26,height:26,borderRadius:6,border:`1px solid ${BORDER}`,
                        background:"#fff",cursor:"pointer",fontWeight:900,fontSize:14,color:DARK}}>+</button>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{marginTop:12,background:BLUE+"0f",borderRadius:10,padding:"11px 14px",
            display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:14,fontWeight:700,color:"#374151"}}>{csDeals} CS deals · base commissions</span>
            <span style={{fontSize:20,fontWeight:900,color:BLUE}}>{fmt(csComm)}</span>
          </div>
        </Card>
      </div>

      {/* Breakdown */}
      <Card>
        <div style={{fontWeight:800,fontSize:16,color:DARK,marginBottom:16}}>Earnings Breakdown</div>
        <div style={{display:"grid",gap:14,marginBottom:16}}>
          {breakdown.map((b,i)=>(
            <div key={i}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontSize:14,fontWeight:700,color:"#374151"}}>{b.label}</span>
                <span style={{fontSize:15,fontWeight:900,color:b.color}}>{fmt(b.value)}</span>
              </div>
              <ProgressBar value={b.value} max={maxBar} color={b.color}/>
            </div>
          ))}
        </div>

        {csDeals>0&&(
          <div style={{background:AMBER+"11",border:`1px solid ${AMBER}33`,borderRadius:10,
            padding:"10px 14px",marginBottom:12,fontSize:14,color:"#92400e",fontWeight:600}}>
            {monthBonus>0
              ?`✓ ${fmt(monthBonus)} monthly volume bonus unlocked (${csDeals} CS deals)`
              :next?`Close ${next.t-csDeals} more CS deal${next.t-csDeals!==1?"s":""} to unlock the ${fmt(next.b)} monthly bonus`:null}
          </div>
        )}

        {/* Balance meter */}
        <div style={{background:"#6d28d911",border:"1px solid #8b5cf633",borderRadius:12,padding:"16px 18px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div>
              <div style={{fontWeight:900,fontSize:15,color:"#4c1d95"}}>Balanced Book Bonus</div>
              <div style={{fontSize:13,color:"#64748b",marginTop:3,fontWeight:600}}>{balData.label}</div>
            </div>
            <div style={{fontSize:24,fontWeight:900,color:PURPLE}}>{balData.bonus>0?fmt(balData.bonus):"—"}</div>
          </div>
          <div style={{height:10,background:"#ede9fe",borderRadius:99,overflow:"hidden",marginBottom:6}}>
            <div style={{height:"100%",borderRadius:99,
              width:`${Math.min(100,balData.pct*100)}%`,background:PURPLE,transition:"width 0.4s"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#94a3b8",
            marginTop:4,fontWeight:600}}>
            <span>All one product</span>
            <span>35/65 mix → +$250</span>
            <span>50/50 → +$500</span>
          </div>
          <div style={{fontSize:13,color:"#7c3aed",marginTop:10,lineHeight:1.7,fontWeight:600}}>
            Enroll in <strong>both</strong> Level Debt and Consumer Shield to earn this bonus. A healthy mix earns you up to <strong>$500/month</strong> on top of everything else.
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── ROOT ───────────────────────────────────────────────
export default function App(){
  const [tab,setTab]=useState("ld");

  const tabs=[
    {id:"ld",      label:"Level Debt",        tip:"Debt Settlement Deals $7k+"},
    {id:"cs",      label:"CS Debt Validation", tip:"Debt Validation Deals $4k+"},
    {id:"spiff",   label:"SPIFFs & Bonuses"},
    {id:"forecast",label:"Monthly Forecast"},
  ];

  return(
    <div style={{minHeight:"100vh",background:BG,fontFamily:'"DM Sans","Helvetica Neue",Arial,sans-serif'}}>

      {/* STICKY HEADER WITH TABS BUILT IN */}
      <div style={{position:"sticky",top:0,zIndex:50,
        background:`linear-gradient(135deg,${DARK} 0%,#0b3b50 45%,#0f766e 100%)`,
        boxShadow:"0 4px 24px rgba(15,23,42,0.22)"}}>
        <div style={{maxWidth:980,margin:"0 auto",padding:"12px 20px 0"}}>

          {/* Logo + title row */}
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
            <img src={FT_LOGO} alt="Funding Tier" style={{height:28,width:"auto"}}/>
            <div>
              <div style={{fontSize:18,fontWeight:900,color:"#fff",letterSpacing:"-0.5px",lineHeight:1}}>
                Commission Simulator
              </div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",marginTop:2,fontWeight:600,letterSpacing:"0.3px"}}>
                Agent Earnings Calculator
              </div>
            </div>
          </div>

          {/* Tab bar inside header */}
          <div style={{display:"flex",gap:2}}>
            {tabs.map(t=>{
              const isActive=tab===t.id;
              const btn=(
                <button
                  key={t.id}
                  onClick={()=>setTab(t.id)}
                  style={{
                    flex:1,
                    padding:"10px 8px",
                    border:"none",
                    cursor:"pointer",
                    fontWeight:800,
                    fontSize:13,
                    letterSpacing:"-0.2px",
                    borderRadius:"10px 10px 0 0",
                    transition:"all 0.15s",
                    background:isActive?"#fff":"transparent",
                    color:isActive?DARK:"rgba(255,255,255,0.6)",
                    boxShadow:isActive?"0 -2px 0 0 "+G+" inset":undefined,
                    borderBottom:isActive?`3px solid ${G}`:"3px solid transparent",
                    position:"relative",
                  }}
                >
                  {isActive&&(
                    <span style={{
                      position:"absolute",bottom:0,left:0,right:0,height:3,
                      background:G,borderRadius:"3px 3px 0 0",
                    }}/>
                  )}
                  {t.label}
                </button>
              );
              return t.tip
                ? <Tip key={t.id} tip={t.tip}>{btn}</Tip>
                : <div key={t.id} style={{flex:1}}>{btn}</div>;
            })}
          </div>
        </div>
      </div>

      <div style={{maxWidth:980,margin:"0 auto",padding:"20px 20px 60px"}}>
        {tab==="ld"       &&<LevelDebtTab/>}
        {tab==="cs"       &&<CSTab/>}
        {tab==="spiff"    &&<SpiffTab/>}
        {tab==="forecast" &&<ForecastTab/>}
      </div>
    </div>
  );
}
