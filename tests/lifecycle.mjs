import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const browser=await chromium.launch({channel:'chrome',headless:true});
const checks=[];
try {
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>!document.querySelector('#start').disabled);await page.waitForFunction(()=>document.querySelector('.terminal-copy.complete'));await page.keyboard.press('Enter');await page.waitForFunction(()=>document.body.classList.contains('playing'));
  await page.keyboard.down('KeyW');await page.waitForTimeout(1000);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  const paused=await page.evaluate(()=>window.__tron.state);
  assert.equal(paused.mode,'paused');await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>window.__tron.state.s),paused.s);
  await page.keyboard.up('KeyW');await page.keyboard.press('Enter');await page.waitForTimeout(500);
  assert.ok((await page.evaluate(()=>window.__tron.state.speed))<paused.speed);checks.push('blur pauses and clears throttle');
  await page.keyboard.press('KeyM');assert.equal(await page.locator('#sound').textContent(),'SOUND OFF');checks.push('mute control');
  assert.equal(await page.locator('.masthead').isVisible(),false);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#paused input,#paused button').count(),0);
  await page.screenshot({path:'test-results/standby.png'});
  const before=await page.evaluate(()=>window.__tron.state);
  await page.keyboard.press('Space');await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>window.__tron.state.mode),'running');
  assert.equal(await page.evaluate(()=>window.__tron.state.shots),before.shots);
  for(const key of ['KeyR','KeyV','KeyW','Escape','Tab']){
    await page.keyboard.press('Escape');
    const before=await page.evaluate(()=>window.__tron.state);
    await page.keyboard.press(key);await page.waitForTimeout(80);
    const after=await page.evaluate(()=>window.__tron.state);
    assert.equal(after.mode,'running');assert.ok(after.time>=before.time);assert.equal(after.aerial,before.aerial);
  }
  await page.keyboard.press('Escape');
  await page.evaluate(()=>window.__tron.place({speed:0}));
  await page.keyboard.down('KeyW');await page.waitForTimeout(500);
  assert.ok((await page.evaluate(()=>window.__tron.state.speed))>2);
  await page.keyboard.up('KeyW');
  await page.evaluate(()=>window.__tron.place({turretYaw:1.2,speed:0}));
  await page.keyboard.press('KeyF');await page.waitForTimeout(250);
  let turret=await page.evaluate(()=>window.__tron.state.turretYaw);assert.ok(turret>0&&turret<1.2);
  await page.waitForFunction(()=>window.__tron.state.turretYaw===0);
  checks.push('minimal standby, held-W resume and F smoothly centers the turret');
  await page.evaluate(()=>{const gl=document.querySelector('#game').getContext('webgl2');gl.getExtension('WEBGL_lose_context').loseContext();});
  await page.getByRole('heading',{name:'UNABLE TO ENTER.'}).waitFor();checks.push('context-loss recovery message');await page.close();

  const unsupported=await browser.newPage();
  await unsupported.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:get.call(this,type,...args);};});
  await unsupported.goto('http://127.0.0.1:5173');await unsupported.getByRole('heading',{name:'UNABLE TO ENTER.'}).waitFor();assert.match(await unsupported.locator('#error-message').textContent(),/WebGL 2/);checks.push('unsupported WebGL 2 message');await unsupported.close();

  const missing=await browser.newPage();
  await missing.route('**/*.glb',route=>route.abort());
  await missing.goto('http://127.0.0.1:5173');
  await missing.getByRole('heading',{name:'UNABLE TO ENTER.'}).waitFor();
  assert.match(await missing.locator('#error-message').textContent(),/vehicle models/);
  checks.push('failed model download shows reload message');await missing.close();

  const production=await browser.newPage();const prodErrors=[];production.on('pageerror',e=>prodErrors.push(e.message));
  await production.goto('http://127.0.0.1:4173');await production.waitForFunction(()=>document.querySelector('.terminal-copy.complete'));await production.keyboard.press('Enter');await production.waitForFunction(()=>document.body.classList.contains('playing'));await production.keyboard.press('KeyH');await production.keyboard.down('KeyW');await production.waitForTimeout(1200);await production.keyboard.up('KeyW');
  assert.ok(Number(await production.locator('#speed').textContent())>20);assert.equal(await production.evaluate(()=>typeof window.__tron),'undefined');assert.equal(prodErrors.length,0,prodErrors.join('\n'));checks.push('production preview driving, no development hooks');
  await production.screenshot({path:'test-results/production.png'});await production.close();
  assert.equal(errors.length,0,errors.join('\n'));console.log(checks);await writeFile('test-results/lifecycle.json',JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
