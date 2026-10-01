import {LIGHT_CYCLES as C} from '../src/game/light-cycles.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {browserScenario} from '../src/game/browser-scenario.js';
import {GameSession} from '../src/simulation/game-session.js';
import {cyclePlayerPose} from '../src/simulation/light-cycles.js';
const world=browserScenario({pathname:'/',search:'?layoutSeed=1982'}).world;
test('Recognizers retire a destroyed road player, keep patrolling, and detect again after restart',()=>{
 const s=new GameSession({world,seed:1982,settings:{vehicle:{aiMode:'tactical'}}});enter(s);
 const r=s.run,race=r.cycleRace,b=race.cycles[1];race.phase='racing';
 Object.assign(b,{escaped:true,alive:false,x:-4000,z:-4000,previousX:-4000,previousZ:-4000,progress:1,roadSpeed:0,roadHealth:0});
 Object.assign(r,cyclePlayerPose(race));
 const [a,c]=r.recognizers;r.recognizers=[a,c];r.enemyTanks=[];
 for(const [i,e] of r.recognizers.entries())Object.assign(e,{role:'patrol',x:r.x+i*100,s:r.s,y:80,nextSense:i?Infinity:0,
  memory:{x:r.x,s:r.s,vx:0,vs:0,seenAt:r.time,source:a.id},state:'pursue'});
 for(let i=0;i<120;i++)s.advance({},1/120);
 for(const e of r.recognizers){assert(e.targetGone);assert.equal(e.memory,null);assert.equal(e.canSee,false);assert.equal(e.state,'wander');}
 assert.equal(r.crushed,false); // Spectator flow stays active.
 const before=r.recognizers.map(e=>[e.x,e.s,e.y]);
 for(let i=0;i<120;i++)s.advance({},1/120);
 assert.notDeepEqual(r.recognizers.map(e=>[e.x,e.s,e.y]),before);
 assert(s.restartCycleMatch());
 for(const e of r.recognizers){assert.equal(e.targetGone,false);assert.equal(e.neutralizationSent,false);}
 assert.deepEqual(r.radio,[]);
});
function session(){return new GameSession({world,seed:1982,settings:{cycleEndings:true}});}
function enter(s){s.requestCycleEntry();s.advance({},1/60);}
test('explicit arena entry transfers control without completing the Clu game',()=>{
 const s=session(),r=s.run;assert.equal(r.cycleRace.phase,'idle');
 const before=r.cycleRace.time;s.advance({},1/60);assert.equal(r.cycleRace.time,before);
 enter(s);assert.equal(r.playerVehicle,'cycle');assert.equal(r.won,false);assert.equal(r.cycleRace.playerId,1);assert.equal(r.cycleRace.phase,'countdown');
 assert(Math.abs(r.x-r.cycleRace.site.x)<1);assert.equal(r.projectiles.length,0);
 const round=r.cycleRace.round;s.advance({},1/60);assert.equal(r.cycleRace.round,round);
});
test('manual cycle turns once per press and moves straight otherwise',()=>{
 const s=session();enter(s);const r=s.run, race=r.cycleRace,b=race.cycles[1];race.phase='racing';
 s.advance({cycleTurn:1},.125);assert.equal(b.dir,1);
 s.advance({},.125);assert.equal(b.dir,1);
 s.advance({cycleTurn:-1},.125);assert.equal(b.dir,0);
 assert.equal(r.shots,0);assert.equal(r.health,3);
});
test('player crash waits for team result, a friendly win reaches victory',()=>{
 const s=session();enter(s);const r=s.run; r.cycleRace.cycles[1].alive=false;
 s.advance({},1/60);assert.equal(r.crushed,false);assert.equal(r.won,false);
 r.cycleRace.phase='result';r.cycleRace.winner=0;r.cycleRace.remaining=6;
 const events=s.advance({},1/60);assert.equal(r.won,true);assert(events.some(e=>e.type==='victory'));
});
test('three failed matches end the run; reset returns to inactive arena',()=>{
 const s=session();enter(s);s.run.cycleRace.phase='result';s.run.cycleRace.winner=1;s.run.cycleRace.remaining=6;
 for(let left=2;left>=0;left--){
  s.run.cycleRace.phase='result';s.run.cycleRace.winner=1;s.run.cycleRace.remaining=6;
  s.advance({},1/60);assert.equal(s.run.cycleAttemptsRemaining,left);assert.equal(s.run.crushed,false);
  s.advance({},6);
  if(left){assert.equal(s.run.cycleRace.phase,'countdown');assert.equal(s.run.cycleRace.trails.length,0);assert(s.run.cycleRace.cycles.every(b=>b.alive===(b.id!==4)));}
 }
 assert.equal(s.run.crushed,true);assert.equal(s.run.won,false);
 s.reset();assert.equal(s.run.playerVehicle,undefined);assert.equal(s.run.cycleRace.phase,'idle');
});

