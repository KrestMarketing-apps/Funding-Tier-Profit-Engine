import json
from pkg_common import *
DE = json.load(open(HERE + '/deal-economics.json'))
S1S, S1T, S2S = sc('S1', 'SAFE'), sc('S1', 'TARGET'), sc('S2', 'SAFE')
cpd = SLIDE['cases']['SAFE']['costPerDeal']; c15 = CURVES['15000']
seat1, seat2 = S1S['seatCost'], S2S['seatCost']; res = S1S['months'][5]['res']
doc = 'Operating Playbook · Exhibit D'; T = 10; P = []

P.append(cover('Operating Playbook', 'Exhibit D — Internal. Who does what, every day, week and month; how the launch runs; how closers are tried, trained and paid; how marketing is tested; how money is counted and distributed; and the rules that trigger every hire, invest or hold decision.',
 [('For', 'Nathan Pottish and Paul Dillenback'), ('Prepared by', 'Nathan Pottish, Manager'), ('Date', DATE), ('Version', '2.0 — Shield-first launch, $12 / hr closers, KPI bonus, dollar thresholds, TCPA operations'), ('System', 'ai.fundingtier.com · app.krestmarketing.com'), ('Companion documents', 'Investment Proposal · Term Sheet (A) · Business Plan (B) · Compensation Schedule (C)')],
 'Internal operating document for the members of Funding Tier LLC. Not for distribution outside the Company. Figures are outputs of the operating model on stated assumptions and are re-run monthly with actuals.'))

# 1 Roles
P.append(page('Playbook · 1', 'Roles — Operator, Investor, Lead, Closers',
 'Everyone knows what is theirs. The operator runs the floor and the system; the investor is a full partner with a seat in operations whenever both agree; the lead arrives at the 4th closer.',
 '<div class="cols c4">' +
 ''.join(f'<div class="card" style="--c:{c}"><h3>{t}</h3><div class="sub">{s}</div>{ul(b, "b sm")}</div>' for t, s, b, c in [
  ('Operator — Nathan', 'Manager; closes daily', ['Closes files alongside the team', 'Trains and monitors up to 3 closers; hires within the roster plan', 'Transfer vendors, partner relationships, compliance', 'Owns the system; publishes the daily briefing, weekly recap, monthly review', 'Marketing within budget (+25% flex)'], 'var(--teal)'),
  ('Investor — Paul', 'Member; may operate by agreement', ['Full information rights: dashboards, bank view, model, P&amp;L by the 15th', 'Co-signer; one of two approvals above $10,000; one of two votes on both-member actions', 'Brings accounting (now) and HR (when US W-2 hires start)', 'May take an operating role — vendors, hiring, finance, partners — scoped in writing'], 'var(--navy)'),
  ('Team lead', 'Added at the 4th closer', ['US W-2, $22–$26 / hr + 0.1–0.25% override on team volume', 'Daily huddle, QC review within 24 hours, vendor disputes weekly', 'One lead per 5–6 closers', 'Frees the operator for enrollments and partners'], 'var(--purple)'),
  ('Closers', 'Egypt BPO (Plan A) · BPO (B) · US W-2 (C)', ['8-hour shifts inside the operating window', 'Qualify fast: income verification on every file', 'One program for 90 days (Shield), then all three', 'Offshore: $12 / hr + 3–6% KPI bonus · US: draw + commission (Exhibit C)'], 'var(--blue)')]) + '</div>' +
 st('Hours Of Operation') + '<div class="cols c3">' + ul(['<b>Monday–Friday 6:00 AM – 7:00 PM Pacific</b>', '<b>Saturday 6:00 AM – 3:00 PM Pacific</b>'], 'b sm') + ul(['Closers clock in only inside the window (system-enforced)', 'Transfers are bought to match staffed hours'], 'b sm') + ul(['Egypt closers take the US day shift (their evening)', 'After-hours inbound → AI receptionist → next-shift callback'], 'b sm') + '</div>', doc, 2, T))

