import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 await page.route('**/roster-check',r=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/ui/style.css?direct"><body class="playing-cycle"><div id="cycle-roster"></div></body>'}));
 await page.goto('http://127.0.0.1:5173/roster-check');
 await page.evaluate(async()=>{const {CycleRoster}=await import('/src/ui/cycle-roster.js');window.roster=new CycleRoster(document.getElementById('cycle-roster'));window.race={cycles:Array.from({length:12},(_,id)=>({id,team:Math.floor(id/3),alive:true}))};roster.update(race,true);});
 assert.equal(await page.locator('.cycle-roster-icon').count(),12);assert.equal(await page.locator('.cycle-team-icons').count(),4);
 await page.evaluate(()=>{race.cycles[4].alive=false;roster.update(race,true)});
 const dead=page.locator('[data-cycle-id="4"]');assert.match(await dead.getAttribute('aria-label'),/BLUE.*eliminated/);assert.deepEqual(await dead.evaluate(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.borderTopColor,s.opacity];}),['rgba(0, 0, 0, 0)','rgb(72, 186, 255)','1']);
 assert.equal(await page.locator('[data-cycle-id="3"]').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(72, 186, 255)');
 assert.equal(await dead.evaluate(el=>getComputedStyle(el,'::after').width),'12px');
 assert.equal(await page.locator('[data-cycle-id="5"]').evaluate(el=>getComputedStyle(el,'::after').content),'none');
 await page.screenshot({path:'test-results/cycle-roster.png'});
 await page.evaluate(()=>{race.cycles=race.cycles.slice(0,6);for(const c of race.cycles)c.alive=true;roster.update(race,true)});assert.equal(await page.locator('.cycle-roster-icon').count(),6);assert.equal(await page.locator('.eliminated').count(),0);
 await page.evaluate(()=>roster.update(race,false));assert.equal(await page.locator('#cycle-roster').isVisible(),false);
 console.log('Cycle roster: four-team count/color grouping, hollow eliminated circles and team connectors, restart and hiding passed.');
}finally{await browser.close()}
