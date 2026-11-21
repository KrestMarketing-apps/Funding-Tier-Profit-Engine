import { DEFAULT_INPUTS } from '../../components/operatingModel/config';
import { shield, buildSurvivalCurve } from '../../components/operatingModel/backends';
const I:any = DEFAULT_INPUTS; const out:any = {};
for (const debt of [15000,25000]) {
  const prog = shield.getProgram(debt, I.consumerShield)!; const buy = shield.buyoutPayout(debt, I.consumerShield);
  out[debt] = { buyout: buy, payment: prog.payment, curves: {} as any, cross: {} as any, full: shield.perpetualFullTerm(debt, I.consumerShield) };
  for (const c of [15,10,6,4]) {
    const s = buildSurvivalCurve({firstPayPct:60,cancelPctByMonth:[c],steadyStateMonthlyCancelPct:c}, 40);
    let cum=0; const arr:number[]=[0]; let cross:number|null=null;
    for (let m=1;m<=36;m++){ cum += (s[m]/s[1])*shield.perpetualRevenueForDealMonth(debt,m,I.consumerShield); arr.push(Math.round(cum)); if(cross==null && cum>=buy) cross=m; }
    out[debt].curves[c]=arr; out[debt].cross[c]=cross;
  }
  // never-cancel cumulative
  let cum=0; const arr:number[]=[0]; for(let m=1;m<=36;m++){cum+=shield.perpetualRevenueForDealMonth(debt,m,I.consumerShield); arr.push(Math.round(cum));} out[debt].curves[0]=arr; let cr:number|null=null; for(let m=1;m<=36;m++){ if(arr[m]>=buy){cr=m;break;} } out[debt].cross[0]=cr;
}
require('fs').writeFileSync(''+__dirname+'/election-curves.json', JSON.stringify(out));
for (const d of [15000,25000]) console.log(d, 'buyout', out[d].buyout, 'cross months {never:0,4,6,10,15}:', JSON.stringify(out[d].cross), 'cum36 @6', out[d].curves[6][36], '@15', out[d].curves[15][36]);
