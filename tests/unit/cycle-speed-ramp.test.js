import test from 'node:test';
import assert from 'node:assert/strict';
import {gridSpeedAt,gridSpeedNotice} from '../../shared/simulation/cycle-speed-ramp.js';
import {resetCycleRound,updateCycleRace} from '../../shared/simulation/light-cycles.js';
import {forecastSpeed} from '../../shared/simulation/cycle-ai/speed.js';
function fixture(elapsed=0){
 const r={site:{x:0,s:0},time:0,seed:1982,round:0,scores:[0,0],playerId:0};resetCycleRound(r);
 r.phase='racing';r.elapsed=elapsed;r.occupied.fill(0);r.trails=[];
 for(const b of r.cycles)Object.assign(b,{x:b.id*10,previousX:b.id*10,z:0,previousZ:0,nextReactionAt:Infinity,aiController:'classic'});
 return r;
}
test('grid adds 1% of initial speed per second smoothly and caps at double',()=>{
 assert.equal(gridSpeedAt(0),1);assert.equal(gridSpeedAt(-1),1);
 assert.equal(gridSpeedAt(1),1.01);assert.equal(gridSpeedAt(15),1.15);
 assert.equal(gridSpeedAt(50),1.5);assert.equal(gridSpeedAt(50.5),1.505);
 assert.equal(gridSpeedAt(100),2);assert.equal(gridSpeedAt(10000),2);
});
test('authority scales cruise, turbo and braking together; AI forecasts the scaled targets',()=>{
 for(const [pedal,speed] of [[0,1],[1,2.5],[-1,.5]]){
  const r=fixture(121),b=r.cycles[0];b.speedMultiplier=speed;
  updateCycleRace(r,1/120,0,pedal===1,pedal===-1);
  assert(Math.abs(b.speedMultiplier-2*speed)<1e-10);assert(Math.abs(b.z+2*speed*8/120)<1e-10);
  const forecast=forecastSpeed(b,pedal,.1,{});assert(Math.abs(forecast.speed-2*speed)<1e-10);
 }
});
test('staging and paused arenas do not advance the escalation clock; new matches reset',()=>{
 const r=fixture(14);r.phase='countdown';r.remaining=3;updateCycleRace(r,.5);assert.equal(r.elapsed,14);
 r.phase='racing';r.arenaPaused=true;updateCycleRace(r,.5);assert.equal(r.elapsed,14);
 resetCycleRound(r);assert.equal(r.elapsed,0);assert(r.cycles.every(b=>b.speedMultiplier===1));
});
test('indicator persists from countdown through results and at the cap',()=>{
 for(const phase of ['countdown','racing','result']){
  for(const [elapsed,percent] of [[0,100],[1,101],[15,115],[100,200],[133,200]])
   assert.equal(gridSpeedNotice({phase,elapsed}).text,`GRID SPEED: ${percent}%`);
 }
 assert.equal(gridSpeedNotice({phase:'racing',elapsed:50,arenaPaused:true}).text,'GRID SPEED: 150%');
 assert.equal(gridSpeedNotice(null),null);
});
