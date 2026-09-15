import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,updateWeapons,cannonTarget} from '../src/simulation/run.js';
import {updateRecognizers,canSeeClu,SENSORS} from '../src/simulation/recognizers.js';
import {escortSlot,groundRoute,updateGroundTanks} from '../src/simulation/ground-tanks.js';
import {WALLS,wallIntersection} from '../src/levels/maze.js';
import {config} from '../src/game/config.js';
const dt=1/60;
function encounter(){const r=createRun();Object.assign(r,{x:-5000,s:-5000,yaw:0,speed:0});r.recognizers=[];r.enemyTanks=r.enemyTanks.slice(0,1);Object.assign(r.enemyTanks[0],{x:-5000,s:-4800,yaw:Math.PI,speed:0,vx:0,vs:0,nextSense:0});return r;}
test('eight escorts keep pace beneath the moving carrier',()=>{const r=createRun();r.recognizers=[];for(let i=0;i<1200;i++)step(r,{},dt);assert.equal(r.enemyTanks.length,8);for(const e of r.enemyTanks){const goal=escortSlot(e.index,r.time);assert.ok(Math.hypot(e.x-goal.x,e.s-goal.s)<45);assert.equal(e.memory,null);}});
test('ground sight obeys range, facing and wall occlusion',()=>{const r=encounter(),e=r.enemyTanks[0];assert.ok(canSeeClu(e,r));assert.equal(canSeeClu({...e,yaw:0},r),false);assert.equal(canSeeClu({...e,s:r.s+SENSORS.range+1},r),false);const w=WALLS[0],a=w.points[0],b=w.points[1],mx=(a.x+b.x)/2,ms=(a.s+b.s)/2,dx=b.x-a.x,ds=b.s-a.s,len=Math.hypot(dx,ds);const p={x:mx-ds/len*25,s:ms+dx/len*25},q={x:mx+ds/len*25,s:ms-dx/len*25};assert.equal(canSeeClu({...e,...p,yaw:-Math.atan2(q.x-p.x,q.s-p.s)},q),false);});
test('tank/aircraft radio works in both directions, preserves age and respects range',()=>{for(const senderGround of [true,false]){const r=createRun();r.recognizers=r.recognizers.slice(0,1);r.enemyTanks=r.enemyTanks.slice(0,2);const ground=r.enemyTanks[0],air=r.recognizers[0],far=r.enemyTanks[1];Object.assign(ground,{x:-5000,s:-5000,nextSense:Infinity});Object.assign(air,{x:-5000,s:-4900,nextSense:Infinity,nextAttack:Infinity});Object.assign(far,{x:-6000,s:-5000,nextSense:Infinity});const sender=senderGround?ground:air,receiver=senderGround?air:ground;sender.memory={x:-4900,s:-4900,vx:2,vs:0,seenAt:1,source:sender.id};r.time=2;updateRecognizers(r,dt);assert.equal(receiver.memory,null);r.time=2.5;updateRecognizers(r,dt);assert.equal(receiver.memory.seenAt,1);assert.equal(receiver.memory.source,sender.id);assert.equal(far.memory,null);}});
test('turret acquires and enemy rounds destroy Clu; observers retire the target',()=>{const r=encounter();for(let i=0;i<900&&!r.crushed;i++)step(r,{},dt);assert.ok(r.events.some(e=>e.type==='enemyShot'));assert.ok(r.crushed);assert.ok(r.events.some(e=>e.subject==='tank'));for(let i=0;i<30;i++)step(r,{},dt);assert.ok(r.enemyTanks[0].targetGone);});
test('Clu can aim at and destroy a ground tank',()=>{const r=encounter();r.enemyTanks[0].s=-4900;assert.ok(cannonTarget(r).lock);for(let i=0;i<180;i++)updateWeapons(r,{fire:true},dt);assert.equal(r.enemyTanks[0].state,'destroyed');assert.ok(r.events.some(e=>e.subject==='enemyTank'));});
test('hidden live Clu positions cannot steer ground pursuit',()=>{const a=encounter();a.enemyTanks[0].nextSense=Infinity;a.enemyTanks[0].memory={x:-5000,s:-5000,vx:10,vs:0,seenAt:0,source:100};const b=structuredClone(a);b.x=-7000;b.s=-7000;for(let i=0;i<120;i++){step(a,{},dt);step(b,{},dt);}assert.deepEqual(a.enemyTanks,b.enemyTanks);assert.equal(a.projectiles.length,0);});
test('ground routes have swept clearance around a slab',()=>{const start={x:148.15,s:-393.68},goal={x:311.65,s:-393.68};assert.notEqual(wallIntersection({...start,y:2},{...goal,y:2},4),null);const path=groundRoute(start,goal);assert.ok(path.length>1);let p=start;for(const q of path){assert.equal(wallIntersection({...p,y:2},{...q,y:2},4),null);p=q;}});
test('ground support forms lanes and replaces a destroyed leader',()=>{const r=encounter(),template=r.enemyTanks[0];r.enemyTanks=[-40,0,40].map((offset,i)=>({...structuredClone(template),id:100+i,index:i,x:-5000+offset,s:-4800,canSee:true,nextSense:Infinity,memory:{x:-5000,s:-5000,vx:0,vs:0,seenAt:0,source:100},path:[]}));step(r,{},dt);assert.equal(r.enemyTanks[0].leader,101);assert.equal(r.enemyTanks[2].leader,101);assert.notEqual(r.enemyTanks[0].goal.x,r.enemyTanks[2].goal.x);r.enemyTanks[1].state='destroyed';step(r,{},dt);assert.notEqual(r.enemyTanks[0].leader,101);assert.notEqual(r.enemyTanks[2].leader,101);});

test('enemy pursuit reaches Clu normal top speed and never inherits turbo',()=>{
 const r=encounter(),e=r.enemyTanks[0];
 e.memory={x:e.x,s:e.s-2000,vx:0,vs:0,seenAt:0,source:e.id};
 const move=(tank,dx,ds)=>{tank.x+=dx;tank.s+=ds;};
 const pose=tank=>({...tank,y:3,yaw:tank.yaw+tank.turretYaw});
 for(const turboRemaining of [0,10]){
  r.turboRemaining=turboRemaining;
  for(let i=0;i<240;i++){
   updateGroundTanks(r,dt,move,pose);
   assert.ok(e.speed<=config.maxSpeed);
  }
  assert.equal(e.speed,config.maxSpeed);
 }
});
