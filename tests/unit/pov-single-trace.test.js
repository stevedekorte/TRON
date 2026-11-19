import test from 'node:test';
import assert from 'node:assert/strict';
import {povSingleTrace} from '../../src/rendering/pov-cycles.js';
const renderer=name=>({getContext:()=>({RENDERER:7937,getExtension:()=>({UNMASKED_RENDERER_WEBGL:37446}),getParameter:p=>p===37446?name:'WebKit WebGL'})});
test('Apple/Metal GPUs use the single-call-site POV shader; others keep two call sites',()=>{
 for(const name of ['ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Max, Unspecified Version)','Apple GPU','Apple M2 Max'])assert.equal(povSingleTrace(renderer(name)),true,name);
 for(const name of ['ANGLE (Intel, ANGLE Metal Renderer: Intel(R) Iris(TM) Plus Graphics, Unspecified Version)','ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)','ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0 ps_5_0, D3D11)','ANGLE (Intel, Mesa Intel(R) UHD Graphics 620, OpenGL 4.6)',null])assert.equal(povSingleTrace(renderer(name)),false,String(name));
});
test('?povTrace overrides the GPU choice',()=>{
 const apple=renderer('Apple GPU'),other=renderer('ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0 ps_5_0, D3D11)');
 assert.equal(povSingleTrace(apple,'?povTrace=double'),false);assert.equal(povSingleTrace(other,'?povTrace=single'),true);assert.equal(povSingleTrace(apple,'?povTrace=bogus'),true);
});
