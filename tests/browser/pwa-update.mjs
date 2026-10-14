import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
let updated=false;
const root=resolve('dist'),scope='/fun/TRON/';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.wasm':'application/wasm'};
const server=createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://localhost').pathname;
  if(!path.startsWith(scope)){res.writeHead(404).end();return;}
  const file=resolve(root,decodeURIComponent(path.slice(scope.length)||'index.html'));
  if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
  let data=await readFile(file);
  if(!updated&&file.endsWith('/index.html'))data=Buffer.from('<html><body>OLD CACHED BUILD<script>navigator.serviceWorker.register("./sw.js")</script></body></html>');
  if(!updated&&file.endsWith('/sw.js'))data=Buffer.from(data.toString().replace(/self.addEventListener\('message',event=>\{[\s\S]*?\n\}\);/,'').replace(/const CACHE = ([^;]+);/,'const CACHE = $1 + "-old";'));
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
 await page.keyboard.press('KeyC');await page.locator('#controls-help').waitFor({state:'visible'});
 console.log('Update page replaces an old cache-first worker and cached HTML with the current playable build.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
