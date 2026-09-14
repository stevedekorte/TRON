import * as THREE from 'three';

// Film-style optical burst: a brief serrated flash followed by thin double rings.
// World-space billboard keeps the circles round, with normal wall depth testing.
export function createBlast(position){
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
  uniforms:{age:{value:0},seed:{value:Math.random()*20}},
  vertexShader:'varying vec2 uvPosition; void main(){uvPosition=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`varying vec2 uvPosition; uniform float age; uniform float seed;
  float ring(float r,float radius){return 1.-smoothstep(.008,.019,abs(r-radius));}
  void main(){
   float r=length(uvPosition),a=atan(uvPosition.y,uvPosition.x);
   float rays=.79+.13*sin(a*17.+seed)+.08*sin(a*29.-seed);
   float flashLife=1.-smoothstep(.045,.18,age);
   float flashRadius=(.12+age*1.8)*rays;
   float core=(1.-smoothstep(flashRadius*.8,flashRadius,r))*flashLife;
   float halo=exp(-r*r/((.14+age*.3)*(.14+age*.3)))*flashLife*.4;
   float t=max(0.,age-.07),radius=.1+t*1.05;
   float ringLife=smoothstep(.06,.12,age)*(1.-smoothstep(.36,.78,age));
   float rings=(ring(r,radius)+ring(r,radius*.72)*.75)*ringLife;
   float ember=exp(-r*r/.008)*smoothstep(.08,.15,age)*(1.-smoothstep(.16,.36,age));
   vec3 color=vec3(1.8,1.75,.65)*(core+halo)+vec3(1.1,1.15,.36)*rings+vec3(2.,.07,.015)*ember;
   gl_FragColor=vec4(color,clamp(core+halo+rings+ember,0.,1.));
  }`});
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(36,36),material);mesh.position.copy(position);
 const geometry=new THREE.BufferGeometry(),positions=new Float32Array(36),velocities=[];
 for(let i=0;i<12;i++){
  const velocity=new THREE.Vector3(Math.random()-.5,Math.random()-.35,Math.random()-.5).normalize().multiplyScalar(12+Math.random()*22);
  velocities.push(velocity);
 }
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 const sparks=new THREE.Points(geometry,new THREE.PointsMaterial({color:0xff7130,size:.75,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
 sparks.position.copy(position);sparks.frustumCulled=false;
 return {mesh,sparks,update(age){
  mesh.visible=age<.8;material.uniforms.age.value=age;
  sparks.visible=age<.65;sparks.material.opacity=Math.max(0,1-age/.65);
  for(let i=0;i<12;i++){const v=velocities[i];positions[i*3]=v.x*age;positions[i*3+1]=v.y*age-7.35*age*age;positions[i*3+2]=v.z*age;}
  geometry.attributes.position.needsUpdate=true;
 },dispose(){mesh.geometry.dispose();material.dispose();geometry.dispose();sparks.material.dispose();}};
}
