import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,updateWeapons,cannonTarget} from '../src/simulation/run.js';
import {updateRecognizers,canSeeClu,SENSORS} from '../src/simulation/recognizers.js';
import {escortSlot,groundRoute,updateGroundTanks} from '../src/simulation/ground-tanks.js';
import {WALLS,wallIntersection} from '../src/levels/maze.js';
import {config} from '../src/game/config.js';
const dt=1/60;
function encounter(){const r=createRun(1982);Object.assign(r,{x:-5000,s:-5000,yaw:0,speed:0});r.recognizers=[];r.enemyTanks=r.enemyTanks.slice(0,1);Object.assign(r.enemyTanks[0],{x:-5000,s:-4800,yaw:Math.PI,speed:0,vx:0,vs:0,nextSense:0});return r;}
test('two escorts keep pace beneath the moving carrier',()=>{const r=createRun();r.recognizers=[];for(let i=0;i<1200;i++)step(r,{},dt);assert.equal(r.enemyTanks.length,5);for(const e of r.enemyTanks.filter(e=>e.role==='escort')){const goal=escortSlot(e.index,r.time);assert.ok(Math.hypot(e.x-goal.x,e.s-goal.s)<45);assert.equal(e.memory,null);}});
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

test('three maze tanks patrol clear routes independently of the two carrier escorts',()=>{
 const r=createRun();r.recognizers=[];r.x=-9000;r.s=-9000;
 const patrols=r.enemyTanks.filter(e=>e.role==='patrol');assert.equal(patrols.length,3);
 const positions=patrols.map(e=>({x:e.x,s:e.s}));
 for(let i=0;i<900;i++)step(r,{},dt);
 for(const [i,e] of patrols.entries()){
  assert.equal(e.state,'patrol');assert.equal(e.memory,null);assert.ok(e.patrolGoal);
  assert.ok(Math.hypot(e.x-positions[i].x,e.s-positions[i].s)>5);
  assert.equal(wallIntersection({...e,y:2},{...e,y:2},3.5),null);
 }
});

test('maze patrol detects and fires at Clu close behind its hull',()=>{
 const r=createRun();Object.assign(r,{x:-5000,s:-5000,speed:0,health:100});r.recognizers=[];
 const e=r.enemyTanks.find(e=>e.role==='patrol');r.enemyTanks=[e];
 Object.assign(e,{x:r.x,s:r.s+20,yaw:0,speed:0,vx:0,vs:0});
 for(let i=0;i<360;i++)step(r,{},dt);
 assert.equal(e.canSee,true);assert.equal(e.state,'pursue');assert.ok(r.events.some(e=>e.type==='enemyShot'));
});
test('damage turns a maze patrol toward the incoming shot before visually acquiring the attacker',()=>{
 const r=createRun();Object.assign(r,{x:-5000,s:-5000,speed:0,health:100});r.recognizers=[];
 const e=r.enemyTanks.find(e=>e.role==='patrol');r.enemyTanks=[e];
 Object.assign(e,{x:r.x,s:r.s+140,yaw:0,speed:0,vx:0,vs:0});
 r.projectiles=[{x:e.x,s:e.s-1,y:2,vx:0,vs:165,vy:0,life:1}];updateWeapons(r,{},dt);
 assert.equal(e.health,2);assert.equal(e.memory,null);assert.ok(e.threatUntil>r.time);assert.equal(r.radio.length,0);
 for(let i=0;i<600;i++)step(r,{},dt);
 assert.equal(e.canSee,true);assert.ok(r.events.some(e=>e.type==='enemyShot'));
});

