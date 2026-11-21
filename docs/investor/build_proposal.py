import json
from pkg_common import *
DE = json.load(open(HERE + '/deal-economics.json'))
S1S, S1T, S2S, S2T = sc('S1', 'SAFE'), sc('S1', 'TARGET'), sc('S2', 'SAFE'), sc('S2', 'TARGET')
R0S, R1S = sc('R0', 'SAFE'), sc('R1', 'SAFE')
SH15, SH25 = DE['shield']['15000'], DE['shield']['25000']
doc = 'Investment Proposal'; T = 16; P = []

P.append(cover('Investment Proposal',
 'A 30% membership interest in Funding Tier LLC for $90,000 — the investor\'s $90,000 returned ahead of any 70 / 30 split, formula buyback options, shared controls, and a plan that is profitable on safe assumptions.',
 [('Prepared for', 'Paul Dillenback'), ('Prepared by', 'Nathan Pottish, Manager · Funding Tier LLC'), ('Date', DATE),
  ('Version', '2.0 — revised layout, four launch scenarios, state hiring data'), ('Exhibits', 'A Term Sheet · B Business Plan · C Compensation Schedule · D Operating Playbook'), ('Live model', 'ai.fundingtier.com → Admin → Operating Model → Growth Plan')]))

# 1 Mission + executive summary
P.append(page('Investment Proposal · 1', 'Mission And Executive Summary',
 'Funding Tier enrolls people who need help with their debt, matches each one to the right program, and is paid by the servicing partner as the client pays. This proposal asks for $90,000 for 30% of the company.',
 st('Our Mission', 'a win for everybody') +
 '<div class="callout" style="font-size:9pt"><b>Every file is a win for the client, the closer, the servicing partner and the owners.</b> The client gets a program they can afford and understand. The closer is paid fairly and quickly. The partner receives a qualified file that stays. The owners build a company that scales into a full front and back end — with proper marketing, proper capital and a system that already runs the business today.</div>' +
 kv([('The ask', '$90,000', '30% of Funding Tier LLC · tranches optional (page 9)'),
     ('Capital returned', 'Ahead of 70 / 30', 'after costs, reserve, tax and the Manager\'s draw, 100% of member distributions go to Paul until $90,000 is back'),
     ('Mature month, safe case', M(S1S['net']), 'owner + 3 Egypt closers · net after every cost', 'g'),
     ('Lowest the bank gets', M(S1S['low']), f'of $90,000 · cash-positive from month {S1S["cashPos"]}', 'g')]) +
 '<div class="cols c2">' +
 '<div>' + st('What You Are Buying Into') + ul([
   '<b>A working system, not an idea.</b> ai.fundingtier.com is the company\'s custom operating system: deal router, scripts, training, hiring, pay engine and this model, all tied to the app.krestmarketing.com sub-account that runs marketing, communications and the data pushed to backends.',
   '<b>Four programs from one call.</b> Debt settlement, debt validation, debt resolution and tax resolution — each with a known payout schedule.',
   '<b>Credit data.</b> A TransUnion credit-data purchase gateway (for mail campaigns) is built. An Array integration is available to us — a tool that pings a credit report for a pass / fail on a range or specific credit parameters, which can cut the credit-pull costs charged by the backend providers; it is not built yet and carries a minimum-use commitment that is carried as an operating cost.',
   '<b>Transparent to the partner.</b> You see the same dashboards, bank view and model the operator sees, every day.']) + '</div>' +
 '<div>' + st('The Plan In One Breath') + ol([
   'Hire three Egypt-based closers at $12/hour (CallBlade, referred by Shield Services) on a 1–2 week trial; Nathan closes alongside them.',
   f'Buy live transfers at $14 per call (2-minute buffer) to keep every seat busy; first 90 days all files go to Shield Services.',
   f'Reach the operating reserve ({M(S1S["months"][5]["res"])}) by about month {S1S["reserveMet"]}; then add mail and social to fill 25% of volume, never more than 50%.',
   'Add closers and a team lead by the dollar rules on page 8; distributions start once the reserve is met; after the Manager\'s draw, 100% of member distributions go to Paul until his $90,000 is back, then 70 / 30.']) +
 where('Business Plan (Exhibit B) §1–§3 · Operating Model → Growth Plan on ai.fundingtier.com') + '</div></div>', doc, 2, T))

# 2 Already built
P.append(page('Investment Proposal · 2', 'What Is Already Built',
 'The investment funds people and calls, not software. Everything below exists and runs today; the investor receives live access to all of it at closing.',
 '<div class="cols c3">' +
 f'<div class="card" style="--c:var(--teal)"><h3>ai.fundingtier.com — the operating system</h3><div class="sub">Custom-built; the deal router is part of it</div>' + ul([
   'Deal router: debt, state, account types and the client\'s priority pick the program and show the payout',
   'State-aware scripts and enrollment SOPs for every program',
   'Training library, hiring pipeline with AI résumé screening and the state hiring map',
   'My Deals &amp; Pay: every closer sees each file\'s expected pay date',
   'Operating Model: Growth Plan, Scale Planner, Election Planner (this document\'s numbers)'], 'b sm') + '</div>' +
 f'<div class="card" style="--c:var(--blue)"><h3>app.krestmarketing.com — the sub-account</h3><div class="sub">Marketing, communications, data to backends</div>' + ul([
   'Contacts, pipelines, workflows, call tracking and campaign attribution',
   'Universal do-not-call management and litigator scrub integrated into every campaign',
   'Dialer, SMS and ringless-voicemail campaigns on purchased data when we choose to run our own',
   'Automations that push each prospect\'s general information to the backend partner, which then enrolls the client',
   'Recruiting pipeline for closers and BPOs'], 'b sm') + '</div>' +
 f'<div class="card" style="--c:var(--purple)"><h3>Data, QC and pay</h3><div class="sub">Built for cost control and clean files</div>' + ul([
   '<b>TransUnion credit-data purchase gateway</b> for prescreened mail-piece marketing',
   '<b>Array</b> (integration available, not yet built) — pings a credit report for a pass / fail on a range or specific credit parameters; not a full pull; can reduce the backend providers\' credit-pull costs; minimum-use commitment carried as overhead',
   'AI call-QC: every enrollment call transcribed and scored before the first draft',
   'Pay and reconciliation engine: matches every partner remittance to its deal, applies clawbacks, produces the commission run the CPA posts from',
   'E&amp;O insurance in place ($400–$500 / year)'], 'b sm') + '</div></div>' +
 st('What The Stack Means For The Investment') +
 '<div class="cols c2">' + ul([
   '<b>No build risk.</b> The $90,000 is spent on closers and calls that produce files from month one.',
   '<b>Lower cost per file.</b> Credit-parameter checks, DNC scrubbing and QC happen before money is spent on a bad call.',
   '<b>Nothing lives in a spreadsheet or in anyone\'s head.</b> Every number in this proposal is produced by the same engine the business runs on.']) +
 ul(['<b>Full visibility.</b> AI-powered dashboards tell both members what to continue, cut or improve — daily briefing, weekly recap, monthly KPI review.',
   '<b>Scales without re-platforming.</b> Adding closers, a second transfer vendor or a mail program is configuration, not development.',
   '<b>Compliance by design.</b> Consent records, DNC, state exclusions and disclosures are enforced in the system, not remembered by reps.']) + '</div>', doc, 3, T,
 where='Business Plan §2 · live demo on ai.fundingtier.com'))

