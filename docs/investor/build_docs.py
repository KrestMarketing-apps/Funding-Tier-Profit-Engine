import json, re
S='/tmp/claude-0/-home-claude/c485d32b-5082-557b-96a4-114f513b0d74/scratchpad/pdf/'
css=open(S+'base.css.html').read()
logo=open(S+'logo.txt').read()
sc=json.load(open('/tmp/claude-0/-home-claude/c485d32b-5082-557b-96a4-114f513b0d74/scratchpad/scenarios.json'))
def g(label_start, c): return next(o for o in sc if o['label'].startswith(label_start) and o['c']==c)
M=lambda n: ('-' if n<0 else '')+'$'+format(int(round(abs(n))),',')
N=lambda n: format(int(round(n)),',')
extra_css='''
<style>
.kv{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.kv div{background:var(--bg);border:1px solid var(--line);border-radius:9px;padding:8px 10px}
.kv .k{font-size:7pt;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.6px}
.kv .v{font-family:"Inconsolata",monospace;font-weight:700;font-size:14pt;color:var(--ink);margin-top:2px}
.kv .v.g{color:var(--green)}.kv .v.r{color:var(--red)}
.kv .d{font-size:7.6pt;color:var(--mut);margin-top:1px}
table.t.sm{font-size:7.9pt}table.t.sm td,table.t.sm th{padding:3.5px 5px}
table.t td.num{font-family:"Inconsolata",monospace;font-weight:700;text-align:right;white-space:nowrap}
table.t th.num{text-align:right}
.tag{display:inline-block;font-size:6.8pt;font-weight:900;padding:1px 6px;border-radius:999px;letter-spacing:.3px}
.tag.h{background:#dcfce7;color:#15803d}.tag.i{background:#dbeafe;color:#1d4ed8}.tag.b{background:#f1f5f9;color:#475569}.tag.m{background:#f0fdfa;color:#0f766e}.tag.x{background:#fee2e2;color:#b91c1c}
.chk li{padding:3px 0 3px 18px;position:relative;font-size:8.8pt;line-height:1.35}
.chk li::before{content:"";position:absolute;left:0;top:6px;width:10px;height:10px;border:1.5px solid var(--teal);border-radius:3px}
.chk{list-style:none}
.two{columns:2;column-gap:18px}
.note{font-size:8pt;color:var(--mut);margin-top:6px}
.band.alt{background:linear-gradient(135deg,#0f3d3a 0%,var(--navy2) 60%,var(--navy) 100%)}
.rhythm{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.rhythm .card h3{font-size:9.5pt}
</style>'''
def head(title): return f'<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>{title}</title><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;900&family=DM+Sans:wght@400;500;700&family=Inconsolata:wght@700&display=swap" rel="stylesheet"/>{css}{extra_css}</head><body>'
def foot(doc, n, total): return f'<div class="foot"><span><b>Funding Tier LLC</b> · {doc} · Confidential — prepared for Paul Dillenback and Nathan Pottish</span><span>Page {n} of {total}</span></div>'
def page(band_eyebrow, h1, lede, body, doc, n, total, alt=False):
    return f'''<div class="page"><div class="band{' alt' if alt else ''}"><div class="eyebrow"><img src="{logo}" alt=""/> {band_eyebrow}</div><h1>{h1}</h1><p>{lede}</p></div><div class="pad">{body}</div>{foot(doc,n,total)}</div>'''

# ───────────────────────── PROPOSAL ─────────────────────────
A15,B15,C15,D15,E15,F15=[g(k,15) for k in 'ABCDEF']
A6,B6,C6,D6,E6,F6=[g(k,6) for k in 'ABCDEF']
doc='Partnership Proposal v2 · Nov 20, 2026'; TOT=6
P=[]
# p1 terms status
P.append(page('Funding Tier LLC · Partnership Proposal · Update','Where We Stand, And What Has Been Built Since',
'Paul — this replaces the Nov 13 proposal. The headline terms are agreed; this update records the refinements we discussed on the 17th, puts real numbers behind the launch on safe assumptions, and shows the operating system that now runs the business month by month. Nothing here is binding until the attorney papers it.',
f'''<div class="sec" style="margin-top:4px">Terms, As They Stand Today</div>
<table class="t sm" style="font-size:7.9pt">
<tr><th style="width:1.3in">Term</th><th>Where we landed</th><th style="width:0.95in">Status</th></tr>
<tr><td><b>Investment</b></td><td>$90,000 for 30% of Funding Tier LLC, funded $30,000 a month over three months; 10% issued per tranche.</td><td><span class="ok">Agreed</span></td></tr>
<tr><td><b>Your money back first</b></td><td>100% of owner distributions to you until $90,000 is returned, then 70 / 30.</td><td><span class="ref">Confirm</span></td></tr>
<tr><td><b>Buyback</b></td><td>10% at year 5 and 10% at year 10, at 3.0× trailing-twelve-month net profit less a 20% founder discount; year-5 window may open from year 3 once you have received 2× your capital. Options, never obligations.</td><td><span class="ok">Discount agreed Nov 17</span></td></tr>
<tr><td><b>Entity</b></td><td>You invest through any entity; the 30% sits in Funding Tier LLC, where the software, program contracts, domains and phone numbers already live. Closing = Membership Interest Purchase Agreement + Amended &amp; Restated Operating Agreement + state filing. New operating account, both of us signatories.</td><td><span class="ref">Confirm</span></td></tr>
<tr><td><b>Back office</b></td><td>Your CPA and HR person, expensed by you. The company's reconciliation and commission software is the computation of record (payout-to-deal matching, commission per rep, bonuses, SPIFFs, NSF and cancellation clawbacks, reserve and distribution allocation); the CPA posts from its monthly run. HR respects the 1099 commission-only rep model and the state hiring map.</td><td><span class="ok">Agreed, scoped</span></td></tr>
<tr><td><b>Spending authority</b></td><td>Only the two members are signers on any bank, merchant, card or lending account. Dual control above $10,000. Payroll runs only member-approved batches. CPA view-only. No new account without both signatures.</td><td><span class="ok">Agreed</span></td></tr>
<tr><td><b>Founder pay</b></td><td>Performance-based: $10,000 base draw paid only in profitable months; $12,500 after three consecutive profitable months; 10% of distributable profit above $20,000/month paid quarterly after your payback; unpaid base accrues and is caught up after your payback.</td><td><span class="ref">Confirm</span></td></tr>
<tr><td><b>Growth and vertical</b></td><td>Purpose clause covers front-end enrollment now and, if financed, a back end later. Tier 3 marketing ($90k/mo) and any back-end build are expansion events: both members, separate budget, new capital pro rata.</td><td><span class="ok">Agreed</span></td></tr>
<tr><td><b>Confidentiality</b></td><td>Mutual NDA now; confidentiality and IP clauses in the operating agreement; CPA, HR, attorney and data vendors sign before access. All IP is company property.</td><td><span class="ref">NDA to sign</span></td></tr>
</table>
<div class="sec">Built Since The Last Proposal</div>
<div class="grid3">
<div class="card" style="--c:var(--teal);padding:8px 11px"><h3>Growth Plan simulator</h3><p style="font-size:8.3pt">Capital, operating mode, team by type, three call sources with budgets, program mix, buyout vs perpetual, attrition — and a month-by-month cash table with the signal to hire or invest.</p></div>
<div class="card" style="--c:var(--blue);padding:8px 11px"><h3>Pay and reconciliation engine</h3><p style="font-size:8.3pt">Every remittance matched to a deal, converted to commission per rep with expected pay date, NSF and cancellation reversals, every bonus and SPIFF — the run your CPA posts from.</p></div>
<div class="card" style="--c:var(--purple);padding:8px 11px"><h3>Recruiting and onboarding</h3><p style="font-size:8.3pt">Application → AI résumé screen → interview → NDA → training → cleared, with state-by-state hiring rules and automatic next-step emails, inside app.krestmarketing.com.</p></div>
</div>''', doc,1,TOT))

