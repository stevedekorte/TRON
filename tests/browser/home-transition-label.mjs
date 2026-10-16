import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();
 await page.route('**/transition-label-test',r=>r.fulfill({contentType:'text/html',body:'<div id="intro"><div id="game-menu"><button id="clu">CLU <span id="note" hidden>(UNAVAILABLE ON MOBILE)</span></button><button id="cycles">LIGHT CYCLES</button></div></div>'}));
 await page.goto((process.env.TRON_URL??'http://127.0.0.1:5188/')+'transition-label-test');
 const result=await page.evaluate(async()=>{
  const {createHomeTransition}=await import('/src/ui/home-transition.js');
  const transition=createHomeTransition(),rows=[];
  for(const [selected,mobile] of [['clu',false],['cycles',false],['cycles',true]]){
   document.querySelector('#note').hidden=!mobile;
   await transition.begin(document.getElementById(selected),{waitForScene:true,preparedScene:true});
   rows.push({selected:document.querySelector('#home-selected-label').textContent,all:document.querySelector('#home-transition').textContent});
   transition.clear();
  }
  return rows;
 });
 assert.equal(result[0].selected,'CLU');
 assert(!result[0].all.includes('UNAVAILABLE'));assert(!result[1].all.includes('UNAVAILABLE'));
 assert(result[2].all.includes('(UNAVAILABLE ON MOBILE)'));
 console.log('Hidden mobile label excluded from selected and unselected desktop transition copies; visible mobile label preserved.');
}finally{await browser.close();}
