import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,updateWeapons} from '../src/simulation/run.js';
import {resolveCrush} from '../src/simulation/crush.js';
import {applyDebrisImpacts} from '../src/simulation/debris-damage.js';
function setup(){const r=createRun(1982);r.x=10000;r.s=10000;r.enemyTanks=[];r.recognizers=[];r.inspection=true;return r;}
test('inspection consumes bullets without damage, then restores normal damage',()=>{
 const r=setup();
 const shoot=()=>{r.projectiles=[{faction:'enemy',owner:100,x:r.x,s:r.s,y:2,vx:0,vs:0,vy:0,life:1}];updateWeapons(r,{},1/60);};
 shoot();assert.equal(r.health,3);assert(!r.crushed);assert.equal(r.projectiles.length,0);
 r.inspection=false;shoot();assert.equal(r.health,2);
});
test('inspection blocks lethal debris without changing enemy damage',()=>{
 const r=setup(),hit={target:'clu',energy:1000000,point:{x:r.x,y:2,z:-r.s}};
 applyDebrisImpacts(r,[hit]);assert.equal(r.health,3);assert(!r.crushed);
 r.inspection=false;applyDebrisImpacts(r,[hit]);assert(r.crushed);
});
test('inspection prevents stomps from destroying Clu; leaving restores stomps',()=>{
 const r=setup(),e={x:r.x,s:r.s,attack:{impact:true}};
 resolveCrush(r,e);assert(!r.crushed);assert(!r.events.some(e=>e.type==='destroyed'));
 r.inspection=false;e.attack.impact=true;resolveCrush(r,e);assert(r.crushed);
});