# p2 what the capital is for + launch options
def row(o,label):
    return f"<tr><td><b>{label}</b></td><td class='num'>{N(o['deals'])}</td><td class='num'>{M(o['rev'])}</td><td class='num'>{M(o['labor'])}</td><td class='num'>{M(o['mkt'])}</td><td class='num'>{M(o['comm'])}</td><td class='num'>{M(o['other'])}</td><td class='num' style='color:{'var(--green)' if o['net']>0 else 'var(--red)'}'>{M(o['net'])}</td><td class='num'>{M(o['y1'])}</td><td class='num'>{M(o['low'])}</td><td class='num'>{o['cashPos'] or '—'}</td><td class='num'>{o['hire'] or '—'}</td></tr>"
labels={'A':'A · Owner only, virtual','B':'B · Owner + 1 US closer, virtual','C':'C · Owner + 3 offshore closers, virtual','D':'D · C plus $12k/mo direct mail','E':'E · Owner + 1 US closer + 2 BPO openers','F':'F · Owner + 1 US closer, with an office'}
rows15=''.join(row(g(k,15),labels[k]) for k in 'ABCDEF')
rows6=''.join(row(g(k,6),labels[k]) for k in 'BCD')
P.append(page('Funding Tier LLC · Partnership Proposal · Update','What The $90,000 Is For',
'The operating model says the enrollment business carries itself on purchased transfers within a few months in every launch configuration. The capital is not survival money; it is the reserve, the hiring runway and the budget to prove direct mail — so that growth never has to wait on a good month.',
f'''<div class="kv" style="font-size:9pt">
<div><div class="k">Lowest bank balance, any option</div><div class="v g">{M(min(o['low'] for o in sc if o['c']==15 and not o['label'].startswith('D')))}</div><div class="d">of $90,000, safe case, options A–C, E, F</div></div>
<div><div class="k">Cumulative cash positive</div><div class="v">Month {min(o['cashPos'] for o in sc if o['c']==15)}–{max(o['cashPos'] for o in sc if o['c']==15)}</div><div class="d">depending on the option</div></div>
<div><div class="k">First hire signal</div><div class="v">Month {B15['hire']}–{D15['hire']}</div><div class="d">occupancy ≥ 90% and reserve covered</div></div>
<div><div class="k">Bank at month 24, option C</div><div class="v g">{M(C15['m24bank'])}</div><div class="d">safe case; {M(C6['m24bank'])} at 6% cancel</div></div>
</div>
<div class="sec">Launch Options On Safe Assumptions — Mature Month (Months 43–48), Every Cost Paid</div>
<table class="t sm" style="font-size:7.6pt">
<tr><th style="width:2.15in">Option</th><th class="num">Deals/mo</th><th class="num">Revenue</th><th class="num">Labor</th><th class="num">Transfers + mkt</th><th class="num">Rep comm. + bonus</th><th class="num">Other</th><th class="num">Net / mo</th><th class="num">Year-1 net</th><th class="num">Lowest bank</th><th class="num">Cash+ mo</th><th class="num">Hire mo</th></tr>
{rows15}
</table>
<div class="note" style="font-size:7.6pt;margin-top:3px">Safe case: 60% first-pay clear (observed), 15% monthly cancellation (conservative placeholder), 15% transfer close, 65-minute calls, 1.25 deals per 8 closer hours, transfers at $11.60 blended. Virtual = no rent or office extras. "Lowest bank" is the deepest the $90,000 goes.</div>
<div class="sec">Options B, C And D If Cancellation Is 6% A Month</div>
<table class="t sm" style="font-size:7.6pt">
<tr><th style="width:2.15in">Option</th><th class="num">Deals/mo</th><th class="num">Revenue</th><th class="num">Labor</th><th class="num">Transfers + mkt</th><th class="num">Rep comm. + bonus</th><th class="num">Other</th><th class="num">Net / mo</th><th class="num">Year-1 net</th><th class="num">Lowest bank</th><th class="num">Cash+ mo</th><th class="num">Hire mo</th></tr>
{rows6}
</table>
<div class="note" style="font-size:7.6pt;margin-top:3px"><b>How to read it:</b> the roster sets the deal count, the cancel rate sets what each deal is worth, the capital sets how early we hire. Three offshore closers (C) make twice the volume of one US closer (B) for similar labor; an office (F) costs about {M(B15['net']-F15['net'])} a month for the same output; mail (D) adds deals but must pass the Tier 1 test first.</div>''', doc,2,TOT))

