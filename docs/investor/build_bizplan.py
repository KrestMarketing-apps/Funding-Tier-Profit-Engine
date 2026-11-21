import json
S='/tmp/claude-0/-home-claude/c485d32b-5082-557b-96a4-114f513b0d74/scratchpad/'
exec(open('build_formal.py').read().split("# ═══════════════ INVESTMENT PROPOSAL")[0])  # reuse css, helpers, scenarios
cv=json.load(open('/tmp/claude-0/-home-claude/c485d32b-5082-557b-96a4-114f513b0d74/scratchpad/curves.json'))
def gl(label,c,bo=None): return next(o for o in sc if o['label'].startswith(label) and o['c']==c and o.get('buyout')==bo)
B15,C15,D15,E15,F15,A15=[gl(k+'.',15) for k in 'BCDEFA']; B6,C6,D6,A6=[gl(k+'.',6) for k in 'BCDA']
elC={bo:{c:next(o for o in sc if o['label'].startswith('C.') and o['c']==c and o.get('buyout')==bo) for c in (15,6)} for bo in (0,50,100)}

def chart(debt, w=440, h=215):
    d=cv[str(debt)]; buy=d['buyout']; maxy=max(d['curves']['0'][36], buy*1.15)
    padl,padb,padt,padr=46,22,10,8
    X=lambda m: padl+(w-padl-padr)*m/36; Y=lambda v: padt+(h-padt-padb)*(1-v/maxy)
    def path(arr,color,dash=''):
        pts=' '.join(f"{X(i):.1f},{Y(v):.1f}" for i,v in enumerate(arr)); return f'<polyline points="{pts}" fill="none" stroke="{color}" stroke-width="2" {dash}/>'
    g=''
    for t in range(0,5):
        v=maxy*t/4; g+=f'<line x1="{padl}" x2="{w-padr}" y1="{Y(v):.1f}" y2="{Y(v):.1f}" stroke="#e6edf0"/><text x="{padl-4}" y="{Y(v)+3:.1f}" font-size="8" text-anchor="end" fill="#6b7a80" font-family="Inconsolata">${int(v):,}</text>'
    for m in (0,6,12,18,24,30,36): g+=f'<text x="{X(m):.1f}" y="{h-8}" font-size="8" text-anchor="middle" fill="#6b7a80">{m}</text>'
    g+=f'<line x1="{padl}" x2="{w-padr}" y1="{Y(buy):.1f}" y2="{Y(buy):.1f}" stroke="#b45309" stroke-width="2" stroke-dasharray="5,3"/><text x="{w-padr-2}" y="{Y(buy)-4:.1f}" font-size="8.5" text-anchor="end" fill="#b45309" font-weight="700">Buyout ${buy:,} once</text>'
    g+=path(d['curves']['0'],'#0f766e')+path(d['curves']['6'],'#1a6ed8')+path(d['curves']['15'],'#b91c1c')
    for c,col in (('0','#0f766e'),('6','#1a6ed8'),('15','#b91c1c')):
        cr=d['cross'][c]
        if cr: g+=f'<circle cx="{X(cr):.1f}" cy="{Y(buy):.1f}" r="3.2" fill="{col}"/><text x="{X(cr):.1f}" y="{Y(buy)+11:.1f}" font-size="8.5" text-anchor="middle" fill="{col}" font-weight="700">m{cr}</text>'
    return f'<svg viewBox="0 0 {w} {h}" width="100%" style="display:block">{g}</svg>'

doc='Business Plan'; T=12; P=[]
P.append(cover('Business Plan','How Funding Tier acquires, qualifies and enrolls debt-relief clients, how it is paid, how it is staffed and controlled, and what the operating model says about profitability at each stage of growth.',
 [('Prepared for','Paul Dillenback — Investment Package, Exhibit B'),('Prepared by','Nathan Pottish, Manager · Funding Tier LLC'),('Date',DATE),('Version','1.0'),('Companion documents','Investment Proposal · Term Sheet (Exhibit A) · Operating Playbook (Exhibit D) · Growth Marketing Budget Plan (Exhibit E)')], doc))

P.append(page('Business Plan · 1','Executive Summary',
'Funding Tier LLC is a front-end enrollment company in consumer debt relief. It generates and qualifies calls, matches each caller to the best-fit program, enrolls them, and is paid by the servicing partner as the client pays. It never holds client money and never charges the consumer.',
f'''<div class="kv">
<div><div class="k">Business</div><div class="v" style="font-size:11pt">Enrollment front end</div><div class="d">Four programs, four servicing partners, one call</div></div>
<div><div class="k">Revenue model</div><div class="v" style="font-size:11pt">Partner payouts</div><div class="d">Per enrolled file, as the client pays</div></div>
<div><div class="k">Recommended launch, mature month</div><div class="v g">{M(C15['net'])}</div><div class="d">net profit after every cost, safe case</div></div>
<div><div class="k">Capital at risk</div><div class="v g">{M(90000-C15['low'])}</div><div class="d">deepest draw on $90,000</div></div>
</div>
<div class="sec">The Model In One Paragraph</div>
<p class="body">A caller reaches a closer — by purchased live transfer today, by direct mail and paid social once those are proven. The closer qualifies for ability to pay, pulls soft credit, and the deal router picks the program the caller fits: Debt Settlement (Level Debt), Debt Validation (Shield Services), Debt Resolution (Elite Legal Practice), with Tax Resolution (Milestone) available on the same call. The partner services the client and pays Funding Tier a contractual share of each client payment — once for settlement, monthly for validation and resolution — unless Funding Tier elects a one-time buyout on a file. Because payouts follow client payments, revenue arrives behind enrollment and compounds as monthly cohorts stack into a book.</p>
<div class="sec">What Decides Profitability</div>
<table class="t sm">
<tr><th style="width:1.6in">Driver</th><th>Why it matters</th><th style="width:1.5in">Where it is managed</th></tr>
<tr><td><b>Retention</b> (first-pay clear, monthly cancellation)</td><td>Every payout is multiplied by the share of files still paying. The same file is worth two to three times more at 6% monthly cancellation than at 15%.</td><td>Qualification rules, AI call-QC, measured monthly</td></tr>
<tr><td><b>Who closes the deal</b></td><td>Only US W-2 closers earn commission and bonuses. The owner-operator is paid through the members' distribution agreement; offshore and BPO closers are paid by the hour only. Each deal is charged one labor cost, never two.</td><td>Compensation plan, roster</td></tr>
<tr><td><b>Election on each file</b> (buyout vs perpetual)</td><td>The buyout pays once and ends exposure; the perpetual pays more if the client stays. Which is worth more depends on cancellation; which to take depends on the reserve.</td><td>Election rule, monthly</td></tr>
<tr><td><b>Cost per deal by call source</b></td><td>Transfers cost ~$75 per deal; owned channels must prove they beat what a deal pays before they earn a budget.</td><td>Campaign tracking, Tier 1 test</td></tr>
<tr><td><b>Occupancy</b></td><td>Calls nobody can take are wasted spend; idle seats are wasted labor. Marketing is sized to the roster.</td><td>Growth Plan, daily</td></tr>
</table>
<div class="sec">Contents</div>
<ul class="toc">
<li><span>1 · Executive Summary</span><span>2</span></li><li><span>2 · The Company</span><span>3</span></li><li><span>3 · Programs, Partners And Payouts</span><span>4</span></li>
<li><span>4 · Customers, Market And Compliance</span><span>5</span></li><li><span>5 · Operations</span><span>6</span></li><li><span>6 · Organization And Compensation</span><span>7</span></li>
<li><span>7 · Revenue Model And Unit Economics</span><span>8</span></li><li><span>8 · Election Strategy: Buyout Or Perpetual</span><span>9</span></li><li><span>9 · Marketing Plan</span><span>10</span></li>
<li><span>10 · Financial Plan</span><span>11</span></li><li><span>11 · KPIs, Controls, Risks And Roadmap</span><span>12</span></li>
</ul>''', doc,2,T))

