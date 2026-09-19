import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});try{const page=await browser.newPage({viewport:{width:1500,height:700}});
page.on('console',m=>{if(m.type()==='error')console.log(m.text());});
await page.goto('http://127.0.0.1:5174');
await page.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js'),{createWorld}=await import('/src/rendering/world.js'),{MazeShadows}=await import('/src/rendering/maze-shadows.js'),{WALLS,wallAt}=await import('/src/levels/maze.js');
 const scene=new T.Scene(),world=createWorld(scene),shadows=new MazeShadows(world);
 const edge=WALLS.flatMap(w=>w.edges).find(e=>Math.hypot(e.b.x-e.a.x,e.b.s-e.a.s)>140&&!wallAt((e.a.x+e.b.x)/2+e.nx*.1,(e.a.s+e.b.s)/2+e.ns*.1));
 const {a,b,nx,ns}=edge,mx=(a.x+b.x)/2,ms=(a.s+b.s)/2;
 const renderer=new T.WebGLRenderer({antialias:true,stencil:true});renderer.setSize(1500,700);renderer.setPixelRatio(1.5);document.body.replaceChildren(renderer.domElement);document.body.style.margin=0;
 const camera=new T.PerspectiveCamera(48,1500/700,.1,20000);camera.position.set(mx+nx*65,14,-ms-ns*65);camera.lookAt(mx,10,-ms);shadows.update(renderer);
 window.shot=(strength)=>{shadows.strengths.fill(strength);renderer.render(scene,camera);};
 const gl=renderer.getContext(),w=renderer.domElement.width,h=renderer.domElement.height;
 const pixels=()=>{const a=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
 shot(0);const before=pixels();shot(1);const after=pixels();let artifacts=0;
 // Top 60% is the directly lit planar wall plus its bevel, not floor shadows.
 for(let y=Math.ceil(h*.4);y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4;if(Math.abs(before[i+2]-after[i+2])>2)artifacts++;
 }
 window.artifacts=artifacts;
});const artifacts=await page.evaluate(()=>window.artifacts);assert.ok(artifacts<1000,`${artifacts} self-shadowed wall pixels`);console.log({artifacts});await page.screenshot({path:'test-results/wall-with-shadow.png'});await page.evaluate(()=>shot(0));await page.screenshot({path:'test-results/wall-without-shadow.png'});}finally{await browser.close();}