# p3 month by month for option C (safe)
mrows=''.join(f"<tr><td class='num' style='text-align:left'>{m['mo']}</td><td class='num'>{N(m['deals'])}</td><td class='num'>{M(m['rev'])}</td><td class='num' style='color:{'var(--green)' if m['net']>0 else 'var(--red)'}'>{M(m['net'])}</td><td class='num'>{M(m['bank'])}</td><td class='num'>{M(m['res'])}</td><td class='num'>{N(m['util'])}%</td><td>{'<span class=\"tag h\">Hire a closer</span>' if C15['hire'] and m['mo']>=C15['hire'] else ('<span class=\"tag m\">Reserve met</span>' if m['bank']>=m['res'] else '<span class=\"tag b\">Build reserve</span>')}</td></tr>" for m in C15['months'] if m['mo']<=12 or m['mo'] in (15,18,21,24))
P.append(page('Funding Tier LLC · Partnership Proposal · Update','The Recommended Path, Month By Month',
f'Option C — owner-operator plus three offshore closers, virtual, fed by purchased transfers — on the safe case. Bank balance starts at your $90,000. Revenue arrives behind the deals (Level Debt pays at month 2; Shield and ELP build month over month), which is why the early months are the ones the capital protects.',
f'''<div class="grid2"><div>
<table class="t sm">
<tr><th>Mo</th><th class="num">Deals</th><th class="num">Revenue</th><th class="num">Net</th><th class="num">Bank</th><th class="num">Reserve target</th><th class="num">Occupancy</th><th>Signal</th></tr>
{mrows}
</table></div>
<div>
<div class="sec" style="margin-top:0">What Happens In Each Phase</div>
<div class="card" style="--c:var(--teal);margin-bottom:8px"><h3>Months 1–3 · Prove the floor</h3><ul><li>Close on the first tranche; open the operating account with dual control; NDAs signed by CPA and HR.</li><li>Hire the three offshore closers (or one US closer — option B); dialer, scripts, QC and the pay engine already run.</li><li>Buy transfers to fill the roster; measure close rate, first-pay clear and cost per deal by vendor.</li><li>Bank dips to about {M(C15['low'])} and recovers from month {C15['cashPos']}.</li></ul></div>
<div class="card" style="--c:var(--blue);margin-bottom:8px"><h3>Months 4–9 · Reserve, then first hire</h3><ul><li>Reserve target (six months of overhead plus chargeback buffer) is met in month {C15['reserveMet']}.</li><li>Hire signal fires in month {C15['hire']}: occupancy at 100% two months running and the bank covers three months of the next seat.</li><li>First direct-mail test drop (Tier 1, $15k) only once the reserve is met and only against the kill criteria on page 4.</li></ul></div>
<div class="card" style="--c:var(--purple)"><h3>Months 10–24 · Compound</h3><ul><li>Each new closer repeats the same test: fill them with transfers first, mail second.</li><li>Your payback completes from distributions once the reserve is held; the waterfall on page 5 governs the order.</li><li>Bank at month 12: {M(C15['m12bank'])}; at month 24: {M(C15['m24bank'])} — before any distribution, founder pay or Tier 2 marketing is taken out.</li></ul></div>
<div class="note">Month-24 bank is the model's gross figure; the waterfall (reserve → founder pay → your payback → 70/30) is applied to it in practice.</div>
</div></div>''', doc,3,TOT))

# p4 assumptions, unit economics
P.append(page('Funding Tier LLC · Partnership Proposal · Update','Safe Assumptions, And The Three Numbers That Move Everything',
'Every figure in this document comes from the same engine you will have live access to. These are the assumptions it is running on today, what each is based on, and which ones actually change the answer.',
f'''<div class="sec" style="margin-top:4px">Assumptions In Force</div>
<table class="t sm" style="font-size:7.6pt">
<tr><th style="width:1.7in">Assumption</th><th style="width:0.9in">Value</th><th>Basis</th><th style="width:1.1in">Moves the answer?</th></tr>
<tr><td>First payment clears</td><td class="num" style="text-align:left">60%</td><td>Observed. Expected to rise with income/ability-to-pay qualification and the AI call-QC risk score on every enrollment call.</td><td><b>Yes — strongly</b></td></tr>
<tr><td>Monthly cancellation (active files)</td><td class="num" style="text-align:left">15% / mo</td><td>Engine placeholder, deliberately harsh. To be replaced by the measured rate from the reconciliation data (active files this month ÷ last month).</td><td><b>Yes — the most</b></td></tr>
<tr><td>Transfer close rate / price</td><td class="num" style="text-align:left">15% · $11.60</td><td>Current vendor performance at the buffer mix ($8 / $14 / $55 by buffer length).</td><td>Yes</td></tr>
<tr><td>Deals per 8 closer hours</td><td class="num" style="text-align:left">1.25</td><td>Floor rule; talk-time capacity at 65-minute handle time is checked alongside it.</td><td>Yes</td></tr>
<tr><td>Program mix</td><td class="num" style="text-align:left">33 / 40 / 27</td><td>Debt Settlement (LD) / Debt Validation (SS) / Debt Resolution (ELP). All figures in this document are debt programs only.</td><td>Moderately</td></tr>
<tr><td>Tax resolution (Milestone)</td><td class="num" style="text-align:left">Off in these figures</td><td>Sold on the same calls: 50% of the $500 Phase 1 fee, then 40–60% of a ~$5,000 Phase 2 case by volume tier, paid as client payments clear; reps 35% of our earnings. Conservative 5% attach / 50% to Phase 2 adds about $2,000 net a month at one US closer; modeled as upside, not in the base.</td><td>Upside only</td></tr>
<tr><td>Direct mail</td><td class="num" style="text-align:left">1.25% · 70% · 20%</td><td>Response, qualified share (prescreen list already excludes bankruptcies and sets the debt floor), close rate; $0.80 all-in per piece; $25k average debt.</td><td>Only once mail is on</td></tr>
<tr><td>Paid social</td><td class="num" style="text-align:left">$35 CPL · 30% · 15%</td><td>Cost per lead, lead-to-qualified-call, close rate; $25k average debt. Planned as retargeting of mailed ZIPs.</td><td>Only once social is on</td></tr>
<tr><td>Reserve policy</td><td class="num" style="text-align:left">6 months</td><td>Six months of overhead plus a chargeback buffer on trailing commission, held before distributions.</td><td>Timing of distributions</td></tr>
</table>
<div class="sec">What One Deal Earns After The Rep Is Paid (Blended $17k Debt)</div>
<div class="grid2">
<table class="t sm">
<tr><th>Program</th><th class="num">Full term</th><th class="num">Rep</th><th class="num">Expected at 60% / 15%</th><th class="num">Net to company</th></tr>
<tr><td>Debt Settlement (LD) — 8% once, month 2</td><td class="num">$1,365</td><td class="num">$213</td><td class="num">$696</td><td class="num">$587</td></tr>
<tr><td>Debt Validation (SS) — 36-mo perpetuity</td><td class="num">$4,256</td><td class="num">$275</td><td class="num">$739</td><td class="num">$599</td></tr>
<tr><td>Debt Resolution (ELP) — residual to 48 mo</td><td class="num">$5,316</td><td class="num">$275</td><td class="num">$584</td><td class="num">$444</td></tr>
<tr><td><b>Blended</b></td><td></td><td></td><td class="num"><b>$683</b></td><td class="num"><b>$553</b></td></tr>
</table>
<div>
<table class="t sm">
<tr><th>Call source</th><th class="num">Cost per deal</th><th>Verdict vs $553</th></tr>
<tr><td>Purchased transfers</td><td class="num">$75</td><td><span class="tag h">Pays at any volume vendors can supply</span></td></tr>
<tr><td>Direct mail at planning rates</td><td class="num">$522</td><td><span class="tag m">Pays narrowly — the Tier 1 test must confirm ≥ 1.25% response</span></td></tr>
<tr><td>Paid social at planning rates</td><td class="num">$778</td><td><span class="tag x">Does not pay stand-alone; use for retargeting at a lower CPL</span></td></tr>
</table>
<div class="callout" style="margin-top:6px;font-size:7.9pt;padding:6px 10px"><b>Why cancellation is the number:</b> a $25k Shield file is worth $5,776 over its term if the client stays; at 15% monthly cancellation the engine books $836 of it, at 6% about $2,160. Same deal, same rep, same cost — the difference is retention, which is why qualification and call QC are funded before growth marketing.</div>
</div></div>''', doc,4,TOT))

