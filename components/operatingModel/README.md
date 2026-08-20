# Operating Model

Self-contained rebuild of the Operating Model page.

```
components/
  FundingTierOperatingModel.tsx   ← entry, replaces the existing file of this name
  fundingTierEngine.ts            ← UNTOUCHED (shared with the other two apps)
  operatingModel/
    types.ts        Type definitions
    config.ts       Defaults, contract terms, brand identity + real partner logos
    labor.ts        Schedules → paid hours → overtime → cost, per person
    backends.ts     Revenue + commission per backend, survival curves
    costs.ts        Monthly cost ledger, a formula on every line
    simulate.ts     Capacity, cohort roll-forward, month-by-month cash
    trace.ts        "Show the math" derivation builder
    ui.tsx          Tokens, tooltip, partner logo badge, layout primitives
    RosterEditor.tsx
    ShowTheMath.tsx
    OperatingModel.tsx
scripts/
  verify-operating-model.ts       ← 42 assertions, Node-only
```

`app/operating-model/page.tsx` needs no change — it still imports
`components/FundingTierOperatingModel`.

The `.ts` files under `operatingModel/` are pure TypeScript: no React, no DOM,
no `Date.now()`, no `Math.random()`. Deterministic and server-renderable.

Run the checks:

```bash
npx esbuild scripts/verify-operating-model.ts --bundle --platform=node \
  --format=cjs --outfile=/tmp/verify.cjs && node /tmp/verify.cjs
```

42 assertions covering paid-hour and overtime arithmetic, wage-floor and BPO-band
validation, hybrid role splits, capacity derivation, cost-ledger integrity, cash
reconciliation, DID multipliers, and Elite Legal Practice exact-penny drafting.
