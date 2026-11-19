import test from 'node:test';
import assert from 'node:assert/strict';
import {softwareRenderer} from '../../src/ui/cycle-renderer-control.js';
test('software rasterizers do not auto-enable POV-Ray cycles',()=>{
 for(const name of ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)','llvmpipe (LLVM 17.0.6, 256 bits)','ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)'])assert.equal(softwareRenderer(name),true,name);
 for(const name of ['ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Max, Unspecified Version)','Apple GPU','Adreno (TM) 750','Mali-G715','ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)','',null])assert.equal(softwareRenderer(name),false,String(name));
});
