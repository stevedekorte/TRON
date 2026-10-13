import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {loadLightCycles} from '../rendering/light-cycles.js';
import {disposeSceneResources} from '../rendering/scene-resources.js';
import {POV_CYCLE_SCALE} from './pov-cycle-model.js';
import {rayFragment,meshFragment,meshVertex} from './cycle-ray-shader.js';
const $=id=>document.getElementById(id);
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(1);renderer.autoClear=false;renderer.outputColorSpace=T.LinearSRGBColorSpace;document.body.append(renderer.domElement);
const camera=new T.PerspectiveCamera(38,16/9,.03,1000);camera.position.set(4.8,2.9,5.3);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.68,0);controls.enableDamping=true;controls.minDistance=2.8;controls.maxDistance=18;controls.maxPolarAngle=Math.PI*.49;controls.update();
const shared={bodyColor:{value:new T.Color('#e6bd14')},shadows:{value:false}};
const uniforms={...shared,cameraWorld:{value:camera.matrixWorld},inverseProjection:{value:camera.projectionMatrixInverse},viewProjection:{value:new T.Matrix4()},resolution:{value:new T.Vector2()},showCycle:{value:true},samples:{value:4}};
const background=new T.Scene(),quad=new T.Mesh(new T.PlaneGeometry(2,2),new T.ShaderMaterial({defines:{SHOW_CYCLE:1},uniforms,vertexShader:'void main(){gl_Position=vec4(position.xy,0,1);}',fragmentShader:rayFragment,depthTest:true,depthWrite:true}));quad.frustumCulled=false;background.add(quad);
const floorScene=new T.Scene(),floorQuad=quad.clone();floorQuad.material=quad.material.clone();floorQuad.material.defines={};floorQuad.material.uniforms=uniforms;floorScene.add(floorQuad);
const scene=new T.Scene();let mode='analytic',disposed=false,last=0,frames=[],gpuTimes=[],benchmark=null,ready=false;
const gl=renderer.getContext(),timer=gl.getExtension('EXT_disjoint_timer_query_webgl2'),debug=gl.getExtension('WEBGL_debug_renderer_info'),queries=[];
const gpu=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
function resize(){const h=Number($('resolution').value),w=h*16/9;renderer.setSize(w,h,false);uniforms.resolution.value.set(w,h);frames=[];gpuTimes=[];}
resize();
function updateVariants(){quad.material.defines={...(mode==='analytic'?{SHOW_CYCLE:1}:{}),...(shared.shadows.value?{CAST_SHADOWS:1}:{})};quad.material.needsUpdate=true;scene.traverse(o=>{if(o.isMesh)for(const m of [].concat(o.material)){m.defines=shared.shadows.value?{CAST_SHADOWS:1}:{};m.needsUpdate=true;}});}
function setMode(value){mode=value;uniforms.showCycle.value=value==='analytic';for(const id of ['analytic','mesh'])$(id).setAttribute('aria-pressed',String(id===value));frames=[];gpuTimes=[];updateVariants();}
for(const id of ['analytic','mesh'])$(id).onclick=()=>setMode(id);
$('resolution').onchange=resize;$('aa').onchange=()=>{uniforms.samples.value=$('aa').checked?4:1;};$('color').onchange=()=>shared.bodyColor.value.set($('color').value);$('shadows').onchange=()=>{shared.shadows.value=$('shadows').checked;updateVariants();};
const percentile=(values,p)=>values.length?[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*p))]:null;
function stats(){return {mode,width:gl.drawingBufferWidth,height:gl.drawingBufferHeight,frames:frames.length,fps:frames.length?1000/(frames.reduce((a,b)=>a+b,0)/frames.length):0,frameP95Milliseconds:percentile(frames,.95),gpuMedianMilliseconds:percentile(gpuTimes,.5),gpu,raysPerPixel:uniforms.samples.value,shadows:shared.shadows.value};}
function measure(milliseconds=8000){if(benchmark)return Promise.reject(Error('Benchmark already running'));frames=[];gpuTimes=[];return new Promise(resolve=>{benchmark={start:performance.now()+1000,end:performance.now()+1000+milliseconds,resolve};});}
$('benchmark').onclick=async()=>{const r=await measure();$('status').textContent=`${r.width} × ${r.height}: ${r.fps.toFixed(1)} FPS · p95 ${r.frameP95Milliseconds.toFixed(1)} ms${r.gpuMedianMilliseconds!==null?' · GPU '+r.gpuMedianMilliseconds.toFixed(2)+' ms':''}`;};
window.raycastStudy={setMode,resize:h=>{$('resolution').value=String(h);resize();},measure,stats,camera,controls,renderer,get ready(){return ready;}};
try{
 const models=await loadLightCycles(),model=models[0];disposeSceneResources(models[1]);
 model.position.y=model.userData.groundOffsetMeters;
 const bounds=new T.Box3().setFromObject(model),center=bounds.getCenter(new T.Vector3());model.position.x-=center.x;model.position.z-=center.z;
 const originalMaterials=new Set();model.traverse(o=>{if(o.isMesh){o.material=[].concat(o.material).map(m=>{originalMaterials.add(m);return new T.ShaderMaterial({uniforms:{...shared,albedo:{value:m.color?.clone()||new T.Color(.3,.3,.3)},painted:{value:['Color_D06','_1','Color_L12'].includes(m.name)}},vertexShader:meshVertex,fragmentShader:meshFragment,side:T.DoubleSide});});if(o.material.length===1)o.material=o.material[0];}});originalMaterials.forEach(m=>m.dispose());scene.add(model);
 window.raycastStudy.modelBounds=new T.Box3().setFromObject(model).getSize(new T.Vector3()).toArray();
 ready=true;$('status').textContent='Ready. Toggle views to compare; measure at each resolution.';
}catch(error){$('status').textContent=error.message;console.error(error);}
// Limit the costly CSG pass to the projection of its model/shadow bounds.
const boxCorners=[];
for(const x of [-80,80])for(const y of [0,230])for(const z of [-262.6,262.6])boxCorners.push(new T.Vector3(x,y,z).multiplyScalar(POV_CYCLE_SCALE));
function setCycleScissor(){
 let minX=1,minY=1,maxX=-1,maxY=-1;const points=[...boxCorners];
 if(shared.shadows.value)for(const p of boxCorners)points.push(new T.Vector3(p.x+p.y*.5,0,p.z+p.y*.5));
 for(const p of points){const v=p.clone().project(camera);if(v.z< -1||v.z>1){renderer.setScissorTest(false);return;}minX=Math.min(minX,v.x);maxX=Math.max(maxX,v.x);minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);}
 const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,x=Math.max(0,Math.floor((minX+1)*w*.5)-3),y=Math.max(0,Math.floor((minY+1)*h*.5)-3);
 renderer.setScissor(x,y,Math.max(0,Math.min(w,Math.ceil((maxX+1)*w*.5)+3)-x),Math.max(0,Math.min(h,Math.ceil((maxY+1)*h*.5)+3)-y));renderer.setScissorTest(true);
}
let count=0;
renderer.setAnimationLoop(now=>{
 if(disposed)return;const dt=last?now-last:0;last=now;
 controls.autoRotate=$('orbit').checked;controls.autoRotateSpeed=1;controls.update(dt/1000);camera.updateMatrixWorld();uniforms.viewProjection.value.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
 while(queries.length&&gl.getQueryParameter(queries[0],gl.QUERY_RESULT_AVAILABLE)){
  const q=queries.shift();if(!gl.getParameter(timer.GPU_DISJOINT_EXT))gpuTimes.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);if(gpuTimes.length>240)gpuTimes.shift();
 }
 const q=timer&&queries.length<4&&count++%10===0?gl.createQuery():null;
 if(q)gl.beginQuery(timer.TIME_ELAPSED_EXT,q);
 renderer.setScissorTest(false);renderer.clear();renderer.render(floorScene,camera);if(mode==='analytic'||shared.shadows.value){setCycleScissor();renderer.render(background,camera);renderer.setScissorTest(false);}if(mode==='mesh'&&ready)renderer.render(scene,camera);
 if(q){gl.endQuery(timer.TIME_ELAPSED_EXT);queries.push(q);}
 if(dt>0&&ready&&(!benchmark||now>=benchmark.start)){frames.push(dt);if(!benchmark&&frames.length>240)frames.shift();}
 if(benchmark){$('status').textContent=`Measuring ${mode} · ${Math.max(0,(benchmark.end-now)/1000).toFixed(1)} s remaining`;if(now>=benchmark.end){const resolve=benchmark.resolve;benchmark=null;resolve(stats());}}
});
addEventListener('pagehide',()=>{disposed=true;renderer.setAnimationLoop(null);controls.dispose();for(const q of queries)gl.deleteQuery(q);disposeSceneResources(scene);floorQuad.material.dispose();disposeSceneResources(background);renderer.dispose();},{once:true});