test('idle enemy turrets hold world direction while their hulls turn, within their motor limit',()=>{
 const r=encounter(),e=r.enemyTanks[0];Object.assign(e,escortSlot(e.index,0));e.yaw=0;e.turretYaw=.7;e.memory=null;e.nextSense=Infinity;
 const move=(tank,dx,ds)=>{tank.x+=dx;tank.s+=ds;};const pose=tank=>({...tank,y:3,yaw:tank.yaw+tank.turretYaw});
 for(let i=0;i<240;i++){
  const before=e.turretYaw;r.time+=dt;updateGroundTanks(r,dt,move,pose);
  const delta=Math.atan2(Math.sin(e.turretYaw-before),Math.cos(e.turretYaw-before));assert.ok(Math.abs(delta)<=1.3*dt+1e-9);
  assert.ok(Math.abs(Math.atan2(Math.sin(e.yaw+e.turretYaw-.7),Math.cos(e.yaw+e.turretYaw-.7)))<1e-8);
 }
 assert.ok(Math.abs(e.yaw)>.2);
});

 test('patrol seeds vary between games and reproduce when explicitly supplied',()=>{
  const a=createRun(123),b=createRun(456),again=createRun(123);
  assert.deepEqual(a,again);
  for(const key of ['recognizers','enemyTanks']){
   const patrols=r=>r[key].filter(e=>e.role==='patrol');
   assert.notDeepEqual(patrols(a).map(e=>[e.x,e.s]),patrols(b).map(e=>[e.x,e.s]));
   assert.deepEqual(a[key].filter(e=>e.role!=='patrol').map(e=>[e.x,e.s]),b[key].filter(e=>e.role!=='patrol').map(e=>[e.x,e.s]));
  }
  assert.notEqual(createRun().seed,createRun().seed);
 });
 test('air escorts follow the carrier and resume escort after stale contact expires',()=>{
  const r=createRun(123);r.x=-20000;r.s=-20000;r.enemyTanks=[];
  r.recognizers=r.recognizers.filter(e=>e.role==='escort');assert.equal(r.recognizers.length,2);
  for(let i=0;i<1200;i++)step(r,{},dt);
  for(const e of r.recognizers){assert.equal(e.state,'escort');assert.equal(e.memory,null);assert.ok(Math.hypot(e.x-e.goal.x,e.s-e.goal.s)<65);}
  const e=r.recognizers[0];e.memory={x:e.x+200,s:e.s+200,vx:0,vs:0,seenAt:r.time,source:e.id};e.goal=null;step(r,{},dt);assert.notEqual(e.state,'escort');
  e.memory.seenAt=r.time-40;step(r,{},dt);assert.equal(e.state,'escort');
 });

test('track damage reduces mobility, and two disabled tracks leave a live firing tank',async()=>{
 const {trackMobility}=await import('../src/simulation/part-damage.js');
 const r=encounter(),e=r.enemyTanks[0];e.yaw=0;
 const shoot=x=>{r.projectiles=[{x:e.x+x,s:e.s,y:1,vx:0,vs:0,vy:0,life:1}];updateWeapons(r,{},dt);};
 shoot(-3);assert.equal(e.health,2.5);assert.equal(trackMobility(e).speed,.65);
 shoot(-3);assert.equal(e.health,2);assert.equal(trackMobility(e).speed,.25);
 shoot(3);shoot(3);assert.equal(e.health,1);assert.equal(trackMobility(e).speed,0);
 const start={x:e.x,s:e.s,yaw:e.yaw};e.speed=0;e.vx=0;e.vs=0;Object.assign(r,{x:e.x,s:e.s+80,health:100});
 for(let i=0;i<240;i++)step(r,{},dt);
 assert.deepEqual({x:e.x,s:e.s,yaw:e.yaw},start);assert.ok(r.events.some(event=>event.type==='enemyShot'));assert.notEqual(e.state,'destroyed');
});

test('enemy fire is slower, varied and reproducible, with bounded aim spread',async()=>{
 const {enemyShot,ENEMY_FIRE}=await import('../src/simulation/enemy-fire.js');
 const enemy={id:100,weaponSeed:123},copy={...enemy},pose={x:0,y:3,s:0},target={x:0,y:3,s:200};
 const shots=Array.from({length:100},()=>enemyShot(enemy,pose,target));
 assert.deepEqual(shots,Array.from({length:100},()=>enemyShot(copy,pose,target)));
 assert.ok(new Set(shots.map(s=>s.vx)).size>90);
 for(const shot of shots){
  assert.ok(shot.cooldown>=3.4&&shot.cooldown<=4.2);
  assert.ok(Math.abs(Math.hypot(shot.vx,shot.vs,shot.vy)-165)<1e-8);
  assert.ok(Math.abs(Math.atan2(shot.vx,shot.vs))<=ENEMY_FIRE.yawSpread);
  assert.ok(Math.abs(Math.atan2(shot.vy,Math.hypot(shot.vx,shot.vs)))<=ENEMY_FIRE.pitchSpread);
 }
});

test('live enemy firing obeys the slower cooldown between shots',()=>{
 const r=encounter();r.health=100;const times=[];let count=0;
 for(let i=0;i<1200;i++){
  step(r,{},dt);const next=r.events.filter(e=>e.type==='enemyShot').length;
  if(next>count){times.push(r.time);count=next;}
 }
 assert.ok(times.length>=3&&times.length<=6);
 for(let i=1;i<times.length;i++)assert.ok(times[i]-times[i-1]>=3.4-dt-1e-8);
});
