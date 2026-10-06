import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {CameraRig} from '../src/rendering/camera-rig.js';
import {livingCluKiller} from '../src/game/clu-death.js';
import {config} from '../src/game/config.js';
import {createRun,updateWeapons} from '../src/simulation/run.js';
import {resolveCrush} from '../src/simulation/crush.js';
const world={wallIntersection:()=>null,lineOfSight:()=>true};
const fixture=()=>{
 const rig=new CameraRig(world);rig.camera.position.set(0,8,20);rig.camera.lookAt(0,2,0);
 const enemy={id:100,kind:'ground',health:3,state:'patrol',x:60,s:30,yaw:Math.PI/2,turretYaw:0};
 const run={crushed:true,killedBy:100,enemyTanks:[enemy],recognizers:[]};return {rig,run,enemy};
};
test('fatal projectile attributes the killer, and reset removes attribution',()=>{
 const r=createRun();Object.assign(r,{x:-5000,s:-5000,health:1});r.enemyTanks=[];r.recognizers=[];
 r.projectiles=[{x:r.x,s:r.s,y:2,vx:0,vs:0,vy:0,life:1,faction:'enemy',owner:104}];
 updateWeapons(r,{},1/60);assert(r.crushed);assert.equal(r.killedBy,104);assert.equal(createRun().killedBy,null);
});
test('Recognizer stomp records the actual attacker',()=>{
 const r=createRun();const e=r.recognizers[0];Object.assign(r,{x:e.x,s:e.s});e.attack={impact:true};resolveCrush(r,e);assert.equal(r.killedBy,e.id);assert.equal(livingCluKiller(r),e);
});
test('death view eases position and rotation into normal follow distance around killer',()=>{
 const {rig,run,enemy}=fixture(),start=rig.camera.position.clone(),rotation=rig.camera.quaternion.clone();
 assert(rig.deathCamera.update(rig,run,1/60,'running'));
 assert(rig.camera.position.distanceTo(start)<.02);assert(rig.camera.quaternion.angleTo(rotation)<.002);
 for(let i=1;i<150;i++)rig.deathCamera.update(rig,run,1/60,'running');
 assert(Math.abs(rig.camera.position.x-enemy.x-config.cameraDistance)<1e-8);
 assert(Math.abs(rig.camera.position.y-config.cameraHeight)<1e-8);
 const expected=new T.Vector3(enemy.x,2.5,-enemy.s).sub(rig.camera.position).normalize();
 assert(rig.camera.getWorldDirection(new T.Vector3()).distanceTo(expected)<1e-8);
 enemy.x+=2;rig.deathCamera.update(rig,run,1/60,'running');assert(Math.abs(rig.camera.position.x-enemy.x-config.cameraDistance)<1e-8);
});
test('aircraft follow uses its altitude, pause freezes and dead killer holds last shot',()=>{
 const {rig,run,enemy}=fixture();enemy.kind='recognizer';enemy.y=80;
 for(let i=0;i<150;i++)rig.deathCamera.update(rig,run,1/60,'running');assert.equal(rig.camera.position.y,80+config.cameraHeight);
 const p=rig.camera.position.clone();enemy.x+=20;rig.deathCamera.update(rig,run,1,'paused');assert(rig.camera.position.equals(p));
 enemy.health=0;enemy.state='destroyed';rig.deathCamera.update(rig,run,1,'running');assert(rig.camera.position.equals(p));
 rig.reset();assert.equal(rig.deathCamera.transition,null);assert(!rig.deathCamera.update(rig,run,1/60,'running'));
});
test('missing or already dead killer and cycle deaths retain existing camera behavior',()=>{
 const {rig,run,enemy}=fixture();enemy.health=0;assert(!rig.deathCamera.update(rig,run,1/60,'running'));
 enemy.health=3;run.killedBy=999;assert(!livingCluKiller(run));run.killedBy=100;run.playerVehicle='cycle';assert(!rig.deathCamera.update(rig,run,1/60,'running'));
});
