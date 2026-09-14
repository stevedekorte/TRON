import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__tron.state.mode==='running');await page.keyboard.press('Escape');
 await page.evaluate(()=>{
  const r=window.__tron.state;
  const recognizers=r.recognizers.map((e,i)=>({...e,x:-5050,s:-4850,y:77,yaw:0,state:i?'destroyed':'search',canSee:false,nextSense:Infinity,memory:{x:-5000,s:-4650,vx:0,vs:0,seenAt:r.time,source:0},goal:{x:-5000,s:-4650},goalUntil:r.time+15,attack:null,fold:0,vx:0,vs:0}));
  window.__tron.place({x:-5000,s:-5000,speed:0,yaw:0,turretYaw:0,recognizers});
 });
 await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__tron.state.searchlights[0].strength>.8);
 await page.waitForTimeout(500);await page.keyboard.press('Escape');
 const beams=await page.evaluate(()=>window.__tron.state.searchlights);
 assert.equal(beams[0].visible,true);assert.ok(beams.slice(1).every(b=>!b.visible));assert.ok(beams[0].length>0&&beams[0].length<=260);
 await page.screenshot({path:'test-results/recognizer-searchlight.png'});
 await page.waitForTimeout(150);assert.deepEqual(await page.evaluate(()=>window.__tron.state.searchlights.map(b=>b.strength)),beams.map(b=>b.strength));
 const clipping=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');const {clippedBeamEnd,beamPose}=await import('/src/rendering/searchlights.js');
  const {WALLS}=await import('/src/levels/maze.js');const w=WALLS[0],a=w.points[0],b=w.points[1];
  const mx=(a.x+b.x)/2,ms=(a.s+b.s)/2,dx=b.x-a.x,ds=b.s-a.s,len=Math.hypot(dx,ds);
  const start=new T.Vector3(mx-ds/len*30,20,-ms-dx/len*30),end=new T.Vector3(mx+ds/len*30,20,-ms+dx/len*30);
  const clipped=clippedBeamEnd(start,end);
  return {wallDistance:start.distanceTo(clipped),total:start.distanceTo(end),floor:clippedBeamEnd(new T.Vector3(-5000,30,5000),new T.Vector3(-5000,-20,5000)).y,
   disabled:['destroyed','fold','drop','pursue'].every(state=>beamPose({state,id:0},1)===null)};
 });
 assert.ok(clipping.wallDistance<clipping.total-.1);assert.ok(Math.abs(clipping.floor-.04)<1e-6);assert.ok(clipping.disabled);assert.deepEqual(errors,[]);
 console.log('Search beam rendered; walls/floor clip rays; destroyed/attack/pursuit states disable beams; pause freezes sweep.');
}finally{await browser.close();}
