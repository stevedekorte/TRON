import test from 'node:test';
import assert from 'node:assert/strict';
import {ConnectedRouteCache} from '../../src/simulation/connected-route-cache.js';
import {createGroundTanks} from '../../src/simulation/ground-tanks.js';
import {browserScenario} from '../../src/game/browser-scenario.js';
import {seededRandom} from '../../src/game/random.js';

test('connected route proofs require swept clearance even across adjacent buckets',()=>{
 const cache=new ConnectedRouteCache((a,b)=>a.x*b.x>=0);
 cache.add([{x:-1,s:0}]);
 assert.equal(cache.connection({x:1,s:0}),null,'wall separates adjacent floor');
 assert.deepEqual(cache.connection({x:-2,s:0}),{x:-1,s:0});
 assert.equal(cache.connection({x:-100,s:0}),null,'distant points require a real search');
});
test('labyrinth placement remains reproducible after other seeds use the world',()=>{
 const {world}=browserScenario({search:'?layoutSeed=1982',pathname:'/'});
 const first=createGroundTanks(seededRandom(1982),world);
 createGroundTanks(seededRandom(2),world);
 assert.deepEqual(createGroundTanks(seededRandom(1982),world),first);
 const fresh=browserScenario({search:'?layoutSeed=1982',pathname:'/'}).world;
 assert.deepEqual(createGroundTanks(seededRandom(1982),fresh),first);
});

test('every labyrinth spawn connects to the beam through independently recorded clear segments',()=>{
 const {world}=browserScenario({search:'?layoutSeed=1982',pathname:'/'});
 const edges=new Map(),intersection=world.wallIntersection;
 const key=p=>`${p.x.toFixed(6)},${p.s.toFixed(6)}`;
 world.wallIntersection=(a,b,...options)=>{
  const result=intersection(a,b,...options);
  if(result===null){
   const ak=key(a),bk=key(b);
   if(!edges.has(ak))edges.set(ak,new Set());
   if(!edges.has(bk))edges.set(bk,new Set());
   edges.get(ak).add(bk);edges.get(bk).add(ak);
  }
  return result;
 };
 const tanks=createGroundTanks(seededRandom(1982),world);
 const visited=new Set(),queue=[key(world.MAZE_INSTANCES[0].beamPosition)];
 for(let i=0;i<queue.length;i++){
  const point=queue[i];if(visited.has(point))continue;visited.add(point);
  for(const neighbor of edges.get(point)??[])if(!visited.has(neighbor))queue.push(neighbor);
 }
 for(const tank of tanks.filter(t=>t.role==='patrol'))assert.ok(visited.has(key(tank)),`tank ${tank.id} connects via swept-clear segments`);
});