# p5 how we decide + waterfall + controls
P.append(page('Funding Tier LLC · Partnership Proposal · Update','How We Decide: Hire, Invest, Hold',
'These are the rules the month-by-month table applies, and the order money moves in. They are written so that neither of us has to make a judgment call under pressure — the numbers make the call and we both see them on the same dashboard.',
f'''<div class="sec" style="margin-top:4px">Decision Triggers</div>
<table class="t sm" style="font-size:7.7pt">
<tr><th style="width:1.4in">Decision</th><th>Trigger</th><th style="width:1.9in">Measured where</th></tr>
<tr><td><b>Hire the next closer</b></td><td>Closer occupancy ≥ 90% for two consecutive months, <i>and</i> bank balance ≥ reserve target + three months of the new seat's cost. Fill the new seat with transfers before any new marketing.</td><td>Occupancy from call logs in app.krestmarketing.com; bank and reserve from the model.</td></tr>
<tr><td><b>Invest in growth marketing</b></td><td>The channel's measured cost per paid deal &lt; what a deal earns after the rep ($553 today), <i>and</i> bank ≥ reserve + two months of the next spend step. Tier 1 ($15k) is a test; Tier 2 ($40k) only after Tier 1 passes; Tier 3 ($90k) is an expansion event.</td><td>Campaign code on every contact → opportunity → paid deal; ROI ledger per drop.</td></tr>
<tr><td><b>Hold</b></td><td>Any month the bank is below the reserve target: no hire, no new marketing, no distributions.</td><td>Monthly P&amp;L to both members by the 15th.</td></tr>
<tr><td><b>Pull back</b></td><td>First-pay clear rate falls below 50% for two months, or a channel's cost per deal exceeds what a deal earns for two drops: pause that channel or vendor, fix qualification, re-test.</td><td>Reconciliation engine; vendor dispute workflow.</td></tr>
</table>
<div class="sec">The Order Money Moves In</div>
<div class="wf">
<div class="n" style="--c:var(--mut)"><div class="k">1</div><div class="t">Operating costs</div><div class="d">Labor, transfers, marketing within budget, rep commissions, bonuses and SPIFFs net of clawbacks, software, telecom.</div></div><div class="a">›</div>
<div class="n" style="--c:var(--amber)"><div class="k">2</div><div class="t">Reserve</div><div class="d">Six months of overhead plus chargeback buffer, held before anything below.</div></div><div class="a">›</div>
<div class="n" style="--c:var(--blue)"><div class="k">3</div><div class="t">Founder pay</div><div class="d">$10,000 base only in profitable months; $12,500 after three in a row.</div></div><div class="a">›</div>
<div class="n" style="--c:var(--navy)"><div class="k">4</div><div class="t">Paul — 100%</div><div class="d">Every distribution to you until $90,000 is returned.</div></div><div class="a">›</div>
<div class="n" style="--c:var(--purple)"><div class="k">5</div><div class="t">Founder catch-up</div><div class="d">Any unpaid base from step 3.</div></div><div class="a">›</div>
<div class="n" style="--c:var(--teal)"><div class="k">6</div><div class="t">70 / 30</div><div class="d">Plus the founder's 10% of distributable profit above $20,000/mo, quarterly.</div></div>
</div>
<div class="sec">Payback Timing, Mechanism Only</div>
<table class="t sm" style="font-size:7.6pt">
<tr><th>Distributable profit after reserve and founder pay</th><th class="num">You are paid back by</th><th class="num">Your share after</th><th class="num">Your cumulative, year 3</th><th class="num">Year 5</th></tr>
<tr><td>$5,000 / month</td><td class="num">Month 18</td><td class="num">$1,500 / mo</td><td class="num">$117,000</td><td class="num">$153,000</td></tr>
<tr><td>$10,000 / month</td><td class="num">Month 9</td><td class="num">$3,000 / mo</td><td class="num">$171,000</td><td class="num">$243,000</td></tr>
<tr><td>$20,000 / month</td><td class="num">Month 5</td><td class="num">$6,000 / mo</td><td class="num">$279,000</td><td class="num">$423,000</td></tr>
</table>
<div class="sec">Controls Already Agreed</div>
<div class="grid3" style="font-size:8pt">
<div class="card" style="--c:var(--navy);padding:6px 10px"><h3>Money</h3><ul><li>Two signers only; dual control above $10,000; payroll runs approved batches only</li><li>CPA view-only; every account on a schedule</li></ul></div>
<div class="card" style="--c:var(--amber);padding:6px 10px"><h3>Both members required</h3><ul><li>Debt over $25,000; new equity; sale of company or IP; partner or comp-plan changes</li><li>Hires above rep level; expansion events; marketing beyond the 25% ceiling</li></ul></div>
<div class="card" style="--c:var(--teal);padding:6px 10px"><h3>Information and IP</h3><ul><li>Live dashboard and bank view for both; P&amp;L by the 15th; NDA now, IP clauses at closing</li><li>Pro rata, ROFR, tag-along; IP stays in the LLC</li></ul></div>
</div>''', doc,5,TOT))