test('a draw uses one chance and a later team win still wins the game',()=>{
 const s=session();enter(s);s.run.cycleRace.phase='result';s.run.cycleRace.winner=null;s.run.cycleRace.remaining=6;
 s.advance({},.1);assert.equal(s.run.cycleAttemptsRemaining,2);s.advance({},6);
 s.run.cycleRace.phase='result';s.run.cycleRace.winner=0;s.run.cycleRace.remaining=6;
 s.advance({},.1);assert.equal(s.run.won,true);assert.equal(s.run.crushed,false);
});

test('explicit cycle entry waits safely for deferred arena assets',()=>{
 const s=session();s.arenaReady=false;enter(s);assert.equal(s.run.arenaWaiting,true);assert.equal(s.run.playerVehicle,undefined);
 const time=s.run.time;s.advance({throttle:1,fire:true},1);assert.equal(s.run.time,time);assert.equal(s.run.crushed,false);
 s.arenaReady=true;s.advance({},1/60);assert.equal(s.run.playerVehicle,'cycle');assert.equal(s.run.cycleRace.phase,'countdown');
});

test('cycle turbo accepts partial charge, boosts the player and autonomous cycles and eases on release',()=>{
 const s=session();enter(s);const race=s.run.cycleRace,b=race.cycles[1];race.phase='racing';b.turboCharge=.2;
 const start=b.z,other=race.cycles[0].z;
 s.advance({cycleTurbo:true},.25);
 assert(b.speedMultiplier>1.5&&b.speedMultiplier<1.7,'turbo is still building speed after a quarter second');
 assert(start-b.z+b.progress>2&&start-b.z+b.progress<3);assert.equal(other-race.cycles[0].z,2);
 assert(Math.abs(b.turboCharge-.15)<1e-8);assert.equal(b.boosting,true);
 const before=b.speedMultiplier;s.advance({},.25);assert(b.speedMultiplier>1&&b.speedMultiplier<before);assert.equal(b.boosting,false);assert(b.turboCharge>.15);
});
test('empty turbo stays at normal speed while held; release recharges and allows reuse',()=>{
 const s=session();enter(s);const race=s.run.cycleRace,b=race.cycles[1];race.phase='racing';b.turboCharge=.005;
 s.advance({cycleTurbo:true},.2);assert.equal(b.turboCharge,0);assert.equal(b.boosting,false);
 const before=b.z;s.advance({cycleTurbo:true},.25);assert.equal(before-b.z,2);assert.equal(b.turboCharge,0);
 s.advance({},.2);assert(b.turboCharge>0&&b.turboCharge<1);
 s.advance({cycleTurbo:true},.01);assert.equal(b.boosting,true);
});
test('boosted cycle cannot jump through an occupied trail cell',()=>{
 const s=session();enter(s);const race=s.run.cycleRace,b=race.cycles[1];race.phase='racing';
 const startZ=b.z,width=173;race.occupied[(b.z-2+86)*width+b.x+86]=4;
 s.advance({cycleTurbo:true},.25);assert.equal(b.alive,false);assert.equal(b.z,startZ-1);assert.equal(race.crashes.filter(c=>c.id===1).length,1);
});
test('W/T control cycle turbo, S takes priority, and I/K do not affect speed',async()=>{
 const {InputController}=await import('../src/app/input-controller.js');const input=new InputController();
 for(const key of ['KeyI','KeyK','Space']){input.clear();input.keys.add(key);assert.equal(input.command({playerVehicle:'cycle'}).cycleTurbo,false);assert.equal(input.command({playerVehicle:'cycle'}).cycleSlow,false);}
 input.clear();input.keys.add('KeyT');assert.equal(input.command({playerVehicle:'cycle'}).cycleTurbo,true);
 input.keys.add('KeyS');assert.equal(input.command({playerVehicle:'cycle'}).cycleTurbo,false);assert.equal(input.command({playerVehicle:'cycle'}).cycleSlow,true);
 input.clear();input.keys.add('KeyW');assert.equal(input.command({playerVehicle:'cycle'}).cycleTurbo,true);
 input.keys.add('KeyS');assert.equal(input.command({playerVehicle:'cycle'}).cycleTurbo,false);assert.equal(input.command({playerVehicle:'cycle'}).cycleSlow,true);
 assert.equal(input.command({}).cycleTurbo,false);input.clear();assert.equal(input.command({playerVehicle:'cycle'}).cycleTurbo,false);
});

