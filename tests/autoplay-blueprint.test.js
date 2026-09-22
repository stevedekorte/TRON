import test from 'node:test';
import assert from 'node:assert/strict';
// Match the layout actually served by the browser, not the historic Node default.
const {createScenario}=await import('../src/levels/scenario.js');
const {world}=createScenario({layout:'blueprint'});
const {createRun,step}=await import('../src/simulation/run.js');
const {Autoplay}=await import('../src/simulation/autoplay.js');
const {wallIntersection}=world;
const {config}=await import('../src/game/config.js');
test('blueprint opening after combat has a clear mission route and captures two beams without a motionless corner stall',()=>{
 const r=createRun(1982,world),a=new Autoplay();r.recognizers=[];r.enemyTanks=[];a.setEnabled(true);a.input(r);
 assert.equal(a.tactical.plan.kind,'collect-data');assert.equal(a.mission.objectiveId,0);
 let last=r;for(const p of a.tactical.plan.route){assert.equal(wallIntersection({...last,y:2},{...p,y:2},config.tankRadius+.5),null);last=p;}
 for(let i=0;i<18000&&r.dataBeams[0].collectedAt===null;i++)step(r,a.input(r),1/60);
 assert.notEqual(r.dataBeams[0].collectedAt,null,JSON.stringify({x:r.x,s:r.s,plan:a.tactical.plan.kind,speed:r.speed}));
 let idle=0;
 for(let i=0;i<18000&&r.dataBeams.filter(b=>b.collectedAt!==null).length<2;i++){
  const input=a.input(r);step(r,input,1/60);
  idle=!r.transferActive&&Math.abs(r.speed)<.1&&Math.abs(input.steer)<.001?idle+1:0;
  assert(idle<180,'pilot stopped steering before completing a corner after the first beam');
 }
 assert(r.dataBeams.filter(b=>b.collectedAt!==null).length>=2,'pilot should leave the first maze and capture the next beam');
});