P.append(page('Business Plan · 2','The Company',
'Funding Tier LLC is a California limited liability company founded and managed by Nathan Pottish. It owns the client-acquisition side of consumer debt relief and the software that runs it.',
'''<div class="grid2">
<div>
<div class="sec" style="margin-top:0">Legal And Structure</div>
<table class="t sm">
<tr><td style="width:1.3in"><b>Entity</b></td><td>Funding Tier LLC (California); manager-managed; Nathan Pottish, Manager</td></tr>
<tr><td><b>Ownership</b></td><td>Founder 100% today; 70 / 30 after the proposed investment</td></tr>
<tr><td><b>What the LLC holds</b></td><td>Program-partner agreements, software and IP, domains, telephone numbers, CRM sub-account, bank and merchant accounts, licences</td></tr>
<tr><td><b>Insurance</b></td><td>Errors and omissions in place; cyber cover to be added at closing</td></tr>
<tr><td><b>Operating mode</b></td><td>Virtual; no office lease. Offshore closers under contractor agreements; US closers W-2</td></tr>
</table>
<div class="sec">Mission</div>
<p class="body">Put every qualified caller into the program that actually fits them, enroll only clients who can pay, and be paid for the outcome rather than the sale. The business wins when clients stay — which is why qualification and call quality are funded before growth marketing.</p>
<div class="sec">Position In The Value Chain</div>
<p class="body">Funding Tier is the front end: marketing, intake, qualification, program matching, sales and enrollment. Servicing partners run the programs, hold client funds, negotiate or validate, and remit Funding Tier's share. This keeps Funding Tier out of fund-handling and the licensing that comes with it, and lets it sell four programs from one conversation. A move into back-end servicing is possible later and is defined as an expansion event requiring both members and separate capital.</p>
</div>
<div>
<div class="sec" style="margin-top:0">What Is Built And Owned</div>
<div class="card" style="--c:var(--teal);margin-bottom:8px"><h3>Sales floor</h3><ul><li>Deal router: best-fit program per prospect with state rules and payout shown</li><li>State-aware call scripts and enrollment SOPs for every program</li><li>AI call-QC transcription scoring every enrollment call for risk before the first draft</li><li>Inbound AI receptionist with qualification rules and booking fallback</li></ul></div>
<div class="card" style="--c:var(--blue);margin-bottom:8px"><h3>People</h3><ul><li>Recruiting pipeline: application → AI résumé screen → interview → NDA → training → cleared</li><li>State hiring map (W-2 vs 1099, overtime, exclusions), refreshed quarterly</li><li>Earnings simulator and My Deals &amp; Pay for every rep</li></ul></div>
<div class="card" style="--c:var(--purple);margin-bottom:8px"><h3>Money</h3><ul><li>Reconciliation engine: every partner remittance matched to a deal</li><li>Commission run per rep, per deal: commission, bonuses, SPIFFs, NSF and cancellation clawbacks, expected pay dates</li><li>Reserve and distribution waterfall computed, not estimated</li></ul></div>
<div class="card" style="--c:var(--amber)"><h3>Planning</h3><ul><li>Operating model: staffing, call sources, program mix, election, attrition, cash, month by month for 48 months</li><li>Growth Plan screen with hire and invest triggers; Election Planner</li><li>Campaign-level ROI tracking from call to paid deal in app.krestmarketing.com</li></ul></div>
</div></div>''', doc,3,T))