test('test-only cycle entry waits for assets without simulating the tank encounter',()=>{
 const s=session();s.arenaReady=false;s.requestCycleEntry();const time=s.run.time;
 s.advance({fire:true,throttle:1},1);assert.equal(s.run.time,time);assert.equal(s.run.arenaWaiting,true);
 assert(s.run.dataBeams.every(b=>b.collectedAt===null));
 s.arenaReady=true;s.advance({},1/60);assert.equal(s.run.playerVehicle,'cycle');assert.equal(s.run.cycleAttemptsRemaining,3);
 assert.equal(s.run.cycleRace.cycles[1].turboCharge,1);assert.equal(s.run.cycleRace.phase,'countdown');
});


test('arena guard continues its full patrol during cycle play without advancing tank combat',()=>{
 const s=session();enter(s);const r=s.run,guard=r.recognizers.find(e=>e.role==='arena-patrol');
 assert(guard);const others=structuredClone(r.recognizers.filter(e=>e!==guard));
 const tanks=structuredClone(r.enemyTanks),health=r.health;
 guard.attack={phase:'drop'};guard.canSee=true;guard.memory={x:r.x,s:r.s,seenAt:r.time};guard.fold=1;
 r.cycleRace.remaining=300;const visited=new Set();
 for(let i=0;i<260*60;i++){s.advance({},1/60);visited.add(guard.patrolWaypoint);}
 assert.equal(visited.size,4);assert.equal(guard.arenaPatrolling,true);
 assert.equal(guard.attack,null);assert.equal(guard.memory,null);assert.equal(guard.canSee,false);assert.equal(guard.fold,0);
 assert(guard.y>80);assert.equal(r.health,health);assert.equal(r.crushed,false);
 assert.deepEqual(r.recognizers.filter(e=>e!==guard),others);assert.deepEqual(r.enemyTanks,tanks);
 guard.state='destroyed';const position=[guard.x,guard.s];s.advance({},1/60);assert.deepEqual([guard.x,guard.s],position);
});

test('other cycles have approaching/receding Doppler; player cabin pitch stays stable',async()=>{
 const {cycleDoppler}=await import('../src/audio/cycle-voices.js');
 const race={phase:'racing',playerId:1},ear={x:0,y:1,s:0,vx:0,vs:0,vy:0};
 const bike={id:2,alive:true,dir:0};
 assert(cycleDoppler(race,bike,[0,1,40],ear)>1);
 assert(cycleDoppler(race,{...bike,dir:2},[0,1,40],ear)<1);
 assert.equal(cycleDoppler(race,{...bike,id:1},[0,1,40],ear),1);
 assert.equal(cycleDoppler({...race,phase:'countdown'},bike,[0,1,40],ear),1);
 assert(cycleDoppler(race,{...bike,dir:1},[0,1,40],ear)===1);
});

test('slow pedal eases to half speed, overrides turbo, and eases back to cruise',()=>{
 const s=session();enter(s);const race=s.run.cycleRace,b=race.cycles[1];race.phase='racing';b.turboCharge=.5;
 s.advance({cycleSlow:true,cycleTurbo:true},1/120);
 assert(b.speedMultiplier<1&&b.speedMultiplier>.5);assert.equal(b.boosting,false);assert(b.turboCharge>.5);
 s.advance({cycleSlow:true},.5);assert(b.speedMultiplier>.65&&b.speedMultiplier<.75,'S decelerates over time instead of immediately reaching half speed');
 s.advance({cycleSlow:true},1);assert(b.speedMultiplier>.5&&b.speedMultiplier<.53);
 assert.equal(race.cycles[0].speedMultiplier,1);
 const slow=b.speedMultiplier;s.advance({},1/120);assert(b.speedMultiplier>slow&&b.speedMultiplier<1);
 s.advance({},.5);assert(b.speedMultiplier>.8&&b.speedMultiplier<.9);
 s.advance({},1);assert(b.speedMultiplier>.97&&b.speedMultiplier<1);
});

