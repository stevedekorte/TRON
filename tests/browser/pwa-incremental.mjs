import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve('dist'),scope='/fun/TRON/',changed='bit/config.js';
const original=await readFile(resolve(root,changed),'utf8'),replacement=original+'\n// incremental cache regression\n';
const hash=s=>createHash('sha256').update(s).digest('hex');
let update=false;const requests=[];
const server=createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(!pathname.startsWith(scope)){res.writeHead(404).end();return;}
  const path=decodeURIComponent(pathname.slice(scope.length));
  if(update)requests.push(path);
  if(path==='cache-test.html'){res.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><title>Cache update test</title>');return;}
  const file=resolve(root,path);if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
  let data=await readFile(file);
  if(update&&path===changed)data=Buffer.from(replacement);
  if(update&&path==='sw.js')data=Buffer.from(data.toString().replace(/const CACHE = PREFIX \+ '[^']+';/,"const CACHE = PREFIX + 'incremental-test';").replace(hash(original),hash(replacement)));
  res.writeHead(200,{'Content-Type':{'.js':'text/javascript','.html':'text/html','.json':'application/json','.webmanifest':'application/manifest+json'}[extname(file)]??'application/octet-stream','Cache-Control':'no-store'}).end(data);
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();page.setDefaultTimeout(60000);
 await page.goto(`http://127.0.0.1:${server.address().port}${scope}cache-test.html`);
 await page.evaluate(async()=>{await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;});
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 update=true;await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});
 await expect.poll(()=>page.evaluate(async()=>{
  const r=await navigator.serviceWorker.getRegistration();
  const name=(await caches.keys()).find(k=>k.endsWith(':incremental-test'));
  return Boolean(r.waiting?.state==='installed'&&name&&await(await caches.open(name)).match(new URL('.cache-asset-hashes.json',new URL('./',location.href)).href));
 }),{timeout:60000}).toBe(true);
 const downloads=requests.filter(path=>path!=='sw.js');assert.deepEqual(downloads,[changed]);
 assert.equal(await page.evaluate(async()=>(await caches.keys()).filter(k=>k.startsWith('tron-game:')).length),2);
 await page.evaluate(async()=>{(await navigator.serviceWorker.getRegistration()).waiting.postMessage({type:'ACTIVATE_UPDATE'});});
 await expect.poll(()=>page.evaluate(async()=>!(await navigator.serviceWorker.getRegistration()).waiting),{timeout:60000}).toBe(true);
 assert.equal(await page.evaluate(async()=>await(await fetch('./bit/config.js')).text()),replacement);
 console.log('Actual production cache update: downloaded only bit/config.js; reused unchanged media and preserved the active cache until activation.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
