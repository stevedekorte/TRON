import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/credit-preview-fixture',r=>r.fulfill({contentType:'text/html',body:`<link rel="stylesheet" href="/src/ui/terminal.css"><body class="terminal detached"><div class="terminal-content"><p class="end-tribute" id="end-tribute"><span class="tribute-measure"></span><span class="tribute-typed"><span id="tribute-text"></span></span></p></div></body>`}));
 await page.goto('http://127.0.0.1:5173/credit-preview-fixture');
 await page.evaluate(async()=>{
  const {TerminalTribute}=await import('/src/ui/terminal.js'),{CreditModelPreview,creditModel}=await import('/src/ui/credit-model-preview.js');
  const text=await (await fetch('/docs/credits_display.txt')).text();
  window.tribute=new TerminalTribute(document.querySelector('#end-tribute'),'INTRO',text);tribute.preview=new CreditModelPreview();tribute.start();
  window.modelPages=tribute.sentences.map((text,index)=>({text,index,model:creditModel(text)?.[1]})).filter(p=>p.model);
  window.showModel=index=>{tribute.index=index;tribute.count=0;tribute.phase='body';tribute.nextCharacter=tribute.elapsed;tribute.output.textContent='';tribute.line=null;tribute.typed.style.opacity='1';tribute.update(.1);tribute.preview.update(tribute,.1);};
  return document.fonts.ready;
 });
 const pages=await page.evaluate(()=>modelPages);assert.equal(pages.length,10);
 assert(pages.some(p=>p.model==='bit'));
 assert(pages.some(p=>p.model==='maze'));assert(pages.some(p=>p.model==='shuttle'));
 for(const entry of pages){
  await page.evaluate(index=>showModel(index),entry.index);
  await page.waitForFunction(model=>tribute.preview.model&&tribute.preview.element.dataset.model===model,entry.model);
  await page.evaluate(()=>{tribute.preview.update(tribute,.7);});
  const metrics=await page.evaluate(()=>({opacity:Number(tribute.preview.element.style.opacity),hidden:tribute.preview.element.hidden,width:tribute.preview.element.getBoundingClientRect().width}));assert.equal(metrics.hidden,false);assert(metrics.width>=260);assert(metrics.opacity>.95);
  await page.screenshot({path:`test-results/credit-model-${entry.model}.png`});
  await page.evaluate(()=>{tribute.typed.style.opacity='.4';tribute.phase='fade';tribute.preview.update(tribute,0);});assert.equal(await page.evaluate(()=>Number(tribute.preview.element.style.opacity)),.4);
 }
 await page.setViewportSize({width:800,height:700});await page.evaluate(()=>tribute.preview.update(tribute,0));assert(await page.evaluate(()=>tribute.preview.element.hidden&&!tribute.preview.model));
 await page.setViewportSize({width:1600,height:1000});await page.evaluate(()=>showModel(modelPages[0].index));await page.evaluate(()=>tribute.reset());await page.waitForTimeout(500);assert(await page.evaluate(()=>tribute.preview.element.hidden&&!tribute.preview.model));
 await page.evaluate(()=>tribute.preview.dispose());assert.equal(await page.locator('.credit-model-preview').count(),0);assert.deepEqual(errors,[]);
 if(!process.argv.includes('--previews-only')){
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'test'}));
 await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>!document.querySelector('#start-credits').disabled);
 await page.locator('#start-credits').click();
 for(let i=0;i<40;i++){
  await page.keyboard.press('Space');await page.waitForTimeout(120);
  if(await page.locator('#tribute-text').textContent().then(text=>text.startsWith('ARABIN')))break;
 }
 await page.waitForFunction(()=>document.querySelector('.credit-model-preview')?.dataset.model==='tank'&&!document.querySelector('.credit-model-preview').hidden);
 await page.waitForTimeout(1600);await page.screenshot({path:'test-results/credit-model-in-game.png'});
 await page.keyboard.press('Enter');assert(await page.locator('.credit-model-preview').evaluate(e=>e.hidden));
 assert.deepEqual(errors,[]);
 }
 console.log('Ten credit models rendered; synchronized fade, narrow-window hiding, reset during load and disposal passed.');
}finally{await browser.close();}
