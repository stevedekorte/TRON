import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const script=(await readFile('src/pwa/recover.js','utf8')).replace('__TRON_PRODUCTION__','true');
const scope='/fun/TRON/';let mode='once',requests=0,navigations=0;
const server=createServer((req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 res.setHeader('Cache-Control','no-store');
 if(path.endsWith('sw.js')){res.setHeader('Content-Type','text/javascript');res.end("self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));");return;}
 if(path===scope+'index.html'&&mode==='unreachable'){res.writeHead(503).end();return;}
 if(path===scope||path===scope+'index.html'){if(req.headers['sec-fetch-dest']==='document')navigations++;res.setHeader('Content-Type','text/html');res.end(`<html><head><script>${script}</script></head><body><div id="loading"><span id="boot-status">LOADING</span></div><script type="module" src="./assets/entry.js"></script></body></html>`);return;}
 if(path===scope+'assets/entry.js'){
  requests++;if(mode==='always'||mode==='once'&&requests===1){res.writeHead(404).end();return;}
  res.setHeader('Content-Type','text/javascript');res.end("window.started=true;dispatchEvent(new Event('tron:ready'));");return;
 }
 res.writeHead(404).end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`,url=origin+scope;
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 let context=await browser.newContext(),page=await context.newPage();
 await page.goto(url);await page.waitForFunction(()=>window.started);
 assert.equal(navigations,2);assert.equal(page.url(),url);assert.equal(requests,2);
 console.log('Missing entry recovers automatically at the ordinary URL.');
 await context.close();
 // Install scoped workers/cache data, then provoke a lazy module failure.
 mode='working';requests=0;navigations=0;context=await browser.newContext();page=await context.newPage();await page.goto(url);await page.waitForFunction(()=>window.started);
 await page.evaluate(async()=>{
  await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;
  await navigator.serviceWorker.register('/other/sw.js',{scope:'/other/'});
  const root=new URL('./',location.href).href;
  const cache=await caches.open(`tron-game:${root}:old`);
  for(const path of ['index.html','assets/old.js','assets/old.css','assets/model.glb','assets/voice.mp3'])await cache.put(root+path,new Response('cached'));
  await (await caches.open('other-app')).put('/other/keep.js',new Response('keep'));
  window.tronRecoverModuleFailure('Failed to fetch dynamically imported module');
 });
 await page.waitForFunction(()=>window.started&&!!sessionStorage.getItem(`tron-recovery:${new URL('./',location.href).href}`));
 await page.waitForTimeout(500);
 const state=await page.evaluate(async()=>({scopes:(await navigator.serviceWorker.getRegistrations()).map(r=>r.scope),cache:(await (await caches.open(`tron-game:${new URL('./',location.href).href}:old`)).keys()).map(r=>r.url),other:!!await(await caches.open('other-app')).match('/other/keep.js')}));
 assert(!state.scopes.includes(url));assert(state.scopes.includes(origin+'/other/'));assert(state.other);
 assert.deepEqual(state.cache.sort(),[url+'assets/model.glb',url+'assets/voice.mp3'].sort());
 assert.equal(navigations,2);assert.equal(page.url(),url);
 console.log('Recovery releases only the game worker/code cache; preserves media and unrelated app data.');
 await context.close();
 mode='unreachable';requests=0;navigations=0;context=await browser.newContext();page=await context.newPage();await page.goto(url);await page.waitForFunction(()=>window.started);
 await page.evaluate(async()=>{const root=new URL('./',location.href).href;await(await caches.open(`tron-game:${root}:offline`)).put(root+'assets/keep.js',new Response('offline code'));window.tronRecoverModuleFailure('Failed to fetch dynamically imported module');});
 await page.waitForFunction(()=>document.querySelector('#boot-status').textContent.includes('COULD NOT LOAD'));
 assert.equal(navigations,1);assert(await page.evaluate(async()=>!!await(await caches.open(`tron-game:${new URL('./',location.href).href}:offline`)).match(new URL('assets/keep.js',location.href))));
 console.log('An unreachable host preserves offline code and does not reload.');
 await context.close();
 mode='always';requests=0;navigations=0;context=await browser.newContext();page=await context.newPage();await page.goto(url);
 await page.waitForFunction(()=>document.querySelector('#boot-status').textContent.includes('COULD NOT LOAD'));
 await page.waitForTimeout(1200);assert.equal(navigations,2);assert.equal(requests,2);
 console.log('Persistent module failure stops after one retry, with a visible error.');
 await context.close();
}finally{await browser.close();await new Promise(r=>server.close(r));}
