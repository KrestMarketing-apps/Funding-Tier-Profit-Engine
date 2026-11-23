import json
from pkg_common import *
from states import sorted_states, EMPLOYER_COSTS
DE = json.load(open(HERE + '/deal-economics.json'))
S1S, S1T, S2S, S2T = sc('S1', 'SAFE'), sc('S1', 'TARGET'), sc('S2', 'SAFE'), sc('S2', 'TARGET')
S1P, S2P = sc('S1', 'POSSIBLE'), sc('S2', 'POSSIBLE')
R0S, R1S = sc('R0', 'SAFE'), sc('R1', 'SAFE')
SH = DE['shield']; ELP = DE['elp']
cpdS = SLIDE['cases']['SAFE']['costPerDeal']; cpdT = SLIDE['cases']['TARGET']['costPerDeal']
doc = 'Business Plan · Exhibit B'; T = 21; P = []
seat1, seat2 = S1S['seatCost'], S2S['seatCost']; res = S1S['months'][5]['res']

P.append(cover('Business Plan', 'Exhibit B — How Funding Tier works, what the market looks like, who does what, how every file is paid, and what the numbers say on safe assumptions.',
 [('Prepared for', 'Paul Dillenback'), ('Prepared by', 'Nathan Pottish, Manager'), ('Date', DATE), ('Version', '2.0 — market assessment, SWOT, state hiring data, four launch scenarios'), ('Model of record', 'ai.fundingtier.com → Operating Model → Growth Plan'), ('Companion documents', 'Investment Proposal · Term Sheet (A) · Compensation Schedule (C) · Playbook (D)')]))

# 1 Exec summary
P.append(page('Business Plan · 1', 'Executive Summary And Mission',
 'Funding Tier is a front-end enrollment company for consumer debt relief. It finds people who need help, qualifies them for ability to pay, enrolls them in the right program, and is paid by the servicing partner as the client pays.',
 '<div class="callout" style="font-size:9pt"><b>Mission — a win for everybody.</b> The client gets a program they can afford and understand. The closer is paid fairly and on time. The servicing partner receives a qualified file that stays. The owners build a company that grows into a full front and back end with proper marketing and proper capital — on a system that already runs the business today.</div>' +
 kv([('Mature month, safe case', M(S1S['net']), 'owner + 3 Egypt closers, after every cost', 'g'), ('Year-1 net, safe case', M(S1S['y1']), f'cash-positive month {S1S["cashPos"]}; reserve met month {S1S["reserveMet"]}', 'g'), ('Mature month, target case', M(S1T['net']), '16% close · 70% first pay · 10% cancel', 'g'), ('Capital at risk', M(90000 - S1S['low']), f'deepest draw on $90,000 (lowest bank {M(S1S["low"])})')]) +
 '<div class="cols c3">' +
 '<div>' + st('Business Model') + ul(['Four programs from one call: settlement, validation, resolution, tax', 'Partner-paid; Funding Tier never holds client funds', 'Revenue arrives 1–2 months after enrollment and compounds as monthly cohorts stack', 'Fixed cost stays low: virtual, offshore closers, software already built'], 'b sm') + '</div>' +
 '<div>' + st('Launch Plan') + ul(['Owner + 3 Egypt closers at $12 / hour (CallBlade, referred by Shield Services)', 'Live transfers at $14 per call, 2-minute buffer, fill every seat', 'At least 85% Shield Services for the first 90 days, 80% of them as buyouts — cash from month 2, then the standing mix', 'Mail and social added after the reserve is met, capped at 50% of volume'], 'b sm') + '</div>' +
 '<div>' + st('What Decides The Outcome') + ul(['<b>Close rate</b> (15% safe, 16% target)', '<b>First-payment rate</b> (60% safe, 70% target)', '<b>Monthly cancellation</b> on perpetual files (15% safe, 10% target)', 'Each is measured weekly and the model re-run with actuals'], 'b sm') + '</div></div>' +
 st('Contents') + '<ul class="toc">' + ''.join(f'<li><span>{t}</span><span>{n}</span></li>' for t, n in [
   ('1 Executive Summary And Mission', 2), ('2 The Company And Its System', 3), ('3 Programs, Partners And Payouts', 4), ('4 Market Assessment', 5), ('5 SWOT', 6), ('6 Customers And Compliance', 7), ('7 Operations', 8),
   ('8 Organization And Compensation', 9), ('9 Hiring US Closers — State By State', '10–11'), ('10 Revenue Model And Unit Economics', 12), ('11 Election Strategy: Buyout Or Perpetual', 13), ('12 Marketing Plan', 14), ('13 Financial Plan — Four Scenarios', 15), ('13 Month By Month Tables', '16–17'),
   ('14 Retention Through Service', 18), ('15 KPIs, Controls And Roadmap', 19), ('16 Glossary And FAQ', 20), ('17 Sources', 21)]) + '</ul>', doc, 2, T))

# 2 Company & system
P.append(page('Business Plan · 2', 'The Company And Its System',
 'Funding Tier LLC is a California limited liability company founded and run by Nathan Pottish. Its operating system is custom-built and already in production.',
 '<div class="cols c2">' +
 '<div>' + st('ai.fundingtier.com — The Operating System') + ul([
   '<b>Deal router:</b> debt size, account types, state and the client\'s priority pick the program and show the payout on screen',
   '<b>Scripts and SOPs</b> for every program, state-aware, with required disclosures',
   '<b>Training</b> library and certification; <b>hiring</b> pipeline with AI résumé screening and the state hiring map',
   '<b>My Deals &amp; Pay:</b> each closer sees every file and its expected pay date',
   '<b>Pay and reconciliation engine:</b> matches partner remittances to deals, applies clawbacks, produces the commission run',
   '<b>Operating Model:</b> Growth Plan, Scale Planner, Election Planner — the source of every number in this plan',
   '<b>AI call-QC:</b> every enrollment call transcribed and scored before the first draft'], 'b sm') + '</div>' +
 '<div>' + st('app.krestmarketing.com — The Sub-Account It Is Tied To') + ul([
   'Contacts, pipelines, workflows, call tracking and campaign attribution for every lead source',
   'Marketing and communications: dialer, SMS, ringless voicemail, email, social posting',
   'Universal do-not-call management and litigator scrubbing on every list and campaign',
   'Automations that push each prospect\'s general information to the backend partner, which then enrolls the client',
   'Recruiting pipeline for closers, BPOs and vendors'], 'b sm') +
 st('Data Engines Already Wired') + ul([
   '<b>TransUnion credit-data purchase gateway</b> — prescreened lists for mail-piece marketing at $25,000+ of revolving debt',
   '<b>Array</b> — integration available, not yet built: pings a credit report for a pass / fail on a range or specific credit parameters (not a full pull); can reduce the credit-pull costs charged by the backend providers; 12-month service order from November 1, 2026: the greater of usage or a minimum of $0 through February 2027, $500 March–April, $750 May–July, $1,000 from August — budgeted as overhead; per transaction when live: credit report + score $1.70–$1.80, authentication $0.30, Offers Engine $0.55–$0.65'], 'b sm') + '</div></div>' +
 st('How The Pieces Fit') +
 '<div class="wf">' + ''.join(f'<div class="nd" style="--c:{c}"><div class="k">{k}</div><div class="t">{t}</div><div class="d">{d}</div></div>' + ('<div class="a">›</div>' if i < 4 else '') for i, (k, t, d, c) in enumerate([
   ('Source', 'Calls arrive', 'Transfers, mail, social, website, AI receptionist — stamped with source and campaign in app.krestmarketing.com', 'var(--teal)'),
   ('Qualify', 'Router + credit check', 'Ability to pay, income verified, state checked, program chosen, payout shown', 'var(--blue)'),
   ('Enroll', 'Script + SOP', 'Agreement signed, first-draft date set, opportunity created with campaign code', 'var(--amber)'),
   ('Quality', 'AI call-QC', 'Recording scored; pressure or confusion goes to review before the draft', 'var(--purple)'),
   ('Pay', 'Reconcile', 'Remittance matched to the deal; election applied; commission run; dashboards update', 'var(--navy)')])) + '</div>', doc, 3, T,
 where='Live demo on ai.fundingtier.com (Admin) · Playbook §5'))

# 3 Programs
def sched(key, debt, case='SAFE'):
    x = DE['cases'][case][str(debt)][key]; return x
