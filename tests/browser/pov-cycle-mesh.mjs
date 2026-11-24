// The normal-renderer light cycle mesh (tools/assets/pov-cycle-mesh.mjs) against the
// exact POV-Ray CSG it was converted from, in raycast-cycle.html with identical
// lighting. Captures both from many poses, a per-pixel difference image, and the
// share of cycle pixels that differ visibly.
import {chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.TRON_URL||'http://127.0.0.1:5173/';
const out='test-results/cycle-rendering/pov-cycle-mesh';mkdirSync(out,{recursive:true});
// Camera positions and targets in metres (the cycle is 3.6 m long along Z, front toward -Z).
const POSES={
 frontQuarter:[[3.6,1.6,-4.2],[0,.65,0]], rearQuarter:[[-3.8,1.8,4.4],[0,.65,0]],
 left:[[-5.5,.8,0],[0,.75,0]], right:[[5.5,.8,0],[0,.75,0]], top:[[.01,7,0],[0,0,0]], front:[[0,.9,-6],[0,.7,0]], rear:[[0,1,6],[0,.7,0]],
 frontWheelClose:[[1.6,.75,-2.7],[0,.6,-1.5]], frontWheelLow:[[1.3,.25,-2.3],[0,.55,-1.45]], frontWheelOther:[[-1.6,.75,-2.7],[0,.6,-1.5]],
 rearWheelClose:[[1.7,.8,2.6],[0,.6,1.2]], cockpitClose:[[1.5,1.9,-.6],[0,1.1,-.3]], underside:[[2.2,-.02,-.4],[0,.5,0]],
};
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
const results={};
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'raycast-cycle.html?mesh=pov');
 await page.waitForFunction(()=>window.raycastStudy?.ready,null,{timeout:120000});
 await page.evaluate(()=>{document.querySelector('#orbit').checked=false;raycastStudy.resize(720);});
 for(const [name,[position,target]] of Object.entries(POSES)){
  for(const mode of ['analytic','mesh']){
   await page.evaluate(({position,target,mode})=>{const s=raycastStudy;s.setMode(mode);s.controls.enabled=false;s.controls.minDistance=0;s.controls.maxPolarAngle=Math.PI;s.camera.position.set(...position);s.controls.target.set(...target);s.controls.update();},{position,target,mode});
   await page.waitForTimeout(400);
   await page.locator('canvas').screenshot({path:`${out}/${name}-${mode}.png`});
  }
  // Fraction of pixels that differ visibly, within the cycle's footprint (either image differs from the empty floor).
  const diff=`${out}/${name}-diff.png`;
  try{execFileSync('magick',['compare','-metric','AE','-fuzz','8%',`${out}/${name}-analytic.png`,`${out}/${name}-mesh.png`,diff],{stdio:'pipe'});results[name]={differing:0};}
  catch(e){const pixels=Number(/\(([\d.e+-]+)\)/.exec(String(e.stderr))?.[1]);results[name]={differingPixels:pixels,percentOfFrame:+(pixels/(1280*800)*100).toFixed(2)};}
 }
 execFileSync('magick',['montage',...Object.keys(POSES).flatMap(n=>[`${out}/${n}-analytic.png`,`${out}/${n}-mesh.png`,`${out}/${n}-diff.png`]),'-tile','3x','-geometry','480x270+3+3','-background','black',`${out}/sheet.png`]);
 console.log(JSON.stringify(results));
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