P.append(page('Business Plan · 3','Programs, Partners And Payouts',
'Four programs from one call. Each has its own fit, its own payout schedule and its own risk window. "Payout" means what the partner remits to Funding Tier for a file; the rep is paid out of it only when a commission-eligible closer closed the deal.',
'''<table class="t sm">
<tr><th style="width:1.2in">Program</th><th style="width:1.25in">Partner</th><th>Who fits</th><th>Payout to Funding Tier</th><th style="width:1.35in">Risk window</th></tr>
<tr><td><b>Debt Settlement (LD)</b></td><td>Level Debt</td><td>Larger unsecured balances; client wants the lowest monthly payment; settlement-eligible states</td><td>8% of enrolled debt, once, when the first client payment clears (month 2)</td><td>Ends after the client's 2nd payment</td></tr>
<tr><td><b>Debt Validation (SS)</b></td><td>Shield Services</td><td>Disputable accounts; broad state coverage; fastest enrollment</td><td><b>Perpetual:</b> 100% of (monthly payment − $40 servicing) for payments 1–4, then 35% through month 36. Payment is banded by debt ($320 at $15k, $420 at $25k). <b>Buyout:</b> one lump sum after the first payment clears — (payment − $40) × 65% × 6, or × 100% × 6 on $20k+ debt</td><td>Perpetual: month by month. Buyout: ends at the single payment</td></tr>
<tr><td><b>Debt Resolution (ELP)</b></td><td>Elite Legal Practice</td><td>Attorney-backed resolution; longer term; higher lifetime payout</td><td><b>Residual:</b> payments 1–2 pass through less $4; from payment 3, 60% of (draft − $80 maintenance − $4) monthly for the term written — 48 months standard, up to 60 months when it helps win the file. The $250 minimum client draft always applies, so the term is capped at what the fee can carry (44 months at $15k; 60 available from about $20,300 of debt). <b>Accelerated:</b> 90% of net for months 1–7, then 25% to month 24</td><td>Residual: month by month. Accelerated: most value in months 1–7</td></tr>
<tr><td><b>Tax Resolution</b></td><td>Milestone Tax Solutions</td><td>Tax debt identified on the same call; sold as a Phase 1 investigation then Phase 2 resolution</td><td>50% of the Phase 1 investigation fee ($500 standard, up to $1,500); 40 / 50 / 60% of the Phase 2 resolution fee by monthly volume tier (~$5,000 average case), paid on each client payment as it clears; rate locked at funding</td><td>~15-day refund window; then as payments clear</td></tr>
</table>
<div class="sec">Payout Timing, Illustrated — $15,000 Debt Validation File</div>
<div class="grid2">
<table class="t sm">
<tr><th>Month</th><th class="num">Client pays</th><th class="num">Perpetual payout</th><th class="num">Buyout payout</th></tr>
<tr><td>1</td><td class="num">$320</td><td class="num">$280</td><td class="num">$1,092 (once)</td></tr>
<tr><td>2</td><td class="num">$320</td><td class="num">$280</td><td class="num">—</td></tr>
<tr><td>3</td><td class="num">$320</td><td class="num">$280</td><td class="num">—</td></tr>
<tr><td>4</td><td class="num">$320</td><td class="num">$280</td><td class="num">—</td></tr>
<tr><td>5 – 36</td><td class="num">$320</td><td class="num">$98 each</td><td class="num">—</td></tr>
<tr><td><b>Full payout if the client stays</b></td><td></td><td class="num"><b>$4,256</b></td><td class="num"><b>$1,092</b></td></tr>
</table>
<div>
<div class="callout" style="font-size:8.4pt"><b>How the election works.</b> The election is made per file. The buyout converts a 36-month stream into one payment and ends chargeback exposure on that file; the perpetual keeps the stream and the risk. Section 8 shows how many months the perpetual needs to pass the buyout at each cancellation rate, and what the whole plan looks like at 100% perpetual, 50 / 50 and 100% buyout.</div>
<div class="callout" style="font-size:8.4pt;margin-top:8px"><b>Remittance.</b> Partners remit in arrears (by the 15th of the following month). The reconciliation engine matches every remittance line to its deal, flags NSFs and cancellations, and sets each deal's expected pay date — which is what the rep sees and what the CPA posts.</div>
</div></div>''', doc,4,T))

P.append(page('Business Plan · 4','Customers, Market And Compliance',
'The customer is a US household with meaningful unsecured debt, current income, and a payment they can sustain. The market is large and permanently replenished; the constraint is not demand but finding, qualifying and keeping the right clients inside the rules.',
'''<div class="grid2">
<div>
<div class="sec" style="margin-top:0">Who We Enroll</div>
<table class="t sm">
<tr><td style="width:1.3in"><b>Debt</b></td><td>Unsecured (cards, personal loans, medical) above the program floor; $14k–$17k typical on transfers, $25k targeted by prescreen mail</td></tr>
<tr><td><b>Ability to pay</b></td><td>Stated employment and income; a monthly payment the client can show they can make. No file without it</td></tr>
<tr><td><b>Exclusions</b></td><td>Active bankruptcy; unexplained NSF pattern; states excluded for the program quoted</td></tr>
<tr><td><b>Fit</b></td><td>The router picks the program from debt size, account types, state and the client's priority (lowest payment, speed, legal backing)</td></tr>
</table>
<div class="sec">Where Clients Come From</div>
<table class="t sm">
<tr><th>Source</th><th>Today</th><th>Next</th></tr>
<tr><td>Purchased live transfers</td><td>Primary; vendors can supply well beyond the launch roster at $8 / $14 / $55 per billed transfer by buffer length</td><td>Second vendor; weekly dispute discipline</td></tr>
<tr><td>Direct mail + prescreen credit data</td><td>Not yet</td><td>Tier 1 test after the reserve is met; lender-partner firm-offer structure; $25k+ households</td></tr>
<tr><td>Paid social</td><td>Not yet</td><td>Retargeting of mailed ZIPs only</td></tr>
<tr><td>Inbound (website, AI receptionist)</td><td>Live</td><td>Grows with brand and mail</td></tr>
</table>
</div>
<div>
<div class="sec" style="margin-top:0">Market Context</div>
<p class="body">Revolving consumer credit in the United States runs in the trillions of dollars, and a persistent share of households carry balances they cannot retire on their own. Debt relief programs — settlement, validation, attorney-led resolution — are an established category with national servicing partners, which is why a focused front end can exist without building servicing itself. The category is also competitive and regulated, so the durable advantages are qualification quality, retention, cost per deal and compliance discipline rather than volume alone.</p>
<div class="sec">Compliance Environment</div>
<table class="t sm">
<tr><th style="width:1.25in">Rule area</th><th>What it requires</th><th>How Funding Tier operates</th></tr>
<tr><td>Telemarketing sales rules</td><td>No advance fees from consumers; required disclosures; no outcome promises</td><td>Paid by partners, never by consumers; scripted disclosures; TSR-compliant close</td></tr>
<tr><td>State debt-relief laws</td><td>Licensing, fee caps and program limits vary by state</td><td>Router enforces state exclusions before a quote; state hiring map for reps</td></tr>
<tr><td>Prescreen credit data (FCRA)</td><td>Lists require a firm offer of credit; opt-outs honored</td><td>Lender-partner makes the loan offer; declines route to debt programs; attorney review of creative</td></tr>
<tr><td>Consent and do-not-call</td><td>Written consent for marketing calls and texts; opt-outs honored</td><td>Transfer vendors hold consent records; coached or suspicious transfers disputed</td></tr>
<tr><td>Tax relief marketing</td><td>No implied government ties, no fear tactics</td><td>Licensed partner investigates and prices every case before resolution is sold</td></tr>
<tr><td>Data protection</td><td>Prospect financial information is sensitive</td><td>Stays in the CRM and pay engine; no exports; vendor NDAs and processing terms; E&amp;O in place</td></tr>
</table>
</div></div>''', doc,5,T))

