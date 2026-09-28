import * as T from 'three';
import { LIGHT_CYCLES as C } from '../game/light-cycles.js';

export const CYCLE_EXPLOSION = Object.freeze({
  framesPerSecond:24, rayFrames:9, lifetimeFrames:24,
  rayCount:38, chipCount:24, radiusMeters:9, originHeightMeters:.6,
  gravityMetersPerSecondSquared:9.81, arcDelayFrames:[2,5], arcFrames:7,
});
const E=CYCLE_EXPLOSION;
const clamp=(v)=>Math.max(0,Math.min(1,v));
// Sample only the effect at film cadence; driving and collision retain their fixed timestep.
export function explosionFrame(age){return Math.floor((age+1e-9)*E.framesPerSecond);}
const random=(id,i,salt)=>{const v=Math.sin(id*97.1+i*31.7+salt*13.3)*43758.5453;return v-Math.floor(v);};
function glowTexture(){
  const size=64,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const d=Math.hypot((x+.5)/size*2-1,(y+.5)/size*2-1),i=(y*size+x)*4;
    data[i]=210;data[i+1]=240;data[i+2]=255;data[i+3]=Math.round(255*Math.pow(Math.max(0,1-d),3));
  }
  const texture=new T.DataTexture(data,size,size);texture.needsUpdate=true;return texture;
}
/** Six reusable bursts, with no frame-by-frame resource creation or persistent wreck collision. */
export class CycleExplosions {
  constructor(root){
    this.matrix=new T.Object3D();this.up=new T.Vector3(0,1,0);this.direction=new T.Vector3();
    const glow=glowTexture(),rayGeometry=new T.CylinderGeometry(.006,.045,1,4);
    const chipGeometry=new T.BoxGeometry(1,1,1),arcGeometry=new T.TorusGeometry(1,.008,4,64,Math.PI);
    const wheelGeometry=new T.TorusGeometry(.35,.035,5,24);
    this.effects=Array.from({length:6},(_,id)=>{
      const group=new T.Group();group.name=`Cycle explosion ${id}`;group.visible=false;root.add(group);
      const white=new T.MeshBasicMaterial({color:new T.Color(2.2,2.5,2.7),transparent:true,depthWrite:false,toneMapped:false});
      const rays=new T.InstancedMesh(rayGeometry,white,E.rayCount);rays.frustumCulled=false;rays.instanceMatrix.setUsage(T.DynamicDrawUsage);group.add(rays);
      const chipMaterial=new T.MeshBasicMaterial({color:new T.Color(1.7,2,2.2),transparent:true,depthWrite:false,toneMapped:false});
      const chips=new T.InstancedMesh(chipGeometry,chipMaterial,E.chipCount);chips.frustumCulled=false;chips.instanceMatrix.setUsage(T.DynamicDrawUsage);group.add(chips);
      const shadows=new T.InstancedMesh(chipGeometry,new T.MeshBasicMaterial({color:0x000007,transparent:true,opacity:.65,depthWrite:false,toneMapped:false}),E.chipCount);
      shadows.frustumCulled=false;shadows.instanceMatrix.setUsage(T.DynamicDrawUsage);group.add(shadows);
      const arcs=E.arcDelayFrames.map(()=>{const mesh=new T.Mesh(arcGeometry,new T.MeshBasicMaterial({color:0xff443e,transparent:true,depthWrite:false,toneMapped:false}));group.add(mesh);return mesh;});
      const wheels=Array.from({length:2},()=>{const m=new T.Mesh(wheelGeometry,chipMaterial);group.add(m);return m;});
      const halo=new T.Sprite(new T.SpriteMaterial({map:glow,color:0xc2eaff,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));group.add(halo);
      const sparks=Array.from({length:6},()=>{const s=new T.Sprite(new T.SpriteMaterial({map:glow,color:0xc2eaff,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));group.add(s);return s;});
      return {id,group,rays,chips,shadows,arcs,wheels,halo,sparks};
    });
  }
  update(r){
    for(const effect of this.effects){
      const crash=r?.crashes.find(c=>c.id===effect.id),age=crash?r.time-crash.time:Infinity;
      const frame=explosionFrame(age);effect.group.visible=frame>=0&&frame<E.lifetimeFrames;
      if(!effect.group.visible)continue;
      const t=frame/E.framesPerSecond,id=effect.id;
      effect.group.position.set(crash.x*C.cellMeters,E.originHeightMeters,crash.z*C.cellMeters);
      effect.group.rotation.y=-(crash.dir??0)*Math.PI/2;
      effect.rays.visible=frame<E.rayFrames;
      if(effect.rays.visible){
        for(let i=0;i<E.rayCount;i++){
          const azimuth=random(id,i,1)*Math.PI*2,elevation=.05+random(id,i,2)*1.45;
          this.direction.set(Math.cos(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.sin(azimuth)*Math.cos(elevation));
          const length=(1.3+E.radiusMeters*frame/(E.rayFrames-1))*(.55+.45*random(id,i,3));
          this.matrix.position.copy(this.direction).multiplyScalar(length*.5);
          this.matrix.quaternion.setFromUnitVectors(this.up,this.direction);this.matrix.scale.set(1,length,1);this.matrix.updateMatrix();effect.rays.setMatrixAt(i,this.matrix.matrix);
        }
        effect.rays.instanceMatrix.needsUpdate=true;
      }
      effect.halo.visible=frame<E.rayFrames;effect.halo.scale.setScalar(3+frame*.6);effect.halo.material.opacity=.85;
      effect.arcs.forEach((arc,i)=>{
        const f=frame-E.arcDelayFrames[i];arc.visible=f>=0&&f<E.arcFrames;
        if(arc.visible){arc.scale.setScalar(1+f*1.35);arc.material.opacity=1-clamp((f-4)/3);}
      });
      const fade=1-clamp((frame-12)/(E.lifetimeFrames-12));effect.chips.material.opacity=fade;
      for(let i=0;i<E.chipCount;i++){
        const a=random(id,i,4)*Math.PI*2,speed=5+random(id,i,5)*9;
        this.matrix.position.set(Math.cos(a)*speed*t,Math.max(-E.originHeightMeters+.06,(3+random(id,i,6)*7)*t-.5*E.gravityMetersPerSecondSquared*t*t),Math.sin(a)*speed*t);
        this.matrix.rotation.set(t*(5+random(id,i,7)*12),i+t*8,i*.7-t*11);
        const size=.08+random(id,i,8)*.3;this.matrix.scale.set(size,size*(.5+random(id,i,9)),size*.22);this.matrix.updateMatrix();effect.chips.setMatrixAt(i,this.matrix.matrix);
        if(i<effect.sparks.length){const spark=effect.sparks[i];spark.position.copy(this.matrix.position);spark.scale.setScalar(.8+size*3);spark.material.opacity=fade*.8;}
      }
      effect.chips.instanceMatrix.needsUpdate=true;
      // Graphic ground silhouettes, aligned with the arena's key light.
      effect.shadows.material.opacity=fade*.65;
      for(let i=0;i<E.chipCount;i++){
        effect.chips.getMatrixAt(i,this.matrix.matrix);this.matrix.matrix.decompose(this.matrix.position,this.matrix.quaternion,this.matrix.scale);
        const h=this.matrix.position.y+E.originHeightMeters;
        // Convert the fixed world-light projection into the burst's heading frame.
        const yaw=effect.group.rotation.y,dx=.5*h,dz=.5*h;
        this.matrix.position.x+=Math.cos(yaw)*dx-Math.sin(yaw)*dz;
        this.matrix.position.z+=Math.sin(yaw)*dx+Math.cos(yaw)*dz;
        this.matrix.position.y=-E.originHeightMeters+.024;
        this.matrix.rotation.set(0,i*.7+t*8,0);this.matrix.scale.z=Math.max(this.matrix.scale.x,this.matrix.scale.y);this.matrix.scale.y=.001;
        this.matrix.updateMatrix();effect.shadows.setMatrixAt(i,this.matrix.matrix);
      }
      effect.shadows.instanceMatrix.needsUpdate=true;
      effect.wheels.forEach((wheel,i)=>{const side=i===0?-1:1;wheel.position.set(side*(.4+t*5),Math.max(-.2,3.5*t-4.905*t*t),t*(i?3:-2));wheel.rotation.set(t*8,side*t*10,side*t*4);});
    }
  }
}
