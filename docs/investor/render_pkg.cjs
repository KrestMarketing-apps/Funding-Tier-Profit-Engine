// Render the investor package to PDF and report overflowing pages.
// Usage: node render_pkg.cjs [name ...]   (names: proposal termsheet bizplan playbook)
const { chromium } = require('playwright');
const DOCS = {
  proposal: ['investment-proposal.html', 'Funding-Tier-Investment-Proposal.pdf'],
  termsheet: ['term-sheet.html', 'Funding-Tier-Term-Sheet-Exhibit-A.pdf'],
  bizplan: ['business-plan.html', 'Funding-Tier-Business-Plan.pdf'],
  playbook: ['playbook.html', 'Funding-Tier-Operating-Playbook.pdf'],
};
const DIR = '/home/claude/ftdocs/';
(async () => {
  const b = await chromium.launch();
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(DOCS);
  for (const n of names) {
    const [src, out] = DOCS[n];
    const p = await b.newPage();
    await p.goto('file://' + DIR + src, { waitUntil: 'networkidle' });
    await p.waitForTimeout(600);
    const report = await p.evaluate(() => {
      const pages = [...document.querySelectorAll('.page')];
      return pages.map((pg, i) => {
        const pad = pg.querySelector('.pad') || pg.querySelector('.cover');
        if (!pad) return null;
        const foot = pg.querySelector('.foot');
        const limit = foot ? foot.getBoundingClientRect().top - 6 : pg.getBoundingClientRect().bottom;
        let maxBottom = 0, maxRight = 0;
        const pr = pg.getBoundingClientRect();
        pad.querySelectorAll('*').forEach((el) => { const r = el.getBoundingClientRect(); if (r.height > 0) { maxBottom = Math.max(maxBottom, r.bottom); maxRight = Math.max(maxRight, r.right); } });
        const over = maxBottom - limit; const overX = maxRight - (pr.right - 40);
        const msgs = [];
        if (over > 0) msgs.push(`page ${i + 1}: over bottom by ${over.toFixed(0)}px`);
        if (overX > 0) msgs.push(`page ${i + 1}: over right by ${overX.toFixed(0)}px`);
        return msgs.length ? msgs.join(', ') : null;
      }).filter(Boolean);
    });
    console.log(n, report.length ? report.join('; ') : 'no overflow');
    await p.pdf({ path: DIR + out, preferCSSPageSize: true, printBackground: true, landscape: true });
    await p.close();
  }
  await b.close();
})();