# p6 next steps and open items
P.append(page('Funding Tier LLC · Partnership Proposal · Update','Closing Steps And The Items Still Open',
'What has to happen, in order, and the points I want settled in the operating agreement so neither of us is surprised later. The open items are not objections — they are the things a good attorney will ask us about anyway.',
f'''<div class="grid2">
<div>
<div class="sec" style="margin-top:0">Closing Sequence</div>
<div class="tl">
<div class="s" style="--c:var(--teal)"><div class="dt">Now</div><div class="dot"></div><div class="ln"></div><div class="bx">Mutual NDA<small>Then the live model walkthrough</small></div></div>
<div class="s" style="--c:var(--blue)"><div class="dt">Week 1–2</div><div class="dot"></div><div class="ln"></div><div class="bx">Attorney drafts<small>MIPA + A&amp;R operating agreement + exhibits</small></div></div>
<div class="s" style="--c:var(--amber)"><div class="dt">Week 2–3</div><div class="dot"></div><div class="ln"></div><div class="bx">CPA tax review<small>Partnership classification, EIN, state filing</small></div></div>
<div class="s" style="--c:var(--navy)"><div class="dt">Signing</div><div class="dot"></div><div class="ln"></div><div class="bx">Account + tranche 1<small>Dual control set; 10% issued</small></div></div>
<div class="s" style="--c:var(--purple)"><div class="dt">Months 2–3</div><div class="dot"></div><div class="bx">Tranches 2–3<small>10% each; CPA and HR onboarded under NDA</small></div></div>
</div>
<div class="sec">Exhibits To The Operating Agreement</div>
<ul class="chk">
<li><b>Compensation Schedule</b> — every rep commission, bonus, SPIFF and clawback component with its CPA booking (from the versioned pay rules page)</li>
<li><b>Accounts Schedule</b> — every bank, merchant, card and lending account; signers; dual-control threshold</li>
<li><b>Confidentiality and IP</b> — all software, scripts, SOPs, pay engine, data, lists and creative are company property; survives exit</li>
<li><b>Budget and Expansion Events</b> — annual budget, 25% marketing flex ceiling, Tier 3 and back-end builds as expansion events</li>
<li><b>Platform and hosting</b> — written licence so the company has durable rights to app.krestmarketing.com, hosting and the code regardless of who built it</li>
</ul>
</div>
<div>
<div class="sec" style="margin-top:0">To Confirm With You</div>
<ul class="chk">
<li>Ownership sits in Funding Tier LLC (not a NewCo); you invest through your own entity if you prefer</li>
<li>Payback-first waterfall as written on page 5</li>
<li>Founder pay formula and the $20,000 performance threshold</li>
<li>Your role: member, not manager — information rights, approvals on the dual-signature list, no operating duties unless we both agree otherwise</li>
</ul>
<div class="sec">Items I Want In The Agreement That We Have Not Discussed Yet</div>
<ul class="chk">
<li><b>Tax distributions</b> — as a partnership you will owe tax on your 30% of allocated profit whether or not cash is distributed; a mandatory quarterly tax distribution at an assumed rate protects you and sits ahead of payback</li>
<li><b>Death, disability, deadlock</b> — buy-sell at the same formula, key-person cover on me, a tie-break mechanism</li>
<li><b>Leaver and non-solicit terms</b> — neither member solicits reps, vendors or program partners away; what happens to a member's interest on voluntary exit</li>
<li><b>Chargeback liability</b> — clawbacks are company liabilities netted in the pay run; the reserve's chargeback buffer is sized off trailing commission and reviewed quarterly</li>
<li><b>Insurance and licensing</b> — E&amp;O policy is in place (~$450 a year); add cyber cover for prospect PII; state licensing and bonding reviewed before any back-end expansion</li>
<li><b>Buyout and accelerated definitions</b> — the exact remittance timing of the Shield lump-sum buyout and the ELP accelerated schedule, confirmed against the partner contracts and written into the Compensation Schedule</li>
</ul>
<div class="sig"><div>Nathan Pottish · Manager, Funding Tier LLC · Date</div><div>Paul Dillenback · Date</div></div>
</div></div>''', doc,6,TOT))
open('/home/claude/ftdocs/proposal-v2.html','w').write(head('Funding Tier — Partnership Proposal v2')+''.join(P)+'</body></html>')

# ───────────────────────── PLAYBOOK ─────────────────────────
doc2='Operating Playbook · v1 · Nov 20, 2026'; T2=6; Q=[]
Q.append(page('Funding Tier LLC · Operating Playbook','How We Run Funding Tier',
'One document for both members: who does what, the rhythm we keep, the rules money follows, how the sales floor stays clean, how marketing is tested before it is scaled, and the exact numbers that tell us when to hire and when to invest. Every rule here is measurable in app.krestmarketing.com or the pay engine.',
'''<div class="sec">Roles</div>
<div class="grid2">
<div class="card" style="--c:var(--teal)"><h3>Nathan — Manager</h3><ul><li>Sales floor, program partners, product and software, compliance, rep hiring, marketing within budget</li><li>SPIFFs and bonus amounts within budget; vendor selection and disputes</li><li>Runs the monthly close: reconciliation → commission run → hands the CPA the posting file</li></ul></div>
<div class="card" style="--c:var(--navy)"><h3>Paul — Member</h3><ul><li>Full information rights: live dashboard, bank view, P&amp;L by the 15th</li><li>Co-signer on every account; second signature on the dual-signature list</li><li>Brings the CPA and HR provider; sponsor for the expansion-event decisions</li></ul></div>
<div class="card" style="--c:var(--blue)"><h3>CPA (Paul's)</h3><ul><li>Posts from the monthly commission run and the reconciled ledger — does not re-determine eligibility</li><li>Partnership return (1065 / K-1s), payroll tax compliance, quarterly tax-distribution estimate</li><li>View-only bank and dashboard access, under NDA</li></ul></div>
<div class="card" style="--c:var(--purple)"><h3>HR / payroll (Paul's)</h3><ul><li>W-2 onboarding and payroll for US closers (California daily overtime rules); contractor agreements for offshore</li><li>Never puts 1099 commission-only reps on a timeclock; follows the state hiring map</li><li>Runs only member-approved payroll batches; no standing debit authority</li></ul></div>
</div>
<div class="sec">Operating Rhythm</div>
<div class="rhythm">
<div class="card" style="--c:var(--teal)"><h3>Daily</h3><ul><li>Occupancy and transfers by vendor</li><li>Deals, first-pay dates set, QC flags</li><li>Unanswered inbound = zero</li></ul></div>
<div class="card" style="--c:var(--blue)"><h3>Weekly</h3><ul><li>Pipeline and rep scorecards</li><li>Vendor close rate and disputes</li><li>Recruiting stages moving</li></ul></div>
<div class="card" style="--c:var(--amber)"><h3>Monthly (by the 15th)</h3><ul><li>Reconciliation → commission run → CPA</li><li>P&amp;L, bank vs reserve, triggers reviewed</li><li>Hire / invest / hold decision minuted</li></ul></div>
<div class="card" style="--c:var(--purple)"><h3>Quarterly</h3><ul><li>Tax distributions; founder bonus if due</li><li>Re-fit the model to measured first-pay and cancel rates</li><li>Reserve buffer and insurance review</li></ul></div>
</div>''', doc2,1,T2, alt=True))

