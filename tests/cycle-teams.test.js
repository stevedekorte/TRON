import test from 'node:test';
import assert from 'node:assert/strict';
import {browserScenario} from '../src/game/browser-scenario.js';
import {GameSession} from '../src/simulation/game-session.js';
import {createCycleRace,resetCycleRound,updateCycleRace} from '../src/simulation/light-cycles.js';
import {ARENA_WALL} from '../src/game/arena-breaches.js';
import {LIGHT_CYCLES as C,CYCLE_DIRECTIONS as DIR} from '../src/game/light-cycles.js';
const world=browserScenario({pathname:'/',search:'?layoutSeed=1982'}).world;
test('all nine rosters spawn equal teams on distinct sides with connected starting trails',()=>{
 for(const teamCount of [2,3,4])for(const cyclesPerTeam of [1,2,3]){
  const r=createCycleRace(world,1982);Object.assign(r,{teamCount,cyclesPerTeam,entranceFormation:true,hideMiddleOpponent:false});resetCycleRound(r);
  assert.equal(r.cycles.length,teamCount*cyclesPerTeam);
  assert.equal(new Set(r.cycles.map(b=>`${b.x},${b.z}`)).size,r.cycles.length);
  for(let t=0;t<teamCount;t++)assert.equal(r.cycles.filter(b=>b.team===t&&b.alive).length,cyclesPerTeam);
  r.remaining=0;updateCycleRace(r,1/120);
  for(const b of r.cycles){
   const trail=r.trails[b.segment],[dx,dz]=DIR[b.dir];
   assert(Math.abs(Math.max(Math.abs(trail.x1),Math.abs(trail.z1))*C.cellMeters-(ARENA_WALL.innerMeters-C.lengthMeters*C.startWallClearanceLengths))<1e-8);
   assert(Math.abs(((b.x-trail.x1)*dx+(b.z-trail.z1)*dz)*C.cellMeters-C.lengthMeters/2)<1e-8);
  }
 }
});
test('first player match is 2x3; later seeded matches cover every size and survive returning home',()=>{
 const s=new GameSession({world,seed:1982});
 const enter=()=>{s.requestCycleEntry({startOutside:false,startWithBreach:false,hideMiddleOpponent:false,entranceFormation:true});s.advance({},1/120);};enter();
 assert.equal(s.run.cycleRace.teamCount,2);assert.equal(s.run.cycleRace.cyclesPerTeam,3);
 const sizes=new Set();
 for(let i=0;i<100;i++){
  const r=s.run.cycleRace;r.phase='result';assert(s.restartCycleMatch());
  sizes.add(`${r.teamCount}x${r.cyclesPerTeam}`);assert.equal(r.cycles[r.playerId].team,0);assert(r.cycles[r.playerId].alive);
 }
 assert.equal(sizes.size,9);const count=s.cycleMatchesStarted;s.reset(42);enter();assert.equal(s.cycleMatchesStarted,count+1);
});
test('red and green remain opponents after gold and blue die; either can win',()=>{
 for(const winner of [2,3]){
  const r=createCycleRace(world,42);Object.assign(r,{teamCount:4,cyclesPerTeam:1,hideMiddleOpponent:false});resetCycleRound(r);
  r.phase='racing';r.cycles[0].alive=r.cycles[1].alive=false;updateCycleRace(r,1/120);assert.equal(r.phase,'racing');
  r.cycles[winner===2?3:2].alive=false;updateCycleRace(r,1/120);assert.equal(r.phase,'result');assert.equal(r.winner,winner);assert.equal(r.scores[winner],1);
 }
});
test('team AI reaction delays order red faster than blue faster than green',()=>{
 const r=createCycleRace(world,1982);Object.assign(r,{teamCount:4,cyclesPerTeam:1,hideMiddleOpponent:false});resetCycleRound(r);r.phase='racing';
 updateCycleRace(r,1/120);
 const delays=r.cycles.map(b=>b.nextReactionAt-r.elapsed);
 assert.deepEqual(delays,C.teamReactionSeconds);
 assert(delays[2]<delays[1]&&delays[1]<delays[3]);
});
