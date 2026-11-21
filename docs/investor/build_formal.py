import json
S='/tmp/claude-0/-home-claude/c485d32b-5082-557b-96a4-114f513b0d74/scratchpad/pdf/'
css=open(S+'base.css.html').read(); logo=open(S+'logo.txt').read()
sc=json.load(open('/tmp/claude-0/-home-claude/c485d32b-5082-557b-96a4-114f513b0d74/scratchpad/scenarios.json'))
def g(k,c): return next(o for o in sc if o['label'].startswith(k+'.') and o['c']==c and o.get('buyout') is None)
M=lambda n: ('-' if n<0 else '')+'$'+format(int(round(abs(n))),',')
N=lambda n: format(int(round(n)),',')
DATE='November 20, 2026'
extra='''<style>
.cover{background:linear-gradient(160deg,var(--navy) 0%,var(--navy2) 50%,#0f3d3a 100%);color:#fff;height:11in;display:flex;flex-direction:column;justify-content:space-between;padding:0.9in 0.85in}
.cover .eyebrow{display:flex;align-items:center;gap:10px;font-size:9.5pt;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#9fd9d1}
.cover .eyebrow img{width:30px;height:30px;border-radius:50%;background:#fff}
.cover h1{font-size:34pt;font-weight:900;line-height:1.08;margin-top:26px;max-width:6.4in}
.cover .sub{font-size:13pt;color:#c9d6d3;margin-top:14px;max-width:6.2in;line-height:1.45}
.cover .meta{display:grid;grid-template-columns:1fr 1fr;gap:14px 30px;font-size:9.5pt;color:#c9d6d3;border-top:1px solid rgba(255,255,255,.18);padding-top:16px}
.cover .meta b{display:block;color:#9fd9d1;font-size:7.5pt;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:3px}
.cover .conf{font-size:8pt;color:#8fa3ad;line-height:1.45;max-width:6.4in}
.toc{list-style:none;columns:3;column-gap:18px;font-size:8.3pt}
.toc li{display:flex;justify-content:space-between;padding:2.5px 0;border-bottom:1px dotted var(--line)}
.toc li span:last-child{font-family:"Inconsolata",monospace;color:var(--mut)}
.kv{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.kv div{background:var(--bg);border:1px solid var(--line);border-radius:9px;padding:8px 10px}
.kv .k{font-size:7pt;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.6px}
.kv .v{font-family:"Inconsolata",monospace;font-weight:700;font-size:14pt;margin-top:2px}
.kv .v.g{color:var(--green)}.kv .d{font-size:7.6pt;color:var(--mut);margin-top:1px}
table.t.sm{font-size:7.9pt}table.t.sm td,table.t.sm th{padding:3.5px 5px}
table.t td.num{font-family:"Inconsolata",monospace;font-weight:700;text-align:right;white-space:nowrap}
table.t th.num{text-align:right}
.tag{display:inline-block;font-size:6.8pt;font-weight:900;padding:1px 6px;border-radius:999px}
.tag.h{background:#dcfce7;color:#15803d}.tag.m{background:#f0fdfa;color:#0f766e}.tag.x{background:#fee2e2;color:#b91c1c}.tag.b{background:#f1f5f9;color:#475569}
.num-h{font-family:"Poppins";font-size:13pt;font-weight:700;margin:0 0 6px}
.lede{font-size:10pt;color:var(--mut);margin-bottom:10px;line-height:1.45}
p.body{font-size:9.3pt;margin:0 0 7px;line-height:1.45}
.ts{width:100%;border-collapse:collapse;font-size:8.8pt}
.ts th{text-align:left;width:1.65in;vertical-align:top;padding:7px 8px 7px 0;font-family:"Poppins";font-size:8.3pt;color:var(--teal);border-bottom:1px solid var(--line)}
.ts td{vertical-align:top;padding:7px 0;border-bottom:1px solid var(--line);line-height:1.4}
.sig{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:22px}
.sig div{border-top:1px solid var(--ink);padding-top:6px;font-size:8.5pt;color:var(--mut)}
.band h1{font-size:19pt}
.note{font-size:8pt;color:var(--mut);margin-top:6px}
.wx{margin-top:4px}
.wx .r{display:flex;justify-content:space-between;gap:8px;padding:2.5px 0;border-bottom:1px dashed var(--line);font-size:7.3pt;line-height:1.25;align-items:baseline}
.wx .r span{color:var(--mut)}
.wx .r b{font-family:"Inconsolata",monospace;font-size:7.6pt;white-space:nowrap;text-align:right}
.wx .r.tot{border-bottom:none;padding-top:4px}
.wx .r.tot span{color:var(--ink);font-weight:700}
.wx .r.tot b{font-size:9pt;color:var(--teal)}
</style>'''
def head(title): return f'<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>{title}</title><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;900&family=DM+Sans:wght@400;500;700&family=Inconsolata:wght@700&display=swap" rel="stylesheet"/>{css}{extra}</head><body>'
def foot(doc,n,total): return f'<div class="foot"><span><b>Funding Tier LLC</b> · {doc} · Confidential</span><span>Page {n} of {total}</span></div>'
def page(section, h1, lede, body, doc, n, total):
    return f'''<div class="page"><div class="band"><div class="eyebrow"><img src="{logo}" alt=""/> {section}</div><h1>{h1}</h1><p>{lede}</p></div><div class="pad">{body}</div>{foot(doc,n,total)}</div>'''
def cover(title, sub, meta, doc):
    m=''.join(f'<div><b>{k}</b>{v}</div>' for k,v in meta)
    return f'''<div class="page"><div class="cover"><div><div class="eyebrow"><img src="{logo}" alt=""/> Funding Tier LLC</div><h1>{title}</h1><div class="sub">{sub}</div></div><div><div class="meta">{m}</div><div class="conf" style="margin-top:18px">This document is confidential and is provided to the named recipient solely to evaluate a proposed investment in Funding Tier LLC. It is not an offer to sell securities and is not binding on either party. Any investment will be made only under definitive agreements prepared by counsel. Financial figures are outputs of the company's operating model on stated assumptions and are illustrations, not forecasts or guarantees.</div></div></div></div>'''