# 2 Rhythm
P.append(page('Playbook · 2', 'The Operating Rhythm',
 'Daily briefing, weekly recap, monthly KPI review. The AI-powered dashboard reports what to continue, cut or improve; both members see the same screen.',
 table([('Cadence', ''), ('What happens', ''), ('Who', ''), ('Where', '')], [
  ['<b>Daily briefing (8 AM)</b>', 'Yesterday: calls received, qualified, enrolled by source and closer; first-pay clears; QC flags; bank balance and A/R. Today: staffed seats, transfer order, any hold.', 'Operator posts; investor reads', 'Shared channel; dashboard → Daily'],
  ['<b>Daily huddle (15 min)</b>', 'Yesterday\'s files, today\'s focus, one coaching point; QC flags reviewed with the closer', 'Operator (lead when added) + closers', 'Video'],
  ['<b>Weekly recap (Friday)</b>', 'Per-closer KPIs: close, first-pay, QC score, hours, bonus-to-date. Vendor quality by buffer; disputes filed. Cost per enrolled file by source. Continue / cut / improve list from the dashboard.', 'Operator; both members review', 'Dashboard → Weekly; recap posted'],
  ['<b>Monthly close (days 1–15)</b>', 'Days 1–5 reconcile remittances to deals · 5–8 commission run and offshore bonus · 8–10 member approval of payroll and commission batch · 10–15 CPA posts P&amp;L, bank vs reserve, K-1 estimate', 'Operator, CPA, both members', 'Pay engine; accounting'],
  ['<b>Monthly KPI review (the 15th)</b>', 'P&amp;L; waterfall calculation; measured close / first-pay / cancellation vs plan; model re-run with actuals; election rule check; <b>hire / invest / hold decision minuted</b>', 'Both members', 'Dashboard → Monthly; minutes in the system'],
  ['<b>Quarterly</b>', 'Review meeting; tax distributions; Manager bonus (after payback); partner performance review', 'Both members, CPA', ''],
 ], 'sm', ['1.5in', '4.6in', '1.6in', '1.6in']) +
 '<div class="cols c2">' + '<div>' + st('What The Dashboard Shows Every Morning') + ul(['Green / amber / red on every decision rule (§6) against the bank and A/R', 'Cost per enrolled file by source vs target', 'First-pay and cancellation by cohort, by closer, by partner', 'Seats busy vs the 25% / 50% marketing share rule'], 'b sm') + '</div>' +
 '<div>' + st('Minutes That Matter') + ul(['Every monthly hire / invest / hold decision, with the numbers it rested on', 'Every both-member action (Term Sheet) and every dual-control approval over $10,000', 'Every election-rule change, 25 points at a time'], 'b sm') + '</div></div>', doc, 3, T))

# 3 90-day launch
P.append(page('Playbook · 3', 'The 90-Day Launch',
 'Shield Services only for 90 days: one program, one script, one partner, so three new closers learn it cold. Transfers at $14 per call, 2-minute buffer, fill the seats from day one.',
 '<div class="cols c3">' +
 '<div class="card" style="--c:var(--teal)"><h3>Week 0 — Close and set up</h3>' + ul(['Accounts opened: operating + high-yield reserve, both members as signers, dual control above $10,000', 'Investor access live: dashboards, model, bank view', 'CallBlade trial agreement: 3 closers, $12 / hr, 1–2 week paid trial', 'Transfer vendor order placed for staffed hours; 2-minute buffer, $14', 'Shield script, SOP and certification assigned to each closer'], 'ck') + '</div>' +
 '<div class="card" style="--c:var(--blue)"><h3>Weeks 1–2 — Trial</h3>' + ul(['Day 1–2: certification on the Shield script, router and income verification', 'Day 3+: live calls; operator listens to every closer\'s first 10 calls', 'QC on 100% of enrollment calls; coaching daily', 'Pass: ≥ 1 deal per 8 hours by day 10 and QC score ≥ 80', 'Fail: replaced from the same source (CallBlade); Plan B / C only if 3 seats cannot be staffed'], 'ck') + '</div>' +
 '<div class="card" style="--c:var(--purple)"><h3>Weeks 3–13 — Run and measure</h3>' + ul(['Transfers tuned weekly to close rate; disputes filed Friday', 'Buyout election on every validation file (cash first)', f'Month 2: first payouts; month {S1S["cashPos"]}: bank back above $90,000', 'Measured first-pay and month-2 data replace placeholders', f'Day 90: open the mix to all three programs; reserve target {M(res)} expected by month {S1S["reserveMet"]}'], 'ck') + '</div></div>' +
 '<div class="cols c2">' +
 '<div>' + st('Training Closers To Qualify Fast') + ul([
   '<b>Income verification is the payment-propensity test.</b> Employer, pay frequency, next pay date; payment set after the pay date',
   '<b>Higher stated debt loads</b> get a two-question check in the first 3 minutes: total unsecured balance and current monthly minimums — if the numbers do not hold together, disqualify kindly and move on',
   'Router shows the program and payout once debt, state and account types are entered; no quote before the router',
   'Required disclosures read in full; QC scores comprehension, not just completion'], 'b sm') + '</div>' +
 '<div>' + st('Launch Numbers To Expect — S1 Safe') +
 table([('', ''), ('Month 1', 'n'), ('Month 2', 'n'), ('Month 3', 'n')], [
  ['Deals', N(S1S['months'][0]['deals']), N(S1S['months'][1]['deals']), N(S1S['months'][2]['deals'])],
  ['Revenue', M(S1S['months'][0]['rev']), M(S1S['months'][1]['rev']), M(S1S['months'][2]['rev'])],
  ['Net', M(S1S['months'][0]['net']), M(S1S['months'][1]['net']), M(S1S['months'][2]['net'])],
  ['Bank', M(S1S['months'][0]['bank']), M(S1S['months'][1]['bank']), M(S1S['months'][2]['bank'])],
 ], 'sm', ['1.2in', '1in', '1in', '1in']) + '</div></div>', doc, 4, T, where='Business Plan §13 · Growth Plan → Month by Month'))

