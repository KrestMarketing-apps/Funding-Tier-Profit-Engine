import { useState } from "react";

// ─── BRAND ──────────────────────────────────────────────
const G      = "#0f9d8a";
const GD     = "#0b7d6e";
const DARK   = "#0f172a";
const BLUE   = "#1a6ed8";
const AMBER  = "#f59e0b";
const RED    = "#ef4444";
const PURPLE = "#7c3aed";
const LC     = "#0891b2";   // Legacy Capital Services — cyan-teal
const LCD    = "#0e7490";
const BG     = "#f8fafc";
const BORDER = "#e2e8f0";

const FT_LOGO = "https://assets.cdn.filesafe.space/S4ztIlDxBovAboldwbOR/media/68783cf82035bab4d790ae7e.png";
const LD_LOGO = "https://assets.cdn.filesafe.space/S4ztIlDxBovAboldwbOR/media/69c35b2cab2203b0fc83186d.webp";
const CS_LOGO = "https://assets.cdn.filesafe.space/S4ztIlDxBovAboldwbOR/media/69c35b2c25c6995d2d2d21fa.png";
// Replace with your hosted CDN URL once available
const LC_LOGO = "https://raw.githubusercontent.com/KrestMarketing-apps/Funding-Tier-AI-Router-/d349d3eb7a633a4638a7f595a783e1da09bf4e7c/src/assets/logos/legacy-logo.png";

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

const LC_BANDS = [
  { code:"L1", label:"Band L1", range:"$6,000 – $9,999",    minDebt:6000,  maxDebt:9999,       total:150, p2:150, p4:0   },
  { code:"L2", label:"Band L2", range:"$10,000 – $14,999",  minDebt:10000, maxDebt:14999,      total:225, p2:175, p4:50  },
  { code:"L3", label:"Band L3", range:"$15,000 – $19,999",  minDebt:15000, maxDebt:19999,      total:275, p2:200, p4:75  },
  { code:"L4", label:"Band L4", range:"$20,000 – $24,999",  minDebt:20000, maxDebt:24999,      total:350, p2:250, p4:100 },
  { code:"L5", label:"Band L5", range:"$25,000 – $29,999",  minDebt:25000, maxDebt:29999,      total:400, p2:300, p4:100 },
  { code:"L6", label:"Band L6", range:"$30,000 – $49,999",  minDebt:30000, maxDebt:49999,      total:500, p2:375, p4:125 },
  { code:"L7", label:"Band L7", range:"$50,000+",           minDebt:50000, maxDebt:Infinity,   total:600, p2:450, p4:150 },
];

const LC_BLOCKED = ["ID","ND","GA"];

// ─── HELPERS ─────────────────────────────────────────────
function getCSProg(debt){ return CS_PROGS.find(p=>{
  const mins={A:4000,B:5000,C:8800,D:10000,E:15000,F:20000,G:25000,H:30000,I:50000};
  const maxs={A:4999,B:8799,C:9999,D:14999,E:19999,F:24999,G:29999,H:49999,I:Infinity};
  return debt>=mins[p.key]&&debt<=maxs[p.key];
})??null; }

function getLCBand(debt){
  return LC_BANDS.find(b=>debt>=b.minDebt&&debt<=b.maxDebt)??null;
}

function getDailySpiff(n){ return n>=5?75:n>=3?50:0; }
function getMonthlyBonus(n){
  if(n>=30)return 2250; if(n>=23)return 1500; if(n>=17)return 1000;
  if(n>=12)return 600;  if(n>=8)return 300;   return 0;
}
function getNextBonus(n){
  const t=[{t:8,b:300},{t:12,b:600},{t:17,b:1000},{t:23,b:1500},{t:30,b:2250}];
  return t.find(x=>n<x.t)??null;
}

