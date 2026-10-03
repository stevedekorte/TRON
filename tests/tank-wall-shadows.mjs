import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:900,height:650}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/tank-shadow-fixture',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));await page.goto('http://127.0.0.1:5173/tank-shadow-fixture');
 for(const filtered of [false,true]){
 await page.evaluate(async filtered=>{
 const T=await import('/node_modules/three/build/three.module.js'),{createTank}=await import('/src/rendering/models.js'),{RecognizerShadows}=await import('/src/rendering/recognizer-shadows.js');
 const tank=await createTank(),scene=new T.Scene();scene.background=new T.Color(0x142536);scene.add(tank.root);scene.add(new T.HemisphereLight(0xffffff,0x778899,3));
 const wall=new T.Mesh(new T.BoxGeometry(35,60,3),new T.MeshBasicMaterial());wall.position.set(-30,30,-30);wall.rotation.y=.3;wall.updateMatrixWorld(true);
 const root=new T.Group(),receivers=[];tank.root.traverse(o=>{if(o.isMesh&&!o.userData.breakupExclude)receivers.push(o);});
 const shadows=new RecognizerShadows([{root,casters:[wall],radius:1000,distance:2400}],receivers,0,{size:filtered?2048:1024,filterEdges:filtered,darkness:.4});
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(900,650);document.body.replaceChildren(renderer.domElement);
 const camera=new T.PerspectiveCamera(45,900/650,.1,1000);camera.position.set(13,16,23);camera.lookAt(0,2,0);shadows.update(renderer);renderer.render(scene,camera);
 window.disposeFixture=()=>{shadows.dispose();renderer.dispose();};
 },filtered);
 await page.screenshot({path:`test-results/tank-wall-shadow-${filtered?'filtered':'nearest'}.png`});await page.evaluate(()=>disposeFixture());
 }
 assert.deepEqual(errors,[]);console.log('Tank shadow comparison rendered without shader errors.');
}finally{await browser.close();}