# 4 Floor, pay, bonus
P.append(page('Playbook · 4', 'The Sales Floor, File Quality And Closer Pay',
 'What a closer does all day, what makes a file count, and how each kind of closer is paid — including the offshore KPI bonus.',
 '<div class="cols c3">' +
 '<div>' + st('A Qualified File') + ul(['Unsecured debt above the program floor; state allowed for the program', 'Income verified; payment date set against the pay cycle', 'No active bankruptcy; no unexplained NSF pattern', 'Agreement signed; first-draft date set; opportunity created with the campaign code', 'QC score ≥ 80 or reviewed before the first draft'], 'ck') +
 st('Call QC') + ul(['Every enrollment call transcribed and scored (pressure, confusion, inability to pay, disclosures)', 'Flags reviewed by the operator / lead within 24 hours, before the draft', 'Scores feed the weekly recap and the offshore bonus'], 'b sm') + '</div>' +
 '<div>' + st('Offshore / BPO KPI Bonus — How It Is Earned') +
 table([('KPI', ''), ('Weight', 'n'), ('Target', '')], [
  ['First-pay rate on the closer\'s files (deal quality)', '40%', '≥ 60% safe · ≥ 70% target'],
  ['Hours worked and schedule adherence', '20%', '≥ 95% of scheduled hours'],
  ['QC score (attentiveness, disclosures)', '25%', 'Average ≥ 85'],
  ['Deals per 8 hours', '15%', '≥ 1.25'],
 ], 'sm', ['2.2in', '0.6in', '1.3in']) + ul([
   '<b>Goal: 3–6% of monthly hourly pay</b> ($62–$125 on $2,080); plan default 4.5%',
   'Paid as a flat % of the revenue the closer generated, scaled by the KPI score; nothing under 70% of targets',
   'Computed by the pay engine with the monthly commission run; shown on My Deals &amp; Pay'], 'b sm') + '</div>' +
 '<div>' + st('US W-2 Closer Pay (Plan C)') + ul([
   'Draw at or above the state minimum wage for every hour (Business Plan §9); HR provider engaged at the first hire',
   'Commission per file when it reaches its payout month and survives: settlement 0.75–1.25% of enrolled debt; validation $275–$400; resolution $275–$400',
   'Daily-deal bonus $50 / deal at 3+ per day, $75 at 5+; ramp: first 3 months paid at deal-month 3',
   '30-day trial: ≥ 1 deal per 8 hours by day 15, first-pay within 5 points of the floor'], 'b sm') +
 st('Owner-Operator') + ul(['No commission, SPIFF or bonus on his own files; paid by draw and performance bonus under the distribution agreement'], 'b sm') + '</div></div>', doc, 5, T, where='Exhibit C · Business Plan §8'))