P.append(page('Business Plan · 5','Operations',
'A call becomes a paid file through five steps, each with a system behind it and a number attached. Nothing in the chain depends on memory or a spreadsheet.',
'''<div class="wf">
<div class="n" style="--c:var(--teal)"><div class="k">1</div><div class="t">Call arrives</div><div class="d">Transfer, mail or social inbound, website or AI receptionist; source and campaign stamped on the contact in app.krestmarketing.com.</div></div><div class="a">›</div>
<div class="n" style="--c:var(--blue)"><div class="k">2</div><div class="t">Qualify</div><div class="d">Ability to pay, debt profile, state; soft credit pull; router picks the program and shows the payout.</div></div><div class="a">›</div>
<div class="n" style="--c:var(--amber)"><div class="k">3</div><div class="t">Enroll</div><div class="d">Program SOP and script; agreement and first-draft date set; opportunity created with the campaign code.</div></div><div class="a">›</div>
<div class="n" style="--c:var(--purple)"><div class="k">4</div><div class="t">QC and first draft</div><div class="d">AI call-QC scores the recording; flags reviewed before the draft; first payment clears → file counts.</div></div><div class="a">›</div>
<div class="n" style="--c:var(--navy)"><div class="k">5</div><div class="t">Reconcile and pay</div><div class="d">Partner remittance matched to the deal; election applied; commission run; expected pay date on My Deals &amp; Pay.</div></div>
</div>
<div class="grid2" style="margin-top:10px">
<div>
<div class="sec" style="margin-top:0">The Sales Floor</div>
<table class="t sm">
<tr><td style="width:1.3in"><b>Hours and handle time</b></td><td>Closers on an 8-hour shift; 65-minute average handle time; 1.25 deals per 8 closer hours as the planning floor</td></tr>
<tr><td><b>Occupancy</b></td><td>Target 90–100% with zero unanswered inbound; transfers are bought to fill seats, marketing is sized to seats</td></tr>
<tr><td><b>Scripts and SOPs</b></td><td>One per program, state-aware, with required disclosures; AI Genie post-enrollment quality call on validation</td></tr>
<tr><td><b>Call QC</b></td><td>Every enrollment call transcribed and scored; pressure, confusion or inability to pay goes to review before the first draft</td></tr>
<tr><td><b>Vendor management</b></td><td>Buffer mix tuned monthly to close rate by buffer; coached or suspicious warm transfers tagged and disputed weekly</td></tr>
</table>
</div>
<div>
<div class="sec" style="margin-top:0">Systems</div>
<table class="t sm">
<tr><td style="width:1.3in"><b>CRM</b></td><td>app.krestmarketing.com: contacts, pipelines, recruiting, workflows, call tracking, campaign attribution</td></tr>
<tr><td><b>Agent toolkit</b></td><td>ai.fundingtier.com: deal router, scripts, enrollment SOPs, earnings simulator, My Deals &amp; Pay, state hiring map</td></tr>
<tr><td><b>Pay and reconciliation engine</b></td><td>Remittance matching, commission run, clawbacks, expected pay dates, reserve and waterfall</td></tr>
<tr><td><b>Operating model</b></td><td>Growth Plan, Scale Planner, Election Planner; 48-month simulation; live for both members</td></tr>
<tr><td><b>Telephony and dialer</b></td><td>DIDs and tracking numbers per campaign; recordings feed call-QC</td></tr>
</table>
<div class="sec">Monthly Close</div>
<p class="body">Days 1–5 reconcile remittances to deals; days 5–8 commission run; days 8–10 member approval of payroll and commission batch; days 10–15 CPA posts the P&amp;L, bank vs reserve and K-1 estimate; day 15 the hire / invest / hold decision is minuted.</p>
</div></div>''', doc,6,T))

