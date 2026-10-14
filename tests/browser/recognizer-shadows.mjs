import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:800}}),errors=[];
 await page.addInitScript(()=>localStorage.setItem('tron-enemy-ai',JSON.stringify({version:3,mode:'classic',small:false})));
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/shadow-inspection',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));await page.goto(new URL('/shadow-inspection',process.env.TRON_URL||'http://127.0.0.1:5173').href);
 const result=await page.evaluate(async()=>{
 await (await import('/src/simulation/debris-physics.js')).debrisPhysicsReady;
  const T=await import('/node_modules/three/build/three.module.js'),{loadRecognizer,createRecognizer}=await import('/src/rendering/models.js'),{RecognizerShadows}=await import('/src/rendering/recognizer-shadows.js'),{Breakups}=await import('/src/rendering/breakup.js');
  const craft=createRecognizer(await loadRecognizer());craft.root.scale.setScalar(.65);craft.root.position.set(0,55,0);
  const scene=new T.Scene();scene.background=new T.Color(0x03050c);
  const roof=new T.Mesh(new T.PlaneGeometry(65,65),new T.MeshBasicMaterial({color:0x446699,side:T.DoubleSide}));roof.rotation.x=-Math.PI/2;roof.position.set(15,15,25);scene.add(roof);
  const wall=new T.Mesh(new T.PlaneGeometry(65,45),new T.MeshBasicMaterial({color:0x446699,side:T.DoubleSide}));wall.position.set(10,25,10);scene.add(wall);
  const shadows=new RecognizerShadows([craft],[roof,wall]),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1.5);renderer.setSize(1000,800);document.body.append(renderer.domElement);
  const camera=new T.PerspectiveCamera(48,1.25,.1,1000);camera.position.set(90,90,100);camera.lookAt(10,20,15);
  const target=new T.WebGLRenderTarget(1000,800),pixels=()=>{renderer.setRenderTarget(target);renderer.render(scene,camera);const a=new Uint8Array(1000*800*4);renderer.readRenderTargetPixels(target,0,0,1000,800,a);renderer.setRenderTarget(null);return a;};
  const counts=[];
  for(const receiver of [roof,wall]){
   roof.visible=receiver===roof;wall.visible=receiver===wall;craft.root.visible=false;shadows.update(renderer);const before=pixels();craft.root.visible=true;shadows.update(renderer);const after=pixels();let darker=0;
   for(let i=0;i<before.length;i+=4)if(before[i]-after[i]>4)darker++;counts.push(darker);
  }
  craft.root.visible=false;
  const breakups=new Breakups(new T.Scene());breakups.spawn(craft,{x:0,y:55,s:0,yaw:0,fold:0});
  // Inspect early debris before the strong blast carries it beyond these small receivers.
  for(let i=0;i<12;i++)breakups.update(1/60);
  const burst=breakups.bursts[0];
  for(const receiver of [roof,wall]){
   roof.visible=receiver===roof;wall.visible=receiver===wall;shadows.update(renderer,[]);const before=pixels();shadows.update(renderer,[burst]);const after=pixels();let darker=0;
   for(let i=0;i<before.length;i+=4)if(before[i]-after[i]>4)darker++;counts.push(darker);
  }
  craft.root.visible=true;roof.visible=wall.visible=true;shadows.update(renderer);renderer.render(scene,camera);return counts;
 });assert.ok(result.every(n=>n>100),JSON.stringify(result));await page.screenshot({path:'test-results/recognizer-wall-shadows.png'});assert.deepEqual(errors,[]);console.log({shadowPixels:{roof:result[0],wall:result[1],debrisRoof:result[2],debrisWall:result[3]}});
 await page.goto(process.env.TRON_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start').disabled);await page.waitForFunction(()=>window.__tron.state.mode==='ready');await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');await page.waitForTimeout(500);assert.deepEqual(errors,[]);
}finally{await browser.close();}