# 5 Marketing test protocol
P.append(page('Playbook · 5', 'Marketing — Test Protocol And The Mix Rule',
 'Transfers are the base. Mail and social are added to replace 25% of transfer volume with larger-debt files once the reserve is met, and never exceed 50% of occupancy.',
 '<div class="cols c2">' +
 '<div>' + st('Before Any Test') + ul([f'Reserve target {M(res)} met <b>and</b> bank ≥ reserve + 2 months of the test budget', 'Seats have room: occupancy under 95% or a closer added for the inbound', 'List pre-scrubbed (vendor or internal) against DNC and Blacklist Alliance; consent language attorney-reviewed', 'Tracking number and campaign code per drop; source stamped on every contact in app.krestmarketing.com'], 'ck') +
 st('Tier 1 Tests') +
 table([('Channel', ''), ('Budget / mo', 'n'), ('Target cost per file', 'n'), ('Minimum run', '')], [
  ['Direct mail, TransUnion $25k+ prescreen', '$12,000', M(cpd['mail']), '2 drops, 2 months'],
  ['Paid social, retargeting mailed ZIPs', '$4,000', M(cpd['social']), '2 months'],
  ['Own data: dialing / SMS / RVM on coreg data', '$3,000', M(cpd['transfer'] * 2), '1 month'],
 ], 'sm', ['2.2in', '0.9in', '1.1in', '1in']) + '</div>' +
 '<div>' + st('Scale, Hold Or Cut') + ol([
   '<b>Scale</b> after 2 consecutive months at or under the target cost per enrolled file <b>and</b> first-pay within 5 points of transfers — raise the budget 50% at a time',
   '<b>Hold</b> when cost per file is within 25% of target — fix creative, list or script, re-test one month',
   '<b>Cut</b> after 2 months 25% over target, or first-pay 10 points under transfers — stop immediately, keep the learning']) +
 st('The Mix Rule') + ul(['<b>Target:</b> mail + social = 25% of monthly deals once the reserve is met', '<b>Cap:</b> never above 50% of occupancy or inbound volume — inbound arrives in bursts; transfers are bought by the hour', 'The dashboard shows the share daily; the model warns when a plan breaches 50%', 'Average debt by channel is reported monthly against the sliding scale (Business Plan §12): mail needs ~$20k, social ~$25k'], 'b sm') +
 st('Transfer Vendor Management') + ul(['Standard election $14 / 2-minute buffer; mix changed only on measured close rate by buffer', 'Coached or suspicious transfers tagged on the call and disputed every Friday', 'Second vendor added at stage 3; no vendor above 70% of volume'], 'b sm') + '</div></div>', doc, 6, T, where='Growth Marketing Budget Plan (project) · Growth Plan → Methods'))

# 6 Money: close, waterfall, decision rules
P.append(page('Playbook · 6', 'Money — Monthly Close, Waterfall And Decision Rules',
 'How cash is counted, in what order it moves, and the dollar thresholds that decide every hire, test and distribution.',
 '<div class="cols c2">' +
 '<div>' + st('Monthly Waterfall (In Order)') + ol([
   'Operating costs — labor, transfers, software, US commission net of clawbacks, offshore bonus, marketing within budget',
   f'Operating reserve — 6 months of overhead + chargeback buffer ({M(res)} at launch), held in the high-yield account',
   'Tax distributions — each member\'s share of taxable income × the CPA\'s assumed rate, quarterly',
   'Manager draw — $10,000 in a profitable month; $12,500 after 3 consecutive profitable months',
   'Investor payback — 100% of what is left to Paul until $90,000 is returned',
   'Accrued draw — any draw skipped in loss months',
   '70 / 30 — remaining profit; Manager bonus 10% of profit above $20,000 / month, quarterly, after payback']) +
 st('Accounts') + ul(['<b>Operating account</b>: about one month of spend', '<b>High-yield interest-bearing account</b>: reserve and undistributed proceeds; interest belongs to the Company', 'Both members signers on both; dual control above $10,000 — per transaction, including one-time purchases; split payments to one payee within 7 days count as one', 'A/R (payouts owed on files that have paid) is shown beside the bank but never distributed'], 'b sm') + '</div>' +
 '<div>' + st('Decision Rules — Dollar Thresholds On The Launch Plan') +
 table([('Decision', ''), ('Rule', ''), ('Threshold', 'n')], [
  ['Add an offshore closer', 'Seats ≥ 90% busy 2 months and bank ≥ reserve + 3 × seat', M(res + 3 * seat1) + math(f'{M(res)} + 3 × {M(seat1)}')],
  ['Add a US closer', 'Same, with the US seat cost', M(res + 3 * seat2) + math(f'{M(res)} + 3 × {M(seat2)}')],
  ['Add a team lead', 'At the 4th closer, or QC review > 48 hrs behind', M(res + 3 * 4500) + math(f'{M(res)} + 3 × $4,500')],
  ['Start a Tier 1 mail test', 'Reserve met and bank ≥ reserve + 2 × budget', M(res + 24000) + math(f'{M(res)} + 2 × $12,000')],
  ['Distribute', 'Bank above reserve after the commission run; A/R excluded', '> ' + M(res)],
  ['Hold hiring', 'Bank under reserve 2 months, or first-pay < 50% 2 months', '< ' + M(res)],
  ['Switch validation to buyout', 'Measured cancel > 18% (<$20k) or > 9% ($20k+)', '—'],
 ], 'sm', ['1.4in', '2.4in', '1.3in']) + '</div></div>', doc, 7, T, where='Investment Proposal p.9 and p.12 · Term Sheet'))

