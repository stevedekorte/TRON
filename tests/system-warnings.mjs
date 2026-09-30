import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],logs=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>logs.push(m.text()));
 await page.addInitScript(()=>localStorage.setItem('tron-enemy-ai',JSON.stringify({version:3,mode:'local'})));
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"Test outage"}'}));
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.querySelector('#system-warnings').textContent.includes('JEV unavailable'));
 await page.screenshot({path:'test-results/jev-brief-notice.png'});
 await page.waitForFunction(()=>document.querySelector('#system-warnings').hidden,null,{timeout:10000});
 assert(logs.some(t=>t.includes('JEV AI selected.')));
 await page.keyboard.press('KeyN');await page.waitForTimeout(100);
 assert(logs.some(t=>t.includes('Local tactical AI selected.')));
 assert.equal(await page.locator('#system-warnings').textContent(),'');
 for(const size of [20,32]){
  await page.evaluate(size=>document.documentElement.style.setProperty('--terminal-font-size',`${size}px`),size);
  const boxes=await page.locator('#vehicle-meters .turbo-indicator:visible').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return {x:b.x,y:b.y,bottom:b.bottom,width:b.width};}));
  assert.equal(boxes.length,3);
  for(let i=1;i<boxes.length;i++)assert(boxes[i].y>boxes[i-1].bottom);
  assert(boxes.every(b=>b.x===24&&b.width>200));
 }
 await page.screenshot({path:'test-results/clu-large-meters.png'});
 await page.keyboard.press('Escape');await page.getByRole('button',{name:/^RETURN HOME$/i}).click();
 await page.locator('#start-cycles').click();
 await page.waitForFunction(()=>__tron.state.cycleRace?.phase==='racing',null,{timeout:60000});
 const cycleBoxes=await page.locator('#vehicle-meters .turbo-indicator:visible').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return {y:b.y,bottom:b.bottom};}));
 assert.equal(cycleBoxes.length,2);assert(cycleBoxes[1].y>cycleBoxes[0].bottom);
 await page.screenshot({path:'test-results/cycle-large-meters.png'});
 assert.deepEqual(errors,[]);console.log('JEV default migration, brief fading outage notice, console-only local status and large-font meters in both games passed.');
}finally{await browser.close();}
