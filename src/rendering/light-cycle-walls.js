import * as THREE from 'three';
import { LIGHT_CYCLES as C, cycleTrailState } from '../game/light-cycles.js';
import {cycleTrailHeadTrim} from '../game/cycle-trails.js';
export const CYCLE_WALL_STYLE=Object.freeze({
  colors:[0xde8308,0x167dd8], thicknessMeters:.18,
  flareLengthMeters:10, flareColor:0xfff6dc,
  stripeSpacingMeters:12, stripeHalfWidthMeters:.035, edgeWidthMeters:.025,
  connectionLengthMeters:1.2, connectionCurveSegments:16, connectionHeightSegments:48,
  rearAxleBehindMeters:C.lengthMeters*.347, wheelCenterHeightMeters:.642,
  wheelRadiusMeters:.565, wheelClearanceMeters:.025, floorHeightMeters:.021,
});
const CAPACITY=Math.ceil(C.roundSeconds*C.speedMetersPerSecond/C.cellMeters)*6+60;
/** Opaque trail sheets. Each instance carries its distance along the path from the bike's tail. */
export class LightCycleWalls {
  constructor(root){
    this.matrix=new THREE.Object3D();
    this.meshes=CYCLE_WALL_STYLE.colors.map(color=>{
      const geometry=new THREE.BoxGeometry(1,1,1,1,CYCLE_WALL_STYLE.connectionHeightSegments,1);
      geometry.setAttribute('trailPattern',new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY*3),3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('deathFlash',new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY),1).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('trailDistance',new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY*2),2).setUsage(THREE.DynamicDrawUsage));
      const material=new THREE.ShaderMaterial({
        uniforms:{stripeSpacing:{value:CYCLE_WALL_STYLE.stripeSpacingMeters},stripeWidth:{value:CYCLE_WALL_STYLE.stripeHalfWidthMeters},edgeWidth:{value:CYCLE_WALL_STYLE.edgeWidthMeters/C.trailHeightMeters},wallColor:{value:new THREE.Color(color)},flareColor:{value:new THREE.Color(CYCLE_WALL_STYLE.flareColor)},flareLength:{value:CYCLE_WALL_STYLE.flareLengthMeters},connectionLength:{value:CYCLE_WALL_STYLE.connectionLengthMeters},wheelCenter:{value:CYCLE_WALL_STYLE.wheelCenterHeightMeters-CYCLE_WALL_STYLE.floorHeightMeters},wheelRadius:{value:CYCLE_WALL_STYLE.wheelRadiusMeters},wheelClearance:{value:CYCLE_WALL_STYLE.wheelClearanceMeters},trailHeight:{value:C.trailHeightMeters}},
        vertexShader:`attribute vec3 trailPattern;varying vec3 pattern;
          attribute vec2 trailDistance;attribute float deathFlash;varying float flash;
          uniform float connectionLength,wheelCenter,wheelRadius,wheelClearance,trailHeight;
          varying float distanceBehind,wallHeight;
          void main(){
            float along=(position.x+.5)*trailDistance.x;
            pattern=vec3(trailPattern.x+along,trailPattern.y+along,trailPattern.z);
            flash=deathFlash;
            distanceBehind=trailDistance.y+(.5-position.x)*trailDistance.x;
            wallHeight=position.y+.5;
            vec3 tapered=position;
            // The bottom stays on the floor. Only the leading boundary retreats
            // around the rear tire; it never collapses toward the axle.
            float connection=1.-smoothstep(0.,connectionLength,distanceBehind);
            // Quarter-ellipse: meet the tire low, then flatten into the wall top.
            float curve=clamp(distanceBehind/connectionLength,0.,1.);
            float rounded=sqrt(max(0.,1.-(1.-curve)*(1.-curve)));
            float top=mix(wheelCenter+wheelRadius+wheelClearance,trailHeight,rounded);
            float y=wallHeight*top;
            float dy=y-wheelCenter;
            float cutout=sqrt(max(0.,wheelRadius*wheelRadius-dy*dy))+wheelClearance;
            tapered.x-=connection*cutout/trailDistance.x;
            tapered.y=y/trailHeight-.5;
            gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(tapered,1.);
          }`,
        fragmentShader:`varying vec3 pattern;uniform float stripeSpacing,stripeWidth,edgeWidth;varying float flash;uniform vec3 wallColor,flareColor;uniform float flareLength;
          varying float distanceBehind,wallHeight;
          void main(){
            float flare=exp(-max(0.,distanceBehind)/flareLength);
            vec3 base=wallColor*mix(.72,1.05,smoothstep(0.,1.,wallHeight));
            vec3 color=mix(base,flareColor,flare*flare);
            float stripeDistance=abs(mod(pattern.x+stripeSpacing*.5,stripeSpacing)-stripeSpacing*.5);
            float cornerDistance=min(pattern.y,pattern.z-pattern.y);
            float aa=max(fwidth(pattern.x),.001);
            float vertical=1.-smoothstep(stripeWidth,stripeWidth+aa,min(stripeDistance,cornerDistance));
            float edge=1.-smoothstep(edgeWidth,edgeWidth+fwidth(wallHeight),min(wallHeight,1.-wallHeight));
            color=mix(color,flareColor,max(vertical*.24,edge*.3));
            gl_FragColor=vec4(mix(color,flareColor,flash*.85),1.);
            #include <colorspace_fragment>
          }`,
        transparent:false,depthWrite:true,depthTest:true,toneMapped:false,
      });
      const mesh=new THREE.InstancedMesh(geometry,material,CAPACITY);
      mesh.name='Opaque_light_cycle_walls';mesh.count=0;mesh.frustumCulled=false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);root.add(mesh);return mesh;
    });
  }
  update(r,fraction){
    const counts=[0,0];
    const byBike=Array.from({length:6},()=>[]);
    for(const t of r.trails)byBike[t.bikeId].push(t);
    for(const bike of r.cycles){
      const segments=byBike[bike.id];
      const crash=r.crashes?.find(c=>c.id===bike.id);
      const life=cycleTrailState(bike.alive||!crash?-1:r.time-crash.time);
      if(life.height<=0)continue;
      const offsets=[];let totalPath=bike.expiredTrailMeters??0;for(const t of segments){offsets.push(totalPath);totalPath+=Math.hypot(t.x2-t.x1,t.z2-t.z1)*C.cellMeters;}
      let trim=cycleTrailHeadTrim(r,bike,r.phase==='racing'?(bike.progress??fraction):fraction);
      let behind=bike.alive&&!bike.escaped?0:1e6;
      for(let i=segments.length-1;i>=0;i--){
        const t=segments[i],dx=(t.x2-t.x1)*C.cellMeters,dz=(t.z2-t.z1)*C.cellMeters,total=Math.hypot(dx,dz);
        if(trim>=total){trim-=total;if(t.startsRun){trim=0;behind=1e6;}continue;}
        const length=total-trim;trim=0;
        const ux=dx/total,uz=dz/total;
        const taperPart=Math.min(length,Math.max(0,CYCLE_WALL_STYLE.connectionLengthMeters-behind));
        // Only subdivide the short connection; long trail sheets stay inexpensive.
        const curveSegments=Math.max(1,Math.ceil(taperPart/CYCLE_WALL_STYLE.connectionLengthMeters*CYCLE_WALL_STYLE.connectionCurveSegments));
        const pieces=taperPart>0?Array(curveSegments).fill(taperPart/curveSegments):[];
        if(length>taperPart)pieces.push(length-taperPart);
        let used=0;
        for(const piece of pieces){
          const midpoint=length-used-piece/2;
          this.matrix.position.set(t.x1*C.cellMeters+ux*midpoint,C.trailHeightMeters*life.height/2+CYCLE_WALL_STYLE.floorHeightMeters,t.z1*C.cellMeters+uz*midpoint);
          this.matrix.rotation.y=-Math.atan2(uz,ux);
          this.matrix.scale.set(piece,C.trailHeightMeters*life.height,CYCLE_WALL_STYLE.thicknessMeters);
          this.matrix.updateMatrix();
          const mesh=this.meshes[t.team],slot=counts[t.team]++;
          mesh.setMatrixAt(slot,this.matrix.matrix);
          mesh.geometry.attributes.trailDistance.setXY(slot,piece,behind+used);
          mesh.geometry.attributes.deathFlash.setX(slot,life.flash);
          mesh.geometry.attributes.trailPattern.setXYZ(slot,offsets[i]+length-used-piece,length-used-piece,total);
          used+=piece;
        }
        behind+=length;
        if(t.startsRun){trim=0;behind=1e6;}
      }
    }
    this.meshes.forEach((mesh,i)=>{mesh.count=counts[i];mesh.instanceMatrix.needsUpdate=true;mesh.geometry.attributes.trailDistance.needsUpdate=true;mesh.geometry.attributes.deathFlash.needsUpdate=true;mesh.geometry.attributes.trailPattern.needsUpdate=true;});
  }
}