# 3 How we are paid
l15, c15, e15 = DE['cases']['SAFE']['15000']['LEVEL'], DE['cases']['SAFE']['15000']['CS'], DE['cases']['SAFE']['15000']['LEGACY']
P.append(page('Investment Proposal · 3', 'How Funding Tier Is Paid',
 '"Payout" means what the servicing partner remits to Funding Tier for a file. Only US-based W-2 closers earn a commission from it; the owner-operator and offshore closers do not, so a file they close keeps the whole payout.',
 table([('Program', ''), ('Partner', ''), ('Payout to Funding Tier', ''), ('When it arrives', ''), ('Risk window', '')], [
  ['<b>Debt Settlement</b>', 'Level Debt', '8% of enrolled debt, once' + math('$15,000 × 8% = $1,200'), 'Month 2, after the first client payment clears', 'Clawed back if payment 2 is missed (NSF) — modelled at 15%'],
  ['<b>Debt Validation</b>', 'Shield Services', f'<b>Perpetual:</b> 100% of (payment − $40) for payments 1–4, then 35% to month 36' + math(f'$15k file: ${SH15["payment"]} − $40 = ${SH15["perpFirst"]} × 4, then ${round(SH15["perpLater"])} × 32 = {M(SH15["fullPerp"])}') + f'<b>Buyout:</b> one lump after the first payment clears' + math(f'(${SH15["payment"]} − $40) × 65% × 6 = {M(SH15["buyout"])}; × 100% × 6 on $20k+'), 'Perpetual: monthly. Buyout: once', 'Perpetual: cancellations. Buyout: ends at the lump'],
  ['<b>Debt Resolution</b>', 'Elite Legal Practice', '<b>Residual:</b> payments 1–2 pass through less $4; from payment 3, 60% of (draft − $84) monthly for the term written (48 standard, up to 60)' + math(f'$15k file: {M(DE["elp"]["15000"]["m1"])} × 2, then {M(DE["elp"]["15000"]["m3"])} × 42 = {M(DE["elp"]["15000"]["full"])}') + '<b>Accelerated:</b> 90% of net for months 1–7, then 25% to month 24', 'Monthly', 'Cancellations; $250 minimum client draft caps the term at 44 months on $15k'],
  ['<b>Tax Resolution</b>', 'Milestone Tax Solutions', '50% of the $500 Phase 1 fee; 40–60% of the ~$5,000 Phase 2 fee by volume tier', 'As each client payment clears', '~15-day refund window'],
 ], 'sm', ['1.15in', '1.25in', '4.1in', '1.6in', '1.9in']) +
 '<div class="cols c32">' +
 '<div>' + st('Worked Example — One $15,000 File, Safe Case', 'blended across the standing program mix') +
 table([('Program', ''), ('Full payout if the client stays', 'n'), ('Expected payout (60% first pay, attrition)', 'n'), ('Net profit after US-based closer commission paid', 'n')], [
  ['Debt Settlement', M(l15['full']), M(l15['exp']) + math('$1,200 × 60% first pay × 85% make payment 2'), M(l15['netUs']) + math(f'{M(l15["exp"])} − {M(l15["comm"])} commission × 51% survive')],
  ['Debt Validation (perpetual)', M(c15['full']), M(c15['exp']) + math('36 payments × survival each month'), M(c15['netUs']) + math(f'{M(c15["exp"])} − $275 × 51%')],
  ['Debt Resolution (residual)', M(e15['full']), M(e15['exp']) + math('44 payments × survival each month'), M(e15['netUs']) + math(f'{M(e15["exp"])} − $275 × 51%')],
 ], 'sm', ['1.45in', '1.15in', '1.6in', '1.7in'],
 tot=['Blended, program mix 33 / 40 / 27', '', (M(SLIDE['cases']['SAFE']['rows'][0]['netNoComm']), 'n'), (M(SLIDE['cases']['SAFE']['rows'][0]['netUs']), 'n')]) + '</div>' +
 '<div>' + st('Read This Table Like This') + ul([
   '<b>Full payout</b> is the contract maximum if the client never cancels.',
   '<b>Expected payout</b> discounts every month by the chance the client is still paying. Safe case: 60% of files make the first payment; 15% of the rest cancel each month.',
   '<b>Net profit after US-based closer commission paid</b> subtracts the closer\'s commission, which is only owed if the file survives to its payout month.',
   f'<b>A file the owner or an Egypt closer closes keeps the whole expected payout</b> — {M(SLIDE["cases"]["SAFE"]["rows"][0]["netNoComm"])} blended — because they are paid hourly (offshore) or through the distribution agreement (owner).',
   'The target case (70% first pay, 10% cancel) lifts the blended figure to ' + M(SLIDE['cases']['TARGET']['rows'][0]['netUs']) + ' / ' + M(SLIDE['cases']['TARGET']['rows'][0]['netNoComm']) + '.'], 'b sm') +
 where('Business Plan §6–§7 for every program at $15k and $25k · Election Planner on ai.fundingtier.com') + '</div></div>', doc, 4, T))

