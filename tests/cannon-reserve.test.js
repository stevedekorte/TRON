import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,updateWeapons} from '../src/simulation/run.js';
import {CLU_WEAPON} from '../src/game/config.js';
const dt=1/60;
function fixture(){const r=createRun();Object.assign(r,{x:-5000,s:-5000});r.recognizers=[];r.enemyTanks=[];return r;}
function idle(r,seconds){for(let i=0;i<Math.round(seconds/dt);i++)updateWeapons(r,{},dt);}
function press(r){updateWeapons(r,{fire:true,firePressed:true},dt);}
test('ten idle seconds refill all three extras together, with no partial recharge',()=>{
 const r=fixture();idle(r,9);assert.equal(r.extraShots,0);
 idle(r,1-dt);assert.equal(r.extraShots,0);idle(r,dt);assert.equal(r.extraShots,3);
 idle(r,20);assert.equal(r.extraShots,3);
 const rest=r.shotRest;updateWeapons(r,{},0);assert.equal(r.shotRest,rest);
 assert.equal(createRun().extraShots,0);
});
test('three banked extras permit four rapid presses, then normal recharge resumes',()=>{
 const r=fixture();idle(r,10);
 for(let i=0;i<4;i++)press(r);
 assert.equal(r.shots,4);assert.equal(r.extraShots,0);
 press(r);assert.equal(r.shots,4);
 idle(r,CLU_WEAPON.recharge);press(r);assert.equal(r.shots,5);
 idle(r,9);assert.equal(r.extraShots,0);idle(r,1);assert.equal(r.extraShots,3);
});
test('holding fire preserves extras and normal cadence; a fresh press bypasses cooldown',()=>{
 const r=fixture();idle(r,10);press(r);
 for(let i=0;i<10;i++)updateWeapons(r,{fire:true,firePressed:false},dt);
 assert.equal(r.shots,1);assert.equal(r.extraShots,3);
 press(r);assert.equal(r.shots,2);assert.equal(r.extraShots,2);
 for(let i=0;i<120;i++)updateWeapons(r,{fire:true,firePressed:false},dt);
 assert.equal(r.extraShots,2);assert.equal(r.shots,7);
});
test('firing restarts the full timer and partially spent reserves refill together',()=>{
 const r=fixture();idle(r,9);press(r);idle(r,9);assert.equal(r.extraShots,0);
 idle(r,1);assert.equal(r.extraShots,3);press(r);press(r);assert.equal(r.extraShots,2);
 idle(r,9);assert.equal(r.extraShots,2);idle(r,1);assert.equal(r.extraShots,3);
 press(r);press(r);r.crushed=true;const shots=r.shots;idle(r,10);press(r);
 assert.equal(r.extraShots,2);assert.equal(r.shots,shots);
});
