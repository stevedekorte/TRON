import {chromium,webkit} from '@playwright/test';
import assert from 'node:assert/strict';
const engine=process.env.TRON_TEST_ENGINE==='webkit'?webkit:chromium;
const browser=await engine.launch(engine===chromium?{channel:'chrome',headless:true}:{headless:true});
try{
 for(const reducedMotion of ['no-preference','reduce']){
  const page=await browser.newPage({reducedMotion});
  // Hold every external script and stylesheet: no app code can run.
  await page.route('**/*',route=>['script','stylesheet'].includes(route.request().resourceType())?route.abort():route.continue());
  await page.goto(process.env.TRON_URL??'http://127.0.0.1:5188/',{waitUntil:'domcontentloaded'});
  assert(await page.locator('#loading').isVisible());assert(await page.locator('#intro').isHidden());
  const states=new Set();
  for(let i=0;i<12;i++){
   states.add(await page.locator('.loading-dots').evaluate(el=>[...el.children].map(s=>getComputedStyle(s).opacity).join(',')));
   await page.waitForTimeout(180);
  }
  assert.equal(states.size,4,`all dot states animate before scripts/styles with ${reducedMotion}`);
  assert.equal(await page.evaluate(()=>typeof window.tronLoadingReport),'undefined');
  await page.screenshot({path:`test-results/loading-bootstrap-${process.env.TRON_TEST_ENGINE??'chrome'}-${reducedMotion}.png`});
  await page.close();
 }
 console.log('Initial dots animate with scripts and styles blocked, including reduced motion.');
}finally{await browser.close();}