# 4 Team plan
P.append(page('Investment Proposal · 4', 'The Team: Plan A, Plan B, Plan C',
 'Paul asked for the fallback. Here is how closers are sourced, what each costs, and when a lead is added. HR services are not needed until in-house US closers are hired; until then the company runs virtual with the owner and a BPO.',
 '<div class="cols c3">' +
 '<div class="card" style="--c:var(--teal)"><h3>Plan A — Egypt closers via CallBlade</h3><div class="sub">Referred by Shield Services · experienced in Shield enrollments</div>' + ul([
   '<b>$12 / hour</b>, minimum 3 full-time closers (the vendor\'s floor)',
   '1–2 week paid trial; underperformers replaced from the same source',
   'KPI bonus 3–6% of monthly hourly pay for exceptional performance (page 10 and Exhibit C)',
   f'Seat cost {M(S1S["seatCost"])} / month all-in' + math(f'$12 × 40 hrs × 4.333 wks = $2,080 + 4.5% bonus = {M(S1S["seatCost"])}'),
   'No commission; files they close keep 100% of the payout'], 'b sm') + '</div>' +
 '<div class="card" style="--c:var(--blue)"><h3>Plan B — a cheaper BPO elsewhere</h3><div class="sub">Phone-sales and debt experience required</div>' + ul([
   'Philippines, Latin America or South Africa floors at $6–$10 / hour',
   'Same trial, same KPIs, same bonus structure',
   'Only if Plan A fails its trial or cannot staff 3 seats',
   'Scripts, router and QC are identical — the vendor plugs into the same system',
   'Risk: accent and debt-program knowledge; mitigated by Shield-only first 90 days'], 'b sm') + '</div>' +
 '<div class="card" style="--c:var(--purple)"><h3>Plan C — one US closer on a draw</h3><div class="sub">Well-vetted, virtual, any state · 30-day trial</div>' + ul([
   'W-2 inside sales must earn at least state minimum wage every week, so a draw against commission is required (Exhibit B §9 lists every state)',
   f'Seat cost {M(S2S["seatCost"])} / month before commission' + math('$16.90 × 40 × 4.333 + payroll taxes'),
   'Commission: 0.75–1.25% of enrolled debt (settlement) or $275–$400 per file (validation / resolution), paid when the file pays',
   'Best sourced from debt-relief hubs: Arizona, Texas, Florida, New York, California — National Debt Relief and Americor already hire this role remotely',
   'HR provider engaged only when this plan is used'], 'b sm') + '</div></div>' +
 '<div class="cols c2">' +
 '<div>' + st('Hours Of Operation') + ul([
   '<b>Monday–Friday 6:00 AM – 7:00 PM Pacific</b>; <b>Saturday 6:00 AM – 3:00 PM</b> (the clock-in window enforced in the system)',
   'Closers work 8-hour shifts inside that window; transfers are bought to match the hours staffed',
   'Egypt closers work the US daytime shift (their evening); schedules are set weekly in app.krestmarketing.com'], 'b sm') + '</div>' +
 '<div>' + st('When A Lead Or Manager Is Added') + ul([
   '<b>One operator can train and monitor up to 3 closers</b> while closing — the launch roster is sized to that limit',
   '<b>At the 4th closer, promote or hire a team lead</b> (US W-2, $22–$26 / hour + a 0.1–0.25% override on team volume); one lead per 5–6 closers',
   'The lead runs daily huddles, QC review and vendor disputes so Nathan stays on enrollments and the partner relationship'], 'b sm') + '</div></div>', doc, 5, T,
 where='Business Plan §8–§9 · Playbook §3'))

# 5 Marketing mix
sl = SLIDE['cases']['SAFE']; cpd = sl['costPerDeal']
P.append(page('Investment Proposal · 5', 'Where The Calls Come From',
 'Purchased live transfers fill the seats from day one. Mail and paid social are added only to replace part of the transfer volume with larger-debt files — a target of 25% of volume, never more than 50%.',
 '<div class="cols c3">' +
 '<div class="card" style="--c:var(--teal)"><h3>Live transfers — the standard election</h3>' + ul([
   '<b>$14 per call, 2-minute buffer</b>: we pay only if the caller stays on 2 minutes',
   f'Cost per deal {M(cpd["transfer"])}' + math('$14 ÷ 15% close'),
   'Typical enrolled debt $15,000; vendors can fill well beyond the launch roster',
   'Closers are trained to qualify or disqualify fast for higher stated debt loads; <b>income verification is the payment-propensity test</b> — no file without it'], 'b sm') + '</div>' +
 '<div class="card" style="--c:var(--blue)"><h3>Direct mail on TransUnion data</h3>' + ul([
   '$25,000 of maxed-out revolving debt is the <b>floor</b>; target band $25,000–$250,000',
   f'Cost per deal {M(cpd["mail"])}' + math('$0.80 / piece ÷ 1.25% response ÷ 70% qualified ÷ 20% close'),
   'Firm-offer-of-credit structure through the lender partner; attorney-reviewed creative',
   'Starts after the reserve is met; sized to replace 25% of transfer volume'], 'b sm') + '</div>' +
 '<div class="card" style="--c:var(--purple)"><h3>Paid social, and our own data campaigns</h3>' + ul([
   f'Social: $35 / lead, 30% qualified, 15% close → {M(cpd["social"])} per deal — retargeting of mailed ZIPs only',
   '<b>Option:</b> run our own dialing, SMS and ringless-voicemail campaigns on purchased co-registration data through app.krestmarketing.com, scrubbed against DNC and litigator lists first',
   'Both are tested at Tier 1 budgets and continued only on measured cost per enrolled file'], 'b sm') + '</div></div>' +
 '<div class="cols c32">' +
 '<div>' + st('Sliding Scale — Average Debt A Mail Or Social Deal Needs To Be Profitable', 'safe case · expected net per deal after all survival discounts') +
 table([('Average enrolled debt', ''), ('Net per deal, US-closed', 'n'), ('Net per deal, owner / offshore-closed', 'n'), ('vs transfer cost ' + M(cpd['transfer']), ''), ('vs mail cost ' + M(cpd['mail']), ''), ('vs social cost ' + M(cpd['social']), '')],
  [[M(r['debt']), M(r['netUs']), M(r['netNoComm']),
    ('<span class="tag h">profitable</span>', ''),
    ('<span class="tag h">profitable</span>' if r['netUs'] > cpd['mail'] * 1.1 else '<span class="tag a">thin</span>' if r['netUs'] > cpd['mail'] * 0.9 else '<span class="tag x">loses</span>', ''),
    ('<span class="tag h">profitable</span>' if r['netUs'] > cpd['social'] * 1.1 else '<span class="tag a">thin</span>' if r['netUs'] > cpd['social'] * 0.9 else '<span class="tag x">loses</span>', '')] for r in sl['rows']], 'sm', ['1.3in', '1.1in', '1.4in', '1in', '1in', '1in']) + '</div>' +
 '<div>' + st('What The Scale Says') + ul([
   f'<b>Transfers pay at any debt load</b> — {M(cpd["transfer"])} to acquire a file worth {M(sl["rows"][0]["netUs"])}+ expected.',
   f'<b>Mail needs about $20,000 average debt</b> to clear its {M(cpd["mail"])} cost with margin when a US closer takes the call, and $15,000 when the owner or an offshore closer does.',
   f'<b>Social needs about $25,000</b> — which is why both channels only mail or target the $25k+ band.',
   'The target case (70% first pay, 10% cancel) moves every row up by roughly 45%.',
   '<b>Why a cap of 50%:</b> marketing calls are inbound and arrive in bursts; transfers are bought by the hour. Keeping transfers at half the volume keeps every seat busy every day.'], 'b sm') +
 where('Business Plan §10 · Growth Plan → Methods on ai.fundingtier.com') + '</div></div>', doc, 6, T))