P.append(page('Business Plan · 6','Organization And Compensation',
'Three kinds of closer, three kinds of pay. US W-2 closers earn hourly pay plus commission and bonuses; offshore and BPO staff are paid by the hour only; the owner-operator takes no wage and no commission and is paid through the members\' distribution agreement. The model charges each deal one labor cost — never two.',
'''<div class="sec">Who Is Paid What</div>
<table class="t sm">
<tr><th style="width:1.45in">Role</th><th style="width:0.95in">Basis</th><th>Pay</th><th>Commission on deals closed</th><th>Bonuses / SPIFFs</th></tr>
<tr><td><b>Owner-operator / partner</b></td><td>Member</td><td>No wage; performance draw and distributions per the members' distribution agreement</td><td><b>No</b> — paid through distributions, not per deal</td><td><b>No</b></td></tr>
<tr><td><b>US-based closer</b></td><td>W-2 hourly, California daily overtime</td><td>$18 / hour (hourly + commission) or a draw recovered from commission</td><td><b>Yes</b> — contract schedule (LD % of debt by tier; SS / ELP flat by band)</td><td><b>Yes</b> — daily deal, monthly volume, balanced book, Level Debt enrollment</td></tr>
<tr><td><b>Offshore closer (Egypt)</b></td><td>Hourly contractor, team of three or more</td><td>$7 / hour planning rate; no overtime</td><td><b>No</b></td><td><b>No</b></td></tr>
<tr><td><b>BPO opener</b></td><td>Hourly contractor</td><td>$5 / hour; generates transfers at the opener rate instead of buying them</td><td><b>No</b></td><td><b>No</b></td></tr>
<tr><td><b>Team lead / director (future)</b></td><td>W-2 or 1099 per state map</td><td>Draw against a percentage of enrolled debt; override on the team's deals</td><td>Override per the override policy</td><td>Per plan</td></tr>
</table>
<div class="note">Rep commission is paid only when the partner pays Funding Tier (in arrears) and only on files whose first payment clears; an NSF never counts; a cancellation inside the chargeback window reverses. Every component is defined on the versioned pay rules page and computed per rep, per deal, with an expected pay date.</div>
<div class="grid2" style="margin-top:8px">
<div>
<div class="sec" style="margin-top:0">What One Seat Costs And Produces (Safe Case)</div>
<table class="t sm">
<tr><th>Seat</th><th class="num">Labor / mo</th><th class="num">Deals / mo</th><th class="num">Rep cost on its deals</th><th class="num">Net added / mo</th></tr>
<tr><td>US closer (W-2, $18/hr)</td><td class="num">$2,929</td><td class="num">~24</td><td class="num">~$3,400</td><td class="num">~$6,500</td></tr>
<tr><td>Offshore closer ($7/hr)</td><td class="num">$1,365</td><td class="num">~27</td><td class="num">$0</td><td class="num">~$13,200</td></tr>
<tr><td>Owner-operator</td><td class="num">$0</td><td class="num">~27</td><td class="num">$0</td><td class="num">~$14,000</td></tr>
</table>
<div class="note">Figures are the operating model's marginal effect of one seat at the safe case, fed by transfers. Offshore and owner-closed deals carry no commission; the offshore trade-off is coverage, QA and continuity, which is why offshore closers run as a team of three or more. The owner's share comes out through the distribution waterfall, not per deal.</div>
</div>
<div>
<div class="sec" style="margin-top:0">Roles And Rhythm</div>
<table class="t sm">
<tr><td style="width:1.1in"><b>Manager</b></td><td>Sales floor, partners, product and software, compliance, rep hiring, marketing within budget, SPIFFs within budget; runs the monthly close</td></tr>
<tr><td><b>Member (investor)</b></td><td>Information rights, co-signer, second signature on the dual-signature list; brings CPA and HR</td></tr>
<tr><td><b>CPA</b></td><td>Posts from the commission run; 1065 / K-1s; payroll tax; tax distributions</td></tr>
<tr><td><b>HR / payroll</b></td><td>W-2 onboarding and payroll; contractor agreements; respects the 1099 rep model and state map</td></tr>
</table>
<div class="sec">Hiring Ladder</div>
<p class="body">Launch with the owner-operator (closing, paid through distributions) plus either one US closer or three offshore closers. Add a closer when occupancy holds at or above 90% for two consecutive months and the bank covers the reserve plus three months of the new seat. Every new seat is filled with transfers before any new marketing is bought.</p>
</div></div>''', doc,7,T))

P.append(page('Business Plan · 7','Revenue Model And Unit Economics',
'One $15,000 enrollment followed through each program, from the partner\'s payout schedule to the cash Funding Tier keeps. Two bottom lines: the deal closed by a US W-2 closer (commission applies), and the same deal closed by the owner-operator or an hourly offshore closer (no commission).',
f'''<div class="sec" style="margin-top:2px">Worked Example — One $15,000 Enrollment (60% First Pay · 15% Monthly Cancellation)</div>
<div class="grid3">
<div class="card" style="--c:var(--teal);padding:9px 11px;background:#f4fbfa"><h3>Debt Settlement (LD)</h3><div class="wx">
<div class="r"><span>Payout: 8% × $15,000, once at month 2</span><b>$1,200</b></div>
<div class="r"><span>Files still paying at month 2</span><b>51%</b></div>
<div class="r"><span>Expected payout: $1,200 × 51%</span><b>$612</b></div>
<div class="r"><span>Rep, if US W-2 closed: 1.25% × $15,000 × 51%</span><b>−$96</b></div>
<div class="r tot"><span>Net, US W-2 closed</span><b>$516</b></div>
<div class="r tot"><span>Net, owner- or offshore-closed</span><b>$612</b></div>
</div></div>
<div class="card" style="--c:var(--blue);padding:9px 11px;background:#f4f8fd"><h3>Debt Validation (SS), perpetual</h3><div class="wx">
<div class="r"><span>Payment $320 − $40 servicing</span><b>$280 / mo</b></div>
<div class="r"><span>Payments 1–4 at 100% · 5–36 at 35%</span><b>$1,120 + $3,136</b></div>
<div class="r"><span>Full payout if the client stays</span><b>$4,256</b></div>
<div class="r"><span>Expected: each payment × share paying</span><b>$739</b></div>
<div class="r"><span>Rep, if US W-2 closed: $275 × 51%</span><b>−$140</b></div>
<div class="r tot"><span>Net, US W-2 closed</span><b>$599</b></div>
<div class="r tot"><span>Net, owner- or offshore-closed</span><b>$739</b></div>
</div></div>
<div class="card" style="--c:var(--purple);padding:9px 11px;background:#f8f5fd"><h3>Debt Resolution (ELP), residual</h3><div class="wx">
<div class="r"><span>Client draft, 44 months</span><b>$251 / mo</b></div>
<div class="r"><span>Payments 1–2: 2 × $247 · 3–44: 42 × $100</span><b>$494 + $4,209</b></div>
<div class="r"><span>Full payout if the client stays</span><b>$4,703</b></div>
<div class="r"><span>Expected: each payment × share paying</span><b>$564</b></div>
<div class="r"><span>Rep, if US W-2 closed: $275 × 51%</span><b>−$140</b></div>
<div class="r tot"><span>Net, US W-2 closed</span><b>$423</b></div>
<div class="r tot"><span>Net, owner- or offshore-closed</span><b>$564</b></div>
</div></div>
</div>
<div class="callout" style="margin-top:8px;font-size:8.1pt;padding:7px 11px"><b>The survival weighting:</b> 60% of enrollments clear their first payment; of those, 15% cancel each month. Files still paying: 60% in month 1, 51% in month 2, 43% in month 3, 37% in month 4, 10% by month 12, about 1% by month 24. Every scheduled payout is multiplied by that share. <b>Blended at the 33 / 40 / 27 mix, a $15,000 deal nets $524 when a US W-2 closer closes it and $683 when the owner or an offshore closer does.</b> At 6% monthly cancellation: $892 and $1,100.</div>
<div class="sec">Cost To Acquire One Deal, By Call Source</div>
<table class="t sm" style="font-size:7.6pt">
<tr><th>Source</th><th class="num">Cost per deal</th><th>Against $524 (US W-2 closed) / $683 (owner- or offshore-closed)</th></tr>
<tr><td>Purchased live transfers ($11.60 blended per billed transfer, 15% close)</td><td class="num">$75</td><td><span class="tag h">Pays at any volume vendors supply</span></td></tr>
<tr><td>Direct mail + prescreen data (1.25% response, 70% qualified, 20% close, $25k files)</td><td class="num">$522</td><td><span class="tag m">Break-even on US W-2 closed deals; positive on owner- or offshore-closed — the Tier 1 test must confirm the response rate</span></td></tr>
<tr><td>Paid social ($35 per lead, 30% to qualified call, 15% close)</td><td class="num">$778</td><td><span class="tag x">Retargeting of mailed ZIPs only</span></td></tr>
</table>''', doc,8,T))

