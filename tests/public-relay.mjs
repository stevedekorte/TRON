// Opt-in live smoke test: makes paid Jev calls until the first successful reply.
// --local serves the built files at the production origin through Playwright.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const origin='https://dekorte.com',base=origin+'/fun/TRON/';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage(),errors=[],decisions=[],requests=[];
 page.on('request',r=>{if(r.url().includes('/api/jev/decision'))requests.push(Date.now());});
 if(process.argv.includes('--local'))await page.route(base+'**',async route=>{
  const name=decodeURIComponent(new URL(route.request().url()).pathname.slice('/fun/TRON/'.length))||'index.html';
  const root=resolve('dist'),file=resolve(root,name);assert(file.startsWith(root+'/'));
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.wav':'audio/wav','.mp3':'audio/mpeg'};
  try{await route.fulfill({body:await readFile(file),contentType:types[extname(file)]||'application/octet-stream'});}catch{await route.fulfill({status:404,body:'Missing asset'});}
 });
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',async r=>{if(r.url().includes('/api/jev/decision'))decisions.push({status:r.status(),body:await r.json()});else if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 const answerPromise=page.waitForResponse(r=>r.url().startsWith('https://tron-jev.tron-canyon-run.workers.dev/api/jev/decision')&&r.status()===200,{timeout:45000});
 await page.goto(base);await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>document.body.classList.contains('playing'));
 const response=await answerPromise,answer=await response.json();await page.keyboard.press('Escape');
 await page.waitForTimeout(500);
 assert.match(answer.id,/^m\d+$/);assert(Number.isFinite(answer.confidence));assert.deepEqual(errors,[]);
 console.log(JSON.stringify({source:process.argv.includes('--local')?'local build at public origin':'live website',decisions,requestIntervals:requests.slice(1).map((t,i)=>t-requests[i]),answerId:answer.id,confidence:answer.confidence,errors}));
}finally{await browser.close();}
