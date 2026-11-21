import json
from pkg_common import *
S1S = sc('S1', 'SAFE'); S1T = sc('S1', 'TARGET')
doc = 'Term Sheet · Exhibit A'; T = 6; Q = []

def tsrow(k, v): return f'<tr><th>{k}</th><td>{v}</td></tr>'
def ts(rows): return '<table class="ts">' + ''.join(tsrow(k, v) for k, v in rows) + '</table>'

Q.append(cover('Term Sheet', 'Exhibit A — Summary of proposed terms for a 30% membership interest in Funding Tier LLC. Non-binding except Confidentiality, Intellectual Property and Expenses.',
 [('Issuer', 'Funding Tier LLC, a California limited liability company'), ('Investor', 'Paul Dillenback, or an entity he wholly owns'), ('Date', DATE), ('Version', '2.0 — tranches optional; investor operating role; continuity and family-proceeds clause; high-yield reserve account'), ('Attached to', 'Investment Proposal v2.0'), ('Exhibits', 'B Business Plan · C Compensation Schedule · D Operating Playbook')],
 'This Term Sheet summarises the principal terms of a proposed investment. Except for the sections marked binding, it is a non-binding expression of intent and creates no obligation to complete the transaction. Definitive agreements prepared by counsel will govern.'))

Q.append(page('Exhibit A · 1', 'The Securities, The Price And The Money',
 'Who is buying what, for how much, and how cash moves afterwards.',
 ts([
  ('Issuer', 'Funding Tier LLC. The Company\'s software, program-partner agreements, domains, telephone numbers and accounts remain in the Company; no new entity is formed.'),
  ('Investor', 'Paul Dillenback, directly or through an investment entity wholly owned by him.'),
  ('Securities', 'Membership interests representing thirty percent (30%) of all membership interests on a fully issued basis; the founder, Nathan Pottish, holds seventy percent (70%).'),
  ('Purchase price', 'Ninety thousand dollars ($90,000). <b>At the Investor\'s election</b>, payable either' + ul([
    '<b>in full at closing</b>, with the full 30% issued at closing — which allows a $40,000–$50,000 operating reserve from day one; or',
    '<b>in three equal tranches of $30,000</b> — at closing, on the first day of the second month after closing, and on the first day of the third month — with ten percent (10%) issued on receipt of each tranche.'], 'b sm') + 'Capital not yet deployed is held in the Company\'s high-yield interest-bearing account.'),
  ('Use of proceeds', 'Launch roster (three offshore closers at $12 / hour, or the Plan B / Plan C alternatives in the Business Plan), purchased live transfers at $14 per call, software and telephony, legal and accounting costs of the transaction, insurance, and the first direct-mail test once the operating reserve is met.'),
  ('Distributions (waterfall)', 'Available cash is applied each month in this order:' + ol([
    'Operating costs, including US-based closer commissions, offshore performance bonuses and clawbacks, and marketing within budget;',
    'An operating reserve equal to six months of operating overhead plus a chargeback buffer sized on trailing-twelve-month commission paid, held in the high-yield account;',
    'Quarterly tax distributions to each member equal to the member\'s allocated taxable income multiplied by an assumed combined rate set by the Company\'s accountant;',
    'The Manager\'s draw (below);',
    'One hundred percent (100%) of remaining member distributions (after the Manager\'s draw in step 4) to the Investor until the Investor has received $90,000;',
    'Any accrued and unpaid Manager draw;',
    'Thereafter seventy percent (70%) to the founder and thirty percent (30%) to the Investor, with the Manager\'s performance bonus paid quarterly from distributable profit above $20,000 per month.'])),
  ('Accounts', 'Operating reserve and undistributed proceeds are held in a high-yield, interest-bearing business account; the operating account holds about one month of spend. Interest earned belongs to the Company.'),
 ]), doc, 2, T))