# 6 Four scenarios
def srow(o, label):
    return [f'<b>{label}</b>', N(o['deals']), M(o['rev']), M(o['labor']), M(o['mkt']), M(o['comm']), M(o['other']), (M(o['net']), 'n g' if o['net'] > 0 else 'n r'), M(o['y1']), M(o['low']), str(o['cashPos'] or '—'), str(o['reserveMet'] or '—')]
hdr = [('Scenario', ''), ('Deals / mo', 'n'), ('Revenue', 'n'), ('Labor', 'n'), ('Transfers', 'n'), ('US commission', 'n'), ('Other overhead', 'n'), ('Net profit / mo', 'n'), ('Year-1 net', 'n'), ('Lowest bank', 'n'), ('Cash+ month', 'n'), ('Reserve met', 'n')]
P.append(page('Investment Proposal · 6', 'Four Launch Scenarios',
 'Two teams, two assumption sets. "Safe" is 15% close, 60% of first payments clear, 15% monthly cancel on perpetual files. "Target" is 16%, 70% and 10%. Both carry a 15% second-payment NSF on settlement files and push 100% of files to Shield Services for the first 90 days.',
 st('Mature Month (Average Of Months 43–48) And First-Year Results', 'owner-operator closes in every scenario · virtual office · $90,000 in the bank on day one') +
 table(hdr, [srow(S1S, 'S1 · Owner + 3 Egypt closers — Safe'), srow(S1T, 'S1 · Owner + 3 Egypt closers — Target'), srow(S2S, 'S2 · Owner + 3 US W-2 closers — Safe'), srow(S2T, 'S2 · Owner + 3 US W-2 closers — Target'), srow(R0S, 'Reference · Owner only — Safe'), srow(R1S, 'Reference · Owner + 1 US closer (Plan C) — Safe')], 'sm',
  ['2.5in', '0.6in', '0.8in', '0.7in', '0.75in', '0.85in', '0.85in', '0.9in', '0.85in', '0.8in', '0.6in', '0.6in']) +
 '<div class="cols c3">' +
 '<div>' + st('What Moves The Number') + ul([
   f'<b>Who closes.</b> Three Egypt closers cost {M(S1S["labor"])} / month and earn no commission; three US closers cost {M(S2S["labor"])} plus {M(S2S["comm"])} in commission — a {M(S1S["net"] - S2S["net"])} / month difference at maturity.',
   f'<b>Retention.</b> Moving from safe to target adds {M(S1T["net"] - S1S["net"])} / month on the same team — the single biggest lever, and it is operational: qualification, income verification, QC and service.',
   '<b>Volume per seat.</b> Every scenario assumes 1.25 deals per 8 closer hours — the planning floor, not a stretch.'], 'b sm') + '</div>' +
 '<div>' + st('How To Read "Lowest Bank"') + ul([
   f'The bank never drops below {M(S1S["low"])} in S1 — the first month costs {M(-S1S["months"][0]["net"])} before any payout arrives, and payouts start in month 2.',
   f'S2 dips to {M(S2S["low"])} because US seats cost more and commission is paid as files pay.',
   'No scenario runs out of cash. "Cash+" is the first month the bank is back above $90,000.'], 'b sm') + '</div>' +
 '<div>' + st('Why Numbers Are Not Promises') + ul([
   'Close rate, first-pay rate and cancellations are measured monthly and the model is re-run with actuals.',
   'Partners remit in arrears; a late remittance shifts a month, not the total.',
   'Tax resolution is modelled at zero — upside only.'], 'b sm') +
 where('Business Plan §11 for the full 24-month tables · Growth Plan → Bottom Line') + '</div></div>', doc, 7, T))

# 7 Month by month S1 + decision rules
def mrows(o, n=12):
    return [[f'Month {m["mo"]}', N(m['deals']), M(m['rev']), M(m['labor']), M(m['mkt']), M(m['comm']), (M(m['net']), 'n g' if m['net'] >= 0 else 'n r'), M(m['bank']), M(m['res']), P0(m['util'])] for m in o['months'][:n]]
mh = [('', ''), ('Deals', 'n'), ('Revenue', 'n'), ('Labor', 'n'), ('Transfers', 'n'), ('US comm.', 'n'), ('Net', 'n'), ('Bank', 'n'), ('Reserve target', 'n'), ('Seats busy', 'n')]
P.append(page('Investment Proposal · 7', 'Month By Month — Recommended Launch (S1, Safe Case)',
 'Owner + 3 Egypt closers, virtual, transfers only, 100% Shield Services for 90 days. Revenue is low in month 1 because partners pay after the client\'s first payment clears; the bank is the proof the plan holds.',
 '<div class="cols c32">' +
 '<div>' + table(mh, mrows(S1S), 'xs', ['0.7in', '0.5in', '0.75in', '0.65in', '0.7in', '0.65in', '0.75in', '0.8in', '0.8in', '0.6in']) + '</div>' +
 '<div>' + st('Signals On This Path') + ul([
   f'<b>Month 1:</b> {M(-S1S["months"][0]["net"])} out, nothing in yet. Bank {M(S1S["months"][0]["bank"])}.',
   f'<b>Month 2:</b> first Shield payouts arrive; the month is nearly break-even.',
   f'<b>Month 3–4:</b> profitable; the mix opens to all three programs after the 90-day Shield-only period.',
   f'<b>Month {S1S["reserveMet"]}:</b> operating reserve of {M(S1S["months"][S1S["reserveMet"]-1]["res"])} reached (6 months of overhead) — distributions begin and marketing tests may start.',
   f'<b>Month 12:</b> bank {M(S1S["m12bank"])}. Year-1 net {M(S1S["y1"])}.',
   f'<b>Month 24:</b> bank {M(S1S["m24bank"])} before distributions; year-2 net {M(S1S["y2"])}.'], 'b sm') +
 st('Same Team, Target Case') + ul([
   f'Year-1 net {M(S1T["y1"])}; mature month {M(S1T["net"])}; lowest bank {M(S1T["low"])}.'], 'b sm') +
 where('Business Plan §11 shows all four scenarios for 24 months · Growth Plan → Month by Month') + '</div></div>', doc, 8, T))

