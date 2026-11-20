const { chromium } = require("playwright");
(async()=>{const b=await chromium.launch();
for (const [src,out] of [['investment-proposal.html','Funding-Tier-Investment-Proposal.pdf'],['term-sheet.html','Funding-Tier-Term-Sheet-Exhibit-A.pdf']]) {
 const p=await b.newPage(); await p.goto('file:///home/claude/ftdocs/'+src,{waitUntil:'networkidle'}); await p.waitForTimeout(800);
 await p.pdf({path:'/home/claude/ftdocs/'+out,preferCSSPageSize:true,printBackground:true}); await p.close(); }
await b.close();})();
