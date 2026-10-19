import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,EdgesGeometry} from 'three';
import {materializationEdges} from '../../src/rendering/materialization-edges.js';
const positions=g=>Array.from(g.getAttribute('position').array);
test('reused wireframes match original edges and have independent buffers/lifetimes',()=>{
 const source=new BoxGeometry(3,4,5),expected=new EdgesGeometry(source,25);
 const a=materializationEdges(source),b=materializationEdges(source);
 assert.deepEqual(positions(a),positions(expected));assert.deepEqual(positions(b),positions(expected));
 assert.notEqual(a,b);assert.notEqual(a.getAttribute('position').array,b.getAttribute('position').array);
 a.getAttribute('position').array.fill(0);a.dispose();
 assert.deepEqual(positions(b),positions(expected));assert.deepEqual(positions(materializationEdges(source)),positions(expected));
 source.translate(2,0,0);const changed=new EdgesGeometry(source,25);
 assert.deepEqual(positions(materializationEdges(source)),positions(changed));assert.notDeepEqual(positions(changed),positions(expected));
});
