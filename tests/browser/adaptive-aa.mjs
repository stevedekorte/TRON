import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TRON_URL||'http://127.0.0.1:5188/?layoutSeed=1982&runSeed=1982');
 await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start').disabled,null,{timeout:120000});
 const initial=await page.evaluate(()=>__tron.state.renderer);
 assert.equal(initial.pixelRatio,1.5);
 await page.evaluate(async()=>{
  const {View}=await import('/src/rendering/view.js');const resize=View.prototype.resize;
  View.prototype.resize=function(){window.aaView=this;return resize.call(this);};window.dispatchEvent(new Event('resize'));View.prototype.resize=resize;
 });
 const result=await page.evaluate(async()=>{
  const {config}=await import('/src/game/config.js');const view=window.aaView;
  config.adaptiveAntialiasing=true;
  const samples=view.adaptiveAA.levels;
  for(let i=0;i<45*25;i++)view.updateAntialiasing(1/25,true);
  const low={ratio:view.renderer.getPixelRatio(),samples:view.composer.renderTarget1.samples,index:view.adaptiveAA.index};
  for(let i=0;i<180*60;i++)view.updateAntialiasing(1/60,true);
  const recovered={ratio:view.renderer.getPixelRatio(),samples:view.composer.renderTarget1.samples,index:view.adaptiveAA.index};
  return {low,recovered};
 });
 assert.equal(result.low.ratio,1);assert.equal(result.low.samples,0);assert(result.recovered.index>0);assert(result.recovered.ratio>=1.5);
 // Renderer switches must start sharp and preserve the normal scene controller.
 await page.evaluate(()=>__tron.setCycleRenderer('pov'));
 assert.equal(await page.evaluate(()=>__tron.state.renderer.pixelRatio),1.5);
 await page.evaluate(()=>__tron.setCycleRenderer('normal'));
 assert.equal(await page.evaluate(()=>__tron.state.renderer.pixelRatio),result.recovered.ratio);
 assert.deepEqual(errors,[]);console.log('Native-resolution floor, recovery, restored initial supersampling and ray-cast renderer switching verified.',{initial,result});
}finally{await browser.close();}
