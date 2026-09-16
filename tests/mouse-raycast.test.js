import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {updateMouseTarget} from '../src/rendering/mouse-target.js';
import {createRun,cannonPose} from '../src/simulation/run.js';
test('mouse view ray selects nearest visible surface and aims from the muzzle',()=>{
 const r=createRun();Object.assign(r,{x:0,s:0,yaw:0,turretYaw:.5});
 const box=z=>{const m=new THREE.Mesh(new THREE.BoxGeometry(10,10,2),new THREE.MeshBasicMaterial());m.position.set(0,4,z);return m;};
 const near=box(-20),far=box(-80),hidden=box(-10);hidden.visible=false;
 const v={mouseLook:{yaw:0,pitch:0},camera:new THREE.PerspectiveCamera(),world:{slabs:near,floor:far},carrier:hidden,recognizers:[],enemyTanks:[]};v.camera.position.set(0,4,0);
 updateMouseTarget.call(v,r);
 const p=cannonPose(r),expected=Math.atan2(p.x,-(-19+p.s));
 assert.ok(Math.abs(v.mouseTarget.yaw-expected)<1e-9);
 const first=v.mouseTarget.yaw;near.visible=false;updateMouseTarget.call(v,r);assert.notEqual(v.mouseTarget.yaw,first);
 far.visible=false;updateMouseTarget.call(v,r);assert.ok(Number.isFinite(v.mouseTarget.pitch));assert.ok(Math.abs(v.mouseTarget.yaw)<.001);
});