test('default cycle testing has unlimited Return restarts and no terminal endings',()=>{
 const s=new GameSession({world,seed:1982});enter(s);
 assert.equal(s.restartCycleMatch(),false);
 for(let i=0;i<5;i++){
  const race=s.run.cycleRace;race.phase='result';race.winner=i%2;race.cycles[race.playerId].alive=false;
  s.advance({},10);assert(!s.run.won&&!s.run.crushed);assert.equal(race.phase,'result');
  assert(s.restartCycleMatch());assert.equal(race.phase,'countdown');assert.equal(race.remaining,.3);
  s.advance({},.301);assert.equal(race.phase,'racing');assert(race.cycles.every(b=>b.alive===(b.id!==4)));
 }
});

test('escape freezes arena competitors and timer while outside enemies resume; restart reverses handoff',()=>{
 const s=new GameSession({world,seed:1982});enter(s);const r=s.run,race=r.cycleRace,b=race.cycles[1];race.phase='racing';
 Object.assign(b,{escaped:true,x:110,z:0,previousX:110,previousZ:0,progress:1,yaw:-Math.PI/2,roadSpeed:20,roadHealth:1,steering:0,lean:0});
 const competitors=JSON.stringify(race.cycles.filter(c=>c.id!==1)),elapsed=race.elapsed;
 const enemies=()=>JSON.stringify([...r.recognizers.filter(e=>e.role!=='arena-patrol'),...r.enemyTanks].map(e=>[e.x,e.s,e.y,e.yaw,e.state]));
 const before=enemies(),x=b.x;
 for(let i=0;i<60;i++)s.advance({},1/120);
 assert(race.arenaPaused);assert.equal(race.elapsed,elapsed);
 // Presentation interpolation history updates, but competitors do not move.
 const initial=JSON.parse(competitors);
 for(const other of race.cycles.filter(c=>c.id!==1)){const old=initial.find(c=>c.id===other.id);assert.equal(other.x,old.x);assert.equal(other.z,old.z);assert.equal(other.progress,old.progress);}
 assert(b.x>x);assert.notEqual(enemies(),before);assert(!r.won);
 b.alive=false;assert(s.restartCycleMatch());assert(!race.arenaPaused);
 const paused=enemies();s.advance({},1/120);assert.equal(enemies(),paused);
});

test('arena S and X only slow the cycle, override turbo, and cannot select road reverse',async()=>{
 const {InputController}=await import('../src/app/input-controller.js');
 for(const key of ['KeyS','KeyX']){
  const s=session();enter(s);const race=s.run.cycleRace,b=race.cycles[1];race.phase='racing';
  const input=new InputController();input.keys.add(key);input.keys.add('KeyW');input.cycleReverseQueued=true;
  const command=input.command(s.run);
  assert.deepEqual(command.cycleRoad,{});assert(command.cycleSlow);assert(!command.cycleTurbo);
  for(let i=0;i<120;i++)s.advance(input.command(s.run),1/120);
  assert(b.alive);assert(!b.escaped);assert(!b.reverseGear);assert(b.speedMultiplier>=.5);
 }
});

test('home menu arena entry and restarts retain six bikes and intact walls',()=>{
 const s=new GameSession({world,seed:1982});
 s.requestCycleEntry({startOutside:false,startWithBreach:false,hideMiddleOpponent:false});s.advance({},1/120);
 const check=()=>{
  const race=s.run.cycleRace;
  assert.equal(race.playerId,1);assert.equal(race.cycles[1].team,0);assert(!race.cycles[1].escaped);
  assert.equal(race.breaches.length,0);assert.equal(race.cycles.filter(b=>b.alive).length,6);
 };
 check();s.run.cycleRace.cycles[1].alive=false;assert(s.restartCycleMatch());check();
});

