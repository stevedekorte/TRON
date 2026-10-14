import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage(),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  navigator.permissions.query=async()=>({state:'granted'});
  window.SpeechRecognition=class {start(){} abort(){} stop(){this.onend?.();}};
 });
 let release;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/sounds/*.wav',async route=>{requests.push(route.request().url());await gate;await route.continue();});
 await page.goto('http://127.0.0.1:5173/bit/index.html');
 await page.waitForFunction(()=>VizApp._didBegin);await page.waitForTimeout(1200);
 assert.equal(await page.evaluate(()=>VizApp._objects.length),0,'do not listen before clips decode');assert.equal(requests.length,2);
 release();await page.waitForFunction(()=>VizApp._objects.length===1);
 const result=await page.evaluate(async()=>{
  const paths=BitSound.answerPaths;const buffers=paths.map(path=>BitSound.buffers[path]);
  if(buffers.some(b=>!b?.length))throw Error('Missing startup buffer');
  const original=window.fetch;let fetches=0;window.fetch=()=>{fetches++;throw Error('Playback should use the decoded cache');};
  let immediate=0;const start=BitSound.startBuffer.bind(BitSound);BitSound.startBuffer=buffer=>{immediate++;return start(buffer);};
  await BitSound.context.resume();
  for(const path of [...paths,...paths]){const before=immediate,pending=BitSound.play(path);if(immediate!==before+1)throw Error('Cached source did not start immediately');await pending;}
  window.fetch=original;return {fetches,same:paths.every((path,i)=>BitSound.buffers[path]===buffers[i]),pending:Object.keys(BitSound.pending).length};
 });
 assert.deepEqual(result,{fetches:0,same:true,pending:0});assert.equal(requests.length,2);assert.deepEqual(errors,[]);
 console.log('Cold startup waits for both decoded clips; first and repeated YES/NO playback start from cache with zero requests.');
}finally{await browser.close();}