Q.append(page('Funding Tier LLC · Operating Playbook','Launch Checklist — The First Ninety Days',
'In order. Nothing on the sales side starts until the money side is locked, and nothing on the marketing side starts until the sales side has a measured baseline.',
'''<div class="grid2">
<div>
<div class="sec" style="margin-top:0">Weeks 1–2 · Paper and money</div>
<ul class="chk">
<li>Mutual NDA signed; CPA, HR, attorney and any data vendor sign before access</li>
<li>Attorney engaged for Funding Tier LLC: MIPA, A&amp;R operating agreement, exhibits</li>
<li>CPA confirms partnership classification, EIN and state filing; tax-distribution rate set</li>
<li>Operating account opened: both signers, dual control above $10,000, cards to members only</li>
<li>Tranche 1 ($30,000) received; 10% issued; Accounts Schedule filled in</li>
<li>Platform and hosting licence signed so the company holds durable rights to app.krestmarketing.com, hosting and code</li>
</ul>
<div class="sec">Weeks 2–4 · Floor ready</div>
<ul class="chk">
<li>Pick the launch roster: owner + 1 US closer, or owner + 3 offshore closers (the model shows both)</li>
<li>Offers out through the recruiting pipeline (application → AI screen → interview → NDA → training)</li>
<li>Dialer, DIDs, scripts, enrollment SOPs and the call-QC transcription live for every seat</li>
<li>Transfer vendors confirmed with buffer mix and dispute terms; credit-pull accounts active per program</li>
<li>Pay rules page versioned; first commission run scheduled; expected-pay-date logic on every deal</li>
</ul>
</div>
<div>
<div class="sec" style="margin-top:0">Weeks 4–8 · Baseline</div>
<ul class="chk">
<li>Fill closers with transfers only; target occupancy ≥ 90% by week 6</li>
<li>Measure by vendor: close rate, cost per deal, first-pay clear, average debt</li>
<li>Program routing checked on every file: state eligibility, debt floor, ability to pay, buyout vs perpetual</li>
<li>First month-end close delivered to the CPA by the 15th; both members review bank vs reserve</li>
</ul>
<div class="sec">Weeks 8–13 · Decide</div>
<ul class="chk">
<li>Re-fit the model to the measured first-pay and cancellation rates — this is the first real forecast</li>
<li>If occupancy ≥ 90% two months running and bank ≥ reserve + 3 × seat cost: hire the next closer</li>
<li>If reserve is met: schedule the Tier 1 direct-mail test (page 4) against the kill criteria</li>
<li>Tranche 3 received; CPA and HR fully onboarded; first quarterly review booked</li>
</ul>
<div class="callout" style="margin-top:10px;font-size:8.6pt"><b>Rule of the first quarter:</b> every dollar of the $90,000 that leaves the bank buys either a measured seat or a measured test. Nothing is spent on an assumption that has not been checked against the CRM.</div>
</div></div>''', doc2,2,T2, alt=True))

Q.append(page('Funding Tier LLC · Operating Playbook','Sales Floor And File Quality',
'Retention is worth more than any marketing lever: the same deal is worth two to three times as much when the client stays. These are the rules that protect it.',
'''<div class="grid2">
<div>
<div class="sec" style="margin-top:0">Who We Enroll</div>
<ul class="chk">
<li>Stated employment, income and a monthly payment the client can show they can make — no file without an ability-to-pay check</li>
<li>Unsecured debt above the program floor; state eligible for the program quoted (state map in the toolkit)</li>
<li>No active bankruptcy; no recent NSF pattern the client cannot explain</li>
<li>Every enrollment call transcribed and scored by the AI call-QC; risk flags reviewed before the first draft date</li>
</ul>
<div class="sec">Program Routing</div>
<table class="t sm">
<tr><th>Program</th><th>Fits when</th><th>Payout to Funding Tier</th><th>Risk window</th></tr>
<tr><td>Debt Settlement (LD)</td><td>Larger balances, client wants lowest monthly, settlement-eligible state</td><td>8% of enrolled debt, once, at month 2</td><td>Ends after 2nd client payment</td></tr>
<tr><td>Debt Validation (SS)</td><td>Disputable accounts; buyout if we need cash now</td><td>36-month perpetuity, or one lump-sum buyout after the first payment clears</td><td>Buyout: 1 payment. Perpetual: month by month</td></tr>
<tr><td>Debt Resolution (ELP)</td><td>Legal-backed, longer term, higher lifetime</td><td>Residual for the term written — 48 standard, up to 60 to win a file; $250 minimum draft always applies — or accelerated (90% × 7 months, then 25% to month 24)</td><td>Month by month; accelerated front-loads it</td></tr>
<tr><td>Tax resolution (Milestone)</td><td>Tax debt on the same call; Phase 1 investigation first</td><td>50% of the $500 Phase 1 fee; 40–60% of the Phase 2 case by volume tier, as payments clear</td><td>~15-day refund window; rate locked at funding</td></tr>
</table>

</div>
<div>
<div class="sec" style="margin-top:0">Targets</div>
<table class="t sm" style="font-size:7.6pt">
<tr><th>KPI</th><th class="num">Floor</th><th class="num">Target</th></tr>
<tr><td>First payment clears</td><td class="num">55%</td><td class="num">60% → 70%</td></tr>
<tr><td>Monthly cancellation, active files</td><td class="num">10%</td><td class="num">≤ 6%</td></tr>
<tr><td>Transfer close rate</td><td class="num">12%</td><td class="num">15%+</td></tr>
<tr><td>Deals per 8 closer hours</td><td class="num">1.0</td><td class="num">1.25+</td></tr>
<tr><td>Closer occupancy</td><td class="num">80%</td><td class="num">90–100%, zero unanswered</td></tr>
<tr><td>Average enrolled debt</td><td class="num">$14k</td><td class="num">$17k transfers · $25k mail</td></tr>
<tr><td>QC flags resolved before first draft</td><td class="num">90%</td><td class="num">100%</td></tr>
</table>
<div class="sec">Rep Pay, In One Paragraph</div>
<p style="font-size:8.3pt">Commission and bonuses apply only to deals closed by US W-2 closers; the owner-operator is paid through the members' distribution agreement, and offshore and BPO closers are hourly only. Per paid deal, by program: flat by debt band on Shield and ELP, a volume-tiered percentage of enrolled debt on Level Debt (final after the 2nd payment). Daily-deal, monthly-volume, balanced-book and Level Debt enrollment bonuses sit on top. An NSF never counts; a cancellation inside the chargeback window reverses. Computed per rep, per deal, with an expected pay date, on My Deals &amp; Pay.</p>
<div class="sec">Compliance On The Floor</div>
<ul class="chk">
<li>Scripts and disclosures per program; no outcome promises; TSR-compliant close</li>
<li>State exclusions enforced by the hiring map and the router before a quote</li>
<li>Coached or suspicious warm transfers tagged and disputed with the vendor the same week</li>
<li>Prospect PII stays inside app.krestmarketing.com and the pay engine; no exports</li>
</ul>
</div></div>
<div class="sec" style="margin-top:8px">Buyout Or Perpetual — Net To Funding Tier Per Cleared File, After The Rep</div>
<table class="t sm" style="font-size:7.6pt">
<tr><th style="width:1.3in">Shield file</th><th class="num">Buyout net</th><th class="num">Perpetual net @15% cancel</th><th class="num">Perpetual net @6%</th><th class="num">Break-even cancel</th><th>Rule</th></tr>
<tr><td>$15,000 (65% × 6)</td><td class="num">$817</td><td class="num">$956</td><td class="num">$1,847</td><td class="num">18.2%</td><td>Perpetual unless cancellation runs above 18%</td></tr>
<tr><td>$25,000 (100% × 6)</td><td class="num">$1,880</td><td class="num">$1,271</td><td class="num">$2,480</td><td class="num">9.1%</td><td>Buyout above 9% cancellation; perpetual below it</td></tr>
<tr><td>ELP $15,000</td><td class="num">accel. $490</td><td class="num">resid. $664</td><td class="num">resid. $1,570</td><td class="num">—</td><td>Residual always; accelerate only for cash</td></tr>
</table>
<div class="note" style="font-size:7.4pt;margin-top:3px">Cancellation decides which election is worth more; the reserve decides how much of the faster-cash one we take. Below reserve: sell highest-band files first. Near break-even: split 50/50. Live: Growth Plan → 4b.</div>''', doc2,3,T2, alt=True))