seat1, seat2 = S1S['seatCost'], S2S['seatCost']
res = S1S['months'][5]['res']
P.append(page('Investment Proposal · 8', 'Decision Rules With Dollar Thresholds',
 'Every hire, every marketing dollar and every distribution follows a rule both members can read off the bank balance and the accounts receivable. The dashboard shows each rule in green, amber or red every morning.',
 table([('Decision', ''), ('Rule', ''), ('Dollar threshold on the launch plan', ''), ('Who decides', '')], [
  ['<b>Add a closer</b>', 'Seats at or above 90% busy for 2 consecutive months <b>and</b> bank ≥ reserve target + 3 months of the new seat', f'Offshore seat: bank ≥ {M(res + 3 * seat1)}' + math(f'{M(res)} reserve + 3 × {M(seat1)}') + f'US seat: bank ≥ {M(res + 3 * seat2)}' + math(f'{M(res)} reserve + 3 × {M(seat2)}'), 'Operator, within the approved roster plan; both members above rep level'],
  ['<b>Add a team lead</b>', 'On the 4th closer, or when QC review falls behind 48 hours', f'Bank ≥ {M(res + 3 * 4500)}' + math(f'{M(res)} + 3 × $4,500 lead cost'), 'Both members'],
  ['<b>Start a marketing test</b>', 'Reserve met <b>and</b> bank ≥ reserve + 2 months of the test budget; seats have room for the inbound', f'Tier 1 mail ($12k / mo): bank ≥ {M(res + 24000)}' + math(f'{M(res)} + 2 × $12,000'), 'Operator within budget (+25% flex); Tier 3 ($90k+) both members'],
  ['<b>Scale a channel</b>', 'Two consecutive months at or under target cost per enrolled file <b>and</b> first-pay rate within 5 points of transfers', f'Mail target ≤ {M(cpd["mail"])} per file; social ≤ {M(cpd["social"])}', 'Operator; reported weekly'],
  ['<b>Cut a channel</b>', 'Cost per enrolled file 25% over target for 2 months, or first-pay rate 10 points under transfers', f'Mail > {M(cpd["mail"] * 1.25)} per file; social > {M(cpd["social"] * 1.25)}', 'Operator, immediately'],
  ['<b>Distribute</b>', 'Bank ≥ reserve target + accounts receivable due within 30 days is <b>not</b> counted; distribute the excess monthly by the waterfall', f'Bank > {M(res)} after the month\'s commission run', 'Monthly close, both members see the calculation'],
  ['<b>Hold / pause hiring</b>', 'Bank below reserve target for 2 months, or first-pay rate under 50% for 2 months', f'Bank < {M(res)}', 'Automatic; reviewed at the monthly KPI meeting'],
 ], 'sm', ['1.3in', '3.6in', '3in', '2in']) +
 '<div class="cols c2">' + ul([
   '<b>Accounts receivable</b> means payouts the partners owe for files that have already made their first payment. It is tracked by the reconciliation engine and shown beside the bank balance, but a distribution is never paid out of it.',
   '<b>Reserve target</b> = 6 months of fixed overhead (labor, software, telephony, insurance) + a chargeback buffer. It is recalculated monthly as the team grows.'], 'b sm') +
 ul(['<b>Reserve and proceeds sit in a high-yield interest-bearing business account</b> under dual control; the operating account holds one month of spend.',
   '<b>Why these thresholds:</b> three months of a seat is the longest a new closer can run before their files pay; two months of a test is the shortest honest read of a channel.'], 'b sm') + '</div>', doc, 9, T,
 where='Playbook §6 · Growth Plan → Month by Month signals'))

# 9 Use of funds / capital unlocks
P.append(page('Investment Proposal · 9', 'What The $90,000 Unlocks',
 'In dollars: what the capital buys, when it is spent, and the two ways to fund it. A $40–50k reserve from day one is only possible if the full $90,000 arrives at closing — so the tranches are optional and the choice is Paul\'s.',
 '<div class="cols c2">' +
 '<div>' + st('Use Of Funds — First 6 Months, S1 Safe Case') +
 table([('Line', ''), ('Amount', 'n')], [
  ['3 Egypt closers × 6 months' + math(f'{M(seat1)} × 3 × 6'), M(seat1 * 18)],
  ['Live transfers × 6 months' + math(f'{M(S1S["mkt"])} / mo × 6'), M(S1S['mkt'] * 6)],
  ['Software, telephony, credit pulls, QC, insurance × 6' + math(f'{M(S1S["other"])} / mo × 6'), M(S1S['other'] * 6)],
  ['Legal and accounting for the transaction', '$6,000'],
  ['First direct-mail test (month 6+)', '$12,000'],
 ], 'sm', ['6in', '1.4in'], tot=['Total cash committed in the first 6 months', (M(seat1 * 18 + S1S['mkt'] * 6 + S1S['other'] * 6 + 18000), 'n')]) +
 '<div class="callout" style="margin-top:6px"><b>Payouts cover most of it.</b> ' + f'Revenue in months 2–6 is {M(sum(m["rev"] for m in S1S["months"][:6]))}, so the deepest draw on the $90,000 is only {M(90000 - S1S["low"])} — the rest is reserve and runway.</div></div>' +
 '<div>' + st('Two Ways To Fund It — Paul\'s Choice') +
 table([('', ''), ('Three tranches of $30,000', ''), ('$90,000 at closing', '')], [
  ['<b>Timing</b>', 'Closing, month 2, month 3; 10% of the company issued per tranche', '100% at closing; 30% issued at once'],
  ['<b>Reserve on day one</b>', '$30,000 — covers month 1 only; reserve builds from payouts', '$90,000 — a $40–50k reserve exists from day one, as Paul asked'],
  ['<b>Team size at launch</b>', '3 offshore closers (the vendor minimum)', '3 offshore closers; a 4th seat and team lead can be added by month 4 instead of month 5–6'],
  ['<b>Marketing test</b>', 'After the reserve is met (~month 5)', 'Can start month 3 if seats have room'],
  ['<b>Operator capacity</b>', 'Nathan trains and monitors 3 closers while closing — at his limit', 'Same limit; wider scale only once a lead is added, so the extra capital accelerates by ~2 months, not more'],
  ['<b>Risk to Paul</b>', 'Lower: the 2nd and 3rd tranche follow two months of real results', 'Higher: all capital committed before the first payouts'],
 ], 'sm', ['1.3in', '2.2in', '2.4in']) +
 ul(['<b>Recommendation:</b> either works on the numbers. The tranches protect Paul; the lump sum buys about two months of speed and the reserve he asked for. Capital not yet spent sits in the high-yield account either way.'], 'b sm') + '</div></div>', doc, 10, T,
 where='Term Sheet (Exhibit A) — Purchase Price · Business Plan §11'))