P.append(page('Business Plan · 3', 'Programs, Partners And Payouts',
 'Four programs from one call. "Payout" is what the partner remits to Funding Tier for a file; the closer is paid out of it only when a US-based W-2 closer closed the deal.',
 table([('Program', ''), ('Partner', ''), ('Who fits', ''), ('Payout to Funding Tier', ''), ('Risk window', '')], [
  ['<b>Debt Settlement</b>', 'Level Debt', 'Larger unsecured balances; client wants the lowest monthly payment; settlement-eligible states', '8% of enrolled debt, once, when the first client payment clears (month 2)' + math('$15,000 × 8% = $1,200 · $25,000 × 8% = $2,000'), 'Clawback if payment 2 is missed — modelled at 15% of first-payers (NSF)'],
  ['<b>Debt Validation</b>', 'Shield Services', 'Disputable accounts; broad state coverage; fastest enrollment', '<b>Perpetual:</b> 100% of (payment − $40 servicing) for payments 1–4, then 35% through month 36. Payment banded by debt: $320 at $15k, $370 at $20k, $420 at $25k' + math(f'$15k: $280 × 4 + $98 × 32 = {M(SH["15000"]["fullPerp"])} over 36 months') + '<b>Buyout:</b> one lump after the first payment clears' + math(f'$15k: ($320 − $40) × 65% × 6 = {M(SH["15000"]["buyout"])} · $25k: $380 × 100% × 6 = {M(SH["25000"]["buyout"])}'), 'Perpetual: month by month. Buyout: ends at the lump'],
  ['<b>Debt Resolution</b>', 'Elite Legal Practice', 'Attorney-backed resolution; longer term; highest lifetime payout', '<b>Residual:</b> payments 1–2 pass through less $4; from payment 3, 60% of (draft − $80 maintenance − $4) monthly for the term written. Standard terms by debt: 36–42 months at $15k–$25k, 42–48 at $25k–$35k, 48–54 at $35k–$45k, 54–60 at $50k+ — and any file may be stretched to 60 months as long as the client\'s draft stays at or above $250, which caps a $15k file at 44 months. The residual is earned on months 1–48 only (Exhibit D), so a 60-month term lowers the draft rather than adding payout' + math(f'$15k: {M(ELP["15000"]["m1"])} × 2, then {M(ELP["15000"]["m3"])} × 42 = {M(ELP["15000"]["full"])}') + '<b>Accelerated:</b> 90% of net for months 1–7, then 25% to month 24', 'Residual: month by month. Accelerated: most value in months 1–7'],
  ['<b>Tax Resolution</b>', 'Milestone Tax Solutions', 'Tax debt found on the same call; Phase 1 investigation then Phase 2 resolution', '50% of the Phase 1 fee ($500 standard, up to $1,500); 40 / 50 / 60% of the Phase 2 fee by monthly volume tier (~$5,000 average), on each client payment; rate locked at funding', '~15-day refund window, then as payments clear'],
 ], 'sm', ['1.1in', '1.1in', '2in', '4.2in', '1.6in']) +
 '<div class="cols c2">' +
 '<div>' + st('Payout Timing — One $15,000 Validation File', 'client stays the whole term') +
 table([('Month', ''), ('Client pays', 'n'), ('Perpetual payout', 'n'), ('Buyout payout', 'n')], [
  ['1', '$320', '$280', (M(SH['15000']['buyout']) + ' (once)', 'n g')], ['2', '$320', '$280', '—'], ['3', '$320', '$280', '—'], ['4', '$320', '$280', '—'], ['5 – 36', '$320', '$98 each', '—']], 'sm', ['1in', '1in', '1.2in', '1.2in'],
  tot=['Full payout if the client stays', '', (M(SH['15000']['fullPerp']), 'n'), (M(SH['15000']['buyout']), 'n')]) + '</div>' +
 '<div>' + st('How The Election Works') + ul([
   'The election is made per file. The buyout turns a 36-month stream into one payment and ends chargeback exposure on that file; the perpetual keeps the stream and the risk.',
   f'Section 11 shows how many months the perpetual needs to pass the buyout at each cancellation rate ({CURVES["15000"]["cross"]["15"]} months at 15% on $15k; never at 10%+ on $25k).',
   '<b>Remittance:</b> partners remit in arrears by the 15th of the following month. The reconciliation engine matches every line to its deal, flags NSFs and cancellations, and sets each deal\'s expected pay date.'], 'b sm') + '</div></div>', doc, 4, T,
 where='Election Planner on ai.fundingtier.com · Investment Proposal p.4'))

# 4 Market assessment
P.append(page('Business Plan · 4', 'Market Assessment — Growth And Profitability',
 'The market is large, growing and permanently replenished. The constraint is not demand; it is qualifying, enrolling and keeping the right clients inside the rules.',
 kv([('US household debt', '$19.1T', 'Q3 2026 · up $520B year over year (New York Fed)'), ('Credit card balances', '$1.285T', 'record · 6.87% annualized flow into 90+ day delinquency'), ('Debt settlement market', '$4.1B → $5.8B', '2026 → 2031 · 7.2% CAGR (Mordor Intelligence)'), ('IRS offers in compromise', '14%', 'accepted in FY2025: 5,464 of 38,797 (IRS Data Book)')]) +
 '<div class="cols c2">' +
 '<div>' + st('Demand By Program') +
 table([('Program', ''), ('Who needs it', ''), ('Growth signal', ''), ('Profitability for a front end', '')], [
  ['<b>Debt settlement</b>', 'Households with $10k+ unsecured debt who can pay a reduced monthly amount', 'Category growing ~7% / yr; delinquency flows at their highest since 2016; digital settlement platforms expanding', 'One payout of 8% at month 2; fastest cash, shortest risk window'],
  ['<b>Debt validation</b>', 'Consumers with disputable accounts; broadest state coverage', 'Grows with the same delinquency wave; fewer state restrictions than settlement', 'Perpetual stream or buyout; best margin when retention holds'],
  ['<b>Debt resolution (attorney)</b>', 'Clients who want legal backing and a longer plan', 'Compliance pressure favours attorney-model programs', 'Highest lifetime payout; longest tail; term can extend to 60 months'],
  ['<b>Tax resolution</b>', 'Taxpayers with IRS balances who cannot self-navigate OIC and installment rules', 'IRS collections record $5.6T FY2026; private collectors expanding; only 14% of OICs accepted', 'Attached to the same call at zero acquisition cost; modelled at zero in this plan'],
 ], 'sm', ['1.2in', '1.6in', '1.8in', '1.6in']) + '</div>' +
 '<div>' + st('What Drives And Restrains The Category') + ul([
   '<b>Drivers (Mordor):</b> rising unsecured debt and card delinquencies (+1.8% CAGR), digital settlement platforms (+1.3%), non-bankruptcy resolution (+1.0%), household and small-business distress (+0.8%)',
   '<b>Restraints:</b> strict regulation of providers and fees (−1.1%), credit-score impact (−0.9%), consumer distrust (−0.8%), creditor acceptance uncertainty (−0.5%)',
   '<b>North America</b> is 61% of the market; the leaders — Freedom Debt Relief, National Debt Relief, Beyond Finance, Americor, ClearOne — all run large remote sales floors, which is where Plan C talent comes from'], 'b sm') +
 st('Why A Front End Is The Profitable Seat') + ul([
   'No client funds, no servicing staff, no program licences — the partner carries those',
   'Margin is set by two numbers Funding Tier controls: cost per enrolled file and retention',
   'The same call can be routed to four programs, so a lead is rarely wasted'], 'b sm') + '</div></div>', doc, 5, T, where='Sources in §17'))