A15,B15,C15,D15,E15,F15=[g(k,15) for k in 'ABCDEF']; A6,B6,C6,D6,E6,F6=[g(k,6) for k in 'ABCDEF']
labels={'A':'A · Owner-operator only, virtual','B':'B · Owner + 1 US closer, virtual','C':'C · Owner + 3 offshore closers, virtual','D':'D · Option C plus $12k/mo direct mail','E':'E · Owner + 1 US closer + 2 BPO openers','F':'F · Owner + 1 US closer, with office'}
def srow(o,label): return f"<tr><td><b>{label}</b></td><td class='num'>{N(o['deals'])}</td><td class='num'>{M(o['rev'])}</td><td class='num'>{M(o['labor'])}</td><td class='num'>{M(o['mkt'])}</td><td class='num'>{M(o['comm'])}</td><td class='num'>{M(o['other'])}</td><td class='num' style='color:{'var(--green)' if o['net']>0 else 'var(--red)'}'>{M(o['net'])}</td><td class='num'>{M(o['y1'])}</td><td class='num'>{M(o['low'])}</td><td class='num'>{o['cashPos'] or '—'}</td></tr>"
thead="<tr><th style='width:2.15in'>Launch configuration</th><th class='num'>Deals/mo</th><th class='num'>Revenue</th><th class='num'>Labor</th><th class='num'>Transfers + mkt</th><th class='num'>Rep comm. + bonus</th><th class='num'>Other</th><th class='num'>Net / mo</th><th class='num'>Year-1 net</th><th class='num'>Lowest bank</th><th class='num'>Cash+ mo</th></tr>"

# ═══════════════ INVESTMENT PROPOSAL ═══════════════
doc='Investment Proposal'; T=10; P=[]
P.append(cover('Investment Proposal','A 30% membership interest in Funding Tier LLC for $90,000, with payback-first distributions, formula buyback options and member-level controls.',
 [('Prepared for','Paul Dillenback'),('Prepared by','Nathan Pottish, Manager · Funding Tier LLC'),('Date',DATE),('Version','1.0 — supersedes the Nov 13 and Nov 20 drafts'),('Exhibits','A Term Sheet · B Business Plan · C Compensation Schedule · D Operating Playbook · E Growth Marketing Budget Plan · F Accounts Schedule')], doc))

P.append(page('Investment Proposal · 1','Executive Summary',
'Funding Tier is a front-end enrollment company in consumer debt relief. It qualifies callers, matches each one to the best-fit program, enrolls them, and is paid by the servicing partner as the client pays. This proposal asks for $90,000 for a 30% membership interest, on terms designed so the investor is repaid first and the company stays simple to run.',
f'''<div class="kv">
<div><div class="k">The ask</div><div class="v">$90,000</div><div class="d">30% of Funding Tier LLC, three $30,000 tranches</div></div>
<div><div class="k">Investor payback</div><div class="v">First</div><div class="d">100% of distributions until $90,000 returned</div></div>
<div><div class="k">Recommended launch, mature month</div><div class="v g">{M(C15['net'])}</div><div class="d">net profit after every cost, safe case</div></div>
<div><div class="k">Deepest draw on capital</div><div class="v g">{M(90000-C15['low'])}</div><div class="d">of $90,000 — the rest is reserve and runway</div></div>
</div>
<div class="sec">What The Company Does</div>
<p class="body">Every call is qualified for ability to pay, soft-credit-pulled and routed to one of three debt programs — settlement, validation, resolution — with tax resolution available on the same call. Funding Tier never holds client funds; servicing partners run the programs and remit a contractual share of each client payment, so revenue arrives behind enrollment and compounds as cohorts stack.</p>
<div class="sec">What Has Been Built</div>
<p class="body">A deal router and state-aware scripts for every program; a recruiting-to-training pipeline with AI résumé screening and state hiring rules; a pay and reconciliation engine that matches every remittance to a deal and produces the monthly commission run the CPA posts from; and an operating model that simulates staffing, call sources, program mix, attrition and cash month by month. The investor receives live access to all of it.</p>
<div class="sec">The Terms In Brief</div>
<table class="t sm" style="font-size:7.6pt">
<tr><th style="width:1.5in">Term</th><th>Summary</th></tr>
<tr><td>Securities</td><td>30% membership interest in Funding Tier LLC; investor may hold through an entity</td></tr>
<tr><td>Price and funding</td><td>$90,000, funded $30,000 per month over three months; 10% issued per tranche</td></tr>
<tr><td>Distributions</td><td>After operating costs, a six-month reserve and quarterly tax distributions: founder performance draw, then 100% to investor until $90,000 is returned, then 70 / 30</td></tr>
<tr><td>Buyback options</td><td>Founder may repurchase 10% at year 5 and 10% at year 10 at 3.0× trailing-twelve-month net profit less a 20% discount; options, not obligations</td></tr>
<tr><td>Governance</td><td>Founder is Manager; dual-signature list for major actions; both members sole signers on every account with dual control above $10,000</td></tr>
<tr><td>Back office</td><td>Investor's CPA and HR provider, at the investor's expense, working from the company's reconciliation and commission software</td></tr>
</table>
<div class="sec">Contents</div>
<ul class="toc">
<li><span>1 · Executive Summary</span><span>2</span></li><li><span>2 · The Company</span><span>3</span></li><li><span>3 · How Funding Tier Is Paid</span><span>4</span></li>
<li><span>4 · Operating Model And Unit Economics</span><span>5</span></li><li><span>5 · Financial Illustrations</span><span>6</span></li><li><span>6 · Use Of Funds And Capital Plan</span><span>7</span></li>
<li><span>7 · Investment Terms, Governance And Controls</span><span>8</span></li><li><span>8 · Risk Factors</span><span>9</span></li><li><span>9 · Closing Process And Signatures</span><span>10</span></li><li><span>Exhibit A · Term Sheet</span><span>separate</span></li>
</ul>''', doc,2,T))