cr15=cv['15000']['cross']; cr25=cv['25000']['cross']
P.append(page('Business Plan · 8','Election Strategy: Buyout Or Perpetual',
'The perpetual pays more if the client stays; the buyout pays once and ends the risk. The chart shows the cumulative perpetual payout on one Debt Validation file against the buyout lump, at three cancellation rates, and the month the perpetual passes it.',
f'''<div class="grid2">
<div><div class="sec" style="margin-top:0">$15,000 File — Buyout ${cv['15000']['buyout']:,} (65% × 6)</div>{chart(15000)}
<div class="note" style="font-size:7.4pt">Perpetual passes the buyout in month {cr15['0']} if no one cancels, month {cr15['6']} at 6% monthly cancellation, month {cr15['15']} at 15%. By month 36: $4,256 / ${cv['15000']['curves']['6'][36]:,} / ${cv['15000']['curves']['15'][36]:,}.</div></div>
<div><div class="sec" style="margin-top:0">$25,000 File — Buyout ${cv['25000']['buyout']:,} (100% × 6)</div>{chart(25000)}
<div class="note" style="font-size:7.4pt">Perpetual passes the buyout in month {cr25['0']} if no one cancels, month {cr25['6']} at 6% — and never at 10% or above. By month 36: ${cv['25000']['curves']['0'][36]:,} / ${cv['25000']['curves']['6'][36]:,} / ${cv['25000']['curves']['15'][36]:,}.</div></div>
</div>
<div style="display:flex;gap:14px;font-size:7.6pt;color:var(--mut);margin-top:4px"><span><i style="display:inline-block;width:14px;height:2px;background:#0f766e;vertical-align:middle;margin-right:4px"></i>No cancellation</span><span><i style="display:inline-block;width:14px;height:2px;background:#1a6ed8;vertical-align:middle;margin-right:4px"></i>6% / month</span><span><i style="display:inline-block;width:14px;height:2px;background:#b91c1c;vertical-align:middle;margin-right:4px"></i>15% / month</span><span><i style="display:inline-block;width:14px;height:2px;border-top:2px dashed #b45309;vertical-align:middle;margin-right:4px"></i>Buyout, paid once after the first payment clears</span></div>
<div class="sec">The Whole Plan Three Ways — Option C (Owner + 3 Offshore Closers), Every Cost Paid</div>
<table class="t sm" style="font-size:7.6pt">
<tr><th>Election on Debt Validation files</th><th class="num">Net / mo mature @15%</th><th class="num">Year-1 net @15%</th><th class="num">Cash+ mo</th><th class="num">Net / mo mature @6%</th><th class="num">Year-1 net @6%</th><th>Pros</th><th>Cons</th></tr>
<tr><td><b>100% perpetual</b></td><td class="num">{M(elC[0][15]['net'])}</td><td class="num">{M(elC[0][15]['y1'])}</td><td class="num">{elC[0][15]['cashPos']}</td><td class="num">{M(elC[0][6]['net'])}</td><td class="num">{M(elC[0][6]['y1'])}</td><td>Highest lifetime value and run-rate; the book compounds</td><td>Slowest cash; month-by-month cancellation and chargeback exposure until files age</td></tr>
<tr><td><b>50 / 50</b></td><td class="num">{M(elC[50][15]['net'])}</td><td class="num">{M(elC[50][15]['y1'])}</td><td class="num">{elC[50][15]['cashPos']}</td><td class="num">{M(elC[50][6]['net'])}</td><td class="num">{M(elC[50][6]['y1'])}</td><td>Half the book, half the liquidity; hedges a retention surprise either way</td><td>Neither the best cash nor the best value</td></tr>
<tr><td><b>100% buyout</b></td><td class="num">{M(elC[100][15]['net'])}</td><td class="num">{M(elC[100][15]['y1'])}</td><td class="num">{elC[100][15]['cashPos']}</td><td class="num">{M(elC[100][6]['net'])}</td><td class="num">{M(elC[100][6]['y1'])}</td><td>Fastest cash; no chargeback tail; simplest accounting</td><td>Gives up the residual book; lowest mature run-rate; worst choice if retention is good</td></tr>
</table>
<div class="sec">The Rule We Apply, Monthly</div>
<table class="t sm" style="font-size:7.7pt">
<tr><th style="width:1.7in">Condition</th><th>Election</th></tr>
<tr><td>Measured cancellation on $20k+ files below 9.1%</td><td>Hold the perpetual on $20k+ files; above 9.1%, buy out (the 100% buyout rate makes the lump hard to beat)</td></tr>
<tr><td>Measured cancellation on under-$20k files below 18.2%</td><td>Hold the perpetual on under-$20k files; above 18.2%, buy out</td></tr>
<tr><td>Bank balance below the reserve target</td><td>Sell the number of files the Election Planner shows, highest band first (largest lump, smallest value given up), until the reserve is met</td></tr>
<tr><td>Cancellation within ±3 points of break-even</td><td>Split the band 50 / 50 so neither a better nor a worse retention outcome hurts</td></tr>
<tr><td>Debt Resolution (ELP)</td><td>Residual by default; accelerated only when the reserve needs cash — it costs about $175 of expected payout per $15k file</td></tr>
</table>''', doc,9,T))

