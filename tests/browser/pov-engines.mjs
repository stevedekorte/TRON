// POV-Ray cycle shader across browser engines/backends available on this Mac:
// compile + self-test (warm), frame determinism and a reference capture.
// TRON_ENGINES=chrome-metal,chrome-gl,chrome-swiftshader,webkit,firefox
import {chromium,webkit,firefox} from '@playwright/test';
import {silentChromeArgs,silentFirefoxPrefs,silence} from './silent.mjs';
const ENGINES={
 'chrome-metal':()=>chromium.launch({channel:'chrome',headless:true,args:silentChromeArgs}),
 'chrome-gl':()=>chromium.launch({channel:'chrome',headless:true,args:[...silentChromeArgs,'--use-angle=gl']}),
 'chrome-swiftshader':()=>chromium.launch({channel:'chrome',headless:true,args:[...silentChromeArgs,'--use-angle=swiftshader','--enable-unsafe-swiftshader']}),
 webkit:()=>webkit.launch({headless:true}),
 firefox:()=>firefox.launch({headless:true,firefoxUserPrefs:silentFirefoxPrefs}),
};
const names=(process.env.TRON_ENGINES||Object.keys(ENGINES).join(',')).split(',');
let failed=false;
for(const name of names){
 const browser=await ENGINES[name]();
 try{
  const page=await browser.newPage({viewport:{width:400,height:280}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,200));});
  await page.route('**/pov-fixture',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0;background:#000"></body>'}));
  await page.goto('http://127.0.0.1:5173/pov-fixture');
  const r=await page.evaluate(async()=>{
   const T=await import('/node_modules/three/build/three.module.js'),{PovCycles,povSingleTrace}=await import('/src/rendering/pov-cycles.js');
   const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(400,280);document.body.append(renderer.domElement);
   let lost=false;renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;});
   const gl=renderer.getContext(),info=gl.getExtension('WEBGL_debug_renderer_info');
   const gpu=info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
   const root=new T.Group(),source=new T.Group();source.userData.team=0;source.userData.cycleFormationProgress=1;root.add(source);
   const view=new PovCycles({root,bikes:[source],materializations:[{}]});
   const scene=new T.Scene();scene.add(root);
   const camera=new T.PerspectiveCamera(38,400/280,.03,100);camera.position.set(4.6,2.5,4.8);camera.lookAt(0,.75,0);
   const t=performance.now();let selfTest;
   try{selfTest=await view.warm(renderer,camera);}catch(e){return {gpu,singleTrace:povSingleTrace(renderer),ok:false,error:e.message,lost};}
   const warmMs=Math.round(performance.now()-t);
   const frames=[];
   for(let i=0;i<3;i++){view.prepare();view.edges.render(renderer,view.root,camera);renderer.render(scene,camera);view.restore();const p=new Uint8Array(400*280*4);gl.readPixels(0,0,400,280,gl.RGBA,gl.UNSIGNED_BYTE,p);frames.push(p);}
   let diff=0;for(let f=1;f<3;f++)for(let i=0;i<frames[0].length;i++)if(frames[f][i]!==frames[0][i])diff++;
   return {gpu,singleTrace:povSingleTrace(renderer),ok:!lost,warmMs,drawn:+selfTest.solid.drawnFraction.toFixed(3),lit:+selfTest.solid.litFraction.toFixed(3),nondeterministic:diff,lost};
  });
  await page.screenshot({path:`test-results/cycle-rendering/pov-engines/pov-engine-${name}.png`});
  const pass=r.ok&&r.nondeterministic===0&&!errors.length;failed||=!pass;
  console.log(`${pass?'PASS':'FAIL'} ${name}`,JSON.stringify(r),errors.length?errors:'');
 }finally{await browser.close();}
}
process.exitCode=failed?1:0;
