import * as THREE from 'three';
import faceUrl from '../../docs/references/images/MCP/MCP.png?url';
// Landmarks refer to the supplied film frame after trimming its black border.
export const FACE={aspect:1972/896,columns:128,rows:80,mouthY:.125,mouthWidth:.28,jawTravel:.024};
export async function createMcpFace(canvas){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x020204);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=2;
 const texture=await new THREE.TextureLoader().loadAsync(faceUrl);texture.colorSpace=THREE.SRGBColorSpace;
 texture.repeat.set(1972/2048,896/980);texture.offset.set(38/2048,59/980);
 const geometry=new THREE.PlaneGeometry(2,2,FACE.columns,FACE.rows),base=geometry.attributes.position.array.slice();
 const material=new THREE.MeshBasicMaterial({map:texture});scene.add(new THREE.Mesh(geometry,material));
 let audioLevel=null,speaking=false,started=0,lastWord=0,amount=0,frame=0,disposed=false;
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);const aspect=w/h;camera.left=-Math.max(1,aspect/FACE.aspect);camera.right=-camera.left;camera.top=Math.max(1,FACE.aspect/aspect);camera.bottom=-camera.top;camera.updateProjectionMatrix();}
 const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
 function draw(now){if(disposed)return;const t=(now-started)/1000;
  // Browser TTS supplies word boundaries, not PCM/visemes. Blend those accents
  // with a syllabic envelope; keep every wireframe line attached to the skin.
  const pulse=Math.max(0,1-(now-lastWord)/210);
  const target=speaking&&!motion.matches?(audioLevel??(.22+.55*Math.pow(Math.sin(t*12),2)+.23*pulse)):0;
  amount+=(target-amount)*.3;
  const pos=geometry.attributes.position,uv=geometry.attributes.uv;
  for(let i=0;i<pos.count;i++){
   const x=uv.getX(i)-.5,y=uv.getY(i)-FACE.mouthY;
   const width=Math.exp(-Math.pow(x/FACE.mouthWidth,4));
   const jaw=Math.tanh(y/.025)*Math.exp(-Math.pow(y/.13,2));
   pos.setXYZ(i,base[i*3],base[i*3+1]+amount*FACE.jawTravel*jaw*width,0);
  }
  pos.needsUpdate=true;renderer.render(scene,camera);frame=requestAnimationFrame(draw);
 }
 frame=requestAnimationFrame(draw);
 return {level(value){audioLevel=value;},speak(active){speaking=active;audioLevel=null;if(active)started=performance.now();},boundary(){lastWord=performance.now();},dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();geometry.dispose();material.dispose();texture.dispose();renderer.dispose();}};
}
