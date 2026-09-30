import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,extname} from 'node:path';
const root=resolve('dist'),scope='/fun/TRON/';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.wav':'audio/wav','.mp3':'audio/mpeg','.wasm':'application/wasm'};
let update=false;
const server=createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(!path.startsWith(scope)) {res.writeHead(404).end();return;}
  const file=resolve(root,path.slice(scope.length)||'index.html');
  if(!file.startsWith(root+'/')) {res.writeHead(403).end();return;}
  let data=await readFile(file);
  if(update&&file.endsWith('/sw.js'))data=Buffer.concat([data,Buffer.from('\n// next release\n')]);
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}${scope}`;
const profile=await mkdtemp(resolve(tmpdir(),'tron-pwa-'));
const context=await chromium.launchPersistentContext(profile,{channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true,reducedMotion:'reduce'});
try{
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);
 await page.waitForFunction(()=>!document.querySelector('#start').disabled,null,{timeout:60000});
 await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 const manifest=await page.evaluate(async()=>{
  const href=document.querySelector('link[rel="manifest"]').href;
  return {href,data:await (await fetch(href)).json()};
 });
 assert.equal(new URL(manifest.data.start_url,manifest.href).href,url);
 assert.equal(manifest.data.display,'standalone');
 for(const icon of manifest.data.icons){
  assert.match(icon.src,/encom-e-[a-f0-9]{12}-(192|512)\.png$/);
  assert.equal(await page.evaluate(async src=>{
   const img=new Image();img.src=src;await img.decode();return `${img.naturalWidth}x${img.naturalHeight}`;
  },new URL(icon.src,manifest.href).href),icon.sizes);
 }
 const cdp=await context.newCDPSession(page);await cdp.send('Page.enable');
 const install=await cdp.send('Page.getInstallabilityErrors');assert.deepEqual(install.installabilityErrors,[]);
 await context.setOffline(true);await page.reload();
 await page.waitForFunction(()=>!document.querySelector('#start').disabled,null,{timeout:60000});
 await page.keyboard.press('Enter');await page.waitForFunction(()=>document.body.classList.contains('playing'));
 const range=await page.evaluate(async()=>{
  const r=await fetch('./audio/cannon.wav',{headers:{Range:'bytes=0-31'}});
  return {status:r.status,length:(await r.arrayBuffer()).byteLength,range:r.headers.get('Content-Range')};
 });
 assert.equal(range.status,206);assert.equal(range.length,32);assert.match(range.range,/^bytes 0-31\//);
 await page.goto(url+'?pwa-test=1');await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.locator('#start-bit').click();
 await page.waitForURL('**/bit/index.html');
 assert.match(await page.locator('#instructions').textContent(),/REQUESTING MICROPHONE ACCESS|ALLOW MICROPHONE ACCESS|Ask a yes or no question/);
 await page.keyboard.press('Escape');await page.locator('#exit-confirm [data-confirm]').click();await page.waitForURL(url);
 await page.waitForFunction(()=>!document.querySelector('#start-bit').disabled);
 await page.locator('#start-cycles').click();
 await page.waitForFunction(()=>document.body.classList.contains('playing'));
 assert.deepEqual(errors,[]);
 // A downloaded update must wait rather than replace a running game.
 await context.setOffline(false);update=true;
 await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
 await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting);
 assert(await page.evaluate(()=>document.body.classList.contains('playing')));
 await page.keyboard.press('Escape');await page.locator('#exit-confirm [data-confirm]').click();
 await page.waitForFunction(async()=>!(await navigator.serviceWorker.getRegistration()).waiting);
 await page.waitForFunction(()=>!!document.querySelector('#start-credits')&&!document.querySelector('#start-credits').disabled);
 console.log('PWA: valid installability, scoped manifest/icons, offline tank and cycle starts, ranged audio, and non-interrupting updates passed.');
}finally{await context.close();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true});}