# 10 Roles and governance
P.append(page('Investment Proposal · 10', 'Roles, Governance And Controls — In Plain Terms',
 'The investor wants the ability to help operate, and that help may be essential. Neither member is restricted from the business: operating decisions are the Manager\'s day to day, the big ones need both, and the investor can take on operating duties whenever both agree.',
 '<div class="cols c2">' +
 '<div class="card" style="--c:var(--teal)"><h3>Role Of The Operator (Nathan Pottish, Manager)</h3>' + ul([
   'Runs sales daily: closes files, trains and monitors closers, manages the transfer vendors and partner relationships',
   'Owns the system (ai.fundingtier.com, app.krestmarketing.com), compliance, hiring within the approved roster, and marketing within budget (+25% flex)',
   'Produces the daily briefing, weekly recap and monthly KPI review from the dashboards',
   'Paid through the distribution agreement — no commission or bonus on files he closes (page 11)'], 'b sm') + '</div>' +
 '<div class="card" style="--c:var(--navy)"><h3>Role Of The Investor (Paul Dillenback, Member)</h3>' + ul([
   'Capital partner with full information rights: live dashboards, bank view, the model, monthly P&amp;L by the 15th, quarterly review, K-1',
   '<b>May help operate</b> — vendor sourcing, hiring, finance, partner relationships — in any role both members agree to in writing, with duties and any pay set at the time',
   'Co-signer on every account; one of the two approvals above $10,000; one of the two votes on both-member actions',
   'Brings accounting and HR providers at his expense (HR engaged only when US W-2 closers are hired)'], 'b sm') + '</div></div>' +
 st('What The Control Terms Mean') +
 table([('Term', ''), ('What it means in practice', ''), ('Example', '')], [
  ['<b>Dual control above $10,000</b>', 'Any single payment, transfer or purchase over $10,000 needs both members to approve it at the bank before it goes out. It applies per transaction, including a one-time purchase. Routine payroll, transfer-vendor invoices and software under $10,000 are the Manager\'s alone.', 'A $12,000 mail drop: both approve. A $9,000 vendor invoice: Manager approves. Two $6,000 payments to the same vendor in a week: flagged for both.'],
  ['<b>Debt over $25,000 or any guarantee</b>', 'The company may not borrow more than $25,000 in total, or sign any loan, lease or vendor contract that one member personally guarantees, without both members agreeing. Below $25,000 (a software plan, a short vendor net-30) is routine.', 'A $30,000 line of credit, an office lease, or a personal guarantee on a transfer vendor\'s terms: both members.'],
  ['<b>Both-member actions</b>', 'Issuing equity, selling the company or its software, changing a program partner or the commission plan, hiring above rep level, related-party payments, expansion events (office, Tier 3 marketing, back-end servicing), new bank or card accounts, amending the operating agreement.', 'Adding a second validation partner: both. Replacing one transfer vendor with another: Manager.'],
  ['<b>Operating cadence</b>', '<b>Daily briefing</b> (calls, files, first-pays, bank) · <b>weekly recap</b> (per-closer KPIs, vendor quality, cost per file) · <b>monthly KPI review</b> (P&amp;L, waterfall, hire / invest / hold decision, minuted). An AI-powered dashboard reports what to continue, cut or improve.', 'Monday 8 AM briefing in the shared channel; Friday recap; the 15th of the month review.'],
  ['<b>Deadlock</b>', 'If both-member action is not agreed: a mediation step, then status quo (no action).', 'Disagreement on an office lease → stays virtual.'],
 ], 'sm', ['1.6in', '5.4in', '2.9in']), doc, 11, T, where='Term Sheet (Exhibit A) · Playbook §1–§2'))

# 11 Waterfall & founder comp
P.append(page('Investment Proposal · 11', 'Distribution Waterfall And Operator Compensation',
 'Nathan is a day-to-day operator who also closes files. He is paid through the distribution agreement — a draw and a performance bonus — never a commission on his own enrollments. Here is the order money moves in, and two worked months.',
 '<div class="wf">' +
 ''.join(f'<div class="nd" style="--c:{c}"><div class="k">{k}</div><div class="t">{t}</div><div class="d">{d}</div></div>' + ('<div class="a">›</div>' if i < 6 else '') for i, (k, t, d, c) in enumerate([
   ('Step 1', 'Operating costs', 'Labor, transfers, software, US closer commission net of clawbacks, marketing within budget', 'var(--teal)'),
   ('Step 2', 'Operating reserve', '6 months of overhead + chargeback buffer, held in the high-yield account', 'var(--blue)'),
   ('Step 3', 'Tax distributions', 'Each member\'s share of taxable income × the CPA\'s assumed rate, quarterly', 'var(--amber)'),
   ('Step 4', 'Manager draw', '$10,000 / month, paid only in a profitable month; $12,500 after 3 straight profitable months', 'var(--purple)'),
   ('Step 5', 'Capital returned', 'After steps 1–4 (including the Manager\'s draw), 100% of member distributions to Paul until $90,000 is returned', 'var(--navy)'),
   ('Step 6', 'Accrued draw', 'Any Manager draw skipped in loss months, without interest', 'var(--mut)'),
   ('Step 7', '70 / 30', 'Remaining profit 70% Nathan, 30% Paul; Manager bonus 10% of profit above $20k / mo, quarterly, after payback', 'var(--green)')])) + '</div>' +
 '<div class="cols c2">' +
 '<div>' + st('Worked Month A — Month 6, S1 Safe Case', 'reserve already met') +
 table([('Line', ''), ('Amount', 'n')], [
  ['Net profit after every operating cost (step 1)', M(S1S['months'][5]['net'])],
  ['Reserve top-up (step 2) — already at target', '$0'],
  ['Tax distributions (step 3), est. 30% of profit' + math(f'{M(S1S["months"][5]["net"])} × 30% → 70 / 30 to members'), '-' + M(S1S['months'][5]['net'] * 0.30)],
  ['Manager draw (step 4)', '-$10,000'],
  ['To Paul — capital returned (step 5), after the draw', (M(S1S['months'][5]['net'] * 0.70 - 10000), 'n g')],
 ], 'sm', ['5.2in', '1.3in'], tot=['Paul\'s cumulative payback after this month', (M(sum(max(0, m['net'] * 0.7 - 10000) for m in S1S['months'][S1S['reserveMet']-1:6])), 'n')]) + '</div>' +
 '<div>' + st('Worked Month B — A Mature Month After Payback', 'mature month, S1 safe case') +
 table([('Line', ''), ('Amount', 'n')], [
  ['Net profit after every operating cost', M(S1S['net'])],
  ['Tax distributions, est. 30%', '-' + M(S1S['net'] * 0.30)],
  ['Manager draw', '-$12,500'],
  ['Manager performance bonus' + math(f'({M(S1S["net"])} − $20,000) × 10%'), '-' + M((S1S['net'] - 20000) * 0.10)],
  ['Distributable', M(S1S['net'] * 0.70 - 12500 - (S1S['net'] - 20000) * 0.10)],
  ['→ Paul 30%', (M((S1S['net'] * 0.70 - 12500 - (S1S['net'] - 20000) * 0.10) * 0.30), 'n g')],
  ['→ Nathan 70% (plus draw and bonus above)', (M((S1S['net'] * 0.70 - 12500 - (S1S['net'] - 20000) * 0.10) * 0.70), 'n g')],
 ], 'sm', ['5.2in', '1.3in']) + '</div></div>' +
 ul([f'<b>Payback timing on this path:</b> Paul\'s $90,000 is returned in roughly {max(1, round(90000 / max(1, (S1S["months"][11]["net"] * 0.7 - 10000))))} months of mature profit after the reserve is met — about month {S1S["reserveMet"] + max(1, round(90000 / max(1, (S1S["months"][11]["net"] * 0.7 - 10000))))} on the safe case. Tax rate is illustrative; the CPA sets it.'], 'b sm'), doc, 12, T, where='Term Sheet — Distributions, Manager Compensation'))

