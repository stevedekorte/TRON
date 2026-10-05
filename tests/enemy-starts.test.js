import test from 'node:test';
import assert from 'node:assert/strict';
import {browserScenario,browserRunSeed} from '../src/game/browser-scenario.js';
import {createRun,startPursuit} from '../src/simulation/run.js';
const location={pathname:'/',search:'?layoutSeed=1982'};
const {world}=browserScenario(location);
const poses=units=>units.map(({id,role,x,s,y,yaw})=>({id,role,x,s,y,yaw}));
test('normal CLU starts get fresh seeds while explicit/reference seeds stay repeatable',()=>{
 assert.notEqual(browserRunSeed(location,()=>.2),browserRunSeed(location,()=>.7));
 assert.equal(browserRunSeed({...location,search:'?runSeed=42'},()=>.2),42);
 assert.equal(browserRunSeed({...location,search:'?runSeed=0'},()=>.7),0);
 assert.equal(browserRunSeed({pathname:'/reference.html',search:''},()=>.2),1982);
});
test('new seeds vary maze patrols but retain opening Recognizers and escorts',()=>{
 const a=createRun(123,world),b=createRun(456,world),repeat=createRun(123,world);
 for(const run of [a,b,repeat])startPursuit(run);
 assert.deepEqual(poses(a.enemyTanks),poses(repeat.enemyTanks));
 assert.deepEqual(poses(a.recognizers),poses(repeat.recognizers));
 assert.notDeepEqual(poses(a.enemyTanks.filter(e=>e.role==='patrol')),poses(b.enemyTanks.filter(e=>e.role==='patrol')));
 assert.notDeepEqual(poses(a.recognizers.filter(e=>e.role==='patrol')),poses(b.recognizers.filter(e=>e.role==='patrol')));
 assert.deepEqual(poses(a.recognizers.filter(e=>e.role!=='patrol')),poses(b.recognizers.filter(e=>e.role!=='patrol')));
 assert.deepEqual(poses(a.enemyTanks.filter(e=>e.role==='escort')),poses(b.enemyTanks.filter(e=>e.role==='escort')));
 for(const run of [a,b])for(const tank of run.enemyTanks.filter(e=>e.role==='patrol')){
  assert(world.freePosition(tank.x,tank.s,4.5));
  assert.equal(world.wallIntersection({...tank,y:2},{...tank,y:2},4),null);
 }
});

test('large maze starts with 24 separated tank patrols while other formations retain their counts',()=>{
 const run=createRun(1982,world);
 const large=world.MAZE_INSTANCES.find(m=>m.patrols);
 assert(large);
 const tanks=run.enemyTanks.filter(e=>e.role==='patrol'&&!e.boss&&e.mazeId===large.id);
 assert.equal(tanks.length,24);
 assert.equal(run.enemyTanks.filter(e=>e.boss).length,4);
 for(const tank of tanks){
  assert(world.freePosition(tank.x,tank.s,4.5));
  assert(tanks.every(other=>other===tank||Math.hypot(tank.x-other.x,tank.s-other.s)>30));
 }
 assert.equal(run.enemyTanks.filter(e=>e.role==='escort').length,2);
 for(const maze of world.MAZE_INSTANCES.filter(m=>!m.patrols))
  assert.equal(run.enemyTanks.filter(e=>e.role==='patrol'&&e.mazeId===maze.id).length,3);
});
