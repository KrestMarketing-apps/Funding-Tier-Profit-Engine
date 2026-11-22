# Investor Documents

Source of record for the Paul Dillenback partnership package and the internal operating playbook. Version 2.0 (November 21, 2026): landscape layout, inverted-gradient section titles, bullets instead of paragraphs, one number column per line item, and every formula-derived figure shows its math on the line beneath.

| File | What it is |
|---|---|
| `Funding-Tier-Investment-Proposal.pdf` | Investment Proposal (16 pp): mission, what is built (ai.fundingtier.com + app.krestmarketing.com, TransUnion gateway, Array soft pulls), how the company is paid, Plan A/B/C closers and hours, call sources with the sliding average-debt scale, four launch scenarios, month-by-month, decision rules with dollar thresholds, what the capital unlocks (tranches optional), roles and governance in plain terms, waterfall and operator compensation worked months, buyback / liquidity / minority / FMV-and-family-proceeds clause, risk factors with mitigations, market and SWOT, closing |
| `Funding-Tier-Term-Sheet-Exhibit-A.pdf` | Term Sheet, Exhibit A (6 pp incl. Exhibit C Compensation Schedule): securities, price (lump sum or three tranches), waterfall, high-yield account, Manager compensation, repurchase options, continuity (FMV purchase of the founder's interest, proceeds to Samuel, Sophia and Daniel Pottish in three shares), management, investor operating role, both-member actions, dual control above $10,000, cadence, rights, services, confidentiality, closing |
| `Funding-Tier-Business-Plan.pdf` | Business Plan, Exhibit B (21 pp): executive summary and mission, company and system, programs and payouts, market assessment with sources, SWOT, customers and compliance (TCPA / Blacklist Alliance / DNC), operations and hours, organization and compensation, state-by-state hiring table and rules, unit economics (safe and target, $15k and $25k), election strategy, marketing plan, four scenarios with 24-month tables, retention through service, KPIs / controls / roadmap, glossary and FAQ, sources |
| `Funding-Tier-Operating-Playbook.pdf` | Operating Playbook, Exhibit D (10 pp, internal): roles, operating rhythm, 90-day Shield-first launch, sales floor and closer pay (offshore KPI bonus), marketing test protocol and the 25% / 50% mix rule, monthly close / waterfall / decision rules, compliance operations, scaling ladder and risk register, definitions |
| `Funding-Tier-Goals-One-Pager.pdf` | One page for Paul's daily 10-minute check-in: four big goals in order, the smaller goals under each, where Paul can help, and the four check-in questions (`build_goals.py`) |
| `superseded-Funding-Tier-Partnership-Proposal-Paul-v2.pdf` | The Nov 20 update memo, superseded (kept for the record) |
| `*.html` | Rendered sources (Letter landscape, fixed 8.5in pages) |

## Build

```
npx tsx docs/investor/launch-scenarios.ts    # four scenarios, election cases, sliding scale → launch-scenarios.json
npx tsx docs/investor/election-curves.ts     # perpetual vs buyout curves → election-curves.json
npx tsx docs/investor/deal-economics.ts      # per-program, per-debt expected payouts → deal-economics.json
cd docs/investor && python3 build_proposal.py && python3 build_termsheet.py && python3 build_bizplan.py && python3 build_playbook.py && python3 build_goals.py
node docs/investor/render_pkg.cjs            # Playwright → PDFs in /home/claude/ftdocs, reports any page that overflows
```

`pkg_common.py` holds the shared CSS and helpers; `states.py` holds the 2026 state minimum-wage, classification-test and talent data used in Business Plan §9. Numbers in every document are read from the JSON files so nothing is hand-typed.

Engine assumptions behind v2.0 (components/operatingModel/config.ts): offshore closers $12/hr (BPO band $3–$15) with a 4.5% KPI bonus (`laborPolicy.offshoreBonusPct`), transfers 100% at the $14 two-minute buffer, `volume.launchMix` sends 100% of files to Shield Services for months 1–3, Level Debt carries a 15% second-payment NSF, the model warns when mail/social exceed 50% of monthly deals, and the Array service-order minimum ($0 → $500 → $750 → $1,000 / month on the 12-month order from Nov 1, 2026) is a stepped fixed cost (`FixedCost.schedule`).

The live model is the Operating Model → Growth Plan section on ai.fundingtier.com (admin). The term-sheet record and the growth marketing budget plan live in the FUNDING TIER project.