# 12 Buyback, liquidity, minority, FMV clause
val = 3.0 * S1S['net'] * 12
P.append(page('Investment Proposal · 12', 'Buyback Options, Liquidity And The Minority Position',
 'What Paul can sell, when, and for how much — and what owning 30% of a private LLC does and does not give him.',
 '<div class="cols c2">' +
 '<div>' + st('Founder Buyback Options') + ul([
   '<b>Option 1 — year 5:</b> Nathan may buy 10% of the company (one third of Paul\'s stake) during a 12-month window starting on the 5th anniversary.',
   '<b>Option 2 — year 10:</b> a further 10% during a 12-month window starting on the 10th anniversary.',
   '<b>Early window:</b> Option 1 opens at year 3 if Paul has already received $180,000 in cumulative distributions (2× his capital).',
   '<b>Price for each 10% slice</b> = 10% of company value, less a 20% discount. <b>Company value</b> = 3.0 × trailing-twelve-month net profit after Manager compensation, per the books. No window opens until 12 profitable months exist.',
   '<b>Paul keeps the last 10%</b> for as long as he likes; the options are Nathan\'s right, never Paul\'s obligation to sell more.'], 'b sm') +
 st('Two Worked Scenarios') +
 table([('', ''), ('Scenario 1 — safe case holds', 'n'), ('Scenario 2 — target case holds', 'n')], [
  ['Trailing-12-month net profit after Manager comp' + math('mature month × 12 − draw − bonus'), M(S1S['net'] * 12 - 12500 * 12 - (S1S['net'] - 20000) * 0.1 * 12), M(S1T['net'] * 12 - 12500 * 12 - (S1T['net'] - 20000) * 0.1 * 12)],
  ['Company value at 3.0×', M(3 * (S1S['net'] * 12 - 12500 * 12 - (S1S['net'] - 20000) * 0.1 * 12)), M(3 * (S1T['net'] * 12 - 12500 * 12 - (S1T['net'] - 20000) * 0.1 * 12))],
  ['Price of one 10% slice' + math('10% × value × 80%'), M(0.1 * 0.8 * 3 * (S1S['net'] * 12 - 12500 * 12 - (S1S['net'] - 20000) * 0.1 * 12)), M(0.1 * 0.8 * 3 * (S1T['net'] * 12 - 12500 * 12 - (S1T['net'] - 20000) * 0.1 * 12))],
  ['Paul\'s distributions by year 5, after payback (30% share, illustrative)', M(0.3 * (S1S['net'] * 0.7 - 12500 - (S1S['net'] - 20000) * 0.1) * 12 * 4.5), M(0.3 * (S1T['net'] * 0.7 - 12500 - (S1T['net'] - 20000) * 0.1) * 12 * 4.5)],
 ], 'sm', ['3.3in', '1.6in', '1.6in']) + '</div>' +
 '<div>' + st('Liquidity — What "Private" Means') + ul([
   'There is no market for LLC units; Paul\'s ways out are the buyback options, a sale of the company (tag-along: he sells on the same terms as Nathan), or a private sale after Nathan\'s right of first refusal.',
   'Distributions, not resale, are the return: after the Manager\'s draw, 100% of member distributions until his $90,000 is back, then 30% of profit for as long as he holds.',
   'On death or permanent disability of either member, the other may buy the interest at the formula price; key-person insurance on the Manager funds it.'], 'b sm') +
 st('Minority Position — What 30% Gives And Does Not') + ul([
   '<b>Gives:</b> a vote on every both-member action, co-signature on every account, dual approval above $10,000, full information rights, pre-emptive rights on new issuance, and a seat in operations by agreement.',
   '<b>Does not give:</b> control of day-to-day decisions, or the power to remove the Manager except for cause as defined in the operating agreement.',
   '<b>Dilution protection:</b> no new units without his approval; first right to fund future capital on the same terms as any outsider.'], 'b sm') +
 st('If Nathan\'s Interest Is Ever Purchased') + ul([
   'Nathan\'s 70% may be purchased for <b>fair market value</b> (independent appraisal, or 3.0× trailing-twelve-month net profit if the parties agree to the formula as the maximum) on his death, permanent disability or a written election to sell.',
   'Proceeds are paid to <b>Samuel Pottish (brother), Sophia Pottish (sister) and Daniel Pottish (nephew), split three ways</b>, as named in the operating agreement\'s transfer-on-death provision; the purchaser receives the units free of claims.'], 'b sm') + '</div></div>', doc, 13, T,
 where='Term Sheet — Repurchase Options, Transfer Restrictions, Continuity'))

