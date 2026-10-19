import test from 'node:test';
import assert from 'node:assert/strict';
import {alertArenaEscape,returningToArena} from '../../src/simulation/arena-patrol.js';
import {GameSession} from '../../src/simulation/game-session.js';
import {browserScenario} from '../../src/game/browser-scenario.js';
import {ARENA_WALL as W} from '../../shared/simulation/config/arena-breaches.js';
import {LIGHT_CYCLES as C} from '../../shared/simulation/config/light-cycles.js';
test('breach alarm redirects every active arena guard using a fixed observation only',()=>{
 const guards=[{role:'arena-patrol',state:'wander'},{role:'arena-patrol',state:'wander',targetGone:true},{role:'patrol',state:'wander'},{role:'arena-patrol',state:'destroyed'}];
 const run={x:10,s:20,yaw:0,speed:40,time:8,recognizers:guards};alertArenaEscape(run);
 for(const e of guards.slice(0,2)){assert.equal(e.state,'investigate');assert.equal(e.memory.vs,40);assert.equal(e.memory.seenAt,8);assert.equal(e.targetGone,false);assert.equal(returningToArena(e,8),false);}
 run.x=200;run.time=9;assert.equal(guards[0].memory.x,10);assert.notEqual(guards[0].memory,guards[1].memory);
 assert.equal(guards[2].memory,undefined);assert.equal(guards[3].memory,undefined);
});
test('a real player breach crossing raises the alarm through GameSession',()=>{
 const world=browserScenario({pathname:'/',search:'?layoutSeed=1982'}).world,s=new GameSession({world,seed:1982});
 s.requestCycleEntry({startOutside:false,startWithBreach:false});s.advance({},1/60);
 const run=s.run,r=run.cycleRace,b=r.cycles[r.playerId];r.phase='racing';r.trails=[];r.occupied.fill(0);
 r.breaches=[{axis:'z',sign:-1,along:0,id:0,time:r.time}];
 Object.assign(b,{x:0,previousX:0,z:-(W.outerMeters+W.cycleRadiusMeters-.1)/C.cellMeters,previousZ:-(W.outerMeters+W.cycleRadiusMeters-.1)/C.cellMeters,dir:0,trailStopped:true});
 const guards=run.recognizers.filter(e=>e.role==='arena-patrol');assert(guards.length);
 for(const e of guards){e.yaw=0;e.targetGone=true;}
 s.advance({},1/120);assert(b.escaped);assert.equal(b.escapeRevision,1);
 for(const e of guards){assert.equal(e.targetGone,false);assert(e.memory);assert(!e.arenaPatrolling);}
});