Q.append(page('Funding Tier LLC · Operating Playbook','Marketing — Test Before You Scale',
'Three ways to put a qualified caller in front of a closer. Transfers are the cheapest and vendor-limited; mail and social are ours to control and only earn budget once they have proven their cost per paid deal against what a deal earns.',
'''<div class="grid3">
<div class="card" style="--c:var(--teal)"><h3>Purchased transfers</h3><ul><li>Fill every seat with transfers first — about $75 per paid deal at today's close rate</li><li>Buffer mix ($8 / $14 / $55) tuned monthly against close rate by buffer</li><li>Every transfer billed is credit-pulled and logged; disputes filed weekly</li><li>Cap = what vendors can actually deliver; that cap is why mail exists</li></ul></div>
<div class="card" style="--c:var(--blue)"><h3>Direct mail + prescreen data</h3><ul><li>List from a bureau reseller (Altair CreditReady, CRS LeadsIQ, Deluxe): high revolving utilization, $20k+ unsecured, no bankruptcy</li><li>Firm-offer-of-credit structure through the lender partner; declines route to debt programs</li><li>$0.80 all-in per piece; tracking number per drop; two creatives per test</li><li>Planning: 1.25% response · 70% qualified · 20% close · $25k debt</li></ul></div>
<div class="card" style="--c:var(--purple)"><h3>Paid social</h3><ul><li>Retargets the mailed ZIPs only — brand familiarity drives the lower CPL</li><li>UTM on every ad → landing page → contact in app.krestmarketing.com</li><li>Planning: $35 CPL · 30% qualified · 15% close; stand-alone it does not pay — as retargeting it should</li></ul></div>
</div>
<div class="sec">The Tier 1 Test Protocol ($15,000 / Month, Three Months)</div>
<table class="t sm">
<tr><th style="width:1.2in">Step</th><th>What we do</th><th style="width:2.3in">Pass / kill</th></tr>
<tr><td><b>Before the drop</b></td><td>Reserve met; closers at ≥ 90% occupancy; one extra seat or overtime scheduled for drop weeks; attorney has reviewed creative against FCRA prescreen and TSR; campaign code, tracking number and landing page created; source and campaign fields on the contact record.</td><td>No drop until every item is checked</td></tr>
<tr><td><b>Drop 1–3</b></td><td>10,000 pieces a month, two list segments, two creatives. Every inbound call carries the tracking number → contact → opportunity → paid deal, so cost per paid deal is exact.</td><td>Pass: cost per paid deal &lt; what a deal earns after the rep (≈ $550 today) and average debt &gt; $20k. Kill: two drops above it.</td></tr>
<tr><td><b>After month 3</b></td><td>Re-fit response, qualified share and close in the model with the measured numbers; winning segment and creative go to Tier 2 ($40k) only if the pass criteria held and the bank covers two months of Tier 2.</td><td>Tier 3 ($90k) is an expansion event — both members</td></tr>
</table>
<div class="sec">How ROI Is Tracked Penny For Penny</div>
<div class="wf">
<div class="n" style="--c:var(--teal)"><div class="k">1</div><div class="t">Spend logged</div><div class="d">Each drop or ad set entered with its cost and campaign code.</div></div><div class="a">›</div>
<div class="n" style="--c:var(--blue)"><div class="k">2</div><div class="t">Call attributed</div><div class="d">Tracking number or UTM stamps source + campaign on the contact.</div></div><div class="a">›</div>
<div class="n" style="--c:var(--amber)"><div class="k">3</div><div class="t">Opportunity inherits</div><div class="d">The campaign code follows the deal through every stage.</div></div><div class="a">›</div>
<div class="n" style="--c:var(--purple)"><div class="k">4</div><div class="t">Payment matched</div><div class="d">Pay engine ties each program remittance to the deal and its code.</div></div><div class="a">›</div>
<div class="n" style="--c:var(--navy)"><div class="k">5</div><div class="t">ROI ledger</div><div class="d">Spend, calls, qualified, deals, paid, enrolled debt, revenue to date, cost per paid deal — per campaign.</div></div>
</div>''', doc2,4,T2, alt=True))

Q.append(page('Funding Tier LLC · Operating Playbook','Money — Close, Reserve, Distribute',
'The monthly close is mechanical by design: the software produces the numbers, the CPA posts them, both members see the same screen. The reserve is not negotiable, and the waterfall decides every dollar after it.',
'''<div class="grid2">
<div>
<div class="sec" style="margin-top:0">The Monthly Close (Done By The 15th)</div>
<div class="tl">
<div class="s" style="--c:var(--teal)"><div class="dt">Day 1–5</div><div class="dot"></div><div class="ln"></div><div class="bx">Reconcile<small>Program remittances matched to deals; NSFs and cancels flagged</small></div></div>
<div class="s" style="--c:var(--blue)"><div class="dt">Day 5–8</div><div class="dot"></div><div class="ln"></div><div class="bx">Commission run<small>Per rep, per deal; bonuses, SPIFFs, clawbacks; expected pay dates</small></div></div>
<div class="s" style="--c:var(--amber)"><div class="dt">Day 8–10</div><div class="dot"></div><div class="ln"></div><div class="bx">Member approval<small>Payroll and commission batch approved by a member</small></div></div>
<div class="s" style="--c:var(--purple)"><div class="dt">Day 10–15</div><div class="dot"></div><div class="ln"></div><div class="bx">CPA posts<small>P&amp;L, bank vs reserve, K-1 estimate; sent to both</small></div></div>
<div class="s" style="--c:var(--navy)"><div class="dt">Day 15</div><div class="dot"></div><div class="bx">Decision<small>Hire / invest / hold, minuted</small></div></div>
</div>
<div class="sec">Reserve Rule</div>
<p style="font-size:8.8pt">Target = six months of operating overhead plus a chargeback buffer sized on trailing twelve months of commission paid. Below target: no hire, no new marketing, no distributions, and Shield files may be sold as buyouts to rebuild it. At or above target: the waterfall runs.</p>
<div class="sec">Spending Authority</div>
<ul class="chk">
<li>Members are the only signers; dual control above $10,000</li>
<li>No cards, ACH credentials or wire authority to anyone else — including CPA, HR and any future sales director</li>
<li>Marketing may flex 25% over plan on the Manager's signature; beyond that, both</li>
<li>Any new account of any kind: both signatures, added to the Accounts Schedule</li>
</ul>
</div>
<div>
<div class="sec" style="margin-top:0">The Waterfall</div>
<table class="t sm">
<tr><th style="width:0.3in">#</th><th>Step</th><th>Rule</th></tr>
<tr><td>1</td><td>Operating costs</td><td>Everything on the P&amp;L, including rep pay net of clawbacks</td></tr>
<tr><td>2</td><td>Reserve</td><td>Held to target before anything below</td></tr>
<tr><td>3</td><td>Tax distributions</td><td>Quarterly, at the CPA's assumed rate on allocated profit, to both members</td></tr>
<tr><td>4</td><td>Founder pay</td><td>$10,000 base in profitable months; $12,500 after three in a row</td></tr>
<tr><td>5</td><td>Paul payback</td><td>100% of distributions until $90,000 returned</td></tr>
<tr><td>6</td><td>Founder catch-up</td><td>Accrued unpaid base</td></tr>
<tr><td>7</td><td>70 / 30</td><td>Plus founder's 10% of distributable profit above $20,000/mo, quarterly</td></tr>
</table>
<div class="sec">Clawbacks And Chargebacks</div>
<ul class="chk">
<li>NSF on a first draft: the deal never counted; nothing paid, nothing to recover</li>
<li>Cancellation inside the program's window after commission was paid: reversed on the rep's next run, shown on My Deals &amp; Pay with the reason</li>
<li>Company-level chargebacks from a program partner: booked against the reserve's buffer; buffer reviewed quarterly</li>
<li>File buyouts: one lump sum after the first cleared payment; exposure ends there — that is their purpose</li>
</ul>
<div class="sec">What Both Members See, Always</div>
<ul class="chk">
<li>Operating Model and Growth Plan (live assumptions, month-by-month)</li>
<li>Bank balance vs reserve target; distributions to date; payback remaining</li>
<li>Deals, first-pay rate, cancellation rate, occupancy, cost per deal by channel</li>
</ul>
</div></div>''', doc2,5,T2, alt=True))