P.append(page('Investment Proposal · 2','The Company',
'Funding Tier LLC owns the client-acquisition side of consumer debt relief: marketing, intake, qualification, program matching, sales and enrollment. Servicing partners run the back end, hold client funds and pay Funding Tier a share of each client payment.',
'''<div class="sec">Four Profit Centers From One Call</div>
<table class="t sm">
<tr><th style="width:1.35in">Program</th><th style="width:1.6in">Servicing partner</th><th>Fit</th><th>How Funding Tier is paid</th></tr>
<tr><td><b>Debt Settlement</b></td><td>Level Debt</td><td>Larger balances; client wants the lowest monthly; settlement-eligible states</td><td>8% of enrolled debt, once, when the first client payment clears (month 2)</td></tr>
<tr><td><b>Debt Validation</b></td><td>Shield Services</td><td>Disputable accounts; broad state coverage</td><td>Monthly perpetuity for 36 months (100% of the net payment for payments 1–4, then 35%), or a one-time file buyout after the first payment clears</td></tr>
<tr><td><b>Debt Resolution</b></td><td>Elite Legal Practice</td><td>Attorney-backed resolution; longer term, higher lifetime</td><td>Residual of 60% of the net draft monthly to 48 months, or an accelerated schedule (90% for seven months, then 25% to month 24)</td></tr>
<tr><td><b>Tax Resolution</b></td><td>Milestone Tax Solutions</td><td>Tax debt identified on the same call</td><td>50% of the Phase 1 investigation fee, then 40–60% of the Phase 2 resolution fee by volume tier, as client payments clear</td></tr>
</table>
<div class="sec">What Is Already Built And Paid For</div>
<div class="grid2">
<div class="card" style="--c:var(--teal)"><h3>Sales floor</h3><ul><li>Deal router: best-fit program per prospect with state rules and payout shown</li><li>State-aware call scripts and enrollment SOPs for every program</li><li>AI call-QC transcription scoring every enrollment call for risk before the first draft</li><li>Inbound AI receptionist with qualification rules and booking fallback</li></ul></div>
<div class="card" style="--c:var(--blue)"><h3>People</h3><ul><li>Recruiting pipeline: application → AI résumé screen → interview → NDA → training stages → cleared</li><li>State hiring map (W-2 vs 1099, overtime rules, exclusions) refreshed quarterly</li><li>Earnings simulator and My Deals &amp; Pay for every rep: expected pay date, grade, notes</li></ul></div>
<div class="card" style="--c:var(--purple)"><h3>Money</h3><ul><li>Reconciliation engine: every partner remittance matched to a deal</li><li>Commission run per rep, per deal: commission, bonuses, SPIFFs, NSF and cancellation clawbacks</li><li>Reserve and distribution waterfall computed, not estimated</li></ul></div>
<div class="card" style="--c:var(--amber)"><h3>Planning</h3><ul><li>Operating model: staffing, call sources, program mix, attrition, cash, month by month</li><li>Growth Plan screen: team, transfers / mail / social budgets, occupancy, hire and invest triggers</li><li>Campaign-level ROI tracking from call to paid deal in app.krestmarketing.com</li></ul></div>
</div>
<div class="sec">Operating Environment</div>
<p class="body">Debt relief marketing is regulated at federal and state level (telemarketing sales rules, state licensing and fee rules, prescreen credit rules for mail). Funding Tier's position is deliberately narrow: it is paid by partners, never by consumers; scripts carry the required disclosures; the router enforces state exclusions before a quote; prescreen mail runs through a lender-partner firm-offer structure; and attorney review precedes any new creative. Spreading enrollments across four programs and partners limits how much any single rule or partner change can affect revenue.</p>''', doc,3,T))

P.append(page('Investment Proposal · 3','How Funding Tier Is Paid',
'Revenue per deal depends on which program the file enrolls in, whether a faster-cash election is taken, and how long the client stays. The worked example below follows one $15,000 enrollment through each program, from the contract to the cash the company keeps after the rep is paid.',
f'''<div class="sec" style="margin-top:2px">Worked Example — One $15,000 Enrollment, Each Program (Safe Case)</div>
<div class="grid3">
<div class="card" style="--c:var(--teal);padding:9px 11px;background:#f4fbfa"><h3>Debt Settlement (LD)</h3><div class="wx">
<div class="r"><span>Payout: 8% × $15,000, once at month 2</span><b>$1,200</b></div>
<div class="r"><span>Files still paying at month 2</span><b>51%</b></div>
<div class="r"><span>Expected payout: $1,200 × 51%</span><b>$612</b></div>
<div class="r"><span>Rep, if US / owner-closed: 1.25% × 51%</span><b>−$96</b></div>
<div class="r tot"><span>Net, US / owner-closed</span><b>$516</b></div>
<div class="r tot"><span>Net, offshore-closed</span><b>$612</b></div>
</div><div class="note" style="font-size:7.1pt;margin-top:4px">Exposure ends after the client's 2nd payment.</div></div>
<div class="card" style="--c:var(--blue);padding:9px 11px;background:#f4f8fd"><h3>Debt Validation (SS)</h3><div class="wx">
<div class="r"><span>Payment $320 − $40 servicing</span><b>$280 / mo</b></div>
<div class="r"><span>Payments 1–4 at 100%: 4 × $280</span><b>$1,120</b></div>
<div class="r"><span>Payments 5–36 at 35%: 32 × $98</span><b>$3,136</b></div>
<div class="r"><span>Full payout if the client stays</span><b>$4,256</b></div>
<div class="r"><span>Expected: each payment × share paying</span><b>$739</b></div>
<div class="r"><span>Rep, if US / owner-closed: $275 × 51%</span><b>−$140</b></div>
<div class="r tot"><span>Net, US / owner-closed</span><b>$599</b></div>
<div class="r tot"><span>Net, offshore-closed</span><b>$739</b></div>
</div><div class="note" style="font-size:7.1pt;margin-top:4px">Or buyout: $280 × 65% × 6 = $1,092 once, after payment 1 clears.</div></div>
<div class="card" style="--c:var(--purple);padding:9px 11px;background:#f8f5fd"><h3>Debt Resolution (ELP)</h3><div class="wx">
<div class="r"><span>Client draft, 44 months</span><b>$251 / mo</b></div>
<div class="r"><span>Payments 1–2: 2 × ($251 − $4)</span><b>$494</b></div>
<div class="r"><span>Payments 3–44: 42 × 60% × $167</span><b>$4,209</b></div>
<div class="r"><span>Full payout if the client stays</span><b>$4,703</b></div>
<div class="r"><span>Expected: each payment × share paying</span><b>$564</b></div>
<div class="r"><span>Rep, if US / owner-closed: $275 × 51%</span><b>−$140</b></div>
<div class="r tot"><span>Net, US / owner-closed</span><b>$423</b></div>
<div class="r tot"><span>Net, offshore-closed</span><b>$564</b></div>
</div><div class="note" style="font-size:7.1pt;margin-top:4px">$167 = $251 − $80 maintenance − $4 processing. Or accelerated: 90% × 7 months, then 25% to month 24.</div></div>
</div>
<div class="callout" style="margin-top:8px;font-size:8.1pt;padding:7px 11px"><b>The survival weighting (safe case):</b> 60% of enrollments clear their first payment; of those, 15% cancel each month. So the share of files still paying is 60% in month 1, 51% in month 2, 43% in month 3, 37% in month 4, 10% by month 12 and about 1% by month 24. Every scheduled payout is multiplied by that share, which is why a $4,256 Validation payout books as $739. Rep commission and bonuses apply only to deals closed by the owner-operator or a US W-2 closer and carry the same weighting; offshore closers are paid by the hour, so their deals keep the full expected payout. <b>Blended at today's 33 / 40 / 27 mix, one $15,000 deal nets $524 when US-closed and $683 when offshore-closed.</b> At 6% monthly cancellation: $892 and $1,100.</div>
<div class="sec">Faster Cash Or Larger Value — The Election On Each File (Full Analysis: Business Plan, Section 8)</div>
<table class="t sm" style="font-size:7.6pt">
<tr><th>Debt Validation file</th><th class="num">Buyout, net of rep</th><th class="num">Perpetual, net @15%</th><th class="num">Perpetual, net @6%</th><th class="num">Break-even cancellation</th><th>Rule</th></tr>
<tr><td>$15,000 (buyout rate 65% × 6)</td><td class="num">$817</td><td class="num">$956</td><td class="num">$1,847</td><td class="num">18.2%</td><td>Hold the perpetual unless cancellation exceeds 18%</td></tr>
<tr><td>$25,000 (buyout rate 100% × 6)</td><td class="num">$1,880</td><td class="num">$1,271</td><td class="num">$2,480</td><td class="num">9.1%</td><td>Buy out above 9% cancellation; hold below it</td></tr>
<tr><td>Debt Resolution $15,000</td><td class="num">accelerated $490</td><td class="num">residual $664</td><td class="num">residual $1,570</td><td class="num">—</td><td>Residual always; accelerate only for cash</td></tr>
</table>
<div class="sec">Cost To Acquire One Deal, By Call Source — Against $524 (US-Closed) / $683 (Offshore-Closed)</div>
<table class="t sm" style="font-size:7.6pt">
<tr><th>Source</th><th class="num">Cost per deal</th><th>Verdict</th></tr>
<tr><td>Purchased live transfers ($11.60 blended per billed transfer, 15% close)</td><td class="num">$75</td><td><span class="tag h">Pays at any volume vendors supply</span></td></tr>
<tr><td>Direct mail + prescreen data (1.25% response, 70% qualified, 20% close, $25k files)</td><td class="num">$522</td><td><span class="tag m">Break-even on US-closed, positive on offshore-closed — the Tier 1 test must confirm the response rate</span></td></tr>
<tr><td>Paid social ($35 per lead, 30% to qualified call, 15% close)</td><td class="num">$778</td><td><span class="tag x">Retargeting of mailed ZIPs only, not stand-alone</span></td></tr>
</table>
''', doc,4,T))