# 7 Compliance operations
P.append(page('Playbook · 7', 'Compliance Operations — TCPA, DNC, Litigators And Data',
 'The checklist that runs before, during and after every campaign and call. Examples of each report are in the Funding Tier system under Admin → Compliance.',
 '<div class="cols c3">' +
 '<div class="card" style="--c:var(--red)"><h3>Before a list is touched</h3>' + ul(['Pre-scrubbed by the vendor, or scrubbed internally in app.krestmarketing.com', 'Blacklist Alliance litigator and serial-plaintiff scrub', 'National and state DNC, and the Company\'s universal DNC list', 'Consent basis documented per record (coreg source, form, date, IP)', 'Attorney-reviewed creative and scripts; firm-offer structure on prescreen mail'], 'ck') + '</div>' +
 '<div class="card" style="--c:var(--amber)"><h3>On every call</h3>' + ul(['Transfer vendor consent record attached to the lead', 'Required disclosures read; no advance fee, no outcome promise', 'State exclusion enforced by the router before any quote', 'Opt-out honored immediately across every channel', 'Recording and transcript to call-QC'], 'ck') + '</div>' +
 '<div class="card" style="--c:var(--teal)"><h3>After</h3>' + ul(['Weekly dispute of coached or suspicious transfers', 'Complaint log: route to partner, track to close within 5 days', 'Monthly scrub refresh on any list still in use', 'Prospect financial data stays in the CRM and pay engine; no exports; vendor NDAs', 'E&amp;O policy current ($400–$500 / yr); incident log reviewed monthly'], 'ck') + '</div></div>' +
 '<div class="cols c2">' + '<div>' + st('Who Owns What') + table([('Control', ''), ('Owner', ''), ('Evidence', '')], [
  ['List scrubbing and DNC', 'Operator (lead when added)', 'Scrub report per list, Admin → Compliance'],
  ['Consent records', 'Transfer vendors; web forms', 'Attached to each contact'],
  ['Disclosures and QC', 'Closers; QC reviewer', 'QC scorecard per call'],
  ['Partner complaints', 'Operator', 'Complaint log'],
  ['Data protection', 'Operator; all users', 'Access log; vendor NDAs on file'],
 ], 'sm', ['1.5in', '1.6in', '1.8in']) + '</div>' +
 '<div>' + st('If Something Goes Wrong') + ol(['Stop the campaign or the closer the same day', 'Pull the records: list, scrub report, consent, recording', 'Notify the other member and counsel within 24 hours', 'Fix the control, document it, re-start only after both members agree']) + '</div></div>', doc, 8, T, where='Business Plan §6'))