Q.append(page('Funding Tier LLC · Operating Playbook','The Scaling Ladder, Risks, And Definitions',
'Growth is a sequence of the same decision repeated: fill the seats, prove the channel, hold the reserve, add the next seat. The ladder below is that sequence written down, with the risks we watch at each rung.',
'''<div class="sec">Scaling Ladder</div>
<table class="t sm">
<tr><th style="width:0.9in">Rung</th><th>Enter when</th><th>What changes</th><th style="width:1.6in">Who decides</th></tr>
<tr><td><b>0 · Launch</b></td><td>Closing complete; tranche 1 in the bank</td><td>Owner + 1 US closer, or owner + 3 offshore; transfers only; virtual</td><td>Already decided in the proposal</td></tr>
<tr><td><b>1 · Full seats</b></td><td>Occupancy ≥ 90% two months; bank ≥ reserve + 3 × seat cost</td><td>One more closer; filled with transfers first</td><td>Manager, within budget</td></tr>
<tr><td><b>2 · Tier 1 mail</b></td><td>Reserve met; seats full; QC and attorney review done</td><td>$15k/month test for three drops against kill criteria</td><td>Manager, within budget</td></tr>
<tr><td><b>3 · Tier 2</b></td><td>Tier 1 passed (cost per paid deal below what a deal earns); bank ≥ reserve + 2 months of Tier 2</td><td>$40k/month; winning segment and creative; +2 closers sized to the calls; overtime on drop weeks</td><td>Manager, within the 25% flex; both if beyond</td></tr>
<tr><td><b>4 · Tier 3 / office</b></td><td>Tier 2 sustained two quarters; reserve covers two months of the higher spend</td><td>$90k/month; +5 closers; office only if occupancy and hiring justify the fixed cost</td><td>Expansion event — both members</td></tr>
<tr><td><b>5 · Back end</b></td><td>Front end profitable and stable; licensing reviewed; capital identified</td><td>Servicing, settlement or validation in-house; second financing round</td><td>Expansion event — both members; new capital pro rata</td></tr>
</table>
<div class="grid2" style="margin-top:8px">
<div>
<div class="sec" style="margin-top:0">Risk Register</div>
<table class="t sm">
<tr><th>Risk</th><th>Control</th></tr>
<tr><td>Retention below plan (first pay, cancellation)</td><td>Qualification rules, AI call QC, quarterly re-fit; pull-back trigger at 50% first pay</td></tr>
<tr><td>Transfer vendor quality or supply</td><td>Buffer mix, weekly disputes, two vendors minimum, mail as the owned alternative</td></tr>
<tr><td>Program partner change or chargeback</td><td>Three partners; reserve buffer; partner changes require both members</td></tr>
<tr><td>Compliance (FCRA prescreen, TSR, state rules)</td><td>Attorney review of creative; state map; lender-partner offer structure</td></tr>
<tr><td>Key person</td><td>Documented SOPs and software; key-person cover; buy-sell terms</td></tr>
<tr><td>Cash timing (residuals arrive late)</td><td>Reserve rule; buyouts as the cash valve; capital staged in tranches</td></tr>
<tr><td>PII and data security</td><td>Data stays in the CRM and pay engine; vendor NDAs and processing terms; cyber cover</td></tr>
</table>
</div>
<div>
<div class="sec" style="margin-top:0">Definitions</div>
<table class="t sm">
<tr><td><b>Occupancy</b></td><td>Share of closer talk time spent on qualified calls</td></tr>
<tr><td><b>First-pay clear</b></td><td>Share of enrollments whose first draft clears</td></tr>
<tr><td><b>Cancellation rate</b></td><td>Active paying files lost per month, excluding new enrollments</td></tr>
<tr><td><b>Cost per paid deal</b></td><td>Channel spend ÷ deals whose first payment cleared</td></tr>
<tr><td><b>Net per deal</b></td><td>Expected lifetime revenue of a deal less the rep's commission</td></tr>
<tr><td><b>Reserve target</b></td><td>Six months of overhead plus the chargeback buffer</td></tr>
<tr><td><b>Expansion event</b></td><td>Tier 3 marketing, an office, or any back-end build — both members, separate budget</td></tr>
<tr><td><b>Buyout</b></td><td>Selling a Shield file back for one lump sum — (payment − $40) × 65% × 6, or × 100% × 6 on $20k+ — once the first payment clears</td></tr>
<tr><td><b>Perpetuity / residual</b></td><td>Monthly share of the client's payment for the program term</td></tr>
</table>
<div class="callout" style="margin-top:8px;font-size:8.6pt"><b>If we only remember one thing:</b> seats first, then transfers, then the reserve, then a measured test, then the next seat. Never pay for a call nobody can take, and never spend on an assumption the CRM has not confirmed.</div>
</div></div>''', doc2,6,T2, alt=True))
open('/home/claude/ftdocs/playbook.html','w').write(head('Funding Tier — Operating Playbook')+''.join(Q)+'</body></html>')
print('ok')