Q.append(page('Exhibit A · 2', 'Compensation, Buyback And Continuity',
 'How the Manager is paid, the founder\'s options to buy back part of the Investor\'s interest, and what happens to each member\'s interest on death, disability or a decision to sell.',
 ts([
  ('Manager compensation', ul([
    'A monthly draw of $10,000, payable only in a month in which net profit after the draw is positive; increased to $12,500 per month after three consecutive profitable months.',
    'A performance bonus of ten percent (10%) of distributable profit in excess of $20,000 per month, paid quarterly, commencing after the Investor has received $90,000.',
    'Unpaid draw accrues without interest and is paid under step 6 of the waterfall.',
    'The Manager earns <b>no commission, SPIFF or bonus on files he closes</b>; those files keep the whole payout for the Company. Full schedule in Exhibit C.'], 'b sm')),
  ('Founder repurchase options', ul([
    'Option 1: during a twelve-month window beginning on the fifth anniversary of closing, the founder may repurchase ten percent (10%) of the Company\'s membership interests from the Investor for cash at closing of the repurchase.',
    'Option 2: a further ten percent (10%) during a twelve-month window beginning on the tenth anniversary.',
    'Option 1 opens on the third anniversary if the Investor has by then received $180,000 in cumulative distributions.',
    'Price for each ten percent slice = ten percent of Company value less a twenty percent (20%) discount. Company value = three (3.0) times trailing-twelve-month net profit after Manager compensation and before distributions, per the Company\'s books. No window opens until twelve profitable months exist.',
    'The Investor retains the final ten percent (10%) unless he elects to sell; the options are rights of the founder, never obligations of the Investor.'], 'b sm')),
  ('Death, disability and election to sell — Investor', 'On the death or permanent disability of the Investor, the founder or the Company may purchase the Investor\'s interest at the repurchase formula above, payable over no more than twenty-four months with interest at the applicable federal rate.'),
  ('Death, disability and election to sell — Founder', ul([
    'On the death or permanent disability of the founder, or on his written election to sell, the founder\'s interest may be purchased by the Investor or the Company for <b>fair market value</b>, determined by an independent appraiser, or, if the parties so agree in the operating agreement, capped at the repurchase formula (3.0× trailing-twelve-month net profit) as the defined maximum.',
    'Proceeds of any such purchase are paid, under a transfer-on-death provision in the operating agreement, to <b>Samuel Pottish (brother), Sophia Pottish (sister) and Daniel Pottish (nephew), in three equal shares</b>, or to their estates; the purchaser receives the units free of claims.',
    'The Company will maintain key-person insurance on the founder sized to fund the purchase.'], 'b sm')),
  ('Deadlock', 'A deadlock on a both-member action is resolved by a mediation step followed by the status quo (no action) unless the operating agreement specifies otherwise.'),
 ]), doc, 3, T))

Q.append(page('Exhibit A · 3', 'Management, Approvals And Controls',
 'The Manager runs the business day to day. Both members decide the large matters. The Investor may take on operating duties by mutual written agreement.',
 ts([
  ('Management', 'The Company is manager-managed. Nathan Pottish is the Manager with authority over sales operations, program partners, product and software, compliance, closer hiring and compensation within the approved roster plan, marketing within the approved budget (with a twenty-five percent (25%) flex above the marketing line without a second approval), and vendor selection.'),
  ('Investor participation in operations', 'The Investor is a member and is not required to perform operating duties. <b>The Investor may assume operating responsibilities</b> — including vendor sourcing, hiring, finance, partner relationships or any other area — in a role, scope and compensation (if any) that both members agree to in writing. Neither member may unilaterally restrict the other from the business; changes to an agreed role require both members.'),
  ('Actions requiring both members', ul([
    'Incurring debt over $25,000 in aggregate, or any personal guarantee by either member;',
    'Issuing equity or admitting members; sale of the Company or of material intellectual property;',
    'Changing a program partner or the structure of the closer commission plan; hiring above rep level (team lead, manager);',
    'Related-party payments; expansion events (Tier 3 marketing at $90,000 per month or more, an office lease, any back-end servicing build);',
    'Marketing spend beyond the flex ceiling; opening any bank, merchant, card or lending account; amending the operating agreement.'], 'b sm')),
  ('Banking and spending controls', ul([
    'The two members are the only authorized signers on every Company account.',
    '<b>Dual control above $10,000:</b> any single transaction over $10,000 — including a one-time purchase — requires approval by both members at the bank before release. Transactions under $10,000 within the approved budget are released by the Manager. Split payments to the same payee within seven days that together exceed $10,000 are treated as one transaction.',
    'No cards, ACH credentials or wire authority are issued to any other person. The payroll provider executes only batches approved by a member and holds no standing debit authority. The accountant has view-only access.',
    'All accounts are listed on an Accounts Schedule to the operating agreement.'], 'b sm')),
  ('Operating cadence and reporting', ul([
    '<b>Daily briefing</b>: calls, files, first-payment clears, bank balance and accounts receivable, posted by the Manager from the dashboard.',
    '<b>Weekly recap</b>: per-closer KPIs, vendor quality, cost per enrolled file, QC flags.',
    '<b>Monthly KPI review</b>: profit and loss by the 15th, waterfall calculation, hire / invest / hold decision minuted; quarterly review meeting; annual Schedule K-1 and tax return.',
    'An AI-powered dashboard reports what to continue, cut or improve; both members have the same access.'], 'b sm')),
 ]), doc, 4, T))

