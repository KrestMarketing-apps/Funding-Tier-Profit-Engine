const { chromium } = require("playwright");
(async()=>{const b=await chromium.launch();
for (const [src,out] of [['playbook.html','Funding-Tier-Operating-Playbook.pdf']]) {
 const p=await b.newPage(); await p.goto('file:///home/claude/ftdocs/'+src,{waitUntil:'networkidle'}); await p.waitForTimeout(800);
 await p.pdf({path:'/home/claude/ftdocs/'+out,preferCSSPageSize:true,printBackground:true}); await p.close(); }
await b.close();})();