# 5 SWOT
P.append(page('Business Plan · 5', 'SWOT Analysis',
 'An honest reading of where Funding Tier is strong, where it is thin, what the market offers and what could hurt. Each item is paired with what the plan does about it.',
 '<div class="swot">' +
 f'<div class="q" style="--c:var(--green)"><h3>Strengths</h3>{ul(["<b>System already built</b> — router, scripts, QC, pay engine, model; no development spend in the plan", "<b>Partner-paid, four programs</b> — no client funds, broad state coverage, a lead rarely wasted", "<b>Credit data</b> — TransUnion gateway built; Array credit-parameter check available to cut backend pull costs", "<b>Low fixed cost</b> — virtual, $12 / hour closers, E&amp;O in place", "<b>Operator who closes</b> — the founder sells, trains and builds"], "b sm")}</div>' +
 f'<div class="q" style="--c:var(--red)"><h3>Weaknesses</h3>{ul(["<b>Single operator at launch</b> — capacity caps at 3 closers until a team lead is added (rule: 4th closer)", "<b>Revenue lag</b> — month 1 is paid before any payout; reserve target takes ~" + str(S1S["reserveMet"]) + " months", "<b>Retention is assumed until measured</b> — hence a deliberately safe case and weekly measurement", "<b>No mail history</b> — the first drop is a test, sized to the reserve"], "b sm")}</div>' +
 f'<div class="q" style="--c:var(--blue)"><h3>Opportunities</h3>{ul(["<b>Record consumer debt</b> and delinquency at a 10-year high", "<b>$25k+ households</b> reachable through prescreen mail and social retargeting", "<b>Tax resolution</b> attached to the same call — zero acquisition cost, modelled at zero", "<b>Own data campaigns</b> (dialing, SMS, RVM) on coreg data through app.krestmarketing.com", "<b>Back end later</b> — servicing in-house keeps the whole payout; treated as a separate financing"], "b sm")}</div>' +
 f'<div class="q" style="--c:var(--amber)"><h3>Threats</h3>{ul(["<b>TCPA litigators</b> — mitigated by pre-scrubbed lists, Blacklist Alliance and DNC in the system (§6)", "<b>State rule changes</b> — router enforces exclusions; partners hold the licences", "<b>Transfer vendor quality and price</b> — second vendor, weekly disputes, buffer mix by close rate", "<b>Larger competitors</b> outbid on paid media — we buy transfers and mail $25k+ households instead", "<b>Economic shift</b> that lowers first-pay rates — hold rule pauses hiring under 50%", "<b>Market saturation</b> — people already enrolled elsewhere keep answering calls and ads looking for faster settlements or lower payments; a retention threat if they churn again, an opportunity when the router places them in a program that actually fits"], "b sm")}</div>' +
 '</div>', doc, 6, T))

# 6 Customers & compliance
P.append(page('Business Plan · 6', 'Customers And Compliance',
 'The customer is a US household with meaningful unsecured debt, current income and a payment they can sustain. Compliance is enforced by the system, not remembered by reps.',
 '<div class="cols c2">' +
 '<div>' + st('Who We Enroll') +
 table([('', ''), ('Rule', '')], [
  ['<b>Debt</b>', 'Unsecured (cards, personal loans, medical) above the program floor; $15,000 typical on transfers; $25,000–$250,000 targeted by mail and social'],
  ['<b>Ability to pay</b>', '<b>Income verification on every file</b> — the payment-propensity test. Stated employment and income; a monthly payment the client can show they can make. No file without it'],
  ['<b>Qualify fast</b>', 'Closers are trained to qualify or disqualify quickly for higher stated debt loads so seat time goes to files that will pay'],
  ['<b>Exclusions</b>', 'Active bankruptcy; unexplained NSF pattern; states excluded for the program quoted'],
  ['<b>Fit</b>', 'The router picks the program from debt size, account types, state and the client\'s priority (lowest payment, speed, legal backing)'],
 ], 'sm', ['1.1in', '3.8in']) +
 st('Where Clients Come From') +
 table([('Source', ''), ('Today', ''), ('Next', '')], [
  ['Purchased live transfers', '$14 per call, 2-minute buffer; vendors can supply beyond the launch roster', 'Second vendor; weekly dispute discipline'],
  ['Direct mail on TransUnion data', 'Gateway built', 'Tier 1 test after the reserve; $25k+ households; firm-offer structure'],
  ['Paid social', 'Not yet', 'Retargeting of mailed ZIPs only'],
  ['Own data campaigns', 'Dialer, SMS, RVM in app.krestmarketing.com', 'Option on purchased coreg data, scrubbed first'],
  ['Inbound (website, AI receptionist)', 'Live', 'Grows with brand and mail'],
 ], 'sm', ['1.5in', '2in', '1.5in']) + '</div>' +
 '<div>' + st('Compliance Environment And Mitigation') +
 table([('Rule area', ''), ('What it requires', ''), ('How Funding Tier operates', '')], [
  ['<b>TCPA / do-not-call / litigators</b>', 'Prior express written consent for marketing calls and texts; DNC honored; serial litigators target outbound campaigns', ul(['Pre-scrubbed lists only — vendor-scrubbed or scrubbed internally before any dial', 'Blacklist Alliance litigator scrub on every list', 'Universal DNC management integrated in app.krestmarketing.com', 'Consent records held by transfer vendors; suspicious transfers disputed weekly'], 'ck')],
  ['<b>Telemarketing Sales Rule</b>', 'No advance fees from consumers; required disclosures; no outcome promises', ul(['Paid by partners, never by consumers', 'Scripted disclosures; TSR-compliant close; QC scores every call'], 'ck')],
  ['<b>State debt-relief laws</b>', 'Licensing, fee caps and program limits vary by state', ul(['Router enforces state exclusions before a quote', 'State hiring map for reps; partners hold the licences'], 'ck')],
  ['<b>Prescreen data (FCRA)</b>', 'Lists require a firm offer of credit; opt-outs honored', ul(['Lender partner makes the offer; declines route to debt programs', 'Attorney review of creative'], 'ck')],
  ['<b>Tax relief marketing</b>', 'No implied government ties, no fear tactics', ul(['Licensed partner investigates and prices every case before resolution is sold'], 'ck')],
  ['<b>Data protection</b>', 'Prospect financial information is sensitive', ul(['Stays in the CRM and pay engine; no exports; vendor NDAs; E&amp;O in place'], 'ck')],
 ], 'xs', ['1.2in', '1.6in', '2.3in']) +
 where('Scrub reports, consent records and QC scorecards: Funding Tier system → Admin → Compliance; Playbook §7') + '</div></div>', doc, 7, T))

# 7 Operations
P.append(page('Business Plan · 7', 'Operations',
 'A call becomes a paid file through five steps, each with a system behind it and a number attached. Nothing depends on memory or a spreadsheet.',
 '<div class="cols c3">' +
 '<div>' + st('Hours Of Operation') + ul([
   '<b>To start: Monday–Friday 9:00 AM – 6:00 PM Pacific; Saturday 10:00 AM – 3:00 PM</b>', '<b>Later: Monday–Friday 6:00 AM – 6:00 PM</b> once closers are available to cover the early East-Coast hours', 'The clock-in window is enforced in the system; closers work 8-hour shifts inside it', 'Transfers are bought to match staffed hours; inbound outside hours goes to the AI receptionist and is called back next shift', 'Launch team in Egypt or another overseas country on the US day shift; later remote hiring optimized by US time zone'], 'b sm') +
 st('The Sales Floor') + ul(['65-minute average handle time; 1.25 deals per 8 closer hours as the planning floor', 'Occupancy target 90–100% with zero unanswered inbound', 'One script and SOP per program, state-aware; AI Genie post-enrollment quality call on validation', 'Buffer mix tuned monthly to close rate; disputes filed weekly'], 'b sm') + '</div>' +
 '<div>' + st('Daily · Weekly · Monthly Rhythm') +
 table([('When', ''), ('What', '')], [
  ['<b>Daily briefing</b>', 'Calls received, qualified, enrolled; first-pay clears; QC flags; bank and A/R — posted from the dashboard by 8 AM'],
  ['<b>Daily huddle</b>', '15 minutes with closers: yesterday\'s files, today\'s focus, one coaching point'],
  ['<b>Weekly recap</b>', 'Per-closer KPIs (close, first-pay, QC score, hours), vendor quality by buffer, cost per enrolled file by source, disputes filed'],
  ['<b>Monthly close</b>', 'Days 1–5 reconcile remittances; 5–8 commission run and offshore bonus; 8–10 member approval; 10–15 CPA posts P&amp;L, bank vs reserve; day 15 KPI review and the hire / invest / hold decision, minuted'],
  ['<b>AI dashboard</b>', 'Reports what to continue, cut or improve across sources, closers and programs; both members see the same screen'],
 ], 'sm', ['1.1in', '2.9in']) + '</div>' +
 '<div>' + st('Systems') +
 table([('', ''), ('', '')], [
  ['<b>CRM</b>', 'app.krestmarketing.com: contacts, pipelines, recruiting, workflows, call tracking, attribution, DNC'],
  ['<b>Agent toolkit</b>', 'ai.fundingtier.com: deal router, scripts, SOPs, training, My Deals &amp; Pay, state hiring map'],
  ['<b>Pay engine</b>', 'Remittance matching, commission run, clawbacks, expected pay dates, reserve and waterfall'],
  ['<b>Operating model</b>', 'Growth Plan, Scale Planner, Election Planner; 48-month simulation; live for both members'],
  ['<b>Telephony</b>', 'DIDs and tracking numbers per campaign; recordings feed call-QC'],
  ['<b>Data</b>', 'TransUnion gateway (mail); Array credit-parameter check (service order signed, not yet built; minimum $0 → $1,000 / month)'],
 ], 'sm', ['1in', '3in']) +
 st('Backend Servicing Oversight') + ul(['Every partner\'s first-draft and cancellation data is reconciled weekly; a partner whose cancellations run 5 points above the others is reviewed', 'Client complaints route to the partner and are tracked to close — the partner doing its job is part of our retention'], 'b sm') + '</div></div>', doc, 8, T, where='Playbook §2 and §5'))

