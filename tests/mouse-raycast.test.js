import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {mouseTarget} from '../src/rendering/mouse-target.js';
import {createRun,cannonPose} from '../src/simulation/run.js';
test('mouse view ray selects nearest visible surface and aims from the muzzle',()=>{
 const r=createRun();Object.assign(r,{x:0,s:0,yaw:0,turretYaw:.5});
 const box=z=>{const m=new THREE.Mesh(new THREE.BoxGeometry(10,10,2),new THREE.MeshBasicMaterial());m.position.set(0,4,z);return m;};
 const near=box(-20),far=box(-80),hidden=box(-10);hidden.visible=false;
 const v={mouseLook:{yaw:0,pitch:0},camera:new THREE.PerspectiveCamera(),world:{slabs:near,floor:far},carrier:hidden,recognizers:[],enemyTanks:[]};v.camera.position.set(0,4,0);
 v.mouseTarget=mouseTarget(r,v.mouseLook,v.camera,[v.world.slabs,v.world.floor,v.carrier,...v.recognizers.map(c=>c.root),...v.enemyTanks.map(c=>c.root)]);
 const p=cannonPose(r),expected=Math.atan2(p.x,-(-19+p.s));
 assert.ok(Math.abs(v.mouseTarget.yaw-expected)<1e-9);
 const first=v.mouseTarget.yaw;near.visible=false;v.mouseTarget=mouseTarget(r,v.mouseLook,v.camera,[v.world.slabs,v.world.floor,v.carrier,...v.recognizers.map(c=>c.root),...v.enemyTanks.map(c=>c.root)]);assert.notEqual(v.mouseTarget.yaw,first);
 far.visible=false;v.mouseTarget=mouseTarget(r,v.mouseLook,v.camera,[v.world.slabs,v.world.floor,v.carrier,...v.recognizers.map(c=>c.root),...v.enemyTanks.map(c=>c.root)]);assert.ok(Number.isFinite(v.mouseTarget.pitch));assert.ok(Math.abs(v.mouseTarget.yaw)<.001);
});
