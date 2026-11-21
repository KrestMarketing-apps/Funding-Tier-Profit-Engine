# Investor Documents

Source of record for the Paul Dillenback partnership documents and the operating playbook.

The package is three separate documents, as any professional investment proposal would be:

| File | What it is |
|---|---|
| `Funding-Tier-Investment-Proposal.pdf` | Formal Investment Proposal (10 pages): cover, executive summary, company, how Funding Tier is paid, operating model and unit economics, financial illustrations, use of funds, terms / governance / controls, risk factors, closing process and signatures |
| `Funding-Tier-Business-Plan.pdf` | Business Plan, Exhibit B (12 pages): executive summary, company, programs / partners / payouts, customers and compliance, operations, organization and compensation (who earns commission), revenue model and unit economics ($15k worked example, US-closed vs offshore-closed), election strategy (buyout vs perpetual break-even chart, 100% / 50-50 / 100% scenarios), marketing plan, financial plan, KPIs / controls / risks / roadmap |
| `Funding-Tier-Term-Sheet-Exhibit-A.pdf` | Term Sheet, Exhibit A (3 pages, non-binding except confidentiality and expenses): securities, price and tranches, distribution waterfall, manager compensation, repurchase options, management and both-member actions, banking controls, information and transfer rights, back-office services, continuity, tax, conditions, expiration |
| `superseded-Funding-Tier-Partnership-Proposal-Paul-v2.pdf` | The Nov 20 update memo, superseded by the formal package (kept for the record) |
| `Funding-Tier-Operating-Playbook.pdf` | Operating playbook for both members: roles, rhythm, 90-day launch checklist, sales floor and file quality, marketing test protocol, monthly close and waterfall, scaling ladder, risk register, definitions |
| `investment-proposal.html`, `term-sheet.html`, `playbook.html` | Rendered sources (Letter, fixed 11in pages) |
| `build_bizplan.py` | Builds the Business Plan (reads `launch-scenarios.json` and `election-curves.json`) |
| `election-curves.ts` | Cumulative perpetual payout vs buyout lump by month at several cancellation rates; writes `election-curves.json` |
| `build_formal.py` | Builds the Investment Proposal and Term Sheet; `build_docs.py` builds the playbook (and the superseded memo); numbers are read from `launch-scenarios.json` so nothing is hand-typed |
| `launch-scenarios.ts` | Runs launch options A–F through the operating model at 60% first-pay and 15% / 6% monthly cancel; writes `launch-scenarios.json` |
| `render.cjs` | Playwright render to PDF (`preferCSSPageSize`, `printBackground`) |

Regenerate after any engine or assumption change:

```
npx tsx docs/investor/launch-scenarios.ts
npx tsx docs/investor/election-curves.ts
python3 docs/investor/build_bizplan.py && node docs/investor/render_bp.cjs
python3 docs/investor/build_formal.py && node docs/investor/render_formal.cjs
python3 docs/investor/build_docs.py && node docs/investor/render.cjs
```

The live model is the Operating Model → Growth Plan section on ai.fundingtier.com (admin). The term-sheet record and the growth marketing budget plan live in the FUNDING TIER project.
