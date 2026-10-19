import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 await page.route('**/roster-check',r=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/ui/style.css?direct"><body class="playing-cycle"><div id="cycle-roster"></div></body>'}));
 await page.goto((process.env.TRON_URL??'http://127.0.0.1:5173/')+'roster-check');
 await page.evaluate(async()=>{const {CycleRoster}=await import('/src/ui/cycle-roster.js');window.roster=new CycleRoster(document.getElementById('cycle-roster'));window.race={cycles:Array.from({length:12},(_,id)=>({id,team:Math.floor(id/3),alive:true,human:[0,4,8].includes(id),operator:`USER ${id}`}))};roster.update(race,true);});
 assert.equal(await page.locator('.cycle-roster-icon').count(),12);assert.equal(await page.locator('.cycle-team-icons').count(),4);
 await page.evaluate(()=>{race.cycles[4].alive=false;roster.update(race,true)});
 const dead=page.locator('[data-cycle-id="4"]');assert.match(await dead.getAttribute('aria-label'),/BLUE.*eliminated/);assert.deepEqual(await dead.evaluate(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.borderTopColor,s.opacity];}),['rgba(0, 0, 0, 0)','rgb(72, 186, 255)','1']);
 assert.equal(await page.locator('[data-cycle-id="3"]').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(72, 186, 255)');
 assert.equal(await dead.evaluate(el=>getComputedStyle(el,'::after').width),'12px');
 assert.equal(await page.locator('[data-cycle-id="5"]').evaluate(el=>getComputedStyle(el,'::after').content),'none');
 const before=await page.locator('[data-cycle-id="0"]').boundingBox();
 await page.evaluate(()=>roster.update(race,true,3));
 assert.equal(await page.locator('.cycle-waiting-queue .cycle-roster-icon').count(),3);
 assert.deepEqual(await page.locator('[data-cycle-id="0"]').boundingBox(),before);
 const waiting=page.locator('.cycle-waiting-queue .cycle-roster-icon').first();
 assert.deepEqual(await waiting.evaluate(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.borderTopColor];}),['rgba(0, 0, 0, 0)','rgb(64, 64, 64)']);
 assert.equal(await waiting.evaluate(el=>getComputedStyle(el,'::before').content),'none');
 assert.equal(await waiting.evaluate(el=>getComputedStyle(el,'::after').width),'12px');
 const queueBounds=await page.locator('.cycle-waiting-queue').boundingBox();assert.ok(queueBounds.x+queueBounds.width<before.x);
 await page.evaluate(()=>{
  race.cycles[1].trapAssists=[{id:5,team:1,share:1}];
  race.cycles[0].wallEliminations=[{id:3,team:1},{id:6,team:2},{id:9,team:3}];
  race.cycles[4].wallEliminations=race.cycles.filter(c=>c.team!==1).map(c=>({id:c.id,team:c.team}));
  roster.update(race,true,3);
 });
 assert.equal(await page.locator('[data-cycle-id="0"] .cycle-roster-kill').count(),3);
 assert.equal(await page.locator('[data-cycle-id="1"] .trap-assist').count(),1);
 assert.equal(await page.locator('.trap-assist').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
 assert.equal(await page.locator('[data-cycle-id="4"] .cycle-roster-kill').count(),9);
 assert.deepEqual(await page.locator('[data-cycle-id="0"]').boundingBox(),before,'awards do not shift roster');
 const colors=await page.locator('[data-cycle-id="0"] .cycle-roster-kill').evaluateAll(dots=>dots.map(dot=>getComputedStyle(dot).backgroundColor));
 assert.deepEqual(colors,['rgb(72, 186, 255)','rgb(255, 69, 69)','rgb(65, 219, 120)']);
 const owner=page.locator('[data-cycle-id="4"]');
 const centered=await owner.evaluate(el=>{
  const box=el.getBoundingClientRect(),rows=new Map();
  for(const dot of el.querySelectorAll('.cycle-roster-kill')){const r=dot.getBoundingClientRect();const row=rows.get(r.top)||[];row.push(r);rows.set(r.top,row);}
  return [...rows.values()].every(row=>Math.abs((row[0].left+row.at(-1).right)/2-(box.left+box.width/2))<.1)&&rows.size===2;
 });assert(centered,'each dot row stays centered, including wrapped rows');
 await page.screenshot({path:'test-results/cycle-roster.png'});
 await page.evaluate(()=>roster.update(race,true,1));assert.equal(await page.locator('.cycle-waiting-queue .cycle-roster-icon').count(),1);
 await page.evaluate(()=>roster.update(race,true,0));assert.equal(await page.locator('.cycle-waiting-queue').count(),0);
 assert.deepEqual(await page.locator('[data-cycle-id="0"]').boundingBox(),before);
 await page.evaluate(()=>{race.cycles=race.cycles.slice(0,6);for(const c of race.cycles){c.alive=true;delete c.wallEliminations;delete c.trapAssists;}roster.update(race,true)});assert.equal(await page.locator('.cycle-roster-icon').count(),6);assert.equal(await page.locator('.eliminated').count(),0);assert.equal(await page.locator('.cycle-roster-kill').count(),0);
 await page.evaluate(()=>{for(const c of race.cycles)delete c.human;race.playerId=1;delete race.localPlayerId;roster.update(race,true);});
 assert.equal(await page.locator('.cycle-roster-icon.human').count(),1);
 assert(await page.locator('[data-cycle-id="1"]').evaluate(el=>el.classList.contains('human')));
 assert.match(await page.locator('[data-cycle-id="1"]').getAttribute('aria-label'),/PLAYER/);
 assert.equal(await page.evaluate(()=>race.cycles.some(c=>c.human)),false,'roster styling never changes bike human flags');
 await page.evaluate(()=>{race.localPlayerId=null;roster.update(race,true);});
 assert.equal(await page.locator('.cycle-roster-icon.human').count(),0,'MP spectators do not mark their follow target');
 await page.evaluate(()=>roster.update(race,false));assert.equal(await page.locator('#cycle-roster').isVisible(),false);
 console.log('Cycle roster: four-team count/color grouping, hollow eliminated circles and team connectors, restart and hiding passed.');
}finally{await browser.close()}