# 8 Organization & compensation
P.append(page('Business Plan · 8', 'Organization And Compensation',
 'Who is on the team, how each is sourced, what each costs and what each earns. Only US-based W-2 closers earn commission; the owner-operator is paid through the distribution agreement; offshore closers earn an hourly rate plus a KPI bonus.',
 '<div class="cols c3">' +
 f'<div class="card" style="--c:var(--teal)"><h3>Plan A — Egypt closers (CallBlade)</h3><div class="sub">Referred by Shield Services; experienced in Shield enrollments</div>' + ul([f'$12 / hour · 3 full-time minimum · seat {M(seat1)} / mo all-in' + math('$12 × 40 × 4.333 = $2,080 + 4.5% KPI bonus'), '1–2 week paid trial; replace underperformers from the same source', 'No commission; files they close keep 100% of the payout', 'Bonus 3–6% of monthly hourly pay on KPIs: first-pay rate, hours, QC score — paid as a flat % of revenue generated'], 'b sm') + '</div>' +
 f'<div class="card" style="--c:var(--blue)"><h3>Plan B — another BPO country</h3><div class="sub">If Plan A fails its trial or cannot staff 3 seats</div>' + ul(['Philippines, Latin America or South Africa at $6–$10 / hour with phone-sales and debt experience', 'Same trial, KPIs and bonus; same scripts and router', 'Risk: accent and program knowledge — mitigated by Shield-only first 90 days and QC'], 'b sm') + '</div>' +
 f'<div class="card" style="--c:var(--purple)"><h3>Plan C — one US closer on a draw</h3><div class="sub">Well-vetted, virtual, any state, 30-day trial</div>' + ul([f'Draw at or above state minimum wage for every hour (W-2 inside sales cannot be commission-only) · seat {M(seat2)} / mo before commission', 'Commission: 0.75–1.25% of enrolled debt (settlement) or $275–$400 per file (validation / resolution), paid when the file pays', 'Sourced from debt-relief hubs (§9); National Debt Relief and Americor hire this role remotely at $15.50–$16.50 base + commission', 'HR provider engaged only when this plan is used'], 'b sm') + '</div></div>' +
 '<div class="cols c2">' +
 '<div>' + st('Roster By Stage') +
 table([('Stage', ''), ('Team', ''), ('Monthly labor', 'n'), ('Trigger', '')], [
  ['Launch', 'Owner + 3 Egypt closers', M(S1S['labor']), 'Closing'],
  ['Stage 2', '+ 1 closer + team lead', M(S1S['labor'] + seat1 + 4500), f'Seats ≥ 90% busy 2 months and bank ≥ {M(res + 3 * seat1)}'],
  ['Stage 3', '6 closers + lead', M(6 * seat1 + 4500), 'Same rule, repeated; second transfer vendor'],
  ['Stage 4', '2 teams of 5–6 + 2 leads; US closers added where they out-earn offshore', '—', 'Both-member decision; office only if it pays'],
 ], 'sm', ['0.8in', '2.2in', '1in', '2.2in']) + '</div>' +
 '<div>' + st('Lead And Manager Rule') + ul([
   '<b>One operator trains and monitors up to 3 closers</b> while closing — the launch roster is sized to that',
   '<b>At the 4th closer, add a team lead</b>: US W-2, $22–$26 / hour, 0.1–0.25% override on team volume; one lead per 5–6 closers',
   'The lead runs huddles, QC review and vendor disputes; the operator stays on enrollments and partners',
   '<b>HR services</b> are not needed until in-house US closers are hired; until then the company is virtual with the owner and a BPO'], 'b sm') +
 st('Owner-Operator') + ul(['Closes files every day alongside the team; no commission, SPIFF or bonus on his own files', 'Paid by draw ($10,000 → $12,500) and performance bonus under the distribution agreement (Term Sheet; Exhibit C)'], 'b sm') + '</div></div>', doc, 9, T, where='Exhibit C Compensation Schedule · Playbook §3–§4'))

# 9 State tables
ss = sorted_states()
def strow(s):
    name, mw, test, talent, note = s
    tag = {'HUB': '<span class="tag h">hub</span>', 'SOME': '<span class="tag m">some</span>', 'REMOTE': '<span class="tag b">remote</span>'}[talent]
    allow = '<span class="tag h">yes</span>' if test.startswith('Common') or test.startswith('Economic') else '<span class="tag x">ABC test</span>'
    return [name + ('*' if note else ''), M2(mw), M(mw * 40 * 4.333), allow, tag]
