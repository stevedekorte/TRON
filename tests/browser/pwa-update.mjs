import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
let updated=false,brokenModule=false,updateVisits=0,newest=false;
const root=resolve('dist'),scope='/fun/TRON/';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.wasm':'application/wasm'};
const server=createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://localhost').pathname;
  if(!path.startsWith(scope)){res.writeHead(404).end();return;}
  if(path===scope+'update.html')updateVisits++;
  if(brokenModule&&/\/client-[^/]+\.js$/.test(path)){res.writeHead(404).end();return;}
  const file=resolve(root,decodeURIComponent(path.slice(scope.length)||'index.html'));
  if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
  let data=await readFile(file);
  if(!updated&&file.endsWith('/index.html'))data=Buffer.from('<html><body>OLD CACHED BUILD<script>navigator.serviceWorker.register("./sw.js")</script></body></html>');
  if(!updated&&file.endsWith('/sw.js'))data=Buffer.from(data.toString().replace(/await cache\.put\(METADATA,[^\n]+\n/,'').replace(/self.addEventListener\('message',event=>\{[\s\S]*?\n\}\);/,'').replace(/const CACHE = ([^;]+);/,'const CACHE = $1 + "-old";'));
  if(newest&&file.endsWith('/sw.js'))data=Buffer.from(data.toString().replace(/const CACHE = ([^;]+);/,'const CACHE = $1 + "-next";'));
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({reducedMotion:'reduce'});page.setDefaultTimeout(60000);
 const url=`http://127.0.0.1:${server.address().port}${scope}`;
 await page.goto(url);await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 updated=true;await page.reload();assert.match(await page.locator('body').innerText(),/OLD CACHED BUILD/);
 await page.goto(url+'update.html');
 await page.waitForURL(url);await page.waitForFunction(()=>!document.querySelector('#start-credits')?.disabled&&!!document.querySelector('#controls-help'));
 assert.equal(await page.title(),'ENCOM TERMINAL');
 await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>document.body.classList.contains('playing'));
 console.log('Old cached build updates and starts the game.');
 await page.close();
 const recovery=await browser.newPage({reducedMotion:'reduce'});recovery.setDefaultTimeout(60000);
 recovery.on('pageerror',e=>console.log('Recovery page error:',e.message));
 recovery.on('framenavigated',f=>{if(f===recovery.mainFrame())console.log('Recovery navigation:',f.url());});
 brokenModule=true;await recovery.goto(url);
 await recovery.waitForFunction(()=>!document.querySelector('#start-multiplayer').disabled);
 await recovery.locator('#start-multiplayer').click();
 await recovery.locator('#error').waitFor({state:'visible'});
 assert.match(await recovery.locator('#error-message').innerText(),/PROGRAM FILES COULD NOT LOAD/);
 console.log('Missing multiplayer module displays the recovery action.');
 brokenModule=false;const visits=updateVisits;
 await Promise.all([recovery.waitForURL(url+'update.html',{waitUntil:'commit'}),recovery.locator('#error button').click()]);
 await recovery.waitForURL(url);
 await recovery.waitForFunction(()=>!document.querySelector('#start-multiplayer')?.disabled&&!!document.querySelector('#start-multiplayer'));
 assert(updateVisits>visits,'Reload must visit the uncached update page');
 assert.equal(new URL(recovery.url()).pathname,scope);
 console.log('Missing multiplayer module recovers through the update page, including a failed first service-worker installation.');
 newest=true;
 await recovery.evaluate(async()=>{window.updateNavigationMarker='menu-stays-open';const r=await navigator.serviceWorker.getRegistration();await r.update();});
 await recovery.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration())?.waiting,{},{timeout:60000});
 await recovery.waitForTimeout(1500);
 assert.equal(await recovery.evaluate(()=>window.updateNavigationMarker),'menu-stays-open','background update must not reload the menu');
 assert(await recovery.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting),'update stays waiting while app is open');
 console.log('Background update waits without restarting the program menu.');
 console.log('Update page replaces an old cache-first worker and cached HTML with the current playable build.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
