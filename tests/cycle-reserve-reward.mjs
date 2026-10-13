import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 await page.route('**/reward-preview',r=>r.fulfill({contentType:'text/html',body:`<link rel="stylesheet" href="/src/ui/style.css"><body class="cycle-mode"><div id="vehicle-meters"><div id="turbo" class="turbo-indicator"><span>W / TURBO</span><div class="turbo-meter"><i id="turbo-fill"></i></div></div><div id="cycle-brake" class="turbo-indicator"><span>S / BRAKE</span><div class="turbo-meter"><i id="cycle-brake-fill"></i></div></div></div></body>`}));
 await page.goto('http://127.0.0.1:5173/reward-preview');
 const values=await page.evaluate(async()=>{
  const {HudPresenter}=await import('/src/ui/hud-presenter.js');
  const hud=Object.create(HudPresenter.prototype),bike={};
  hud.updateReserveReward(bike,0);
  bike.reserveReward={turboFrom:.2,brakeFrom:.3};
  hud.updateReserveReward(bike,100);
  const start=document.querySelector('#turbo-fill').style.transform;
  hud.updateReserveReward(bike,425);
  const middle=document.querySelector('#turbo-fill').style.transform;
  window.rewardHud=hud;window.rewardBike=bike;
  return {start,middle,bright:getComputedStyle(document.querySelector('#turbo-fill')).backgroundColor};
 });
 assert.equal(values.start,'scaleX(0.2)');assert.equal(values.middle,'scaleX(0.9)');
 assert.equal(values.bright,'rgb(255, 255, 255)');
 await page.screenshot({path:'test-results/cycle-reserve-reward.png'});
 assert(await page.evaluate(()=>{
  rewardHud.updateReserveReward(rewardBike,1300);
  const ended=!document.querySelector('.reserve-reward');
  rewardBike.reserveReward={turboFrom:0,brakeFrom:0};rewardHud.updateReserveReward(rewardBike,1400);
  rewardHud.updateReserveReward({},1500);
  return ended&&!document.querySelector('.reserve-reward');
 }));
 console.log('Bright recharge fill, completion, and watched-cycle cleanup passed.');
}finally{await browser.close();}