Q.append(page('Exhibit A · 4', 'Rights, Services, Confidentiality And Closing',
 'Information and transfer rights, the back-office arrangement, the binding sections, and the conditions to close.',
 ts([
  ('Information rights', 'Continuous access for the Investor to the Company\'s operating model, dashboards, reconciliation and commission software, and bank accounts (view); monthly profit and loss by the fifteenth of the following month; quarterly review meeting; annual Schedule K-1 and tax return.'),
  ('Transfer restrictions', 'No transfer of membership interests without a right of first refusal in favor of the other member. Tag-along rights for the Investor on any sale by the founder. Pre-emptive (pro rata) rights for both members on any new issuance; the Investor has the first right to fund future capital needs on the same terms as offered to third parties. The transfer-on-death provision for the founder\'s interest (page 3) is an exception to the ROFR as to the named beneficiaries\' right to receive proceeds, not to the purchaser of the units.'),
  ('Back-office services', 'The Investor will cause his accounting provider to serve the Company at the Investor\'s expense from closing, and his human-resources provider from the first hire of a US-based W-2 closer. The Company\'s reconciliation and commission software is the computation of record for revenue recognition, commission payable, bonuses, clawbacks and distribution allocation; the accountant posts from its monthly run. Providers sign the Company\'s confidentiality agreement before access.'),
  ('Expansion events and future capital', 'Expansion events require both members, a separate budget, and new capital contributed pro rata or raised from third parties subject to the pre-emptive and ROFR rights above. A move into back-end servicing is treated as a separate financing.'),
  ('Non-solicitation', 'During membership and for twelve months after, neither member will solicit the Company\'s closers, vendors or program partners for a competing enterprise.'),
  ('Confidentiality and intellectual property (binding)', 'Each party keeps the other\'s confidential information, including this Term Sheet and the Investment Proposal, confidential, and uses it only to evaluate and complete the transaction. All software, scripts, standard operating procedures, the pay engine, data, lists and creative used in the business are and remain the Company\'s property; neither member may use or disclose them outside the Company; these obligations survive withdrawal, repurchase or dissolution. The Company holds a written licence to its platform and hosting arrangements.'),
  ('Tax matters', 'Admission of the Investor converts the Company to partnership tax classification (Form 1065 and Schedules K-1). The Company\'s accountant will confirm the employer identification number, update state filings to list both members, and set the assumed rate for tax distributions.'),
  ('Conditions to closing', 'Execution of a Membership Interest Purchase Agreement and an Amended and Restated Operating Agreement reflecting these terms, with the Business Plan, Compensation Schedule, Accounts Schedule and Confidentiality / IP exhibits attached; completion of the accountant\'s tax review; opening of the operating and high-yield reserve accounts with dual control; execution of the platform and hosting licence; confidentiality agreements signed by the accounting (and, when engaged, HR) providers.'),
  ('Expenses (binding) · Governing law · Expiration', 'Each party bears its own expenses; the Company\'s legal costs for the definitive documents are a Company expense and may be paid from the first tranche. California law. Except for the binding sections, this Term Sheet creates no obligation to complete the transaction and expires if definitive agreements are not executed within sixty (60) days of the date above, unless extended in writing.'),
 ]) + '<div class="sig"><div>Funding Tier LLC · by Nathan Pottish, Manager · Date</div><div>Paul Dillenback · Date</div></div>', doc, 5, T))

