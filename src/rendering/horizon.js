import {DEFAULT_WORLD,worldFor} from '../levels/scenario.js';
import * as T from 'three';

// A fixed world-space dawn direction, independent of camera position/heading.
export class Horizon {
 constructor(scene,world=DEFAULT_WORLD){
  const {SPAWN}=world;
  this.material=new T.ShaderMaterial({depthTest:false,depthWrite:false,fog:false,
   uniforms:{inverseProjection:{value:new T.Matrix4()},cameraWorld:{value:new T.Matrix4()},
    direction:{value:new T.Vector3(-Math.sin(SPAWN.yaw),0,-Math.cos(SPAWN.yaw))},
    night:{value:new T.Color(0x03050c)},blue:{value:new T.Color(0x263f9c)},violet:{value:new T.Color(0x6236cb)}},
   vertexShader:`varying vec2 skyNdc;void main(){skyNdc=position.xy;gl_Position=vec4(position.xy,1.,1.);}`,
   fragmentShader:`uniform mat4 inverseProjection,cameraWorld;uniform vec3 direction,night,blue,violet;varying vec2 skyNdc;
    void main(){
     vec4 p=inverseProjection*vec4(skyNdc,1.,1.);
     vec3 ray=normalize(mat3(cameraWorld)*(p.xyz/p.w));
     vec2 horizontal=ray.xz/max(length(ray.xz),.0001);
     float facing=dot(horizontal,direction.xz);
     float sector=smoothstep(-.12,.94,facing);
     sector*=sector;
     float elevation=max(0.,ray.y);
     float haze=exp(-elevation/.085);
     float rim=exp(-elevation/.0045);
     float above=smoothstep(-.012,0.,ray.y);
     vec3 color=night+sector*above*(blue*haze+violet*rim*.55);
     gl_FragColor=vec4(color,1.);
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
    }`
  });
  this.mesh=new T.Mesh(new T.PlaneGeometry(2,2),this.material);this.mesh.name='Directional blue horizon';this.mesh.frustumCulled=false;this.mesh.renderOrder=-100;scene.add(this.mesh);
 }
 update(camera,visible){
  this.mesh.visible=visible;if(!visible)return;
  camera.updateMatrixWorld();this.material.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);this.material.uniforms.cameraWorld.value.copy(camera.matrixWorld);
 }
}
