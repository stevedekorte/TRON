import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/occlusion-fixture',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
 await page.goto(new URL('/occlusion-fixture',process.env.TRON_URL||'http://127.0.0.1:5173').href);
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {RecognizerShadows}=await import('/src/rendering/recognizer-shadows.js');
  const {MazeShadows}=await import('/src/rendering/maze-shadows.js');
  const {occludeProjectedShadow}=await import('/src/rendering/maze-light-visibility.js');
  const {DEFAULT_WORLD}=await import('/src/levels/scenario.js');
  const scene=new T.Scene(),storage=new T.Scene();
  const renderer=new T.WebGLRenderer({antialias:false,stencil:true,preserveDrawingBuffer:true});renderer.setSize(800,600);document.body.append(renderer.domElement);
  const block=new T.Mesh(new T.BoxGeometry(30,40,30),new T.MeshBasicMaterial());block.position.y=20;storage.add(block);
  block.geometry.setAttribute('shadowWallId',new T.Float32BufferAttribute(new Array(block.geometry.attributes.position.count).fill(1),1));
  const maze=new MazeShadows({slabs:block},[],{...DEFAULT_WORLD,MAZE_LENGTH:100,WALL_HEIGHT:40,MAZE_INSTANCES:[{x:0,s:0}]});maze.update(renderer);
  const make=(w,h)=>new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:0x7799bb,side:T.DoubleSide}));
  const roof=make(28,28);roof.rotation.x=-Math.PI/2;roof.position.y=40;
  const wall=make(30,40);wall.position.set(0,20,15);
  const floor=make(28,28);floor.rotation.x=-Math.PI/2;floor.position.y=.01;
  for(const surface of [roof,wall])surface.geometry.setAttribute('shadowWallId',new T.Float32BufferAttribute(new Array(surface.geometry.attributes.position.count).fill(1),1));
  scene.add(roof,wall,floor);
  const root=new T.Group(),caster=new T.Mesh(new T.BoxGeometry(26,2,26),new T.MeshBasicMaterial({name:'Base'}));root.add(caster);root.position.set(-15,70,-15);
  const craft={root,casters:[caster],radius:65};
  const shadows=new RecognizerShadows([craft],[roof,wall,floor],1);
  const camera=new T.PerspectiveCamera(45,800/600,.1,500);camera.position.set(65,85,100);camera.lookAt(0,20,0);
  const target=new T.WebGLRenderTarget(800,600),pixels=()=>{renderer.setRenderTarget(target);renderer.render(scene,camera);const p=new Uint8Array(800*600*4);renderer.readRenderTargetPixels(target,0,0,800,600,p);renderer.setRenderTarget(null);return p;};
  const darker=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)if(a[i]-b[i]>8)n++;return n;};
  const counts=[];
  for(const receiver of [roof,wall,floor]){
   for(const m of [roof,wall,floor])m.visible=m===receiver;
   root.visible=false;shadows.update(renderer);const baseline=pixels();
   root.visible=true;shadows.setOcclusion(null);shadows.update(renderer);const leaked=darker(baseline,pixels());
   shadows.setOcclusion(maze);const masked=darker(baseline,pixels());counts.push({leaked,masked});
  }
  // Debris uses the same atlas entries and must obey the same wall visibility.
  root.visible=false;roof.visible=floor.visible=false;wall.visible=true;
  shadows.update(renderer);const bare=pixels();
  shadows.update(renderer,[{pieces:[{group:root}],age:0,life:5,motion:{fade:1}}]);
  const debris=darker(bare,pixels());
  shadows.update(renderer,[]);floor.visible=true;wall.visible=false;
  const projected=new T.Mesh(new T.PlaneGeometry(26,26),new T.ShaderMaterial({depthTest:false,depthWrite:false,side:T.DoubleSide,
   vertexShader:'void main(){vec4 world=modelMatrix*vec4(position,1.);world.xz+=vec2(.5)*world.y;world.y=.025;gl_Position=projectionMatrix*viewMatrix*world;}',
   fragmentShader:'void main(){gl_FragColor=vec4(0.,0.,0.,1.);}'}));
  projected.rotation.x=-Math.PI/2;projected.position.set(-15,70,-15);projected.renderOrder=1;
  const base=pixels();scene.add(projected);const projectedLeak=darker(base,pixels());
  occludeProjectedShadow(projected.material,maze);const projectedMasked=darker(base,pixels());
  scene.remove(projected);roof.visible=wall.visible=floor.visible=true;root.visible=true;shadows.update(renderer);renderer.render(scene,camera);
  const output={counts,debris,projectedLeak,projectedMasked};
  maze.dispose();shadows.dispose();target.dispose();return output;
 });
 console.log(result);
 assert(result.counts[0].masked>100,'exposed roof retains shadow');
 for(const i of [1,2]){assert(result.counts[i].leaked>100,'fixture reproduces shadow through wall');assert(result.counts[i].masked<5,'hidden receiver is protected');}
 assert(result.debris<5);assert(result.projectedLeak>100);assert(result.projectedMasked<5);
 assert.deepEqual(errors,[]);await page.screenshot({path:'test-results/recognizer-shadow-occlusion.png'});
}finally{await browser.close();}