P.append(page('Investment Proposal · 4','Operating Model And Unit Economics',
'Every number in this proposal is produced by the company\'s operating model, which the investor will use live. It simulates the roster, the calls each source produces, closer occupancy, program mix and election, attrition by cohort, every cost line, and cash month by month for 48 months.',
f'''<div class="sec">Assumptions In Force (Safe Case)</div>
<table class="t sm" style="font-size:7.6pt">
<tr><th style="width:1.7in">Assumption</th><th style="width:0.95in">Value</th><th>Basis</th><th style="width:1.05in">Sensitivity</th></tr>
<tr><td>First payment clears</td><td class="num" style="text-align:left">60%</td><td>Observed. Expected to rise with income / ability-to-pay qualification and AI call-QC on every enrollment call.</td><td><b>High</b></td></tr>
<tr><td>Monthly cancellation, active files</td><td class="num" style="text-align:left">15% / mo</td><td>Deliberately conservative placeholder; replaced by the measured rate from reconciliation data (active files this month ÷ last month).</td><td><b>Highest</b></td></tr>
<tr><td>Transfer close rate and price</td><td class="num" style="text-align:left">15% · $11.60</td><td>Current vendor performance at the buffer mix ($8 / $14 / $55 by buffer length). Vendors can supply well beyond the launch roster.</td><td>Medium</td></tr>
<tr><td>Deals per 8 closer hours; handle time</td><td class="num" style="text-align:left">1.25 · 65 min</td><td>Floor rule, checked against talk-time capacity.</td><td>Medium</td></tr>
<tr><td>Program mix</td><td class="num" style="text-align:left">33 / 40 / 27</td><td>Settlement / Validation / Resolution. Tax resolution excluded from all base figures (upside).</td><td>Low–medium</td></tr>
<tr><td>Labor and commission</td><td class="num" style="text-align:left">$18 · $7 · $5 / hr</td><td>US closer (W-2, California daily overtime) earns commission and bonuses; offshore closer and BPO opener are hourly only, no commission; owner-operator commission only. Each deal is charged one or the other.</td><td>High</td></tr>
<tr><td>Overhead</td><td class="num" style="text-align:left">Virtual</td><td>No rent; CRM, per-seat software, telecom, credit pulls, E&amp;O insurance (in place).</td><td>Low</td></tr>
<tr><td>Reserve</td><td class="num" style="text-align:left">6 months</td><td>Six months of overhead plus a chargeback buffer on trailing commission, held before distributions.</td><td>Timing only</td></tr>
</table>
<div class="sec">What Moves The Answer</div>
<table class="t sm">
<tr><th>Case (Option C, owner + 3 offshore closers)</th><th class="num">Net per $15k deal, US / offshore-closed</th><th class="num">Net profit / month, mature</th><th class="num">Bank at month 24</th><th class="num">Cash-positive month</th></tr>
<tr><td>60% first pay · 15% cancellation (base in this document)</td><td class="num">$524 / $683</td><td class="num">{M(C15['net'])}</td><td class="num">{M(C15['m24bank'])}</td><td class="num">{C15['cashPos']}</td></tr>
<tr><td>60% first pay · 6% cancellation</td><td class="num">$892 / $1,100</td><td class="num">{M(C6['net'])}</td><td class="num">{M(C6['m24bank'])}</td><td class="num">{C6['cashPos']}</td></tr>
</table>
<div class="sec">Decision Rules Built Into The Model</div>
<table class="t sm">
<tr><th style="width:1.3in">Decision</th><th>Trigger</th></tr>
<tr><td><b>Hire the next closer</b></td><td>Closer occupancy ≥ 90% for two consecutive months and bank balance ≥ reserve target + three months of the new seat's cost. New seats are filled with transfers before any new marketing.</td></tr>
<tr><td><b>Invest in growth marketing</b></td><td>Channel's measured cost per paid deal below net per deal after the rep, and bank ≥ reserve + two months of the next spend step. Tier 1 ($15k/mo) is a three-drop test with kill criteria; Tier 2 ($40k) follows a pass; Tier 3 ($90k) is an expansion event requiring both members.</td></tr>
<tr><td><b>Hold</b></td><td>Bank below the reserve target: no hire, no new marketing, no distributions. Validation files may be sold as buyouts to rebuild the reserve.</td></tr>
<tr><td><b>Pull back</b></td><td>First-pay clear below 50% for two months, or a channel above net per deal for two drops: pause, fix qualification, re-test.</td></tr>
</table>''', doc,5,T))

