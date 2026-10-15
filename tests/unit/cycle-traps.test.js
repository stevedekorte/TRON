import test from 'node:test';
import assert from 'node:assert/strict';
import {trackCycleTraps,invalidateCycleTraps} from '../../shared/simulation/cycle-traps.js';
function fixture(){
 const victim={id:0,team:0,x:0,z:0,alive:true},attacker={id:1,team:1,x:50,z:50,alive:true};
 const r={round:1,time:0,teamCount:2,cycles:[victim,attacker],trails:[],breaches:[]};
 const wall=(id,x,z,x2,z2)=>({trail:{bikeId:id},a:{x,z},end:{x:x2,z:z2}});
 const walls=[wall(0,-20,-20,20,-20),wall(0,-20,20,20,20),wall(0,-20,-20,-20,20)];
 const scan=()=>{for(let i=0;i<2;i++){r.time+=.2;trackCycleTraps(r,walls,[]);}};
 scan();walls.push(wall(1,20,-20,20,20));scan();
 return {r,victim,attacker,walls,wall,scan,die(owner=0){trackCycleTraps(r,walls,[{b:victim,hit:{owner}}]);victim.alive=false;}};
}
test('confinement survives a long delay and the victim filling its own pocket',()=>{
 const f=fixture();assert.equal(f.attacker.trapsCreated.length,1);
 f.walls.push(f.wall(0,-10,-20,-10,15),f.wall(0,-10,15,15,15));
 f.r.time+=90;f.scan();f.die();
 assert.deepEqual(f.attacker.trapAssists,[{id:0,team:0,share:1}]);
 f.die();assert.equal(f.attacker.trapAssists.length,1);
});
test('opening the enclosing wall or escaping removes credit',()=>{
 for(const escape of [false,true]){const f=fixture();
  if(escape)f.victim.x=50;else f.walls.pop();
  f.scan();f.die();assert.equal(f.attacker.trapAssists,undefined);
 }
});
test('direct hit is not doubled as an assist; old walls alone do not earn new trap awards',()=>{
 const f=fixture();f.die(1);assert.equal(f.attacker.trapAssists,undefined);
 const other=fixture();other.r.round++;other.scan();other.die();assert.equal(other.attacker.trapAssists,undefined);
});
test('friendly enclosure and oversized geometry cannot earn trap credit',()=>{
 const f=fixture();f.attacker.team=0;f.r.round++;f.scan();f.die();assert.equal(f.attacker.trapAssists,undefined);
 const g=fixture();g.r.trails=Array(2049).fill({});g.scan();g.die();assert.equal(g.attacker.trapAssists,undefined);
});

test('sub-grid geometry cuts invalidate stale attribution without duplicating confinement reward',()=>{
 const f=fixture();invalidateCycleTraps(f.r);f.scan();f.die();
 assert.equal(f.attacker.trapAssists,undefined);assert.equal(f.attacker.trapsCreated.length,1);
});