# Exhibit C — compensation schedule
Q.append(page('Exhibit C', 'Compensation Schedule',
 'Who is paid what, from which money, and when. Only US-based W-2 closers earn commission from a file\'s payout; offshore closers are paid hourly plus a KPI bonus; the Manager is paid through the distribution agreement.',
 table([('Role', ''), ('Base pay', ''), ('Variable pay', ''), ('Paid from / when', ''), ('Not paid', '')], [
  ['<b>Owner-operator / Manager</b> (Nathan Pottish)', 'Draw $10,000 / mo in profitable months; $12,500 after 3 consecutive profitable months', '10% of distributable profit above $20,000 / mo, quarterly, after investor payback; 70% member share', 'Distribution agreement — steps 4, 6 and 7 of the waterfall', 'No commission, SPIFF, bonus or override on files he closes'],
  ['<b>Offshore / BPO closer</b> (Egypt, CallBlade; or Plan B vendor)', '$12 / hour, 40 hours / week, 3-seat minimum' + math('$12 × 40 × 4.333 = $2,080 / mo'), '<b>Performance bonus 3–6% of monthly hourly pay</b> (plan default 4.5%), earned on monthly KPIs — deal quality (first-pay rate), hours, attentiveness (QC score) — and paid as a flat % of the revenue the closer generated' + math('$2,080 × 4.5% = $94 / mo at target'), 'Vendor invoice, monthly, from operating costs (step 1)', 'No commission on enrolled debt; no override'],
  ['<b>US-based W-2 closer</b> (Plan C, or later hires)', 'Draw / hourly at or above state minimum wage for every hour (California $16.90)' + math('$16.90 × 40 × 4.333 ≈ $2,929 / mo incl. payroll taxes'), 'Commission per file, paid when the file reaches its payout month and survives: settlement 0.75–1.25% of enrolled debt by monthly volume tier; validation $275 ($15k band) to $400 ($25k); resolution $275–$400; daily-deal bonus $50 / deal at 3+ per day, $75 at 5+', 'Commission run after remittance reconciliation; clawed back if the file fails before payout', 'Commission on files that never make a first payment'],
  ['<b>Team lead</b> (added at the 4th closer)', '$22–$26 / hour, US W-2', 'Override 0.1–0.25% of enrolled volume closed by the team', 'Payroll + monthly commission run', 'Override on the Manager\'s own files'],
  ['<b>Investor</b> (Paul Dillenback)', 'None unless an operating role is agreed in writing', '30% member share after payback; any agreed operating pay', 'Waterfall steps 3, 5 and 7', '—'],
 ], 'sm', ['1.7in', '2.2in', '3in', '1.8in', '1.5in']) +
 '<div class="cols c2">' + ul([
   '<b>Offshore bonus goal in plain terms:</b> a closer earning $2,080 / month can earn $62–$125 extra for a month of clean, well-qualified files and full attendance. It costs the Company about 2% of the payout on the files it rewards.',
   '<b>Why US closers get commission and offshore closers do not:</b> the US closer\'s draw is the legal minimum, so commission is the real pay; the offshore rate is a full market wage for the role.'], 'b sm') +
 ul(['<b>Ramp:</b> a new US closer\'s commission is earned at deal-month 3 for the first three months (one cycle later), never clawed back after the fact.',
   '<b>All variable pay is computed by the reconciliation engine</b> from partner remittances; the accountant posts from its monthly run.'], 'b sm') + '</div>', doc, 6, T,
 where='Business Plan §8 · Playbook §4'))

write('term-sheet.html', 'Funding Tier — Term Sheet (Exhibit A)', Q)
print('term sheet pages', len(Q))
