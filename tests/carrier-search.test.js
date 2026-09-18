import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun} from '../src/simulation/run.js';
import {CARRIER} from '../src/game/carrier.js';
import {CARRIER_SEARCH,updateCarrierSearch} from '../src/simulation/carrier-search.js';
import {updateRecognizers} from '../src/simulation/recognizers.js';
import {WALLS} from '../src/levels/maze.js';
function encounter(){
 const r=createRun(1982);Object.assign(r,{x:CARRIER.startX,s:CARRIER.s,yaw:0,speed:0});
 r.recognizers=r.recognizers.slice(0,2);r.enemyTanks=r.enemyTanks.slice(0,1);
 for(const [i,e] of [...r.recognizers,...r.enemyTanks].entries())Object.assign(e,{x:r.x,s:r.s+(i===1?CARRIER_SEARCH.radioRadius+20:i?100:-100),y:i===2?3.8:90,nextSense:Infinity,memory:null});
 return r;
}
function advance(r,seconds){for(let i=0;i<seconds*60;i++){r.time+=1/60;updateCarrierSearch(r,1/60);}}
test('carrier lights acquire smoothly before broadcasting to air and ground units within a one-width diameter',()=>{
 const r=encounter();advance(r,.2);assert.equal(r.radio.length,0);assert.equal(r.carrierSearch.illuminated,false);
 advance(r,2);assert.ok(r.carrierSearch.illuminated);assert.ok(r.radio.some(m=>m.to===r.recognizers[0].id));assert.ok(r.radio.some(m=>m.to===r.enemyTanks[0].id));assert.ok(r.radio.every(m=>m.to!==r.recognizers[1].id));
 assert.ok(r.carrierSearch.lights.every(l=>l.dy<0&&l.strength>.9));
 const message=r.radio[0];assert.equal(message.sighting.source,'carrier');assert.ok(message.deliverAt>message.sighting.seenAt);
 r.time=message.deliverAt+.01;updateRecognizers(r,1/60);assert.equal(r.recognizers[0].memory.source,'carrier');assert.equal(r.enemyTanks[0].memory.source,'carrier');assert.equal(r.recognizers[0].canSee,false);
});
test('hidden or destroyed CLU cannot produce fresh carrier reports',()=>{
 const r=encounter();advance(r,2);const old=structuredClone(r.radio);const p=WALLS.map(w=>w.points.reduce((v,p)=>({x:v.x+p.x/w.points.length,s:v.s+p.s/w.points.length}),{x:0,s:0})).sort((a,b)=>Math.abs(a.s-CARRIER.s)-Math.abs(b.s-CARRIER.s))[0];
 assert.ok(Math.abs(p.s-CARRIER.s)<CARRIER_SEARCH.trackRadius);
 // Move the carrier horizontally so its observation passes through a wall roof.
 r.time=(p.x-CARRIER.startX)/CARRIER.speed;r.x=p.x;r.s=p.s;
 for(const l of r.carrierSearch.lights)l.tracking=true;
 updateCarrierSearch(r,1/60);assert.equal(r.carrierSearch.illuminated,false);assert.deepEqual(r.radio,old);
 r.x=CARRIER.startX+CARRIER.speed*r.time;r.s=CARRIER.s;r.crushed=true;updateCarrierSearch(r,1/60);assert.equal(r.carrierSearch.illuminated,false);assert.ok(r.carrierSearch.lights.every(l=>l.strength===0));
});
test('carrier has no knowledge before CLU enters its detection footprint',()=>{
 const r=encounter();r.s+=CARRIER_SEARCH.detectHalfWidth+50;advance(r,2);assert.equal(r.radio.length,0);assert.ok(r.carrierSearch.lights.every(l=>l.target===null));
});
