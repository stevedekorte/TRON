import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createStaticWallShadowGeometry} from '../src/rendering/static-wall-shadows.js';
test('neighboring wall IDs on the same rounded plane cannot cast false triangles',()=>{
 for(const offset of [0,7000]){
  const receiverGeometry=new T.PlaneGeometry(40,30).toNonIndexed();receiverGeometry.translate(offset,15,-offset);
  receiverGeometry.setAttribute('shadowWallId',new T.Float32BufferAttribute(new Float32Array(6).fill(1),1));
  const receiver=new T.Mesh(receiverGeometry);
  const caster=new T.PlaneGeometry(40,30).toNonIndexed();caster.translate(offset,15,-offset-.0005);
  caster.setAttribute('shadowWallId',new T.Float32BufferAttribute(new Float32Array(6).fill(2),1));
  const shadows=createStaticWallShadowGeometry(receiver,caster);assert.equal(shadows.attributes.position.count,0);
  shadows.dispose();caster.dispose();receiverGeometry.dispose();receiver.material.dispose();
 }
});
