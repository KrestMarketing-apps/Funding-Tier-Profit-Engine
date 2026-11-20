# Investor Documents

Source of record for the Paul Dillenback partnership documents and the operating playbook.

| File | What it is |
|---|---|
| `Funding-Tier-Partnership-Proposal-Paul-v2.pdf` | Proposal v2 (Nov 20, 2026): terms as agreed, what the $90k is for, launch options on safe assumptions, recommended path month by month, decision triggers, waterfall, closing steps and open items |
| `Funding-Tier-Operating-Playbook.pdf` | Operating playbook for both members: roles, rhythm, 90-day launch checklist, sales floor and file quality, marketing test protocol, monthly close and waterfall, scaling ladder, risk register, definitions |
| `proposal-v2.html`, `playbook.html` | Rendered sources (Letter, fixed 11in pages) |
| `build_docs.py` | Builds both HTML files; numbers are read from `launch-scenarios.json` so nothing is hand-typed |
| `launch-scenarios.ts` | Runs launch options A–F through the operating model at 60% first-pay and 15% / 6% monthly cancel; writes `launch-scenarios.json` |
| `render.cjs` | Playwright render to PDF (`preferCSSPageSize`, `printBackground`) |

Regenerate after any engine or assumption change:

```
npx tsx docs/investor/launch-scenarios.ts
python3 docs/investor/build_docs.py
node docs/investor/render.cjs
```

The live model is the Operating Model → Growth Plan section on ai.fundingtier.com (admin). The term-sheet record and the growth marketing budget plan live in the FUNDING TIER project.
