import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/debris-test',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
 await page.goto((process.env.TRON_URL||'http://127.0.0.1:5173')+'/debris-test');
 const result=await page.evaluate(async()=>{
 await (await import('/src/simulation/debris-physics.js')).debrisPhysicsReady;
  const T=await import('/node_modules/three/build/three.module.js');
  const {Breakups}=await import('/src/rendering/breakup.js'),{createRecognizer,loadRecognizer,createTank}=await import('/src/rendering/models.js');
  const {RECOGNIZER_SCALE}=await import('/src/game/config.js'),{WALLS}=await import('/src/levels/maze.js');
  const scene=new T.Scene(),fx=new Breakups(scene),template=await loadRecognizer(),tank=await createTank();
  const craft=createRecognizer(template);craft.root.scale.setScalar(RECOGNIZER_SCALE);
  const wall=WALLS[0],x=(wall.minX+wall.maxX)/2,z=-(wall.minS+wall.maxS)/2;
  for(let i=0;i<5;i++)fx.spawn(i===4?tank:craft,{subject:i===4?'tank':'recognizer',x:x+i*8,y:wall.height+20,s:-z,yaw:i*.3,fold:0});
  const initial=fx.bursts.reduce((n,b)=>n+b.pieces.length,0),cost=[];let minBottom=Infinity,sleeping=0;
  for(let frame=0;frame<270;frame++){
   const start=performance.now();fx.update(1/60);cost.push(performance.now()-start);
   for(const b of fx.bursts)for(const p of b.pieces){
    if(b.age<p.delay)continue;
    p.group.updateMatrixWorld(true);
    for(const mesh of p.group.children)if(mesh.isMesh){const box=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);minBottom=Math.min(minBottom,box.min.y);}
   }
  }
  sleeping=fx.bursts.flatMap(b=>b.pieces).filter(p=>p.sleeping).length;
  scene.add(new T.HemisphereLight(0xaac8ff,0x251829,3));
  const light=new T.DirectionalLight(0xc4d9ff,3);light.position.set(-35,70,35);scene.add(light);
  const floor=new T.Mesh(new T.PlaneGeometry(1000,1000),new T.MeshStandardMaterial({color:0x152640}));floor.rotation.x=-Math.PI/2;floor.position.set(x,-.03,z);floor.renderOrder=-2;scene.add(floor);
  // Render the same prism geometry used by collisions, including its concave outline.
  const shape=new T.Shape(wall.points.map(p=>new T.Vector2(p.x,-p.s)));
  const geometry=new T.ExtrudeGeometry(shape,{depth:wall.height,bevelEnabled:false});geometry.rotateX(Math.PI/2);geometry.translate(0,wall.height,0);geometry.scale(1,1,-1);
  const wallMesh=new T.Mesh(geometry,new T.MeshStandardMaterial({color:0x21364e,side:T.DoubleSide}));scene.add(wallMesh);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1200,800);document.body.append(renderer.domElement);
  const camera=new T.PerspectiveCamera(55,1.5,.1,3000);camera.position.set(x+190,180,z+210);camera.lookAt(x,10,z);renderer.render(scene,camera);
  cost.sort((a,b)=>a-b);
  const result={initial,minBottom,sleeping,meanMs:cost.reduce((a,b)=>a+b,0)/cost.length,p95Ms:cost[Math.floor(cost.length*.95)]};
  fx.clear();result.remaining=fx.bursts.length;result.bodies=fx.physics.world.bodies.len();fx.dispose();return result;
 });
 assert.ok(result.initial>=60&&result.initial<=160,JSON.stringify(result));assert.ok(result.minBottom>=-.05,JSON.stringify(result));assert.equal(result.remaining,0);assert.equal(result.bodies,0);assert.deepEqual(errors,[]);
 await page.screenshot({path:'test-results/debris-collision.png'});console.log(result);
}finally{await browser.close();}
