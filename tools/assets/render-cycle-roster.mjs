// Rebuild transparent HUD thumbnails from the same repaired model used in play.
// Run against the local Vite server: node scripts/render-cycle-roster.mjs
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();
 await page.route('**/roster-render',r=>r.fulfill({contentType:'text/html',body:'<body></body>'}));
 await page.goto('http://127.0.0.1:5173/roster-render');
 const images=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {loadLightCycles,CYCLE_MODEL_STYLE:S}=await import('/src/rendering/light-cycles.js');
  const {createGameLights,GAME_LIGHTING}=await import('/src/rendering/game-lighting.js');
  const [bike]=await loadLightCycles();
  const scene=new T.Scene();scene.add(bike,createGameLights());
  const box=new T.Box3().setFromObject(bike),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
  const height=size.z*1.06,width=height/2;
  const camera=new T.OrthographicCamera(-width/2,width/2,height/2,-height/2,.01,100);
  camera.position.set(center.x,box.max.y+10,center.z);camera.up.set(0,0,-1);camera.lookAt(center);
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
  renderer.setSize(256,512);renderer.setClearColor(0,0);renderer.toneMapping=GAME_LIGHTING.toneMapping;renderer.toneMappingExposure=GAME_LIGHTING.exposure;
  const colors=new Map();bike.traverse(o=>{if(o.isMesh)for(const m of [].concat(o.material))colors.set(m,m.color.clone());});
  const palettes=[null,[S.blueBody,S.blueTrim],[S.redBody,S.redTrim],[0x178c42,0x46bd65]],images=[];
  for(const palette of palettes){
   for(const [m,original] of colors){m.color.copy(original);if(palette&&m.name==='Color_D06')m.color.setHex(palette[0]);if(palette&&['_1','Color_L12'].includes(m.name))m.color.setHex(palette[1]);}
   renderer.render(scene,camera);images.push(renderer.domElement.toDataURL('image/png'));
  }
  renderer.dispose();return images;
 });
 await mkdir('public/assets/images/cycle-roster',{recursive:true});
 for(const [i,name] of ['gold','blue','red','green'].entries())await writeFile(`public/assets/images/cycle-roster/${name}.png`,Buffer.from(images[i].split(',')[1],'base64'));
 console.log('Rendered four team thumbnails, top-down with forward (-Z) pointing up.');
}finally{await browser.close();}