P.append(page('Investment Proposal · 5','Financial Illustrations',
'Six launch configurations on the safe case, then the recommended configuration month by month. Figures are the operating model\'s outputs on the stated assumptions; they are illustrations, not forecasts. "Mature month" is the average of months 43–48 of a 48-month run, when every cohort that can be stacked is stacked.',
f'''<div class="sec">Launch Configurations — Mature Month, Every Cost Paid (60% First Pay · 15% Cancellation · $90,000 Starting Cash)</div>
<table class="t sm" style="font-size:7.6pt">{thead}{''.join(srow(g(k,15),labels[k]) for k in 'ABCDEF')}</table>
<div class="sec">Options B, C And D At 6% Monthly Cancellation</div>
<table class="t sm" style="font-size:7.6pt">{thead}{''.join(srow(g(k,6),labels[k]) for k in 'BC')}</table>
<div class="grid2" style="margin-top:8px">
<div>
<div class="sec" style="margin-top:0">Recommended: Option C, Month By Month (Safe Case)</div>
<table class="t sm" style="font-size:7.4pt">
<tr><th>Mo</th><th class="num">Deals</th><th class="num">Revenue</th><th class="num">Net</th><th class="num">Bank</th><th class="num">Reserve target</th></tr>
{''.join(f"<tr><td>{m['mo']}</td><td class='num'>{N(m['deals'])}</td><td class='num'>{M(m['rev'])}</td><td class='num' style='color:{'var(--green)' if m['net']>0 else 'var(--red)'}'>{M(m['net'])}</td><td class='num'>{M(m['bank'])}</td><td class='num'>{M(m['res'])}</td></tr>" for m in C15['months'] if m['mo']<=8 or m['mo'] in (12,18,24))}
</table>
</div>
<div>
<div class="sec" style="margin-top:0">Reading The Numbers</div>
<p class="body">Revenue arrives behind the deals — Debt Settlement pays at month 2, Validation and Resolution build month over month — so the first two months are negative in every configuration. That gap, {M(C15['peak'])} at its deepest for Option C, is what the capital protects; the bank never falls below {M(C15['low'])}.</p>
<p class="body">Reserve target (six months of overhead plus chargeback buffer) is met in month {C15['reserveMet']}; the first hire trigger fires in month {C15['hire']}. The month-24 bank figure is before the distribution waterfall is applied.</p>
<p class="body">Three offshore closers (C) produce roughly twice the volume of one US closer (B), and their deals carry no commission or bonuses — only their hourly labor — which is why C's net is more than three times B's. An office (F) costs about {M(B15['net']-F15['net'])} a month of profit for the same output. Direct mail (D) adds deals but needs the Tier 1 test to prove its response rate before it earns a standing budget.</p>

</div></div>''', doc,6,T))

P.append(page('Investment Proposal · 6','Use Of Funds And Capital Plan',
'The operating model shows the business carrying itself on purchased transfers within months in every configuration. The capital is therefore not survival money: it funds the reserve, the hiring runway and the first measured marketing test, so growth is never gated by a single month\'s cash.',
f'''<div class="sec">Use Of Funds</div>
<table class="t sm">
<tr><th style="width:1.7in">Use</th><th class="num">Amount</th><th>Purpose</th></tr>
<tr><td>Operating reserve</td><td class="num">$40,000 – $50,000</td><td>Six months of overhead plus chargeback buffer, held from day one so the hire and marketing triggers can fire on schedule rather than waiting on retained earnings</td></tr>
<tr><td>Launch roster runway</td><td class="num">$20,000 – $25,000</td><td>Three to four months of labor and transfers for the launch roster through the revenue lag (months 1–3 negative in every configuration)</td></tr>
<tr><td>Direct-mail Tier 1 test</td><td class="num">$15,000</td><td>One month of a three-month, $15,000/month test (prescreen data, print and postage, tracking numbers, creative, attorney review), run only after the reserve is met; months 2–3 funded from operations</td></tr>
<tr><td>Legal, accounting, insurance</td><td class="num">$5,000 – $8,000</td><td>Membership Interest Purchase Agreement and Amended &amp; Restated Operating Agreement, partnership tax setup, cyber cover (E&amp;O already in place)</td></tr>
<tr><td>Contingency</td><td class="num">Balance</td><td>Unallocated; remains in the operating account under dual control</td></tr>
</table>
<div class="sec">Funding Schedule</div>
<div class="tl">
<div class="s" style="--c:var(--teal)"><div class="dt">Signing</div><div class="dot"></div><div class="ln"></div><div class="bx">Tranche 1 · $30,000<small>10% issued; operating account open with dual control</small></div></div>
<div class="s" style="--c:var(--blue)"><div class="dt">Month 2</div><div class="dot"></div><div class="ln"></div><div class="bx">Tranche 2 · $30,000<small>10% issued; launch roster on the phones</small></div></div>
<div class="s" style="--c:var(--purple)"><div class="dt">Month 3</div><div class="dot"></div><div class="bx">Tranche 3 · $30,000<small>10% issued; first full month-end close delivered</small></div></div>
</div>
<div class="sec">What The Capital Unlocks, In Order</div>
<table class="t sm">
<tr><th style="width:1.1in">Phase</th><th>Milestone</th><th style="width:2.1in">Gate</th></tr>
<tr><td><b>Months 1–3</b></td><td>Launch roster (owner-operator plus one US closer or three offshore closers), virtual, fed by transfers; measure close rate, first-pay clear and cost per deal by vendor</td><td>Closing complete; NDAs signed; account under dual control</td></tr>
<tr><td><b>Months 4–9</b></td><td>Reserve met; first additional closer; Tier 1 direct-mail test against kill criteria</td><td>Occupancy ≥ 90% two months; bank ≥ reserve + 3 × seat cost</td></tr>
<tr><td><b>Months 10–24</b></td><td>Repeat the hire cycle; Tier 2 marketing only after Tier 1 passes; investor payback from distributions once the reserve is held</td><td>Measured cost per paid deal below net per deal; bank ≥ reserve + 2 months of spend</td></tr>
<tr><td><b>Beyond</b></td><td>Tier 3 marketing, an office, or a back-end build</td><td>Expansion events — both members, separate budget, new capital pro rata</td></tr>
</table>
<div class="callout" style="margin-top:8px;font-size:8.4pt"><b>Discipline:</b> every dollar that leaves the account buys either a measured seat or a measured test. Nothing is spent on an assumption the CRM has not confirmed.</div>''', doc,7,T))