P.append(page('Business Plan · 9','Marketing Plan',
'Three ways to put a qualified caller in front of a closer. Transfers are the cheapest and are bought to fill seats; direct mail and paid social are owned channels that earn a standing budget only after a measured test beats what a deal pays.',
'''<div class="grid3">
<div class="card" style="--c:var(--teal)"><h3>Purchased transfers</h3><ul><li>Primary source; ~$75 per paid deal at today's close rate</li><li>Buffer mix ($8 / $14 / $55 by length) tuned monthly to close rate by buffer</li><li>Every billed transfer credit-pulled and logged; disputes weekly; two vendors minimum</li><li>Vendors can supply well beyond the launch roster — supply is not the constraint</li></ul></div>
<div class="card" style="--c:var(--blue)"><h3>Direct mail + prescreen data</h3><ul><li>Bureau-reseller lists (Altair CreditReady, CRS LeadsIQ, Deluxe): high revolving utilization, $20k+ unsecured, no bankruptcy</li><li>Firm-offer-of-credit structure through the lender partner; declines route to debt programs; attorney review of creative</li><li>$0.80 all-in per piece; tracking number per drop; two creatives per test</li><li>Planning: 1.25% response · 70% qualified · 20% close · $25k debt</li></ul></div>
<div class="card" style="--c:var(--purple)"><h3>Paid social</h3><ul><li>Retargets mailed ZIPs only; brand familiarity drives the lower cost per lead</li><li>UTM on every ad → landing page → contact in app.krestmarketing.com</li><li>Planning: $35 CPL · 30% qualified · 15% close; stand-alone it does not pay</li></ul></div>
</div>
<div class="sec">Budget Tiers (Monthly) And Staging</div>
<table class="t sm">
<tr><th>Line</th><th class="num">Tier 1 — Test</th><th class="num">Tier 2 — Growth</th><th class="num">Tier 3 — Scale</th><th>Gate</th></tr>
<tr><td>Direct mail pieces · all-in</td><td class="num">10,000 · $8,000</td><td class="num">30,000 · $22,500</td><td class="num">75,000 · $52,500</td><td rowspan="5" style="vertical-align:top">Tier 1: reserve met, seats full, QC and attorney review done.<br/>Tier 2: Tier 1 passed; bank ≥ reserve + two months of Tier 2.<br/>Tier 3: expansion event — both members; reserve covers two months of the higher spend.</td></tr>
<tr><td>Prescreen data</td><td class="num">$1,500</td><td class="num">$3,000</td><td class="num">$6,000</td></tr>
<tr><td>Paid social</td><td class="num">$4,000</td><td class="num">$12,000</td><td class="num">$27,000</td></tr>
<tr><td>Creative, landing pages, tracking, compliance review</td><td class="num">$1,500</td><td class="num">$2,500</td><td class="num">$4,500</td></tr>
<tr><td><b>Total added marketing</b></td><td class="num"><b>$15,000</b></td><td class="num"><b>$40,000</b></td><td class="num"><b>$90,000</b></td></tr>
<tr><td>Closers hired to answer the calls</td><td class="num">+1</td><td class="num">+2</td><td class="num">+5</td><td>Marketing is never bought without the seats to take the calls</td></tr>
</table>
<div class="sec">The Tier 1 Test, And How ROI Is Measured</div>
<div class="grid2">
<p class="body">Three monthly drops of 10,000 pieces, two list segments, two creatives. Every inbound call carries the drop's tracking number, so the contact, the opportunity and the paid deal all inherit the campaign code. <b>Pass:</b> cost per paid deal below what a deal pays after the rep (≈ $524 on US-closed, $683 on offshore-closed) and average debt above $20,000. <b>Kill:</b> two drops above it. After month 3 the measured response, qualified share and close rate replace the planning assumptions in the operating model, and the winning segment goes to Tier 2 only if the pass held.</p>
<div class="wf" style="margin-top:0">
<div class="n" style="--c:var(--teal)"><div class="k">1</div><div class="t">Spend logged</div><div class="d">Per drop or ad set, with campaign code.</div></div><div class="a">›</div>
<div class="n" style="--c:var(--blue)"><div class="k">2</div><div class="t">Call attributed</div><div class="d">Tracking number or UTM stamps the contact.</div></div><div class="a">›</div>
<div class="n" style="--c:var(--purple)"><div class="k">3</div><div class="t">Deal paid</div><div class="d">Pay engine ties the remittance to the code.</div></div><div class="a">›</div>
<div class="n" style="--c:var(--navy)"><div class="k">4</div><div class="t">ROI ledger</div><div class="d">Spend, calls, deals, paid, revenue, cost per paid deal — per campaign.</div></div>
</div>
</div>''', doc,10,T))

P.append(page('Business Plan · 10','Financial Plan',
'Outputs of the operating model on the safe case — 60% first-pay clear, 15% monthly cancellation, transfers at $11.60 blended, virtual operation, $90,000 starting cash — then the recommended configuration month by month and the same plan at 6% cancellation. Illustrations, not forecasts.',
f'''<div class="sec">Launch Configurations — Mature Month, Every Cost Paid</div>
<table class="t sm" style="font-size:7.6pt">{thead}{''.join(srow(gl(k+'.',15),labels[k]) for k in 'ABCDEF')}</table>
<div class="note" style="font-size:7.4pt;margin-top:2px">Rep commission and bonuses apply only to deals closed by US W-2 closers; the owner-operator is paid through distributions and offshore closers' deals carry hourly labor only. "Lowest bank" is the deepest the $90,000 goes.</div>
<div class="grid2" style="margin-top:6px">
<div>
<div class="sec" style="margin-top:0">Option C Month By Month (Safe Case)</div>
<table class="t sm" style="font-size:7.4pt">
<tr><th>Mo</th><th class="num">Deals</th><th class="num">Revenue</th><th class="num">Net</th><th class="num">Bank</th><th class="num">Reserve target</th></tr>
{''.join(f"<tr><td>{m['mo']}</td><td class='num'>{N(m['deals'])}</td><td class='num'>{M(m['rev'])}</td><td class='num' style='color:{'var(--green)' if m['net']>0 else 'var(--red)'}'>{M(m['net'])}</td><td class='num'>{M(m['bank'])}</td><td class='num'>{M(m['res'])}</td></tr>" for m in C15['months'] if m['mo']<=8 or m['mo'] in (12,18,24))}
</table>
</div>
<div>
<div class="sec" style="margin-top:0">Options B And C At 6% Cancellation</div>
<table class="t sm" style="font-size:7.4pt">
<tr><th>Option</th><th class="num">Net / mo</th><th class="num">Year-1 net</th><th class="num">Bank mo 24</th></tr>
<tr><td>B · Owner + 1 US closer</td><td class="num">{M(B6['net'])}</td><td class="num">{M(B6['y1'])}</td><td class="num">{M(B6['m24bank'])}</td></tr>
<tr><td>C · Owner + 3 offshore closers</td><td class="num">{M(C6['net'])}</td><td class="num">{M(C6['y1'])}</td><td class="num">{M(C6['m24bank'])}</td></tr>
</table>
<div class="sec">Reading The Numbers</div>
<p class="body">Revenue arrives behind the deals, so the first two months are negative in every configuration; for Option C the cash position bottoms at {M(C15['low'])} and cumulative cash is positive from month {C15['cashPos']}. The reserve target is met in month {C15['reserveMet']} and the first hire trigger fires in month {C15['hire']}.</p>
<p class="body">Three offshore closers (C) produce roughly twice the volume of one US closer (B) and their deals carry no commission, which is why C's net is well over twice B's. An office (F) costs about {M(B15['net']-F15['net'])} a month for the same output. Mail (D) adds deals but needs the Tier 1 test before it earns a standing budget. Tax resolution is excluded from every figure here.</p>
<p class="body">Month-24 bank figures are before the distribution waterfall (reserve → tax distributions → founder draw → investor payback → 70 / 30).</p>
</div></div>''', doc,11,T))