# 8 Scaling ladder & risk register
P.append(page('Playbook · 8', 'Scaling Ladder And Risk Register',
 'Growth is a roster decision made by the rules, one seat at a time. The register lists what we watch and what we do when it moves.',
 '<div class="cols c2">' +
 '<div>' + st('Scaling Ladder') +
 table([('Stage', ''), ('Team', ''), ('Volume', ''), ('Trigger to move up', '')], [
  ['Launch', 'Owner + 3 Egypt closers', f'~{N(S1S["deals"])} deals / mo', f'Reserve {M(res)} met; seats ≥ 90% busy'],
  ['2', '+ 1 closer + team lead', '~135', f'Bank ≥ {M(res + 3 * seat1)}; QC on time'],
  ['3', '6 closers + lead; 2nd transfer vendor; mail at 25%', '~160', 'Two months at target cost per file'],
  ['4', 'Two teams of 5–6, 2 leads; US closers where they out-earn offshore', '~300', 'Both-member decision; office only if it pays'],
  ['5', 'Back-end servicing evaluated', '—', 'Separate financing (Term Sheet)'],
 ], 'sm', ['0.6in', '2in', '0.9in', '1.6in']) +
 st('Reserve Grows With The Team') + ul([f'Reserve = 6 × monthly overhead; at launch {M(res)}, about {M(res + 6 * seat1)} with a 4th closer, recalculated at every monthly close'], 'b sm') + '</div>' +
 '<div>' + st('Risk Register') +
 table([('Risk', ''), ('Watch', ''), ('Action', '')], [
  ['First-pay under 50%', 'Weekly, by closer and source', 'Hold hiring; re-train qualification; dispute vendor'],
  ['Cancellation over break-even', 'Monthly, by cohort and partner', 'Switch validation to buyout; review partner'],
  ['Transfer vendor quality', 'Close rate by buffer, weekly', 'Re-tune mix; disputes; second vendor'],
  ['TCPA / litigator', 'Scrub reports; complaints', 'Stop campaign; records; counsel (§7)'],
  ['Partner late remittance', 'Reconciliation days 1–5', 'Chase at day 16; escalate at day 30'],
  ['Operator capacity', 'QC backlog; coaching missed', 'Lead at the 4th closer; investor role'],
  ['Bank under reserve', 'Daily dashboard', 'Hold rule; no distributions'],
  ['Key person', 'Continuous', 'SOPs in the system; key-person insurance; continuity clause'],
 ], 'sm', ['1.4in', '1.6in', '2in']) + '</div></div>', doc, 9, T))

# 9 Definitions
P.append(page('Playbook · 9', 'Definitions And Where Things Live',
 'Short definitions for the floor, and the map of where each number, report and document is found.',
 '<div class="cols c2">' +
 '<div>' + table([('Term', ''), ('Meaning', '')], [
  ['<b>Payout</b>', 'What the partner remits to Funding Tier for a file'],
  ['<b>Qualified transfer</b>', 'A $14 call that stayed 2 minutes and met the program floor'],
  ['<b>First-pay</b>', 'The client\'s first payment cleared — the file counts'],
  ['<b>NSF</b>', 'A bounced client payment; on settlement, payment 2 NSF claws back the 8%'],
  ['<b>Buyout / perpetual</b>', 'Validation election: one lump, or the 36-month stream'],
  ['<b>Residual / accelerated</b>', 'Resolution election: monthly for the term, or front-loaded'],
  ['<b>Reserve</b>', '6 months of overhead + chargeback buffer, held before distributions'],
  ['<b>A/R</b>', 'Payouts partners owe on files that have already paid; never distributed'],
  ['<b>Dual control</b>', 'Both members approve any transaction over $10,000'],
  ['<b>KPI bonus</b>', 'Offshore closer bonus, 3–6% of hourly pay, on monthly KPIs'],
 ], 'sm', ['1.4in', '3.5in']) + '</div>' +
 '<div>' + table([('What', ''), ('Where', '')], [
  ['Deal router, scripts, SOPs, training, state hiring map', 'ai.fundingtier.com'],
  ['My Deals &amp; Pay (expected pay dates, commission, bonus)', 'ai.fundingtier.com → My Deals &amp; Pay'],
  ['Operating Model: Growth Plan, Scale Planner, Election Planner', 'ai.fundingtier.com → Admin → Operating Model'],
  ['Compliance evidence: scrub reports, consent, QC scorecards', 'ai.fundingtier.com → Admin → Compliance'],
  ['Contacts, pipelines, campaigns, DNC, dialer / SMS / RVM, recruiting', 'app.krestmarketing.com'],
  ['Daily briefing, weekly recap, monthly minutes', 'Shared channel + dashboard'],
  ['P&amp;L, bank vs reserve, K-1', 'Accounting provider; dashboard → Monthly'],
  ['Investment package (Proposal, Term Sheet, Business Plan, Playbook)', 'Repo docs/investor · FUNDING TIER project'],
 ], 'sm', ['3in', '2.2in']) + '</div></div>', doc, 10, T))

write('playbook.html', 'Funding Tier — Operating Playbook (Exhibit D)', P)
print('playbook pages', len(P))
