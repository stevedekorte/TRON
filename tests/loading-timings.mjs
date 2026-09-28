import {chromium,webkit} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const engine=process.env.TRON_TEST_ENGINE||'webkit';
const browser=await (engine==='webkit'?webkit:chromium).launch(engine==='webkit'?{headless:true}:{channel:'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});
 const page=await context.newPage(),errors=[],logs=[],reports=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.text().includes('TRON loading'))logs.push(m.text());});
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'test'}));
 for(let i=0;i<2;i++){
  if(i)await page.reload();else await page.goto('http://127.0.0.1:5173/?layoutSeed=1982');
  await page.waitForFunction(()=>window.tronLoadingReport?.().includes('Opening terminal ready'),{},{timeout:120000});
  await page.waitForTimeout(100);
  const report=await page.evaluate(()=>tronLoadingReport());
  assert(report.includes('Scenario / maze geometry'));assert(report.includes('First render submission'));
  reports.push({navigation:i?'reload':'first navigation',report});
 }
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.tronLoadingReport().includes('Player entered cycle arena'),{},{timeout:120000});
 reports.push({navigation:'arena entry',report:await page.evaluate(()=>tronLoadingReport())});
 assert(logs.length>10);assert.deepEqual(errors,[]);
 await writeFile(`test-results/loading-${engine}.json`,JSON.stringify({engine,reports,errors},null,2));
 console.log(JSON.stringify({engine,reports,errors},null,2));
}finally{await browser.close();}
