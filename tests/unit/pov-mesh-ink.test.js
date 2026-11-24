import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,IcosahedronGeometry,Mesh,MeshBasicMaterial} from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {povMeshCreases} from '../../src/rendering/pov-mesh-lighting.js';
const segments=map=>[...map.values()].reduce((n,p)=>n+p.length/6,0);
test('ink follows true creases, never tessellation facets',()=>{
 // A box's faces do not share vertices and meet at 90°: its 12 edges are creases.
 assert.equal(segments(povMeshCreases([new Mesh(new BoxGeometry(1,1,1),new MeshBasicMaterial())])),12);
 // A coarse sphere whose vertices are shared across its smooth surface (as the converter
 // writes them): its facets meet at well over 10°, but none of those edges is a crease.
 const sphere=new IcosahedronGeometry(1,1);sphere.deleteAttribute('normal');sphere.deleteAttribute('uv');
 assert.equal(segments(povMeshCreases([new Mesh(mergeVertices(sphere),new MeshBasicMaterial())])),0);
});
