import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const catalog=JSON.parse(fs.readFileSync('docs/sounds/catalog.json','utf8'));
assert.equal(new Set(catalog.items.map(i=>i.id)).size,catalog.items.length);
for(const item of catalog.items){
 if(item.disk){assert.ok(fs.existsSync(item.disk));if(item.sha256)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(item.disk)).digest('hex'),item.sha256);}
 if(item.catalog)assert.ok(fs.existsSync('docs/sounds/'+item.catalog));
}
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/docs/index.html');await page.getByRole('link',{name:/Sound library Listen/}).click();
 await page.waitForFunction(()=>document.querySelector('h1')?.textContent==='Sound library');
 assert.equal(await page.locator('audio').count(),catalog.items.filter(i=>i.playback).length);
 const loaded=await page.evaluate(async()=>{
  const players=[...document.querySelectorAll('audio')].slice(0,4);
  return Promise.all(players.map(a=>new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Metadata timeout: '+a.src)),15000);
   a.addEventListener('loadedmetadata',()=>{clearTimeout(timer);resolve({duration:a.duration,url:a.src});},{once:true});
   a.addEventListener('error',()=>{clearTimeout(timer);reject(Error('Audio failed: '+a.src));},{once:true});a.load();
  })));
 });
 assert.ok(loaded.every(a=>a.duration>20&&Number.isFinite(a.duration)));
 await page.locator('audio').first().evaluate(a=>a.play());await page.waitForTimeout(100);assert.equal(await page.locator('audio').first().evaluate(a=>a.paused),false);await page.locator('audio').first().evaluate(a=>a.pause());
 await page.screenshot({path:'test-results/sound-library.png'});
 assert.deepEqual(errors,[]);console.log({resources:catalog.items.length,audioPlayers:catalog.items.filter(i=>i.playback).length,downloadedPreviews:loaded.length});
}finally{await browser.close();}
