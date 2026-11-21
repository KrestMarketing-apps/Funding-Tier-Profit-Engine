import { DEFAULT_INPUTS, makeEmployee } from '../../components/operatingModel/config';
import { runModel } from '../../components/operatingModel/simulate';
import { computeEmployeeCost } from '../../components/operatingModel/labor';
const base:any = JSON.parse(JSON.stringify(DEFAULT_INPUTS));
base.ramp.horizonMonths = 48;
function roster(us:number, off:number, bpo:number){ const r:any[]=[makeEmployee({name:'Owner Operator',type:'owner',role:'closer',teamId:'team-a'})];
 for(let i=1;i<=us;i++) r.push(makeEmployee({name:`Closer ${i} — In-House`,type:'inhouse',role:'closer',teamId:'team-a'}));
 for(let i=1;i<=off;i++) r.push(makeEmployee({name:`Closer ${i} — Offshore`,type:'bpo',role:'closer',hourlyRate:7,teamId:'team-a'}));
 for(let i=1;i<=bpo;i++) r.push(makeEmployee({name:`Opener ${i} — BPO`,type:'bpo',role:'opener',hourlyRate:5,teamId:'team-a'})); return r; }
function virtual(inp:any){ inp.costs.fixedCosts = inp.costs.fixedCosts.filter((c:any)=>!/office|team lunch|rent/i.test(c.label)); }
function mail(inp:any, budget:number){ if(budget<=0) return; const dm=inp.marketing.directMail; dm.enabled=true; dm.piecesPerMonth=Math.round((budget-dm.dataCostPerMonth)/dm.costPerPiece); dm.startMonth=1; }
function cancel(inp:any, fp:number, c:number){ for(const k of ['LEVEL','CS','LEGACY']) inp.survivalCurves[k]={firstPayPct:fp,cancelPctByMonth:[c],steadyStateMonthlyCancelPct:c}; }
const f=(n:number)=>Math.round(n);
const scen = [
 ['A. Owner only, virtual, transfers', 0,0,0, 0, true],
 ['B. Owner + 1 US closer, virtual, transfers', 1,0,0, 0, true],
 ['C. Owner + 3 offshore closers, virtual, transfers', 0,3,0, 0, true],
 ['D. Owner + 3 offshore, virtual, transfers + $12k mail', 0,3,0, 12000, true],
 ['E. Owner + 1 US + 2 BPO openers, virtual', 1,0,2, 0, true],
 ['F. Owner + 1 US closer, office ($2.5k rent), transfers', 1,0,0, 0, false],
] as const;
const out:any[]=[];
const runs:any[] = [];
for (const [label,us,off,bpo,mb,virt] of scen) for (const [fp,c] of [[60,15],[60,6]]) runs.push({label,us,off,bpo,mb,virt,fp,c,buyout:null});
for (const [label,us,off,bpo,mb,virt] of [scen[1],scen[2]]) for (const [fp,c] of [[60,15],[60,6]]) for (const bo of [0,50,100]) runs.push({label:`${label} · ${bo}% buyout`,us,off,bpo,mb,virt,fp,c,buyout:bo});
for (const {label,us,off,bpo,mb,virt,fp,c,buyout} of runs) {
  const inp:any = JSON.parse(JSON.stringify(base)); inp.roster = roster(us,off,bpo); if(virt) virtual(inp); else inp.costs.fixedCosts.push({id:'rent',label:'Office Rent',amount:2500}); mail(inp,mb); cancel(inp,fp,c); if(buyout!=null) inp.consumerShield.buyoutSharePct = buyout;
  const r = runModel(inp); const ms=r.months; const tail=ms.slice(-6); const avg=(k:(m:any)=>number)=>tail.reduce((a,m)=>a+k(m),0)/6;
  const y1=ms.slice(0,12).reduce((a,m)=>a+m.netCashFlow,0);
  const seat = computeEmployeeCost(makeEmployee({name:'p',type: us>0||off===0?'inhouse':'bpo',role:'closer',hourlyRate: us>0||off===0?18:7}), inp.laborPolicy).monthlyCost;
  let hire:number|null=null; for(let i=1;i<ms.length;i++){ const m=ms[i],p=ms[i-1]; if(m.utilizationPct>=90&&p.utilizationPct>=90&&m.cashPosition>=m.reserveTarget+3*seat){hire=m.month;break;} }
  out.push({label, fp, c, buyout, deals:avg(m=>m.deals), rev:avg(m=>m.revenue), labor:avg(m=>m.laborCost), mkt:avg(m=>m.transferCost+m.marketingCost), comm:avg(m=>m.repCommission+m.bonusPaid+m.managerOverride), other:avg(m=>Math.max(0,m.overhead-m.laborCost-m.transferCost-m.marketingCost)), net:avg(m=>m.netCashFlow), y1, low:r.totals.lowestCash, cashOut:r.totals.cashOutMonth, cashPos:r.totals.firstCashPositiveMonth, peak:r.totals.peakCapitalRequired, reserveMet:r.totals.reserveTargetFirstMet, hire, m12bank: ms[11].cashPosition, m24bank: ms[23].cashPosition, months: ms.slice(0,24).map(m=>({mo:m.month, deals:m.deals, rev:m.revenue, net:m.netCashFlow, bank:m.cashPosition, res:m.reserveTarget, util:m.utilizationPct}))});
}
require('fs').writeFileSync(''+__dirname+'/launch-scenarios.json', JSON.stringify(out));
for (const o of out) console.log([o.label, `${o.fp}/${o.c}`, 'deals', o.deals.toFixed(0), 'rev', f(o.rev), 'labor', f(o.labor), 'mkt', f(o.mkt), 'comm', f(o.comm), 'other', f(o.other), 'net', f(o.net), 'y1', f(o.y1), 'low', f(o.low), 'out', o.cashOut, 'cash+', o.cashPos, 'peak', f(o.peak), 'resMet', o.reserveMet, 'hire', o.hire, 'bank12', f(o.m12bank), 'bank24', f(o.m24bank)].join('\t'));
