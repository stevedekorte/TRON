import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { GRID, cellCenter, freePosition } from '../src/levels/maze.js';
import { angleDelta } from '../src/game/config.js';

function path(from,to) {
  const key=p=>p.join(','),queue=[from],parents=new Map([[key(from),null]]);
  for(let i=0;i<queue.length;i++) {
    const p=queue[i];if(key(p)===key(to))break;
    for(const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const n=[p[0]+dc,p[1]+dr],k=key(n);
      if(GRID[n[1]]?.[n[0]]===0&&!parents.has(k)){parents.set(k,p);queue.push(n);}
    }
  }
  assert.ok(parents.has(key(to)));const route=[];
  for(let p=to;p;p=parents.get(key(p)))route.unshift(cellCenter(...p));return route;
}
const waypoints=[...path([12,0],[19,19]),...path([19,19],[1,1]).slice(1),...path([1,1],[23,23]).slice(1)];
const duration=Number(process.argv.find(a=>a.startsWith('--duration='))?.split('=')[1]||180);
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[],snapshots=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
let steerKey=null,driveKey=null,index=0,distance=0;
async function keyChange(old,next){if(old===next)return next;if(old)await page.keyboard.up(old);if(next)await page.keyboard.down(next);return next;}
try {
  await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>!document.querySelector('#start').disabled);await page.waitForFunction(()=>document.querySelector('.terminal-copy.complete'));await page.keyboard.press('Enter');await page.waitForFunction(()=>document.body.classList.contains('playing'));
  const started=Date.now();let lastSample=0,previous=null;
  while(Date.now()-started<duration*1000) {
    const state=await page.evaluate(()=>window.__tron.state);
    assert.equal(state.mode,'running');assert.equal(state.recognizers.length,5);
    assert.ok(freePosition(state.x,state.s,3.49),'tank stays outside all diagonal slabs');
    if(previous)distance+=Math.hypot(state.x-previous.x,state.s-previous.s);previous=state;
    let goal=waypoints[Math.min(index,waypoints.length-1)],d=Math.hypot(goal.x-state.x,goal.s-state.s);
    if(d<7&&index<waypoints.length-1){index++;goal=waypoints[index];d=Math.hypot(goal.x-state.x,goal.s-state.s);}
    const error=angleDelta(state.yaw,-Math.atan2(goal.x-state.x,goal.s-state.s));
    steerKey=await keyChange(steerKey,error>.03?'KeyA':error<-.03?'KeyD':null);
    const desiredSpeed=Math.abs(error)>.3?0:Math.min(13,Math.max(3,d*.35));
    driveKey=await keyChange(driveKey,state.speed<desiredSpeed-.7?'KeyW':state.speed>desiredSpeed+.7?'KeyS':null);
    if(Date.now()-lastSample>30_000) {
      const sample={elapsed:Math.round((Date.now()-started)/1000),waypoint:index,distance:Math.round(distance),memory:state.renderer,states:state.recognizers.map(e=>e.state),performance:await page.evaluate(()=>window.__tron.performance)};
      snapshots.push(sample);console.log(JSON.stringify(sample));lastSample=Date.now();
    }
    await page.waitForTimeout(65);
  }
  await page.screenshot({path:'test-results/simulation-1080p.png'});
  // Survey the roofs and aircraft after traversing real junctions.
  await page.keyboard.press('KeyV');await page.waitForTimeout(1000);await page.screenshot({path:'test-results/simulation-aerial-1080p.png'});
  const report={browser:await browser.version(),duration,waypointsReached:index,distance,snapshots,errors};
  await writeFile('test-results/soak.json',JSON.stringify(report,null,2));
  assert.deepEqual(errors,[]);assert.ok(index>=8,`traversed ${index} waypoints`);
  assert.ok(snapshots.at(-1).memory.geometries<=snapshots[Math.min(2,snapshots.length-1)].memory.geometries+3);
  assert.ok(snapshots.at(-1).memory.textures<=snapshots[Math.min(2,snapshots.length-1)].memory.textures+2);
  console.log(`${duration}s simulation traversal passed: ${index} waypoints, ${Math.round(distance)}m.`);
}finally{await browser.close();}
