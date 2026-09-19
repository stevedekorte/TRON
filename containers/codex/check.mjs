import assert from 'node:assert/strict';
import {access,writeFile,unlink} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
const require=createRequire('/workspace/package.json');
const {chromium}=require('@playwright/test');
assert.equal(process.env.TRON_CONTAINER,'1');
assert.equal(process.getuid(),1000,'Run as the unprivileged node user');
for(const path of ['/var/run/docker.sock','/Users/steve']){
 await assert.rejects(access(path),{code:'ENOENT'});
}
await assert.rejects(writeFile('/etc/tron-write-probe','probe'),error=>['EROFS','EACCES'].includes(error.code));
const probe='/workspace/test-results/container-write-probe';await writeFile(probe,'probe');await unlink(probe);
function run(command,args){
 const result=spawnSync(command,args,{cwd:'/workspace',stdio:'inherit',timeout:600000});
 assert.equal(result.error,undefined,`${command}: ${result.error}`);
 assert.equal(result.status,0,`${command} ${args.join(' ')} failed`);
}
run('codex',['--version']);
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL,headless:true});
let graphics;
try{
 const page=await browser.newPage();
 graphics=await page.evaluate(()=>{
  const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2');
  if(!gl)return null;
  gl.clearColor(.25,.5,.75,1);gl.clear(gl.COLOR_BUFFER_BIT);const pixel=new Uint8Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
  const info=gl.getExtension('WEBGL_debug_renderer_info');
  return {renderer:info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),pixel:[...pixel]};
 });
 assert.ok(graphics,'WebGL 2 must be available');assert.deepEqual(graphics.pixel,[64,128,191,255]);
 console.log({browser:browser.version(),graphics});
}finally{await browser.close();}
run('npm',['test']);
for(const file of ['roof-edge-shadows','maze-grid-shadows','recognizer-momentum'])run('node',[`tests/${file}.mjs`]);
run('npm',['run','build']);
await writeFile('/workspace/test-results/container-check.json',JSON.stringify({passed:true,date:new Date().toISOString(),platform:process.platform,architecture:process.arch,node:process.version,graphics},null,2));
console.log('Container isolation, browser/WebGL, simulation, rendered regressions and production build passed.');