test('completing the central beam wins Clu without waiting for or entering the arena',()=>{
 const s=session();s.arenaReady=false;
 s.run.dataBeams[0].collectedAt=0;
 const events=s.advance({},1/60);
 assert(s.run.won);assert.equal(s.run.speed,0);assert.notEqual(s.run.playerVehicle,'cycle');
 assert(!s.run.arenaWaiting);assert.equal(s.run.cycleRace.phase,'idle');
 assert.equal(events.filter(e=>e.type==='victory').length,1);
 assert(!events.some(e=>e.type==='cycleArrival'));
 assert(!s.advance({},1/60).some(e=>e.type==='victory'));
});


test('entrance hold advances the leftward arena patrol while keeping racers and other enemies frozen',()=>{
 const s=session();enter(s);const r=s.run,guard=r.recognizers.find(e=>e.role==='arena-patrol');
 const initialS=guard.s,race=JSON.stringify(r.cycleRace),others=JSON.stringify(r.recognizers.filter(e=>e!==guard));
 for(let i=0;i<16*120;i++)s.advance({},1/120,{holdCycleRace:true});
 assert(guard.s<initialS-50,'southbound along the west ledge, screen-left in the entrance view');
 assert.equal(JSON.stringify(r.cycleRace),race);
 assert.equal(JSON.stringify(r.recognizers.filter(e=>e!==guard)),others);
});

test('arena brake reserve exhausts, requires release to recharge, and supports partial reuse',()=>{
 const s=session();enter(s);const r=s.run.cycleRace,b=r.cycles[r.playerId];r.phase='racing';b.brakeCharge=.01;
 s.advance({cycleSlow:true},.1);
 assert.equal(b.brakeCharge,0);assert.equal(b.braking,false);assert(b.speedMultiplier<1);
 s.advance({cycleSlow:true},.1);assert.equal(b.brakeCharge,0);
 s.advance({},.3);assert(b.brakeCharge>0&&b.brakeCharge<.01);
 const charge=b.brakeCharge;s.advance({cycleSlow:true},1/120);assert(b.brakeCharge<charge);assert(b.braking);
 b.alive=false;s.restartCycleMatch();assert.equal(s.run.cycleRace.cycles[s.run.cycleRace.playerId].brakeCharge,1);
});

test('teammates conserve launch turbo while enemies boost; all brake near blocked lanes',()=>{
 const s=session();enter(s);const r=s.run.cycleRace;r.phase='racing';
 s.advance({},.1);
 for(const b of r.cycles.filter(b=>b.alive&&b.id!==r.playerId)){
  if(b.team===r.cycles[r.playerId].team){assert(!b.boosting);assert.equal(b.turboCharge,1);assert.equal(b.speedMultiplier,1);}
  else {assert(b.boosting);assert(b.turboCharge<1);assert(b.speedMultiplier>1);}
 }
 const b=r.cycles[0],dz=b.dir===0?-1:1;
 r.occupied[(b.z+dz*3+C.halfCells)*(C.halfCells*2+1)+b.x+C.halfCells]=6;
 s.advance({},1/120);assert(b.braking);assert(!b.boosting);assert(b.brakeCharge<1);
});


test('teammates boost to outpace a nearby opponent and conserve charge after pulling ahead',()=>{
 const s=session();enter(s);const r=s.run.cycleRace;r.phase='racing';r.occupied.fill(0);
 const b=r.cycles[0],enemy=r.cycles[3];
 Object.assign(b,{x:0,previousX:0,z:0,previousZ:0,dir:0});
 Object.assign(enemy,{x:3,previousX:3,z:-6,previousZ:-6,dir:0});
 s.advance({},1/120);assert(b.boosting);assert(b.turboCharge<1);
 Object.assign(enemy,{z:12,previousZ:12});
 const charge=b.turboCharge;s.advance({},1/120);assert(!b.boosting);assert(b.turboCharge>charge);
 Object.assign(enemy,{z:-6,previousZ:-6,dir:2});
 s.advance({},1/120);assert(!b.boosting,'do not boost into an oncoming opponent');
 enemy.dir=0;enemy.alive=false;s.advance({},1/120);assert(!b.boosting);
});