# 13 Risk factors
P.append(page('Investment Proposal · 13', 'Risk Factors And How Each Is Mitigated',
 'Every business in this category faces the same risks. What differs is whether the mitigation is a policy someone remembers or a control the system enforces. Ours are the second kind.',
 '<div class="cols c2">' +
 ''.join(f'<div class="card" style="--c:{c}"><h3>{t}</h3><div class="sub">{s}</div>{ul(m, "ck")}</div>' for t, s, m, c in [
  ('TCPA, do-not-call and litigators', 'The largest single legal exposure in outbound marketing', [
    'Pre-scrubbed lists only — from the vendor or scrubbed internally before any dial, text or voicemail',
    'Blacklist Alliance litigator and serial-plaintiff scrub on every list',
    'Universal DNC management integrated in app.krestmarketing.com; opt-outs honored across every channel in real time',
    'Transfer vendors hold written consent records; coached or suspicious transfers disputed weekly',
    'Prior express written consent captured on every web form and mail response'], 'var(--red)'),
  ('Client attrition and chargebacks', 'Files that stop paying stop paying us', [
    'Income verification on every file — payment propensity, not just willingness',
    'AI call-QC before the first draft; pressure or confusion goes to review',
    'Shield-only first 90 days so closers master one program before three',
    'Settlement second-payment NSF (15%) and perpetual cancellations are in every number here',
    'Buyout election on validation files when cancellation runs above the break-even (page 12 of Exhibit B)'], 'var(--amber)'),
  ('Partner concentration', 'Four partners remit our revenue', [
    'Four programs, three partners for debt plus a tax partner; any one can be replaced without re-platforming',
    'Remittances reconciled to the deal within 5 days; a late remittance is chased, not absorbed',
    'Changing a partner is a both-member action'], 'var(--blue)'),
  ('Key person', 'Nathan is operator, closer and builder', [
    'Every SOP, script and process lives in the system, not in his head',
    'Team lead added at the 4th closer; investor may take an operating role',
    'Key-person insurance; continuity clause at formula price'], 'var(--purple)'),
  ('Regulatory change', 'State debt-relief laws and the Telemarketing Sales Rule evolve', [
    'Partners, not Funding Tier, hold the client funds and program licences',
    'Router enforces state exclusions before a quote; the state hiring map does the same for reps',
    'No advance fees ever; scripted disclosures; E&O policy in place'], 'var(--teal)'),
  ('Capital and cash', 'The first month is paid before the first payout', [
    f'Lowest bank {M(S1S["low"])} on the safe case; reserve target in {S1S["reserveMet"]} months',
    'Hold rule: no hiring while the bank is under the reserve target',
    'Reserve and proceeds in a high-yield interest-bearing account under dual control'], 'var(--navy)'),
 ]) + '</div>' +
 where('Examples of the scrub reports, consent records and QC scorecards are in the Funding Tier system (Admin → Compliance) and in the Playbook §7'), doc, 14, T))

# 14 SWOT + market in brief
P.append(page('Investment Proposal · 14', 'Market And SWOT In Brief',
 'Demand is large and permanently replenished; the constraint is finding, qualifying and keeping the right clients inside the rules. Exhibit B §4 carries the full market assessment with sources.',
 '<div class="cols c2">' +
 '<div>' + st('The Market In Four Numbers') + kv([
   ('US household debt', '$19.1T', 'Q3 2026, New York Fed — up $520B in a year'),
   ('Credit card balances', '$1.285T', 'record; 6.9% flowing into 90+ day delinquency annually'),
   ('Debt settlement services', '$4.1B', '2026 market, 7.2% CAGR to $5.8B by 2031 (Mordor)'),
   ('Share in North America', '61%', 'Freedom, National Debt Relief, Beyond, Americor, ClearOne lead')]) +
 '<div style="height:6px"></div>' + ul([
   '<b>Growth:</b> delinquencies at their highest since 2016 and digital settlement platforms expanding; the category is forecast to grow 7% a year.',
   '<b>Profitability:</b> front-end enrollment carries no servicing cost and no client funds; margin is set by cost per file and retention — the two levers this plan measures weekly.',
   '<b>Tax resolution:</b> the IRS accepted only 14% of 38,797 offers in compromise in FY2025 — a large population of taxpayers who need professional help; Milestone prices every case before it is sold.'], 'b sm') + '</div>' +
 '<div class="swot">' +
 f'<div class="q" style="--c:var(--green)"><h3>Strengths</h3>{ul(["Integrated system already built and running", "Four programs from one call; partner-paid, no client funds", "TransUnion data gateway built; Array credit-parameter check available", "Low fixed cost: virtual, offshore closers, no office"], "b sm")}</div>' +
 f'<div class="q" style="--c:var(--red)"><h3>Weaknesses</h3>{ul(["Single operator at launch; capacity caps at 3 closers until a lead is added", "Revenue arrives 1–2 months behind enrollment", "Retention is assumed, then measured — the safe case is deliberately conservative", "New brand; no mail history yet"], "b sm")}</div>' +
 f'<div class="q" style="--c:var(--blue)"><h3>Opportunities</h3>{ul(["Record consumer debt and rising delinquency", "$25k+ households reachable through TransUnion prescreen mail", "Tax resolution attached to the same call at no acquisition cost", "Build the back end later and keep the whole payout"], "b sm")}</div>' +
 f'<div class="q" style="--c:var(--amber)"><h3>Threats</h3>{ul(["TCPA litigators and state rule changes", "Partner terms can change at renewal", "Transfer vendor quality and price", "Larger competitors outbid on paid media"], "b sm")}</div>' +
 '</div></div>', doc, 15, T, where='Business Plan §4 (market, sources) and §5 (SWOT)'))

# 15 Closing
P.append(page('Investment Proposal · 15', 'Closing Process And Acknowledgement',
 'Six steps from agreement to the first closer\'s first call. Counsel for each party reviews everything; the Term Sheet (Exhibit A) carries the binding confidentiality and expense terms.',
 '<div class="cols c2">' +
 '<div>' + st('Steps To Close') + ol([
   '<b>Agree the terms</b> in this proposal and Exhibit A; choose tranches or lump sum.',
   '<b>Counsel drafts</b> the Membership Interest Purchase Agreement and the Amended and Restated Operating Agreement, attaching Exhibits B (Business Plan), C (Compensation Schedule), the Accounts Schedule and the Confidentiality / IP terms, including the transfer-on-death provision for Nathan\'s interest.',
   '<b>Accountant\'s tax review</b>: partnership classification, EIN and state filings, assumed tax-distribution rate.',
   '<b>Open the accounts</b>: operating account and high-yield reserve account with both members as signers and dual control above $10,000.',
   '<b>Sign and fund</b> the first tranche (or the full $90,000); investor access to dashboards, model and bank view is live the same day.',
   '<b>Launch</b>: CallBlade trial begins; transfers switched on; Shield-only for 90 days; first daily briefing the next morning.']) + '</div>' +
 '<div>' + st('Open Items To Confirm With Paul') + ul([
   'Investing personally or through an entity he controls',
   'Tranches or $90,000 at closing',
   'Whether he wants an operating role now, and in what area',
   'Accounting and HR providers he will bring (HR deferred until US W-2 hires)',
   'Any changes to the buyback windows or the 3.0× formula'], 'b sm') +
 st('Still Being Confirmed With Partners') + ul([
   'Exact remittance timing on Shield buyouts and ELP accelerated elections',
   'Measured monthly cancellation by program (replaces the 15% placeholder as data arrives)',
   'Milestone: TCPA liability allocation, excluded states, exit terms'], 'b sm') +
 '<div class="sig"><div>Funding Tier LLC · by Nathan Pottish, Manager · Date</div><div>Paul Dillenback · Date</div></div></div></div>', doc, 16, T))

write('investment-proposal.html', 'Funding Tier — Investment Proposal', P)
print('proposal pages', len(P))
