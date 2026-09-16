import test from 'node:test';
import assert from 'node:assert/strict';
// This regression needs the film blueprint, not the default authored Node fixture.
globalThis.location={search:'?maze=blueprint',pathname:'/'};
const {createRun,step}=await import('../src/simulation/run.js');
const {groundRoute}=await import('../src/simulation/ground-tanks.js');
const {OPEN_CELLS,lineOfSight,wallIntersection}=await import('../src/levels/maze.js');
const dt=1/60;
test('all blueprint patrol tanks continue through corners for two minutes',()=>{
 const r=createRun();r.recognizers=[];r.enemyTanks=r.enemyTanks.filter(e=>e.role==='patrol');r.x=-9000;r.s=-9000;
 let previous=r.enemyTanks.map(e=>({x:e.x,s:e.s}));
 for(let i=0;i<7200;i++){
  step(r,{},dt);
  for(const e of r.enemyTanks)assert.equal(wallIntersection({...e,y:2},{...e,y:2},4),null);
  if(i%1200===1199){for(const [j,e] of r.enemyTanks.entries())assert.ok(Math.hypot(e.x-previous[j].x,e.s-previous[j].s)>5,`patrol ${e.id} stalled at ${r.time}`);previous=r.enemyTanks.map(e=>({x:e.x,s:e.s}));}
 }
});
test('Recognizer radio sends a maze patrol around a wall without granting direct sight',()=>{
 const r=createRun(),air=r.recognizers[0];let tank,goal;
 for(const candidate of r.enemyTanks.filter(e=>e.role==='patrol')){
  const point=OPEN_CELLS.find(p=>Math.hypot(p.x-candidate.x,p.s-candidate.s)>60&&Math.hypot(p.x-candidate.x,p.s-candidate.s)<280&&!lineOfSight({...candidate,y:2.8},{...p,y:2.8})&&groundRoute(candidate,p).length>1);
  if(point){tank=candidate;goal=point;break;}
 }
 r.enemyTanks=[tank];r.recognizers=[air];
 assert.ok(goal);Object.assign(r,{x:goal.x,s:goal.s,speed:0});
 Object.assign(air,{x:goal.x,s:goal.s,y:90,nextSense:0,nextAttack:Infinity});tank.nextSense=Infinity;tank.nextRoute=1000;
 const initial={x:tank.x,s:tank.s};
 for(let i=0;i<12;i++)step(r,{},dt);assert.equal(tank.memory,null);
 for(let i=0;i<90;i++)step(r,{},dt);
 assert.equal(tank.memory.source,air.id);assert.equal(tank.canSee,false);assert.ok(tank.nextRoute<1000);assert.ok(tank.path.length);
 for(let i=0;i<1200;i++)step(r,{},dt);
 assert.ok(Math.hypot(tank.x-initial.x,tank.s-initial.s)>20);assert.equal(tank.canSee,false);
 assert.equal(r.events.some(e=>e.type==='enemyShot'),false);
});
