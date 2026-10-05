import test from 'node:test';
import assert from 'node:assert/strict';
import {BOSS_TANK,bossMuzzlePoses} from '../src/game/boss-tank.js';
import {applyPartDamage} from '../src/simulation/part-damage.js';
import {enemyHitPart} from '../src/simulation/hit-parts.js';
import {createRun,cannonPose} from '../src/simulation/run.js';
import {updateGroundTanks} from '../src/simulation/ground-tanks.js';
import {config} from '../src/game/config.js';
function encounter(){
 const run=createRun(1982);Object.assign(run,{x:-5000,s:-5000});run.recognizers=[];run.enemyTanks=run.enemyTanks.slice(0,1);
 const e=run.enemyTanks[0];Object.assign(e,{boss:true,health:BOSS_TANK.health,x:-5000,s:-4800,yaw:Math.PI,turretYaw:0,speed:0,vx:0,vs:0,cooldown:0,canSee:true,memory:{x:-5000,s:-5000,vx:0,vs:0,seenAt:0,source:100}});
 return {run,e};
}
test('boss survives three full-damage hits and dies on the fourth, regardless of armor zone',()=>{
 for(const part of ['hull','turret','left-track','right-track']){
  const e={kind:'ground',boss:true,health:BOSS_TANK.health};
  for(let i=1;i<=4;i++){assert.equal(applyPartDamage(e,part).damage,3);assert.equal(e.health,12-i*3);}
 }
 const regular={kind:'ground',health:3};applyPartDamage(regular,'hull');assert.equal(regular.health,0);
});
test('boss fires paired projectiles from the two rotating barrel tips with one shared cooldown',()=>{
 const {run,e}=encounter();
 updateGroundTanks(run,1/60,()=>{},cannonPose);
 assert.equal(run.projectiles.length,2);
 const tips=bossMuzzlePoses(e);
 for(let i=0;i<2;i++)for(const axis of ['x','s','y'])assert.equal(run.projectiles[i][axis],tips[i][axis]);
 assert(Math.hypot(tips[0].x-tips[1].x,tips[0].s-tips[1].s)>4);
 assert(e.cooldown>3);assert.equal(run.events.filter(e=>e.type==='enemyShot').length,2);
 updateGroundTanks(run,1/60,()=>{},cannonPose);assert.equal(run.projectiles.length,2);
});
test('boss pursuit speed reaches 80% of a normal tank',()=>{
 const {run,e}=encounter();e.canSee=false;e.memory.s=e.s-2000;
 for(let i=0;i<500;i++)updateGroundTanks(run,1/60,(e,x,s)=>{e.x+=x;e.s+=s;},cannonPose);
 assert.equal(e.speed,config.maxSpeed*.8);
});
test('boss barrel armor follows turret rotation independently of its hull',()=>{
 const e={kind:'ground',boss:true,x:0,s:0,yaw:0,turretYaw:Math.PI/2};
 for(const tip of bossMuzzlePoses(e))assert.equal(enemyHitPart(e,tip),'turret');
 assert.equal(enemyHitPart(e,{x:10,s:10,y:2}),null);
});

test('four bosses start around the beam and patrol within the central court',async()=>{
 const {browserScenario}=await import('../src/game/browser-scenario.js');
 const {inBossCourt,bossCourtSector}=await import('../src/game/boss-tank.js');
 const {world}=browserScenario({pathname:'/',search:'?layoutSeed=1982'}),court=world.MAZE_INSTANCES.find(m=>m.patrols);
 const run=createRun(1982,world),bosses=run.enemyTanks.filter(e=>e.boss);
 assert.equal(bosses.length,4);assert.deepEqual(bosses.map(e=>bossCourtSector(e,court)),[0,1,2,3]);
 for(const boss of bosses)assert(bosses.every(other=>other===boss||Math.hypot(boss.x-other.x,boss.s-other.s)>30));
 const starts=bosses.map(e=>({...e}));run.enemyTanks=bosses;run.recognizers=[];run.x=run.s=-9000;
 for(let i=0;i<1200;i++){
  run.time=i/60;updateGroundTanks(run,1/60,(e,dx,ds)=>{e.x+=dx;e.s+=ds;},cannonPose);
  for(const e of bosses){assert(inBossCourt(e.goal,court));assert(Math.hypot(e.x-court.beamPosition.x,e.s-court.beamPosition.s)<=231);}
 }
 for(let i=0;i<bosses.length;i++)assert(Math.hypot(bosses[i].x-starts[i].x,bosses[i].s-starts[i].s)>20);
});
