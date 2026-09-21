import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/rez-shadow-fixture',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));await page.goto(new URL('/rez-shadow-fixture',process.env.TRON_URL||'http://127.0.0.1:5173').href);
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{loadRecognizer,createRecognizer}=await import('/src/rendering/models.js'),{Materialization}=await import('/src/rendering/materialization.js'),{RecognizerShadows}=await import('/src/rendering/recognizer-shadows.js');
  const template=await loadRecognizer(),scene=new T.Scene(),floor=new T.Mesh(new T.PlaneGeometry(600,600),new T.MeshBasicMaterial({color:0x6688aa,side:T.DoubleSide}));floor.rotation.x=-Math.PI/2;scene.add(floor);
  const roof=new T.Mesh(new T.PlaneGeometry(200,140),new T.MeshBasicMaterial({color:0x557799,side:T.DoubleSide}));roof.rotation.x=-Math.PI/2;roof.position.set(0,30,-65);scene.add(roof);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1000,700);document.body.append(renderer.domElement);
  const camera=new T.PerspectiveCamera(50,1000/700,.1,1000);camera.position.set(170,260,230);camera.lookAt(0,0,0);
  const target=new T.WebGLRenderTarget(1000,700),pixels=()=>{renderer.setRenderTarget(target);renderer.render(scene,camera);const p=new Uint8Array(1000*700*4);renderer.readRenderTargetPixels(target,0,0,1000,700,p);renderer.setRenderTarget(null);return p;};
  const crafts=Array.from({length:15},(_,i)=>{const c=createRecognizer(template);c.root.scale.setScalar(.65);c.root.position.set((i%5-2)*75,80,(Math.floor(i/5)-1)*90);return c;});
  let shadows=new RecognizerShadows(crafts,[floor,roof],0,{maxCrafts:12});
  shadows.update(renderer,[],camera.position);const original=pixels();shadows.dispose();
  for(const c of crafts){c.rez=new Materialization(c.root);c.rez.update(null);}
  shadows=new RecognizerShadows(crafts,[floor,roof],0,{maxCrafts:12});shadows.update(renderer,[],camera.position);const completed=pixels();
  let different=0;for(let i=0;i<original.length;i+=4)if(Math.abs(original[i]-completed[i])>2)different++;
  for(const c of crafts)c.rez.update(1);shadows.update(renderer,[],camera.position);const wire=pixels();
  for(const c of crafts)c.root.visible=false;shadows.update(renderer,[],camera.position);const empty=pixels();let ghosts=0;for(let i=0;i<wire.length;i+=4)if(Math.abs(wire[i]-empty[i])>2)ghosts++;
  for(const c of crafts){c.root.visible=true;c.rez.update(null);}shadows.update(renderer,[],camera.position);renderer.render(scene,camera);
  let realShadowPixels=0;for(let i=0;i<original.length;i+=4)if(empty[i]-original[i]>2)realShadowPixels++;
  return {different,ghosts,realShadowPixels};
 });console.log(result);await page.screenshot({path:'test-results/materialization-shadow-check.png'});assert.deepEqual(errors,[]);assert.equal(result.different,0);assert.equal(result.ghosts,0);assert.ok(result.realShadowPixels>1000);
}finally{await browser.close();}
