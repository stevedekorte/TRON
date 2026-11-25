// Holding Q (or E) sidesteps the arena cycle: a left (right) turn on press, the
// opposite turn on release, back on the original heading one jog over. The camera
// keeps the original heading throughout, in follow and first-person views. Other
// turn keys and the other sidestep key are ignored while one is held.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.TRON_URL||'http://localhost:5173/';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'{}'}));
 const startMatch=async()=>{
  await page.goto(base);await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start-cycles').disabled,null,{timeout:120000});
  await page.locator('#start-cycles').click();await page.waitForFunction(()=>__tron.state.cycleRace?.phase==='racing',null,{timeout:120000});
  // Wait for the launch: the cycle is moving and the opening camera has finished.
  await page.waitForFunction(()=>{const r=__tron.state.cycleRace,b=r.cycles[r.playerId];return (window.__x0??=b.x+','+b.z)!==b.x+','+b.z;},null,{timeout:120000});
  // Sidestep early: about 4 s after launch the opposing team arrives head-on.
  await page.waitForTimeout(1500);
 };
 await startMatch();
 // Hold the key for holdMs, pressing `extra` keys midway; sample camera yaw and the player each frame.
 const sidestep=(key,holdMs,extra=[])=>page.evaluate(async({key,holdMs,extra})=>{
  const b=()=>{const r=__tron.state.cycleRace;return r.cycles[r.playerId];},frame=()=>new Promise(f=>requestAnimationFrame(f));
  const yaw=()=>{const [x,y,z,w]=__tron.state.camera.rotation;return Math.atan2(2*(x*z+w*y),1-2*(x*x+y*y));};
  const send=(type,code)=>window.dispatchEvent(new KeyboardEvent(type,{code,key:code,bubbles:true}));
  const start={dir:b().dir,x:b().x,z:b().z,yaw:yaw(),turns:b().turns},samples=[],dirs=new Set();
  send('keydown',key);const t0=performance.now();let extraSent=false;
  while(performance.now()-t0<holdMs){await frame();samples.push(yaw());dirs.add(b().dir);
   if(!extraSent&&performance.now()-t0>holdMs/2){extraSent=true;for(const k of extra){send('keydown',k);send('keyup',k);}}}
  send('keyup',key);
  for(let i=0;i<20;i++){await frame();samples.push(yaw());}
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const [fx,fz]=[[0,-1],[1,0],[0,1],[-1,0]][start.dir];
  const dx=b().x-start.x,dz=b().z-start.z;
  return {alive:b().alive,startDir:start.dir,endDir:b().dir,dirsDuringHold:[...dirs],turns:b().turns-start.turns,
   lateralCells:+Math.abs(dx*fz-dz*fx).toFixed(3),forwardCells:+(dx*fx+dz*fz).toFixed(2),
   maxCameraYawDegrees:+(Math.max(...samples.map(s=>Math.abs(wrap(s-start.yaw))))*180/Math.PI).toFixed(2)};
 },{key,holdMs,extra});
 // Wait until no other cycle or trail lies within three cells to either side or
 // twelve cells ahead (teammates often ride one cell over just after launch).
 const clear=()=>page.waitForFunction(()=>{
  const r=__tron.state.cycleRace,b=r.cycles[r.playerId],[fx,fz]=[[0,-1],[1,0],[0,1],[-1,0]][b.dir];
  const near=(x,z)=>{const dx=x-b.x,dz=z-b.z,along=dx*fx+dz*fz,side=Math.abs(dx*fz-dz*fx);return side<=3&&along>-3&&along<12;};
  if(r.cycles.some(o=>o.id!==b.id&&o.alive&&near(o.x,o.z)))return false;
  return !r.trails.some(t=>{if(t.bikeId===b.id)return false;const n=Math.ceil(Math.hypot(t.x2-t.x1,t.z2-t.z1)*2)+1;
   for(let i=0;i<=n;i++){const u=i/n;if(near(t.x1+(t.x2-t.x1)*u,t.z1+(t.z2-t.z1)*u))return true;}return false;});
 },null,{timeout:30000,polling:100});
 const check=(name,r,turn)=>{
  console.log(name,JSON.stringify(r));
  assert(r.alive,`${name}: survived`);
  assert.equal(r.endDir,r.startDir,`${name}: back on the starting heading`);
  assert.equal(r.turns,2,`${name}: exactly two turns`);
  assert(r.dirsDuringHold.includes((r.startDir+turn+4)%4),`${name}: turned ${turn<0?'left':'right'} while held`);
  assert(r.lateralCells>.05,`${name}: moved over`);
  assert(r.maxCameraYawDegrees<2,`${name}: camera kept the heading`);
 };
 // The AI is not seeded here, so a rider can die to traffic regardless of the
 // sidestep. A death (before or during it) retries in a fresh match, up to three times.
 let firstPerson=false;
 const run=async(name,key,holdMs,turn,{extra=[],fp=false}={})=>{
  for(let attempt=1;;attempt++){
   if(fp&&!firstPerson){await page.keyboard.press('KeyP');await page.waitForFunction(()=>__tron.state.camera.cycleFirstPersonMix>.97,null,{timeout:10000});firstPerson=true;}
   const ready=await clear().then(()=>true,()=>false);
   const r=ready?await sidestep(key,holdMs,extra):null;
   if(r?.alive){check(name,r,turn);return;}
   console.log(name,`attempt ${attempt}: ${r?'died '+JSON.stringify(r):'no clear lane'}; new match`);
   assert(attempt<3,`${name}: three attempts failed`);
   await startMatch();firstPerson=false;
  }
 };
 await run('follow E','KeyE',250,1);
 await run('follow Q with A, D, E and Left pressed while held','KeyQ',250,-1,{extra:['KeyA','KeyD','KeyE','ArrowLeft']});
 // A fresh match for first person: about 4 s after launch the opposing team arrives head-on.
 await startMatch();
 await run('first-person E','KeyE',200,1,{fp:true});
 // A quick tap still makes a sidestep and returns to the heading.
 await run('tap Q','KeyQ',1,-1,{fp:true});
 // Control: an ordinary turn does move this camera measure.
 const turned=await page.evaluate(async()=>{
  const yaw=()=>{const [x,y,z,w]=__tron.state.camera.rotation;return Math.atan2(2*(x*z+w*y),1-2*(x*x+y*y));},y0=yaw();
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyD',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyD',bubbles:true}));
  for(let i=0;i<30;i++)await new Promise(f=>requestAnimationFrame(f));
  return Math.abs(Math.atan2(Math.sin(yaw()-y0),Math.cos(yaw()-y0)))*180/Math.PI;
 });
 console.log('ordinary turn camera yaw degrees',turned.toFixed(1));assert(turned>60,'an ordinary turn turns the camera');
 assert.deepEqual(errors,[]);
 console.log('Sidestep keeps the heading and camera.');
}finally{await browser.close();}