P.append(page('Investment Proposal · 7','Investment Terms, Governance And Controls',
'The full terms are set out in the Term Sheet (Exhibit A). This page summarises the economic terms and the controls that protect a minority investor in a founder-managed company.',
'''<div class="sec" style="margin-top:4px">Economic Terms</div>
<table class="t sm" style="font-size:7.6pt">
<tr><th style="width:1.5in">Term</th><th>Proposal</th></tr>
<tr><td>Securities and price</td><td>30% membership interest in Funding Tier LLC for $90,000; three $30,000 tranches, 10% issued per tranche; investor may hold through an investment entity</td></tr>
<tr><td>Distribution waterfall</td><td>1 Operating costs · 2 Reserve (six months of overhead plus chargeback buffer) · 3 Quarterly tax distributions to both members · 4 Founder performance draw · 5 Investor 100% until $90,000 returned · 6 Founder catch-up of any accrued draw · 7 70 / 30, plus founder performance bonus from distributable profit above $20,000 per month</td></tr>
<tr><td>Founder compensation</td><td>$10,000 monthly draw paid only in profitable months; $12,500 after three consecutive profitable months; 10% of distributable profit above $20,000 per month, quarterly, after investor payback; unpaid draw accrues and is caught up after payback</td></tr>
<tr><td>Buyback options</td><td>Founder may repurchase 10% at year 5 and 10% at year 10 at 3.0× trailing-twelve-month net profit (after founder pay, before distributions) less a 20% discount, cash at close, 12-month exercise windows; year-5 window may open from year 3 once the investor has received $180,000 in distributions; investor retains 10% permanently unless he elects to sell</td></tr>
</table>
<div class="note" style="margin-top:2px">Payback mechanism: at $5,000 / $10,000 / $20,000 of monthly distributable profit the investor is repaid by month 18 / 9 / 5 and holds $153,000 / $243,000 / $423,000 cumulative by year 5.</div>
<div class="sec">Governance</div>
<div class="grid3">
<div class="card" style="--c:var(--teal)"><h3>Management</h3><ul><li>Founder is Manager: sales floor, partners, product, compliance, rep hiring, marketing within budget, SPIFFs within budget</li><li>Investor is a member with full information rights, not an operator, unless both agree otherwise</li></ul></div>
<div class="card" style="--c:var(--amber)"><h3>Both members required</h3><ul><li>Debt over $25,000 or guarantees; new equity or investors; sale of company or IP</li><li>Change of program partners or commission-plan structure; hires above rep level; related-party payments</li><li>Expansion events; marketing beyond the 25% flex ceiling; opening any account</li></ul></div>
<div class="card" style="--c:var(--navy)"><h3>Money controls</h3><ul><li>Members are the only signers on every bank, merchant, card and lending account; dual control above $10,000</li><li>Payroll provider runs member-approved batches only; CPA view-only</li><li>Every account on a schedule to the operating agreement</li></ul></div>
</div>
<div class="sec">Information, Transfer And Confidentiality</div>
<table class="t sm" style="font-size:7.6pt">
<tr><td style="width:1.5in"><b>Information rights</b></td><td>Live access to the operating model, dashboards and bank; monthly P&amp;L by the 15th; quarterly review; annual K-1</td></tr>
<tr><td><b>Transfer rights</b></td><td>Pro rata on future raises; right of first refusal both ways; tag-along; investor first right to fund future capital on the same terms</td></tr>
<tr><td><b>Back office</b></td><td>Investor's CPA and HR provider at the investor's expense, under NDA, posting from the company's reconciliation and commission run; the 1099 commission-only rep model and state hiring map are respected</td></tr>
<tr><td><b>Confidentiality and IP</b></td><td>Mutual NDA now; all software, scripts, SOPs, pay engine, data, lists and creative are company property; obligations survive exit; platform and hosting licence held by the company</td></tr>
<tr><td><b>Exits and continuity</b></td><td>Buy-sell on death or disability at the buyback formula; key-person cover on the founder; deadlock tie-break; non-solicitation of reps, vendors and partners by either member</td></tr>
</table>''', doc,8,T))

P.append(page('Investment Proposal · 8','Risk Factors',
'An investment in Funding Tier carries risk, including the loss of the amount invested. The principal risks and the controls applied to each are set out below. This list is not exhaustive.',
'''<table class="t sm">
<tr><th style="width:1.55in">Risk</th><th>Description</th><th style="width:2.3in">Mitigation</th></tr>
<tr><td><b>Client retention</b></td><td>Most revenue is paid monthly as clients pay. If first-payment clear or monthly cancellation is worse than assumed, every deal is worth less and the payback period lengthens. The base case already assumes 15% monthly cancellation.</td><td>Ability-to-pay qualification; AI call-QC before the first draft; measured rates re-fitted quarterly; pull-back trigger at 50% first pay; buyouts available for cash</td></tr>
<tr><td><b>Partner concentration</b></td><td>Three debt partners and one tax partner set payout terms and may change them, change their programs or exit.</td><td>Four programs; partner changes require both members; reserve buffer; contracts and payout schedules versioned in the pay engine</td></tr>
<tr><td><b>Transfer vendor quality and supply</b></td><td>Purchased transfers are the cheapest call and the launch depends on them; quality varies by vendor.</td><td>Buffer mix tuned monthly; weekly disputes; at least two vendors; owned mail channel developed as the alternative</td></tr>
<tr><td><b>Regulatory and compliance</b></td><td>Telemarketing, state debt-relief and prescreen credit rules change; enforcement against deceptive selling is active.</td><td>Partner-paid model; scripted disclosures; state exclusions enforced in the router; attorney review of creative; lender-partner firm-offer structure for prescreen mail</td></tr>
<tr><td><b>Chargebacks and clawbacks</b></td><td>Cancellations inside a program's window reverse commission and, at partner level, revenue.</td><td>Netted in the monthly commission run; reserve buffer sized on trailing commission; buyout election ends exposure on a file</td></tr>
<tr><td><b>Key person</b></td><td>The founder built the systems and runs the floor.</td><td>Documented SOPs and software; recruiting and training pipeline; key-person cover; buy-sell terms</td></tr>
<tr><td><b>Cash timing</b></td><td>Residuals arrive over three to four years while costs are current; growth consumes cash before it returns it.</td><td>Six-month reserve rule; capital in tranches; hire and invest triggers gated on bank balance; buyouts as a cash valve</td></tr>
<tr><td><b>Labor and classification</b></td><td>W-2 closers in California carry daily overtime and classification exposure; offshore contractors carry continuity risk.</td><td>State hiring map; HR provider under the agreement; minimum team of three offshore; overtime modeled</td></tr>
<tr><td><b>Data and security</b></td><td>The company handles prospect financial information.</td><td>Data stays in the CRM and pay engine; no exports; vendor NDAs and processing terms; E&amp;O in place, cyber cover to be added</td></tr>
<tr><td><b>Model risk</b></td><td>Projections are outputs of a model on stated assumptions and will be wrong in some direction.</td><td>Assumptions disclosed; investor has live access; quarterly re-fit to measured data; decisions gated on measured KPIs, not projections</td></tr>
<tr><td><b>Illiquidity and minority position</b></td><td>No market for the interest; the founder manages day to day.</td><td>Dual-signature list; sole-signer and dual-control money rules; information rights; ROFR, tag-along and pro rata; formula buyback windows</td></tr>
</table>''', doc,9,T))

