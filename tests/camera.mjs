import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.waitForFunction(()=>document.querySelector('.terminal-copy.complete'));await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.body.classList.contains('playing'));
 await page.keyboard.press('Escape');
 // Hide pause UI only in this render fixture, retaining frozen simulation.
 await page.locator('#overlay').evaluate(e=>e.style.display='none');
 for(const height of [77,30,11]) {
   await page.evaluate(y=>{
     const r=window.__tron.state;
     const recognizers=r.recognizers.map((e,i)=>({...e,x:-1800,s:-1800,y,state:i?'destroyed':'pursue',attack:null,fold:y===11?1:0}));
     window.__tron.place({x:-1800,s:-1800,yaw:0,speed:0,recognizers});
   },height);
   await page.waitForTimeout(3200);
   const points=await page.evaluate(y=>[window.__tron.project({x:-1800,s:-1800,y:2}),window.__tron.project({x:-1800,s:-1800,y:y+4})],height);
   for(const p of points){assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<.98&&p.z<1,JSON.stringify({height,p}));}
   await page.screenshot({path:'test-results/camera-recognizer-'+height+'.png'});
 }
 for(const turretYaw of [Math.PI/2,Math.PI,-Math.PI/2]){
   await page.evaluate(turretYaw=>window.__tron.place({x:-1800,s:-1800,yaw:0,turretYaw,recognizers:window.__tron.state.recognizers.map(e=>({...e,state:'destroyed'}))}),turretYaw);
   await page.waitForTimeout(1500);
   const c=await page.evaluate(()=>window.__tron.state.camera);
   assert.ok((c.x+1800)*Math.sin(turretYaw)+(c.z-1800)*Math.cos(turretYaw)>15);
 }
 assert.deepEqual(errors,[]);console.log('Tank top and Recognizer crown remain in frame at patrol, descent and impact heights.');
}finally{await browser.close();}