P.append(page('Business Plan · 11','KPIs, Controls, Risks And Roadmap',
'The numbers we watch, the rules money follows, the risks we manage, and the sequence growth takes. Each KPI is measurable in the CRM or the pay engine; each decision has a trigger rather than a judgment call.',
'''<div class="grid2">
<div>
<div class="sec" style="margin-top:0">KPIs And Targets</div>
<table class="t sm" style="font-size:7.6pt">
<tr><th>KPI</th><th class="num">Floor</th><th class="num">Target</th></tr>
<tr><td>First payment clears</td><td class="num">55%</td><td class="num">60% → 70%</td></tr>
<tr><td>Monthly cancellation, active files</td><td class="num">10%</td><td class="num">≤ 6%</td></tr>
<tr><td>Transfer close rate</td><td class="num">12%</td><td class="num">15%+</td></tr>
<tr><td>Deals per 8 closer hours</td><td class="num">1.0</td><td class="num">1.25+</td></tr>
<tr><td>Closer occupancy</td><td class="num">80%</td><td class="num">90–100%, zero unanswered</td></tr>
<tr><td>Cost per paid deal, owned channels</td><td class="num">= net per deal</td><td class="num">&lt; $450</td></tr>
<tr><td>Bank vs reserve target</td><td class="num">Never below zero</td><td class="num">Reserve met before expansion</td></tr>
</table>
<div class="sec">Decision Triggers</div>
<table class="t sm" style="font-size:7.6pt">
<tr><td style="width:1.1in"><b>Hire a closer</b></td><td>Occupancy ≥ 90% two months running and bank ≥ reserve + 3 × seat cost</td></tr>
<tr><td><b>Invest in marketing</b></td><td>Measured cost per paid deal below net per deal and bank ≥ reserve + 2 × next spend step</td></tr>
<tr><td><b>Hold</b></td><td>Bank below reserve: no hire, no new marketing, no distributions; buyouts rebuild the reserve</td></tr>
<tr><td><b>Pull back</b></td><td>First-pay below 50% two months, or a channel above net per deal two drops</td></tr>
</table>
<div class="sec">Money Controls</div>
<p class="body">Members are the only signers; dual control above $10,000; payroll runs member-approved batches only; CPA view-only; every account on a schedule. Waterfall: operating costs → six-month reserve → quarterly tax distributions → founder performance draw → investor payback → founder catch-up → 70 / 30.</p>
</div>
<div>
<div class="sec" style="margin-top:0">Principal Risks</div>
<table class="t sm" style="font-size:7.6pt">
<tr><th>Risk</th><th>Control</th></tr>
<tr><td>Retention below plan</td><td>Qualification, call-QC, quarterly re-fit, pull-back trigger, buyouts for cash</td></tr>
<tr><td>Partner change or chargeback</td><td>Four programs; partner changes need both members; reserve buffer</td></tr>
<tr><td>Transfer quality</td><td>Buffer mix, weekly disputes, two vendors, mail as the owned alternative</td></tr>
<tr><td>Compliance</td><td>Partner-paid model, scripted disclosures, state exclusions in the router, attorney review, firm-offer mail</td></tr>
<tr><td>Key person</td><td>Documented SOPs and software; recruiting pipeline; key-person cover; buy-sell terms</td></tr>
<tr><td>Cash timing</td><td>Reserve rule, tranches, triggers gated on bank, buyouts as a cash valve</td></tr>
<tr><td>Offshore continuity</td><td>Team of three or more; contractor agreements; US closer as the anchor</td></tr>
</table>
<div class="sec">Roadmap</div>
<table class="t sm" style="font-size:7.6pt">
<tr><th style="width:0.85in">Rung</th><th>Enter when</th><th>What changes</th></tr>
<tr><td><b>0 · Launch</b></td><td>Closing; tranche 1</td><td>Owner + 1 US closer or + 3 offshore; transfers; virtual</td></tr>
<tr><td><b>1 · Full seats</b></td><td>Hire trigger</td><td>One more closer, filled with transfers first</td></tr>
<tr><td><b>2 · Tier 1 mail</b></td><td>Reserve met</td><td>$15k / month test, three drops, kill criteria</td></tr>
<tr><td><b>3 · Tier 2</b></td><td>Tier 1 passed</td><td>$40k / month; +2 closers; overtime on drop weeks</td></tr>
<tr><td><b>4 · Tier 3 / office</b></td><td>Expansion event</td><td>$90k / month; +5 closers; office only if justified</td></tr>
<tr><td><b>5 · Back end</b></td><td>Expansion event</td><td>Servicing in-house; second financing</td></tr>
</table>
</div></div>''', doc,12,T))
open('/home/claude/ftdocs/business-plan.html','w').write(head('Funding Tier — Business Plan')+''.join(P)+'</body></html>')
print('ok')