P.append(page('Investment Proposal · 9','Closing Process And Signatures',
'Acceptance of this proposal is an agreement to proceed to definitive documents on the terms in Exhibit A. Neither party is bound until those documents are signed.',
f'''<div class="sec">Closing Sequence</div>
<div class="tl">
<div class="s" style="--c:var(--teal)"><div class="dt">Now</div><div class="dot"></div><div class="ln"></div><div class="bx">Mutual NDA<small>Live operating-model walkthrough follows</small></div></div>
<div class="s" style="--c:var(--blue)"><div class="dt">Weeks 1–2</div><div class="dot"></div><div class="ln"></div><div class="bx">Counsel drafts<small>MIPA and Amended &amp; Restated Operating Agreement with exhibits</small></div></div>
<div class="s" style="--c:var(--amber)"><div class="dt">Weeks 2–3</div><div class="dot"></div><div class="ln"></div><div class="bx">CPA tax review<small>Partnership classification, EIN, state filing, tax-distribution rate</small></div></div>
<div class="s" style="--c:var(--navy)"><div class="dt">Signing</div><div class="dot"></div><div class="ln"></div><div class="bx">Close and fund<small>Account under dual control; tranche 1; 10% issued</small></div></div>
<div class="s" style="--c:var(--purple)"><div class="dt">Months 2–3</div><div class="dot"></div><div class="bx">Tranches 2–3<small>CPA and HR onboarded under NDA</small></div></div>
</div>
<div class="sec">Conditions To Closing</div>
<ul class="chk">
<li>Mutual NDA executed; counsel engaged for Funding Tier LLC</li>
<li>Membership Interest Purchase Agreement and Amended &amp; Restated Operating Agreement executed, with Exhibits C–F attached</li>
<li>CPA confirmation of partnership tax treatment, EIN and state filing; tax-distribution rate set</li>
<li>Operating account opened with both members as sole signers and dual control above $10,000; Accounts Schedule completed</li>
<li>Platform and hosting licence to the company executed; confidentiality agreements signed by CPA, HR provider and data vendors before access</li>
</ul>
<div class="sec">Points To Confirm Before Drafting</div>
<ul class="chk">
<li>Ownership held in Funding Tier LLC (no new entity); investor may hold through his own entity</li>
<li>Payback-first waterfall, quarterly tax distributions and founder compensation formula as set out on page 8</li>
<li>Investor's role as member with information rights and approvals, without operating duties</li>
<li>Remittance timing of the Debt Validation buyout and the Debt Resolution accelerated schedule, confirmed against partner contracts for the Compensation Schedule</li>
</ul>
<div class="sec">Exhibits</div>
<table class="t sm">
<tr><td style="width:0.9in"><b>Exhibit A</b></td><td>Term Sheet (separate document, non-binding)</td></tr>
<tr><td><b>Exhibit B</b></td><td>Business Plan — company, programs and payouts, operations, organization and compensation, unit economics, election strategy, marketing, financial plan, KPIs and roadmap</td></tr>
<tr><td><b>Exhibit C</b></td><td>Compensation Schedule — every rep commission, bonus, SPIFF and clawback component with its accounting treatment (from the versioned pay rules)</td></tr>
<tr><td><b>Exhibit D</b></td><td>Operating Playbook (internal; provided for information)</td></tr>
<tr><td><b>Exhibit E</b></td><td>Growth Marketing Budget Plan — tiers, staging, kill criteria, compliance</td></tr>
<tr><td><b>Exhibit F</b></td><td>Accounts Schedule — every bank, merchant, card and lending account; signers; dual-control threshold</td></tr>
</table>
<div class="sig"><div>Nathan Pottish · Manager, Funding Tier LLC · Date</div><div>Paul Dillenback · Date</div></div>
<div class="note">Signature indicates agreement to proceed to definitive documents on these terms and is not a binding commitment to invest or to issue interests.</div>''', doc,10,T))
open('/home/claude/ftdocs/investment-proposal.html','w').write(head('Funding Tier — Investment Proposal')+''.join(P)+'</body></html>')