sh = [('State', ''), ('Min. wage', 'n'), ('Draw floor / mo', 'n'), ('1099 100% comm.?', ''), ('Talent', '')]
sw = ['1in', '0.6in', '0.75in', '0.8in', '0.6in']
third = 17
notes = [f'<b>{n}:</b> {note}' for n, mw, test, talent, note in ss if note]
P.append(page('Business Plan · 9', 'Hiring US Closers — State By State (Lowest To Highest Wage)',
 'A W-2 inside-sales closer must be paid at least the state minimum wage for every hour worked, so a draw against commission is required everywhere. Draw floor = wage × 40 hours × 4.333 weeks. 100%-commission pay is possible only as a 1099 contractor, and only where the state\'s classification test allows it.',
 '<div class="cols c3">' + ''.join('<div>' + table(sh, [strow(x) for x in ss[i:i + third]], 'xs', sw) + '</div>' for i in range(0, len(ss), third)) + '</div>' +
 st('Notes On Starred States') + '<div class="cols c3">' + ''.join(ul(notes[i:i + (len(notes) + 2) // 3], 'b sm') for i in range(0, len(notes), (len(notes) + 2) // 3)) + '</div>', doc, 10, T, where='Sources §17 · state hiring map on ai.fundingtier.com'))

P.append(page('Business Plan · 9', 'Hiring US Closers — Rules, Costs And Where The Talent Is',
 'What the law allows for commission pay, what a W-2 closer really costs on top of wages, and where experienced debt-relief closers already work.',
 '<div class="cols c3">' +
 '<div>' + st('Commission-Only And Draw Rules') + ul([
   '<b>Federal (FLSA):</b> inside sales is non-exempt. A commission-only W-2 closer must still receive at least minimum wage for every hour in each workweek, plus overtime over 40 hours. The outside-sales exemption does not apply to phone sales; the retail "7(i)" overtime exemption does not fit a debt-relief front end.',
   '<b>Draw against commission:</b> lawful everywhere as long as the draw itself meets minimum wage each pay period; recoverable draws (clawing back from future commission) are allowed under the FLSA but restricted in several states.',
   '<b>California:</b> draw-only pay for inside sales is unlawful (Vaquero v. Stoneledge, 2017); rest breaks must be paid separately; daily overtime over 8 hours; the ABC test (AB 5) makes 1099 closers impractical.',
   '<b>Massachusetts:</b> commission-only inside sales are owed separate overtime and Sunday premium pay (Sullivan v. Sleepy\'s).',
   '<b>New York:</b> written commission agreement required (Labor Law §191).',
   '<b>100% commission, no draw:</b> only as an independent contractor (1099), only where the state uses a common-law or economic-realities test and the closer controls hours and tools. Safest: Texas, Florida, Arizona, Georgia, Tennessee, North Carolina, Utah, Nevada (modified ABC). Avoid: California, Massachusetts, New Jersey, Illinois, Connecticut, Vermont, Maine, New Mexico.'], 'b sm') + '</div>' +
 '<div>' + st('Employer Costs On Top Of Wages (W-2)') +
 table([('Cost', ''), ('Planning figure', '')], [[k, v] for k, v in EMPLOYER_COSTS], 'sm', ['1.6in', '2.3in']) +
 st('Worked Example — Texas vs California') +
 table([('', ''), ('Texas', 'n'), ('California', 'n')], [
  ['Minimum wage', '$7.25', '$16.90'],
  ['Monthly draw floor' + math('rate × 40 × 4.333'), M(7.25 * 173.3), M(16.9 * 173.3)],
  ['Employer taxes and payroll, ~12%', M(7.25 * 173.3 * 0.12), M(16.9 * 173.3 * 0.12)],
  ['All-in before commission', (M(7.25 * 173.3 * 1.12), 'n'), (M(16.9 * 173.3 * 1.12), 'n')],
 ], 'sm', ['2in', '0.9in', '1in']) + '</div>' +
 '<div>' + st('Where The Talent Is') + ul([
   '<b>Hubs:</b> Arizona (Tempe / Phoenix — Freedom Debt Relief, Beyond Finance), California (Irvine / Orange County — Americor and the industry centre), Florida (Fort Lauderdale / Boca / Tampa), Texas (Houston / Dallas / San Antonio — Beyond, Americor), New York (National Debt Relief HQ)',
   '<b>Some:</b> Illinois (Chicago — Beyond), Maryland (Baltimore — ClearOne), Georgia, Nevada, North Carolina, Tennessee, Utah, Colorado, New Jersey',
   '<b>National Debt Relief and Americor already hire this role remotely</b> ("Debt Consultant", $15.50–$16.50 base + uncapped commission, US-wide), which is the pool Plan C recruits from.'], 'b sm') +
 st('Plan C Recommendation') + ul([
   'Recruit remotely from the hubs; <b>employ in a common-law, $7.25 state</b> where the candidate lives (Texas, Florida at $15 is the pricier hub) to keep the draw floor low',
   'W-2 on a draw of state minimum wage + the commission plan in Exhibit C; 30-day trial with weekly KPI review',
   'California hires only when the candidate is exceptional — the draw floor is 2.3× Texas and daily overtime applies'], 'b sm') + '</div></div>', doc, 11, T))

# 10 Revenue model & unit economics
def dealrow(case, debt, key, label):
    x = DE['cases'][case][str(debt)][key]
    return [label, M(x['full']), M(x['exp']), M(x['comm']) + math(f'× {x["survAtPayout"]*100:.0f}% survive to month {x["payoutMonth"]}'), (M(x['netUs']), 'n g'), (M(x['netNoComm']), 'n g')]
dh = [('Program · debt', ''), ('Full payout', 'n'), ('Expected payout', 'n'), ('US closer commission', 'n'), ('Net profit after US-based closer commission paid', 'n'), ('Net profit, owner- or offshore-closed', 'n')]
dw = ['1.9in', '0.9in', '1in', '1.3in', '1.6in', '1.4in']
P.append(page('Business Plan · 10', 'Revenue Model And Unit Economics',
 '"Expected" discounts every payout month by the chance the client is still paying. Settlement always carries a 15% second-payment NSF. The owner and offshore closers earn no commission, so their files keep the whole expected payout.',
 '<div class="cols c2">' +
 '<div>' + st('Safe Case — 60% First Pay · 15% Monthly Cancel') +
 table(dh, [dealrow('SAFE', 15000, 'LEVEL', 'Settlement · $15,000'), dealrow('SAFE', 15000, 'CS', 'Validation (perpetual) · $15,000'), dealrow('SAFE', 15000, 'LEGACY', 'Resolution (residual) · $15,000'), dealrow('SAFE', 25000, 'LEVEL', 'Settlement · $25,000'), dealrow('SAFE', 25000, 'CS', 'Validation (perpetual) · $25,000'), dealrow('SAFE', 25000, 'LEGACY', 'Resolution (residual) · $25,000')], 'xs', dw,
  tot=['Blended $15,000 file, mix 33 / 40 / 27', '', '', '', (M(SLIDE['cases']['SAFE']['rows'][0]['netUs']), 'n'), (M(SLIDE['cases']['SAFE']['rows'][0]['netNoComm']), 'n')]) + '</div>' +
 '<div>' + st('Target Case — 70% First Pay · 10% Monthly Cancel') +
 table(dh, [dealrow('TARGET', 15000, 'LEVEL', 'Settlement · $15,000'), dealrow('TARGET', 15000, 'CS', 'Validation (perpetual) · $15,000'), dealrow('TARGET', 15000, 'LEGACY', 'Resolution (residual) · $15,000'), dealrow('TARGET', 25000, 'LEVEL', 'Settlement · $25,000'), dealrow('TARGET', 25000, 'CS', 'Validation (perpetual) · $25,000'), dealrow('TARGET', 25000, 'LEGACY', 'Resolution (residual) · $25,000')], 'xs', dw,
  tot=['Blended $15,000 file, mix 33 / 40 / 27', '', '', '', (M(SLIDE['cases']['TARGET']['rows'][0]['netUs']), 'n'), (M(SLIDE['cases']['TARGET']['rows'][0]['netNoComm']), 'n')]) + '</div></div>' +
 '<div class="cols c3">' +
 '<div>' + st('How Survival Is Applied', 'safe case') + table([('Month', 'n'), ('Still paying', 'n')], [[str(r['m']), P1(r['s'] * 100)] for r in DE['cases']['SAFE']['15000']['survival'][:7]], 'xs', ['1in', '1in']) + '</div>' +
 '<div>' + st('Settlement Example, Step By Step') + ul([
   '$15,000 × 8% = $1,200 full payout at month 2',
   '× 60% make the first payment = $720',
   '× 85% make the second (15% NSF) = $612 expected',
   'US closer commission $150 × 51% survival = $77',
   '<b>Net profit after US-based closer commission paid: $536</b>; owner- or offshore-closed: $612'], 'b sm') + '</div>' +
 '<div>' + st('What To Take From This Page') + ul([
   'A $15,000 file is worth $530–$650 expected on safe assumptions and $770–$920 on target; a $25,000 file roughly 45% more',
   'Validation perpetual and resolution residual carry the most upside and the most attrition risk; settlement is fastest and safest',
   'Commission eligibility matters: the same file is worth 15–20% more when the owner or an offshore closer closes it'], 'b sm') + '</div></div>', doc, 12, T, where='Election Planner and Growth Plan → Programs on ai.fundingtier.com'))

# 11 Election strategy
c15, c25 = CURVES['15000'], CURVES['25000']
def crow(m):
    return [f'Month {m}'] + [M(c15['curves'][k][m]) for k in ['0', '6', '10', '15']] + [M(c25['curves'][k][m]) for k in ['0', '6', '10', '15']]
el = {k: {bo: sc('S1', k, bo) for bo in [0, 50, 100]} for k in ['SAFE', 'TARGET']}
P.append(page('Business Plan · 11', 'Election Strategy — Buyout Or Perpetual',
 'On every validation file Funding Tier chooses: one lump now (buyout) or a 36-month stream (perpetual). The right answer depends on the cancellation rate, so the rule is set by measured data and reviewed monthly.',
 '<div class="cols c2">' +
 '<div>' + st('Cumulative Perpetual Payout vs The Buyout Lump') +
 table([('', ''), ('$15k · never cancels', 'n'), ('$15k · 6%/mo', 'n'), ('$15k · 10%', 'n'), ('$15k · 15%', 'n'), ('$25k · never', 'n'), ('$25k · 6%', 'n'), ('$25k · 10%', 'n'), ('$25k · 15%', 'n')],
  [crow(m) for m in [3, 4, 6, 10, 12, 24, 36]], 'xs', ['0.6in', '0.75in', '0.65in', '0.6in', '0.6in', '0.65in', '0.6in', '0.6in', '0.6in'],
  tot=['Buyout lump', (M(c15['buyout']), 'n'), (M(c15['buyout']), 'n'), (M(c15['buyout']), 'n'), (M(c15['buyout']), 'n'), (M(c25['buyout']), 'n'), (M(c25['buyout']), 'n'), (M(c25['buyout']), 'n'), (M(c25['buyout']), 'n')]) +
 ul([f'<b>$15,000 file:</b> the perpetual passes the {M(c15["buyout"])} buyout in month {c15["cross"]["0"]} if nobody cancels, month {c15["cross"]["6"]} at 6%, month {c15["cross"]["10"]} at 10%, month {c15["cross"]["15"]} at 15%.',
     f'<b>$25,000 file:</b> the buyout is {M(c25["buyout"])} (100% × 6 on $20k+); the perpetual passes it in month {c25["cross"]["0"]} with no cancellations, month {c25["cross"]["6"]} at 6%, and <b>never</b> at 10% or more.',
     '<b>Break-even cancellation rate:</b> about 18% / month under $20k and 9% / month at $20k and above — above those, take the buyout.'], 'b sm') + '</div>' +
 '<div>' + st('Whole-Plan Scenarios — S1, 48 Months') +
 table([('Election', ''), ('Safe: net / mo', 'n'), ('Safe: year-1 net', 'n'), ('Safe: lowest bank', 'n'), ('Target: net / mo', 'n'), ('Target: year-1', 'n'), ('Target: lowest bank', 'n')], [
  ['100% perpetual', M(el['SAFE'][0]['net']), M(el['SAFE'][0]['y1']), M(el['SAFE'][0]['low']), M(el['TARGET'][0]['net']), M(el['TARGET'][0]['y1']), M(el['TARGET'][0]['low'])],
  ['50 / 50', M(el['SAFE'][50]['net']), M(el['SAFE'][50]['y1']), M(el['SAFE'][50]['low']), M(el['TARGET'][50]['net']), M(el['TARGET'][50]['y1']), M(el['TARGET'][50]['low'])],
  ['100% buyout', M(el['SAFE'][100]['net']), M(el['SAFE'][100]['y1']), M(el['SAFE'][100]['low']), M(el['TARGET'][100]['net']), M(el['TARGET'][100]['y1']), M(el['TARGET'][100]['low'])],
 ], 'xs', ['0.9in', '0.8in', '0.8in', '0.8in', '0.8in', '0.8in', '0.8in']) +
 table([('', ''), ('Pros', ''), ('Cons', '')], [
  ['<b>100% perpetual</b>', 'Highest mature income when retention holds; compounding stream', 'Slowest cash; carries every cancellation; lowest bank early'],
  ['<b>50 / 50</b>', 'Balanced cash and upside; limits exposure to one guess', 'Neither the fastest cash nor the highest ceiling'],
  ['<b>100% buyout</b>', 'Fastest cash and payback; no chargeback tail; highest lowest-bank', 'Lower mature income once retention is proven'],
 ], 'xs', ['0.9in', '2.1in', '2in']) +
 st('The Rule We Will Run') + ol([
   'Months 1–3: <b>at least 85% Shield Services, 80% buyouts / 20% perpetual</b> — cash first while retention is unmeasured; the 20% perpetual cohort is the measured sample that sets the rule from month 4.',
   'From month 4: <b>perpetual on files under $20k while measured cancellation is under 15%</b>; buyout on $20k+ files unless cancellation is under 8%.',
   'Review the measured rate at every monthly KPI meeting and move 25 points at a time, never all at once.']) + '</div></div>', doc, 13, T, where='Election Planner on ai.fundingtier.com · Investment Proposal p.4'))

# 12 Marketing plan
slS = SLIDE['cases']['SAFE']['rows']; slT = SLIDE['cases']['TARGET']['rows']
P.append(page('Business Plan · 12', 'Marketing Plan',
 'Transfers fill the seats; mail and social replace part of that volume with higher-intent, larger-debt files — a mail response is a household choosing a loan swap or debt relief, a social call is someone who went looking — so close rates and debt loads should run higher and lean toward settlement (marketing mix 50 / 30 / 20). Goal: 25% of volume from mail and social once the reserve is met; hard cap 50%. Every channel is tested at Tier 1 and scaled only on measured cost per enrolled file.',
 '<div class="cols c3">' +
 '<div class="card" style="--c:var(--teal)"><h3>Live transfers — standard election</h3>' + ul([f'<b>$14 per call, 2-minute buffer</b>; billed only if the caller stays 2 minutes', f'Cost per deal {M(cpdS["transfer"])} safe / {M(cpdT["transfer"])} target' + math('$14 ÷ 15% · $14 ÷ 16%'), 'Typical debt $15,000; vendors fill well beyond the launch roster', 'Two vendors by stage 3; weekly dispute of coached or suspicious transfers'], 'b sm') + '</div>' +
 '<div class="card" style="--c:var(--blue)"><h3>Direct mail on TransUnion prescreen data</h3>' + ul(['<b>$25,000 maxed-out revolving debt is the floor</b>; target band $25,000–$250,000', f'Cost per deal {M(cpdS["mail"])}' + math('$0.80 ÷ 1.25% response ÷ 70% qualified ÷ 20% close'), 'Firm-offer-of-credit through the lender partner; declines route to debt programs', 'Tier 1: $12,000 / month (~13,000 pieces) after the reserve is met'], 'b sm') + '</div>' +
 '<div class="card" style="--c:var(--purple)"><h3>Paid social and own-data campaigns</h3>' + ul([f'Social: $35 / lead, 30% qualified, 15% close → {M(cpdS["social"])} per deal; retargets mailed ZIPs only', '<b>Option:</b> dialing, SMS and ringless voicemail on purchased coreg data through app.krestmarketing.com — scrubbed against DNC and Blacklist Alliance first; tested at $3,000 / month', 'Inbound: website and AI receptionist, growing with brand'], 'b sm') + '</div></div>' +
 '<div class="cols c32">' +
 '<div>' + st('Sliding Scale — Debt Load A Mail Or Social Deal Needs') +
 table([('Average enrolled debt', ''), ('Safe: net per deal, US-closed', 'n'), ('Safe: owner / offshore', 'n'), ('Target: US-closed', 'n'), ('Target: owner / offshore', 'n'), (f'Mail ({M(cpdS["mail"])})', ''), (f'Social ({M(cpdS["social"])})', '')],
  [[M(a['debt']), M(a['netUs']), M(a['netNoComm']), M(b['netUs']), M(b['netNoComm']),
    ('<span class="tag h">pays</span>' if a['netUs'] > cpdS['mail'] * 1.1 else '<span class="tag a">thin</span>' if a['netUs'] > cpdS['mail'] * 0.9 else '<span class="tag x">loses</span>', ''),
    ('<span class="tag h">pays</span>' if a['netUs'] > cpdS['social'] * 1.1 else '<span class="tag a">thin</span>' if a['netUs'] > cpdS['social'] * 0.9 else '<span class="tag x">loses</span>', '')] for a, b in zip(slS, slT)], 'xs', ['1.1in', '1.1in', '1in', '1in', '1in', '0.7in', '0.7in']) + '</div>' +
 '<div>' + st('Rules Of The Mix') + ul([
   '<b>Start:</b> mail and social sized to replace 25% of transfer volume so the staffed seats stay full with better files',
   '<b>Cap:</b> never more than 50% of occupancy from inbound marketing — it arrives in bursts; transfers are bought by the hour',
   f'<b>Scale</b> a channel after 2 months at or under target cost per file ({M(cpdS["mail"])} mail, {M(cpdS["social"])} social) with first-pay within 5 points of transfers',
   '<b>Cut</b> after 2 months 25% over target or first-pay 10 points under',
   '<b>Attribution:</b> every call carries its source and campaign; cost per enrolled file is reported weekly by source'], 'b sm') + '</div></div>', doc, 14, T, where='Growth Marketing Budget Plan (project doc) · Growth Plan → Methods'))

# 13 Financial plan
def srow(o, label):
    return [f'<b>{label}</b>', N(o['deals']), M(o['rev']), M(o['labor']), M(o['mkt']), M(o['comm']), M(o['other']), (M(o['net']), 'n g'), M(o['y1']), M(o['y2']), M(o['low']), str(o['cashPos'] or '—'), str(o['reserveMet'] or '—')]
hdr = [('Scenario', ''), ('Deals / mo', 'n'), ('Revenue', 'n'), ('Labor', 'n'), ('Transfers', 'n'), ('US comm.', 'n'), ('Other', 'n'), ('Net / mo', 'n'), ('Year-1 net', 'n'), ('Year-2 net', 'n'), ('Lowest bank', 'n'), ('Cash+', 'n'), ('Reserve met', 'n')]
P.append(page('Business Plan · 13', 'Financial Plan — Four Scenarios',
 'Two teams (owner + 3 Egypt closers; owner + 3 US W-2 closers) at three assumption sets, plus two references. Virtual office, $90,000 in the bank on day one, 85% Shield for 90 days with 80% buyouts, settlement NSF 15%, 48-month horizon. "Possible" is the positive feedback loop: closers improve 5% a month from month 4 (capped at +40% — a 45-minute enrollment) and tax resolution is sold from month 6; it is a projection, not the plan.',
 table(hdr, [srow(S1S, 'S1 · Owner + 3 Egypt closers — Safe'), srow(S1T, 'S1 · Owner + 3 Egypt closers — Target'), srow(S1P, 'S1 · Owner + 3 Egypt closers — Possible'), srow(S2S, 'S2 · Owner + 3 US W-2 closers — Safe'), srow(S2T, 'S2 · Owner + 3 US W-2 closers — Target'), srow(S2P, 'S2 · Owner + 3 US W-2 closers — Possible'), srow(R0S, 'Reference · Owner only — Safe'), srow(R1S, 'Reference · Owner + 1 US closer — Safe')], 'xs',
  ['2.3in', '0.55in', '0.75in', '0.65in', '0.7in', '0.7in', '0.65in', '0.8in', '0.8in', '0.8in', '0.75in', '0.5in', '0.6in']) +
 '<div class="cols c3">' +
 '<div>' + st('Assumptions Behind Every Scenario') + ul(['1.25 deals per 8 closer hours; 65-minute handle time; 40-hour weeks inside the operating window', 'Program mix after month 3: settlement 33% · validation 40% · resolution 27%; validation 100% perpetual in the base run', 'Average debt $15,000 on transfers', 'Offshore closers $12 / hour + 4.5% KPI bonus; US closers $16.90 / hour + commission', 'Overhead: software, telephony, credit pulls, QC, insurance ≈ ' + M(S1S['other']) + ' / month', 'Tax resolution at zero'], 'b sm') + '</div>' +
 '<div>' + st('Reading The Four') + ul([f'<b>S1 safe</b> is the recommendation: {M(S1S["net"])} / month mature, {M(S1S["y1"])} in year one, bank never under {M(S1S["low"])}', f'<b>S2</b> costs {M(S2S["labor"] + S2S["comm"] - S1S["labor"])} / month more at maturity for the same seats and dips to {M(S2S["low"])}', f'<b>Target</b> adds {M(S1T["net"] - S1S["net"])} / month on S1 — retention is the lever', 'The references show the floor (owner alone) and the Plan C trial'], 'b sm') + '</div>' +
 '<div>' + st('Sensitivity, S1 Safe') + table([('Change', ''), ('Mature net / mo', 'n')], [
   ['Base', M(S1S['net'])], ['100% buyout election', M(sc('S1', 'SAFE', 100)['net'])], ['50 / 50 election', M(sc('S1', 'SAFE', 50)['net'])], ['Target retention', M(S1T['net'])], ['US closers instead', M(S2S['net'])]], 'xs', ['1.6in', '1in']) + '</div></div>', doc, 15, T, where='Growth Plan → Bottom Line; Scale Planner for other rosters'))

def mrows(o, n=24):
    return [[f'M{m["mo"]}', N(m['deals']), M(m['rev']), M(m['labor']), M(m['mkt']), M(m['comm']), (M(m['net']), 'n g' if m['net'] >= 0 else 'n r'), M(m['bank']), M(m['res']), P0(m['util'])] for m in o['months'][:n]]
mh = [('', ''), ('Deals', 'n'), ('Revenue', 'n'), ('Labor', 'n'), ('Transfers', 'n'), ('US comm.', 'n'), ('Net', 'n'), ('Bank', 'n'), ('Reserve', 'n'), ('Busy', 'n')]
mw = ['0.4in', '0.45in', '0.7in', '0.6in', '0.65in', '0.6in', '0.7in', '0.8in', '0.7in', '0.45in']
def mpage(a, b, la, lb, n, title):
    return page('Business Plan · 13', title, 'Bank is cash in the bank before any distribution. "Reserve" is the target the bank must reach before distributions and marketing tests. "Busy" is seat occupancy.',
     '<div class="cols c2">' + '<div>' + st(la) + table(mh, mrows(a), 'xs', mw) + '</div>' + '<div>' + st(lb) + table(mh, mrows(b), 'xs', mw) + '</div></div>', doc, n, T)
P.append(mpage(S1S, S1T, 'S1 Safe — Owner + 3 Egypt Closers', 'S1 Target — Owner + 3 Egypt Closers', 16, 'Month By Month — S1, 24 Months'))
P.append(mpage(S2S, S2T, 'S2 Safe — Owner + 3 US W-2 Closers', 'S2 Target — Owner + 3 US W-2 Closers', 17, 'Month By Month — S2, 24 Months'))

# 14 Retention
P.append(page('Business Plan · 14', 'Retention Through Service',
 'Retention and learning are the two levers that compound. Retention is the biggest lever in the plan — the difference between the safe and target cases is worth ' + M(S1T['net'] - S1S['net']) + ' a month on the same team. It rises with customer service, trust, a program the client understands, and partners who do their job.',
 '<div class="cols c4">' +
 ''.join(f'<div class="card" style="--c:{c}"><h3>{t}</h3>{ul(b, "b sm")}</div>' for t, b, c in [
  ('Qualify for ability to pay', ['Income verification on every file', 'Payment date set against the client\'s pay cycle', 'Disqualify fast and kindly — a file that will NSF costs more than no file'], 'var(--teal)'),
  ('Explain the program in depth', ['Scripts walk the client through what happens in months 1, 2, 3 and at settlement', 'Required disclosures read, not rushed; QC scores comprehension', 'Welcome email and AI Genie quality call after enrollment on validation'], 'var(--blue)'),
  ('Service and trust after the sale', ['Closer stays the client\'s contact for the first 60 days', 'Reminder before each draft; proactive call on any NSF', 'Complaints routed to the partner and tracked to close within 5 days'], 'var(--purple)'),
  ('Hold the partners to it', ['Weekly reconciliation of first-drafts and cancellations by partner', 'A partner running 5 points worse than the others is reviewed', 'Changing a partner is a both-member action, backed by data'], 'var(--navy)')]) + '</div>' +
 '<div class="cols c2">' +
 '<div>' + st('What Retention Is Worth — One $15,000 Validation File') +
 table([('Monthly cancel', 'n'), ('Expected perpetual payout', 'n'), ('vs buyout ' + M(c15['buyout']), '')], [
  ['0%', M(c15['curves']['0'][36]), ('<span class="tag h">perpetual wins</span>', '')], ['6%', M(c15['curves']['6'][36]), ('<span class="tag h">perpetual wins</span>', '')], ['10%', M(c15['curves']['10'][36]), ('<span class="tag m">perpetual wins</span>', '')], ['15%', M(c15['curves']['15'][36]), ('<span class="tag a">close call</span>', '')]], 'sm', ['1in', '1.6in', '1.4in']) + '</div>' +
 '<div>' + st('How It Is Measured') + ul(['First-pay rate by closer, by source and by partner — weekly', 'Month-2 NSF rate on settlement files; monthly cancellation on perpetual files — monthly, by cohort', 'QC comprehension score on every enrollment call', 'The model is re-run with the measured rates; the election rule (§11) and the hold rule move with them'], 'b sm') +
 st('The Positive Feedback Loop — Why "Possible" Exists') + ul([f'Every call is scored, every closer is coached on it, and the scripts and router improve with what works; closers who learn the program can enroll a qualified caller in about 45 minutes, not 65', 'The "possible" case models that: deals per 8 closer hours rise 5% a month from month 4, capped at +40%, and tax resolution is sold on the same calls from month 6', f'On the launch team that is {M(S1P["net"])} a month mature and {M(S1P["y1"])} in year one — shown as a projection the KPIs can earn, never as the plan Paul is asked to fund'], 'b sm') + '</div></div>', doc, 18, T, where='Playbook §4 and §7'))

# 15 KPIs, controls, roadmap
P.append(page('Business Plan · 15', 'KPIs, Controls And Roadmap',
 'The numbers both members watch, the thresholds that trigger action, and the 24-month roadmap.',
 '<div class="cols c2">' +
 '<div>' + st('KPI Targets') +
 table([('KPI', ''), ('Safe', 'n'), ('Target', 'n'), ('Act when', '')], [
  ['Close rate on billed transfers', '15%', '16%', 'Under 12% for 2 weeks: coaching, buffer mix, vendor dispute'],
  ['First-payment rate', '60%', '70%', 'Under 50% for 2 months: hiring paused'],
  ['Monthly cancellation (perpetual)', '15%', '10%', 'Over 18% (<$20k) or 9% ($20k+): switch to buyout'],
  ['Settlement month-2 NSF', '15%', '10%', 'Over 20%: payment-date and income checks reviewed'],
  ['Seat occupancy', '90%', '95%', 'Over 90% for 2 months with bank ≥ threshold: hire'],
  [f'Cost per enrolled file — transfers', M(cpdS['transfer']), M(cpdT['transfer']), 'Over $115: re-tune buffers'],
  ['Cost per enrolled file — mail / social', M(cpdS['mail']) + ' / ' + M(cpdS['social']), '', '25% over for 2 months: cut'],
  ['Bank vs reserve target', M(res), '', 'Below for 2 months: hold'],
  ['Offshore KPI bonus earned', '4.5%', '6%', 'Under 3% two months running: replace from the same source'],
 ], 'xs', ['1.6in', '0.6in', '0.6in', '2.1in']) + '</div>' +
 '<div>' + st('Roadmap') +
 table([('When', ''), ('Milestone', '')], [
  ['Month 0', 'Close; accounts opened with dual control; CallBlade trial starts; transfers on; Shield-first (≥85%, 80% buyouts)'],
  [f'Month {S1S["cashPos"]}', 'Bank back above $90,000; program mix opens to all four'],
  [f'Month {S1S["reserveMet"]}', f'Reserve target {M(res)} met; member distributions begin (100% to Paul after the Manager\'s draw until $90,000 is back); Tier 1 mail test approved'],
  ['Month 6–8', '4th closer and team lead by the dollar rule; second transfer vendor; measured cancellation replaces the placeholder'],
  ['Month 9–12', f'Mail and social at 25% of volume; Paul\'s $90,000 returned around month {S1S["reserveMet"] + 4} on the safe case'],
  ['Month 12–18', '6 closers + lead; tax resolution attach measured; election rule tuned to data'],
  ['Month 18–24', 'Second team and lead; US closers where they out-earn offshore; back-end servicing evaluated as a separate financing'],
 ], 'xs', ['0.9in', '4in']) +
 st('Controls') + ul(['Dual control above $10,000; both members on every both-member action (Term Sheet)', 'Reserve and proceeds in the high-yield account; distributions by the waterfall, monthly', 'Daily briefing, weekly recap, monthly KPI review, minuted'], 'b sm') + '</div></div>', doc, 19, T))

# 16 Glossary / FAQ
P.append(page('Business Plan · 16', 'Glossary And FAQ',
 'Every term used in the package, in plain words.',
 '<div class="cols c3">' + '<div>' + table([('Term', ''), ('Meaning', '')], [
  ['<b>Payout</b>', 'What the servicing partner remits to Funding Tier for a file'],
  ['<b>Expected payout</b>', 'Payout discounted by the chance the client is still paying each month'],
  ['<b>First-pay rate</b>', 'Share of enrolled files whose first payment clears'],
  ['<b>NSF</b>', 'Non-sufficient funds — a client payment that bounces'],
  ['<b>Clawback</b>', 'A payout or commission taken back when a file fails inside its risk window'],
  ['<b>Buyout</b>', 'One lump payment for a validation file instead of the 36-month stream'],
  ['<b>Perpetual</b>', 'The month-by-month stream on a validation file'],
  ['<b>Residual / accelerated</b>', 'Resolution (ELP) payout options: monthly for the term, or front-loaded'],
  ['<b>Election</b>', 'The per-file choice between buyout and perpetual (or residual and accelerated)'],
 ], 'xs', ['1.1in', '2.6in']) + '</div>' + '<div>' + table([('Term', ''), ('Meaning', '')], [
  ['<b>Live transfer</b>', 'A caller handed to a closer by a vendor; billed at $14 if they stay 2 minutes'],
  ['<b>Buffer</b>', 'The minutes a transferred caller must stay before we are billed'],
  ['<b>Occupancy</b>', 'Share of staffed closer hours spent on qualified calls'],
  ['<b>Operating reserve</b>', 'Six months of fixed overhead plus a chargeback buffer, held before distributions'],
  ['<b>Waterfall</b>', 'The order cash is applied: costs, reserve, tax, Manager draw, Paul until $90,000 is back, accrued draw, 70 / 30'],
  ['<b>Dual control</b>', 'Both members approve any single transaction over $10,000 at the bank'],
  ['<b>Both-member action</b>', 'A decision neither member can take alone (debt over $25k, equity, partners, hiring above rep)'],
  ['<b>A/R</b>', 'Accounts receivable — payouts partners owe on files that have already paid'],
  ['<b>KPI</b>', 'Key performance indicator — a number watched daily, weekly or monthly'],
 ], 'xs', ['1.1in', '2.6in']) + '</div>' + '<div>' + st('FAQ') + ul([
   '<b>Is the $90,000 spent on software?</b> No — it funds closers and calls; the system is built.',
   '<b>When does Paul get paid?</b> Once the reserve is met and the Manager\'s draw is paid, 100% of member distributions go to Paul until $90,000 is back — about month ' + str(S1S['reserveMet'] + 4) + ' on the safe case — then 30% of profit.',
   '<b>What if the Egypt closers fail the trial?</b> Plan B (another BPO) or Plan C (a US closer on a draw); the system and the numbers are the same.',
   '<b>What if cancellations are worse than 15%?</b> The buyout election caps the loss on validation files; the hold rule pauses hiring; the model is re-run with real rates.',
   '<b>Can Paul work in the business?</b> Yes, in any role both members agree to in writing.',
   '<b>Who holds the clients\' money?</b> The servicing partners, never Funding Tier.'], 'b sm') + '</div></div>', doc, 20, T))

# 17 Sources
P.append(page('Business Plan · 17', 'Sources',
 'External figures used in this plan. Internal figures come from the operating model on ai.fundingtier.com and the partner agreements on file.',
 '<div class="cols c2">' + ul([
   'Federal Reserve Bank of New York, <i>Quarterly Report on Household Debt and Credit</i>, Q3 2026 (released November 10, 2026): total household debt $19.1T; credit card balances $1.285T; 6.87% annualized flow into 90+ day delinquency. newyorkfed.org/newsevents/news/research/2026/20261110',
   'Mordor Intelligence, <i>Debt Settlement Market Size, Share &amp; 2031 Growth Trends</i>: $3.80B (2025), $4.10B (2026), $5.80B (2031), 7.2% CAGR; North America 61.4%; drivers and restraints. mordorintelligence.com/industry-reports/debt-settlement-market',
   'Brotman Law, <i>IRS Collections Statistics 2026</i>, citing the IRS Data Book FY2025: 38,797 offers in compromise, 5,464 accepted (14%); $117.5B collected on unpaid assessments. sambrotman.com',
   'Clear Start Tax / Newswire, <i>IRS reports a record $5.6 trillion collected in FY 2026</i> and <i>IRS private debt collectors are expanding in 2026</i>. newswire.com',
   'Paycor, <i>Minimum Wages by State: A Complete Guide for 2026</i> (updated December 4, 2025) — every state rate in §9. paycor.com/resource-center/articles/minimum-wage-by-state'], 'b sm') +
 ul(['Foley &amp; Lardner, <i>Do You Need to Pay Minimum Wage or Overtime to Your Commission-Paid Employees?</i> — FLSA minimum wage for commission-only employees; white-collar, outside-sales and retail exemptions. foley.com',
   'Fisher Phillips, <i>Paying Most Sales Employees Purely on Draw and Commission No Longer Lawful in California</i> — Vaquero v. Stoneledge Furniture (2017). fisherphillips.com',
   'Foley &amp; Lardner, <i>Court Says Massachusetts Commission-Only Inside Sales Employees Are Entitled to Separate Overtime and Sunday Premium Pay</i> — Sullivan v. Sleepy\'s. foley.com',
   'Americor, <i>Debt Consultant</i> job posting (remote, US; $15.50–$16.50 base + uncapped commission). builtin.com/job/debt-consultant/3659478',
   'National Debt Relief remote sales postings, Indeed / ZipRecruiter / Remotive (remote inside sales representative roles).',
   'Employer-cost planning figures (FICA 7.65%, FUTA 0.6% of $7,000, SUTA and workers\' compensation ranges) are standard payroll planning rates; the Company\'s payroll provider confirms the exact state rates at hire.'], 'b sm') + '</div>' +
 '<div class="callout">All external figures were retrieved November 21, 2026 and are quoted as published; they are context for the plan, not inputs to the operating model. The 1099 classification and commission-rule notes in §9 are planning guidance, not legal advice — the Company\'s employment counsel confirms each state before a hire.</div>', doc, 21, T))

write('business-plan.html', 'Funding Tier — Business Plan (Exhibit B)', P)
print('business plan pages', len(P))
