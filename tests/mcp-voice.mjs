import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {MCP_VOICE_MODEL} from '../src/mcp/voice-model.js';
let modelServer;
if(process.argv.includes('--local-models')){
 modelServer=createServer(async(req,res)=>{
  const prefix=`/${MCP_VOICE_MODEL.id}/resolve/${MCP_VOICE_MODEL.revision}/`,path=new URL(req.url,'http://localhost').pathname;
  const file=path.startsWith(prefix)?path.slice(prefix.length):'';console.log('MODEL',path);
  if(!/^(onnx\/)?[\w.-]+$/.test(file)){res.writeHead(404);res.end();return;}
  try{const local=`.local/voice-models/${MCP_VOICE_MODEL.id}/${MCP_VOICE_MODEL.revision}/${file}`,info=await stat(local);
   res.writeHead(200,{'Access-Control-Allow-Origin':'*','Content-Length':info.size,'Content-Type':file.endsWith('.json')?'application/json':'application/octet-stream'});createReadStream(local).pipe(res);
  }catch{res.writeHead(404,{'Access-Control-Allow-Origin':'*'});res.end();}
 });await new Promise(resolve=>modelServer.listen(5184,'127.0.0.1',resolve));
}
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5183','--strictPort'],{stdio:'pipe',env:{...process.env,...(modelServer?{VITE_MCP_MODEL_TEST_HOST:'http://127.0.0.1:5184/'}:{})}});
await new Promise((resolve,reject)=>{server.stdout.on('data',s=>{if(s.toString().includes('Local:'))resolve();});server.on('exit',()=>reject(Error('Vite failed')));});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 let downloads=0;page.context().on('request',r=>{if(/huggingface\.co|hf\.co|127\.0\.0\.1:5184/.test(r.url()))downloads++;});
 page.on('pageerror',e=>console.log('PAGE ERROR',e.name,e.message,e.stack));
 page.on('requestfailed',r=>console.log('REQUEST FAILED',r.url(),r.failure()));
 page.on('console',m=>{if(m.type()==='error')console.log(m.text());});
 await page.route('**/api/mcp/status',r=>r.fulfill({json:{configured:false}}));
 await page.goto('http://127.0.0.1:5183/mcp.html');await page.waitForTimeout(1000);
 const gpu=await page.evaluate(async()=>!!navigator.gpu&&!!await navigator.gpu.requestAdapter());console.log('WebGPU adapter:',gpu);assert(gpu,'WebGPU available');
 // MCP entry automatically starts voice loading.
 for(let i=0;i<120;i++){
  const status=await page.locator('#voice-status').textContent();if(i%6===0)console.log(status);
  if(await page.locator('#test-voice').isEnabled())break;
  if(await page.locator('#load-voice').isEnabled())throw Error(status);
  await page.waitForTimeout(2500);
 }
 assert(await page.locator('#test-voice').isEnabled(),'model and MCP reference loaded');
 const start=Date.now();await page.locator('#test-voice').click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent==='MCP SPEAKING',{},{timeout:120000});
 console.log('Browser time to audio:',(Date.now()-start)/1000,'seconds');
 await page.screenshot({path:'test-results/mcp-cloned-speaking.png'});
 await page.waitForFunction(()=>document.querySelector('#status').textContent==='YOUR TURN',{},{timeout:30000});
 const cache=await page.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('tron-mcp-voice-models',2);request.onsuccess=()=>{const read=request.result.transaction('files').objectStore('files').getAll();read.onsuccess=()=>resolve({files:read.result.length,bytes:read.result.reduce((n,f)=>n+f.body.size,0)});read.onerror=()=>reject(read.error);};}));
 console.log('IndexedDB cache:',cache);assert(cache.bytes>1000000000,'model weights stored in IndexedDB');
 const before=downloads;await page.reload();
 await page.waitForFunction(()=>!document.querySelector('#test-voice').disabled,{},{timeout:180000});
 assert.equal(downloads,before,'returning to MCP uses IndexedDB without another model download');
 console.log('Real in-browser MCP voice cloning, playback and cached reload passed.');
}finally{await browser.close();server.kill();modelServer?.close();}