// Balanced book bonus protects SHORT-TERM REVENUE RECOGNITION.
// LD (settlement) pays after 2 payments — fastest cash recognition.
// CS + LCS (validation/legal) pay slower over more milestones.
// The bonus requires LD to hold a minimum FLOOR of the agent's total book.
// An agent doing mostly CS+LCS earns nothing — LD must stay above the threshold.
// Thresholds measure LD% of total deals (LD + CS + LCS).
function getBalanceBonus(ld, cs, lc=0){
  const total = ld + cs + lc;
  if(total < 5) return { bonus:0, label:"Need at least 5 total deals to qualify", ldPct:0 };
  const ldPct = ld / total;
  if(ldPct >= 0.45) return { bonus:500, label:"Max revenue protection — 45%+ of your book is Level Debt settlement", ldPct };
  if(ldPct >= 0.35) return { bonus:250, label:"Solid settlement base — 35%+ of your book is Level Debt", ldPct };
  if(ldPct >= 0.25) return { bonus:100, label:"Starter floor — 25%+ of your book is Level Debt", ldPct };
  return { bonus:0, label:"Level Debt is below 25% of your total book — close more settlement deals to qualify", ldPct };
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
      {logo&&<img src={logo} alt="" style={{height:30,width:"auto",objectFit:"contain"}} onError={e=>{e.target.style.display="none"}}/>}
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

function Accordion({title,color=G,children}){
  const [open,setOpen]=useState(false);
  return(
    <div style={{border:`1px solid ${BORDER}`,borderRadius:14,overflow:"hidden",background:"#fff",marginBottom:8}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",display:"flex",justifyContent:"space-between",
        alignItems:"center",padding:"16px 20px",border:"none",background:"#fff",cursor:"pointer",textAlign:"left"}}>
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
      <div style={{fontWeight:800,fontSize:15,color:DARK,marginBottom:8,paddingBottom:6,borderBottom:`1px solid ${BORDER}`}}>{heading}</div>
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

function TabBar({tabs,active,onSelect}){
  return(
    <div style={{display:"grid",gridTemplateColumns:`repeat(${tabs.length},1fr)`,gap:3,background:"#f1f5f9",borderRadius:12,padding:4,marginBottom:20}}>
      {tabs.map(t=>(
        t.tip
          ? <Tip key={t.id} tip={t.tip}>
              <button onClick={()=>onSelect(t.id)} style={{
                width:"100%",padding:"10px 6px",borderRadius:9,border:"none",fontWeight:800,fontSize:12,cursor:"pointer",
                background:active===t.id?DARK:"transparent",
                color:active===t.id?"#fff":"#64748b",transition:"all 0.15s",whiteSpace:"nowrap",
              }}>{t.label}</button>
            </Tip>
          : <button key={t.id} onClick={()=>onSelect(t.id)} style={{
              padding:"10px 6px",borderRadius:9,border:"none",fontWeight:800,fontSize:12,cursor:"pointer",
              background:active===t.id?DARK:"transparent",
              color:active===t.id?"#fff":"#64748b",transition:"all 0.15s",
            }}>{t.label}</button>
      ))}
    </div>
  );
}

// Shared payout timeline used by CS and LCS tabs
function PayoutTimeline({band,color}){
  const steps=[
    {label:"Deal Enrolled",month:"Month 1",amt:null},
    {label:"Payment 2 Clears",month:"Month 2",amt:fmt(band.p2)},
    ...(band.p4>0?[{label:"Payment 4 Clears",month:"Month 4",amt:fmt(band.p4)}]:[]),
  ];
  return(
    <div style={{background:"#f8fafc",borderRadius:12,padding:"16px 18px"}}>
      <div style={{fontSize:12,fontWeight:800,color:"#64748b",textTransform:"uppercase",letterSpacing:0.5,marginBottom:14}}>Your Payout Timeline</div>
      <div style={{display:"flex",alignItems:"flex-start"}}>
        {steps.map((step,i,arr)=>(
          <div key={i} style={{display:"flex",alignItems:"center",flex:i<arr.length-1?1:0}}>
            <div style={{textAlign:"center",minWidth:110}}>
              <div style={{width:40,height:40,borderRadius:"50%",margin:"0 auto 7px",
                background:step.amt?color:"#e2e8f0",display:"flex",alignItems:"center",
                justifyContent:"center",fontSize:14,fontWeight:900,color:step.amt?"#fff":"#94a3b8"}}>{i+1}</div>
              <div style={{fontSize:12,fontWeight:800,color:step.amt?DARK:"#94a3b8"}}>{step.label}</div>
              <div style={{fontSize:11,color:"#94a3b8",marginTop:2,fontWeight:600}}>{step.month}</div>
              {step.amt&&<div style={{fontSize:16,fontWeight:900,color,marginTop:5}}>{step.amt}</div>}
            </div>
            {i<arr.length-1&&<div style={{flex:1,height:2,background:"#e2e8f0",margin:"0 4px",marginBottom:26}}/>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── LEVEL DEBT TAB ─────────────────────────────────────
function fmtRaw(n){ return n>0?n.toLocaleString("en-US"):""; }

function CurrencyField({value,onChange,label,sublabel,color,min=0}){
  const [focused,setFocused]=useState(false);
  const [raw,setRaw]=useState("");
  const onFocus=()=>{setFocused(true);setRaw(value>0?String(value):"");};
  const onBlur=()=>{setFocused(false);const n=Number(raw.replace(/[^0-9]/g,""));onChange(Math.max(min,n||0));};
  const onChg=e=>{const r=e.target.value.replace(/[^0-9]/g,"");setRaw(r);onChange(Number(r)||0);};
  return(
    <div>
      {label&&<Lbl>{label}</Lbl>}
      {sublabel&&<div style={{fontSize:12,color:"#64748b",marginBottom:8,fontWeight:600,lineHeight:1.5}}>{sublabel}</div>}
      <div style={{position:"relative"}}>
        <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",
          fontSize:18,fontWeight:900,color:color||"#94a3b8",pointerEvents:"none",zIndex:1}}>$</span>
        <input type="text" inputMode="numeric"
          value={focused?raw:fmtRaw(value)}
          onFocus={onFocus} onBlur={onBlur} onChange={onChg}
          placeholder="0"
          style={{width:"100%",padding:"13px 14px 13px 28px",borderRadius:10,
            border:`2px solid ${color||BORDER}`,fontSize:19,fontWeight:900,
            color:DARK,background:"#fff",boxSizing:"border-box",outline:"none"}}/>
      </div>
    </div>
  );
}

function getTierForVol(vol){
  if(vol>=2000000) return LD_TIERS[2];
  if(vol>=1000000) return LD_TIERS[1];
  return LD_TIERS[0];
}

function LevelDebtTab(){
  const [monthVol,setMonthVol]=useState(850000);
  const [newDeal,setNewDeal]=useState(20000);

  const totalVol=monthVol+newDeal;
  const tierBefore=getTierForVol(monthVol);
  const tierAfter=getTierForVol(totalVol);
  const crossed=tierAfter.id>tierBefore.id;
  const validDeal=newDeal>=7000;

  const commTotal=Math.round(totalVol*tierAfter.rate);
  const commBefore=Math.round(monthVol*tierBefore.rate);
  const dealComm=Math.round(newDeal*tierAfter.rate);
  const netGain=commTotal-commBefore;
  const tierBonus=crossed?Math.round(monthVol*(tierAfter.rate-tierBefore.rate)):0;

  const nextThresh=[1000000,2000000,Infinity][tierAfter.id-1];
  const nextTierObj=tierAfter.id<3?LD_TIERS[tierAfter.id]:null;
  const gapToNext=nextTierObj?nextThresh-totalVol:0;
  const progress=nextTierObj?Math.min(100,(totalVol/nextThresh)*100):100;
  const tierColors=[G,BLUE,PURPLE];
  const tc=tierColors[tierAfter.id-1];

  return(
    <div style={{display:"grid",gap:16}}>
      <Card>
        <SectionHead logo={LD_LOGO} color={G}>Level Debt — Monthly Commission Simulator</SectionHead>

        {/* Eligibility routing note */}
        <div style={{background:DARK+"0a",border:`1px solid ${DARK}22`,borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#374151",lineHeight:1.7}}>
          <strong>Deal routing guide:</strong> Level Debt requires <strong>$7,000 minimum</strong>.
          Deals <strong>$6,000–$6,999</strong> → evaluate for <strong style={{color:LCD}}>Legacy Capital Services</strong> or <strong style={{color:BLUE}}>Consumer Shield</strong>.
          Deals <strong>$4,000–$5,999</strong> → <strong style={{color:BLUE}}>Consumer Shield only</strong>.
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
          <CurrencyField value={monthVol} onChange={setMonthVol}
            label="Enrolled Debt Already This Month"
            sublabel="Total debt already enrolled with Level Debt this month — before this new deal"
            color={G}/>
          <CurrencyField value={newDeal} onChange={setNewDeal} min={0}
            label="New Deal — Enrolled Debt"
            sublabel="The enrolled debt on the new deal. Level Debt requires $7,000 minimum."
            color={validDeal?BLUE:newDeal>0?RED:BORDER}/>
        </div>
        {newDeal>0&&!validDeal&&(
          <div style={{background:"#fef2f2",borderRadius:10,padding:"10px 14px",color:RED,fontWeight:700,fontSize:13,marginBottom:16}}>
            ⚠ Level Debt requires a minimum of $7,000 enrolled debt per deal.
            {newDeal>=6000&&<span style={{color:LCD}}> Consider Legacy Capital Services (min $6,000) or Consumer Shield (min $4,000).</span>}
          </div>
        )}

        <div style={{marginBottom:20}}>
          <Lbl>Your Commission Tier</Lbl>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:12,alignItems:"center"}}>
            <div style={{borderRadius:14,padding:"14px 16px",textAlign:"center",
              background:tierColors[tierBefore.id-1]+"14",border:`1px solid ${tierColors[tierBefore.id-1]}44`}}>
              <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:0.5,marginBottom:5}}>Before This Deal</div>
              <div style={{fontSize:28,fontWeight:900,color:tierColors[tierBefore.id-1]}}>{tierBefore.rateLabel}</div>
              <div style={{fontSize:13,fontWeight:800,color:"#64748b",marginTop:4}}>{tierBefore.label}</div>
              <div style={{fontSize:12,color:"#94a3b8",marginTop:3}}>{fmtRaw(monthVol)||"0"} enrolled</div>
            </div>
            <div style={{textAlign:"center"}}>
              {crossed?(
                <div style={{background:AMBER,borderRadius:99,padding:"8px 14px",fontSize:12,fontWeight:900,color:"#fff",whiteSpace:"nowrap",boxShadow:"0 4px 12px rgba(245,158,11,0.4)"}}>🎉 TIER UP!</div>
              ):(
                <div style={{fontSize:24,color:"#94a3b8",fontWeight:300}}>→</div>
              )}
            </div>
            <div style={{borderRadius:14,padding:"14px 16px",textAlign:"center",
              background:tc+"18",border:`2px solid ${tc}`,boxShadow:crossed?`0 0 0 4px ${AMBER}33`:undefined}}>
              <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:0.5,marginBottom:5}}>After This Deal</div>
              <div style={{fontSize:28,fontWeight:900,color:tc}}>{tierAfter.rateLabel}</div>
              <div style={{fontSize:13,fontWeight:800,color:"#64748b",marginTop:4}}>{tierAfter.label}</div>
              <div style={{fontSize:12,color:"#94a3b8",marginTop:3}}>${fmtRaw(totalVol)} total</div>
              {crossed&&<div style={{fontSize:11,fontWeight:800,color:AMBER,marginTop:5}}>↑ TIER UPGRADE</div>}
            </div>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
          <MetricCard title="Commission — This Deal" value={validDeal?fmt(dealComm):"—"} sub={validDeal?`${fmt(newDeal)} × ${tierAfter.rateLabel}`:"Deal below $7k minimum"} accent={BLUE} large/>
          <MetricCard title={crossed?"Tier Upgrade Bonus":"Monthly Commission Total"}
            value={crossed?`+${fmt(tierBonus)}`:fmt(commTotal)}
            sub={crossed?`Extra on ${fmt(monthVol)} already enrolled — you hit ${tierAfter.label}!`:`${fmt(totalVol)} total enrolled × ${tierAfter.rateLabel}`}
            accent={crossed?AMBER:G}/>
          <MetricCard title="Total Earned This Month" value={fmt(commTotal)} sub={`Net gain from closing this deal: ${fmt(netGain)}`} accent={GD}/>
        </div>

        {crossed&&(
          <div style={{background:`linear-gradient(135deg,${AMBER}18,${G}18)`,border:`1px solid ${AMBER}55`,borderRadius:12,padding:"14px 18px",marginBottom:12}}>
            <div style={{fontWeight:900,fontSize:15,color:"#92400e",marginBottom:6}}>🎉 This deal pushed you into {tierAfter.label} ({tierAfter.rateLabel})</div>
            <div style={{fontSize:14,color:"#374151",lineHeight:1.85,fontWeight:500}}>
              Your entire month's volume is now paid at <strong>{tierAfter.rateLabel}</strong> instead of <strong>{tierBefore.rateLabel}</strong>.
              That's an extra <strong style={{color:GD}}>{fmt(tierBonus)}</strong> on your existing {fmt(monthVol)} already enrolled — plus <strong style={{color:BLUE}}>{fmt(dealComm)}</strong> on this new deal.
              Total gain from closing this deal: <strong style={{color:GD,fontSize:16}}>{fmt(netGain)}</strong>.
            </div>
          </div>
        )}

        {nextTierObj&&(
          <div style={{background:G+"0a",border:`1px solid ${G}33`,borderRadius:12,padding:"14px 18px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontWeight:800,fontSize:14,color:GD}}>Progress to {nextTierObj.label} — {nextTierObj.rateLabel}</div>
              <div style={{fontSize:13,fontWeight:700,color:"#64748b"}}>{fmt(gapToNext)} more to go</div>
            </div>
            <div style={{height:12,background:"#e2e8f0",borderRadius:99,overflow:"hidden",marginBottom:8}}>
              <div style={{height:"100%",borderRadius:99,background:`linear-gradient(90deg,${G},${GD})`,width:`${progress}%`,transition:"width 0.4s"}}/>
            </div>
            <div style={{fontSize:13,color:"#64748b",fontWeight:600,lineHeight:1.6}}>
              Enroll <strong style={{color:GD}}>{fmt(gapToNext)}</strong> more debt this month to unlock {nextTierObj.rateLabel}.
              On a {fmt(newDeal)} deal that would be worth an extra <strong style={{color:GD}}>{fmt(Math.round(newDeal*(nextTierObj.rate-tierAfter.rate)))}</strong> per deal.
            </div>
          </div>
        )}
      </Card>

      <Card>
        <div style={{fontWeight:800,fontSize:16,color:DARK,marginBottom:6}}>All Tier Scenarios — Based on Your Monthly Total</div>
        <div style={{fontSize:13,color:"#64748b",marginBottom:14,fontWeight:500,lineHeight:1.6}}>
          Your current month total is <strong style={{color:DARK}}>{fmt(totalVol)}</strong>. The table below shows what your monthly commission would be at each tier.
        </div>
        <div style={{overflowX:"auto",borderRadius:12,border:`1px solid ${BORDER}`}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}>
            <thead>
              <tr style={{background:DARK}}>
                {["Tier","Monthly Volume Needed","Rate",`Commission on This Deal (${fmt(newDeal)})`,`Total Monthly Commission (${fmt(totalVol)})`,"Status"].map(h=>(
                  <th key={h} style={{padding:"11px 14px",color:"#fff",fontWeight:700,fontSize:12,textAlign:"left",borderRight:"1px solid rgba(255,255,255,0.15)"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LD_TIERS.map((t,i)=>{
                const isActive=tierAfter.id===t.id;
                const dealC=validDeal?fmt(Math.round(newDeal*t.rate)):"—";
                const totalC=fmt(Math.round(totalVol*t.rate));
                const locked=totalVol<[0,1000000,2000000][t.id-1];
                const tColor=tierColors[t.id-1];
                return(
                  <tr key={t.id} style={{background:isActive?tColor+"14":i%2?"#f8fafc":"#fff",
                    borderLeft:isActive?`4px solid ${tColor}`:"4px solid transparent",opacity:locked?0.5:1}}>
                    <td style={{padding:"12px 14px",fontWeight:900,color:isActive?tColor:DARK,borderRight:`1px solid ${BORDER}`}}>{t.label}</td>
                    <td style={{padding:"12px 14px",color:"#475569",fontWeight:600,borderRight:`1px solid ${BORDER}`}}>{t.range}</td>
                    <td style={{padding:"12px 14px",fontWeight:900,fontSize:20,color:tColor,borderRight:`1px solid ${BORDER}`}}>{t.rateLabel}</td>
                    <td style={{padding:"12px 14px",fontWeight:800,fontSize:15,color:isActive?tColor:"#64748b",borderRight:`1px solid ${BORDER}`}}>
                      {dealC}
                      {isActive&&validDeal&&<span style={{display:"block",fontSize:11,color:tColor,fontWeight:700,marginTop:2}}>← your earn</span>}
                      {!isActive&&!locked&&validDeal&&<span style={{display:"block",fontSize:11,color:G,fontWeight:700,marginTop:2}}>{t.id>tierAfter.id?`+${fmt(Math.round(newDeal*(t.rate-tierAfter.rate)))} more`:`${fmt(Math.round(newDeal*(tierAfter.rate-t.rate)))} less`}</span>}
                    </td>
                    <td style={{padding:"12px 14px",fontWeight:800,fontSize:15,color:isActive?tColor:"#64748b",borderRight:`1px solid ${BORDER}`}}>
                      {totalC}
                      {isActive&&<span style={{display:"block",fontSize:11,color:tColor,fontWeight:700,marginTop:2}}>← your total</span>}
                    </td>
                    <td style={{padding:"12px 14px"}}>
                      {isActive?(
                        <span style={{fontWeight:800,fontSize:12,color:"#fff",background:tColor,padding:"3px 10px",borderRadius:99}}>✓ ACTIVE</span>
                      ):locked?(
                        <span style={{fontWeight:700,fontSize:12,color:"#94a3b8"}}>🔒 {fmt([0,1000000,2000000][t.id-1]-totalVol)} away</span>
                      ):(
                        <span style={{fontWeight:700,fontSize:12,color:"#94a3b8"}}>Below</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Accordion title="Funding Tier Debt Settlement Agent Commissions — Full Policy Explained" color={G}>
        <PolicySection heading="What is Debt Settlement?">
          Level Debt is Funding Tier's debt settlement partner. When you enroll a client into a debt settlement program, the client makes monthly payments into a dedicated account. Level Debt works with their creditors to negotiate and settle their outstanding unsecured debts over time.
        </PolicySection>
        <PolicySection heading="Minimum Enrollment Requirement">
          <AlertBox color={RED} bg="#fef2f2">
            <strong>Level Debt requires a minimum of $7,000 in total enrolled unsecured debt.</strong> Deals below $7,000 must be evaluated for <strong>Legacy Capital Services</strong> (if $6,000+) or <strong>Consumer Shield</strong> (if $4,000+).
          </AlertBox>
        </PolicySection>
        <PolicySection heading="Commission Rate — How It's Calculated">
          Your commission is calculated as a percentage of the client's <strong>Total Cleared Enrolled Debt</strong>.
          <PolicyTable
            headers={["Tier","Your Monthly Enrolled Volume","Commission Rate","Example: $25,000 Deal"]}
            rows={[
              ["Tier 1","$0 – $999,999 / month","1.00%",fmt(250)],
              ["Tier 2","$1,000,000 – $1,999,999 / month","1.15%",fmt(287.50)],
              ["Tier 3","$2,000,000+ / month","1.30%",fmt(325)],
            ]}
          />
        </PolicySection>
        <PolicySection heading="When You Get Paid — Payout Timing">
          <AlertBox color={G} bg="#f0fdf9">
            <strong>Payout date:</strong> After the client successfully completes <strong>2 monthly program payments</strong>, commissions are paid on the <strong>20th of the following month</strong>.
          </AlertBox>
        </PolicySection>
        <PolicySection heading="Chargebacks and Clawbacks">
          <AlertBox color={RED} bg="#fef2f2">
            <strong>Chargeback Rule:</strong> A client must complete a minimum of <strong>3 program payments</strong> to be fully outside the chargeback liability window.
          </AlertBox>
          <PolicyTable
            headers={["Scenario","Chargeback Risk","Your Liability"]}
            rows={[
              ["Client completes 2 payments — then cancels","Yes","Possible clawback"],
              ["Client completes 3+ payments","No","No clawback"],
              ["Client returns NSF on any payment","Yes","Possible clawback"],
              ["Client completes full program","No","Commission fully earned"],
            ]}
          />
        </PolicySection>
        <PolicySection heading="Commission Modifications">
          Funding Tier reserves the right to modify commission structures at its sole discretion at any time. Material changes will be communicated.
        </PolicySection>
      </Accordion>
    </div>
  );
}

// ─── CS TAB ─────────────────────────────────────────────
function CSTab(){
  const [debt,setDebt]=useState(20000);
  const prog=getCSProg(debt);

  return(
    <div style={{display:"grid",gap:16}}>
      <Card>
        <SectionHead logo={CS_LOGO} color={BLUE}>Consumer Shield — Debt Validation</SectionHead>

        {/* Cross-product routing note */}
        <div style={{background:DARK+"0a",border:`1px solid ${DARK}22`,borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#374151",lineHeight:1.7}}>
          <strong>Deal routing guide:</strong> Consumer Shield accepts <strong>$4,000 minimum</strong>.
          For deals <strong>$6,000–$9,999</strong>, <strong style={{color:LCD}}>Legacy Capital Services (Band L1)</strong> is also available as an attorney-model alternative — both pay the same $150. Evaluate client fit and state eligibility (LCS blocked in ID, ND, GA).
          For deals <strong>$7,000+</strong>, <strong style={{color:G}}>Level Debt</strong> is also available.
        </div>

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
              {prog.p4===0&&<span style={{fontSize:11,fontWeight:800,background:G+"22",color:GD,padding:"2px 8px",borderRadius:99}}>Full payout at P2</span>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
              <MetricCard title="Total Commission" value={fmt(prog.total)} sub="Full amount for this deal" accent={BLUE} large/>
              <MetricCard title="Paid at Payment 2" value={fmt(prog.p2)} sub="20th of Month 3" accent={BLUE}/>
              <MetricCard title={prog.p4>0?"Paid at Payment 4":"Second Payout"}
                value={prog.p4>0?fmt(prog.p4):"—"}
                sub={prog.p4>0?"20th of Month 5":"Single payout — no split on this tier"}
                accent={prog.p4>0?BLUE:"#e2e8f0"}/>
            </div>
            <PayoutTimeline band={prog} color={BLUE}/>
          </>
        )}
      </Card>

      <Card>
        <div style={{fontWeight:800,fontSize:16,color:DARK,marginBottom:14}}>Full Commission Schedule — Debt Validation</div>
        <div style={{overflowX:"auto",borderRadius:12,border:`1px solid ${BORDER}`}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}>
            <thead>
              <tr style={{background:DARK}}>
                {["Program","Debt Range","At Payment 2","At Payment 4","Total Commission"].map(h=>(
                  <th key={h} style={{padding:"11px 14px",color:"#fff",fontWeight:700,fontSize:13,textAlign:"left",borderRight:"1px solid rgba(255,255,255,0.15)"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CS_PROGS.map((p,i)=>{
                const isActive=prog?.key===p.key;
                return(
                  <tr key={p.key} style={{background:isActive?BLUE+"10":i%2?"#f8fafc":"#fff",borderLeft:isActive?`3px solid ${BLUE}`:"3px solid transparent"}}>
                    <td style={{padding:"10px 14px",fontWeight:900,fontSize:14,color:isActive?BLUE:DARK,borderRight:`1px solid ${BORDER}`}}>
                      {p.label}
                      {isActive&&<span style={{fontSize:11,background:BLUE+"22",color:BLUE,padding:"1px 7px",borderRadius:99,marginLeft:6,fontWeight:700}}>current</span>}
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
        <div style={{fontSize:13,color:"#64748b",marginTop:10,fontWeight:600}}>* Programs A, B, and C: $150 guaranteed minimum paid in full at Payment 2. No split.</div>
      </Card>

      <Accordion title="Consumer Shield Debt Validation Agent Commissions — Full Policy Explained" color={BLUE}>
        <PolicySection heading="What is Debt Validation?">
          Consumer Shield is Funding Tier's debt validation partner. Debt validation is a legal process where a client's debts are formally challenged and creditors are required to provide proof that the debt is valid. Unlike debt settlement, debt validation focuses on disputing and verifying debt accuracy.
        </PolicySection>
        <PolicySection heading="Minimum Enrollment Requirement">
          <AlertBox color={BLUE} bg="#eff6ff">
            Consumer Shield accepts enrolled debt starting at <strong>$4,000</strong>. Deals between $4,000 and $5,999 can <strong>only</strong> go to Consumer Shield. Deals $6,000–$6,999 can go to Consumer Shield <strong>or Legacy Capital Services</strong>. Deals $7,000+ can go to any product.
          </AlertBox>
        </PolicySection>
        <PolicySection heading="Commission Structure — Flat Rates by Program">
          <PolicyTable
            headers={["Program","Debt Range","Paid at Payment 2","Paid at Payment 4","Your Total"]}
            rows={CS_PROGS.map(p=>[p.label,p.range,fmt(p.p2),p.p4>0?fmt(p.p4):"—",fmt(p.total)])}
          />
        </PolicySection>
        <PolicySection heading="When You Get Paid — Payout Timing">
          <AlertBox color={BLUE} bg="#eff6ff">
            <strong>Payment 2 Payout:</strong> Paid on the <strong>20th of Month 3</strong>.<br/><br/>
            <strong>Payment 4 Payout (Programs D–I only):</strong> Paid on the <strong>20th of Month 5</strong>.
          </AlertBox>
        </PolicySection>
        <PolicySection heading="Chargebacks and Clawbacks">
          <AlertBox color={RED} bg="#fef2f2">
            <strong>Clawback Rule (Programs D–I):</strong> If a client cancels before Payment 4 clears, the Payment 2 commission is subject to clawback within <strong>60 days of cancellation</strong>.<br/><br/>
            <strong>Programs A, B, C:</strong> Not subject to clawback. Single $150 payment triggers at Payment 2 only.
          </AlertBox>
        </PolicySection>
        <PolicySection heading="Daily Hustle Bonus — CS Deals Only">
          Close 3+ Consumer Shield deals in a single calendar day and every deal earns a bonus on top of base commission.
          <PolicyTable
            headers={["CS Deals Closed in One Day","Bonus Per Deal"]}
            rows={[["3 deals","+$50 per deal"],["5+ deals","+$75 per deal"]]}
          />
        </PolicySection>
        <PolicySection heading="Monthly Volume Bonus — CS Deals Only">
          <PolicyTable
            headers={["CS Deals with P2 Cleared","Monthly Bonus"]}
            rows={[["8–11",fmt(300)],["12–16",fmt(600)],["17–22",fmt(1000)],["23–29",fmt(1500)],["30+",fmt(2250)]]}
          />
        </PolicySection>
        <PolicySection heading="Settlement Floor Bonus">
          Agents who maintain a healthy Level Debt settlement base alongside CS and LCS deals earn a <strong>Settlement Floor Bonus</strong>. The bonus is based on how much of your total book is Level Debt — keeping LD strong protects short-term revenue recognition. See the SPIFFs &amp; Bonuses tab for the full calculator.
        </PolicySection>
        <PolicySection heading="Commission Modifications">
          Funding Tier reserves the right to modify CS commission rates at its sole discretion at any time. Material changes will be communicated.
        </PolicySection>
      </Accordion>
    </div>
  );
}

// ─── LEGACY CAPITAL REVENUE MODEL SIMULATOR ────────────
// Deduction rules (applied before tier rate):
//   Monthly  — Payments 1-2: -$4   | Payments 3-48: -$84  | Payments 49+: -$84
//   Split    — Payments 1-2: -$4×2 | Payments 3-48: -$44×2| Payments 49+: -$44×2
//   "Split" = client drafts half the monthly amount twice per month

const LC_REV = {
  minDebt: 6000,
  minMonthlyPayment: 250,
  maxTerm: 60,
  billable:     { tier1: 0.60, tier2: 0.65, volThreshold: 100 },
  accelerated:  { minTerm: 18, firstRate: 0.90, secondRate: 0.25, maxMonths: 24, firstWindow: 7 },

  draftFee:        4,    // every payment (both schedules)
  monthlyBackout:  80,   // payments 3+ monthly only
  splitBackout:    40,   // payments 3+ per installment (occurs twice)

  // Net revenue-eligible amount for a single monthly period
  netMonthly(monthlyPayment, periodIndex, isMonthly) {
    // periodIndex is 1-based (payment number in monthly terms)
    const early = periodIndex <= 2;
    if (isMonthly) {
      return monthlyPayment - this.draftFee - (early ? 0 : this.monthlyBackout);
    } else {
      // split: two installments per month, each backs out $4 + (if late) $40
      const perInstallment = monthlyPayment / 2;
      const installmentNet = perInstallment - this.draftFee - (early ? 0 : this.splitBackout);
      return installmentNet * 2; // two installments = one monthly equivalent
    }
  },

  tierRate(monthlyFiles, model) {
    if (model === 'accelerated') return null; // accelerated has its own rates
    return monthlyFiles >= this.billable.volThreshold
      ? this.billable.tier2
      : this.billable.tier1;
  },

  buildSchedule(totalDebt, termMonths, payoutModel, monthlyFiles, isMonthly) {
    const mp = totalDebt / termMonths;
    const rows = [];
    let cumRev = 0;

    if (payoutModel === 'billable') {
      const rate = this.tierRate(monthlyFiles, 'billable');
      for (let mo = 1; mo <= termMonths; mo++) {
        const net = this.netMonthly(mp, mo, isMonthly);
        const rev = net * rate;
        cumRev += rev;
        rows.push({ mo, mp, net, rate, rev, cumRev,
          deduction: mp - net,
          window: mo <= 2 ? 'draft-only' : mo <= 48 ? 'full-backout' : 'continued' });
      }
    } else {
      // Accelerated: months 1-7 at 90%, months 8-24 at 25%, month 25+ earns nothing
      for (let mo = 1; mo <= termMonths; mo++) {
        const net = this.netMonthly(mp, mo, isMonthly);
        const rate = mo <= this.accelerated.firstWindow
          ? this.accelerated.firstRate
          : mo <= this.accelerated.maxMonths
            ? this.accelerated.secondRate
            : 0;
        const rev = net * rate;
        cumRev += rev;
        rows.push({ mo, mp, net, rate, rev, cumRev,
          deduction: mp - net,
          window: mo <= this.accelerated.firstWindow ? 'first'
            : mo <= this.accelerated.maxMonths ? 'second' : 'none' });
      }
    }
    return rows;
  },

  summary(schedule, payoutModel, isMonthly) {
    const eligible = schedule.filter(r => r.rev > 0);
    const totalRev = schedule.reduce((s, r) => s + r.rev, 0);
    const totalDeductions = schedule.reduce((s, r) => s + r.deduction, 0);
    const totalGross = schedule.reduce((s, r) => s + r.mp, 0);
    return { totalRev, totalDeductions, totalGross, eligibleMonths: eligible.length };
  }
};

function LCRevenueSimulator({ debt }) {
  const [termMonths,    setTermMonths]    = useState(36);
  const [payoutModel,   setPayoutModel]   = useState('billable');
  const [isMonthly,     setIsMonthly]     = useState(true);
  const [monthlyFiles,  setMonthlyFiles]  = useState(1);
  const [showTable,     setShowTable]     = useState(false);

  const validDebt = debt >= LC_REV.minDebt;
  const mp        = validDebt ? debt / termMonths : 0;
  const mpValid   = mp >= LC_REV.minMonthlyPayment;
  const maxTerm   = validDebt ? LC_REV.getMaxAllowedTerm ? LC_REV.maxTerm : Math.min(LC_REV.maxTerm, Math.floor(debt / LC_REV.minMonthlyPayment)) : LC_REV.maxTerm;
  const accValid  = termMonths >= LC_REV.accelerated.minTerm;

  const schedule  = validDebt && mpValid
    ? LC_REV.buildSchedule(debt, termMonths, payoutModel, monthlyFiles, isMonthly)
    : [];
  const sum       = schedule.length ? LC_REV.summary(schedule, payoutModel, isMonthly) : null;

  const tierRate  = LC_REV.tierRate(monthlyFiles, payoutModel);
  const fmtPct    = v => (v * 100).toFixed(0) + '%';
  const fmtD      = v => '$' + v.toFixed(2);

  // Window colors for accelerated
  const windowColor = w => w === 'first' ? G : w === 'second' ? BLUE : w === 'draft-only' ? AMBER : w === 'full-backout' ? LC : '#94a3b8';
  const windowLabel = w => w === 'first' ? 'Window 1 — 90%' : w === 'second' ? 'Window 2 — 25%' : w === 'draft-only' ? 'Draft fee only' : w === 'full-backout' ? 'Full backout' : 'No revenue';

  return (
    <Card>
      <SectionHead logo={LC_LOGO} color={LC}>Legacy Capital — Revenue Model Simulator</SectionHead>

      {!validDebt ? (
        <div style={{background:'#fef2f2',borderRadius:10,padding:'12px 14px',color:RED,fontWeight:700,fontSize:13}}>
          Enter a valid debt amount ($6,000+) above to use the revenue simulator.
        </div>
      ) : (
        <>
          {/* Controls row */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>

            {/* Left — model + frequency */}
            <div style={{display:'grid',gap:12}}>

              {/* Payout model toggle */}
              <div>
                <Lbl>Payout Model</Lbl>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                  {[
                    {id:'billable',    label:'Billable',    sub:'60–65% · up to 60 months'},
                    {id:'accelerated', label:'Accelerated', sub:'90%/25% · up to 24 months'},
                  ].map(m=>{
                    const active = payoutModel === m.id;
                    const disabled = m.id === 'accelerated' && !accValid;
                    return(
                      <button key={m.id}
                        onClick={()=>{ if(!disabled){ setPayoutModel(m.id); }}}
                        style={{padding:'10px 10px',borderRadius:10,border:`2px solid ${active?LC:BORDER}`,
                          background:active?LC+'14':'#fff',cursor:disabled?'not-allowed':'pointer',
                          textAlign:'left',opacity:disabled?0.4:1}}>
                        <div style={{fontWeight:900,fontSize:13,color:active?LCD:DARK}}>{m.label}</div>
                        <div style={{fontSize:11,color:'#64748b',marginTop:2}}>{m.sub}</div>
                        {disabled&&<div style={{fontSize:10,color:RED,fontWeight:700,marginTop:2}}>Needs {LC_REV.accelerated.minTerm}+ month term</div>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Payment frequency toggle */}
              <div>
                <Lbl>Payment Frequency</Lbl>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                  {[
                    {id:true,  label:'Monthly',           sub:'−$4 P1–2  ·  −$84 P3+'},
                    {id:false, label:'Split (Bi-Weekly)', sub:'−$8 P1–2  ·  −$88 P3+ (×2 drafts)'},
                  ].map(f=>{
                    const active = isMonthly === f.id;
                    return(
                      <button key={String(f.id)}
                        onClick={()=>setIsMonthly(f.id)}
                        style={{padding:'10px 10px',borderRadius:10,border:`2px solid ${active?AMBER:BORDER}`,
                          background:active?AMBER+'14':'#fff',cursor:'pointer',textAlign:'left'}}>
                        <div style={{fontWeight:900,fontSize:13,color:active?'#92400e':DARK}}>{f.label}</div>
                        <div style={{fontSize:11,color:'#64748b',marginTop:2}}>{f.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right — term + volume tier */}
            <div style={{display:'grid',gap:12}}>

              {/* Term slider */}
              <div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <Lbl>Program Term</Lbl>
                  <span style={{fontSize:12,color:'#64748b',fontWeight:600}}>Max: {maxTerm} months ($250/mo floor)</span>
                </div>
                <input type='range' min={6} max={maxTerm} step={1} value={Math.min(termMonths,maxTerm)}
                  onChange={e=>setTermMonths(Number(e.target.value))}
                  style={{width:'100%',accentColor:LC}}/>
                <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
                  <span style={{fontSize:13,fontWeight:900,color:LC}}>{termMonths} months</span>
                  <span style={{fontSize:13,fontWeight:700,color:mpValid?GD:RED}}>
                    {fmtD(mp)}/mo {mpValid?'✓':'⚠ below $250 floor'}
                  </span>
                </div>
              </div>

              {/* Monthly files volume tier (billable only) */}
              {payoutModel === 'billable' && (
                <div>
                  <Lbl>Monthly Files Volume Tier</Lbl>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                    {[
                      {label:'Tier 1 — 60%', sub:'< 100 files/month',  val:1,   rate:0.60},
                      {label:'Tier 2 — 65%', sub:'100+ files/month',   val:100, rate:0.65},
                    ].map(t=>{
                      const active = (monthlyFiles >= 100) === (t.val >= 100);
                      return(
                        <button key={t.val}
                          onClick={()=>setMonthlyFiles(t.val)}
                          style={{padding:'10px 10px',borderRadius:10,border:`2px solid ${active?G:BORDER}`,
                            background:active?G+'14':'#fff',cursor:'pointer',textAlign:'left'}}>
                          <div style={{fontWeight:900,fontSize:13,color:active?GD:DARK}}>{t.label}</div>
                          <div style={{fontSize:11,color:'#64748b',marginTop:2}}>{t.sub}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Accelerated window info */}
              {payoutModel === 'accelerated' && (
                <div style={{background:G+'0a',border:`1px solid ${G}33`,borderRadius:10,padding:'12px 14px'}}>
                  <div style={{fontWeight:800,fontSize:13,color:GD,marginBottom:8}}>Accelerated Window Structure</div>
                  <div style={{display:'grid',gap:6}}>
                    {[
                      {label:'Months 1–7',  rate:'90%', color:G,    desc:'First window — high front payout'},
                      {label:'Months 8–24', rate:'25%', color:BLUE, desc:'Second window — tail rate'},
                      {label:'Month 25+',   rate:'0%',  color:RED,  desc:'No revenue after month 24'},
                    ].map((w,i)=>(
                      <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                        padding:'6px 10px',borderRadius:8,background:w.color+'10',border:`1px solid ${w.color}33`}}>
                        <div>
                          <span style={{fontWeight:800,fontSize:12,color:w.color}}>{w.label}</span>
                          <span style={{fontSize:11,color:'#64748b',marginLeft:8}}>{w.desc}</span>
                        </div>
                        <span style={{fontWeight:900,fontSize:16,color:w.color}}>{w.rate}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Deduction breakdown callout */}
          <div style={{background:AMBER+'0d',border:`1px solid ${AMBER}33`,borderRadius:10,
            padding:'10px 16px',marginBottom:16,fontSize:13}}>
            <div style={{fontWeight:800,color:'#92400e',marginBottom:6}}>Active Deduction Schedule — {isMonthly?'Monthly':'Split / Bi-Weekly'} Program</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div style={{background:'#fff',borderRadius:8,padding:'8px 12px',border:`1px solid ${AMBER}33`}}>
                <div style={{fontSize:11,fontWeight:700,color:'#64748b',marginBottom:3}}>PAYMENTS 1–2</div>
                {isMonthly?(
                  <><div style={{fontWeight:800,color:DARK}}>−$4 draft fee</div>
                  <div style={{fontSize:11,color:'#64748b',marginTop:2}}>Net eligible: {fmtD(mp - 4)} × {fmtPct(tierRate||LC_REV.accelerated.firstRate)}</div></>
                ):(
                  <><div style={{fontWeight:800,color:DARK}}>−$4 × 2 drafts = −$8/mo</div>
                  <div style={{fontSize:11,color:'#64748b',marginTop:2}}>Net eligible: {fmtD(mp - 8)} × {fmtPct(tierRate||LC_REV.accelerated.firstRate)}</div></>
                )}
              </div>
              <div style={{background:'#fff',borderRadius:8,padding:'8px 12px',border:`1px solid ${AMBER}33`}}>
                <div style={{fontSize:11,fontWeight:700,color:'#64748b',marginBottom:3}}>PAYMENTS 3–48</div>
                {isMonthly?(
                  <><div style={{fontWeight:800,color:DARK}}>−$4 draft + −$80 backout = −$84/mo</div>
                  <div style={{fontSize:11,color:'#64748b',marginTop:2}}>Net eligible: {fmtD(mp - 84)} × {fmtPct(tierRate||LC_REV.accelerated.secondRate)}</div></>
                ):(
                  <><div style={{fontWeight:800,color:DARK}}>−$44 × 2 drafts = −$88/mo</div>
                  <div style={{fontSize:11,color:'#64748b',marginTop:2}}>Net eligible: {fmtD(mp - 88)} × {fmtPct(tierRate||LC_REV.accelerated.secondRate)}</div></>
                )}
              </div>
            </div>
          </div>

          {!mpValid ? (
            <div style={{background:'#fef2f2',borderRadius:10,padding:'12px 14px',color:RED,fontWeight:700,fontSize:13}}>
              ⚠ Monthly payment of {fmtD(mp)} is below the $250 minimum. Shorten the term or increase enrolled debt.
            </div>
          ) : (
            <>
              {/* Summary metrics */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
                <MetricCard title="Total Revenue" value={fmt(sum.totalRev)}
                  sub={`${termMonths}-month term · ${isMonthly?'monthly':'split'} · ${payoutModel}`}
                  accent={LC} large/>
                <MetricCard title="Gross Client Payments" value={fmt(sum.totalGross)}
                  sub={`${termMonths} × ${fmtD(mp)}/mo`} accent={DARK}/>
                <MetricCard title="Total Deductions" value={fmt(sum.totalDeductions)}
                  sub={`Draft fees + backouts across ${termMonths} payments`} accent={AMBER}/>
                <MetricCard title={payoutModel==='billable'?`Tier Rate (${fmtPct(tierRate||0)})`:'Revenue Rate'}
                  value={payoutModel==='billable'
                    ? (monthlyFiles>=100?'Tier 2 — 65%':'Tier 1 — 60%')
                    : '90% → 25%'}
                  sub={payoutModel==='billable'
                    ? (monthlyFiles>=100?'100+ monthly files':'< 100 monthly files')
                    : `Months 1–7 then 8–${LC_REV.accelerated.maxMonths}`}
                  accent={G}/>
              </div>

              {/* Mini revenue curve */}
              {(()=>{
                const W=860, H=140, PL=64, PB=28, PT=14, PR=20;
                const maxRev=Math.max(...schedule.map(r=>r.cumRev),1);
                const gx=i=>PL+(i/(schedule.length-1||1))*(W-PL-PR);
                const gy=v=>H-PB-(v/maxRev)*(H-PT-PB);
                const pts=schedule.map((r,i)=>`${gx(i)},${gy(r.cumRev)}`).join(' ');
                const milestones=[2,7,24,47].filter(m=>m<schedule.length);
                return(
                  <div style={{background:'#f8fafc',border:`1px solid ${BORDER}`,borderRadius:12,padding:'12px 10px 8px',marginBottom:16,overflowX:'auto'}}>
                    <div style={{fontSize:12,fontWeight:800,color:'#64748b',textTransform:'uppercase',letterSpacing:0.5,marginBottom:8,paddingLeft:8}}>
                      Cumulative Revenue Curve — {termMonths} months
                    </div>
                    <svg width={W} height={H} style={{minWidth:W,display:'block'}}>
                      {[0,0.25,0.5,0.75,1].map((t,i)=>{
                        const yv=H-PB-t*(H-PT-PB);
                        return <g key={i}>
                          <line x1={PL} y1={yv} x2={W-PR} y2={yv} stroke={t===0?'#94a3b8':'#e2e8f0'} strokeWidth={t===0?1.5:1}/>
                          <text x={PL-6} y={yv+4} fontSize="10" fill={LC} textAnchor="end" fontWeight="600">{fmt(maxRev*t)}</text>
                        </g>;
                      })}
                      <polyline fill={LC+'18'} stroke="none"
                        points={`${gx(0)},${H-PB} ${pts} ${gx(schedule.length-1)},${H-PB}`}/>
                      <polyline fill="none" stroke={LC} strokeWidth="2.5"
                        strokeLinejoin="round" strokeLinecap="round" points={pts}/>
                      {/* Kink at payment 3 where backout kicks in */}
                      {schedule.length>2&&(()=>{
                        const x=gx(2),y=gy(schedule[2].cumRev);
                        return <g>
                          <line x1={x} y1={PT} x2={x} y2={H-PB} stroke={AMBER} strokeWidth="1.5" strokeDasharray="4 3"/>
                          <text x={x+3} y={PT+10} fontSize="9" fill={AMBER} fontWeight="800">P3 backout kicks in</text>
                        </g>;
                      })()}
                      {/* Payment 48 marker */}
                      {schedule.length>=48&&(()=>{
                        const x=gx(47),y=gy(schedule[47].cumRev);
                        return <g>
                          <line x1={x} y1={PT} x2={x} y2={H-PB} stroke={PURPLE} strokeWidth="1.5" strokeDasharray="4 3"/>
                          <text x={x+3} y={PT+10} fontSize="9" fill={PURPLE} fontWeight="800">P48</text>
                        </g>;
                      })()}
                      {/* End label */}
                      {schedule.length>0&&(()=>{
                        const last=schedule[schedule.length-1];
                        const x=gx(schedule.length-1),y=gy(last.cumRev);
                        return <text x={x} y={y-10} textAnchor="end" fontSize="11" fill={LCD} fontWeight="900">{fmt(last.cumRev)}</text>;
                      })()}
                    </svg>
                  </div>
                );
              })()}

              {/* Payment schedule table toggle */}
              <button onClick={()=>setShowTable(t=>!t)}
                style={{width:'100%',padding:'11px 16px',borderRadius:10,
                  border:`1px solid ${LC}44`,background:LC+'0a',cursor:'pointer',
                  fontWeight:800,fontSize:13,color:LCD,display:'flex',
                  justifyContent:'space-between',alignItems:'center',marginBottom:showTable?12:0}}>
                <span>Payment-by-Payment Breakdown — {termMonths} rows</span>
                <span style={{fontSize:18,fontWeight:900,color:LC}}>{showTable?'−':'+'}</span>
              </button>

              {showTable&&(
                <div style={{overflowX:'auto',borderRadius:12,border:`1px solid ${BORDER}`,maxHeight:420,overflowY:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                    <thead style={{position:'sticky',top:0,zIndex:10}}>
                      <tr style={{background:DARK}}>
                        {['Mo','Schedule','Gross Payment','Deduction','Net Eligible','Rate','Monthly Revenue','Cumulative'].map(h=>(
                          <th key={h} style={{padding:'8px 10px',color:'#fff',fontWeight:700,fontSize:11,
                            textAlign:'left',borderRight:'1px solid rgba(255,255,255,0.15)',whiteSpace:'nowrap'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.map((r,i)=>{
                        const wc = windowColor(r.window);
                        const wl = windowLabel(r.window);
                        const isKink = r.mo === 3;
                        const is48  = r.mo === 48;
                        return(
                          <tr key={r.mo} style={{
                            background: isKink ? AMBER+'18' : is48 ? PURPLE+'14' : r.window==='none'?'#f8fafc':i%2?'#f8fafc':'#fff',
                            borderLeft: isKink?`3px solid ${AMBER}`:is48?`3px solid ${PURPLE}`:`3px solid transparent`}}>
                            <td style={{padding:'6px 10px',fontWeight:800,color:isKink?AMBER:is48?PURPLE:DARK,
                              borderRight:`1px solid ${BORDER}`,whiteSpace:'nowrap'}}>
                              {r.mo}
                              {isKink&&<span style={{fontSize:9,color:AMBER,display:'block',fontWeight:700}}>backout starts</span>}
                              {is48&&<span style={{fontSize:9,color:PURPLE,display:'block',fontWeight:700}}>backout continues</span>}
                            </td>
                            <td style={{padding:'6px 10px',borderRight:`1px solid ${BORDER}`}}>
                              <span style={{fontSize:10,fontWeight:700,color:wc,background:wc+'18',
                                padding:'2px 6px',borderRadius:99,whiteSpace:'nowrap'}}>{wl}</span>
                            </td>
                            <td style={{padding:'6px 10px',color:'#475569',borderRight:`1px solid ${BORDER}`}}>{fmtD(r.mp)}</td>
                            <td style={{padding:'6px 10px',color:r.deduction>4?RED:'#94a3b8',fontWeight:700,borderRight:`1px solid ${BORDER}`}}>−{fmtD(r.deduction)}</td>
                            <td style={{padding:'6px 10px',fontWeight:700,color:DARK,borderRight:`1px solid ${BORDER}`}}>{fmtD(r.net)}</td>
                            <td style={{padding:'6px 10px',fontWeight:800,color:wc,borderRight:`1px solid ${BORDER}`}}>{fmtPct(r.rate)}</td>
                            <td style={{padding:'6px 10px',fontWeight:800,color:r.rev>0?LC:'#94a3b8',borderRight:`1px solid ${BORDER}`}}>{fmtD(r.rev)}</td>
                            <td style={{padding:'6px 10px',fontWeight:900,color:LCD}}>{fmt(r.cumRev)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </Card>
  );
}

// ─── LEGACY CAPITAL SERVICES TAB ────────────────────────
function LegacyCapitalTab(){
  const [debt,setDebt]=useState(20000);
  const band=getLCBand(debt);
  const validDebt=debt>=6000;

  return(
    <div style={{display:"grid",gap:16}}>
      <Card>
        <SectionHead logo={LC_LOGO} color={LC}>Legacy Capital Services — Attorney Model Commission</SectionHead>

        {/* Product identity */}
        <div style={{background:LC+"0d",border:`1px solid ${LC}33`,borderRadius:12,padding:"12px 16px",marginBottom:14}}>
          <div style={{fontWeight:800,fontSize:14,color:LCD,marginBottom:5}}>What is Legacy Capital Services?</div>
          <div style={{fontSize:13,color:"#374151",lineHeight:1.8}}>
            Legacy Capital Services is an <strong>attorney-model creditor resolution program</strong>. A licensed law firm reviews and works to resolve the client's unsecured creditor accounts.
            This is a <strong>legal service program</strong> — not debt settlement, not debt validation, and not credit repair.
            Always present it as a legal review program and deliver all required disclosures before enrolling.
          </div>
        </div>

        {/* Blocked states */}
        <div style={{background:"#fef2f2",border:`1px solid ${RED}33`,borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:13}}>
          <strong style={{color:RED}}>⛔ Not available in: Idaho (ID) · North Dakota (ND) · Georgia (GA).</strong> Do not enroll clients from these states.
        </div>

        {/* Cross-product routing note */}
        <div style={{background:DARK+"0a",border:`1px solid ${DARK}22`,borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#374151",lineHeight:1.7}}>
          <strong>Deal routing guide:</strong> Legacy Capital requires <strong>$6,000 minimum</strong> and $250/mo minimum payment capacity.
          Deals <strong>$4,000–$5,999</strong> → <strong style={{color:BLUE}}>Consumer Shield only</strong>.
          Deals <strong>$7,000+</strong> → <strong style={{color:G}}>Level Debt</strong> is also available.
        </div>

        {/* Debt input */}
        <div style={{marginBottom:18}}>
          <Lbl>Total Enrolled Debt ($)</Lbl>
          <input type="number" value={debt} min={0} step={500}
            onChange={e=>setDebt(Number(e.target.value))}
            style={{width:"100%",padding:"12px 14px",borderRadius:10,
              border:`1px solid ${debt>0&&!validDebt?RED:BORDER}`,
              fontSize:17,fontWeight:800,color:DARK,background:"#fff",boxSizing:"border-box"}}/>
          {debt>0&&!validDebt&&(
            <div style={{color:RED,fontWeight:700,fontSize:13,marginTop:7}}>
              ⚠ Legacy Capital Services requires a minimum of $6,000 enrolled debt.
              {debt>=4000&&<span style={{color:BLUE}}> Consider Consumer Shield (min $4,000) for this deal.</span>}
            </div>
          )}
        </div>

        {/* Band + payouts */}
        {validDebt&&!band&&(
          <div style={{background:"#fef2f2",borderRadius:12,padding:"12px 16px",color:RED,fontWeight:700}}>Debt amount could not be matched to a band.</div>
        )}

        {band&&(
          <>
            <div style={{display:"inline-flex",alignItems:"center",gap:10,background:LC+"12",
              borderRadius:10,padding:"9px 16px",border:`1px solid ${LC}33`,marginBottom:16}}>
              <span style={{fontWeight:900,fontSize:15,color:LC}}>{band.label}</span>
              <span style={{fontSize:13,color:"#64748b",fontWeight:600}}>{band.range}</span>
              {band.p4===0&&<span style={{fontSize:11,fontWeight:800,background:G+"22",color:GD,padding:"2px 8px",borderRadius:99}}>Full payout at P2</span>}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
              <MetricCard title="Total Commission" value={fmt(band.total)} sub="Full amount for this deal" accent={LC} large/>
              <MetricCard title="Paid at Payment 2" value={fmt(band.p2)} sub="20th of Month 3" accent={LC}/>
              <MetricCard title={band.p4>0?"Paid at Payment 4":"Second Payout"}
                value={band.p4>0?fmt(band.p4):"—"}
                sub={band.p4>0?"20th of Month 5":"Single payout — no split on this band"}
                accent={band.p4>0?LC:"#e2e8f0"}/>
            </div>

            <PayoutTimeline band={band} color={LC}/>
          </>
        )}
      </Card>

      {/* Full schedule */}
      <Card>
        <div style={{fontWeight:800,fontSize:16,color:DARK,marginBottom:14}}>Full Commission Schedule — Legacy Capital Services</div>
        <div style={{overflowX:"auto",borderRadius:12,border:`1px solid ${BORDER}`}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}>
            <thead>
              <tr style={{background:DARK}}>
                {["Band","Debt Range","At Payment 2","At Payment 4","Total Commission"].map(h=>(
                  <th key={h} style={{padding:"11px 14px",color:"#fff",fontWeight:700,fontSize:13,textAlign:"left",borderRight:"1px solid rgba(255,255,255,0.15)"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LC_BANDS.map((b,i)=>{
                const isActive=band?.code===b.code;
                return(
                  <tr key={b.code} style={{background:isActive?LC+"10":i%2?"#f8fafc":"#fff",borderLeft:isActive?`3px solid ${LC}`:"3px solid transparent"}}>
                    <td style={{padding:"10px 14px",fontWeight:900,fontSize:14,color:isActive?LC:DARK,borderRight:`1px solid ${BORDER}`}}>
                      {b.label}
                      {isActive&&<span style={{fontSize:11,background:LC+"22",color:LC,padding:"1px 7px",borderRadius:99,marginLeft:6,fontWeight:700}}>current</span>}
                    </td>
                    <td style={{padding:"10px 14px",color:"#475569",fontWeight:600,borderRight:`1px solid ${BORDER}`}}>{b.range}</td>
                    <td style={{padding:"10px 14px",fontWeight:800,color:LC,fontSize:14,borderRight:`1px solid ${BORDER}`}}>{fmt(b.p2)}</td>
                    <td style={{padding:"10px 14px",color:b.p4>0?LC:"#94a3b8",fontWeight:b.p4>0?800:500,borderRight:`1px solid ${BORDER}`}}>{b.p4>0?fmt(b.p4):"—"}</td>
                    <td style={{padding:"10px 14px",fontWeight:900,fontSize:16,color:GD}}>{fmt(b.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{fontSize:13,color:"#64748b",marginTop:10,fontWeight:600}}>* Band L1 ($6,000–$9,999): $150 flat, paid in full at Payment 2. No split.</div>
      </Card>

      {/* Revenue Model Simulator */}
      <LCRevenueSimulator debt={debt}/>

      {/* Compliance card */}
      <Card>
        <div style={{fontWeight:800,fontSize:16,color:DARK,marginBottom:14}}>Required Compliance — What You Must Say</div>
        <div style={{display:"grid",gap:8,marginBottom:16}}>
          {[
            "The law firm cannot stop all creditor calls.",
            "The client decides whether to stop paying creditors.",
            "The client may still be sued.",
            "The program may negatively impact their credit.",
          ].map((d,i)=>(
            <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",background:"#fffbeb",border:`1px solid ${AMBER}44`,borderRadius:8,padding:"10px 14px"}}>
              <span style={{color:AMBER,fontWeight:900,fontSize:15,flexShrink:0}}>⚠</span>
              <span style={{fontSize:13,fontWeight:600,color:"#374151"}}>{d}</span>
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <div>
            <div style={{fontWeight:800,fontSize:13,color:RED,marginBottom:8}}>❌ Prohibited Phrases</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {["guarantee","erase your debt","cannot be sued","credit repair","pre-approved","we are attorneys"].map(p=>(
                <span key={p} style={{background:"#fef2f2",border:`1px solid ${RED}33`,color:RED,fontWeight:700,fontSize:11,padding:"3px 9px",borderRadius:99}}>"{p}"</span>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontWeight:800,fontSize:13,color:GD,marginBottom:8}}>✓ Approved Language</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {["may help resolve accounts","results vary","law firm will review","not a loan","not credit repair"].map(p=>(
                <span key={p} style={{background:G+"11",border:`1px solid ${G}33`,color:GD,fontWeight:700,fontSize:11,padding:"3px 9px",borderRadius:99}}>"{p}"</span>
              ))}
            </div>
          </div>
        </div>
        <div style={{marginTop:14,background:"#f0fdf9",border:`1px solid ${G}33`,borderRadius:10,padding:"12px 16px"}}>
          <div style={{fontWeight:800,fontSize:13,color:GD,marginBottom:4}}>Opening Script</div>
          <div style={{fontSize:13,color:"#374151",fontStyle:"italic",lineHeight:1.75}}>
            "Based on your situation, we may have a legal service program that could help address your accounts,
            but before I explain it, I need your permission to go over those details. Are you okay hearing more?"
          </div>
        </div>
      </Card>

      <Accordion title="Legacy Capital Services Agent Commissions — Full Policy Explained" color={LC}>
        <PolicySection heading="What is Legacy Capital Services?">
          Legacy Capital Services is an attorney-model creditor resolution program. A licensed law firm reviews and works to resolve the client's unsecured creditor accounts. This is a <strong>legal service program</strong> — not debt settlement, not debt validation, and not credit repair. Always frame it as a legal review of their accounts.
        </PolicySection>

        <PolicySection heading="Minimum Enrollment Requirements">
          <AlertBox color={RED} bg="#fef2f2">
            <strong>Minimum enrolled debt: $6,000.</strong><br/>
            <strong>Minimum monthly payment capacity: $250.</strong><br/>
            <strong>Bank account verification required</strong> before enrollment can proceed.<br/><br/>
            Deals below $6,000 must go to Consumer Shield. Deals where the client cannot sustain $250/month are ineligible.
          </AlertBox>
        </PolicySection>

        <PolicySection heading="State Restrictions — Blocked States">
          <AlertBox color={RED} bg="#fef2f2">
            <strong>Do not enroll clients from: Idaho (ID) · North Dakota (ND) · Georgia (GA).</strong><br/><br/>
            For all other states, confirm serviceability before routing. State handling must be reviewed — do not assume all remaining states are serviceable without confirmation.
          </AlertBox>
        </PolicySection>

        <PolicySection heading="Commission Structure — Flat Rates by Band">
          Legacy Capital Services commissions are <strong>flat dollar amounts</strong> based on the client's total enrolled debt band. For Band L1, the full commission is paid at Payment 2. For Bands L2–L7, commissions are split across two payment milestones.
          <PolicyTable
            headers={["Band","Debt Range","Paid at Payment 2","Paid at Payment 4","Your Total"]}
            rows={LC_BANDS.map(b=>[b.label,b.range,fmt(b.p2),b.p4>0?fmt(b.p4):"—",fmt(b.total)])}
          />
          <div style={{fontSize:13,color:"#64748b",marginTop:8,fontWeight:600}}>* Band L1 ($6,000–$9,999): $150 flat, paid in full at Payment 2. No second payout.</div>
        </PolicySection>

        <PolicySection heading="When You Get Paid — Payout Timing">
          <AlertBox color={LC} bg="#ecfeff">
            <strong>Payment 2 Payout:</strong> Paid on the <strong>20th of Month 3</strong> after the client's 2nd successful monthly payment clears.<br/><br/>
            <strong>Payment 4 Payout (Bands L2–L7 only):</strong> Paid on the <strong>20th of Month 5</strong> after the client's 4th successful monthly payment clears.<br/><br/>
            <strong>Example (Band L4 — $22,000 deal):</strong> Enrolled January 1. Payment 2 clears March 1 → <strong>$250 paid March 20</strong>. Payment 4 clears May 1 → <strong>$100 paid May 20</strong>. Total: $350.
          </AlertBox>
        </PolicySection>

        <PolicySection heading="Chargebacks and Clawbacks">
          <AlertBox color={RED} bg="#fef2f2">
            <strong>Band L1:</strong> Single payout at Payment 2. If Payment 2 never clears, no commission is issued. No clawback.<br/><br/>
            <strong>Bands L2–L7:</strong> If a client cancels before Payment 4 clears and you have already received the Payment 2 payout, that commission is subject to clawback.<br/><br/>
            <strong>NSF / Returned Payments:</strong> A returned payment does not count as cleared. Commission milestones are not met until valid, cleared payments are confirmed.
          </AlertBox>
        </PolicySection>

        <PolicySection heading="QC Call Requirement">
          <AlertBox color={AMBER} bg="#fffbeb">
            <strong>A QC (Quality Control) call is required for every Legacy Capital Services enrollment.</strong><br/><br/>
            • QC hours: <strong>Monday–Friday, 8:00 AM – 5:00 PM PT</strong><br/>
            • Same-day QC cutoff: <strong>3:30 PM PT</strong><br/>
            • After 3:30 PM PT: save the file and work it the next business day<br/>
            • Maximum safe delay: 24 hours. High fallout risk after 48 hours.<br/>
            • Do not promise same-day QC after the cutoff time.
          </AlertBox>
        </PolicySection>

        <PolicySection heading="Client Readiness — Required Before Pushing">
          <ul style={{paddingLeft:20,margin:0,lineHeight:2.2}}>
            <li>Client phone must be on and reachable</li>
            <li>Client should be available for the next 1–3 hours</li>
            <li>Client should expect follow-up contact from the program</li>
            <li>Bank account must be verified before submission</li>
            <li>Client must confirm they are open to a legal service program</li>
          </ul>
        </PolicySection>

        <PolicySection heading="Daily Hustle Bonus — LCS Deals">
          Close 3+ Legacy Capital deals in a single calendar day and every deal earns a bonus on top of base commission. Same structure as Consumer Shield.
          <PolicyTable
            headers={["LCS Deals Closed in One Day","Bonus Per Deal"]}
            rows={[["3 deals","+$50 per deal"],["5+ deals","+$75 per deal"]]}
          />
        </PolicySection>

        <PolicySection heading="Monthly Volume Bonus — LCS Deals">
          Earn a monthly bonus based on Legacy Capital deals with Payment 2 cleared within the calendar month.
          <PolicyTable
            headers={["LCS Deals with P2 Cleared","Monthly Bonus"]}
            rows={[["8–11",fmt(300)],["12–16",fmt(600)],["17–22",fmt(1000)],["23–29",fmt(1500)],["30+",fmt(2250)]]}
          />
        </PolicySection>

        <PolicySection heading="Settlement Floor Bonus">
          Legacy Capital deals are counted alongside Consumer Shield as your validation/legal volume. Adding LCS deals grows your validation side, which means you need to keep your Level Debt deal count strong to maintain the <strong>Settlement Floor Bonus</strong>. See SPIFFs &amp; Bonuses tab for the full calculator.
        </PolicySection>

        <PolicySection heading="Commission Modifications">
          Funding Tier reserves the right to modify Legacy Capital Services commission structures at its sole discretion at any time. Material changes will be communicated. Continued participation constitutes acceptance of updated terms.
        </PolicySection>
      </Accordion>
    </div>
  );
}

// ─── BALANCE BONUS COMPONENT ────────────────────────────
function BalanceBonus(){
  const [ldDeals,setLdDeals]=useState(8);
  const [csDeals,setCsDeals]=useState(4);
  const [lcDeals,setLcDeals]=useState(3);
  const balData=getBalanceBonus(ldDeals,csDeals,lcDeals);
  const total=ldDeals+csDeals+lcDeals;
  const ldPct=total>0?Math.round(balData.ldPct*100):0;
  const valPct=total>0?100-ldPct:0;

  // LD floor thresholds — what % of total must be LD to hit each tier
  const tiers=[
    {label:"Starter floor",desc:"LD >= 25% of total book",floor:0.25,bonus:100,color:AMBER},
    {label:"Solid base",   desc:"LD >= 35% of total book",floor:0.35,bonus:250,color:G},
    {label:"Max protection",desc:"LD >= 45% of total book",floor:0.45,bonus:500,color:GD},
  ];

  const activeTier=tiers.slice().reverse().find(t=>balData.ldPct>=t.floor)||null;

  return(
    <div style={{display:"grid",gap:14}}>

      {/* Sliders */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
        <div>
          <Lbl>Level Debt Deals This Month</Lbl>
          <input type="range" min={0} max={40} step={1} value={ldDeals}
            onChange={e=>setLdDeals(Number(e.target.value))} style={{width:"100%",accentColor:G}}/>
          <div style={{textAlign:"center",fontWeight:800,color:G,fontSize:15,marginTop:4}}>{ldDeals} deals</div>
        </div>
        <div>
          <Lbl>Consumer Shield Deals</Lbl>
          <input type="range" min={0} max={40} step={1} value={csDeals}
            onChange={e=>setCsDeals(Number(e.target.value))} style={{width:"100%",accentColor:BLUE}}/>
          <div style={{textAlign:"center",fontWeight:800,color:BLUE,fontSize:15,marginTop:4}}>{csDeals} deals</div>
        </div>
        <div>
          <Lbl>Legacy Capital Deals</Lbl>
          <input type="range" min={0} max={40} step={1} value={lcDeals}
            onChange={e=>setLcDeals(Number(e.target.value))} style={{width:"100%",accentColor:LC}}/>
          <div style={{textAlign:"center",fontWeight:800,color:LC,fontSize:15,marginTop:4}}>{lcDeals} deals</div>
        </div>
      </div>

      {/* Book composition visual */}
      <div style={{background:"#f8fafc",border:`1px solid ${BORDER}`,borderRadius:12,padding:"14px 16px"}}>
        <div style={{fontSize:12,fontWeight:800,color:"#64748b",textTransform:"uppercase",letterSpacing:0.5,marginBottom:10}}>
          Your Book Composition — {total} total deals
        </div>
        {/* Stacked bar */}
        <div style={{height:24,borderRadius:99,overflow:"hidden",display:"flex",marginBottom:8,background:"#e2e8f0"}}>
          {total>0&&<>
            <div style={{width:`${ldPct}%`,background:`linear-gradient(90deg,${G},${GD})`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:11,fontWeight:800,color:"#fff",transition:"width 0.4s",
              whiteSpace:"nowrap",overflow:"hidden"}}>
              {ldPct>=10?`LD ${ldPct}%`:""}
            </div>
            <div style={{flex:1,background:`linear-gradient(90deg,${BLUE},${LC})`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:11,fontWeight:800,color:"#fff",whiteSpace:"nowrap",overflow:"hidden"}}>
              {valPct>=10?`CS+LCS ${valPct}%`:""}
            </div>
          </>}
        </div>
        {/* Floor markers */}
        <div style={{position:"relative",height:20,marginBottom:4}}>
          {[{pct:25,label:"25%"},{pct:35,label:"35%"},{pct:45,label:"45%"}].map(m=>(
            <div key={m.pct} style={{position:"absolute",left:`${m.pct}%`,transform:"translateX(-50%)",
              display:"flex",flexDirection:"column",alignItems:"center"}}>
              <div style={{width:1,height:8,background:ldPct>=m.pct?GD:"#cbd5e1"}}/>
              <span style={{fontSize:9,fontWeight:800,color:ldPct>=m.pct?GD:"#94a3b8",whiteSpace:"nowrap"}}>{m.label}</span>
            </div>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#64748b",fontWeight:600}}>
          <span><span style={{display:"inline-block",width:9,height:9,borderRadius:2,background:G,marginRight:4,verticalAlign:"middle"}}/>Level Debt: <strong style={{color:GD}}>{ldPct}%</strong> ({ldDeals} deals)</span>
          <span><span style={{display:"inline-block",width:9,height:9,borderRadius:2,background:BLUE,marginRight:4,verticalAlign:"middle"}}/>CS+LCS: <strong style={{color:BLUE}}>{valPct}%</strong> ({csDeals+lcDeals} deals)</span>
        </div>
      </div>

      {/* Result */}
      <div style={{background:balData.bonus>0?G+"0e":"#fef2f2",
        border:`2px solid ${balData.bonus>0?G:RED+"44"}`,borderRadius:14,padding:"16px 18px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div>
            <div style={{fontWeight:900,fontSize:16,color:DARK}}>Settlement Floor Bonus</div>
            <div style={{fontSize:13,color:"#475569",marginTop:4,fontWeight:600,lineHeight:1.6}}>{balData.label}</div>
            {total>=5&&balData.bonus===0&&(
              <div style={{fontSize:12,color:RED,fontWeight:700,marginTop:6}}>
                You need {Math.ceil(total*0.25)-ldDeals} more LD deal{Math.ceil(total*0.25)-ldDeals!==1?"s":""} to hit the first tier.
                At your current volume that means bringing LD to at least {Math.ceil(total*0.25)} deals.
              </div>
            )}
            {total>=5&&balData.bonus>0&&activeTier&&(
              <div style={{fontSize:12,color:GD,fontWeight:700,marginTop:6}}>
                {balData.ldPct>=0.45?"Maximum tier reached — short-term revenue recognition is well protected."
                  :`${Math.ceil(total*([0.45,0.35,0.25].find(f=>balData.ldPct<f)||0))-ldDeals} more LD deal${(Math.ceil(total*([0.45,0.35,0.25].find(f=>balData.ldPct<f)||0))-ldDeals)!==1?"s":""} to reach the next tier.`}
              </div>
            )}
          </div>
          <div style={{fontSize:36,fontWeight:900,color:balData.bonus>0?GD:"#94a3b8",lineHeight:1,flexShrink:0,marginLeft:16}}>
            {balData.bonus>0?fmt(balData.bonus):"—"}
          </div>
        </div>

        {/* Three tier cards */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {tiers.map((tier,i)=>{
            const achieved=balData.ldPct>=tier.floor;
            const isActive=activeTier?.floor===tier.floor;
            return(
              <div key={i} style={{background:achieved?tier.color+"18":"#f8fafc",
                border:`2px solid ${isActive?tier.color:achieved?tier.color+"55":BORDER}`,
                borderRadius:10,padding:"12px 10px",textAlign:"center",
                boxShadow:isActive?`0 0 0 3px ${tier.color}22`:"none"}}>
                <div style={{fontSize:10,fontWeight:700,color:achieved?tier.color:"#94a3b8",
                  textTransform:"uppercase",letterSpacing:0.4,marginBottom:3}}>{tier.label}</div>
                <div style={{fontSize:11,color:achieved?"#374151":"#94a3b8",marginBottom:5}}>{tier.desc}</div>
                <div style={{fontSize:20,fontWeight:900,color:achieved?tier.color:"#94a3b8"}}>{fmt(tier.bonus)}</div>
                {isActive&&<div style={{fontSize:10,color:tier.color,fontWeight:800,marginTop:4}}>✓ ACTIVE</div>}
                {achieved&&!isActive&&<div style={{fontSize:10,color:tier.color,fontWeight:700,marginTop:4}}>✓ cleared</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{fontSize:12,color:"#94a3b8",fontWeight:600,lineHeight:1.7}}>
        The Settlement Floor Bonus is designed to keep short-term revenue recognition healthy.
        Level Debt pays after 2 cleared payments — the fastest cash cycle of any product.
        Adding CS or LCS deals is encouraged, but <strong>LD must hold its share of your total book</strong> to qualify.
        Minimum 5 total deals. Paid monthly.
      </div>
    </div>
  );
}

// ─── SPIFF TAB ──────────────────────────────────────────
function SpiffTab(){
  const [csToday,setCsToday]=useState(3);
  const [lcToday,setLcToday]=useState(2);
  const [csMonthly,setCsMonthly]=useState(12);
  const [lcMonthly,setLcMonthly]=useState(8);

  // Daily hustle SPIFF is calculated inline from combined total (csToday + lcToday)
  const combinedMonthly  = csMonthly + lcMonthly;
  const combinedMonthBonus = getMonthlyBonus(combinedMonthly);
  const combinedNext     = getNextBonus(combinedMonthly);

  const tiers=[{min:8,label:"8–11",bonus:300},{min:12,label:"12–16",bonus:600},
    {min:17,label:"17–22",bonus:1000},{min:23,label:"23–29",bonus:1500},{min:30,label:"30+",bonus:2250}];

  return(
    <div style={{display:"grid",gap:16}}>

      {/* Daily Hustle — CS + LCS combined pool */}
      <Card>
        <SectionHead color={AMBER}>Daily Hustle Bonus — CS + Legacy Capital Combined</SectionHead>
        <div style={{fontSize:14,color:"#475569",marginBottom:18,lineHeight:1.7,fontWeight:500}}>
          Consumer Shield and Legacy Capital deals <strong>pool together</strong> toward the daily threshold.
          Close any combination that totals 3+ and every deal closed that day — CS and LCS alike — earns the per-deal bonus on top of base commission. Resets at midnight every day.
        </div>

        {/* Two input sliders */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
          <div style={{background:BLUE+"08",border:`1px solid ${BLUE}22`,borderRadius:12,padding:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <img src={CS_LOGO} alt="" style={{height:20,objectFit:"contain"}}/>
              <span style={{fontWeight:800,fontSize:13,color:DARK}}>Consumer Shield Deals Today</span>
            </div>
            <input type="range" min={0} max={10} step={1} value={csToday}
              onChange={e=>setCsToday(Number(e.target.value))} style={{width:"100%",accentColor:BLUE}}/>
            <div style={{textAlign:"center",fontWeight:900,color:BLUE,fontSize:18,marginTop:4}}>{csToday}</div>
          </div>
          <div style={{background:LC+"08",border:`1px solid ${LC}22`,borderRadius:12,padding:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <img src={LC_LOGO} alt="" style={{height:20,objectFit:"contain"}} onError={e=>{e.target.style.display="none"}}/>
              <span style={{fontWeight:800,fontSize:13,color:DARK}}>Legacy Capital Deals Today</span>
            </div>
            <input type="range" min={0} max={10} step={1} value={lcToday}
              onChange={e=>setLcToday(Number(e.target.value))} style={{width:"100%",accentColor:LC}}/>
            <div style={{textAlign:"center",fontWeight:900,color:LC,fontSize:18,marginTop:4}}>{lcToday}</div>
          </div>
        </div>

        {/* Combined result */}
        {(()=>{
          const combined=csToday+lcToday;
          const spiff=getDailySpiff(combined);
          const totalSpiff=spiff*combined;
          const toNext=combined<3?3-combined:combined<5?5-combined:0;
          return(
            <div style={{background:spiff>0?AMBER+"14":"#f8fafc",border:`2px solid ${spiff>0?AMBER:BORDER}`,
              borderRadius:14,padding:"18px 20px"}}>
              {/* Pool total + threshold bar */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div>
                  <div style={{fontSize:12,fontWeight:800,color:"#64748b",textTransform:"uppercase",letterSpacing:0.5,marginBottom:4}}>
                    Combined Deals Today
                  </div>
                  <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                    <span style={{fontSize:38,fontWeight:900,color:spiff>0?AMBER:DARK,lineHeight:1}}>{combined}</span>
                    <span style={{fontSize:13,fontWeight:600,color:"#64748b"}}>
                      {csToday} CS + {lcToday} LCS
                    </span>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:0.4,marginBottom:4}}>Bonus Per Deal</div>
                  <div style={{fontSize:32,fontWeight:900,color:spiff>0?AMBER:"#94a3b8",lineHeight:1}}>
                    {spiff>0?`+${fmt(spiff)}`:"—"}
                  </div>
                </div>
              </div>

              {/* Threshold progress bar */}
              <div style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,fontWeight:700,color:"#94a3b8",marginBottom:5}}>
                  <span>0 deals</span><span style={{color:combined>=3?AMBER:"#94a3b8"}}>3 deals → +$50</span><span style={{color:combined>=5?AMBER:"#94a3b8"}}>5 deals → +$75</span>
                </div>
                <div style={{height:12,background:"#f1f5f9",borderRadius:99,overflow:"hidden",position:"relative"}}>
                  <div style={{height:"100%",borderRadius:99,background:`linear-gradient(90deg,${AMBER},#d97706)`,
                    width:`${Math.min(100,(combined/5)*100)}%`,transition:"width 0.4s"}}/>
                  {/* Threshold markers */}
                  {[3,5].map(t=>(
                    <div key={t} style={{position:"absolute",top:0,bottom:0,left:`${(t/5)*100}%`,
                      width:2,background:"#fff",opacity:0.7}}/>
                  ))}
                </div>
                <div style={{fontSize:12,fontWeight:700,color:spiff>0?AMBER:"#64748b",marginTop:6,textAlign:"center"}}>
                  {spiff>0
                    ? combined>=5 ? "🔥 Maximum daily tier — +$75 on every deal today!"
                      : `✓ Threshold hit — +$50 on every deal. ${toNext} more deal${toNext!==1?"s":""} to jump to +$75.`
                    : `${toNext} more deal${toNext!==1?"s":""} (CS or LCS) to unlock +$50 per deal`}
                </div>
              </div>

              {/* Metric cards */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                <MetricCard title="CS Commission SPIFF" value={spiff>0&&csToday>0?fmt(spiff*csToday):"—"}
                  sub={csToday>0?`${csToday} deal${csToday!==1?"s":""} × ${fmt(spiff)}`:"No CS deals today"} accent={spiff>0?BLUE:"#e2e8f0"}/>
                <MetricCard title="LCS Commission SPIFF" value={spiff>0&&lcToday>0?fmt(spiff*lcToday):"—"}
                  sub={lcToday>0?`${lcToday} deal${lcToday!==1?"s":""} × ${fmt(spiff)}`:"No LCS deals today"} accent={spiff>0?LC:"#e2e8f0"}/>
                <MetricCard title="Total Daily SPIFF" value={totalSpiff>0?fmt(totalSpiff):"—"}
                  sub="Added on top of all base commissions today" accent={totalSpiff>0?AMBER:"#e2e8f0"} large/>
              </div>
            </div>
          );
        })()}

        <div style={{marginTop:12,fontSize:12,color:"#94a3b8",fontWeight:600,lineHeight:1.7}}>
          Daily SPIFF is paid on the same schedule as deal commission — triggered when Payment 2 of each deal clears.
          If a deal does not reach Payment 2, no SPIFF is paid on that deal.
        </div>
      </Card>

      {/* Monthly Volume Bonus — CS + LCS combined pool */}
      <Card>
        <SectionHead color={G}>Monthly Volume Bonus — CS + Legacy Capital Combined</SectionHead>
        <div style={{fontSize:14,color:"#475569",marginBottom:18,lineHeight:1.7,fontWeight:500}}>
          Consumer Shield and Legacy Capital deals <strong>pool together</strong> toward the monthly volume bonus.
          Your combined deal count with Payment 2 cleared determines the tier. Paid on the <strong>20th of the following month</strong>.
        </div>

        {/* Two input sliders */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
          <div style={{background:BLUE+"08",border:`1px solid ${BLUE}22`,borderRadius:12,padding:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <img src={CS_LOGO} alt="" style={{height:20,objectFit:"contain"}}/>
              <span style={{fontWeight:800,fontSize:13,color:DARK}}>Consumer Shield (P2 Cleared)</span>
            </div>
            <input type="range" min={0} max={40} step={1} value={csMonthly}
              onChange={e=>setCsMonthly(Number(e.target.value))} style={{width:"100%",accentColor:BLUE}}/>
            <div style={{textAlign:"center",fontWeight:900,color:BLUE,fontSize:18,marginTop:4}}>{csMonthly} deals</div>
          </div>
          <div style={{background:LC+"08",border:`1px solid ${LC}22`,borderRadius:12,padding:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <img src={LC_LOGO} alt="" style={{height:20,objectFit:"contain"}} onError={e=>{e.target.style.display="none"}}/>
              <span style={{fontWeight:800,fontSize:13,color:DARK}}>Legacy Capital (P2 Cleared)</span>
            </div>
            <input type="range" min={0} max={40} step={1} value={lcMonthly}
              onChange={e=>setLcMonthly(Number(e.target.value))} style={{width:"100%",accentColor:LC}}/>
            <div style={{textAlign:"center",fontWeight:900,color:LC,fontSize:18,marginTop:4}}>{lcMonthly} deals</div>
          </div>
        </div>

        {/* Combined result */}
        <div style={{background:combinedMonthBonus>0?G+"10":"#f8fafc",
          border:`2px solid ${combinedMonthBonus>0?G:BORDER}`,borderRadius:14,padding:"18px 20px"}}>

          {/* Pool total + bonus */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div>
              <div style={{fontSize:12,fontWeight:800,color:"#64748b",textTransform:"uppercase",letterSpacing:0.5,marginBottom:4}}>Combined Deals This Month</div>
              <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                <span style={{fontSize:38,fontWeight:900,color:combinedMonthBonus>0?GD:DARK,lineHeight:1}}>{combinedMonthly}</span>
                <span style={{fontSize:13,fontWeight:600,color:"#64748b"}}>{csMonthly} CS + {lcMonthly} LCS</span>
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:0.4,marginBottom:4}}>Monthly Bonus</div>
              <div style={{fontSize:36,fontWeight:900,color:combinedMonthBonus>0?G:"#94a3b8",lineHeight:1}}>
                {combinedMonthBonus>0?fmt(combinedMonthBonus):"—"}
              </div>
              {combinedNext&&(
                <div style={{fontSize:12,color:"#64748b",fontWeight:600,marginTop:4}}>
                  {combinedNext.t-combinedMonthly} more → {fmt(combinedNext.b)}
                </div>
              )}
            </div>
          </div>

          {/* Tier progress bars */}
          <div style={{display:"grid",gap:9}}>
            {tiers.map(t=>{
              const isActive=combinedMonthBonus===t.bonus;
              const achieved=combinedMonthly>=t.min;
              return(
                <div key={t.min}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:12,fontWeight:isActive?800:600,color:isActive?GD:achieved?"#475569":"#94a3b8"}}>
                      {t.label} deals {isActive&&<span style={{fontSize:10,background:G+"22",color:GD,padding:"1px 6px",borderRadius:99,marginLeft:4}}>✓ ACTIVE</span>}
                    </span>
                    <span style={{fontSize:13,fontWeight:isActive?900:600,color:isActive?G:achieved?GD:"#94a3b8"}}>{fmt(t.bonus)}</span>
                  </div>
                  <ProgressBar value={combinedMonthly} max={t.label.includes("+")?t.min+10:t.min+4}
                    color={isActive?G:achieved?GD+"88":"#e2e8f0"}/>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{marginTop:12,fontSize:12,color:"#94a3b8",fontWeight:600,lineHeight:1.7}}>
          Any CS or LCS deal with Payment 2 cleared within the calendar month counts toward the combined pool.
          The bonus is paid as a single lump sum — it does not split by product.
        </div>
      </Card>

      {/* Settlement Floor Bonus */}
      <Card>
        <SectionHead color={PURPLE}>Settlement Floor Bonus — Monthly</SectionHead>
        <div style={{fontSize:14,color:"#475569",marginBottom:18,lineHeight:1.7,fontWeight:500}}>
          Level Debt pays after 2 cleared payments — the fastest revenue recognition of any product.
          This bonus rewards agents who keep a <strong>healthy floor of settlement deals</strong> in their book even as they grow their CS and LCS volume.
          The threshold is based on <strong>Level Debt's share of your total deal count</strong> — the higher that share, the bigger the bonus.
          Minimum 5 total deals required. Paid monthly.
        </div>
        <BalanceBonus/>
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
  const [lcCounts,setLcCounts]=useState({L1:0,L2:1,L3:1,L4:1,L5:1,L6:0,L7:0});

  const tier=LD_TIERS.find(t=>t.id===ldTier);
  const ldComm=Math.round(ldDeals*ldAvgDebt*tier.rate);

  const csBreakdown=CS_PROGS.map(p=>({...p,count:csCounts[p.key]||0,comm:(csCounts[p.key]||0)*p.total}));
  const csDeals=csBreakdown.reduce((s,p)=>s+p.count,0);
  const csComm=csBreakdown.reduce((s,p)=>s+p.comm,0);

  const lcBreakdown=LC_BANDS.map(b=>({...b,count:lcCounts[b.code]||0,comm:(lcCounts[b.code]||0)*b.total}));
  const lcDeals=lcBreakdown.reduce((s,b)=>s+b.count,0);
  const lcComm=lcBreakdown.reduce((s,b)=>s+b.comm,0);

  const csMonthBonus=getMonthlyBonus(csDeals);
  const lcMonthBonus=getMonthlyBonus(lcDeals);
  const combinedValMonthBonus=getMonthlyBonus(csDeals+lcDeals);
  const total=ldComm+csComm+lcComm+combinedValMonthBonus;
  const totalDeals=ldDeals+csDeals+lcDeals;
  const combinedValNext=getNextBonus(csDeals+lcDeals);

  const breakdown=[
    {label:"Level Debt commissions",value:ldComm,color:G},
    {label:"CS Debt Validation commissions",value:csComm,color:BLUE},
    {label:"Legacy Capital commissions",value:lcComm,color:LC},
    {label:"CS + LCS monthly volume bonus",value:combinedValMonthBonus,color:AMBER},
  ].filter(b=>b.value>0);
  const maxBar=Math.max(...breakdown.map(b=>b.value),1);

  return(
    <div style={{display:"grid",gap:16}}>
      {/* Big total */}
      <div style={{background:`linear-gradient(135deg,${DARK} 0%,#0b3b50 50%,#0f766e 100%)`,borderRadius:18,padding:"24px 28px"}}>
        <div style={{fontSize:12,fontWeight:800,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:6}}>Projected Monthly Earnings</div>
        <div style={{fontSize:52,fontWeight:900,color:"#fff",letterSpacing:"-2px",lineHeight:1}}>{fmt(total)}</div>
        <div style={{fontSize:14,color:"rgba(255,255,255,0.55)",marginTop:10,fontWeight:600}}>
          {totalDeals} total deals · {ldDeals} LD / {csDeals} CS / {lcDeals} LCS · {totalDeals>0?fmt(Math.round(total/totalDeals)):"$0"} avg per deal
        </div>
      </div>

      {/* Three product cards */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
        {/* LD */}
        <Card>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,paddingBottom:10,borderBottom:`2px solid ${G}`}}>
            <img src={LD_LOGO} alt="" style={{height:24,objectFit:"contain"}}/>
            <span style={{fontWeight:900,fontSize:14,color:DARK}}>Level Debt</span>
          </div>
          <div style={{marginBottom:12}}>
            <Lbl>Commission Tier</Lbl>
            <div style={{display:"flex",gap:4}}>
              {LD_TIERS.map(t=>(
                <button key={t.id} onClick={()=>setLdTier(t.id)} style={{flex:1,padding:"8px 4px",borderRadius:8,
                  border:ldTier===t.id?`2px solid ${G}`:`1px solid ${BORDER}`,
                  background:ldTier===t.id?G+"15":"#fff",cursor:"pointer",
                  fontWeight:900,fontSize:12,color:ldTier===t.id?GD:"#94a3b8"}}>{t.rateLabel}</button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <Lbl>LD Deals This Month</Lbl>
            <input type="range" min={0} max={40} value={ldDeals} onChange={e=>setLdDeals(Number(e.target.value))} style={{width:"100%",accentColor:G}}/>
            <div style={{textAlign:"center",fontWeight:800,color:G,fontSize:14,marginTop:3}}>{ldDeals} deals</div>
          </div>
          <div style={{marginBottom:12}}>
            <Lbl>Avg Enrolled Debt</Lbl>
            <input type="range" min={7000} max={100000} step={500} value={ldAvgDebt} onChange={e=>setLdAvgDebt(Number(e.target.value))} style={{width:"100%",accentColor:G}}/>
            <div style={{textAlign:"center",fontWeight:800,color:G,fontSize:14,marginTop:3}}>{fmt(ldAvgDebt)}</div>
          </div>
          <div style={{background:G+"0f",borderRadius:10,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:13,fontWeight:700,color:"#374151"}}>LD Total</span>
            <span style={{fontSize:18,fontWeight:900,color:GD}}>{fmt(ldComm)}</span>
          </div>
        </Card>

        {/* CS */}
        <Card style={{padding:16}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,paddingBottom:10,borderBottom:`2px solid ${BLUE}`}}>
            <img src={CS_LOGO} alt="" style={{height:24,objectFit:"contain"}}/>
            <span style={{fontWeight:900,fontSize:13,color:DARK}}>Consumer Shield</span>
          </div>
          <div style={{fontSize:12,color:"#64748b",marginBottom:10,fontWeight:600}}>Deals per program this month:</div>
          <div style={{display:"grid",gap:5}}>
            {CS_PROGS.map(p=>{
              const count=csCounts[p.key]||0;
              return(
                <div key={p.key} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:8,
                  background:count>0?BLUE+"0a":"#f8fafc",border:`1px solid ${count>0?BLUE+"33":BORDER}`}}>
                  <div style={{flex:1}}>
                    <span style={{fontSize:12,fontWeight:800,color:count>0?BLUE:"#94a3b8"}}>{p.label}</span>
                    <span style={{fontSize:11,color:"#94a3b8",marginLeft:4}}>{p.range}</span>
                  </div>
                  <span style={{fontSize:12,fontWeight:800,color:count>0?GD:"#94a3b8",marginRight:4}}>{count>0?fmt(count*p.total):fmt(p.total)+"/ea"}</span>
                  <div style={{display:"flex",alignItems:"center",gap:3}}>
                    <button onClick={()=>setCsCounts(prev=>({...prev,[p.key]:Math.max(0,(prev[p.key]||0)-1)}))}
                      style={{width:22,height:22,borderRadius:5,border:`1px solid ${BORDER}`,background:"#fff",cursor:"pointer",fontWeight:900,fontSize:13,color:DARK}}>−</button>
                    <span style={{width:22,textAlign:"center",fontWeight:900,fontSize:13,color:count>0?BLUE:"#94a3b8"}}>{count}</span>
                    <button onClick={()=>setCsCounts(prev=>({...prev,[p.key]:(prev[p.key]||0)+1}))}
                      style={{width:22,height:22,borderRadius:5,border:`1px solid ${BORDER}`,background:"#fff",cursor:"pointer",fontWeight:900,fontSize:13,color:DARK}}>+</button>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{marginTop:10,background:BLUE+"0f",borderRadius:10,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:12,fontWeight:700,color:"#374151"}}>{csDeals} deals</span>
            <span style={{fontSize:18,fontWeight:900,color:BLUE}}>{fmt(csComm)}</span>
          </div>
        </Card>

        {/* LCS */}
        <Card style={{padding:16}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,paddingBottom:10,borderBottom:`2px solid ${LC}`}}>
            <img src={LC_LOGO} alt="" style={{height:24,objectFit:"contain"}} onError={e=>{e.target.style.display="none"}}/>
            <span style={{fontWeight:900,fontSize:13,color:DARK}}>Legacy Capital</span>
          </div>
          <div style={{fontSize:12,color:"#64748b",marginBottom:10,fontWeight:600}}>Deals per band this month:</div>
          <div style={{display:"grid",gap:5}}>
            {LC_BANDS.map(b=>{
              const count=lcCounts[b.code]||0;
              return(
                <div key={b.code} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:8,
                  background:count>0?LC+"0a":"#f8fafc",border:`1px solid ${count>0?LC+"33":BORDER}`}}>
                  <div style={{flex:1}}>
                    <span style={{fontSize:12,fontWeight:800,color:count>0?LC:"#94a3b8"}}>{b.label}</span>
                    <span style={{fontSize:11,color:"#94a3b8",marginLeft:4}}>{b.range}</span>
                  </div>
                  <span style={{fontSize:12,fontWeight:800,color:count>0?LCD:"#94a3b8",marginRight:4}}>{count>0?fmt(count*b.total):fmt(b.total)+"/ea"}</span>
                  <div style={{display:"flex",alignItems:"center",gap:3}}>
                    <button onClick={()=>setLcCounts(prev=>({...prev,[b.code]:Math.max(0,(prev[b.code]||0)-1)}))}
                      style={{width:22,height:22,borderRadius:5,border:`1px solid ${BORDER}`,background:"#fff",cursor:"pointer",fontWeight:900,fontSize:13,color:DARK}}>−</button>
                    <span style={{width:22,textAlign:"center",fontWeight:900,fontSize:13,color:count>0?LC:"#94a3b8"}}>{count}</span>
                    <button onClick={()=>setLcCounts(prev=>({...prev,[b.code]:(prev[b.code]||0)+1}))}
                      style={{width:22,height:22,borderRadius:5,border:`1px solid ${BORDER}`,background:"#fff",cursor:"pointer",fontWeight:900,fontSize:13,color:DARK}}>+</button>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{marginTop:10,background:LC+"0f",borderRadius:10,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:12,fontWeight:700,color:"#374151"}}>{lcDeals} deals</span>
            <span style={{fontSize:18,fontWeight:900,color:LC}}>{fmt(lcComm)}</span>
          </div>
        </Card>
      </div>

      {/* Earnings breakdown */}
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

        {(csDeals>0||lcDeals>0)&&(
          <div style={{background:AMBER+"11",border:`1px solid ${AMBER}33`,borderRadius:10,padding:"10px 14px",fontSize:14,color:"#92400e",fontWeight:600}}>
            {combinedValMonthBonus>0
              ?`✓ ${fmt(combinedValMonthBonus)} combined CS + LCS monthly bonus unlocked (${csDeals+lcDeals} validation/legal deals)`
              :combinedValNext?`Close ${combinedValNext.t-(csDeals+lcDeals)} more CS or LCS deal${combinedValNext.t-(csDeals+lcDeals)!==1?"s":""} to unlock the ${fmt(combinedValNext.b)} monthly bonus`:null}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── ROOT ───────────────────────────────────────────────
export default function App(){
  const [tab,setTab]=useState("ld");

  const tabs=[
    {id:"ld",      label:"Debt Settlement",  tip:"Level Debt Deals"},
    {id:"cs",      label:"Debt Validation",  tip:"Consumer Shield Deals"},
    {id:"lc",      label:"Debt Resolution",  tip:"Legacy Capital / Elite Legal Deals"},
    {id:"spiff",   label:"SPIFFs & Bonuses"},
    {id:"forecast",label:"Monthly Forecast"},
  ];

  return(
    <div style={{minHeight:"100vh",background:BG,fontFamily:'"DM Sans","Helvetica Neue",Arial,sans-serif'}}>

      {/* STICKY HEADER */}
      <div style={{position:"sticky",top:0,zIndex:50,
        background:`linear-gradient(135deg,${DARK} 0%,#0b3b50 45%,#0f766e 100%)`,
        boxShadow:"0 4px 24px rgba(15,23,42,0.22)"}}>
        <div style={{maxWidth:980,margin:"0 auto",padding:"12px 20px 0"}}>

          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
            <img src={FT_LOGO} alt="Funding Tier" style={{height:28,width:"auto"}}/>
            <div>
              <div style={{fontSize:18,fontWeight:900,color:"#fff",letterSpacing:"-0.5px",lineHeight:1}}>Commission Simulator</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",marginTop:2,fontWeight:600,letterSpacing:"0.3px"}}>Agent Earnings Calculator</div>
            </div>
          </div>

          {/* 5-column tab grid */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:3}}>
            {tabs.map(t=>{
              const isActive=tab===t.id;
              const btn=(
                <button key={t.id} onClick={()=>setTab(t.id)} style={{
                  width:"100%",padding:"11px 4px",border:"none",cursor:"pointer",
                  fontWeight:800,fontSize:12,letterSpacing:"-0.2px",
                  borderRadius:"10px 10px 0 0",transition:"all 0.15s",
                  background:isActive?"#fff":"transparent",
                  color:isActive?DARK:"rgba(255,255,255,0.65)",
                  position:"relative",textAlign:"center",whiteSpace:"nowrap",
                  overflow:"hidden",textOverflow:"ellipsis",
                }}>
                  {isActive&&(
                    <span style={{position:"absolute",bottom:0,left:0,right:0,height:3,
                      background:t.id==="lc"?LC:G,borderRadius:"3px 3px 0 0"}}/>
                  )}
                  {t.label}
                </button>
              );
              return t.tip
                ? <Tip key={t.id} tip={t.tip}>{btn}</Tip>
                : <div key={t.id}>{btn}</div>;
            })}
          </div>
        </div>
      </div>

      <div style={{maxWidth:980,margin:"0 auto",padding:"20px 20px 60px"}}>
        {tab==="ld"       &&<LevelDebtTab/>}
        {tab==="cs"       &&<CSTab/>}
        {tab==="lc"       &&<LegacyCapitalTab/>}
        {tab==="spiff"    &&<SpiffTab/>}
        {tab==="forecast" &&<ForecastTab/>}
      </div>
    </div>
  );
}