# ═══════════════ TERM SHEET ═══════════════
doc='Term Sheet · Exhibit A'; T=3; Q=[]
Q.append(page('Exhibit A · Summary Of Proposed Terms','Term Sheet',
f'Non-binding summary of the principal terms of a proposed investment in Funding Tier LLC, a California limited liability company (the "Company"), by Paul Dillenback or an entity he controls (the "Investor"). Dated {DATE}. Except for Confidentiality and Expenses, nothing here is binding; the parties intend to enter into definitive agreements reflecting these terms.',
'''<table class="ts">
<tr><th>Issuer</th><td>Funding Tier LLC. The Company's software, program-partner agreements, domains, telephone numbers and accounts remain in the Company; no new entity is formed.</td></tr>
<tr><th>Investor</th><td>Paul Dillenback, directly or through an investment entity wholly owned by him.</td></tr>
<tr><th>Securities</th><td>Membership interests representing, in aggregate, thirty percent (30%) of all membership interests of the Company on a fully issued basis, with the founder, Nathan Pottish, holding seventy percent (70%).</td></tr>
<tr><th>Purchase price</th><td>Ninety thousand dollars ($90,000), payable in three equal tranches of $30,000: at closing, on the first day of the second month after closing, and on the first day of the third month after closing. Ten percent (10%) of the Company's membership interests are issued upon receipt of each tranche.</td></tr>
<tr><th>Use of proceeds</th><td>Operating reserve, launch-roster runway through the revenue lag, a direct-mail test program, legal and accounting costs of the transaction and insurance, as described in the Investment Proposal.</td></tr>
<tr><th>Distributions</th><td>Available cash is applied in the following order: (1) operating costs including rep commissions, bonuses and SPIFFs net of clawbacks and marketing within budget; (2) an operating reserve equal to six months of operating overhead plus a chargeback buffer sized on trailing-twelve-month commission paid; (3) quarterly tax distributions to each member equal to the member's allocated taxable income multiplied by an assumed combined rate set by the Company's accountant; (4) the Manager's performance draw (below); (5) one hundred percent (100%) of remaining distributions to the Investor until the Investor has received $90,000; (6) any accrued and unpaid Manager draw; (7) thereafter seventy percent (70%) to the founder and thirty percent (30%) to the Investor, with the Manager's performance bonus (below) paid quarterly from distributable profit above $20,000 per month.</td></tr>
<tr><th>Manager compensation</th><td>A monthly draw of $10,000, payable only in a month in which net profit after the draw is positive; increased to $12,500 per month after three consecutive profitable months; a performance bonus of ten percent (10%) of distributable profit in excess of $20,000 per month, paid quarterly, commencing after the Investor has received $90,000; unpaid draw accrues without interest and is paid under step (6) above.</td></tr>
<tr><th>Repurchase options</th><td>The founder has the option, but not the obligation, to repurchase from the Investor (a) ten percent (10%) of the Company's membership interests during a twelve-month window beginning on the fifth anniversary of closing and (b) a further ten percent (10%) during a twelve-month window beginning on the tenth anniversary, in each case for cash at closing of the repurchase. The window in (a) opens on the third anniversary if the Investor has by then received $180,000 in cumulative distributions. Repurchase price for each ten percent slice equals ten percent of Company value less a twenty percent (20%) discount, where Company value equals three (3.0) times trailing-twelve-month net profit after Manager compensation and before distributions, per the Company's books; no window opens until twelve profitable months exist. The Investor retains ten percent (10%) unless he elects to sell.</td></tr>
</table>''', doc,1,T))
Q.append(page('Exhibit A · Summary Of Proposed Terms','Term Sheet (Continued)','Management, approvals, rights and back-office arrangements.',
'''<table class="ts">
<tr><th>Management</th><td>The Company is manager-managed. Nathan Pottish is the Manager with authority over sales operations, program partners, product and software, compliance, rep hiring and compensation within the approved budget, marketing within the approved budget (with a twenty-five percent (25%) flex above the marketing line without a second approval), and vendor selection. The Investor is a member and is not required to perform operating duties.</td></tr>
<tr><th>Actions requiring both members</th><td>Incurring debt over $25,000 or any personal guarantee; issuing equity or admitting investors; sale of the Company or of material intellectual property; changing a program partner or the structure of the rep commission plan; hiring above rep level; related-party payments; expansion events (Tier 3 marketing at $90,000 per month or more, an office lease, or any back-end servicing build); marketing spend beyond the flex ceiling; opening any bank, merchant, card or lending account; amending the operating agreement.</td></tr>
<tr><th>Banking and spending controls</th><td>The two members are the only authorized signers on every Company account. Bank-enforced dual approval applies to transactions above $10,000. No cards, ACH credentials or wire authority are issued to any other person. The payroll provider executes only batches approved by a member and holds no standing debit authority. The accountant has view-only access. All accounts are listed on an Accounts Schedule to the operating agreement.</td></tr>
<tr><th>Information rights</th><td>Continuous access for the Investor to the Company's operating model, dashboards, reconciliation and commission software, and bank accounts (view); monthly profit and loss by the fifteenth of the following month; quarterly review meeting; annual Schedule K-1 and tax return.</td></tr>
<tr><th>Transfer restrictions</th><td>No transfer of membership interests without a right of first refusal in favor of the other member. Tag-along rights for the Investor on any sale by the founder. Pre-emptive (pro rata) rights for both members on any new issuance; the Investor has the first right to fund future capital needs on the same terms as offered to third parties.</td></tr>
<tr><th>Back-office services</th><td>The Investor will cause his accounting and human-resources providers to serve the Company at the Investor's expense. The Company's reconciliation and commission software is the computation of record for revenue recognition, commission payable, bonuses, SPIFFs, clawbacks and distribution allocation; the accountant posts from its monthly run and does not independently determine eligibility. The HR provider will respect the Company's independent-contractor, commission-only enrollment-rep model and its state-by-state hiring rules. Providers sign the Company's confidentiality agreement before access.</td></tr>
<tr><th>Expansion events and future capital</th><td>Expansion events require both members, a separate budget, and new capital contributed pro rata or raised from third parties subject to the pre-emptive and ROFR rights above. A move into back-end servicing is treated as a separate financing.</td></tr>
</table>''', doc,2,T))
Q.append(page('Exhibit A · Summary Of Proposed Terms','Term Sheet (Continued)','Continuity, confidentiality, conditions and acknowledgement.',
f'''<table class="ts">
<tr><th>Death, disability and deadlock</th><td>On the death or permanent disability of a member, the other member (or the Company) may purchase the affected interest at the repurchase formula above. The Company will maintain key-person insurance on the Manager. A deadlock on a both-member action is resolved by a mediation step followed by the status quo (no action) unless the operating agreement specifies otherwise.</td></tr>
<tr><th>Non-solicitation</th><td>During membership and for twelve months after, neither member will solicit the Company's enrollment reps, vendors or program partners for a competing enterprise.</td></tr>
<tr><th>Confidentiality and intellectual property (binding)</th><td>Each party keeps the other's confidential information, including this Term Sheet and the Investment Proposal, confidential, and uses it only to evaluate and complete the transaction. All software, scripts, standard operating procedures, the pay engine, data, lists and creative used in the business are and remain the Company's property; neither member may use or disclose them outside the Company; these obligations survive withdrawal, repurchase or dissolution. The Company holds a written licence to its platform and hosting arrangements.</td></tr>
<tr><th>Tax matters</th><td>Admission of the Investor converts the Company to partnership tax classification (Form 1065 and Schedules K-1). The Company's accountant will confirm the employer identification number, update state filings to list both members, and set the assumed rate for tax distributions.</td></tr>
<tr><th>Conditions to closing</th><td>Execution of a Membership Interest Purchase Agreement and an Amended and Restated Operating Agreement reflecting these terms, with the Business Plan, Compensation Schedule, Accounts Schedule and Confidentiality / IP exhibits attached; completion of the accountant's tax review; opening of the operating account with dual control; execution of the platform and hosting licence; confidentiality agreements signed by the accounting and HR providers.</td></tr>
<tr><th>Expenses (binding)</th><td>Each party bears its own expenses. The Company's legal costs for the definitive documents are a Company expense and may be paid from the first tranche.</td></tr>
<tr><th>Governing law</th><td>California.</td></tr>
<tr><th>Non-binding effect; expiration</th><td>Except for Confidentiality and Intellectual Property and Expenses, this Term Sheet is a non-binding expression of intent and creates no obligation to complete the transaction. It expires if definitive agreements are not executed within sixty (60) days of the date above, unless extended in writing.</td></tr>
</table>
<div class="sec">Acknowledged And Agreed To Proceed</div>
<div class="sig"><div>Funding Tier LLC · by Nathan Pottish, Manager · Date</div><div>Paul Dillenback · Date</div></div>
<div class="note">Prepared from the parties' discussions of November 12–20, 2026. Subject to review by counsel for each party.</div>''', doc,3,T))
open('/home/claude/ftdocs/term-sheet.html','w').write(head('Funding Tier — Term Sheet')+''.join(Q)+'</body></html>')
print('ok')
