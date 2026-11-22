"""One-page goals sheet for the daily 10-minute check-in (asked for by Paul)."""
from pkg_common import *
S1S = sc('S1', 'SAFE'); S1T = sc('S1', 'TARGET'); S1P = sc('S1', 'POSSIBLE')
res = S1S['months'][5]['res']; seat1 = S1S['seatCost']
doc = 'Goals One-Pager'; T = 1

def goal(n, title, big, smalls, help_, color):
    return (f'<div class="card" style="--c:{color};padding:6px 10px"><h3 style="display:flex;gap:8px;align-items:center"><span class="tag" style="background:{color};color:#fff;font-size:7.5pt;padding:1px 7px">{n}</span>{title}</h3>'
            f'<div class="sub" style="font-size:7.8pt;color:var(--ink);margin:3px 0 4px"><b>Big goal:</b> {big}</div>'
            f'<div style="display:grid;grid-template-columns:3fr 2fr;gap:8px"><div><div class="mini" style="font-weight:700;color:var(--teal2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:1px">Smaller goals that get us there</div>{ul(smalls, "ck")}</div>'
            f'<div><div class="mini" style="font-weight:700;color:var(--navy2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:1px">Where Paul can help</div>{ul(help_, "b sm")}</div></div></div>')

body = (
 '<div class="cols c2" style="gap:8px">' +
 goal('1', 'Close And Launch (Weeks 0–2)', 'Capital in, accounts open, three closers on the phones taking $14 transfers.',
      ['Term sheet agreed; counsel drafting MIPA + operating agreement', 'Operating + high-yield accounts open, both signers, dual control >$10k', 'CallBlade trial signed: 3 Egypt closers at $12/hr', 'Transfer vendor order placed for staffed hours; Shield script certified', 'Investor dashboard, model and bank view live'],
      ['Choose lump sum vs tranches', 'Bring the accountant; sign NDAs', 'Review the vendor agreements with Nathan', 'Be a second set of eyes on the first 10 QC\'d calls'], 'var(--teal)') +
 goal('2', 'Prove The Floor (Months 1–3)', f'108 deals a month, ≥85% Shield with 80% buyouts; bank back above $90,000 in month 2; reserve {M(res)} by month 3.',
      ['Each closer ≥1 deal per 8 hours by day 10; QC ≥80', 'Close rate ≥15% on billed transfers; disputes filed every Friday', 'First-pay rate ≥60% measured by closer and vendor', 'Month-1 → month-2 revenue {0} → {1}'.format(M(S1S['months'][0]['rev']), M(S1S['months'][1]['rev'])), 'Measured cancellation on the 20% perpetual cohort'],
      ['Daily 10-minute check-in on the dashboard', 'Vendor sourcing: a second transfer vendor shortlisted', 'Watch the bank vs reserve line with Nathan', 'Flag anything that looks like false hope'], 'var(--blue)') +
 goal('3', 'Pay Paul Back And Open The Mix (Months 3–8)', f'Capital returned ahead of the 70/30 split; all three programs live; mail test approved; team lead hired.',
      ['Distributions start the month the reserve is met (draw, then 100% to Paul)', 'Mix opens to 33/40/27 from month 4; election rule set from measured cancellation', f'4th closer when seats ≥90% busy 2 months and bank ≥ {M(res + 3 * seat1)}', f'Team lead at the 4th closer (bank ≥ {M(res + 3 * 4500)})', f'Tier 1 mail test ($12k/mo) when bank ≥ {M(res + 24000)}; cost per file ≤ $543'],
      ['Approve both-member items fast (lead hire, mail test)', 'Help recruit the team lead and vet Plan C US closers', 'Review the monthly waterfall with the CPA', 'Confirm Array / TransUnion terms and compliance vendors'], 'var(--purple)') +
 goal('4', 'Compound (Months 9–24)', f'Mature month {M(S1S["net"])} safe / {M(S1T["net"])} target; "possible" {M(S1P["net"])} with learning and tax; 6 closers + lead, then a second team.',
      ['Retention from 60% → 70% first-pay and ≤10% cancel through QC, service and partner oversight', 'Deals per 8 hours 1.25 → 1.5+ as closers learn (45-minute enrollments)', 'Tax resolution attached from month 6; measured attach rate', 'Mail + social at 25% of volume, never above 50%; average debt by channel reported monthly', 'Second team and lead; US closers only where they out-earn offshore'],
      ['Operating role if you want one (vendors, finance, partners)', 'Quarterly review: election rule, partner scorecards', 'Back-end servicing evaluated together as a separate financing', 'Keep the reserve and proceeds in the high-yield account'], 'var(--navy)') +
 '</div>' +
 st('The Daily 10-Minute Check-In', 'same four questions every day · dashboard open · 8 AM Pacific') +
 '<div class="cols c4" style="gap:8px">' +
 ''.join(f'<div class="callout" style="padding:5px 9px"><b>{q}</b><div class="mini">{a}</div></div>' for q, a in [
   ('1. Calls and deals yesterday?', 'Transfers taken, qualified, enrolled — by closer; vs 1.25 per 8 hours'),
   ('2. Money in, money out?', 'First-pay clears, remittances, bank vs reserve, A/R due'),
   ('3. Anything red?', 'QC flags, vendor quality, a closer under pace, a rule in red on the dashboard'),
   ('4. What is Paul doing today?', 'One item from the "where Paul can help" column — agreed, then done')]) + '</div>')

P = [page('For Paul · Goals', 'Goals, Smaller Goals, And Where You Can Help',
          'One page for the daily 10-minute meeting. Four big goals in order; the smaller goals that get us to each; and what Paul can pick up. Numbers are the launch plan (owner + 3 Egypt closers, safe case) unless marked.', body, doc, 1, T,
          where='Playbook §2 (rhythm) and §6 (dollar rules) · dashboard on ai.fundingtier.com')]
write('goals.html', 'Funding Tier — Goals One-Pager', P)
print('goals pages', len(P))
