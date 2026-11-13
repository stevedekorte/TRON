import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {boundaryEdges,cycleOutlineGeometry,CYCLE_COCKPIT_OUTLINE} from '../../src/rendering/cycle-cockpit-outline.js';

test('boundary edges keep openings and drop shared interior edges',()=>{
 const quad=new THREE.PlaneGeometry(1,1);              // two triangles sharing a diagonal
 assert.equal(boundaryEdges(quad).length/6,4);
 const unindexed=quad.toNonIndexed();                 // coincident vertices are welded first
 assert.equal(boundaryEdges(unindexed).length/6,4);
});

test('outline uses only canopy materials and omits segments inside the wheels',()=>{
 const root=new THREE.Group();root.scale.setScalar(5);
 const add=(name,y,z)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(.1,.1).rotateY(Math.PI/2),new THREE.MeshBasicMaterial({name}));m.position.set(0,y,z);root.add(m);};
 add('black',.55,0);                                   // canopy frame: kept
 add('Color_D06',.55,.2);                              // body panel: not a canopy material
 add('black',CYCLE_COCKPIT_OUTLINE.wheel.centerY,CYCLE_COCKPIT_OUTLINE.wheel.centersZ[0]); // wheel rim: dropped
 const g=cycleOutlineGeometry(root);
 assert.equal(g.attributes.position.count/2,4);
 const box=new THREE.Box3().setFromBufferAttribute(g.attributes.position);
 assert(box.min.y>.49&&box.max.y<.61,'segments are in model units around the canopy');
});
