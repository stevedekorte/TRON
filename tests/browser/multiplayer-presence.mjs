// Arena presence end to end: the menu's player count, "a warrior is on the mesa"
// in a solo game (empty -> occupied only) and in multiplayer (every arrival), and
// the end-of-match offer that moves a solo player into the multiplayer arena.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const base=process.env.TRON_URL||'http://127.0.0.1:5173/';
const out='test-results/multiplayer/multiplayer-presence';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
const errors=[];
async function open(name){
 const context=await browser.newContext({viewport:{width:900,height:600},reducedMotion:'reduce'});
 await context.route('**/api/jev/**',r=>r.fulfill({status:503,body:'{}'}));
 const page=await context.newPage();page.name=name;
 page.on('pageerror',e=>errors.push(`${name}: ${e.message}`));
 await page.goto(base+'?runSeed=1982');await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start-multiplayer').disabled,null,{timeout:120000});
 return page;
}
const label=page=>page.waitForFunction(()=>document.querySelector('#multiplayer-players').textContent!=='',null,{timeout:10000}).then(()=>page.locator('#multiplayer-players').textContent());
const caption=page=>page.locator('#arena-arrival-notice').isVisible();
const joinMultiplayer=async page=>{await page.locator('#start-multiplayer').click();await page.waitForFunction(()=>__tron.state.multiplayer?.connected,null,{timeout:60000});};
const endSoloMatch=page=>page.evaluate(()=>{const r=__tron.state.cycleRace;r.phase='result';r.winner=0;r.remaining=6;__tron.place({cycleRace:r});});
try{
 const solo=await open('solo');
 assert.equal(await label(solo),'(NO PLAYERS)');
 await solo.locator('#start-cycles').click();await solo.waitForFunction(()=>__tron.state.cycleRace?.phase==='racing',null,{timeout:120000});
 assert.equal(await caption(solo),false);

 // First human in the arena: the solo player hears it at once.
 const first=await open('first');assert.equal(await label(first),'(NO PLAYERS)');
 await joinMultiplayer(first);const joined=Date.now();
 await solo.bringToFront();await solo.waitForFunction(()=>!document.querySelector('#arena-arrival-notice').hidden,null,{timeout:5000});
 console.log(`solo caption after ${Date.now()-joined} ms: ${await solo.locator('#arena-arrival-notice').textContent()}`);
 await solo.screenshot({path:`${out}/solo-caption.png`});
 assert.equal(await caption(first),false,'the arriving player does not announce themselves');
 await solo.waitForFunction(()=>document.querySelector('#arena-arrival-notice').hidden,null,{timeout:8000});

 // A second arrival: multiplayer hears it, the solo game (arena already occupied) does not.
 const second=await open('second');assert.equal(await label(second),'(1 PLAYER)');
 await joinMultiplayer(second);
 await first.bringToFront();await first.waitForFunction(()=>!document.querySelector('#arena-arrival-notice').hidden,null,{timeout:5000});const firstHeard=Date.now();
 await first.screenshot({path:`${out}/multiplayer-caption.png`});
 await solo.bringToFront();await solo.waitForTimeout(1500);assert.equal(await caption(solo),false,'solo hears only empty -> occupied');

 // No offer mid-match; at the end of the match, an offer. Return continues solo.
 assert.equal(await solo.locator('#multiplayer-offer').isVisible(),false);
 await endSoloMatch(solo);await solo.waitForFunction(()=>!document.querySelector('#multiplayer-offer').hidden,null,{timeout:3000});
 assert.equal(await solo.locator('#multiplayer-offer-text').textContent(),'2 USERS IN MULTIPLAYER');
 await solo.screenshot({path:`${out}/solo-offer.png`});
 const round=await solo.evaluate(()=>__tron.state.cycleRace.round);
 await solo.keyboard.press('Enter');await solo.waitForFunction(r=>__tron.state.cycleRace.round>r,round);
 await solo.waitForFunction(()=>document.querySelector('#multiplayer-offer').hidden,null,{timeout:2000}); // continuing solo hides the offer

 // Next match end: M joins the arena; both riders already there hear the arrival.
 await endSoloMatch(solo);await solo.waitForFunction(()=>!document.querySelector('#multiplayer-offer').hidden,null,{timeout:3000});
 await first.waitForFunction(()=>document.querySelector('#arena-arrival-notice').hidden,null,{timeout:8000}); // the previous caption has cleared
 // Like the Escape dialog: CONTINUE SOLO starts selected; Down moves the cursor; Return chooses.
 const pressed=()=>solo.evaluate(()=>[...document.querySelectorAll('#multiplayer-offer button')].map(b=>b.getAttribute('aria-pressed')));
 assert.deepEqual(await pressed(),['true','false']);
 await solo.keyboard.press('ArrowDown');assert.deepEqual(await pressed(),['false','true']);
 await solo.screenshot({path:`${out}/solo-offer-join-selected.png`});
 await solo.keyboard.press('Enter');
 await solo.waitForFunction(()=>__tron.state.multiplayer?.connected,null,{timeout:30000});
 await solo.waitForFunction(()=>document.querySelector('#multiplayer-offer').hidden,null,{timeout:2000});
 // The second rider hears it; the first heard one under 15 s ago, so this arrival is skipped.
 await second.bringToFront();await second.waitForFunction(()=>!document.querySelector('#arena-arrival-notice').hidden,null,{timeout:5000});
 const players=await solo.evaluate(()=>__tron.state.multiplayer.players);assert.equal(players,3);
 assert(Date.now()-firstHeard<15000,'test timing: the M join must come within 15 s of the previous line');
 await first.bringToFront();await first.waitForTimeout(1500);assert.equal(await caption(first),false,'at most one line per 15 s in multiplayer');
 // After the interval, the next arrival plays again.
 await first.waitForTimeout(Math.max(0,15000-(Date.now()-firstHeard)+200));
 const fourth=await open('fourth');await joinMultiplayer(fourth);
 await first.bringToFront();await first.waitForFunction(()=>!document.querySelector('#arena-arrival-notice').hidden,null,{timeout:5000});
 await fourth.close();
 await solo.screenshot({path:`${out}/solo-joined.png`});

 // Back on the menu, the count includes everyone.
 await second.close();
 await solo.keyboard.press('Escape');await solo.locator('#exit-confirm [data-confirm]').click();
 await solo.waitForFunction(()=>window.__tron&&!document.querySelector('#start-multiplayer').disabled&&document.querySelector('#multiplayer-players').textContent==='(1 PLAYER)',null,{timeout:60000})
  .catch(async e=>{console.log('menu label after leaving:',await solo.locator('#multiplayer-players').textContent().catch(()=>'?'));throw e;});
 assert.deepEqual(errors,[]);
 console.log('presence ok');
}finally{await browser.close();}
