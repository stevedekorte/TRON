import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
if(process.argv.includes('--audio')){await import('./audio.mjs');process.exit(0);}
if(process.argv.includes('--camera')){await import('./camera.mjs');process.exit(0);}
if(process.argv.includes('--attack')){await import('./attack.mjs');process.exit(0);}
await mkdir('test-results/reference',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:2048,height:820}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:5173/reference.html');
 await page.waitForFunction(()=>window.__reference);
 for(const shot of ['close','rear','maze','details','drive']){
  await page.evaluate(s=>window.__reference.select(s),shot);await page.waitForTimeout(200);
  assert.ok(await page.locator('#reference').evaluate(img=>img.complete&&img.naturalWidth>0));
  await page.screenshot({path:'test-results/reference/'+shot+'.png'});
 }
 await page.goto('http://127.0.0.1:5173/docs/index.html');
 const cards=page.locator('.card-grid a.card');assert.equal(await cards.count(),4);
 for(const href of await cards.evaluateAll(nodes=>nodes.map(n=>n.href))) {
   const response=await page.request.get(href);assert.equal(response.status(),200);
 }
 await page.locator('.card-grid').screenshot({path:'test-results/reference/docs-cards.png'});
 await page.goto('http://127.0.0.1:5173/reference.html?maze=blueprint&shot=blueprint');
 await page.waitForFunction(()=>window.__reference?.shot==='blueprint');
 assert.ok(await page.locator('#reference').evaluate(img=>img.complete&&img.naturalWidth>0));
 await page.screenshot({path:'test-results/reference/blueprint.png'});
 await page.locator('#mix').fill('0.5');await page.locator('#mix').dispatchEvent('input');
 await page.screenshot({path:'test-results/reference/blueprint-overlay.png'});
 await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.waitForFunction(()=>document.querySelector('.terminal-copy.complete'));await page.keyboard.press('Enter');await page.waitForFunction(()=>document.body.classList.contains('playing'));
 assert.equal(await page.evaluate(()=>window.__tron.state.maze),'blueprint');
 const start=await page.evaluate(()=>window.__tron.state.s);
 await page.keyboard.down('KeyW');await page.waitForTimeout(8000);await page.keyboard.up('KeyW');
 const result=await page.evaluate(async()=>{
  const r=window.__tron.state,maze=await import('/src/levels/blueprint-maze.js');
  return {s:r.s,free:maze.freePosition(r.x,r.s,3.49),agents:r.recognizers.length};
 });
 assert.ok(result.s>start+60);assert.ok(result.s<start+160);assert.ok(result.free);assert.equal(result.agents,5);
 await page.screenshot({path:'test-results/reference/blueprint-driving.png'});
 await page.keyboard.press('KeyV');await page.waitForTimeout(1200);
 await page.screenshot({path:'test-results/reference/blueprint-aerial.png'});
 await page.goto('http://127.0.0.1:5173/?maze=authored');await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.waitForFunction(()=>document.querySelector('.terminal-copy.complete'));await page.keyboard.press('Enter');await page.waitForFunction(()=>document.body.classList.contains('playing'));
 assert.equal(await page.evaluate(()=>window.__tron.state.maze),'authored');
 assert.deepEqual(errors,[]);console.log('Blueprint overlay, driving and wall collision verified.');
 console.log('Five reference views and four documentation cards verified.');
}finally{await browser.close();}
