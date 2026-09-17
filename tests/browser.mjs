if(process.argv.includes('--death-terminal')){await import('./death-terminal.mjs');process.exit(0);}
if(process.argv.includes('--cruise')){await import('./cruise.mjs');process.exit(0);}
if(process.argv.includes('--gunner')){await import('./gunner.mjs');process.exit(0);}
if(process.argv.includes('--startup-ui')){await import('./startup-ui.mjs');process.exit(0);}
if(process.argv.includes('--ground-tanks')){await import('./ground-tanks.mjs');process.exit(0);}
if(process.argv.includes('--searchlights')){await import('./searchlights.mjs');process.exit(0);}
if(process.argv.includes('--tank-breakup')){await import('./tank-breakup.mjs');process.exit(0);}
if(process.argv.includes('--patrols')){await import('./patrols.mjs');process.exit(0);}
if(process.argv.includes('--carrier')){await import('./carrier.mjs');process.exit(0);}
if(process.argv.includes('--aerial-zoom')){await import('./aerial-zoom.mjs');process.exit(0);}
if(process.argv.includes('--turbo-hints')){await import('./turbo-hints.mjs');process.exit(0);}
if(process.argv.includes('--opening-controls')){await import('./opening-controls.mjs');process.exit(0);}
if(process.argv.includes('--breakup')){await import('./breakup.mjs');process.exit(0);}
if(process.argv.includes('--typing-audio')){await import('./typing-audio.mjs');process.exit(0);}
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { cellCenter, SPAWN } from '../src/levels/maze.js';
await mkdir('test-results',{recursive:true});
if(process.argv.includes('--terminal')){await import('./terminal.mjs');process.exit(0);}
if(process.argv.includes('--soak')){await import('./soak.mjs');process.exit(0);}
if(process.argv.includes('--compat')){await import('./compat.mjs');process.exit(0);}
if(process.argv.includes('--lifecycle')){await import('./lifecycle.mjs');process.exit(0);}
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try {
  await page.goto(process.env.TRON_URL||'http://127.0.0.1:5173/?maze=authored');await page.waitForFunction(()=>!document.querySelector('#start').disabled);
  await page.waitForFunction(()=>document.querySelector('.terminal-copy.complete'));await page.screenshot({path:'test-results/intro.png'});
  await page.waitForFunction(()=>document.querySelector('.terminal-copy.complete'));await page.keyboard.press('Enter');await page.waitForFunction(()=>document.body.classList.contains('playing'));
  let state=await page.evaluate(()=>window.__tron.state);assert.equal(state.weaponVisual.source,'arabinowitz');assert.equal(state.recognizers.length,3);assert.equal(state.audioSources,3);
  assert.equal(await page.locator('#instruments').count(),0);
  await page.keyboard.down('KeyL');await page.waitForTimeout(600);await page.keyboard.up('KeyL');
  state=await page.evaluate(()=>window.__tron.state);assert.equal(state.yaw,SPAWN.yaw);assert.ok(state.turretYaw<-.5);assert.equal(state.weaponVisual.barrelPitch,0);
  await page.evaluate(()=>__tron.reset());await page.waitForTimeout(100);
  const initial=await page.evaluate(()=>window.__tron.state.s);
  await page.keyboard.down('KeyW');await page.waitForTimeout(7000);await page.keyboard.up('KeyW');
  state=await page.evaluate(()=>window.__tron.state);assert.ok(state.s>initial+75);assert.equal(state.status,'running');
  await page.screenshot({path:'test-results/maze-entry.png'});
  await page.keyboard.press('Escape');const paused=await page.evaluate(()=>window.__tron.state);await page.waitForTimeout(300);
  assert.deepEqual((await page.evaluate(()=>window.__tron.state)).recognizers,paused.recognizers);
  await page.keyboard.press('Enter');
  await page.evaluate(p=>window.__tron.place({...p,yaw:0,speed:0,steer:0}),cellCenter(12,3));
  await page.keyboard.down('KeyD');await page.waitForTimeout(1400);await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyW');await page.waitForTimeout(2200);await page.keyboard.up('KeyW');
  state=await page.evaluate(()=>window.__tron.state);assert.ok(state.x>cellCenter(12,3).x+15,'drive into a side branch');
  await page.screenshot({path:'test-results/maze-junction.png'});
  await page.keyboard.press('KeyV');await page.waitForTimeout(1500);await page.screenshot({path:'test-results/maze-aerial.png'});
  await page.keyboard.press('Tab');await page.locator('#survey').waitFor({state:'visible'});await page.screenshot({path:'test-results/maze-survey.png'});
  await page.keyboard.press('Tab');await page.keyboard.press('KeyV');
  await page.evaluate(()=>__tron.reset());await page.waitForTimeout(100);
  await page.evaluate(()=>{
    const r=window.__tron.state;
    r.recognizers.forEach((e,i)=>Object.assign(e,{x:-1850-i*50,s:-1720-i*30,y:73,yaw:0,nextSense:0}));
    window.__tron.place({x:-1850,s:-1600,speed:0,recognizers:r.recognizers});
  });
  await page.waitForTimeout(1100);state=await page.evaluate(()=>window.__tron.state);
  assert.ok(state.recognizers[0].memory);assert.ok(state.recognizers.slice(1).some(e=>e.memory));
  await page.evaluate(()=>window.__tron.place({x:-273.6,s:-342,speed:0}));await page.waitForTimeout(350);
  const last=await page.evaluate(()=>window.__tron.state.recognizers[0].memory);
  await page.waitForTimeout(600);state=await page.evaluate(()=>window.__tron.state);
  assert.deepEqual(state.recognizers[0].memory,last);assert.notEqual(last.x,state.x);
  await page.evaluate(()=>__tron.reset());await page.waitForTimeout(100);
  await page.evaluate(()=>{const r=window.__tron.state;r.recognizers.forEach((e,i)=>Object.assign(e,{x:-1850+i*.1,s:-1700,y:73,yaw:0}));window.__tron.place({x:-1850,s:-1600,speed:0,recognizers:r.recognizers});});
  await page.waitForTimeout(1200);
  const flock=await page.evaluate(()=>window.__tron.state.recognizers);
  for(let i=0;i<flock.length;i++)for(let j=i+1;j<flock.length;j++)assert.ok(Math.hypot(flock[i].x-flock[j].x,flock[i].s-flock[j].s)>=23.9);
  await page.keyboard.down('KeyC');await page.waitForTimeout(1000);await page.screenshot({path:'test-results/recognizer-scale.png'});await page.keyboard.up('KeyC');
  await page.evaluate(()=>__tron.reset());await page.waitForTimeout(100);
  await page.evaluate(async()=>{
    window.__tron.configure({enemySpeed:0});
    const r=window.__tron.state;
    r.recognizers.forEach((e,i)=>Object.assign(e,{x:i===0?-1850:1500+i*80,s:i===0?-1680:1500,y:73,yaw:0,vx:0,vs:0}));
    window.__tron.place({x:-1850,s:-1800,yaw:0,speed:0,recognizers:r.recognizers});
  });
  await page.keyboard.down('Space');await page.waitForTimeout(4000);await page.keyboard.up('Space');
  state=await page.evaluate(()=>window.__tron.state);assert.equal(state.kills,1);assert.equal(state.recognizers[0].state,'destroyed');assert.equal(state.mode,'running');
  await page.evaluate(()=>window.__tron.configure({enemySpeed:27}));
  for(let i=0;i<10;i++){await page.evaluate(()=>__tron.reset());await page.waitForTimeout(70);}
  state=await page.evaluate(()=>window.__tron.state);assert.equal(state.audioContexts,1);assert.equal(state.audioSources,3);assert.equal(state.recognizers.length,3);assert.ok(state.recognizers.every(e=>e.memory===null));
  await page.setViewportSize({width:960,height:640});await page.keyboard.press('KeyH');await page.waitForTimeout(200);await page.screenshot({path:'test-results/resized.png'});
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({browser:await browser.version(),checks:'five agents/audio sources, J/L level turret, entry and branch driving, pause freezes AI, aerial/survey, sighting memory, shooting, 10 resets, resize',resources:state.renderer,performance:await page.evaluate(()=>window.__tron.performance),errors},null,2));
}finally{await browser.close();}
