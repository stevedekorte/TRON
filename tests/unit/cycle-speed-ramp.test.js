import test from 'node:test';
import assert from 'node:assert/strict';
import {gridSpeedAt,gridSpeedNotice} from '../../shared/simulation/cycle-speed-ramp.js';
import {resetCycleRound,updateCycleRace} from '../../shared/simulation/light-cycles.js';
import {forecastSpeed} from '../../shared/simulation/cycle-ai/speed.js';
import {CycleSpeedWarning} from '../../src/audio/cycle-speed-warning.js';
function fixture(elapsed=0){
 const r={site:{x:0,s:0},time:0,seed:1982,round:0,scores:[0,0],playerId:0};resetCycleRound(r);
 r.phase='racing';r.elapsed=elapsed;r.occupied.fill(0);r.trails=[];
 for(const b of r.cycles)Object.assign(b,{x:b.id*10,previousX:b.id*10,z:0,previousZ:0,nextReactionAt:Infinity,aiController:'classic'});
 return r;
}
test('grid increases compound every 15 seconds, ramp for one second and cap at double',()=>{
 assert.equal(gridSpeedAt(14.99),1);assert.equal(gridSpeedAt(15),1);assert.equal(gridSpeedAt(15.5),1.05);assert.equal(gridSpeedAt(16),1.1);
 assert(Math.abs(gridSpeedAt(31)-1.21)<1e-10);assert.equal(gridSpeedAt(121),2);assert.equal(gridSpeedAt(10000),2);
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
test('warnings count 3, 2, 1 then show the target speed and stop at the cap',()=>{
 const notice=t=>gridSpeedNotice({phase:'racing',elapsed:t});
 assert.equal(notice(11.9),null);
 for(const [t,n] of [[12,3],[13,2],[14,1]])assert.equal(notice(t).text,`SPEED INCREASE IN ${n}...`);
 assert.equal(notice(15).text,'GRID SPEED: 110%');assert.equal(notice(18),null);
 assert.equal(notice(120).text,'GRID SPEED: 200%');assert.equal(notice(133),null);
 assert.equal(gridSpeedNotice({phase:'result',elapsed:14}),null);
});
test('speed increase sounds once with a silent countdown and no replay after unmute',()=>{
 const audio=new CycleSpeedWarning({},null),calls=[];audio.tone=launch=>calls.push(launch);
 const r={round:1,phase:'racing',elapsed:12};
 audio.update(r,true);audio.update(r,true);r.elapsed=13;audio.update(r,false);audio.update(r,true);
 r.elapsed=14;audio.update(r,true);r.elapsed=15;audio.update(r,true);r.elapsed=16;audio.update(r,true);
 assert.deepEqual(calls,[true]);
 r.elapsed=60;audio.update(r,true);assert.equal(calls.length,2);
 r.round++;r.elapsed=12;audio.update(r,true);assert.equal(calls.length,2);
 r.elapsed=15;audio.update(r,false);audio.update(r,true);assert.equal(calls.length,2);
});
