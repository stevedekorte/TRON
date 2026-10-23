import {chromium,webkit} from '@playwright/test';
import assert from 'node:assert/strict';
const engine=process.env.TRON_BROWSER==='chrome'?chromium:webkit;
const browser=await engine.launch({headless:true,...(engine===chromium?{channel:'chrome'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1000,height:700},deviceScaleFactor:2}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TRON_URL||'http://127.0.0.1:5188/?layoutSeed=1982&runSeed=1982');
 await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start-cycles').disabled,null,{timeout:120000});
 await page.evaluate(async()=>{
  const {View}=await import('/src/rendering/view.js'),render=View.prototype.render;
  View.prototype.render=function(...args){window.resizeView=this;return render.apply(this,args);};
 });
 await page.locator('#start-cycles').click();
 await page.waitForFunction(()=>__tron.state.cycleOpening!==null&&window.resizeView,null,{timeout:60000});
 for(const [width,height] of [[1728,1080],[1511,983],[1920,1080],[1000,700]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(250);
  const result=await page.evaluate(()=>{
   const v=resizeView,c=v.composer,gl=v.renderer.getContext();
   const invalidColors=cTarget=>{
    const pixels=new Uint16Array(cTarget.width*cTarget.height*4);
    v.renderer.readRenderTargetPixels(cTarget,0,0,cTarget.width,cTarget.height,pixels);
    let invalid=0;for(const value of pixels)if((value&0x7c00)===0x7c00)invalid++;
    return invalid;
   };
   return {invalidColors:[c.renderTarget1,c.renderTarget2].map(invalidColors),sceneSamples:v.scenePass.target.samples,
    buffers:[c.renderTarget1,c.renderTarget2].map(t=>({width:t.width,height:t.height,samples:t.samples})),
    expected:[innerWidth*v.renderer.getPixelRatio(),innerHeight*v.renderer.getPixelRatio()],
    validBuffers:[c.readBuffer,c.writeBuffer].every(t=>[c.renderTarget1,c.renderTarget2].includes(t)),error:gl.getError()};
  });
  assert(result.sceneSamples>0&&result.validBuffers);
  for(const t of result.buffers){assert.deepEqual([t.width,t.height],result.expected);assert.equal(t.samples,0);}
  assert.equal(result.error,0);
  assert.deepEqual(result.invalidColors,[0,0],'Bloom/composer colors must stay finite');
  await page.screenshot({path:`test-results/resize-opening-${process.env.TRON_BROWSER||'webkit'}-${width}.png`});
 }
 assert.deepEqual(errors,[]);console.log('Solo opening resize: separate resolved buffers, retained scene MSAA, valid ping-pong buffers, no WebGL errors.');
}finally{await browser.close();}
