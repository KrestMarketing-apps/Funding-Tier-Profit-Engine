const { chromium } = require("playwright");
(async()=>{const b=await chromium.launch(); const p=await b.newPage(); await p.goto('file:///home/claude/ftdocs/business-plan.html',{waitUntil:'networkidle'}); await p.waitForTimeout(800);
await p.pdf({path:'/home/claude/ftdocs/Funding-Tier-Business-Plan.pdf',preferCSSPageSize:true,printBackground:true}); await b.close();})();
